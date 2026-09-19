"""International reference prices (bonus B5): the series, their monthly prices, the exchange
rates and the download state of both sources."""

from collections.abc import Mapping, Sequence
from datetime import date, datetime
from typing import Any

from sqlalchemy import delete, exists, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import FxRate, IntlPrice, IntlSeries, IntlSource

Row = dict[str, Any]


# ---------- series ----------


async def sync_series(session: AsyncSession, rows: Sequence[Row]) -> None:
    """Makes `intl_series` match the seed; a series taken out loses its prices (cascade)."""
    if rows:
        stmt = insert(IntlSeries).values(list(rows))
        keep = {
            c.name: stmt.excluded[c.name] for c in IntlSeries.__table__.columns if c.name != "id"
        }
        await session.execute(stmt.on_conflict_do_update(index_elements=["id"], set_=keep))
    await session.execute(delete(IntlSeries).where(IntlSeries.id.not_in([r["id"] for r in rows])))


async def get_series(session: AsyncSession) -> list[IntlSeries]:
    result = await session.execute(select(IntlSeries).order_by(IntlSeries.sort, IntlSeries.id))
    return list(result.scalars().all())


async def get_one_series(session: AsyncSession, series_id: str) -> IntlSeries | None:
    return await session.get(IntlSeries, series_id)


# ---------- monthly prices ----------


async def replace_prices(
    session: AsyncSession,
    series_id: str,
    prices: Sequence[tuple[date, float]],
    fetched_at: datetime,
) -> None:
    """The series' months exactly as in the latest file (revisions and removals included)."""
    await session.execute(delete(IntlPrice).where(IntlPrice.series_id == series_id))
    if prices:
        await session.execute(
            insert(IntlPrice).values(
                [
                    {"series_id": series_id, "month": month, "usd": usd, "fetched_at": fetched_at}
                    for month, usd in prices
                ]
            )
        )


async def has_prices(session: AsyncSession) -> bool:
    return bool(await session.scalar(select(exists().where(IntlPrice.usd > 0))))


async def latest_month(session: AsyncSession) -> date | None:
    month: date | None = await session.scalar(select(func.max(IntlPrice.month)))
    return month


async def latest_price(session: AsyncSession, series_id: str) -> IntlPrice | None:
    """Newest month of one series (the cross-country card's world reference row)."""
    result = await session.execute(
        select(IntlPrice)
        .where(IntlPrice.series_id == series_id)
        .order_by(IntlPrice.month.desc())
        .limit(1)
    )
    return result.scalars().first()


async def prices_since(
    session: AsyncSession, since: date, series_id: str | None = None
) -> list[IntlPrice]:
    """Months from `since` on, per series in month order."""
    query = select(IntlPrice).where(IntlPrice.month >= since)
    if series_id is not None:
        query = query.where(IntlPrice.series_id == series_id)
    result = await session.execute(query.order_by(IntlPrice.series_id, IntlPrice.month))
    return list(result.scalars().all())


# ---------- exchange rates ----------


async def upsert_rates(
    session: AsyncSession, rates: Mapping[str, float], rate_date: date, fetched_at: datetime
) -> None:
    """Latest rate per currency; a currency missing from a later answer keeps its older rate
    and date, which the page then shows."""
    if not rates:
        return
    stmt = insert(FxRate).values(
        [
            {"currency": c, "per_usd": v, "rate_date": rate_date, "fetched_at": fetched_at}
            for c, v in sorted(rates.items())
        ]
    )
    keep = {c: stmt.excluded[c] for c in ("per_usd", "rate_date", "fetched_at")}
    await session.execute(stmt.on_conflict_do_update(index_elements=["currency"], set_=keep))


async def get_rate(session: AsyncSession, currency: str) -> FxRate | None:
    return await session.get(FxRate, currency)


async def get_rates(session: AsyncSession, currencies: Sequence[str]) -> dict[str, FxRate]:
    """The stored rate of each currency that has one."""
    result = await session.execute(select(FxRate).where(FxRate.currency.in_(currencies)))
    return {r.currency: r for r in result.scalars().all()}


async def has_rates(session: AsyncSession) -> bool:
    return bool(await session.scalar(select(exists().where(FxRate.per_usd > 0))))


# ---------- download state ----------


async def get_source(session: AsyncSession, source_id: str) -> IntlSource | None:
    return await session.get(IntlSource, source_id)


async def save_source(session: AsyncSession, row: Row) -> None:
    stmt = insert(IntlSource).values(row)
    keep = {k: stmt.excluded[k] for k in row if k != "id"}
    await session.execute(stmt.on_conflict_do_update(index_elements=["id"], set_=keep))


async def mark_checked(session: AsyncSession, source_id: str, checked_at: datetime) -> None:
    """A check that found nothing new (HTTP 304)."""
    await session.execute(
        update(IntlSource).where(IntlSource.id == source_id).values(checked_at=checked_at)
    )
