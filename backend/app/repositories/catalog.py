"""Catalog tables: countries, areas, markets, crops and the source name maps."""

from collections.abc import Sequence
from typing import Any

from sqlalchemy import Table, delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Area,
    Country,
    Crop,
    Market,
    SourceAreaMap,
    SourceCropMap,
    SourceMarketMap,
)

Row = dict[str, Any]


async def _upsert(
    session: AsyncSession, table: Table, rows: Sequence[Row], keys: list[str]
) -> None:
    if not rows:
        return
    stmt = insert(table).values(list(rows))
    updates = {c.name: stmt.excluded[c.name] for c in table.columns if c.name not in keys}
    await session.execute(stmt.on_conflict_do_update(index_elements=keys, set_=updates))


async def upsert_country(session: AsyncSession, row: Row) -> None:
    await _upsert(session, Country.__table__, [row], ["code"])  # type: ignore[arg-type]


async def upsert_areas(session: AsyncSession, rows: Sequence[Row]) -> None:
    await _upsert(session, Area.__table__, rows, ["id"])  # type: ignore[arg-type]


async def upsert_markets(session: AsyncSession, rows: Sequence[Row]) -> None:
    await _upsert(session, Market.__table__, rows, ["id"])  # type: ignore[arg-type]


async def upsert_crops(session: AsyncSession, rows: Sequence[Row]) -> None:
    await _upsert(session, Crop.__table__, rows, ["country", "id"])  # type: ignore[arg-type]


async def delete_missing(
    session: AsyncSession,
    country: str,
    area_ids: Sequence[str],
    market_ids: Sequence[str],
    crop_ids: Sequence[str],
) -> None:
    """Removes catalog rows of `country` that are no longer in the seed (cascades to data)."""
    country_areas = select(Area.id).where(Area.country == country)
    await session.execute(
        delete(Market).where(Market.area_id.in_(country_areas), Market.id.not_in(market_ids))
    )
    await session.execute(delete(Area).where(Area.country == country, Area.id.not_in(area_ids)))
    await session.execute(delete(Crop).where(Crop.country == country, Crop.id.not_in(crop_ids)))


async def replace_source_maps(
    session: AsyncSession,
    country: str,
    crops: Sequence[Row],
    markets: Sequence[Row],
    areas: Sequence[Row],
) -> None:
    """Replaces every source map row of `country` (rows carry their own `source`)."""
    for model in (SourceCropMap, SourceMarketMap, SourceAreaMap):
        await session.execute(delete(model).where(model.country == country))
    if crops:
        await session.execute(insert(SourceCropMap).values(list(crops)))
    if markets:
        await session.execute(insert(SourceMarketMap).values(list(markets)))
    if areas:
        await session.execute(insert(SourceAreaMap).values(list(areas)))
