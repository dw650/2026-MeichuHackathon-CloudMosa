"""Worker: syncs the seed and runs every enabled source at start-up, then again each day at
00:05 local time of every country; network sources also refresh hourly while their source
publishes (docs/06 §8). The international reference prices (bonus B5) are checked at start-up
and with the daily jobs, but only downloaded when due. News runs at 00:00 local time of every
country and once at start-up for countries whose news is missing or older than a day (docs/06
§1.6). `python -m app.worker --once` runs one pass (no news).

What a source is (countries, schedule, network or not) comes from `app.ingest.registry`; how
much a network source downloads comes from the fetch policy (`app.ingest.policy`)."""

import argparse
import asyncio
import logging
from collections.abc import Callable, Mapping, Sequence
from dataclasses import replace
from datetime import UTC, date, datetime

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import Settings, get_settings
from app.db.session import create_engine, create_sessionmaker
from app.ingest import derive, registry
from app.ingest.intl.pink_sheet import KNOWN_MONTHLY_URL
from app.ingest.intl.refresh import IntlConfig, refresh_intl, sync_series
from app.ingest.news.job import NEWS_SOURCES
from app.ingest.pipeline import RunSummary, plan_run, retire_sources, run_provider
from app.ingest.providers.base import BuildContext, PriceProvider
from app.ingest.seed import sync_seed
from app.middleware import configure_logging
from app.news import news_options, run_news_once
from app.repositories import catalog as catalog_repo
from app.seed.loader import load_derive_seed, load_intl_series, load_seed_files
from app.seed.schema import SeedFile
from app.timeutil import country_tz, local_today

logger = logging.getLogger("app.worker")
Clock = Callable[[], datetime]


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _today_of(seeds: Sequence[SeedFile], clock: Clock) -> Callable[[str], date]:
    offsets = {s.country.code: s.country.utc_offset_min for s in seeds}

    def today_of(country: str) -> date:
        return local_today(offsets[country], clock())

    return today_of


def build_providers(
    ids: Sequence[str],
    seeds: Sequence[SeedFile],
    clock: Clock,
    *,
    plans: Mapping[str, Sequence[date]] | None = None,
) -> list[PriceProvider]:
    """The enabled providers. A real source takes its countries over from the mock, so a country
    never mixes demo and real prices; `plans` gives network sources the days to fetch (default:
    the whole window)."""
    infos = registry.enabled(ids)
    cover = registry.coverage(infos, seeds)
    today_of = _today_of(seeds, clock)
    providers: list[PriceProvider] = []
    for info in infos:
        if not cover[info.id]:
            continue
        days = plans.get(info.id) if plans else None
        context = BuildContext(
            seeds=seeds,
            countries=cover[info.id],
            today_of=today_of,
            days=None if days is None else tuple(days),
        )
        providers.append(info.build(context))
    return providers


async def run_once(
    settings: Settings,
    clock: Clock = _utc_now,
    *,
    refresh: str | None = None,
    startup: bool = False,
) -> list[RunSummary]:
    """Syncs the seed, removes prices of sources no longer enabled for a country, then runs the
    enabled sources (only `refresh` when given). Network sources fetch what the fetch policy
    plans; at start-up they may be skipped after a recent success."""
    engine = create_engine(settings)
    maker = create_sessionmaker(engine)
    try:
        async with maker() as session:
            seeds = await sync_seed(session)
        today = {s.country.code: local_today(s.country.utc_offset_min, clock()) for s in seeds}
        infos = registry.enabled(settings.provider_ids)
        cover = registry.coverage(infos, seeds)
        # A country whose source reports one price type only gets the other estimated from it
        # (docs/06 §3.6); the screens read `estimated_price_types` to label it as an estimate.
        estimates = derive.plan(load_derive_seed(), infos, cover)
        async with maker() as session:
            await catalog_repo.set_estimated_price_types(
                session, derive.estimated_price_types(estimates, seeds)
            )
            await retire_sources(session, registry.owners(cover, seeds), estimates)
        today_of = _today_of(seeds, clock)
        summaries = []
        for info in infos:
            countries = cover[info.id]
            if (refresh and info.id != refresh) or not countries:
                continue
            context = BuildContext(seeds=seeds, countries=countries, today_of=today_of)
            if info.network:
                async with maker() as session:
                    plan = await plan_run(session, info, countries, today, clock(), startup=startup)
                if plan.skip:
                    logger.info("%s: start-up run skipped (%s)", info.id, plan.skip)
                    summaries.append(RunSummary(source=info.id, status="skipped"))
                    continue
                logger.info(
                    "%s: fetching %d days (%s to %s), %d cached files",
                    info.id,
                    len(plan.days),
                    plan.days[0] if plan.days else "-",
                    plan.days[-1] if plan.days else "-",
                    len(plan.files),
                )
                context = replace(context, days=plan.days, files=plan.files)
            provider = info.build(context)
            async with maker() as session:
                summaries.append(
                    await run_provider(session, provider, today, clock=clock, estimates=estimates)
                )
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
    """Hourly refreshes of each enabled source that has them, in its country's local time."""
    offsets = {s.country.code: s.country.utc_offset_min for s in seeds}
    for info in registry.enabled(settings.provider_ids):
        country = next((cc for cc in info.countries if cc in offsets), None)
        if info.refresh_hours is None or country is None:
            continue
        scheduler.add_job(
            run_once,
            CronTrigger(hour=info.refresh_hours, minute=0, timezone=country_tz(offsets[country])),
            args=[settings],
            kwargs={"refresh": info.id},
            id=f"refresh-{info.id}",
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


def schedule_news(scheduler: AsyncIOScheduler, settings: Settings, seeds: list[SeedFile]) -> None:
    """News at 00:00 local time of every country, plus one start-up run right away that skips
    countries fetched less than a day ago (a redeploy does not fetch again)."""
    if news_options(settings).source not in NEWS_SOURCES:
        logger.info("news is off (NEWS_SOURCE=%r)", settings.news_source)
        return
    for seed in seeds:
        code = seed.country.code
        scheduler.add_job(
            run_news_once,
            CronTrigger(hour=0, minute=0, timezone=country_tz(seed.country.utc_offset_min)),
            args=[settings],
            kwargs={"countries": [code]},
            id=f"news-{code}",
            coalesce=True,
            max_instances=1,
            misfire_grace_time=3600,
        )
    # No trigger: runs once as soon as the scheduler starts.
    scheduler.add_job(
        run_news_once,
        args=[settings],
        kwargs={"startup": True},
        id="news-startup",
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
    summaries = await run_once(settings, startup=True)
    logger.info(
        "start-up run: %s", [(s.source, s.status, s.rows_ok, s.requests) for s in summaries]
    )
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
    schedule_news(scheduler, settings, seeds)
    scheduler.start()
    logger.info("scheduled: %s", [str(j.trigger) for j in scheduler.get_jobs()])
    await asyncio.Event().wait()


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(main())
