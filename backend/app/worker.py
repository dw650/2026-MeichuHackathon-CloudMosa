"""Worker: syncs the seed and runs every enabled provider at start-up, then again each day at
00:05 local time of every country (docs/06 §8). `python -m app.worker --once` runs one pass."""

import argparse
import asyncio
import logging
from collections.abc import Callable
from datetime import UTC, datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import Settings, get_settings
from app.db.session import create_engine, create_sessionmaker
from app.ingest.pipeline import RunSummary, run_provider
from app.ingest.providers.base import PriceProvider
from app.ingest.providers.mock import MockProvider
from app.ingest.seed import sync_seed
from app.middleware import configure_logging
from app.seed.loader import load_seed_files
from app.seed.schema import SeedFile
from app.timeutil import country_tz, local_today

logger = logging.getLogger("app.worker")
Clock = Callable[[], datetime]


def _utc_now() -> datetime:
    return datetime.now(UTC)


def build_providers(ids: list[str], seeds: list[SeedFile], clock: Clock) -> list[PriceProvider]:
    offsets = {s.country.code: s.country.utc_offset_min for s in seeds}
    providers: list[PriceProvider] = []
    for provider_id in ids:
        if provider_id == "mock":
            providers.append(
                MockProvider(seeds, today_of=lambda cc: local_today(offsets[cc], clock()))
            )
        else:
            logger.warning("provider %r is not available yet; skipped", provider_id)
    return providers


async def run_once(settings: Settings, clock: Clock = _utc_now) -> list[RunSummary]:
    engine = create_engine(settings)
    maker = create_sessionmaker(engine)
    try:
        async with maker() as session:
            seeds = await sync_seed(session)
        today = {s.country.code: local_today(s.country.utc_offset_min, clock()) for s in seeds}
        summaries = []
        for provider in build_providers(settings.provider_ids, seeds, clock):
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


async def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="run one pass and exit")
    args = parser.parse_args(argv)
    settings = get_settings()
    configure_logging(settings.log_level)
    summaries = await run_once(settings)
    logger.info("start-up run: %s", [(s.source, s.status, s.rows_ok) for s in summaries])
    if args.once:
        return
    scheduler = AsyncIOScheduler()
    schedule_daily(scheduler, settings, load_seed_files())
    scheduler.start()
    logger.info("scheduled: %s", [str(j.trigger) for j in scheduler.get_jobs()])
    await asyncio.Event().wait()


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(main())
