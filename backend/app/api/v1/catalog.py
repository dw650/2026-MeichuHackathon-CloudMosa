"""Catalog endpoints: countries (with settings), areas and crops."""

from fastapi import APIRouter, Depends, Path

from app.deps import DemoDep, NowDep, SessionDep, public_cache
from app.schemas.catalog import AreasOut, CountriesOut, CropsOut
from app.schemas.common import error_responses
from app.services import catalog as service

router = APIRouter(tags=["catalog"], dependencies=[Depends(public_cache)])

CountryCode = Path(description="Country code, e.g. `IN`, `TW` or `MY`", examples=["IN"])
NOT_FOUND = error_responses((404, "country_not_found", "Country 'XX' not found"))

_EN_ZH = {"zh-TW": "印度", "en": "India"}
COUNTRY_EXAMPLE = {
    "code": "IN",
    "name": _EN_ZH,
    "coverage": {"zh-TW": "6 個邦、11 個縣", "en": "6 states, 11 districts"},
    "currency": "INR",
    "locale": "en-IN",
    "utc_offset_min": 330,
    "today": "2026-09-19",
    "up_is_pos": True,
    "closed_weekdays": [7],
    "default_area_id": "nashik",
    "default_recent_area_ids": ["nashik", "pune", "ahmednagar"],
    "default_watch": ["onion", "tomato", "potato"],
    "area_suffix": {"zh-TW": " 縣", "en": " district"},
    "rep_price_label": {"zh-TW": "常見價", "en": "Modal price"},
    "source_label": {"zh-TW": "Agmarknet・消費者事務部（印度政府）", "en": "Agmarknet"},
    "units": {
        "wholesale": {
            "default": "qtl",
            "options": [
                {
                    "id": "qtl",
                    "per_kg": 100,
                    "decimals": 0,
                    "label": {"zh-TW": "₹/公擔", "en": "₹/qtl"},
                },
                {
                    "id": "kg",
                    "per_kg": 1,
                    "decimals": 1,
                    "label": {"zh-TW": "₹/公斤", "en": "₹/kg"},
                },
            ],
        },
        "retail": {
            "default": "kg",
            "options": [
                {
                    "id": "kg",
                    "per_kg": 1,
                    "decimals": 1,
                    "label": {"zh-TW": "₹/公斤", "en": "₹/kg"},
                },
                {
                    "id": "qtl",
                    "per_kg": 100,
                    "decimals": 0,
                    "label": {"zh-TW": "₹/公擔", "en": "₹/qtl"},
                },
            ],
        },
    },
    "categories": [
        {
            "id": "cereal",
            "name": {"zh-TW": "穀物", "en": "Cereals"},
            "icon": "wheat",
            "tone": "amber",
        },
        {"id": "veg", "name": {"zh-TW": "蔬菜", "en": "Veg"}, "icon": "cabbage", "tone": "green"},
    ],
}
AREAS_EXAMPLE = {
    "country": "IN",
    "today": "2026-09-19",
    "areas": [
        {
            "id": "nashik",
            "name": {"zh-TW": "Nashik", "en": "Nashik"},
            "region": {"zh-TW": "Maharashtra", "en": "Maharashtra"},
            "lat": 20.0,
            "lon": 73.79,
            "has_retail": True,
            "latest_trade_date": "2026-09-19",
            "staleness": {"days": 0, "state": "today"},
        },
        {
            "id": "kolar",
            "name": {"zh-TW": "Kolar", "en": "Kolar"},
            "region": {"zh-TW": "Karnataka", "en": "Karnataka"},
            "lat": 13.14,
            "lon": 78.13,
            "has_retail": False,
            "latest_trade_date": "2026-09-16",
            "staleness": {"days": 3, "state": "stale"},
        },
    ],
}
CROPS_EXAMPLE = {
    "country": "IN",
    "crops": [
        {
            "id": "onion",
            "name": {"zh-TW": "洋蔥", "en": "Onion"},
            "category": "veg",
            "variety": {"zh-TW": "紅洋蔥", "en": "Red"},
            "has_retail": True,
            "default_watch": True,
        }
    ],
}


def _example(value: object) -> dict[int | str, dict[str, object]]:
    return {200: {"content": {"application/json": {"example": value}}}}


@router.get(
    "/countries",
    summary="Countries and their settings",
    description=(
        "Currency, locale, local today, closed weekdays (ISO, 7 = Sunday), rise colour"
        " (`up_is_pos`: rising prices shown green), default area, recent areas and watchlist,"
        " the unit table (per-kg factor and decimals) for wholesale and retail, and the"
        " crop categories of the home grid in order (at most 8; crops carry their `id`)."
    ),
    response_model=CountriesOut,
    responses=_example({"countries": [COUNTRY_EXAMPLE]}),
)
async def countries(session: SessionDep, now: NowDep) -> CountriesOut:
    return CountriesOut.model_validate({"countries": await service.list_countries(session, now)})


@router.get(
    "/countries/{cc}/areas",
    summary="Areas of a country",
    description=(
        "Areas (district or city) with centre coordinates for straight-line distances,"
        " whether retail prices are reported, and the latest wholesale trade date with"
        " its freshness."
    ),
    response_model=AreasOut,
    responses=_example(AREAS_EXAMPLE) | NOT_FOUND,
)
async def areas(session: SessionDep, now: NowDep, demo: DemoDep, cc: str = CountryCode) -> AreasOut:
    return AreasOut.model_validate(await service.list_areas(session, cc, now, demo))


@router.get(
    "/countries/{cc}/crops",
    summary="Crops of a country",
    description="Names, category, variety, whether retail prices exist, default watchlist.",
    response_model=CropsOut,
    responses=_example(CROPS_EXAMPLE) | NOT_FOUND,
)
async def crops(session: SessionDep, cc: str = CountryCode) -> CropsOut:
    return CropsOut.model_validate(await service.list_crops(session, cc))
