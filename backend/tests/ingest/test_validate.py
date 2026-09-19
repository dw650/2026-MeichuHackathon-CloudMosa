from datetime import date, timedelta
from typing import Any

import pytest

from app.ingest.providers.base import NormalizedQuote
from app.ingest.validate import ValidationResult, validate

TODAY = date(2026, 9, 19)


def quote(**overrides: Any) -> NormalizedQuote:
    fields: dict[str, Any] = {
        "source": "mock",
        "country": "IN",
        "price_type": "wholesale",
        "area_id": "nashik",
        "market_id": "lasalgaon",
        "crop_id": "onion",
        "variety": "Red",
        "trade_date": TODAY,
        "rep_price": 23.5,
        "low_price": 19.0,
        "high_price": 26.1,
        "volume_kg": 1000.0,
    }
    return NormalizedQuote(**(fields | overrides))


def run(*quotes: NormalizedQuote) -> ValidationResult:
    return validate(list(quotes), today={"IN": TODAY, "TW": TODAY})


def test_valid_quotes_pass_untouched() -> None:
    result = run(quote())
    assert result.kept == [quote()]
    assert result.dropped == {}


def test_missing_representative_price_is_dropped() -> None:
    result = run(quote(rep_price=None))
    assert result.kept == []
    assert result.dropped == {"missing_price": 1}


@pytest.mark.parametrize("price", [0.0, -3.0])
def test_non_positive_price_is_dropped(price: float) -> None:
    assert run(quote(rep_price=price)).dropped == {"non_positive_price": 1}


def test_inverted_range_is_dropped() -> None:
    assert run(quote(low_price=30.0, high_price=20.0)).dropped == {"inverted_range": 1}


def test_price_outside_its_range_keeps_the_price_and_clears_the_range() -> None:
    result = run(quote(rep_price=40.0))
    assert result.dropped == {}
    kept = result.kept[0]
    assert (kept.rep_price, kept.low_price, kept.high_price) == (40.0, None, None)


def test_non_positive_range_bound_is_cleared() -> None:
    kept = run(quote(low_price=0.0)).kept[0]
    assert (kept.low_price, kept.high_price) == (None, None)


def _market(i: int, price: float) -> NormalizedQuote:
    return quote(market_id=f"m{i}", rep_price=price, low_price=None, high_price=None)


def test_prices_five_times_the_national_median_are_outliers() -> None:
    result = run(_market(1, 20.0), _market(2, 21.0), _market(3, 22.0), _market(4, 110.0))
    assert result.dropped == {"outlier": 1}
    assert sorted(q.rep_price or 0 for q in result.kept) == [20.0, 21.0, 22.0]


def test_prices_below_a_fifth_of_the_median_are_outliers() -> None:
    result = run(_market(1, 20.0), _market(2, 21.0), _market(3, 22.0), _market(4, 4.0))
    assert result.dropped == {"outlier": 1}


def test_outliers_are_judged_per_crop_type_and_day() -> None:
    retail = quote(price_type="retail", market_id=None, rep_price=110.0, low_price=None)
    other_day = _market(9, 110.0)
    other_day = quote(**(other_day.__dict__ | {"trade_date": TODAY - timedelta(days=1)}))
    result = run(_market(1, 20.0), _market(2, 21.0), retail, other_day)
    assert result.dropped == {}


def test_future_dates_are_dropped() -> None:
    assert run(quote(trade_date=TODAY + timedelta(days=1))).dropped == {"future_date": 1}


def test_dates_sixty_days_old_are_dropped_but_fifty_nine_are_kept() -> None:
    result = run(
        quote(trade_date=TODAY - timedelta(days=60)),
        quote(trade_date=TODAY - timedelta(days=59), market_id="niphad"),
    )
    assert result.dropped == {"too_old": 1}
    assert len(result.kept) == 1


def test_today_is_per_country() -> None:
    tw_row = quote(country="TW", trade_date=TODAY + timedelta(days=1))
    result = validate([tw_row], today={"IN": TODAY, "TW": TODAY + timedelta(days=1)})
    assert result.kept == [tw_row]


def test_duplicate_rows_keep_the_last_one() -> None:
    first = quote(rep_price=23.0)
    second = quote(rep_price=24.0)
    result = run(first, second)
    assert result.kept == [second]
    assert result.duplicates == 1
    assert result.dropped == {}
