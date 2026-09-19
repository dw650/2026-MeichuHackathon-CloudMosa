"""Straight-line distances (docs/06 §4), shared by the API and the seed sync."""

from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_KM = 6371


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """Great-circle distance between two points, rounded to whole kilometres."""
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    h = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    return round(2 * EARTH_RADIUS_KM * asin(sqrt(h)))
