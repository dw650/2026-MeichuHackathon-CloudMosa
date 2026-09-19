from datetime import date, timedelta
from statistics import median

import pytest

from app.ingest.providers.base import RawRow
from app.ingest.providers.mock import MockProvider
from app.seed.loader import load_seed_files

TODAY = date(2026, 9, 19)  # Saturday; India closes on Sunday, Taiwan on Monday


@pytest.fixture(scope="module")
def provider() -> MockProvider:
    return MockProvider(load_seed_files(), today_of=lambda _country: TODAY)


async def _window(provider: MockProvider) -> list[RawRow]:
    rows: list[RawRow] = []
    for i in range(60):
        rows += await provider.fetch(TODAY - timedelta(days=i))
    return rows


def _day(row: RawRow) -> date:
    if row["_country"] == "MY":
        return date.fromisoformat(row["date"])
    if "arrival_date" in row:
        d, m, y = (int(x) for x in row["arrival_date"].split("/"))
        return date(y, m, d)
    if "date" in row:
        d, m, y = (int(x) for x in row["date"].split("/"))
        return date(y, m, d)
    roc = row.get("交易日期") or row["調查日期"]
    y, m, d = (int(x) for x in roc.split("."))
    return date(y + 1911, m, d)


def _latest(rows: list[RawRow]) -> date | None:
    days = [_day(r) for r in rows]
    return max(days) if days else None


async def test_same_day_generates_identical_rows(provider: MockProvider) -> None:
    other = MockProvider(load_seed_files(), today_of=lambda _country: TODAY)
    assert await provider.fetch(TODAY) == await other.fetch(TODAY)
    assert await provider.fetch(TODAY - timedelta(days=5)) == await provider.fetch(
        TODAY - timedelta(days=5)
    )


async def test_closed_days_have_no_rows(provider: MockProvider) -> None:
    sunday = date(2026, 9, 13)
    monday = date(2026, 9, 14)
    sunday_rows = await provider.fetch(sunday)
    monday_rows = await provider.fetch(monday)
    assert not [r for r in sunday_rows if r["_country"] == "IN"]
    assert [r for r in sunday_rows if r["_country"] == "TW"]
    assert not [r for r in monday_rows if r["_country"] == "TW"]
    assert [r for r in monday_rows if r["_country"] == "IN"]


async def test_nothing_outside_the_sixty_day_window(provider: MockProvider) -> None:
    assert await provider.fetch(TODAY + timedelta(days=1)) == []
    assert await provider.fetch(TODAY - timedelta(days=60)) == []
    assert await provider.fetch(TODAY - timedelta(days=59)) != []


async def test_areas_without_any_data(provider: MockProvider) -> None:
    rows = await _window(provider)
    assert not [r for r in rows if r.get("district") == "Kurnool" or r.get("centre") == "Kurnool"]
    assert not [r for r in rows if r.get("市場名稱") == "花蓮市" or r.get("縣市") == "花蓮縣"]


async def test_three_day_old_areas(provider: MockProvider) -> None:
    rows = await _window(provider)
    kolar = [r for r in rows if r.get("district") == "Kolar"]
    yilan = [r for r in rows if r.get("市場名稱") == "宜蘭市" or r.get("縣市") == "宜蘭縣"]
    assert _latest(kolar) == TODAY - timedelta(days=3)
    assert _latest(yilan) == TODAY - timedelta(days=3)


async def test_yesterday_areas_and_crops(provider: MockProvider) -> None:
    rows = await _window(provider)
    assert _latest([r for r in rows if r.get("district") == "Jalgaon"]) == date(2026, 9, 18)
    assert _latest([r for r in rows if r.get("市場名稱") == "嘉義市"]) == date(2026, 9, 18)
    assert _latest([r for r in rows if r.get("commodity") == "Potato"]) == date(2026, 9, 18)
    assert _latest([r for r in rows if r.get("commodity") == "Wheat"]) == date(2026, 9, 16)
    sweet = [r for r in rows if str(r.get("作物名稱", r.get("品項", ""))).startswith("甘藷")]
    assert _latest(sweet) == date(2026, 9, 18)


async def test_market_level_exceptions(provider: MockProvider) -> None:
    rows = await _window(provider)
    assert _latest([r for r in rows if r.get("market") == "Yeola"]) == date(2026, 9, 16)
    assert _latest([r for r in rows if r.get("market") == "Malegaon"]) == date(2026, 9, 18)
    assert _latest([r for r in rows if r.get("market") == "Manmad"]) is None
    assert _latest([r for r in rows if r.get("市場名稱") == "豐原區"]) is None


async def test_crops_without_retail(provider: MockProvider) -> None:
    rows = await _window(provider)
    retail = [r for r in rows if r["_type"] == "retail"]
    assert retail
    assert not [r for r in retail if r.get("commodity") in {"Green Chilli", "Soyabean"}]
    assert not [r for r in retail if r.get("品項") in {"花椰菜", "空心菜"}]


async def test_areas_without_retail(provider: MockProvider) -> None:
    rows = await _window(provider)
    retail_areas = {r.get("centre") or r.get("縣市") for r in rows if r["_type"] == "retail"}
    assert not retail_areas & {"Ahmednagar", "Kolar", "Kurnool", "雲林縣", "屏東縣"}
    assert {"Nashik", "台北市"} <= retail_areas


async def test_india_rows_use_data_gov_in_fields_and_quintals(provider: MockProvider) -> None:
    rows = [r for r in await provider.fetch(TODAY) if r.get("market") == "Lasalgaon"]
    onion = next(r for r in rows if r["commodity"] == "Onion")
    assert onion["arrival_date"] == "19/09/2026"
    assert onion["state"] == "Maharashtra"
    assert onion["district"] == "Nashik"
    assert onion["variety"] == "Red"
    modal = float(onion["modal_price"])
    assert 2350 * 0.97 <= modal <= 2350 * 1.03  # ₹ per quintal
    assert float(onion["min_price"]) <= modal <= float(onion["max_price"])


async def test_taiwan_rows_use_moa_fields_and_roc_dates(provider: MockProvider) -> None:
    rows = [r for r in await provider.fetch(TODAY) if r.get("市場名稱") == "台北一"]
    cabbage = next(r for r in rows if r["作物名稱"] == "甘藍-初秋")
    assert cabbage["交易日期"] == "115.09.19"
    assert 32.6 * 0.97 <= cabbage["平均價"] <= 32.6 * 1.03  # NT$ per kg
    assert cabbage["下價"] <= cabbage["平均價"] <= cabbage["上價"]
    assert cabbage["交易量"] > 0


async def test_today_matches_the_base_price_and_the_previous_day_the_change(
    provider: MockProvider,
) -> None:
    # Median over Nashik's fresh markets ≈ p (area k = 1), previous trading day ≈ p / (1 + chg).
    def nashik_onion(rows: list[RawRow]) -> list[float]:
        wholesale = [r for r in rows if r["_type"] == "wholesale"]
        return [
            float(r["modal_price"])
            for r in wholesale
            if r.get("district") == "Nashik" and r["commodity"] == "Onion"
        ]

    today = median(nashik_onion(await provider.fetch(TODAY)))
    before = median(nashik_onion(await provider.fetch(TODAY - timedelta(days=1))))
    assert today == pytest.approx(2350, rel=0.04)
    assert today / before == pytest.approx(1.042, rel=0.04)


# ---------- Malaysia: PriceCatcher rows ----------


def _my(rows: list[RawRow], **match: str) -> list[RawRow]:
    return [r for r in rows if r["_country"] == "MY" and all(r[k] == v for k, v in match.items())]


async def test_malaysia_rows_look_like_pricecatcher(provider: MockProvider) -> None:
    rows = _my(await provider.fetch(TODAY))
    assert rows
    # The price rows joined with the premise lookup, as my_pricecatcher gives them.
    assert {tuple(sorted(r)) for r in rows} == {
        (
            "_country",
            "_type",
            "date",
            "district",
            "item_code",
            "premise_code",
            "premise_type",
            "price",
            "state",
        )
    }
    # Wholesale at Pasar Borong KL: p 7.0 × area k 1.08 × market k 1.0, ±2%.
    (borong,) = _my(rows, _type="wholesale", premise_code="18147", item_code="114")
    assert borong["date"] == "2026-09-19"
    assert (borong["premise_type"], borong["state"]) == ("Borong", "W.P. Kuala Lumpur")
    assert 7.0 * 1.08 * 0.98 <= float(borong["price"]) <= 7.0 * 1.08 * 1.02
    # Retail at a made-up wet market of the area: rt 1.4 × p × area k, ±2.5%.
    (kl,) = _my(rows, _type="retail", premise_code="demo-kualalumpur", item_code="114")
    assert (kl["premise_type"], kl["state"], kl["district"]) == (
        "Pasar Basah",
        "W.P. Kuala Lumpur",
        "",
    )
    assert 1.4 * 7.0 * 1.08 * 0.97 <= float(kl["price"]) <= 1.4 * 7.0 * 1.08 * 1.03
    (klang,) = _my(rows, _type="retail", premise_code="demo-klang", item_code="114")
    assert (klang["state"], klang["district"]) == ("Selangor", "Klang")


async def test_every_malaysian_district_has_demo_retail_prices(provider: MockProvider) -> None:
    rows = _my(await provider.fetch(TODAY), _type="retail")
    my = next(s for s in load_seed_files() if s.country.code == "MY")
    areas = {a.id for a in my.areas if a.mock.lag == 0}
    assert {r["premise_code"].removeprefix("demo-") for r in rows} == areas


async def test_malaysia_areas_without_a_wholesale_market_have_retail_only(
    provider: MockProvider,
) -> None:
    rows = _my(await _window(provider))
    penang = _my(rows, premise_code="demo-timurlaut")
    assert penang
    assert {r["_type"] for r in penang} == {"retail"}
    assert len({r["premise_code"] for r in rows if r["_type"] == "wholesale"}) == 7


async def test_malaysia_trades_every_day_and_keeps_its_exceptions(provider: MockProvider) -> None:
    rows = _my(await _window(provider))
    days = {_day(r) for r in rows}
    assert date(2026, 9, 13) in days  # Sunday
    assert date(2026, 9, 14) in days  # Monday
    assert _latest(_my(rows, premise_code="demo-kuching")) == date(2026, 9, 18)  # yesterday
    assert _latest(_my(rows, premise_code="17450")) == date(2026, 9, 16)  # Kulim: 3 days
    assert _latest(_my(rows, item_code="368")) == date(2026, 9, 17)  # peanut: 2 days
    assert _latest(_my(rows, item_code="917")) == date(2026, 9, 16)  # wheat flour: 3 days
