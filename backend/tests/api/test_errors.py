import httpx
from fastapi import APIRouter

from app.config import Settings
from app.main import create_app


async def test_unknown_path_uses_unified_error_format(client: httpx.AsyncClient) -> None:
    res = await client.get("/api/v1/does-not-exist")
    assert res.status_code == 404
    error = res.json()["error"]
    assert error["code"] == "not_found"
    assert isinstance(error["message"], str)
    assert error["request_id"] == res.headers["X-Request-ID"]


async def test_every_response_carries_a_request_id(client: httpx.AsyncClient) -> None:
    res = await client.get("/api/v1/health")
    assert len(res.headers["X-Request-ID"]) >= 16


async def test_incoming_request_id_is_echoed(client: httpx.AsyncClient) -> None:
    res = await client.get("/api/v1/health", headers={"X-Request-ID": "abc-123"})
    assert res.headers["X-Request-ID"] == "abc-123"


async def test_malformed_request_id_is_replaced(client: httpx.AsyncClient) -> None:
    res = await client.get("/api/v1/health", headers={"X-Request-ID": "bad id <script>"})
    assert res.headers["X-Request-ID"] != "bad id <script>"


async def test_unhandled_exception_becomes_internal_error(settings: Settings) -> None:
    app = create_app(settings)
    router = APIRouter()

    @router.get("/api/v1/boom")
    async def boom() -> None:
        raise RuntimeError("kaboom")

    app.include_router(router)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        res = await c.get("/api/v1/boom")
    assert res.status_code == 500
    error = res.json()["error"]
    assert error["code"] == "internal"
    assert "kaboom" not in error["message"]
    assert error["request_id"] == res.headers["X-Request-ID"]


async def test_invalid_query_parameter_is_invalid_param(settings: Settings) -> None:
    app = create_app(settings)
    router = APIRouter()

    @router.get("/api/v1/echo")
    async def echo(n: int) -> dict[str, int]:
        return {"n": n}

    app.include_router(router)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        res = await c.get("/api/v1/echo", params={"n": "x"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "invalid_param"
