"""Comparison helpers (docs/06 §4): straight-line distance, price ranks and differences."""

from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_KM = 6371
PRICE_DECIMALS = 4  # prices are stored as numeric(12,4)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """Great-circle distance between two centres, rounded to whole kilometres."""
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    h = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return round(2 * EARTH_RADIUS_KM * asin(sqrt(h)))


def competition_ranks(prices: dict[str, float | None]) -> dict[str, int | None]:
    """Highest price first; equal prices share a rank (1, 2, 2, 4); no price, no rank."""
    rounded = {k: round(v, PRICE_DECIMALS) for k, v in prices.items() if v is not None}
    ordered = sorted(rounded.values(), reverse=True)
    first_index: dict[float, int] = {}
    for i, value in enumerate(ordered):
        first_index.setdefault(value, i + 1)
    return {k: (first_index[rounded[k]] if k in rounded else None) for k in prices}


def diff(price: float | None, base: float | None) -> float | None:
    if price is None or base is None:
        return None
    return price - base


@dataclass(frozen=True)
class MarketDiff:
    market_id: str
    price: float | None
    diff: float | None


def market_rows(prices: dict[str, float | None], median: float | None) -> list[MarketDiff]:
    """Markets by price, highest first, those without data last; diff against the median."""
    rows = [MarketDiff(market_id=k, price=v, diff=diff(v, median)) for k, v in prices.items()]
    return sorted(rows, key=lambda r: (r.price is None, -(r.price or 0.0)))
