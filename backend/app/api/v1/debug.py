"""Diagnostics for Phase 2 (docs/08 §12). Mounted only when DEMO_MODE=true."""

from fastapi import APIRouter, Request

from app.schemas.debug import DebugHeadersOut

router = APIRouter(tags=["debug"])


@router.get(
    "/debug/headers",
    summary="Echo the forwarding headers the API received",
    response_model=DebugHeadersOut,
)
async def headers(request: Request) -> DebugHeadersOut:
    h = request.headers
    return DebugHeadersOut(
        x_forwarded_for=h.get("x-forwarded-for"),
        x_client_forwarded_for=h.get("x-client-forwarded-for"),
        forwarded=h.get("forwarded"),
        client_host=request.client.host if request.client else None,
    )
