"""GET /intl and /intl/{series} (bonus B5) over the saved World Bank and exchange rate samples:
August 2026 is the latest month, converted with the rates of 2026-09-19."""

from collections.abc import AsyncIterator

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db.session import create_engine, create_sessionmaker
from app.ingest.intl.refresh import refresh_intl, sync_series
from app.ingest.seed import sync_seed
from app.main import create_app
from app.seed.loader import load_intl_series
from tests.conftest import NOW, _ensure_intl_data, _ensure_mock_data
from tests.intl_server import CONFIG, IntlServer, fx_payload

TWD, INR = 31.834145, 95.989567
SERIES = ["rice", "wheat", "maize", "soybeans", "sugar", "palm_oil"]


def local(usd_per_ton: float, rate: float) -> float:
    return round(usd_per_ton / 1000 * rate, 4)


async def test_the_list_shows_every_series_in_the_country_currency(api: httpx.AsyncClient) -> None:
    res = await api.get("/api/v1/intl", params={"country": "TW"})
    assert res.status_code == 200
    assert res.headers["Cache-Control"] == "public, max-age=60"
    body = res.json()
    assert (body["country"], body["currency"], body["today"]) == ("TW", "TWD", "2026-09-19")
    assert body["fx"] == {"currency": "TWD", "per_usd": TWD, "rate_date": "2026-09-19"}
    assert body["published"] == "2026-09-02"
    items = {i["id"]: i for i in body["items"]}
    assert [i["id"] for i in body["items"]] == SERIES
    rice = items["rice"]
    assert rice == {
        "id": "rice",
        "name": {"zh-TW": "稻米", "en": "Rice"},
        "spec": {"zh-TW": "泰國 5% 碎米", "en": "Thai 5% broken"},
        "source_name": "Rice, Thai 5%",
        "icon": "rice",
        "category": "cereal",
        "month": "2026-08-01",
        "usd": 471.0,
        "usd_unit": "mt",
        "price_per_kg": local(471, TWD),
        "reason": None,
        "change": {
            "pct": pytest.approx(0.008565, abs=1e-6),
            "diff_per_kg": pytest.approx(local(4, TWD), abs=1e-4),
            "direction": "up",
            "prev_month": "2026-07-01",
        },
    }
    sugar = items["sugar"]
    assert (sugar["usd"], sugar["usd_unit"]) == (0.38, "kg")
    assert sugar["price_per_kg"] == pytest.approx(0.38 * TWD, abs=1e-4)
    assert {i["month"] for i in body["items"]} == {"2026-08-01"}


async def test_another_country_gets_its_own_currency(api: httpx.AsyncClient) -> None:
    body = (await api.get("/api/v1/intl", params={"country": "in"})).json()
    assert (body["country"], body["currency"]) == ("IN", "INR")
    assert body["fx"]["per_usd"] == INR
    rice = next(i for i in body["items"] if i["id"] == "rice")
    assert rice["price_per_kg"] == local(471, INR)
    # The same month-to-month change whatever the currency.
    assert rice["change"]["pct"] == pytest.approx(0.008565, abs=1e-6)


async def test_a_series_has_its_twelve_months_and_their_range(api: httpx.AsyncClient) -> None:
    res = await api.get("/api/v1/intl/rice", params={"country": "TW"})
    assert res.status_code == 200
    body = res.json()
    assert (body["id"], body["month"], body["usd"], body["currency"]) == (
        "rice",
        "2026-08-01",
        471.0,
        "TWD",
    )
    assert body["fx"]["rate_date"] == "2026-09-19"
    months = [p["month"] for p in body["series"]]
    assert (len(months), months[0], months[-1]) == (12, "2025-09-01", "2026-08-01")
    assert body["series"][0] == {
        "month": "2025-09-01",
        "usd": 374.0,
        "price_per_kg": local(374, TWD),
    }
    assert body["stats"] == {
        "high_per_kg": local(494, TWD),
        "low_per_kg": local(356, TWD),
        "avg_per_kg": pytest.approx(416.25 / 1000 * TWD, abs=1e-3),
        "vs_avg_pct": pytest.approx(471 / 416.25 - 1, abs=1e-4),
    }


async def test_unknown_series_and_countries_are_404_and_country_is_required(
    api: httpx.AsyncClient,
) -> None:
    missing = await api.get("/api/v1/intl/coffee", params={"country": "TW"})
    assert (missing.status_code, missing.json()["error"]["code"]) == (404, "series_not_found")
    country = await api.get("/api/v1/intl", params={"country": "XX"})
    assert (country.status_code, country.json()["error"]["code"]) == (404, "country_not_found")
    bare = await api.get("/api/v1/intl")
    assert (bare.status_code, bare.json()["error"]["code"]) == (400, "invalid_param")


@pytest.fixture
async def demo(settings: Settings, database_url: str) -> AsyncIterator[httpx.AsyncClient]:
    await _ensure_mock_data(settings)
    await _ensure_intl_data(settings)
    app = create_app(settings.model_copy(update={"demo_mode": True}), clock=lambda: NOW)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await app.state.engine.dispose()


async def test_the_demo_failure_switch_fails_these_prices_too(demo: httpx.AsyncClient) -> None:
    res = await demo.get("/api/v1/intl", params={"country": "TW"}, headers={"X-Demo-Fail": "1"})
    assert (res.status_code, res.json()["error"]["code"]) == (503, "demo_failure")
    fine = await demo.get("/api/v1/intl/rice", params={"country": "TW"})
    assert fine.status_code == 200


async def _fresh(settings: Settings, session: AsyncSession, fx: dict[str, object] | None) -> None:
    """A new database: the seeds, and the samples only if `fx` (the rate answer) is given."""
    await sync_seed(session)
    seeds = load_intl_series().series
    await sync_series(session, seeds)
    if fx is None:
        return
    engine = create_engine(settings)
    try:
        server = IntlServer(fx=fx)
        await refresh_intl(
            create_sessionmaker(engine), seeds, CONFIG, lambda: NOW, transport=server.transport()
        )
    finally:
        await engine.dispose()


async def test_before_the_first_download_every_series_says_no_data(
    settings: Settings, session: AsyncSession, client: httpx.AsyncClient
) -> None:
    await _fresh(settings, session, fx=None)
    body = (await client.get("/api/v1/intl", params={"country": "TW"})).json()
    assert (body["fx"], body["published"]) == (None, None)
    assert [(i["id"], i["price_per_kg"], i["reason"]) for i in body["items"]] == [
        (s, None, "no_data") for s in SERIES
    ]
    detail = (await client.get("/api/v1/intl/rice", params={"country": "TW"})).json()
    assert (detail["series"], detail["month"], detail["reason"]) == ([], None, "no_data")


async def test_a_currency_without_a_rate_keeps_the_dollar_price(
    settings: Settings, session: AsyncSession, client: httpx.AsyncClient
) -> None:
    rates = fx_payload()["rates"]
    await _fresh(
        settings, session, fx=fx_payload(rates={k: v for k, v in rates.items() if k != "TWD"})
    )
    body = (await client.get("/api/v1/intl", params={"country": "TW"})).json()
    assert body["fx"] is None
    rice = body["items"][0]
    assert (rice["price_per_kg"], rice["reason"], rice["usd"]) == (None, "no_fx", 471.0)
    assert rice["change"]["diff_per_kg"] is None
    india = (await client.get("/api/v1/intl", params={"country": "IN"})).json()
    assert india["items"][0]["price_per_kg"] == local(471, INR)
