"""Reads of the aggregate tables used by the price endpoints."""

from collections.abc import Sequence
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AreaDaily, MarketDaily, Quote


async def area_daily_rows(
    session: AsyncSession,
    *,
    country: str,
    price_type: str,
    start: date,
    end: date,
    area_ids: Sequence[str] | None = None,
    crop_ids: Sequence[str] | None = None,
) -> list[AreaDaily]:
    stmt = select(AreaDaily).where(
        AreaDaily.country == country,
        AreaDaily.price_type == price_type,
        AreaDaily.trade_date.between(start, end),
    )
    if area_ids is not None:
        stmt = stmt.where(AreaDaily.area_id.in_(area_ids))
    if crop_ids is not None:
        stmt = stmt.where(AreaDaily.crop_id.in_(crop_ids))
    result = await session.execute(stmt.order_by(AreaDaily.trade_date))
    return list(result.scalars().all())


async def market_daily_rows(
    session: AsyncSession, *, market_ids: Sequence[str], crop_id: str, start: date, end: date
) -> list[MarketDaily]:
    result = await session.execute(
        select(MarketDaily)
        .where(
            MarketDaily.market_id.in_(market_ids),
            MarketDaily.crop_id == crop_id,
            MarketDaily.trade_date.between(start, end),
        )
        .order_by(MarketDaily.trade_date)
    )
    return list(result.scalars().all())


async def quote_source(
    session: AsyncSession,
    *,
    area_id: str,
    crop_id: str,
    price_type: str,
    day: date,
    market_id: str | None = None,
) -> str | None:
    """The data source behind an area's (or a market's) price on one day."""
    stmt = select(Quote.source).where(
        Quote.area_id == area_id,
        Quote.crop_id == crop_id,
        Quote.price_type == price_type,
        Quote.trade_date == day,
    )
    if market_id is not None:
        stmt = stmt.where(Quote.market_id == market_id)
    result = await session.execute(stmt.limit(1))
    return result.scalar_one_or_none()
