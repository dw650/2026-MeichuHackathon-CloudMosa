"""Database reachability check."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def ping(session: AsyncSession) -> None:
    await session.execute(text("SELECT 1"))
