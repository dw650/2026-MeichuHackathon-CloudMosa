"""International reference prices (bonus B5): conversion, change and the 12-month trend."""

from datetime import date
from decimal import Decimal

import pytest

from app.db.models import FxRate, IntlSeries
from app.services.intl import add_months, item_view, per_kg, trend_view

TWD = FxRate(currency="TWD", per_usd=Decimal("31.834145"), rate_date=date(2026, 9, 19))
RICE = IntlSeries(
    id="rice",
    sort=1,
    source_column="Rice, Thai 5%",
    unit="mt",
    icon="rice",
    category="cereal",
    name={"zh-TW": "稻米", "en": "Rice"},
    spec={"zh-TW": "泰國 5% 碎米", "en": "Thai 5% broken"},
)
SUGAR = IntlSeries(
    id="sugar",
    sort=5,
    source_column="Sugar, world",
    unit="kg",
    icon="sugarcane",
    category="other",
    name={"zh-TW": "原糖", "en": "Sugar"},
    spec={"zh-TW": "國際糖協定價格", "en": "World (ISA) raw"},
)
# Rice, Thai 5% ($/mt), September 2025 to August 2026 as published.
RICE_MONTHS = [374, 356, 368, 424, 408, 409, 381, 403, 440, 494, 467, 471]
RICE_POINTS = {add_months(date(2025, 9, 1), i): float(v) for i, v in enumerate(RICE_MONTHS)}
AUG, JUL = date(2026, 8, 1), date(2026, 7, 1)


@pytest.mark.parametrize(
    ("month", "n", "expected"),
    [
        (date(2026, 8, 1), -1, date(2026, 7, 1)),
        (date(2026, 1, 1), -1, date(2025, 12, 1)),
        (date(2025, 9, 1), 11, date(2026, 8, 1)),
        (date(2026, 8, 1), -24, date(2024, 8, 1)),
        (date(2026, 12, 1), 1, date(2027, 1, 1)),
    ],
)
def test_months_are_counted_across_years(month: date, n: int, expected: date) -> None:
    assert add_months(month, n) == expected


def test_prices_per_ton_and_per_kg_become_local_currency_per_kg() -> None:
    assert per_kg(471, "mt", 31.834145) == pytest.approx(14.99388, abs=1e-5)
    assert per_kg(0.38, "kg", 31.834145) == pytest.approx(12.0970, abs=1e-4)
    assert per_kg(471, "mt", None) is None


def test_a_series_shows_its_latest_month_and_the_change_from_the_month_before() -> None:
    item = item_view(RICE, RICE_POINTS, TWD)
    assert (item["id"], item["source_name"], item["usd_unit"]) == ("rice", "Rice, Thai 5%", "mt")
    assert (item["month"], item["usd"], item["reason"]) == (AUG, 471, None)
    assert item["price_per_kg"] == 14.9939
    assert item["change"] == {
        "pct": pytest.approx(0.008565, abs=1e-6),
        "diff_per_kg": 0.1273,
        "direction": "up",
        "prev_month": JUL,
    }


def test_a_price_per_kg_series_is_not_divided_by_a_thousand() -> None:
    item = item_view(SUGAR, {AUG: 0.38, JUL: 0.34}, TWD)
    assert item["price_per_kg"] == 12.097
    assert item["change"]["direction"] == "up"


def test_without_prices_the_reason_is_no_data() -> None:
    item = item_view(RICE, {}, TWD)
    assert (item["month"], item["usd"], item["price_per_kg"]) == (None, None, None)
    assert (item["reason"], item["change"]) == ("no_data", None)


def test_without_a_rate_the_dollar_price_and_the_change_stay() -> None:
    item = item_view(RICE, RICE_POINTS, None)
    assert (item["price_per_kg"], item["reason"], item["usd"]) == (None, "no_fx", 471)
    assert item["change"]["diff_per_kg"] is None
    assert item["change"]["pct"] == pytest.approx(0.008565, abs=1e-6)


def test_no_change_when_the_month_before_is_missing() -> None:
    gap = {m: v for m, v in RICE_POINTS.items() if m != JUL}
    assert item_view(RICE, gap, TWD)["change"] is None


def test_a_tiny_move_is_flat() -> None:
    item = item_view(RICE, {AUG: 471.1, JUL: 471.0}, TWD)
    assert item["change"]["direction"] == "flat"


def test_the_trend_holds_twelve_months_with_high_low_and_average() -> None:
    view = trend_view(RICE, RICE_POINTS, TWD)
    months = [row["month"] for row in view["series"]]
    assert months == [add_months(date(2025, 9, 1), i) for i in range(12)]
    assert view["series"][-1] == {"month": AUG, "usd": 471, "price_per_kg": 14.9939}
    stats = view["stats"]
    assert stats["high_per_kg"] == pytest.approx(494 / 1000 * 31.834145, abs=1e-4)
    assert stats["low_per_kg"] == pytest.approx(356 / 1000 * 31.834145, abs=1e-4)
    assert stats["avg_per_kg"] == pytest.approx(416.25 / 1000 * 31.834145, abs=1e-4)
    assert stats["vs_avg_pct"] == pytest.approx(471 / 416.25 - 1, abs=1e-5)


def test_months_without_a_price_stay_empty_in_the_trend() -> None:
    gap = {m: v for m, v in RICE_POINTS.items() if m != date(2026, 3, 1)}
    rows = trend_view(RICE, gap, TWD)["series"]
    assert rows[6] == {"month": date(2026, 3, 1), "usd": None, "price_per_kg": None}
    assert len(rows) == 12


def test_no_trend_without_prices_or_a_rate() -> None:
    empty = trend_view(RICE, {}, TWD)
    assert empty["series"] == []
    assert empty["stats"] == {
        "high_per_kg": None,
        "low_per_kg": None,
        "avg_per_kg": None,
        "vs_avg_pct": None,
    }
    no_rate = trend_view(RICE, RICE_POINTS, None)
    assert [row["usd"] for row in no_rate["series"]] == RICE_MONTHS
    assert {row["price_per_kg"] for row in no_rate["series"]} == {None}
    assert no_rate["stats"]["high_per_kg"] is None
