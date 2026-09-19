"""Change and indicators (docs/06 §3.4). Pure functions over daily area prices.

Windows are calendar days ending today (the backend's local today, docs/06 §3.1), so the
numbers match the 7- and 30-day charts. Too few samples give None, shown as "—"."""

from dataclasses import dataclass
from datetime import date, timedelta
from itertools import pairwise
from statistics import mean
from typing import Literal

FLAT_RATIO = 0.0005  # |change| below 0.05% is flat
VOLATILITY_LOW = 0.02
VOLATILITY_MID = 0.045
ARRIVALS_LOW = 0.9
ARRIVALS_HIGH = 1.1
ARRIVALS_DAYS = 7

Direction = Literal["up", "down", "flat"]
Level = Literal["low", "mid", "high"]
ArrivalsLevel = Literal["low", "normal", "high"]


@dataclass(frozen=True)
class Point:
    """One day of an area price (per kg); volume and market count feed the arrivals ratio."""

    day: date
    price: float
    volume: float | None = None
    n_markets: int = 0


@dataclass(frozen=True)
class Change:
    pct: float
    diff: float
    direction: Direction
    prev_date: date | None


def direction_of(ratio: float) -> Direction:
    # Rounded first so float noise does not turn exactly 0.05% into "flat".
    if round(abs(ratio), 12) < FLAT_RATIO:
        return "flat"
    return "up" if ratio > 0 else "down"


def change(latest: float, prev: float | None, prev_date: date | None) -> Change | None:
    """Latest vs the previous trading day with data."""
    if prev is None or prev <= 0:
        return None
    pct = latest / prev - 1
    return Change(pct=pct, diff=latest - prev, direction=direction_of(pct), prev_date=prev_date)


def window(points: list[Point], today: date, days: int) -> list[Point]:
    """Points of the last `days` calendar days (today included), oldest first."""
    start = today - timedelta(days=days - 1)
    return sorted((p for p in points if start <= p.day <= today), key=lambda p: p.day)


def daily_series(points: list[Point], today: date, days: int) -> list[tuple[date, float | None]]:
    """One entry per calendar day; days without data are None (never filled in)."""
    by_day = {p.day: p.price for p in points}
    start = today - timedelta(days=days - 1)
    return [(d, by_day.get(d)) for d in (start + timedelta(days=i) for i in range(days))]


def range_change(points: list[Point]) -> float | None:
    """Change from the first to the last point of a window (the trend tab's pill)."""
    if len(points) < 2:
        return None
    return points[-1].price / points[0].price - 1


def vs_average(price: float, points7: list[Point]) -> float | None:
    """Price ÷ the average of the days with data in the last 7 calendar days − 1."""
    if len(points7) < 2:
        return None
    return price / mean(p.price for p in points7) - 1


def position30(price: float, points30: list[Point]) -> float | None:
    """(price − 30-day low) ÷ (30-day high − low); 0.5 when high equals low."""
    if len(points30) < 2:
        return None
    low = min(p.price for p in points30)
    high = max(p.price for p in points30)
    if high == low:
        return 0.5
    return (price - low) / (high - low)


def volatility(points7: list[Point]) -> tuple[float, Level] | None:
    """Mean absolute change between neighbouring trading days in the last 7 days."""
    if len(points7) < 2:
        return None
    value = mean(abs(b.price / a.price - 1) for a, b in pairwise(points7))
    if value < VOLATILITY_LOW:
        return value, "low"
    if value < VOLATILITY_MID:
        return value, "mid"
    return value, "high"


def _per_market(p: Point) -> float | None:
    if p.volume is None:
        return None
    return p.volume / max(p.n_markets, 1)


def arrivals(points: list[Point]) -> tuple[float, ArrivalsLevel] | None:
    """Volume on the latest day ÷ the average of the previous 7 trading days with volume.

    Volumes are taken per reporting market, so a market that misses a report does not look
    like a drop in arrivals."""
    ordered = sorted(points, key=lambda p: p.day)
    if not ordered:
        return None
    latest = _per_market(ordered[-1])
    prior = [v for v in (_per_market(p) for p in ordered[:-1]) if v is not None][-ARRIVALS_DAYS:]
    if latest is None or not prior:
        return None
    base = mean(prior)
    if base <= 0:
        return None
    ratio = latest / base
    if ratio < ARRIVALS_LOW:
        return ratio, "low"
    if ratio > ARRIVALS_HIGH:
        return ratio, "high"
    return ratio, "normal"
