"""Health report: database status and data source freshness."""

from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.repositories import health as repo


@dataclass(frozen=True)
class SourceStatus:
    source: str
    last_success_at: datetime
    rows_ok: int


@dataclass(frozen=True)
class HealthReport:
    status: str
    database: str
    sources: list[SourceStatus] = field(default_factory=list)


async def check(session: AsyncSession) -> HealthReport:
    try:
        await repo.ping(session)
        sources = await repo.last_success_by_source(session)
    except (SQLAlchemyError, OSError) as exc:
        raise ApiError(503, "db_unavailable", "Database is not reachable") from exc
    return HealthReport(
        status="ok",
        database="ok",
        sources=[SourceStatus(source=s, last_success_at=f, rows_ok=n) for s, f, n in sources],
    )
