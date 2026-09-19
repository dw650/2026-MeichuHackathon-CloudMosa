import httpx

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
