from collections.abc import AsyncIterator
from datetime import date, timedelta

import httpx
import pytest

from app.config import Settings
from app.main import create_app
from app.services.locate import GeoPoint
from tests.conftest import NOW, _ensure_mock_data

TODAY = date(2026, 9, 19)


ANSWERS = {
    "49.36.12.7": GeoPoint(country="IN", lat=20.01, lon=73.78),
    "1.1.1.1": GeoPoint(country="TW", lat=25.04, lon=121.55),
}


class FakeLookup:
    def lookup(self, ip: str) -> GeoPoint | None:
        return ANSWERS.get(ip)


async def _client(settings: Settings, demo: bool) -> AsyncIterator[httpx.AsyncClient]:
    await _ensure_mock_data(settings)
    app = create_app(settings.model_copy(update={"demo_mode": demo}), clock=lambda: NOW)
    app.state.geo = FakeLookup()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await app.state.engine.dispose()


@pytest.fixture
async def normal(settings: Settings, database_url: str) -> AsyncIterator[httpx.AsyncClient]:
    async for c in _client(settings, demo=False):
        yield c


@pytest.fixture
async def demo(settings: Settings, database_url: str) -> AsyncIterator[httpx.AsyncClient]:
    async for c in _client(settings, demo=True):
        yield c


async def test_locate_guesses_the_nearest_area(normal: httpx.AsyncClient) -> None:
    res = await normal.get(
        "/api/v1/locate", headers={"X-Client-Forwarded-For": "10.1.1.1, 49.36.12.7"}
    )
    assert res.status_code == 200
    assert res.json() == {"country": "IN", "area_id": "nashik"}
    assert res.headers["Cache-Control"] == "private, no-store"


@pytest.mark.parametrize("header", [None, "192.168.0.9", "8.8.4.4"])
async def test_locate_without_a_usable_address_guesses_nothing(
    normal: httpx.AsyncClient, header: str | None
) -> None:
    headers = {"X-Client-Forwarded-For": header} if header else {}
    res = await normal.get("/api/v1/locate", headers=headers)
    assert res.json() == {"country": None, "area_id": None}


async def test_demo_headers_are_ignored_outside_demo_mode(normal: httpx.AsyncClient) -> None:
    res = await normal.get("/api/v1/locate", headers={"X-Demo-Locate": "TW:taipei"})
    assert res.json() == {"country": None, "area_id": None}
    res = await normal.get("/api/v1/locate", headers={"X-Demo-IP": "1.1.1.1"})
    assert res.json() == {"country": None, "area_id": None}
    params = {"country": "IN", "area": "nashik", "type": "wholesale"}
    res = await normal.get("/api/v1/prices", params=params, headers={"X-Demo-Fail": "1"})
    assert res.status_code == 200
    q = await normal.get(
        "/api/v1/crops/onion/quote", params=params, headers={"X-Demo-Stale": "nashik:3"}
    )
    assert q.json()["trade_date"] == TODAY.isoformat()


async def test_demo_locate_sets_the_answer(demo: httpx.AsyncClient) -> None:
    res = await demo.get("/api/v1/locate", headers={"X-Demo-Locate": "TW:taipei"})
    assert res.json() == {"country": "TW", "area_id": "taipei"}
    res = await demo.get(
        "/api/v1/locate",
        headers={"X-Demo-Locate": "none", "X-Client-Forwarded-For": "49.36.12.7"},
    )
    assert res.json() == {"country": None, "area_id": None}


async def test_demo_ip_replaces_the_forwarded_address(demo: httpx.AsyncClient) -> None:
    res = await demo.get(
        "/api/v1/locate",
        headers={"X-Demo-IP": "1.1.1.1", "X-Client-Forwarded-For": "49.36.12.7"},
    )
    assert res.json() == {"country": "TW", "area_id": "taipei"}


async def test_demo_failure_breaks_price_endpoints_only(demo: httpx.AsyncClient) -> None:
    fail = {"X-Demo-Fail": "1"}
    params = {"country": "IN", "area": "nashik", "type": "wholesale"}
    for path in ("/api/v1/prices", "/api/v1/crops/onion/quote", "/api/v1/crops/onion/compare"):
        res = await demo.get(path, params=params, headers=fail)
        assert res.status_code == 503
        assert res.json()["error"]["code"] == "demo_failure"
    assert (await demo.get("/api/v1/countries", headers=fail)).status_code == 200


async def test_demo_stale_pushes_the_latest_trade_date_back(demo: httpx.AsyncClient) -> None:
    stale = {"X-Demo-Stale": "nashik:3"}
    params = {"country": "IN", "area": "nashik", "type": "wholesale"}
    q = (await demo.get("/api/v1/crops/onion/quote", params=params, headers=stale)).json()
    assert q["trade_date"] == (TODAY - timedelta(days=3)).isoformat()
    assert q["staleness"] == {"days": 3, "state": "stale"}
    areas = (await demo.get("/api/v1/countries/IN/areas", headers=stale)).json()["areas"]
    nashik = next(a for a in areas if a["id"] == "nashik")
    assert nashik["staleness"] == {"days": 3, "state": "stale"}
    other = (await demo.get("/api/v1/crops/onion/quote", params=params)).json()
    assert other["trade_date"] == TODAY.isoformat()


async def test_malformed_demo_stale_is_ignored(demo: httpx.AsyncClient) -> None:
    params = {"country": "IN", "area": "nashik", "type": "wholesale"}
    for value in ("nashik", "nashik:x", ":3", "nashik:-2"):
        q = await demo.get(
            "/api/v1/crops/onion/quote", params=params, headers={"X-Demo-Stale": value}
        )
        assert q.json()["trade_date"] == TODAY.isoformat()
