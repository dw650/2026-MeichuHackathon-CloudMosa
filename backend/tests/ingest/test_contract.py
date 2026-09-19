"""The contract every registered source must keep (docs/06 §1.4).

Each source in `app.ingest.registry.SOURCES` needs a case below that builds it offline (network
sources over their saved fixtures); a source without one fails `test_every_source_has_a_case`.
The checks are the same for every source: its metadata, what `fetch` returns for days inside and
outside the window, what `normalize` makes of every row, determinism, and for network sources
that a run downloads at most once and only what it was asked for."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, timedelta

import httpx
import pytest

from app.ingest import registry
from app.ingest.maps import maps_from_seeds
from app.ingest.normalize import normalize_all
from app.ingest.providers import my_pricecatcher, tw_moa
from app.ingest.providers.base import (
    BuildContext,
    FetchStats,
    NormalizedQuote,
    PriceProvider,
    RawRow,
    SourceInfo,
)
from app.ingest.validate import MAX_AGE_DAYS
from app.seed.loader import load_seed_files
from tests.ingest.test_my_pricecatcher import TODAY as MY_DAY
from tests.ingest.test_my_pricecatcher import FakeStorage
from tests.ingest.test_tw_moa import DAY as TW_DAY
from tests.ingest.test_tw_moa import FakeServer, Sleeps

SEEDS = load_seed_files()


@dataclass(frozen=True)
class Case:
    """How to build a source offline, and the day its sample data ends."""

    today: date
    build: Callable[[BuildContext], PriceProvider]


def _tw_moa(ctx: BuildContext) -> PriceProvider:
    return tw_moa.TwMoaProvider(
        tw_moa.products_from_seeds(ctx.seeds),
        ctx.today_of,
        plan=ctx.days,
        transport=httpx.MockTransport(FakeServer()),
        sleep=Sleeps(),
    )


def _my_pricecatcher(ctx: BuildContext) -> PriceProvider:
    return my_pricecatcher.PriceCatcherProvider(
        my_pricecatcher.wanted_from_seeds(ctx.seeds),
        ctx.today_of,
        plan=ctx.days,
        files=ctx.files,
        lookups={},
        transport=httpx.MockTransport(FakeStorage()),
        sleep=Sleeps(),
    )


CASES: dict[str, Case] = {
    "mock": Case(today=date(2026, 9, 19), build=registry.SOURCES["mock"].build),
    "tw_moa": Case(today=TW_DAY, build=_tw_moa),
    "my_pricecatcher": Case(today=MY_DAY, build=_my_pricecatcher),
}
SOURCE_IDS = sorted(registry.SOURCES)


def _info(source: str) -> SourceInfo:
    return registry.SOURCES[source]


def _countries(info: SourceInfo) -> tuple[str, ...]:
    return registry.coverage([info], SEEDS)[info.id]


def _build(source: str, days: tuple[date, ...] | None = None) -> PriceProvider:
    info, case = _info(source), CASES[source]
    ctx = BuildContext(
        seeds=SEEDS, countries=_countries(info), today_of=lambda _c: case.today, days=days
    )
    return case.build(ctx)


def _window(source: str) -> list[date]:
    today = CASES[source].today
    return [today - timedelta(days=i) for i in reversed(range(_info(source).window_days))]


async def _fetch_window(provider: PriceProvider, days: list[date]) -> list[RawRow]:
    rows: list[RawRow] = []
    for day in days:
        rows += await provider.fetch(day)
    return rows


def test_every_source_has_a_case() -> None:
    assert set(CASES) == set(registry.SOURCES)


@pytest.mark.parametrize("source", SOURCE_IDS)
def test_metadata_is_complete(source: str) -> None:
    info = _info(source)
    assert info.id == source
    assert info.price_types
    assert set(info.price_types) <= {"wholesale", "retail"}
    assert info.window_days == MAX_AGE_DAYS
    seeded = {s.country.code for s in SEEDS}
    if info.fallback:
        assert info.countries == ()
        assert not info.network
    else:
        assert info.countries
        assert set(info.countries) <= seeded
    if info.network:
        assert info.refresh_days > 0
        assert info.fresh_for > timedelta(0)
    else:
        assert info.refresh_hours is None
    provider = _build(source)
    assert provider.source == source
    assert set(provider.countries) <= set(_countries(info))
    assert isinstance(provider.stats, FetchStats)


@pytest.mark.parametrize("source", SOURCE_IDS)
async def test_rows_become_quotes_of_the_declared_kind(source: str) -> None:
    info = _info(source)
    provider = _build(source)
    rows = await _fetch_window(provider, _window(source))
    assert rows
    assert all(isinstance(r, dict) for r in rows)
    maps = maps_from_seeds(SEEDS, source)
    quotes, dropped = normalize_all(provider, rows, maps)
    assert quotes
    assert len(quotes) + sum(dropped.values()) == len(rows)
    areas = {a.id: s.country.code for s in SEEDS for a in s.areas}
    markets = {m.id: a.id for s in SEEDS for a in s.areas for m in a.markets}
    crops = {(s.country.code, c.id) for s in SEEDS for c in s.crops}
    window = set(_window(source))
    for q in quotes:
        assert isinstance(q, NormalizedQuote)
        assert q.source == source
        assert q.country in provider.countries
        assert q.price_type in info.price_types
        assert areas[q.area_id] == q.country
        assert (q.country, q.crop_id) in crops
        assert q.trade_date in window
        assert q.rep_price is None or isinstance(q.rep_price, float)  # per kg; checked later
        if q.price_type == "wholesale":
            assert q.market_id is not None
            assert markets[q.market_id] == q.area_id
        else:
            assert q.market_id is None


@pytest.mark.parametrize("source", SOURCE_IDS)
async def test_days_outside_the_window_give_nothing(source: str) -> None:
    provider = _build(source)
    today = CASES[source].today
    assert await provider.fetch(today + timedelta(days=1)) == []
    assert await provider.fetch(today - timedelta(days=_info(source).window_days)) == []
    assert provider.stats.requests == 0


@pytest.mark.parametrize("source", SOURCE_IDS)
async def test_the_same_input_gives_the_same_rows(source: str) -> None:
    days = _window(source)
    first = await _fetch_window(_build(source), days)
    second = await _fetch_window(_build(source), days)
    assert first == second


@pytest.mark.parametrize("source", [s for s in SOURCE_IDS if _info(s).network])
async def test_a_network_run_downloads_at_most_once(source: str) -> None:
    provider = _build(source)
    days = _window(source)
    await _fetch_window(provider, days)
    sent = provider.stats.requests
    assert sent > 0
    await _fetch_window(provider, days)
    assert provider.stats.requests == sent


@pytest.mark.parametrize("source", [s for s in SOURCE_IDS if _info(s).network])
async def test_a_network_run_fetches_only_its_plan(source: str) -> None:
    today = CASES[source].today
    nothing = _build(source, days=())
    assert await _fetch_window(nothing, _window(source)) == []
    assert nothing.stats.requests == 0

    plan = (today - timedelta(days=1), today)
    provider = _build(source, days=plan)
    rows = await _fetch_window(provider, _window(source))
    quotes, _ = normalize_all(provider, rows, maps_from_seeds(SEEDS, source))
    assert quotes
    assert {q.trade_date for q in quotes} <= set(plan)
