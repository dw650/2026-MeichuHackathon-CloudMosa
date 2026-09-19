"""fetch → normalize → validate → upsert quotes → aggregate → record the run (docs/04 §5.2)."""

import logging
from collections import Counter
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.ingest.normalize import normalize_all
from app.ingest.policy import FetchPlan, LastRun, plan_fetch
from app.ingest.providers.base import PriceProvider, SourceInfo
from app.ingest.validate import MAX_AGE_DAYS, validate
from app.repositories import ingest as repo

logger = logging.getLogger("app.ingest.pipeline")


@dataclass(frozen=True)
class RunSummary:
    source: str
    status: str  # ok | failed | skipped (a start-up run a recent success made unnecessary)
    rows_in: int = 0
    rows_ok: int = 0
    rows_dropped: int = 0
    requests: int = 0
    error: str | None = None


def _window(today: Mapping[str, date], days: int = MAX_AGE_DAYS) -> list[date]:
    """Every trade date any covered country can still accept (today back 59 days)."""
    first = min(today.values()) - timedelta(days=days - 1)
    last = max(today.values())
    return [first + timedelta(days=i) for i in range((last - first).days + 1)]


async def plan_run(
    session: AsyncSession,
    info: SourceInfo,
    countries: Sequence[str],
    today: Mapping[str, date],
    now: datetime,
    *,
    startup: bool = False,
) -> FetchPlan:
    """What a network source fetches in this run, from what the database already has."""
    window = _window({c: today[c] for c in countries}, info.window_days)
    first, last_day = window[0], window[-1]
    covered = await repo.covered_days(session, info.id, countries, first, last_day)
    maps = await repo.load_source_maps(session, info.id)
    previous = await repo.last_success(session, info.id)
    last = None
    if previous is not None:
        finished_at, maps_hash = previous
        files = await repo.run_files(session, info.id, maps_hash)
        last = LastRun(finished_at=finished_at, maps_hash=maps_hash, files=files)
    return plan_fetch(
        info,
        first,
        last_day,
        covered=covered,
        last=last,
        maps_hash=maps.fingerprint(),
        now=now,
        startup=startup,
    )


async def retire_sources(session: AsyncSession, owners: dict[str, set[str]]) -> None:
    """Deletes each country's quotes from sources that no longer cover it (the mock's Taiwan
    prices once tw_moa is enabled, or the other way round) and re-aggregates the dates they
    touched, so a country never mixes demo and real prices. A country no enabled source covers
    keeps its prices: with nothing to replace them, a PROVIDERS typo must not wipe it."""
    for country, sources in sorted(owners.items()):
        if not sources:
            logger.warning("%s: no enabled source; keeping its prices", country)
            continue
        dates = await repo.delete_quotes_except(session, country, sorted(sources))
        if dates:
            await repo.aggregate(session, country, dates)
            logger.info(
                "%s: removed prices of sources other than %s on %d dates",
                country,
                sorted(sources),
                len(dates),
            )
    await session.commit()


async def run_provider(
    session: AsyncSession,
    provider: PriceProvider,
    today: dict[str, date],
    now: datetime | None = None,
    clock: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> RunSummary:
    """Runs one provider. A failure is recorded and the previous data stays untouched."""
    started = now or clock()
    run_id = await repo.start_run(session, provider.source, started)
    await session.commit()
    stats = provider.stats
    try:
        rows = []
        for day in _window({c: today[c] for c in provider.countries}):
            rows += await provider.fetch(day)
        fetched_at = now or clock()
        maps = await repo.load_source_maps(session, provider.source)
        quotes, dropped = normalize_all(provider, rows, maps)
        result = validate(quotes, today)
        # Rows the provider left out while downloading count like rows dropped here.
        reasons = Counter(stats.dropped) + Counter(dropped) + Counter(result.dropped)
        if result.duplicates:
            reasons["duplicate"] += result.duplicates
        await repo.upsert_quotes(session, result.kept, run_id, fetched_at)
        affected: dict[str, set[date]] = {}
        for q in result.kept:
            affected.setdefault(q.country, set()).add(q.trade_date)
        for country, dates in affected.items():
            await repo.aggregate(session, country, sorted(dates))
        summary = RunSummary(
            source=provider.source,
            status="ok",
            rows_in=len(rows) + sum(stats.dropped.values()),
            rows_ok=len(result.kept),
            rows_dropped=sum(reasons.values()),
            requests=stats.requests,
        )
        await repo.finish_run(
            session,
            run_id,
            status="ok",
            finished_at=now or clock(),
            rows_in=summary.rows_in,
            rows_ok=summary.rows_ok,
            rows_dropped=summary.rows_dropped,
            drop_reasons=dict(reasons),
            requests=stats.requests,
            files=stats.files,
            maps_hash=maps.fingerprint(),
        )
        await session.commit()
    except Exception as exc:
        await session.rollback()
        logger.exception("ingest run %s (%s) failed", run_id, provider.source)
        await repo.finish_run(
            session,
            run_id,
            status="failed",
            finished_at=now or clock(),
            error=str(exc)[:1000],
            requests=stats.requests,
        )
        await session.commit()
        return RunSummary(
            source=provider.source, status="failed", requests=stats.requests, error=str(exc)
        )
    logger.info(
        "ingest %s: %d rows in, %d ok, %d dropped %s, %d requests",
        provider.source,
        summary.rows_in,
        summary.rows_ok,
        summary.rows_dropped,
        dict(reasons),
        summary.requests,
    )
    return summary
