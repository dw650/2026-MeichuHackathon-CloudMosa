from fastapi import APIRouter

from app.deps import SessionDep, SettingsDep
from app.schemas.health import HealthOut, SourceStatusOut
from app.services import health as service

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    summary="Health check",
    description=(
        "Database status, the latest successful fetch of every data source and the running"
        " version (commit). Returns 503 `db_unavailable` when the database is down."
    ),
    response_model=HealthOut,
    responses={
        200: {
            "content": {
                "application/json": {
                    "example": {
                        "status": "ok",
                        "database": "ok",
                        "sources": [
                            {
                                "source": "mock",
                                "last_success_at": "2026-09-19T00:05:03+00:00",
                                "rows_ok": 26355,
                            }
                        ],
                        "version": "f40c282",
                    }
                }
            }
        }
    },
)
async def health(session: SessionDep, settings: SettingsDep) -> HealthOut:
    report = await service.check(session)
    return HealthOut(
        status=report.status,
        database=report.database,
        sources=[
            SourceStatusOut(source=s.source, last_success_at=s.last_success_at, rows_ok=s.rows_ok)
            for s in report.sources
        ],
        version=settings.app_version,
    )
