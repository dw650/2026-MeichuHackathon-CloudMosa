"""Countries, areas and crops, with each country's local today and area freshness."""

from datetime import datetime, timedelta
from functools import cache
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Country
from app.errors import ApiError
from app.ingest.derive import Derivation
from app.repositories import catalog as repo
from app.seed.loader import load_derive_seed
from app.services.demo import NO_DEMO, Demo
from app.services.freshness import WINDOW_DAYS, staleness
from app.timeutil import local_today


@cache
def _ratios() -> dict[str, Derivation]:
    """The estimate ratios of every country (`app/seed/derive.yaml`, a file of the image).
    Whether a country uses them is `countries.estimated_price_types`, which the worker writes
    from the sources it actually runs."""
    return {
        code: Derivation(country=code, rules=rules)
        for code, rules in load_derive_seed().countries.items()
    }


async def require_country(session: AsyncSession, code: str) -> Country:
    country = await repo.get_country(session, code.upper())
    if country is None:
        raise ApiError(404, "country_not_found", f"Country {code!r} not found")
    return country


async def list_countries(session: AsyncSession, now: datetime) -> list[dict[str, Any]]:
    watch = await repo.default_watch(session)
    return [
        {
            "code": c.code,
            "name": c.name,
            "coverage": c.coverage,
            "currency": c.currency,
            "locale": c.locale,
            "utc_offset_min": c.utc_offset_min,
            "today": local_today(c.utc_offset_min, now),
            "up_is_pos": c.up_is_pos,
            "closed_weekdays": c.closed_weekdays,
            "default_area_id": c.default_area_id,
            "default_recent_area_ids": c.default_recent_area_ids,
            "default_watch": watch.get(c.code, []),
            "area_suffix": c.area_suffix,
            "rep_price_label": c.rep_price_label,
            "source_label": c.source_label,
            "estimated_price_types": c.estimated_price_types,
            "units": c.units,
        }
        for c in await repo.get_countries(session)
    ]


async def list_areas(
    session: AsyncSession, code: str, now: datetime, demo: Demo = NO_DEMO
) -> dict[str, Any]:
    country = await require_country(session, code)
    today = local_today(country.utc_offset_min, now)
    start = today - timedelta(days=WINDOW_DAYS - 1)
    latest = await repo.latest_dates(session, country.code, start, today)
    for area_id in demo.stale_days:
        shifted = await repo.latest_dates(
            session, country.code, start, demo.until(area_id, today), area_id=area_id
        )
        latest.pop(area_id, None)
        latest.update(shifted)
    areas = []
    for a in await repo.get_areas(session, country.code):
        fresh = staleness(latest.get(a.id), today, country.closed_weekdays)
        areas.append(
            {
                "id": a.id,
                "name": a.name,
                "region": a.region,
                "lat": a.lat,
                "lon": a.lon,
                "has_retail": a.has_retail,
                "latest_trade_date": latest.get(a.id),
                "staleness": {"days": fresh.days, "state": fresh.state},
            }
        )
    return {"country": country.code, "today": today, "areas": areas}


async def list_crops(session: AsyncSession, code: str) -> dict[str, Any]:
    country = await require_country(session, code)
    # Only a country that estimates a price type carries a ratio, so a screen never names one
    # for a price an agency really reported.
    ratios = _ratios().get(country.code) if country.estimated_price_types else None
    crops = [
        {
            "id": c.id,
            "name": c.name,
            "category": c.category,
            "variety": c.variety,
            "has_retail": c.has_retail,
            "default_watch": c.default_watch,
            "estimate_ratio": ratios.ratio(c.id, c.category) if ratios else None,
        }
        for c in await repo.get_crops(session, country.code)
    ]
    return {"country": country.code, "crops": crops}
