"""FastAPI dependencies shared by routers."""

from collections.abc import AsyncIterator, Callable
from datetime import datetime
from typing import Annotated

from fastapi import Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.errors import ApiError
from app.services.demo import LOCATE_NONE, NO_DEMO, Demo


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.sessionmaker() as session:
        yield session


def get_app_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


SessionDep = Annotated[AsyncSession, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_app_settings)]


def get_now(request: Request) -> datetime:
    clock: Callable[[], datetime] = request.app.state.clock
    return clock()


def public_cache(response: Response, settings: SettingsDep) -> None:
    """Successful GETs may be cached for a minute (docs/04 §6)."""
    response.headers["Cache-Control"] = "public, max-age=60"
    if settings.demo_mode:
        # Demo headers change the answer, so caches must keep them apart.
        response.headers["Vary"] = "X-Demo-Fail, X-Demo-Stale"


NowDep = Annotated[datetime, Depends(get_now)]


def _stale_days(value: str) -> dict[str, int]:
    """`nashik:3` or `nashik:3,pune:1`; malformed entries are ignored."""
    out: dict[str, int] = {}
    for part in value.split(","):
        area, _, days = part.strip().partition(":")
        if area and days.isdigit() and 0 < int(days) <= 60:
            out[area] = int(days)
    return out


def _locate(value: str) -> tuple[str, str] | str | None:
    value = value.strip()
    if value.lower() == LOCATE_NONE:
        return LOCATE_NONE
    cc, _, area = value.partition(":")
    return (cc.upper(), area) if cc and area else None


def get_demo(request: Request, settings: SettingsDep) -> Demo:
    """Demo switches from request headers (docs/04 §6.2); ignored unless DEMO_MODE=true."""
    if not settings.demo_mode:
        return NO_DEMO
    h = request.headers
    return Demo(
        fail=h.get("x-demo-fail", "").strip().lower() in {"1", "true", "yes"},
        stale_days=_stale_days(h.get("x-demo-stale", "")),
        ip=h.get("x-demo-ip", "").strip() or None,
        locate=_locate(h.get("x-demo-locate", "")),
    )


DemoDep = Annotated[Demo, Depends(get_demo)]


def get_price_demo(demo: DemoDep) -> Demo:
    """Price endpoints fail on purpose when the demo failure switch is on."""
    if demo.fail:
        raise ApiError(503, "demo_failure", "Simulated failure (X-Demo-Fail)")
    return demo


PriceDemoDep = Annotated[Demo, Depends(get_price_demo)]
