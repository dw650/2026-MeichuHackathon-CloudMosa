"""Catalog tables: countries, areas, markets, crops and the source name maps."""

from collections.abc import Sequence
from datetime import date
from typing import Any

from sqlalchemy import Table, delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Area,
    AreaDaily,
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


# ---------- reads ----------


async def get_countries(session: AsyncSession) -> list[Country]:
    result = await session.execute(select(Country).order_by(Country.sort))
    return list(result.scalars().all())


async def get_country(session: AsyncSession, code: str) -> Country | None:
    return await session.get(Country, code)


async def get_areas(session: AsyncSession, country: str) -> list[Area]:
    result = await session.execute(select(Area).where(Area.country == country).order_by(Area.sort))
    return list(result.scalars().all())


async def get_crops(session: AsyncSession, country: str) -> list[Crop]:
    result = await session.execute(select(Crop).where(Crop.country == country).order_by(Crop.sort))
    return list(result.scalars().all())


async def default_watch(session: AsyncSession) -> dict[str, list[str]]:
    result = await session.execute(
        select(Crop.country, Crop.id).where(Crop.default_watch).order_by(Crop.country, Crop.sort)
    )
    out: dict[str, list[str]] = {}
    for country, crop in result.tuples().all():
        out.setdefault(country, []).append(crop)
    return out


async def latest_wholesale_dates(
    session: AsyncSession, country: str, start: date, end: date
) -> dict[str, date]:
    """Latest wholesale trade date of each area (any crop) between start and end."""
    result = await session.execute(
        select(AreaDaily.area_id, func.max(AreaDaily.trade_date))
        .where(
            AreaDaily.country == country,
            AreaDaily.price_type == "wholesale",
            AreaDaily.trade_date.between(start, end),
        )
        .group_by(AreaDaily.area_id)
    )
    return dict(result.tuples().all())
