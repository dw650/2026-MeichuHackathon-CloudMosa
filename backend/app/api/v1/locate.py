"""IP-based location guess (F17)."""

from fastapi import APIRouter, Request, Response

from app.deps import DemoDep, SessionDep
from app.schemas.locate import LocateOut
from app.services import locate as service

router = APIRouter(tags=["locate"])


@router.get(
    "/locate",
    summary="Guess the user's area from the network address",
    description=(
        "Uses the leftmost public address of `X-Client-Forwarded-For` (set by the proxy from"
        " the Cloud Phone's `X-Forwarded-For`) and the nearest area centre within 300 km."
        " No GPS; the address is neither stored nor logged. Nulls mean no guess."
    ),
    response_model=LocateOut,
    responses={
        200: {"content": {"application/json": {"example": {"country": "IN", "area_id": "nashik"}}}}
    },
)
async def locate(
    request: Request, response: Response, session: SessionDep, demo: DemoDep
) -> LocateOut:
    # The answer depends on the caller's address: never cache it in shared caches.
    response.headers["Cache-Control"] = "private, no-store"
    result = await service.locate(
        session, request.headers.get("x-client-forwarded-for"), request.app.state.geo, demo
    )
    return LocateOut.model_validate(result)
