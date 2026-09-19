from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingest.pipeline import retire_sources, run_provider
from app.ingest.providers.base import FetchStats, NormalizedQuote, RawRow, SourceMaps
from app.ingest.providers.mock import MockProvider
from app.ingest.seed import sync_seed
from app.seed.loader import load_seed_files

TODAY = date(2026, 9, 19)
NOW = datetime(2026, 9, 19, 6, 10, tzinfo=UTC)
DAYS = {"IN": TODAY, "TW": TODAY, "MY": TODAY}


class FakeProvider:
    """Rows already use our ids; `bad` rows fail to map."""

    source = "fake"
    countries: tuple[str, ...] = ("IN",)

    def __init__(self, rows: list[RawRow], fail: bool = False) -> None:
        self.rows = rows
        self.fail = fail
        self.stats = FetchStats()

    async def fetch(self, day: date) -> list[RawRow]:
        if self.fail:
            raise RuntimeError("upstream down")
        return [r for r in self.rows if r["trade_date"] == day]

    def normalize(self, raw: RawRow, maps: SourceMaps) -> NormalizedQuote | None:
        if raw.get("bad"):
            return None
        fields: dict[str, Any] = {
            "source": "fake",
            "country": "IN",
            "price_type": "wholesale",
            "variety": "",
            "low_price": None,
            "high_price": None,
            "volume_kg": None,
        }
        fields.update({k: v for k, v in raw.items() if k != "bad"})
        if fields["price_type"] == "wholesale":
            fields["area_id"] = maps.market_area[fields["market_id"]]
        return NormalizedQuote(**fields)


def row(market: str | None, price: float, **extra: Any) -> RawRow:
    base: RawRow = {
        "market_id": market,
        "crop_id": "onion",
        "trade_date": TODAY,
        "rep_price": price,
    }
    return base | extra


async def area_row(session: AsyncSession, area: str, price_type: str = "wholesale") -> Any:
    result = await session.execute(
        text(
            "SELECT price, n_markets, min_market, max_market FROM area_daily"
            " WHERE area_id = :a AND crop_id = 'onion' AND price_type = :t AND trade_date = :d"
        ),
        {"a": area, "t": price_type, "d": TODAY},
    )
    return result.one_or_none()


@pytest.fixture
async def seeded(session: AsyncSession) -> AsyncSession:
    await sync_seed(session)
    return session


async def test_area_price_is_the_median_of_an_odd_number_of_markets(seeded: AsyncSession) -> None:
    rows = [row("lasalgaon", 10), row("niphad", 20), row("pimpalgaon", 40)]
    await run_provider(seeded, FakeProvider(rows), DAYS, now=NOW)
    price, n, low, high = await area_row(seeded, "nashik")
    assert (float(price), n, float(low), float(high)) == (20, 3, 10, 40)


async def test_area_price_is_the_mean_of_the_middle_two_for_an_even_count(
    seeded: AsyncSession,
) -> None:
    rows = [row("lasalgaon", 10), row("niphad", 20), row("pimpalgaon", 30), row("yeola", 50)]
    await run_provider(seeded, FakeProvider(rows), DAYS, now=NOW)
    price, n, _, _ = await area_row(seeded, "nashik")
    assert (float(price), n) == (25, 4)


async def test_a_single_market_is_the_area_price(seeded: AsyncSession) -> None:
    await run_provider(seeded, FakeProvider([row("jal", 18.2)]), DAYS, now=NOW)
    price, n, low, high = await area_row(seeded, "jalgaon")
    assert (float(price), n, float(low), float(high)) == (18.2, 1, 18.2, 18.2)


async def test_several_rows_of_one_market_become_their_median(seeded: AsyncSession) -> None:
    rows = [
        row("lasalgaon", 10, variety="A"),
        row("lasalgaon", 12, variety="B"),
        row("lasalgaon", 20, variety="C"),
        row("niphad", 30),
    ]
    await run_provider(seeded, FakeProvider(rows), DAYS, now=NOW)
    market = await seeded.execute(
        text("SELECT rep_price FROM market_daily WHERE market_id = 'lasalgaon'")
    )
    assert float(market.scalar_one()) == 12
    price, n, _, _ = await area_row(seeded, "nashik")
    assert (float(price), n) == (21, 2)


async def test_retail_is_written_directly(seeded: AsyncSession) -> None:
    rows = [row(None, 37.6, price_type="retail", area_id="nashik")]
    await run_provider(seeded, FakeProvider(rows), DAYS, now=NOW)
    price, n, low, high = await area_row(seeded, "nashik", "retail")
    assert (float(price), n, low, high) == (37.6, 0, None, None)


async def test_rerunning_gives_the_same_result(seeded: AsyncSession) -> None:
    rows = [row("lasalgaon", 10), row("niphad", 20), row("pimpalgaon", 40)]
    await run_provider(seeded, FakeProvider(rows), DAYS, now=NOW)
    await run_provider(seeded, FakeProvider(rows), DAYS, now=NOW)
    counts = await seeded.execute(text("SELECT count(*) FROM quotes"))
    assert counts.scalar_one() == 3
    price, n, _, _ = await area_row(seeded, "nashik")
    assert (float(price), n) == (20, 3)


async def test_ingest_run_records_the_counts(seeded: AsyncSession) -> None:
    rows = [row("lasalgaon", 10), row("niphad", 11), row("sinnar", 0), row("x", 1, bad=True)]
    summary = await run_provider(seeded, FakeProvider(rows), DAYS, now=NOW)
    result = await seeded.execute(
        text("SELECT status, rows_in, rows_ok, rows_dropped, drop_reasons FROM ingest_runs")
    )
    status, rows_in, ok, dropped, reasons = result.one()
    assert (status, rows_in, ok, dropped) == ("ok", 4, 2, 2)
    assert reasons == {"unmapped": 1, "non_positive_price": 1}
    assert summary.status == "ok"


async def test_a_failed_fetch_keeps_the_old_data(seeded: AsyncSession) -> None:
    await run_provider(seeded, FakeProvider([row("jal", 18.2)]), DAYS, now=NOW)
    summary = await run_provider(seeded, FakeProvider([], fail=True), DAYS, now=NOW)
    assert summary.status == "failed"
    runs = await seeded.execute(text("SELECT status, error FROM ingest_runs ORDER BY id"))
    assert [(s, e is not None) for s, e in runs.all()] == [("ok", False), ("failed", True)]
    assert await area_row(seeded, "jalgaon") is not None


async def test_the_mock_pipeline_fills_the_aggregates(seeded: AsyncSession) -> None:
    provider = MockProvider(load_seed_files(), today_of=lambda _c: TODAY)
    summary = await run_provider(seeded, provider, DAYS, now=NOW)
    assert summary.status == "ok"
    assert summary.rows_dropped == 0
    latest = await seeded.execute(
        text(
            "SELECT area_id, max(trade_date) FROM area_daily WHERE price_type = 'wholesale'"
            " AND crop_id IN ('onion', 'cabbage') GROUP BY area_id"
        )
    )
    by_area: dict[str, date] = {a: d for a, d in latest.tuples().all()}
    assert by_area["nashik"] == TODAY
    assert by_area["kolar"] == TODAY - timedelta(days=3)
    assert by_area["yilan"] == TODAY - timedelta(days=3)
    assert "kurnool" not in by_area
    assert "hualien" not in by_area
    nashik = await area_row(seeded, "nashik")
    assert nashik is not None
    assert nashik[1] == 7  # Yeola, Malegaon and Manmad are not fresh


async def test_retiring_a_source_removes_its_prices_and_aggregates(seeded: AsyncSession) -> None:
    rows = [
        row("lasalgaon", 10),
        row("niphad", 20),
        row(None, 37.6, price_type="retail", area_id="nashik"),
    ]
    await run_provider(seeded, FakeProvider(rows), DAYS, now=NOW)
    await retire_sources(seeded, {"IN": {"mock"}, "TW": set()})  # "fake" no longer covers IN
    for table in ("quotes", "market_daily", "area_daily"):
        left = await seeded.execute(text(f"SELECT count(*) FROM {table}"))
        assert left.scalar_one() == 0, table


async def test_retiring_keeps_the_sources_still_enabled(seeded: AsyncSession) -> None:
    await run_provider(
        seeded, FakeProvider([row("lasalgaon", 10), row("niphad", 20)]), DAYS, now=NOW
    )
    await retire_sources(seeded, {"IN": {"fake", "mock"}})
    price, n, _, _ = await area_row(seeded, "nashik")
    assert (float(price), n) == (15, 2)


async def test_a_country_without_any_enabled_source_keeps_its_prices(
    seeded: AsyncSession,
) -> None:
    # A PROVIDERS typo must not wipe a country: with nothing to replace them, old prices stay.
    await run_provider(
        seeded, FakeProvider([row("lasalgaon", 10), row("niphad", 20)]), DAYS, now=NOW
    )
    await retire_sources(seeded, {"IN": set()})
    price, n, _, _ = await area_row(seeded, "nashik")
    assert (float(price), n) == (15, 2)
