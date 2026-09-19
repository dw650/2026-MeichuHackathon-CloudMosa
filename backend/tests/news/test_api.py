"""GET /api/v1/news and /api/v1/news/{id}."""

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.main import create_app
from app.repositories import news as repo

NOW = datetime(2026, 9, 19, 16, 30, tzinfo=UTC)  # 00:30 on 9/20 in Taiwan


def row(n: int, hours_ago: float, areas: list[str], **extra: Any) -> dict[str, Any]:
    return {
        "country": "TW",
        "source": "google",
        "guid": f"g{n}",
        "title": f"菜價新聞 {n}",
        "title_key": f"菜價新聞{n}",
        "lang": "zh-TW",
        "source_name": "公視新聞網PNN",
        "source_domain": "news.pts.org.tw",
        "url": f"https://news.pts.org.tw/article/{n}",
        "published_at": NOW - timedelta(hours=hours_ago),
        "crop_ids": ["cabbage"],
        "area_ids": areas,
        "fetched_at": NOW,
    } | extra


@pytest.fixture
async def api(settings: Settings, seeded: AsyncSession) -> AsyncIterator[httpx.AsyncClient]:
    rows = [row(n, hours_ago=n, areas=[]) for n in (1, 3, 4, 5, 6, 7, 8, 9)]
    rows += [
        row(
            2,
            2,
            ["yunlin", "taichung"],
            summary="台中菜價上漲三成。預計兩週內回穩。",
            summary_lang="zh-TW",
        ),
        row(10, 30, ["taichung"]),  # mentions the area but is not one of the nine newest
        row(11, 60, ["yunlin"]),
        row(12, 24 * 8, ["taichung"]),  # older than a week: never listed
    ]
    await repo.insert_items(seeded, rows)
    run_id = await repo.start_run(seeded, "TW", "google", NOW - timedelta(minutes=5))
    await repo.finish_run(seeded, run_id, status="ok", finished_at=NOW - timedelta(minutes=2))
    await seeded.commit()
    app = create_app(settings, clock=lambda: NOW)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
        yield client
    await app.state.engine.dispose()


async def test_the_newest_come_first(api: httpx.AsyncClient) -> None:
    res = await api.get("/news", params={"country": "TW", "area": "taichung"})
    assert res.status_code == 200
    assert res.headers["cache-control"] == "public, max-age=60"
    body = res.json()
    assert (body["country"], body["area_id"], body["today"]) == ("TW", "taichung", "2026-09-20")
    assert body["fetched_at"] == "2026-09-20T00:28:00+08:00"
    titles = [i["title"] for i in body["items"]]
    assert titles == [f"菜價新聞 {n}" for n in range(1, 10)]
    assert "菜價新聞 10" not in titles  # mentioning the area no longer floats an item up


async def test_the_area_does_not_change_the_order(api: httpx.AsyncClient) -> None:
    mine = (await api.get("/news", params={"country": "TW", "area": "taichung"})).json()
    other = (await api.get("/news", params={"country": "TW", "area": "taipei"})).json()
    assert [i["id"] for i in mine["items"]] == [i["id"] for i in other["items"]]


async def test_item_fields(api: httpx.AsyncClient) -> None:
    body = (await api.get("/news", params={"country": "TW", "area": "taichung"})).json()
    first, second = body["items"][:2]
    assert first["summary"] is None
    assert first["summary_lang"] is None
    assert first["published_at"] == "2026-09-19T23:30:00+08:00"
    assert (first["published_date"], first["days_ago"]) == ("2026-09-19", 1)
    assert first["crop_ids"] == ["cabbage"]
    assert second["summary"] == "台中菜價上漲三成。預計兩週內回穩。"
    assert second["summary_lang"] == "zh-TW"
    assert second["source"] == {"name": "公視新聞網PNN", "domain": "news.pts.org.tw"}
    assert second["area_ids"] == ["yunlin", "taichung"]  # the areas it mentions stay visible


async def test_one_item(api: httpx.AsyncClient) -> None:
    listed = (await api.get("/news", params={"country": "TW", "area": "taichung"})).json()
    news_id = listed["items"][0]["id"]
    res = await api.get(f"/news/{news_id}")
    assert res.status_code == 200
    body = res.json()
    assert body == listed["items"][0] | {"country": "TW", "today": "2026-09-20"}


async def test_missing_and_old_items_are_not_found(
    api: httpx.AsyncClient, seeded: AsyncSession
) -> None:
    res = await api.get("/news/999999")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "news_not_found"
    old = await seeded.execute(text("SELECT id FROM news_items WHERE guid = 'g12'"))
    res = await api.get(f"/news/{old.scalar_one()}")
    assert res.status_code == 404


async def test_errors(api: httpx.AsyncClient) -> None:
    unknown_area = await api.get("/news", params={"country": "TW", "area": "nashik"})
    assert unknown_area.status_code == 404
    assert unknown_area.json()["error"]["code"] == "area_not_found"
    unknown_country = await api.get("/news", params={"country": "XX", "area": "taipei"})
    assert unknown_country.json()["error"]["code"] == "country_not_found"
    missing = await api.get("/news", params={"country": "TW"})
    assert missing.status_code == 400
    assert missing.json()["error"]["code"] == "invalid_param"
    bad_id = await api.get("/news/abc")
    assert bad_id.status_code == 400


async def test_no_run_yet_means_no_fetch_time(settings: Settings, seeded: AsyncSession) -> None:
    app = create_app(settings, clock=lambda: NOW)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
        body = (await client.get("/news", params={"country": "IN", "area": "nashik"})).json()
    await app.state.engine.dispose()
    assert body["fetched_at"] is None
    assert body["items"] == []
