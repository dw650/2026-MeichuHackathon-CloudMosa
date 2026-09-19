from datetime import UTC, datetime, timedelta

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.ingest.providers import tw_moa
from app.ingest.providers.mock import MockProvider
from app.ingest.providers.tw_moa import TwMoaProvider, products_from_seeds
from app.seed.loader import load_seed_files
from app.timeutil import country_tz
from app.worker import build_providers, run_once, schedule_daily, schedule_refresh


def test_build_providers_skips_unknown_sources() -> None:
    seeds = load_seed_files()
    providers = build_providers(["mock", "in_datagov"], seeds, clock=lambda: datetime.now(UTC))
    assert [type(p) for p in providers] == [MockProvider]


def test_a_real_source_takes_its_country_over_from_the_mock() -> None:
    seeds = load_seed_files()
    providers = build_providers(["mock", "tw_moa"], seeds, clock=lambda: datetime.now(UTC))
    assert [(type(p), p.countries) for p in providers] == [
        (MockProvider, ("IN",)),
        (TwMoaProvider, ("TW",)),
    ]
    tw = providers[1]
    assert isinstance(tw, TwMoaProvider)
    assert tw.days == tw_moa.WINDOW_DAYS
    assert tw.products == products_from_seeds(seeds)


def test_the_mock_is_left_out_when_real_sources_cover_every_country() -> None:
    seeds = [s for s in load_seed_files() if s.country.code == "TW"]
    providers = build_providers(["mock", "tw_moa"], seeds, clock=lambda: datetime.now(UTC))
    assert [type(p) for p in providers] == [TwMoaProvider]


def test_refresh_runs_use_the_short_window() -> None:
    providers = build_providers(
        ["tw_moa"], load_seed_files(), clock=lambda: datetime.now(UTC), refresh=True
    )
    assert [p.days for p in providers if isinstance(p, TwMoaProvider)] == [tw_moa.REFRESH_DAYS]


def test_real_sources_refresh_hourly_during_taiwan_market_hours() -> None:
    seeds = load_seed_files()
    idle = AsyncIOScheduler()
    schedule_refresh(idle, Settings(providers="mock"), seeds)
    assert idle.get_jobs() == []

    scheduler = AsyncIOScheduler()
    schedule_refresh(scheduler, Settings(providers="mock,tw_moa"), seeds)
    job = scheduler.get_job("refresh-tw_moa")
    assert job is not None
    assert job.kwargs == {"refresh": "tw_moa"}
    tz = country_tz(480)
    fire = datetime(2026, 9, 19, 12, 0, tzinfo=UTC)  # 20:00 in Taiwan
    hours = []
    for _ in range(11):
        fire = job.trigger.get_next_fire_time(fire, fire + timedelta(seconds=1))
        local = fire.astimezone(tz)
        hours.append((local.day, local.hour, local.minute))
    assert hours == [(20, h, 0) for h in range(6, 16)] + [(21, 6, 0)]


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
