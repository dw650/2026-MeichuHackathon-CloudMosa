from datetime import date, timedelta

from app.services.freshness import Staleness, staleness

SAT = date(2026, 9, 19)
SUN = date(2026, 9, 20)
MON = date(2026, 9, 21)
INDIA_CLOSED = [7]  # Sunday
TAIWAN_CLOSED = [1]  # Monday


def test_latest_today_is_today() -> None:
    assert staleness(SAT, SAT, INDIA_CLOSED) == Staleness(days=0, state="today")


def test_only_closed_days_in_between_is_closed_not_stale() -> None:
    assert staleness(SAT, SUN, INDIA_CLOSED) == Staleness(days=1, state="closed")


def test_a_trading_day_in_between_is_stale() -> None:
    assert staleness(SAT, MON, INDIA_CLOSED) == Staleness(days=2, state="stale")
    assert staleness(SAT - timedelta(days=3), SAT, TAIWAN_CLOSED) == Staleness(3, "stale")


def test_yesterday_is_stale_with_one_day() -> None:
    assert staleness(SAT - timedelta(days=1), SAT, TAIWAN_CLOSED) == Staleness(1, "stale")


def test_no_data_or_older_than_thirty_days_is_none() -> None:
    assert staleness(None, SAT, INDIA_CLOSED) == Staleness(days=None, state="none")
    assert staleness(SAT - timedelta(days=30), SAT, INDIA_CLOSED) == Staleness(None, "none")
    assert staleness(SAT - timedelta(days=29), SAT, INDIA_CLOSED).state == "stale"


def test_a_future_date_counts_as_today() -> None:
    assert staleness(SUN, SAT, INDIA_CLOSED) == Staleness(days=0, state="today")
