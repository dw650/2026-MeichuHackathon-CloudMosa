"""FastAPI dependencies shared by routers."""

from collections.abc import AsyncIterator, Callable
from datetime import datetime
from typing import Annotated

from fastapi import Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings


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
