"""The estimated rows the aggregation writes (docs/06 §3.6): Taiwan's retail from its wholesale
market prices, Malaysia's wholesale from its retail survey, and what must stay untouched."""

from datetime import UTC, date, datetime
from typing import Any

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingest.derive import Derivation, plan
from app.ingest.providers.base import NormalizedQuote
from app.ingest.seed import sync_seed
from app.repositories import ingest as repo
from app.seed.loader import load_derive_seed, load_seed_files
from tests.ingest.test_derive import MOCK, MY_REAL, TW_REAL, plan_for

TODAY = date(2026, 9, 19)
NOW = datetime(2026, 9, 19, 6, 10, tzinfo=UTC)
SEEDS = load_seed_files()
TW = plan_for(MOCK, TW_REAL)["TW"]
MY = plan_for(MOCK, MY_REAL)["MY"]


def quote(country: str, crop: str, area: str, price: float, market: str | None = None, **kw: Any):
    return NormalizedQuote(
        source="real",
        country=country,
        price_type="wholesale" if market else "retail",
        area_id=area,
        market_id=market,
        crop_id=crop,
        variety="",
        trade_date=TODAY,
        rep_price=price,
        **kw,
    )


async def store(session: AsyncSession, *quotes: NormalizedQuote) -> None:
    run_id = await repo.start_run(session, "real", NOW)
    await repo.upsert_quotes(session, quotes, run_id, NOW)


async def area_rows(session: AsyncSession, price_type: str, crop: str = "cabbage") -> dict:
    result = await session.execute(
        text(
            "SELECT area_id, price, n_markets, min_market, max_market, volume_kg FROM area_daily"
            " WHERE crop_id = :c AND price_type = :t AND trade_date = :d"
        ),
        {"c": crop, "t": price_type, "d": TODAY},
    )
    return {r.area_id: r for r in result.all()}


async def market_rows(session: AsyncSession, crop: str = "tomato") -> dict:
    result = await session.execute(
        text(
            "SELECT market_id, rep_price, low_price, high_price, volume_kg FROM market_daily"
            " WHERE crop_id = :c AND trade_date = :d"
        ),
        {"c": crop, "d": TODAY},
    )
    return {r.market_id: r for r in result.all()}


@pytest.fixture
async def seeded(session: AsyncSession) -> AsyncSession:
    await sync_seed(session)
    return session


# ---------- wholesale → retail (Taiwan, India) ----------


async def test_retail_is_the_wholesale_price_times_the_crop_ratio(seeded: AsyncSession) -> None:
    await store(seeded, quote("TW", "cabbage", "taipei", 20, "tp1"))
    await repo.aggregate(seeded, "TW", [TODAY], TW)
    rows = await area_rows(seeded, "retail")
    assert float(rows["taipei"].price) == pytest.approx(20 * 1.7)


async def test_an_estimated_retail_row_counts_no_markets_and_no_volume(
    seeded: AsyncSession,
) -> None:
    await store(seeded, quote("TW", "cabbage", "taipei", 20, "tp1", volume_kg=500))
    await repo.aggregate(seeded, "TW", [TODAY], TW)
    row = (await area_rows(seeded, "retail"))["taipei"]
    assert (row.n_markets, row.min_market, row.max_market, row.volume_kg) == (0, None, None, None)


async def test_no_retail_estimate_for_an_area_or_crop_that_has_no_retail_trade(
    seeded: AsyncSession,
) -> None:
    await store(
        seeded,
        quote("TW", "cabbage", "yunlin", 20, "xiluo"),  # area has_retail = false
        quote("TW", "cauliflower", "taipei", 30, "tp1"),  # crop has_retail = false
    )
    await repo.aggregate(seeded, "TW", [TODAY], TW)
    assert await area_rows(seeded, "retail") == {}
    assert await area_rows(seeded, "retail", "cauliflower") == {}


async def test_a_real_retail_price_is_never_replaced_by_an_estimate(
    seeded: AsyncSession,
) -> None:
    await store(
        seeded,
        quote("TW", "cabbage", "taipei", 20, "tp1"),
        quote("TW", "cabbage", "taipei", 99),  # a real retail quote of the same day
    )
    await repo.aggregate(seeded, "TW", [TODAY], TW)
    assert float((await area_rows(seeded, "retail"))["taipei"].price) == 99


async def test_without_an_estimate_a_missing_price_type_stays_missing(
    seeded: AsyncSession,
) -> None:
    await store(seeded, quote("TW", "cabbage", "taipei", 20, "tp1"))
    await repo.aggregate(seeded, "TW", [TODAY])
    assert await area_rows(seeded, "retail") == {}


async def test_estimating_twice_gives_the_same_rows(seeded: AsyncSession) -> None:
    await store(seeded, quote("TW", "cabbage", "taipei", 20, "tp1"))
    await repo.aggregate(seeded, "TW", [TODAY], TW)
    first = await area_rows(seeded, "retail")
    await repo.aggregate(seeded, "TW", [TODAY], TW)
    assert (await area_rows(seeded, "retail")) == first


# ---------- retail → wholesale (Malaysia) ----------


async def test_wholesale_market_prices_come_from_the_area_retail_price(
    seeded: AsyncSession,
) -> None:
    await store(seeded, quote("MY", "tomato", "kualalumpur", 6.8))
    await repo.aggregate(seeded, "MY", [TODAY], MY)
    markets = await market_rows(seeded)
    assert markets, "the area's markets should get an estimated wholesale price"
    for row in markets.values():
        assert float(row.rep_price) == pytest.approx(6.8 / 1.7, rel=0.05)


async def test_the_area_wholesale_price_is_the_divided_retail_price(
    seeded: AsyncSession,
) -> None:
    await store(seeded, quote("MY", "tomato", "kualalumpur", 6.8))
    await repo.aggregate(seeded, "MY", [TODAY], MY)
    row = (await area_rows(seeded, "wholesale", "tomato"))["kualalumpur"]
    assert float(row.price) == pytest.approx(6.8 / 1.7)
    assert row.n_markets == len(await market_rows(seeded))


async def test_estimated_market_rows_have_no_day_range_and_no_volume(
    seeded: AsyncSession,
) -> None:
    await store(seeded, quote("MY", "tomato", "kualalumpur", 6.8))
    await repo.aggregate(seeded, "MY", [TODAY], MY)
    for row in (await market_rows(seeded)).values():
        assert (row.low_price, row.high_price, row.volume_kg) == (None, None, None)


async def test_an_area_without_markets_gets_no_wholesale_price(seeded: AsyncSession) -> None:
    await store(seeded, quote("MY", "tomato", "kuching", 6.8))  # Kuching has no market
    await repo.aggregate(seeded, "MY", [TODAY], MY)
    assert "kuching" not in await area_rows(seeded, "wholesale", "tomato")


async def test_a_real_market_price_is_never_replaced_by_an_estimate(
    seeded: AsyncSession,
) -> None:
    market = (
        await seeded.execute(text("SELECT id FROM markets WHERE area_id = 'kualalumpur' LIMIT 1"))
    ).scalar_one()
    await store(
        seeded,
        quote("MY", "tomato", "kualalumpur", 6.8),
        quote("MY", "tomato", "kualalumpur", 4.2, market),
    )
    await repo.aggregate(seeded, "MY", [TODAY], MY)
    assert float((await market_rows(seeded))[market].rep_price) == 4.2


# ---------- the whole country, as the worker runs it ----------


async def test_only_the_estimated_type_is_added_for_the_whole_country(
    seeded: AsyncSession,
) -> None:
    plans = plan(
        load_derive_seed(),
        (MOCK, TW_REAL, MY_REAL),
        {"tw_moa": ("TW",), "mock": ("IN",), "my_pricecatcher": ("MY",)},
    )
    assert isinstance(plans["TW"], Derivation)
    await store(
        seeded,
        quote("TW", "cabbage", "taipei", 20, "tp1"),
        quote("MY", "tomato", "kualalumpur", 6.8),
    )
    await repo.aggregate(seeded, "TW", [TODAY], plans["TW"])
    await repo.aggregate(seeded, "MY", [TODAY], plans["MY"])
    types = await seeded.execute(
        text("SELECT country, price_type, count(*) FROM area_daily GROUP BY 1, 2 ORDER BY 1, 2")
    )
    assert [(c, t) for c, t, _ in types.all()] == [
        ("MY", "retail"),  # the real survey price
        ("MY", "wholesale"),  # estimated from it
        ("TW", "retail"),  # estimated from the market prices
        ("TW", "wholesale"),  # the real market prices
    ]
