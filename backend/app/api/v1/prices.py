"""Price endpoints: home list, quote, comparison, markets of an area and one market."""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from app.deps import NowDep, PriceDemoDep, SessionDep, public_cache
from app.schemas.common import error_responses
from app.schemas.prices import (
    CompareOut,
    MarketOut,
    MarketsOut,
    PricesOut,
    PriceType,
    QuoteOut,
)
from app.services import prices as service

router = APIRouter(tags=["prices"], dependencies=[Depends(public_cache)])

Country = Annotated[str, Query(description="Country code", examples=["IN"])]
AreaId = Annotated[str, Query(description="Area id", examples=["nashik"])]
Type = Annotated[PriceType, Query(alias="type", description="wholesale or retail")]
CropId = Annotated[str, Path(description="Crop id", examples=["onion"])]
ERRORS = error_responses(
    (400, "invalid_param", "type: Input should be 'wholesale' or 'retail'"),
    (404, "area_not_found", "Area 'xyz' not found in IN"),
    (503, "demo_failure", "Simulated failure (X-Demo-Fail, demo mode only)"),
)

_STALE = {"days": 0, "state": "today"}
_CHANGE = {"pct": 0.042, "diff_per_kg": 0.95, "direction": "up", "prev_trade_date": "2026-09-18"}
QUOTE_EXAMPLE = {
    "crop_id": "onion",
    "area_id": "nashik",
    "type": "wholesale",
    "currency": "INR",
    "today": "2026-09-19",
    "trade_date": "2026-09-19",
    "staleness": _STALE,
    "fetched_at": "2026-09-19T11:40:00+05:30",
    "price_per_kg": 23.5,
    "reason": None,
    "markets": {"count": 7, "total": 10, "min_per_kg": 22.8, "max_per_kg": 24.9},
    "change": _CHANGE,
    "stats": {
        "vs_avg7_pct": 0.031,
        "pos30": 0.82,
        "volatility": "mid",
        "volatility_pct": 0.028,
        "arrivals": "high",
        "arrivals_ratio": 1.18,
        "high7_per_kg": 23.5,
        "low7_per_kg": 21.9,
        "high30_per_kg": 24.1,
        "low30_per_kg": 19.8,
        "change7_pct": 0.052,
        "change30_pct": 0.11,
    },
    "series": [
        {"date": "2026-08-21", "price_per_kg": 21.2},
        {"date": "2026-08-23", "price_per_kg": None},
    ],
    "source": {"id": "mock", "name": {"zh-TW": "示範資料", "en": "Demo data"}},
}
PRICES_EXAMPLE = {
    "country": "IN",
    "area_id": "nashik",
    "type": "wholesale",
    "currency": "INR",
    "today": "2026-09-19",
    "fetched_at": "2026-09-19T11:40:00+05:30",
    "items": [
        {
            "crop_id": "onion",
            "price_per_kg": 23.5,
            "reason": None,
            "trade_date": "2026-09-19",
            "staleness": _STALE,
            "change": _CHANGE,
            "spark": [None, 22.1, 22.3, 22.0, 22.4, 22.55, 23.5],
        },
        {
            "crop_id": "chilli",
            "price_per_kg": None,
            "reason": "no_retail_crop",
            "trade_date": None,
            "staleness": {"days": None, "state": "none"},
            "change": None,
            "spark": [None, None, None, None, None, None, None],
        },
    ],
}
COMPARE_EXAMPLE = {
    "crop_id": "onion",
    "area_id": "nashik",
    "type": "wholesale",
    "currency": "INR",
    "today": "2026-09-19",
    "rank": {"position": 3, "total": 10},
    "rows": [
        {
            "area_id": "delhi",
            "price_per_kg": 29.4,
            "n_markets": 2,
            "distance_km": 1017,
            "diff_per_kg": 5.9,
            "trade_date": "2026-09-19",
            "staleness": _STALE,
            "rank": 1,
            "is_base": False,
        }
    ],
}
MARKETS_EXAMPLE = {
    "crop_id": "onion",
    "area_id": "nashik",
    "currency": "INR",
    "today": "2026-09-19",
    "median_per_kg": 23.5,
    "trade_date": "2026-09-19",
    "staleness": _STALE,
    "rows": [
        {
            "market_id": "satana",
            "name": {"zh-TW": "Satana", "en": "Satana"},
            "km_from_center": 88,
            "price_per_kg": 24.9,
            "trade_date": "2026-09-19",
            "staleness": _STALE,
            "diff_per_kg": 1.4,
        }
    ],
}
MARKET_EXAMPLE = {
    "crop_id": "onion",
    "market_id": "lasalgaon",
    "area_id": "nashik",
    "name": {"zh-TW": "Lasalgaon", "en": "Lasalgaon"},
    "km_from_center": 32,
    "currency": "INR",
    "today": "2026-09-19",
    "trade_date": "2026-09-19",
    "staleness": _STALE,
    "fetched_at": "2026-09-19T11:40:00+05:30",
    "price_per_kg": 23.4,
    "reason": None,
    "low_per_kg": 18.9,
    "high_per_kg": 26.0,
    "change": _CHANGE,
    "source": {"id": "mock", "name": {"zh-TW": "示範資料", "en": "Demo data"}},
}


def _example(value: object) -> dict[int | str, dict[str, object]]:
    return {200: {"content": {"application/json": {"example": value}}}}


@router.get(
    "/prices",
    summary="Prices of many crops in one area",
    description=(
        "For the home screen and crop lists: latest area price, change vs the previous trading"
        " day, freshness and a 7-day sparkline for each crop. `crops` is a comma-separated"
        " list (default: every crop); unknown crop ids are skipped."
    ),
    response_model=PricesOut,
    responses=_example(PRICES_EXAMPLE) | ERRORS,
)
async def prices(
    session: SessionDep,
    now: NowDep,
    demo: PriceDemoDep,
    country: Country,
    area: AreaId,
    price_type: Type = "wholesale",
    crops: Annotated[str | None, Query(examples=["onion,tomato"])] = None,
) -> PricesOut:
    crop_ids = [c.strip() for c in crops.split(",") if c.strip()] if crops is not None else None
    data = await service.home_prices(session, country, area, price_type, crop_ids, now, demo)
    return PricesOut.model_validate(data)


@router.get(
    "/crops/{crop}/quote",
    summary="Quote of one crop in one area",
    description=(
        "Area price (wholesale: median of the markets that reported on the latest trade"
        " date), market count and range, change, indicators and a daily series with null for"
        " days without data. Without a price, `reason` says why."
    ),
    response_model=QuoteOut,
    responses=_example(QUOTE_EXAMPLE)
    | ERRORS
    | error_responses((404, "crop_not_found", "Crop 'durian' not found in IN")),
)
async def quote(
    session: SessionDep,
    now: NowDep,
    demo: PriceDemoDep,
    crop: CropId,
    country: Country,
    area: AreaId,
    price_type: Type = "wholesale",
    days: Annotated[int, Query(ge=7, le=30, description="Series length")] = 30,
) -> QuoteOut:
    data = await service.quote(session, country, area, crop, price_type, days, now, demo)
    return QuoteOut.model_validate(data)


@router.get(
    "/crops/{crop}/compare",
    summary="Compare one crop across the areas of a country",
    description=(
        "Each area's latest price, market count, straight-line distance from the area being"
        " viewed, difference and rank (highest price first, ties share a rank, no data is"
        " not ranked). Sorting for display is left to the client."
    ),
    response_model=CompareOut,
    responses=_example(COMPARE_EXAMPLE) | ERRORS,
)
async def compare(
    session: SessionDep,
    now: NowDep,
    demo: PriceDemoDep,
    crop: CropId,
    country: Country,
    area: AreaId,
    price_type: Type = "wholesale",
) -> CompareOut:
    data = await service.compare(session, country, area, crop, price_type, now, demo)
    return CompareOut.model_validate(data)


@router.get(
    "/crops/{crop}/markets",
    summary="Wholesale markets of an area",
    description="Each market's latest price, distance from the area centre and its difference"
    " from the area median. Retail prices have no market breakdown.",
    response_model=MarketsOut,
    responses=_example(MARKETS_EXAMPLE) | ERRORS,
)
async def markets(
    session: SessionDep,
    now: NowDep,
    demo: PriceDemoDep,
    crop: CropId,
    country: Country,
    area: AreaId,
) -> MarketsOut:
    return MarketsOut.model_validate(await service.markets(session, country, area, crop, now, demo))


@router.get(
    "/crops/{crop}/markets/{market}",
    summary="One wholesale market",
    description="Representative price (India: modal, Taiwan: average), change, the day's"
    " low–high range and the data source.",
    response_model=MarketOut,
    responses=_example(MARKET_EXAMPLE)
    | error_responses((404, "market_not_found", "Market 'xyz' not found in IN")),
)
async def market(
    session: SessionDep,
    now: NowDep,
    demo: PriceDemoDep,
    crop: CropId,
    country: Country,
    market: Annotated[str, Path(examples=["lasalgaon"])],
) -> MarketOut:
    return MarketOut.model_validate(await service.market(session, country, crop, market, now, demo))
