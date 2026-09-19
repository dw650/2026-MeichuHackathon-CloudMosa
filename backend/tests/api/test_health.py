import httpx
import pytest

from app.config import Settings
from app.main import create_app


async def test_health_reports_ok_when_database_is_reachable(client: httpx.AsyncClient) -> None:
    res = await client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"


async def test_health_returns_503_when_database_is_down() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://nobody:nothing@127.0.0.1:1/none", db_null_pool=True
    )
    app = create_app(settings)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        res = await c.get("/api/v1/health")
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "db_unavailable"


async def test_health_reports_the_running_version() -> None:
    # The deploy passes the commit (APP_VERSION); the About page shows it (docs/07 §5.2).
    app = create_app(Settings(app_version="f40c282"))
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        res = await c.get("/api/v1/health")
    assert res.json()["version"] == "f40c282"


def test_the_version_defaults_to_dev(monkeypatch: pytest.MonkeyPatch) -> None:
    # `make` exports the current commit as APP_VERSION; without it the version is "dev".
    monkeypatch.delenv("APP_VERSION", raising=False)
    assert Settings().app_version == "dev"
