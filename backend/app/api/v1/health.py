from fastapi import APIRouter

from app.deps import SessionDep
from app.schemas.health import HealthOut
from app.services import health as service

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    summary="Health check",
    description="Database status. Returns 503 `db_unavailable` when the database is down.",
    response_model=HealthOut,
    responses={
        200: {"content": {"application/json": {"example": {"status": "ok", "database": "ok"}}}}
    },
)
async def health(session: SessionDep) -> HealthOut:
    report = await service.check(session)
    return HealthOut(status=report.status, database=report.database)
