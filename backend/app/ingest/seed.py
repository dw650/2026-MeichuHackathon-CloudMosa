"""Syncs the seed YAML files into the catalog tables. Safe to run any number of times."""

import logging
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import catalog
from app.seed.loader import SEED_DIR, load_seed_files
from app.seed.schema import SeedFile

logger = logging.getLogger("app.ingest.seed")


async def _sync_one(session: AsyncSession, seed: SeedFile) -> None:
    c = seed.country
    await catalog.upsert_country(
        session,
        {
            "code": c.code,
            "sort": c.sort,
            "name": c.name,
            "coverage": c.coverage,
            "currency": c.currency,
            "locale": c.locale,
            "utc_offset_min": c.utc_offset_min,
            "up_is_pos": c.up_is_pos,
            "closed_weekdays": c.closed_weekdays,
            "default_area_id": c.default_area,
            "default_recent_area_ids": c.default_recent_areas,
            "area_suffix": c.area_suffix,
            "rep_price_label": c.rep_price_label,
            "source_label": c.source_label,
            "units": c.units.model_dump(),
            "default_price_type": c.default_price_type,
        },
    )
    await catalog.upsert_areas(
        session,
        [
            {
                "id": a.id,
                "country": c.code,
                "name": a.name,
                "region": a.region,
                "lat": a.lat,
                "lon": a.lon,
                "has_retail": a.retail,
                "sort": i,
            }
            for i, a in enumerate(seed.areas, start=1)
        ],
    )
    await catalog.upsert_markets(
        session,
        [
            {"id": m.id, "area_id": a.id, "name": m.name, "km_from_center": m.km, "sort": i}
            for a in seed.areas
            for i, m in enumerate(a.markets, start=1)
        ],
    )
    await catalog.upsert_crops(
        session,
        [
            {
                "country": c.code,
                "id": crop.id,
                "name": crop.name,
                "category": crop.category,
                "variety": crop.variety,
                "sort": i,
                "default_watch": crop.watch,
                "has_retail": crop.retail,
            }
            for i, crop in enumerate(seed.crops, start=1)
        ],
    )
    await catalog.delete_missing(
        session,
        c.code,
        area_ids=[a.id for a in seed.areas],
        market_ids=[m.id for a in seed.areas for m in a.markets],
        crop_ids=[crop.id for crop in seed.crops],
    )
    await catalog.replace_source_maps(
        session,
        c.code,
        crops=[
            {
                "source": source,
                "country": c.code,
                "source_name": m.source_name,
                "source_variety": m.source_variety,
                "crop_id": m.crop,
            }
            for source, maps in seed.source_maps.items()
            for m in maps.crops
        ],
        markets=[
            {
                "source": source,
                "country": c.code,
                "source_market": m.source_market,
                "market_id": m.market,
            }
            for source, maps in seed.source_maps.items()
            for m in maps.markets
        ],
        areas=[
            {"source": source, "country": c.code, "source_area": m.source_area, "area_id": m.area}
            for source, maps in seed.source_maps.items()
            for m in maps.areas
        ],
    )


async def sync_seed(session: AsyncSession, seed_dir: Path = SEED_DIR) -> list[SeedFile]:
    """Upserts every seed file in one transaction and returns the parsed seeds."""
    seeds = load_seed_files(seed_dir)
    for seed in seeds:
        await _sync_one(session, seed)
    await session.commit()
    logger.info("seed synced: %s", ", ".join(s.country.code for s in seeds))
    return seeds
