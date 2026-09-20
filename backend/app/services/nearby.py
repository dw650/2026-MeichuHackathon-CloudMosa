"""Nearby prices (docs/02 §5.4): the highest and lowest price around the area being viewed.

Nearby areas are every other area of the country within NEARBY_MAX_KM of the viewed area in a
straight line: about two to three hours by truck, the same distance in every country. The
caller keeps only those whose latest trade date is the viewed area's, so every price compared
is from the same day."""

from collections.abc import Sequence
from dataclasses import dataclass

from app.services.compare import PRICE_DECIMALS, haversine_km

NEARBY_MAX_KM = 150


@dataclass(frozen=True)
class Place:
    area_id: str
    lat: float
    lon: float


def nearest(
    base: Place,
    others: Sequence[Place],
    max_km: int = NEARBY_MAX_KM,
) -> list[tuple[str, int]]:
    """(area id, km) of every other area within `max_km`, nearest first.

    Equal distances keep the order of `others` (the catalog order)."""
    found = [
        (km, i, place.area_id)
        for i, place in enumerate(others)
        if place.area_id != base.area_id
        and (km := haversine_km(base.lat, base.lon, place.lat, place.lon)) <= max_km
    ]
    return [(area_id, km) for km, _, area_id in sorted(found)]


@dataclass(frozen=True)
class Candidate:
    area_id: str
    price: float
    distance_km: int


@dataclass(frozen=True)
class Extreme:
    area_id: str
    price: float
    diff: float  # this area minus the viewed area
    distance_km: int
    is_base: bool


@dataclass(frozen=True)
class Nearby:
    highest: Extreme
    lowest: Extreme


def extremes(base_id: str, base_price: float, neighbours: Sequence[Candidate]) -> Nearby | None:
    """Highest and lowest price among the viewed area and its neighbours.

    A tie goes to the viewed area (nobody nearby pays more, or less), then to the nearer
    neighbour. None when there is no neighbour or every neighbour has the viewed area's price:
    then there is nothing higher or lower to point to."""
    base = Candidate(base_id, base_price, 0)
    # max() and min() keep the first of equal values: the viewed area, then the nearest.
    pool = [base, *sorted(neighbours, key=lambda c: c.distance_km)]

    def level(c: Candidate) -> float:
        return round(c.price, PRICE_DECIMALS)

    highest, lowest = max(pool, key=level), min(pool, key=level)
    if highest is base and lowest is base:
        return None

    def out(c: Candidate) -> Extreme:
        is_base = c is base
        diff = 0.0 if is_base else c.price - base_price
        return Extreme(c.area_id, c.price, diff, c.distance_km, is_base)

    return Nearby(highest=out(highest), lowest=out(lowest))
