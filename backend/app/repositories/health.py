"""Database reachability and data source freshness."""

from datetime import datetime

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import IngestRun


async def ping(session: AsyncSession) -> None:
    await session.execute(text("SELECT 1"))


async def last_success_by_source(session: AsyncSession) -> list[tuple[str, datetime, int]]:
    """(source, finished_at, rows_ok) of the latest successful run of every source."""
    latest = (
        select(IngestRun.source, func.max(IngestRun.id).label("id"))
        .where(IngestRun.status == "ok")
        .group_by(IngestRun.source)
        .subquery()
    )
    rows = await session.execute(
        select(IngestRun.source, IngestRun.finished_at, IngestRun.rows_ok)
        .join(latest, IngestRun.id == latest.c.id)
        .order_by(IngestRun.source)
    )
    return [(s, f, n) for s, f, n in rows.tuples().all() if f is not None]
