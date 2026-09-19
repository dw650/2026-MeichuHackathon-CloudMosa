"""International reference prices (bonus B5): World Bank Pink Sheet series per kg in the
country's currency."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from app.deps import NowDep, PriceDemoDep, SessionDep, public_cache
from app.schemas.common import error_responses
from app.schemas.intl import IntlPricesOut, IntlSeriesOut
from app.services import intl as service

router = APIRouter(tags=["intl"], dependencies=[Depends(public_cache)])

Country = Annotated[str, Query(description="Country code; its currency is shown", examples=["TW"])]
SeriesId = Annotated[str, Path(description="Series id", examples=["rice"])]
ERRORS = error_responses(
    (400, "invalid_param", "country: Field required"),
    (404, "country_not_found", "Country 'XX' not found"),
    (503, "demo_failure", "Simulated failure (X-Demo-Fail, demo mode only)"),
)

_FX = {"currency": "TWD", "per_usd": 31.834145, "rate_date": "2026-09-19"}
_ITEM = {
    "id": "rice",
    "name": {"zh-TW": "稻米", "en": "Rice"},
    "spec": {"zh-TW": "泰國 5% 碎米", "en": "Thai 5% broken"},
    "source_name": "Rice, Thai 5%",
    "icon": "rice",
    "category": "cereal",
    "month": "2026-08-01",
    "usd": 471.0,
    "usd_unit": "mt",
    "price_per_kg": 14.9939,
    "reason": None,
    "change": {
        "pct": 0.008565,
        "diff_per_kg": 0.1273,
        "direction": "up",
        "prev_month": "2026-07-01",
    },
}
_CONTEXT = {
    "country": "TW",
    "currency": "TWD",
    "today": "2026-09-20",
    "fx": _FX,
    "published": "2026-09-02",
}
PRICES_EXAMPLE = _CONTEXT | {"items": [_ITEM]}
SERIES_EXAMPLE = (
    _CONTEXT
    | _ITEM
    | {
        "stats": {
            "high_per_kg": 15.726,
            "low_per_kg": 11.333,
            "avg_per_kg": 13.251,
            "vs_avg_pct": 0.131532,
        },
        "series": [
            {"month": "2025-09-01", "usd": 374.0, "price_per_kg": 11.906},
            {"month": "2026-08-01", "usd": 471.0, "price_per_kg": 14.9939},
        ],
    }
)


def _example(value: object) -> dict[int | str, dict[str, object]]:
    return {200: {"content": {"application/json": {"example": value}}}}


@router.get(
    "/intl",
    summary="International reference prices",
    description=(
        "Six World Bank Pink Sheet series (monthly averages, published early the next month),"
        " each with its latest month, the price per kg in the country's currency and the change"
        " from the month before. Every month is converted with the latest daily exchange rate"
        " (`fx`); `usd` keeps the published price. No local price comes with a `reason`."
    ),
    response_model=IntlPricesOut,
    responses=_example(PRICES_EXAMPLE) | ERRORS,
)
async def intl_prices(
    session: SessionDep, now: NowDep, _demo: PriceDemoDep, country: Country
) -> IntlPricesOut:
    return IntlPricesOut.model_validate(await service.intl_prices(session, country, now))


@router.get(
    "/intl/{series}",
    summary="One international reference price",
    description=(
        "The series with its 12 months up to the latest one (null = no price that month) and"
        " their high, low and average, all per kg in the country's currency."
    ),
    response_model=IntlSeriesOut,
    responses=_example(SERIES_EXAMPLE)
    | ERRORS
    | error_responses((404, "series_not_found", "Series 'xyz' not found")),
)
async def intl_series(
    session: SessionDep, now: NowDep, _demo: PriceDemoDep, country: Country, series: SeriesId
) -> IntlSeriesOut:
    return IntlSeriesOut.model_validate(await service.intl_series(session, country, series, now))
