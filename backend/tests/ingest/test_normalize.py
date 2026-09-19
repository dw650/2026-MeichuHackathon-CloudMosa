from datetime import date

import pytest

from app.ingest.maps import maps_from_seeds
from app.ingest.normalize import RowError
from app.ingest.providers.base import SourceMaps
from app.ingest.providers.mock import MockProvider
from app.seed.loader import load_seed_files

SEEDS = load_seed_files()
PROVIDER = MockProvider(SEEDS, today_of=lambda _c: date(2026, 9, 19))


@pytest.fixture(scope="module")
def maps() -> SourceMaps:
    return maps_from_seeds(SEEDS, "mock")


def mandi(**overrides: str) -> dict[str, str]:
    row = {
        "_country": "IN",
        "_type": "wholesale",
        "state": "Maharashtra",
        "district": "Nashik",
        "market": "Lasalgaon",
        "commodity": "Onion",
        "variety": "Red",
        "grade": "FAQ",
        "arrival_date": "19/09/2026",
        "min_price": "1900",
        "max_price": "2610",
        "modal_price": "2350",
        "arrival_qtl": "1240.0",
    }
    return row | overrides


def test_india_wholesale_is_converted_from_quintal_to_kg(maps: SourceMaps) -> None:
    q = PROVIDER.normalize(mandi(), maps)
    assert q is not None
    assert (q.country, q.price_type, q.area_id, q.market_id, q.crop_id) == (
        "IN",
        "wholesale",
        "nashik",
        "lasalgaon",
        "onion",
    )
    assert q.trade_date == date(2026, 9, 19)
    assert q.rep_price == pytest.approx(23.5)
    assert q.low_price == pytest.approx(19.0)
    assert q.high_price == pytest.approx(26.1)
    assert q.volume_kg == pytest.approx(124000)
    assert q.variety == "Red"


def test_unmapped_market_or_crop_returns_none(maps: SourceMaps) -> None:
    assert PROVIDER.normalize(mandi(market="Nowhere"), maps) is None
    assert PROVIDER.normalize(mandi(commodity="Durian"), maps) is None


def test_missing_modal_price_is_kept_for_the_validator(maps: SourceMaps) -> None:
    q = PROVIDER.normalize(mandi(modal_price=""), maps)
    assert q is not None
    assert q.rep_price is None


def test_malformed_date_raises_row_error(maps: SourceMaps) -> None:
    with pytest.raises(RowError):
        PROVIDER.normalize(mandi(arrival_date="2026-09-19"), maps)


def test_india_retail_maps_the_centre_to_an_area(maps: SourceMaps) -> None:
    raw = {
        "_country": "IN",
        "_type": "retail",
        "centre": "Pune",
        "state": "Maharashtra",
        "commodity": "Onion",
        "date": "18/09/2026",
        "retail_price": "40.25",
    }
    q = PROVIDER.normalize(raw, maps)
    assert q is not None
    assert (q.price_type, q.area_id, q.market_id, q.crop_id) == ("retail", "pune", None, "onion")
    assert q.rep_price == pytest.approx(40.25)
    assert q.trade_date == date(2026, 9, 18)


def test_taiwan_wholesale_splits_crop_and_variety_and_reads_roc_dates(maps: SourceMaps) -> None:
    raw = {
        "_country": "TW",
        "_type": "wholesale",
        "交易日期": "115.09.19",
        "作物名稱": "甘藍-初秋",
        "市場名稱": "台北二",
        "上價": 52.0,
        "中價": 38.0,
        "下價": 24.0,
        "平均價": 38.5,
        "交易量": 5431,
    }
    q = PROVIDER.normalize(raw, maps)
    assert q is not None
    assert (q.area_id, q.market_id, q.crop_id, q.variety) == ("taipei", "tp2", "cabbage", "初秋")
    assert q.trade_date == date(2026, 9, 19)
    assert (q.rep_price, q.low_price, q.high_price, q.volume_kg) == (38.5, 24.0, 52.0, 5431)


def test_taiwan_retail(maps: SourceMaps) -> None:
    raw = {"_country": "TW", "_type": "retail", "調查日期": "115.09.18", "縣市": "新北市"}
    q = PROVIDER.normalize(raw | {"品項": "香蕉", "零售價": 48.6}, maps)
    assert q is not None
    assert (q.price_type, q.area_id, q.crop_id, q.rep_price) == (
        "retail",
        "newtaipei",
        "banana",
        48.6,
    )


async def test_every_generated_row_normalizes(maps: SourceMaps) -> None:
    rows = await PROVIDER.fetch(date(2026, 9, 18))
    quotes = [PROVIDER.normalize(r, maps) for r in rows]
    assert rows
    assert all(q is not None and q.rep_price and q.rep_price > 0 for q in quotes)


def test_normalize_all_counts_unmapped_and_malformed_rows(maps: SourceMaps) -> None:
    from app.ingest.normalize import normalize_all

    rows = [mandi(), mandi(market="Nowhere"), mandi(commodity="Durian"), mandi(arrival_date="?")]
    quotes, counts = normalize_all(PROVIDER, rows, maps)
    assert len(quotes) == 1
    assert counts == {"unmapped": 2, "malformed": 1}


# ---------- Malaysia PriceCatcher (real rows from tests/fixtures/my_pricecatcher) ----------


def pricecatcher(**overrides: str) -> dict[str, str]:
    """A real row: Pasar Pudu (a Kuala Lumpur wet market), TOMATO, 2026-09-17."""
    row = {
        "_country": "MY",
        "_type": "retail",
        "date": "2026-09-17",
        "premise_code": "3181",
        "item_code": "114",
        "price": "6.0",
    }
    return row | overrides


def test_malaysia_wet_market_rows_are_retail_points_of_their_area(maps: SourceMaps) -> None:
    q = PROVIDER.normalize(pricecatcher(), maps)
    assert q is not None
    assert (q.country, q.price_type, q.area_id, q.market_id, q.crop_id, q.point) == (
        "MY",
        "retail",
        "kualalumpur",
        None,
        "tomato",
        "3181",
    )
    assert (q.trade_date, q.rep_price, q.variety) == (date(2026, 9, 17), 6.0, "114")
    assert (q.low_price, q.high_price, q.volume_kg) == (None, None, None)


def test_malaysia_wholesale_market_rows_are_market_quotes(maps: SourceMaps) -> None:
    # A real row of Pasar Borong Pandan Kangkar Tebrau (Johor Bahru), June 2025.
    row = pricecatcher(_type="wholesale", date="2025-06-18", premise_code="18151", price="3.0")
    q = PROVIDER.normalize(row, maps)
    assert q is not None
    assert (q.price_type, q.area_id, q.market_id, q.point, q.rep_price) == (
        "wholesale",
        "johorbahru",
        "jbborong",
        "",
        3.0,
    )


def test_malaysia_unmapped_premises_and_items_return_none(maps: SourceMaps) -> None:
    assert PROVIDER.normalize(pricecatcher(premise_code="17532"), maps) is None  # mini market
    assert PROVIDER.normalize(pricecatcher(item_code="105"), maps) is None  # local cabbage
    assert PROVIDER.normalize(pricecatcher(item_code="1"), maps) is None  # chicken


def test_malaysia_bad_dates_are_malformed(maps: SourceMaps) -> None:
    with pytest.raises(RowError, match="date"):
        PROVIDER.normalize(pricecatcher(date="17/09/2026"), maps)
