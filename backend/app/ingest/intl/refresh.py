"""Keeps the B5 data current (docs/06 §1.3, §8) with as few requests as possible. Each source
is checked only when it is due, so the worker's restarts (every deploy) download nothing:

- exchange rates: when we hold none, once the provider's announced next update has passed
  (never twice within an hour), or a day after the last check at the latest (about one
  request a day);
- Pink Sheet: when we hold no prices or the last check is 23 hours old (the daily jobs are
  24 hours apart). The official page gives the file's current address; the file itself is
  asked for with a conditional GET, which answers 304 except on the day it changes (early in
  the month). Two small requests a day, one 0.6 MB download a month.

Every check is recorded as an ingest run (shown by /health); a failed one keeps the data we
have and is tried again at the next check."""

import asyncio
import json
import logging
from collections import defaultdict
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

import httpx
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models import IntlSource
from app.ingest.intl.fx import parse_rates
from app.ingest.intl.http import Sleep, UpstreamError, Validators, download, make_client
from app.ingest.intl.pink_sheet import SeriesSpec, find_monthly_url, parse_monthly
from app.ingest.pipeline import RunSummary
from app.repositories import ingest as runs
from app.repositories import intl as repo
from app.seed.schema import IntlSeriesSeed

logger = logging.getLogger("app.ingest.intl")

PINK_SOURCE = "wb_pink"
FX_SOURCE = "er_api"
PINK_EVERY = timedelta(hours=23)
FX_EVERY = timedelta(hours=24)
FX_MIN_GAP = timedelta(hours=1)  # the provider's advice; also covers its late updates
PAGE_MAX_BYTES = 2_000_000
FX_MAX_BYTES = 200_000

Clock = Callable[[], datetime]


@dataclass(frozen=True)
class IntlConfig:
    page_url: str  # the official page that links the current monthly file
    file_url: str  # a fixed file address; "" = take the one the page links
    fallback_url: str  # when the page fails and no address is known yet
    fx_url: str


@dataclass(frozen=True)
class Counts:
    rows_in: int = 0
    rows_ok: int = 0
    dropped: dict[str, int] = field(default_factory=dict)


# A check downloads, then stores what it found with the session it is given.
Check = Callable[[AsyncSession, Clock], Awaitable[Counts]]


def pink_due(state: IntlSource | None, has_prices: bool, now: datetime) -> bool:
    return state is None or not has_prices or now - state.checked_at >= PINK_EVERY


def fx_due(state: IntlSource | None, has_rates: bool, now: datetime) -> bool:
    if state is None or not has_rates or now - state.checked_at >= FX_EVERY:
        return True
    announced = state.next_update_at is not None and now >= state.next_update_at
    return announced and now - state.checked_at >= FX_MIN_GAP


def series_rows(seeds: Sequence[IntlSeriesSeed]) -> list[dict[str, object]]:
    return [
        {
            "id": s.id,
            "sort": i,
            "source_column": s.column,
            "unit": s.unit,
            "icon": s.icon,
            "category": s.category,
            "name": s.name,
            "spec": s.spec,
        }
        for i, s in enumerate(seeds, start=1)
    ]


async def sync_series(session: AsyncSession, seeds: Sequence[IntlSeriesSeed]) -> None:
    """The series table follows app/seed/intl/series.yaml (no network)."""
    await repo.sync_series(session, series_rows(seeds))
    await session.commit()


async def refresh_intl(
    maker: async_sessionmaker[AsyncSession],
    seeds: Sequence[IntlSeriesSeed],
    config: IntlConfig,
    clock: Clock,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
    sleep: Sleep = asyncio.sleep,
    force: bool = False,
) -> list[RunSummary]:
    """Syncs the series, then checks the sources that are due (all of them with `force`)."""
    async with maker() as session:
        await sync_series(session, seeds)
        fx_state = await repo.get_source(session, FX_SOURCE)
        pink_state = await repo.get_source(session, PINK_SOURCE)
        rates_held = await repo.has_rates(session)
        prices_held = await repo.has_prices(session)
    now = clock()
    summaries: list[RunSummary] = []
    async with make_client(transport) as client:
        if force or fx_due(fx_state, rates_held, now):
            summaries.append(await _record(maker, FX_SOURCE, clock, _fx(client, config, sleep)))
        if force or pink_due(pink_state, prices_held, now):
            specs = [SeriesSpec(s.id, s.column, s.unit) for s in seeds]
            check = _pink(client, config, specs, pink_state, prices_held, sleep)
            summaries.append(await _record(maker, PINK_SOURCE, clock, check))
    if not summaries:
        logger.info("intl: nothing due; rates and Pink Sheet were checked recently")
    return summaries


async def _record(
    maker: async_sessionmaker[AsyncSession], source: str, clock: Clock, check: Check
) -> RunSummary:
    """Runs one check as an ingest run; a failure is recorded and the stored data stays."""
    async with maker() as session:
        run_id = await runs.start_run(session, source, clock())
        await session.commit()
        try:
            counts = await check(session, clock)
            await runs.finish_run(
                session,
                run_id,
                status="ok",
                finished_at=clock(),
                rows_in=counts.rows_in,
                rows_ok=counts.rows_ok,
                rows_dropped=sum(counts.dropped.values()),
                drop_reasons=counts.dropped,
            )
            await session.commit()
        except Exception as exc:
            await session.rollback()
            logger.exception("intl check %s (run %s) failed", source, run_id)
            await runs.finish_run(
                session, run_id, status="failed", finished_at=clock(), error=str(exc)[:1000]
            )
            await session.commit()
            return RunSummary(source=source, status="failed", error=str(exc))
    logger.info(
        "intl %s: %d in, %d ok, dropped %s", source, counts.rows_in, counts.rows_ok, counts.dropped
    )
    return RunSummary(
        source=source,
        status="ok",
        rows_in=counts.rows_in,
        rows_ok=counts.rows_ok,
        rows_dropped=sum(counts.dropped.values()),
    )


# ---------- exchange rates ----------


def _fx(client: httpx.AsyncClient, config: IntlConfig, sleep: Sleep) -> Check:
    async def check(session: AsyncSession, clock: Clock) -> Counts:
        got = await download(client, config.fx_url, max_bytes=FX_MAX_BYTES, sleep=sleep)
        try:
            payload = json.loads(got.content)
        except ValueError as exc:
            raise UpstreamError("exchange rates: the answer is not JSON") from exc
        snapshot = parse_rates(payload)
        now = clock()
        await repo.upsert_rates(session, snapshot.rates, snapshot.rate_date, now)
        await repo.save_source(
            session,
            {
                "id": FX_SOURCE,
                "url": config.fx_url,
                "etag": None,
                "last_modified": None,
                "data_date": snapshot.rate_date,
                "next_update_at": snapshot.next_update_at,
                "checked_at": now,
            },
        )
        dropped = {"invalid_rate": snapshot.dropped} if snapshot.dropped else {}
        return Counts(len(snapshot.rates) + snapshot.dropped, len(snapshot.rates), dropped)

    return check


# ---------- Pink Sheet ----------


async def _monthly_url(
    client: httpx.AsyncClient, config: IntlConfig, state: IntlSource | None, sleep: Sleep
) -> str:
    """The configured file, else the one the official page links today, else the last one
    that worked, else the built-in address."""
    if config.file_url:
        return config.file_url
    try:
        page = await download(client, config.page_url, max_bytes=PAGE_MAX_BYTES, sleep=sleep)
        link = find_monthly_url(page.content.decode("utf-8", "replace"), page.url)
        if link:
            return link
        logger.warning("wb_pink: %s no longer links the monthly file", config.page_url)
    except UpstreamError as exc:
        logger.warning("wb_pink: the official page failed: %s", exc)
    return state.url if state else config.fallback_url


def _pink(
    client: httpx.AsyncClient,
    config: IntlConfig,
    specs: Sequence[SeriesSpec],
    state: IntlSource | None,
    prices_held: bool,
    sleep: Sleep,
) -> Check:
    async def check(session: AsyncSession, clock: Clock) -> Counts:
        url = await _monthly_url(client, config, state, sleep)
        # Conditional only for the file we hold; a new address is downloaded in full.
        same = state is not None and state.url == url and prices_held
        validators = Validators(state.etag, state.last_modified) if state and same else None
        got = await download(client, url, validators=validators, sleep=sleep)
        now = clock()
        if got.not_modified:
            await repo.mark_checked(session, PINK_SOURCE, now)
            return Counts()
        sheet = parse_monthly(got.content, specs)
        by_series: dict[str, list[tuple[date, float]]] = defaultdict(list)
        for price in sheet.prices:
            by_series[price.series_id].append((price.month, price.usd))
        for series_id, prices in by_series.items():
            await repo.replace_prices(session, series_id, prices, now)
        await repo.save_source(
            session,
            {
                "id": PINK_SOURCE,
                "url": url,
                "etag": got.validators.etag,
                "last_modified": got.validators.last_modified,
                "data_date": sheet.published,
                "next_update_at": None,
                "checked_at": now,
            },
        )
        dropped = dict(sheet.dropped)
        for series_id, problem in sheet.problems.items():
            logger.warning("wb_pink: series %s left out: %s", series_id, problem)
        if sheet.problems:
            dropped["unreadable_series"] = len(sheet.problems)
        return Counts(sheet.cells, len(sheet.prices), dropped)

    return check
