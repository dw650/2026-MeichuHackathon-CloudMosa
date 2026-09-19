"""Async engine and session factory."""

from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.config import Settings


def create_engine(settings: Settings) -> AsyncEngine:
    options: dict[str, Any] = {"pool_pre_ping": True}
    if settings.db_null_pool:
        options = {"poolclass": NullPool}
    return create_async_engine(settings.database_url, **options)


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)
