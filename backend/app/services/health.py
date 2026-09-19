"""Health report: database status and data source freshness."""

from dataclasses import dataclass, field

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.repositories import health as repo


@dataclass(frozen=True)
class HealthReport:
    status: str
    database: str
    sources: list[dict[str, object]] = field(default_factory=list)


async def check(session: AsyncSession) -> HealthReport:
    try:
        await repo.ping(session)
    except (SQLAlchemyError, OSError) as exc:
        raise ApiError(503, "db_unavailable", "Database is not reachable") from exc
    return HealthReport(status="ok", database="ok")
