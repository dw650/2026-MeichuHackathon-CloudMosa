import pytest

from app.services.compare import competition_ranks, diff, haversine_km, market_rows


def test_haversine_between_known_cities() -> None:
    # Nashik → Pune is about 165 km in a straight line.
    assert haversine_km(20.0, 73.79, 18.52, 73.86) == 165
    assert haversine_km(25.04, 121.56, 25.04, 121.56) == 0


def test_same_price_same_rank_and_no_data_unranked() -> None:
    ranks = competition_ranks({"a": 30.0, "b": 25.0, "c": 25.0, "d": 10.0, "e": None})
    assert ranks == {"a": 1, "b": 2, "c": 2, "d": 4, "e": None}


def test_ranks_ignore_float_noise_below_the_stored_precision() -> None:
    assert competition_ranks({"a": 0.1 + 0.2, "b": 0.3}) == {"a": 1, "b": 1}


def test_difference_needs_both_prices() -> None:
    assert diff(25.0, 23.5) == pytest.approx(1.5)
    assert diff(None, 23.5) is None
    assert diff(25.0, None) is None


def test_market_rows_sort_by_price_with_missing_last_and_diff_from_median() -> None:
    rows = market_rows({"a": 22.0, "b": None, "c": 25.0, "d": 23.5}, median=23.5)
    assert [(r.market_id, r.diff) for r in rows] == [
        ("c", pytest.approx(1.5)),
        ("d", pytest.approx(0.0)),
        ("a", pytest.approx(-1.5)),
        ("b", None),
    ]
