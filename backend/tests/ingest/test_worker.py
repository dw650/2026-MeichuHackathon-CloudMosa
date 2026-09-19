from datetime import UTC, datetime, timedelta

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.ingest.providers.mock import MockProvider
from app.seed.loader import load_seed_files
from app.timeutil import country_tz
from app.worker import build_providers, run_once, schedule_daily


def test_build_providers_skips_unknown_sources() -> None:
    seeds = load_seed_files()
    providers = build_providers(["mock", "tw_moa"], seeds, clock=lambda: datetime.now(UTC))
    assert [type(p) for p in providers] == [MockProvider]


def test_daily_jobs_run_at_five_past_midnight_local_time() -> None:
    scheduler = AsyncIOScheduler()
    seeds = load_seed_files()
    schedule_daily(scheduler, Settings(), seeds)
    now = datetime(2026, 9, 19, 12, 0, tzinfo=UTC)
    for seed in seeds:
        job = scheduler.get_job(f"daily-{seed.country.code}")
        assert job is not None
        fire = job.trigger.get_next_fire_time(None, now)
        local = fire.astimezone(country_tz(seed.country.utc_offset_min))
        assert (local.hour, local.minute) == (0, 5)
        assert fire - now < timedelta(days=1)


async def test_run_once_seeds_and_ingests(
    settings: Settings, session: AsyncSession, client: httpx.AsyncClient
) -> None:
    summaries = await run_once(settings)
    assert [(s.source, s.status) for s in summaries] == [("mock", "ok")]
    rows = await session.execute(text("SELECT count(*) FROM area_daily"))
    assert rows.scalar_one() > 1000
    health = (await client.get("/api/v1/health")).json()
    assert [s["source"] for s in health["sources"]] == ["mock"]
    assert health["sources"][0]["last_success_at"] is not None
