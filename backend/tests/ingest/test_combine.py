"""Retail prices reported per shop or market inside an area become one area price (docs/06
§3.3): their median, like the wholesale area price is the median of the area's markets."""

from dataclasses import replace
from datetime import date

from app.ingest.combine import combine_points
from app.ingest.providers.base import NormalizedQuote
from app.ingest.validate import validate

DAY = date(2026, 9, 17)


def retail(point: str, price: float, **overrides: object) -> NormalizedQuote:
    q = NormalizedQuote(
        source="src",
        country="MY",
        price_type="retail",
        area_id="kualalumpur",
        market_id=None,
        crop_id="tomato",
        variety="114",
        trade_date=DAY,
        rep_price=price,
        point=point,
    )
    return replace(q, **overrides)  # type: ignore[arg-type]


def test_points_of_an_area_become_their_median() -> None:
    (area,) = combine_points([retail("3181", 9.0), retail("8616", 10.0), retail("424", 12.0)])
    assert (area.area_id, area.crop_id, area.trade_date, area.rep_price) == (
        "kualalumpur",
        "tomato",
        DAY,
        10.0,
    )
    assert area.point == ""


def test_an_even_number_of_points_takes_the_mean_of_the_middle_two() -> None:
    (area,) = combine_points([retail("3181", 9.0), retail("8616", 10.0)])
    assert area.rep_price == 9.5


def test_areas_crops_and_days_stay_apart() -> None:
    quotes = [
        retail("3181", 9.0),
        retail("11551", 7.0, area_id="kotabharu"),
        retail("3181", 4.0, crop_id="cabbage", variety="1458"),
        retail("3181", 8.0, trade_date=date(2026, 9, 15)),
    ]
    combined = combine_points(quotes)
    assert len(combined) == 4
    assert {q.point for q in combined} == {""}


def test_quotes_without_points_pass_through_unchanged() -> None:
    wholesale = NormalizedQuote(
        source="src",
        country="MY",
        price_type="wholesale",
        area_id="kualalumpur",
        market_id="kl_borong",
        crop_id="tomato",
        variety="114",
        trade_date=DAY,
        rep_price=3.0,
    )
    survey = retail("", 8.0)
    assert combine_points([wholesale, survey]) == [wholesale, survey]


def test_validation_keeps_every_point_of_an_area() -> None:
    # The same area, crop and day from two shops are not duplicates of each other.
    result = validate([retail("3181", 9.0), retail("8616", 10.0)], {"MY": DAY})
    assert len(result.kept) == 2
    assert result.duplicates == 0
    again = validate([retail("3181", 9.0), retail("3181", 9.5)], {"MY": DAY})
    assert again.duplicates == 1
