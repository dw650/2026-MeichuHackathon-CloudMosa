"""Worker: syncs the seed and runs every enabled provider at start-up, then again each day at
00:05 local time of every country; real sources also refresh the last few days every hour while
the markets publish (docs/06 §8). The international reference prices (bonus B5) are checked at
start-up and with the daily jobs, but only downloaded when due. `python -m app.worker --once`
runs one pass."""

import argparse
import asyncio
import logging
from collections.abc import Callable, Sequence
from datetime import UTC, date, datetime

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import Settings, get_settings
from app.db.session import create_engine, create_sessionmaker
from app.ingest.intl.pink_sheet import KNOWN_MONTHLY_URL
from app.ingest.intl.refresh import IntlConfig, refresh_intl, sync_series
from app.ingest.pipeline import RunSummary, retire_sources, run_provider
from app.ingest.providers import tw_moa
from app.ingest.providers.base import PriceProvider
from app.ingest.providers.mock import MockProvider
from app.ingest.providers.tw_moa import TwMoaProvider, products_from_seeds
from app.ingest.seed import sync_seed
from app.middleware import configure_logging
from app.seed.loader import load_intl_series, load_seed_files
from app.seed.schema import SeedFile
from app.timeutil import country_tz, local_today

logger = logging.getLogger("app.worker")
Clock = Callable[[], datetime]

# Real sources: the countries they take over from the mock, and the hours (local time) of
# their hourly refresh while the markets publish the day's prices (docs/06 §8).
REAL_SOURCES: dict[str, tuple[str, ...]] = {tw_moa.SOURCE: TwMoaProvider.countries}
REFRESH_HOURS: dict[str, str] = {tw_moa.SOURCE: "6-15"}


def _utc_now() -> datetime:
    return datetime.now(UTC)


def build_providers(
    ids: list[str], seeds: list[SeedFile], clock: Clock, *, refresh: bool = False
) -> list[PriceProvider]:
    """The enabled providers. A real source takes its countries over from the mock, so a country
    never mixes demo and real prices; `refresh` gives real sources their short window."""
    offsets = {s.country.code: s.country.utc_offset_min for s in seeds}

    def today_of(country: str) -> date:
        return local_today(offsets[country], clock())

    real = {cc for provider_id in ids for cc in REAL_SOURCES.get(provider_id, ())}
    providers: list[PriceProvider] = []
    for provider_id in ids:
        if provider_id == "mock":
            demo = [s for s in seeds if s.country.code not in real]
            if demo:
                providers.append(MockProvider(demo, today_of=today_of))
        elif provider_id == tw_moa.SOURCE:
            days = tw_moa.REFRESH_DAYS if refresh else tw_moa.WINDOW_DAYS
            providers.append(TwMoaProvider(products_from_seeds(seeds), today_of, days=days))
        else:
            logger.warning("provider %r is not available yet; skipped", provider_id)
    return providers


def owners(providers: Sequence[PriceProvider], seeds: Sequence[SeedFile]) -> dict[str, set[str]]:
    """country → the sources allowed to hold its prices."""
    return {
        s.country.code: {p.source for p in providers if s.country.code in p.countries}
        for s in seeds
    }


async def run_once(
    settings: Settings, clock: Clock = _utc_now, *, refresh: str | None = None
) -> list[RunSummary]:
    """Syncs the seed, removes prices of sources no longer enabled for a country, then runs the
    enabled providers. `refresh` runs only that real source over its short window."""
    engine = create_engine(settings)
    maker = create_sessionmaker(engine)
    try:
        async with maker() as session:
            seeds = await sync_seed(session)
        today = {s.country.code: local_today(s.country.utc_offset_min, clock()) for s in seeds}
        providers = build_providers(settings.provider_ids, seeds, clock, refresh=bool(refresh))
        async with maker() as session:
            await retire_sources(session, owners(providers, seeds))
        if refresh:
            providers = [p for p in providers if p.source == refresh]
        summaries = []
        for provider in providers:
            async with maker() as session:
                summaries.append(await run_provider(session, provider, today, clock=clock))
        return summaries
    finally:
        await engine.dispose()


def schedule_daily(scheduler: AsyncIOScheduler, settings: Settings, seeds: list[SeedFile]) -> None:
    for seed in seeds:
        tz = country_tz(seed.country.utc_offset_min)
        scheduler.add_job(
            run_once,
            CronTrigger(hour=0, minute=5, timezone=tz),
            args=[settings],
            id=f"daily-{seed.country.code}",
            coalesce=True,
            max_instances=1,
            misfire_grace_time=3600,
        )


def schedule_refresh(
    scheduler: AsyncIOScheduler, settings: Settings, seeds: list[SeedFile]
) -> None:
    """Hourly refreshes of each enabled real source, in its country's local time."""
    offsets = {s.country.code: s.country.utc_offset_min for s in seeds}
    for source, hours in REFRESH_HOURS.items():
        if source not in settings.provider_ids:
            continue
        country = REAL_SOURCES[source][0]
        scheduler.add_job(
            run_once,
            CronTrigger(hour=hours, minute=0, timezone=country_tz(offsets[country])),
            args=[settings],
            kwargs={"refresh": source},
            id=f"refresh-{source}",
            coalesce=True,
            max_instances=1,
            misfire_grace_time=600,
        )


def intl_config(settings: Settings) -> IntlConfig:
    return IntlConfig(
        page_url=settings.pink_sheet_page_url,
        file_url=settings.pink_sheet_url.strip(),
        fallback_url=KNOWN_MONTHLY_URL,
        fx_url=settings.fx_url,
    )


async def sync_intl(settings: Settings) -> None:
    """The international price series (bonus B5) follow app/seed/intl/series.yaml. Local and
    quick, so the worker does it first: the page lists its series before any download."""
    engine = create_engine(settings)
    try:
        async with create_sessionmaker(engine)() as session:
            await sync_series(session, load_intl_series().series)
    finally:
        await engine.dispose()


async def run_intl(
    settings: Settings,
    clock: Clock = _utc_now,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
) -> list[RunSummary]:
    """International reference prices (bonus B5): the series always follow the seed; the
    sources are only asked when due (docs/06 §8), so a restart downloads nothing new."""
    if not settings.intl_prices:
        await sync_intl(settings)
        return []
    engine = create_engine(settings)
    try:
        maker = create_sessionmaker(engine)
        seeds = load_intl_series().series
        return await refresh_intl(maker, seeds, intl_config(settings), clock, transport=transport)
    finally:
        await engine.dispose()


def schedule_intl(scheduler: AsyncIOScheduler, settings: Settings, seeds: list[SeedFile]) -> None:
    """With the daily jobs, at 00:05 local time: one job per UTC offset, so countries that
    share one (Taiwan and Malaysia) share the check."""
    if not settings.intl_prices:
        return
    for offset in sorted({s.country.utc_offset_min for s in seeds}):
        scheduler.add_job(
            run_intl,
            CronTrigger(hour=0, minute=5, timezone=country_tz(offset)),
            args=[settings],
            id=f"intl-{offset}",
            coalesce=True,
            max_instances=1,
            misfire_grace_time=3600,
        )


async def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="run one pass and exit")
    args = parser.parse_args(argv)
    settings = get_settings()
    configure_logging(settings.log_level)
    # A bonus page (B5) must never keep the daily prices from being fetched or scheduled.
    try:
        await sync_intl(settings)
    except Exception:
        logger.exception("syncing the international series failed")
    summaries = await run_once(settings)
    logger.info("start-up run: %s", [(s.source, s.status, s.rows_ok) for s in summaries])
    try:
        intl = await run_intl(settings)
        logger.info("start-up intl: %s", [(s.source, s.status, s.rows_ok) for s in intl])
    except Exception:
        logger.exception("start-up intl check failed")
    if args.once:
        return
    scheduler = AsyncIOScheduler()
    seeds = load_seed_files()
    schedule_daily(scheduler, settings, seeds)
    schedule_refresh(scheduler, settings, seeds)
    schedule_intl(scheduler, settings, seeds)
    scheduler.start()
    logger.info("scheduled: %s", [str(j.trigger) for j in scheduler.get_jobs()])
    await asyncio.Event().wait()


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(main())
