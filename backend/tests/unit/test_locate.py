from types import SimpleNamespace
from typing import Any

import pytest
from geoip2.errors import AddressNotFoundError

from app.services.locate import AreaRef, GeoPoint, MmdbLookup, client_ip, nearest_area, open_lookup

AREAS = [
    AreaRef(country="IN", area_id="nashik", lat=20.0, lon=73.79),
    AreaRef(country="IN", area_id="pune", lat=18.52, lon=73.86),
    AreaRef(country="TW", area_id="taipei", lat=25.04, lon=121.56),
]


@pytest.mark.parametrize(
    ("header", "ip"),
    [
        ("49.36.12.7", "49.36.12.7"),
        ("49.36.12.7, 10.0.0.1", "49.36.12.7"),
        ("10.0.0.1, 192.168.1.5, 49.36.12.7", "49.36.12.7"),  # private hops are skipped
        ("100.64.3.2, 1.1.1.1", "1.1.1.1"),  # carrier-grade NAT is not public
        ("127.0.0.1", None),
        (" 8.8.8.8:5353 ", "8.8.8.8"),
        ("[2001:4860:4860::8888]:443", "2001:4860:4860::8888"),
        ("2001:4860:4860::8888", "2001:4860:4860::8888"),
        ("unknown, not-an-ip", None),
        ("", None),
        (None, None),
    ],
)
def test_client_ip_is_the_leftmost_public_address(header: str | None, ip: str | None) -> None:
    assert client_ip(header) == ip


def test_nearest_area_of_the_same_country() -> None:
    near_nashik = GeoPoint(country="IN", lat=19.95, lon=73.7)
    assert nearest_area(near_nashik, AREAS) == AREAS[0]
    near_pune = GeoPoint(country="IN", lat=18.6, lon=73.9)
    assert nearest_area(near_pune, AREAS) == AREAS[1]


def test_nothing_within_three_hundred_km_is_no_guess() -> None:
    kolkata = GeoPoint(country="IN", lat=22.57, lon=88.36)
    assert nearest_area(kolkata, AREAS) is None


def test_other_countries_are_not_guessed() -> None:
    tokyo = GeoPoint(country="JP", lat=35.68, lon=139.69)
    assert nearest_area(tokyo, AREAS) is None


class StubReader:
    def __init__(self, answers: dict[str, Any]) -> None:
        self.answers = answers

    def city(self, ip: str) -> Any:
        if ip not in self.answers:
            raise AddressNotFoundError(f"{ip} not found", ip, 0)
        cc, lat, lon = self.answers[ip]
        return SimpleNamespace(
            country=SimpleNamespace(iso_code=cc),
            location=SimpleNamespace(latitude=lat, longitude=lon),
        )


def test_mmdb_lookup_reads_country_and_coordinates() -> None:
    lookup = MmdbLookup(StubReader({"49.36.12.7": ("IN", 20.01, 73.78)}))
    assert lookup.lookup("49.36.12.7") == GeoPoint(country="IN", lat=20.01, lon=73.78)
    assert lookup.lookup("8.8.8.8") is None


def test_mmdb_lookup_without_coordinates_is_no_guess() -> None:
    lookup = MmdbLookup(StubReader({"1.1.1.1": ("AU", None, None)}))
    assert lookup.lookup("1.1.1.1") is None


def test_a_missing_database_file_gives_a_lookup_that_never_guesses(tmp_path: Any) -> None:
    lookup = open_lookup(str(tmp_path / "missing.mmdb"))
    assert lookup.lookup("49.36.12.7") is None
