import httpx

from app.config import Settings
from app.main import create_app


async def _get(settings: Settings, headers: dict[str, str]) -> httpx.Response:
    app = create_app(settings)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        return await c.get("/api/v1/debug/headers", headers=headers)


async def test_debug_headers_does_not_exist_outside_demo_mode(settings: Settings) -> None:
    res = await _get(settings, {"X-Forwarded-For": "203.0.113.5"})
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"


async def test_debug_headers_echoes_forwarding_headers_in_demo_mode(settings: Settings) -> None:
    demo = settings.model_copy(update={"demo_mode": True})
    res = await _get(
        demo,
        {"X-Forwarded-For": "203.0.113.5, 10.0.0.1", "X-Client-Forwarded-For": "203.0.113.5"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["x_forwarded_for"] == "203.0.113.5, 10.0.0.1"
    assert body["x_client_forwarded_for"] == "203.0.113.5"


async def test_debug_headers_is_not_in_the_public_openapi(settings: Settings) -> None:
    assert "/api/v1/debug/headers" not in create_app(settings).openapi()["paths"]
