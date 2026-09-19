"""Cross-country reference prices (docs/02 §5.4): one national price per other country."""

from datetime import date

import pytest

from app.services.crosscountry import (
    CountryPoints,
    Rate,
    card,
    convert,
    national,
    pick_type,
    world_row,
)

D18, D19 = date(2026, 9, 18), date(2026, 9, 19)
TWD = Rate(per_usd=31.83, rate_date=D19)
INR = Rate(per_usd=88.0, rate_date=D19)
MYR = Rate(per_usd=4.2, rate_date=date(2026, 9, 18))


def _points(*rows: tuple[str, date, float]) -> list[tuple[str, date, float]]:
    return list(rows)


# ---------- national price ----------


def test_national_price_is_the_median_of_the_latest_trading_day() -> None:
    points = _points(
        ("wholesale", D18, 99.0),  # an older day never mixes in
        ("wholesale", D19, 20.0),
        ("wholesale", D19, 30.0),
        ("wholesale", D19, 24.0),
    )
    assert national(points, "wholesale") == (D19, 24.0, 3)


def test_national_price_averages_the_middle_two_of_an_even_count() -> None:
    points = _points(("retail", D19, 10.0), ("retail", D19, 20.0))
    assert national(points, "retail") == (D19, 15.0, 2)


def test_national_price_ignores_the_other_price_type() -> None:
    points = _points(("retail", D19, 10.0), ("wholesale", D18, 8.0))
    assert national(points, "wholesale") == (D18, 8.0, 1)
    assert national(points, "retail") == (D19, 10.0, 1)
    assert national(_points(), "wholesale") is None
    assert national(points, "nonsense") is None


# ---------- which price type a country has ----------


def test_the_viewers_price_type_wins_when_the_country_has_it() -> None:
    points = _points(("wholesale", D19, 8.0), ("retail", D19, 12.0))
    assert pick_type(points, "wholesale") == "wholesale"
    assert pick_type(points, "retail") == "retail"


def test_a_country_without_the_viewers_price_type_falls_back_to_the_other_one() -> None:
    assert pick_type(_points(("retail", D19, 12.0)), "wholesale") == "retail"
    assert pick_type(_points(("wholesale", D19, 8.0)), "retail") == "wholesale"
    assert pick_type(_points(), "wholesale") is None


# ---------- conversion ----------


def test_conversion_goes_through_the_us_dollar() -> None:
    # 88 INR per USD, 31.83 TWD per USD: 88 INR is one dollar, so 31.83 TWD.
    assert convert(88.0, INR, TWD) == pytest.approx(31.83)


def test_conversion_needs_both_rates() -> None:
    assert convert(88.0, None, TWD) is None
    assert convert(88.0, INR, None) is None


# ---------- the card ----------


def _india(*rows: tuple[str, date, float]) -> CountryPoints:
    return CountryPoints("IN", "INR", _points(*rows))


def test_card_lists_the_other_countries_in_the_viewers_currency() -> None:
    out = card(
        currency="TWD",
        price_type="wholesale",
        others=[
            _india(("wholesale", D19, 88.0), ("wholesale", D19, 176.0)),
            CountryPoints("MY", "MYR", _points(("retail", D18, 4.2))),
        ],
        rates={"TWD": TWD, "INR": INR, "MYR": MYR},
    )
    assert out is not None
    assert out.currency == "TWD"
    india, malaysia = out.rows
    assert (india.country, india.price_type, india.n_areas) == ("IN", "wholesale", 2)
    assert india.local_per_kg == pytest.approx(132.0)
    assert india.price_per_kg == pytest.approx(47.745)
    assert india.trade_date == D19
    assert india.reason is None
    assert (malaysia.country, malaysia.price_type) == ("MY", "retail")
    assert malaysia.price_per_kg == pytest.approx(31.83)
    assert malaysia.trade_date == D18
    # The oldest rate behind a converted row, so the note never claims a fresher rate.
    assert out.fx_date == D18


def test_card_without_another_country_carries_an_empty_list() -> None:
    out = card(currency="TWD", price_type="wholesale", others=[], rates={"TWD": TWD})
    assert out.rows == []
    assert (out.currency, out.fx_date, out.world) == ("TWD", None, None)


def test_a_country_without_a_price_says_so_and_stays_empty() -> None:
    out = card(
        currency="TWD",
        price_type="wholesale",
        others=[_india()],
        rates={"TWD": TWD, "INR": INR},
    )
    assert out is not None
    row = out.rows[0]
    assert (row.price_per_kg, row.local_per_kg, row.trade_date) == (None, None, None)
    assert (row.price_type, row.n_areas, row.reason) == (None, 0, "no_data")
    assert out.fx_date is None


def test_a_missing_rate_keeps_the_local_price_and_says_why() -> None:
    out = card(
        currency="TWD",
        price_type="wholesale",
        others=[_india(("wholesale", D19, 88.0))],
        rates={"TWD": TWD},  # no INR
    )
    assert out is not None
    row = out.rows[0]
    assert row.price_per_kg is None
    assert row.local_per_kg == pytest.approx(88.0)
    assert row.reason == "no_fx"
    assert out.fx_date is None


def test_the_same_currency_needs_no_rate_at_all() -> None:
    out = card(
        currency="TWD",
        price_type="wholesale",
        others=[CountryPoints("XX", "TWD", _points(("wholesale", D19, 40.0)))],
        rates={},
    )
    assert out is not None
    row = out.rows[0]
    assert row.price_per_kg == pytest.approx(40.0)
    assert row.reason is None
    assert out.fx_date is None


# ---------- the World Bank reference row ----------


def test_only_a_crop_with_a_published_series_gets_a_world_row() -> None:
    assert world_row("tomato", date(2026, 8, 1), 471.0, "mt", TWD) is None
    row = world_row("wheat", date(2026, 8, 1), 240.0, "mt", TWD)
    assert row is not None
    assert row.series_id == "wheat"
    assert row.price_per_kg == pytest.approx(240.0 / 1000 * 31.83)
    assert (row.usd, row.usd_unit, row.reason) == (240.0, "mt", None)


def test_a_world_row_without_a_month_or_a_rate_says_why() -> None:
    empty = world_row("rice", None, None, "mt", TWD)
    assert empty is not None
    assert (empty.price_per_kg, empty.reason) == (None, "no_data")
    unrated = world_row("sugarcane", date(2026, 8, 1), 0.5, "kg", None)
    assert unrated is not None
    assert (unrated.price_per_kg, unrated.reason) == (None, "no_fx")


def test_the_world_row_rate_counts_towards_the_note_date() -> None:
    old = Rate(per_usd=31.83, rate_date=D18)
    out = card(
        currency="TWD",
        price_type="wholesale",
        others=[],
        rates={"TWD": old},
        world=world_row("wheat", D19, 240.0, "mt", old),
    )
    assert out.fx_date == D18
