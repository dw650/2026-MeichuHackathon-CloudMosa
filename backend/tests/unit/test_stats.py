from datetime import date, timedelta

import pytest

from app.services.stats import (
    Point,
    arrivals,
    change,
    daily_series,
    position30,
    range_change,
    volatility,
    vs_average,
    window,
)

TODAY = date(2026, 9, 19)


def days_ago(n: int) -> date:
    return TODAY - timedelta(days=n)


def pts(*prices: float | None, volume: float | None = None) -> list[Point]:
    """Points for consecutive days ending today; None leaves a day out."""
    n = len(prices)
    return [
        Point(day=days_ago(n - 1 - i), price=p, volume=volume, n_markets=1)
        for i, p in enumerate(prices)
        if p is not None
    ]


class TestChange:
    def test_up_and_down_with_the_difference(self) -> None:
        up = change(104.2, 100.0, days_ago(1))
        assert up is not None
        assert (up.direction, up.pct, up.diff) == ("up", pytest.approx(0.042), pytest.approx(4.2))
        down = change(88.0, 100.0, days_ago(1))
        assert down is not None
        assert (down.direction, down.pct) == ("down", pytest.approx(-0.12))

    def test_below_half_a_basis_point_is_flat(self) -> None:
        flat = change(100.04, 100.0, days_ago(1))
        assert flat is not None
        assert flat.direction == "flat"
        assert change(100.05, 100.0, days_ago(1)).direction == "up"  # type: ignore[union-attr]

    def test_no_previous_day_means_no_change(self) -> None:
        assert change(100.0, None, None) is None


class TestWindowsAndSeries:
    def test_window_keeps_the_last_n_calendar_days(self) -> None:
        points = pts(1, 2, 3, 4, 5, 6, 7, 8, 9)
        assert [p.price for p in window(points, TODAY, 7)] == [3, 4, 5, 6, 7, 8, 9]

    def test_series_has_one_entry_per_day_and_null_for_missing_days(self) -> None:
        series = daily_series(pts(10, None, 12), TODAY, 7)
        assert [d for d, _ in series] == [days_ago(i) for i in range(6, -1, -1)]
        assert [v for _, v in series] == [None, None, None, None, 10, None, 12]

    def test_range_change_uses_the_first_and_last_points(self) -> None:
        assert range_change(pts(10, None, 12)) == pytest.approx(0.2)
        assert range_change(pts(10)) is None


class TestIndicators:
    def test_vs_seven_day_average(self) -> None:
        assert vs_average(12.0, pts(9, 10, 11, 12)) == pytest.approx(12 / 10.5 - 1)

    def test_vs_average_needs_two_days(self) -> None:
        assert vs_average(12.0, pts(12)) is None

    def test_position_in_thirty_day_range(self) -> None:
        assert position30(15.0, pts(10, 20, 15)) == pytest.approx(0.5)
        assert position30(20.0, pts(10, 20)) == pytest.approx(1.0)

    def test_position_is_half_when_high_equals_low(self) -> None:
        assert position30(10.0, pts(10, 10, 10)) == 0.5

    def test_position_needs_two_days(self) -> None:
        assert position30(10.0, pts(10)) is None

    @pytest.mark.parametrize(
        ("prices", "level"),
        [((100, 101, 100, 101), "low"), ((100, 103, 100, 103), "mid"), ((100, 110, 100), "high")],
    )
    def test_volatility_levels(self, prices: tuple[float, ...], level: str) -> None:
        result = volatility(pts(*prices))
        assert result is not None
        assert result[1] == level

    def test_volatility_needs_two_days(self) -> None:
        assert volatility(pts(100)) is None

    def test_arrivals_compare_the_latest_with_the_previous_seven_trading_days(self) -> None:
        points = [Point(day=days_ago(i), price=10, volume=100, n_markets=1) for i in range(1, 9)]
        points.append(Point(day=TODAY, price=10, volume=118, n_markets=1))
        result = arrivals(points)
        assert result is not None
        assert result[0] == pytest.approx(1.18)
        assert result[1] == "high"

    def test_arrivals_are_per_reporting_market(self) -> None:
        points = [Point(day=days_ago(1), price=10, volume=1000, n_markets=10)]
        points.append(Point(day=TODAY, price=10, volume=560, n_markets=7))
        result = arrivals(points)
        assert result is not None
        assert result[0] == pytest.approx(0.8)
        assert result[1] == "low"

    def test_arrivals_without_volume_are_empty(self) -> None:
        assert arrivals(pts(10, 11)) is None
        assert arrivals([Point(day=TODAY, price=10, volume=5, n_markets=1)]) is None

    def test_arrivals_normal_band(self) -> None:
        points = [Point(day=days_ago(1), price=10, volume=100, n_markets=1)]
        points.append(Point(day=TODAY, price=10, volume=105, n_markets=1))
        assert arrivals(points) == (pytest.approx(1.05), "normal")
