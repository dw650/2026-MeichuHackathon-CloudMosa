"""`nearby` on the quote: the highest and lowest price around the viewed area (docs/02 §5.4)."""

from collections.abc import AsyncIterator
from datetime import datetime, timedelta
from typing import Any

import httpx
import pytest

from app.config import Settings
from app.main import create_app
from tests.conftest import NOW, _ensure_mock_data

QUOTE = "/api/v1/crops/{crop}/quote"
COMPARE = "/api/v1/crops/{crop}/compare"


async def _client(
    settings: Settings, now: datetime, demo: bool
) -> AsyncIterator[httpx.AsyncClient]:
    await _ensure_mock_data(settings)
    app = create_app(settings.model_copy(update={"demo_mode": demo}), clock=lambda: now)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await app.state.engine.dispose()


@pytest.fixture
async def demo(settings: Settings, database_url: str) -> AsyncIterator[httpx.AsyncClient]:
    async for c in _client(settings, NOW, demo=True):
        yield c


@pytest.fixture
async def sunday(settings: Settings, database_url: str) -> AsyncIterator[httpx.AsyncClient]:
    """The day after the mock data: a closed day in India, an ordinary one in Taiwan."""
    async for c in _client(settings, NOW + timedelta(days=1), demo=False):
        yield c


async def _nearby(
    client: httpx.AsyncClient,
    area: str,
    crop: str = "onion",
    country: str = "IN",
    price_type: str = "wholesale",
    headers: dict[str, str] | None = None,
) -> Any:
    params = {"country": country, "area": area, "type": price_type}
    res = await client.get(QUOTE.format(crop=crop), params=params, headers=headers)
    assert res.status_code == 200
    return res.json()["nearby"]


async def _prices(
    client: httpx.AsyncClient,
    crop: str = "onion",
    country: str = "IN",
    price_type: str = "wholesale",
) -> dict[str, float]:
    """Latest price of every area that has one, from the compare endpoint."""
    base = {"IN": "nashik", "TW": "taipei"}[country]
    params = {"country": country, "area": base, "type": price_type}
    rows = (await client.get(COMPARE.format(crop=crop), params=params)).json()["rows"]
    return {r["area_id"]: r["price_per_kg"] for r in rows if r["price_per_kg"] is not None}


async def test_the_highest_and_lowest_within_100_km(api: httpx.AsyncClient) -> None:
    # Around Taipei: New Taipei 11 km, Taoyuan 27 km, Yilan 38 km (3 days old, left out).
    nearby = await _nearby(api, "taipei", crop="cabbage", country="TW")
    prices = await _prices(api, crop="cabbage", country="TW")
    pool = {a: prices[a] for a in ("taipei", "newtaipei", "taoyuan")}
    high = max(pool, key=lambda a: pool[a])
    low = min(pool, key=lambda a: pool[a])
    assert (nearby["highest"]["area_id"], nearby["lowest"]["area_id"]) == (high, low)
    for row in nearby.values():
        diff = pool[row["area_id"]] - pool["taipei"]
        assert row["diff_per_kg"] == pytest.approx(diff, abs=1e-4)
        assert row["is_base"] is (row["area_id"] == "taipei")


async def test_the_viewed_area_itself_can_be_the_highest_or_lowest(
    api: httpx.AsyncClient,
) -> None:
    nearby = await _nearby(api, "taipei", crop="cabbage", country="TW")
    base = next(row for row in nearby.values() if row["is_base"])
    assert (base["area_id"], base["diff_per_kg"], base["distance_km"]) == ("taipei", 0, 0)


@pytest.mark.parametrize(
    ("area", "why"),
    [
        ("nashik", "no other area within 100 km"),
        ("bengaluru", "Kolar (61 km) is 3 days old"),
        ("kolar", "the viewed area itself is 3 days old"),
        ("kurnool", "the viewed area has no price at all"),
    ],
)
async def test_nothing_nearby_when_no_area_qualifies(
    api: httpx.AsyncClient, area: str, why: str
) -> None:
    assert await _nearby(api, area) is None, why


async def test_retail_compares_retail_prices_only(api: httpx.AsyncClient) -> None:
    nearby = await _nearby(api, "taipei", crop="cabbage", country="TW", price_type="retail")
    prices = await _prices(api, crop="cabbage", country="TW", price_type="retail")
    shown = {nearby["highest"]["area_id"], nearby["lowest"]["area_id"]}
    assert shown <= {"taipei", "newtaipei", "taoyuan"}
    compared = [prices[a] for a in ("taipei", "newtaipei", "taoyuan")]
    assert nearby["highest"]["price_per_kg"] == max(compared)
    assert nearby["lowest"]["price_per_kg"] == min(compared)


async def test_old_data_is_never_compared(sunday: httpx.AsyncClient) -> None:
    # Sunday is a trading day in Taiwan, so Saturday's prices are a day old there.
    assert await _nearby(sunday, "taipei", crop="cabbage", country="TW") is None


async def test_demo_stale_areas_drop_out(demo: httpx.AsyncClient) -> None:
    fresh = await _nearby(demo, "taipei", crop="cabbage", country="TW")
    stale_new_taipei = {"X-Demo-Stale": "newtaipei:1"}
    nearby = await _nearby(demo, "taipei", crop="cabbage", country="TW", headers=stale_new_taipei)
    shown = {nearby["highest"]["area_id"], nearby["lowest"]["area_id"]}
    assert "newtaipei" not in shown
    assert shown <= {"taipei", "taoyuan"}
    assert fresh is not None
    stale_taipei = {"X-Demo-Stale": "taipei:3"}
    assert await _nearby(demo, "taipei", crop="cabbage", country="TW", headers=stale_taipei) is None
