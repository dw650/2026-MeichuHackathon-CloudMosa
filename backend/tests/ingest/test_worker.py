from datetime import UTC, date, datetime, timedelta

import httpx
import pytest
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.ingest import registry
from app.ingest.providers import tw_moa
from app.ingest.providers.base import (
    BuildContext,
    FetchStats,
    NormalizedQuote,
    RawRow,
    SourceInfo,
    SourceMaps,
)
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


def test_a_plan_limits_a_network_source_to_the_planned_days() -> None:
    today = datetime.now(UTC).date()
    plan = [today - timedelta(days=2), today - timedelta(days=1), today]
    providers = build_providers(
        ["tw_moa"], load_seed_files(), clock=lambda: datetime.now(UTC), plans={"tw_moa": plan}
    )
    assert [p.plan for p in providers if isinstance(p, TwMoaProvider)] == [plan]


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


# ---------- fetch policy of network sources (docs/06 §8) ----------

NET = "fake_net"
NET_FILE = "https://example.test/prices.csv"
# Not conftest.NOW: the API tests reuse mock data stamped with that exact moment.
NET_NOW = datetime(2026, 9, 19, 6, 12, tzinfo=UTC)


class FakeNet:
    """A network source over our own ids: one Lasalgaon onion price per planned day."""

    source = NET
    countries: tuple[str, ...] = ("IN",)

    def __init__(self, ctx: BuildContext) -> None:
        self.days = ctx.days
        self.files = dict(ctx.files)
        self.stats = FetchStats()
        self._fetched = False

    async def fetch(self, day: date) -> list[RawRow]:
        if self.days is not None and day not in self.days:
            return []
        if not self._fetched:
            self._fetched = True
            self.stats.requests += 2
            self.stats.files[NET_FILE] = {"etag": '"v1"'}
        return [{"day": day}]

    def normalize(self, raw: RawRow, maps: SourceMaps) -> NormalizedQuote | None:
        return NormalizedQuote(
            source=NET,
            country="IN",
            price_type="wholesale",
            area_id="nashik",
            market_id="lasalgaon",
            crop_id="onion",
            variety="",
            trade_date=raw["day"],
            rep_price=20.0,
        )


@pytest.fixture
def fake_net(monkeypatch: pytest.MonkeyPatch) -> list[FakeNet]:
    """Registers FakeNet as `fake_net`; returns the providers the worker built, in order."""
    built: list[FakeNet] = []

    def build(ctx: BuildContext) -> FakeNet:
        provider = FakeNet(ctx)
        built.append(provider)
        return provider

    info = SourceInfo(
        id=NET,
        countries=("IN",),
        price_types=("wholesale",),
        build=build,
        network=True,
        refresh_days=3,
        fresh_for=timedelta(hours=6),
    )
    monkeypatch.setitem(registry.SOURCES, NET, info)
    return built


async def test_network_sources_fetch_only_what_is_missing(
    settings: Settings, session: AsyncSession, fake_net: list[FakeNet]
) -> None:
    net = settings.model_copy(update={"providers": NET})
    now = NET_NOW
    today = date(2026, 9, 19)  # India

    first = await run_once(net, lambda: now, startup=True)
    assert [(s.source, s.status, s.rows_ok, s.requests) for s in first] == [(NET, "ok", 60, 2)]
    assert fake_net[0].days is not None
    assert len(fake_net[0].days) == 60
    assert fake_net[0].files == {}
    runs = await session.execute(text("SELECT requests, files, maps_hash FROM ingest_runs"))
    requests, files, maps_hash = runs.one()
    assert (requests, files) == (2, {NET_FILE: {"etag": '"v1"'}})
    assert maps_hash is not None

    # A restart soon after: nothing to do.
    again = await run_once(net, lambda: now + timedelta(hours=1), startup=True)
    assert [(s.source, s.status) for s in again] == [(NET, "skipped")]
    assert len(fake_net) == 1

    # A scheduled run: the last three days, with the validators of the file already ingested.
    scheduled = await run_once(net, lambda: now + timedelta(hours=1))
    assert [(s.source, s.status, s.rows_ok) for s in scheduled] == [(NET, "ok", 3)]
    assert fake_net[1].days == tuple(today - timedelta(days=i) for i in (2, 1, 0))
    assert fake_net[1].files == {NET_FILE: {"etag": '"v1"'}}

    # A restart long after the last success runs again.
    later = await run_once(net, lambda: now + timedelta(hours=8), startup=True)
    assert [(s.source, s.status) for s in later] == [(NET, "ok")]


async def test_a_network_source_without_prices_fetches_everything_again(
    settings: Settings, session: AsyncSession, fake_net: list[FakeNet]
) -> None:
    net = settings.model_copy(update={"providers": NET})
    demo = settings.model_copy(update={"providers": "mock"})
    now = NET_NOW
    await run_once(net, lambda: now, startup=True)
    await run_once(demo, lambda: now)  # India goes back to the demo: fake_net's prices go
    again = await run_once(net, lambda: now + timedelta(minutes=5), startup=True)
    assert [(s.source, s.status, s.rows_ok) for s in again] == [(NET, "ok", 60)]
    assert fake_net[1].files == {}
