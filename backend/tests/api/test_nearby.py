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


async def test_the_highest_and_lowest_of_the_nearest_areas(api: httpx.AsyncClient) -> None:
    # Around Nashik: Ahmednagar 142 km, Pune 165 km, Jalgaon 215 km (yesterday's data, left out).
    nearby = await _nearby(api, "nashik")
    prices = await _prices(api)
    nashik, pune, ahmednagar = prices["nashik"], prices["pune"], prices["ahmednagar"]
    assert nearby == {
        "highest": {
            "area_id": "pune",
            "price_per_kg": pune,
            "diff_per_kg": pytest.approx(pune - nashik, abs=1e-4),
            "distance_km": 165,
            "is_base": False,
        },
        "lowest": {
            "area_id": "ahmednagar",
            "price_per_kg": ahmednagar,
            "diff_per_kg": pytest.approx(ahmednagar - nashik, abs=1e-4),
            "distance_km": 142,
            "is_base": False,
        },
    }


async def test_the_viewed_area_itself_can_be_the_highest(api: httpx.AsyncClient) -> None:
    # North Delhi has the highest onion price; its only area within 300 km is Agra (191 km).
    nearby = await _nearby(api, "delhi")
    assert nearby["highest"]["is_base"] is True
    assert nearby["highest"]["area_id"] == "delhi"
    assert (nearby["highest"]["diff_per_kg"], nearby["highest"]["distance_km"]) == (0, 0)
    assert nearby["lowest"]["area_id"] == "agra"
    assert nearby["lowest"]["distance_km"] == 191
    assert nearby["lowest"]["diff_per_kg"] < 0


@pytest.mark.parametrize(
    ("area", "why"),
    [
        ("bengaluru", "Kolar (61 km) is 3 days old and Kurnool is 322 km away"),
        ("kolar", "the viewed area itself is 3 days old"),
        ("kurnool", "the viewed area has no price at all"),
    ],
)
async def test_nothing_nearby_when_no_area_qualifies(
    api: httpx.AsyncClient, area: str, why: str
) -> None:
    assert await _nearby(api, area) is None, why


async def test_retail_compares_retail_prices_only(api: httpx.AsyncClient) -> None:
    # Ahmednagar has no retail reports and Jalgaon is a day old: only Pune is left.
    nearby = await _nearby(api, "nashik", price_type="retail")
    prices = await _prices(api, price_type="retail")
    assert {nearby["highest"]["area_id"], nearby["lowest"]["area_id"]} == {"nashik", "pune"}
    pune = next(r for r in nearby.values() if not r["is_base"])
    assert pune["price_per_kg"] == prices["pune"]


async def test_taiwan_counties_nearby(api: httpx.AsyncClient) -> None:
    # Around Taipei: New Taipei 11 km, Taoyuan 27 km, Yilan 38 km (3 days old, left out).
    nearby = await _nearby(api, "taipei", crop="cabbage", country="TW")
    prices = await _prices(api, crop="cabbage", country="TW")
    shown = {nearby["highest"]["area_id"], nearby["lowest"]["area_id"]}
    assert shown <= {"taipei", "newtaipei", "taoyuan"}
    compared = [prices[a] for a in ("taipei", "newtaipei", "taoyuan")]
    assert nearby["highest"]["price_per_kg"] == max(compared)
    assert nearby["lowest"]["price_per_kg"] == min(compared)


async def test_a_closed_day_compares_the_last_trading_day(sunday: httpx.AsyncClient) -> None:
    # Sunday in India: every area shows Saturday's price, which is not old.
    params = {"country": "IN", "area": "nashik", "type": "wholesale"}
    quote = (await sunday.get(QUOTE.format(crop="onion"), params=params)).json()
    assert quote["staleness"]["state"] == "closed"
    nearby = quote["nearby"]
    assert (nearby["highest"]["area_id"], nearby["lowest"]["area_id"]) == ("pune", "ahmednagar")


async def test_old_data_is_never_compared(sunday: httpx.AsyncClient) -> None:
    # Sunday is a trading day in Taiwan, so Saturday's prices are a day old there.
    assert await _nearby(sunday, "taipei", crop="cabbage", country="TW") is None


async def test_demo_stale_areas_drop_out(demo: httpx.AsyncClient) -> None:
    stale_pune = {"X-Demo-Stale": "pune:1"}
    nearby = await _nearby(demo, "nashik", headers=stale_pune)
    # Nashik is above Ahmednagar, and Pune no longer counts.
    assert (nearby["highest"]["area_id"], nearby["highest"]["is_base"]) == ("nashik", True)
    assert nearby["lowest"]["area_id"] == "ahmednagar"
    assert await _nearby(demo, "nashik", headers={"X-Demo-Stale": "nashik:3"}) is None
