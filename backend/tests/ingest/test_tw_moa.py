"""tw_moa (bonus B2): real MOA FarmTransData rows through the Taiwan normalizer.

`tests/fixtures/tw_moa_farmtrans.json` holds 413 real rows fetched on 2026-09-20 with
Crop=甘藍, 香蕉, 甘薯 and 番茄 for 115.09.14–115.09.16 (deduplicated): varieties we map and
varieties we do not, markets outside our areas and the market-closure notices (作物代號 "rest")
the API adds to every answer. Nothing here touches the network."""

import json
from collections import Counter
from datetime import date
from pathlib import Path

import pytest

from app.ingest.maps import maps_from_seeds
from app.ingest.normalize import normalize_all
from app.ingest.providers.base import RawRow, SourceMaps
from app.ingest.providers.tw_moa import TwMoaProvider, products_from_seeds
from app.seed.loader import load_seed_files

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "tw_moa_farmtrans.json"
ROWS: list[RawRow] = json.loads(FIXTURE.read_text(encoding="utf-8"))
SEEDS = load_seed_files()
DAY = date(2026, 9, 16)


@pytest.fixture(scope="module")
def maps() -> SourceMaps:
    return maps_from_seeds(SEEDS, "tw_moa")


@pytest.fixture(scope="module")
def provider() -> TwMoaProvider:
    return TwMoaProvider(products_from_seeds(SEEDS), today_of=lambda _c: DAY)


def real(day: str, market: str, product: str) -> RawRow:
    """The one fixture row of a product at a market on a ROC date."""
    (found,) = [
        r for r in ROWS if (r["交易日期"], r["市場名稱"], r["作物名稱"]) == (day, market, product)
    ]
    return found


# ---------- normalize ----------


def test_a_real_row_becomes_a_quote_per_kg(provider: TwMoaProvider, maps: SourceMaps) -> None:
    q = provider.normalize(real("115.09.16", "台北二", "甘藍-初秋"), maps)
    assert q is not None
    assert (q.source, q.country, q.price_type, q.area_id, q.market_id, q.crop_id) == (
        "tw_moa",
        "TW",
        "wholesale",
        "taipei",
        "tp2",
        "cabbage",
    )
    assert (q.variety, q.trade_date) == ("初秋", DAY)
    assert (q.rep_price, q.low_price, q.high_price, q.volume_kg) == (49.7, 33.0, 75.0, 5400.0)


def test_only_the_listed_varieties_are_mapped(provider: TwMoaProvider, maps: SourceMaps) -> None:
    def crop(product: str) -> str | None:
        q = provider.normalize(real("115.09.16", "台北一", product), maps)
        return None if q is None else q.crop_id

    assert crop("香蕉") == "banana"  # the plain name is the common Pei-chiao banana
    assert crop("甘薯-臺農57號") == "sweetpotato"
    assert crop("番茄-牛番茄") == "tomato"
    # Other varieties, imported lots and look-alike names are never guessed.
    assert crop("香蕉-芭蕉紅芭蕉") is None
    assert crop("甘藍-改良種") is None
    assert crop("甘藍-進口 初秋") is None
    assert crop("甘薯葉") is None
    assert crop("小番茄-聖女") is None


def test_markets_outside_our_areas_are_not_mapped(
    provider: TwMoaProvider, maps: SourceMaps
) -> None:
    assert provider.normalize(real("115.09.16", "溪湖鎮", "甘藍-初秋"), maps) is None


def test_closure_notices_are_counted_apart_from_unmapped_rows(
    provider: TwMoaProvider, maps: SourceMaps
) -> None:
    quotes, dropped = normalize_all(provider, ROWS, maps)
    notices = [r for r in ROWS if r["作物代號"] == "rest"]
    assert len(notices) == 25
    assert dropped["market_closed"] == 25
    assert len(quotes) + dropped["unmapped"] + dropped["market_closed"] == len(ROWS)
    assert "malformed" not in dropped
    by_crop = Counter(q.crop_id for q in quotes)
    assert set(by_crop) == {"cabbage", "banana", "sweetpotato", "tomato"}
