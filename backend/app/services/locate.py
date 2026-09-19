"""Location guess (F17, docs/06 §6): client IP → IP geolocation → nearest area centre.

The IP is only used for this guess (the user always confirms it); it is not stored or
logged. A missing database file means "no guess" and the service keeps running."""

import ipaddress
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from geoip2.errors import AddressNotFoundError
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import catalog as repo
from app.services.compare import haversine_km
from app.services.demo import LOCATE_NONE, Demo

logger = logging.getLogger("app.locate")
MAX_DISTANCE_KM = 300


@dataclass(frozen=True)
class GeoPoint:
    country: str
    lat: float
    lon: float


@dataclass(frozen=True)
class AreaRef:
    country: str
    area_id: str
    lat: float
    lon: float


class GeoLookup(Protocol):
    def lookup(self, ip: str) -> GeoPoint | None: ...


class NullLookup:
    """Used when no IP database is installed: never guesses."""

    def lookup(self, ip: str) -> GeoPoint | None:
        return None


class MmdbLookup:
    """City-level lookup in a MaxMind-format database (DB-IP Lite City or GeoLite2 City)."""

    def __init__(self, reader: Any) -> None:
        self._reader = reader

    def lookup(self, ip: str) -> GeoPoint | None:
        try:
            city = self._reader.city(ip)
        except (AddressNotFoundError, ValueError):
            return None
        cc, lat, lon = city.country.iso_code, city.location.latitude, city.location.longitude
        if cc is None or lat is None or lon is None:
            return None
        return GeoPoint(country=cc, lat=lat, lon=lon)


def open_lookup(path: str) -> GeoLookup:
    if not Path(path).is_file():
        logger.info("no IP database at %s; location guesses are disabled", path)
        return NullLookup()
    import geoip2.database

    return MmdbLookup(geoip2.database.Reader(path))


def _parse_ip(token: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    token = token.strip()
    if token.startswith("["):  # [IPv6]:port
        token = token[1 : token.find("]")] if "]" in token else token[1:]
    elif token.count(":") == 1:  # IPv4:port
        token = token.split(":", 1)[0]
    try:
        return ipaddress.ip_address(token)
    except ValueError:
        return None


def client_ip(header: str | None) -> str | None:
    """The leftmost public address in X-Client-Forwarded-For (private hops are skipped)."""
    for token in (header or "").split(","):
        ip = _parse_ip(token)
        if ip is not None and ip.is_global:
            return str(ip)
    return None


def nearest_area(point: GeoPoint, areas: list[AreaRef]) -> AreaRef | None:
    """The closest area centre in the same country, if within 300 km."""
    candidates = [a for a in areas if a.country == point.country]
    if not candidates:
        return None
    best = min(candidates, key=lambda a: haversine_km(point.lat, point.lon, a.lat, a.lon))
    if haversine_km(point.lat, point.lon, best.lat, best.lon) > MAX_DISTANCE_KM:
        return None
    return best


async def locate(
    session: AsyncSession, forwarded_for: str | None, lookup: GeoLookup, demo: Demo
) -> dict[str, str | None]:
    none: dict[str, str | None] = {"country": None, "area_id": None}
    areas = [
        AreaRef(country=a.country, area_id=a.id, lat=a.lat, lon=a.lon)
        for a in await repo.get_all_areas(session)
    ]
    if demo.locate == LOCATE_NONE:
        return none
    if isinstance(demo.locate, tuple):
        cc, area_id = demo.locate
        known = any(a.country == cc and a.area_id == area_id for a in areas)
        return {"country": cc, "area_id": area_id} if known else none
    ip = demo.ip or client_ip(forwarded_for)
    point = lookup.lookup(ip) if ip else None
    area = nearest_area(point, areas) if point else None
    return {"country": area.country, "area_id": area.area_id} if area else none
