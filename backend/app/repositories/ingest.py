"""Writes of the ingest pipeline: runs, quotes and the two aggregate tables."""

from collections.abc import Sequence
from datetime import date, datetime
from typing import Any

import psycopg
from sqlalchemy import select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import IngestRun, Market, SourceAreaMap, SourceCropMap, SourceMarketMap
from app.ingest.providers.base import NormalizedQuote, SourceMaps


async def start_run(session: AsyncSession, source: str, started_at: datetime) -> int:
    result = await session.execute(
        insert(IngestRun)
        .values(source=source, started_at=started_at, status="running")
        .returning(IngestRun.id)
    )
    return int(result.scalar_one())


async def finish_run(session: AsyncSession, run_id: int, **fields: Any) -> None:
    await session.execute(update(IngestRun).where(IngestRun.id == run_id).values(**fields))


async def load_source_maps(session: AsyncSession, source: str) -> SourceMaps:
    crops = await session.execute(
        select(
            SourceCropMap.country,
            SourceCropMap.source_name,
            SourceCropMap.source_variety,
            SourceCropMap.crop_id,
        ).where(SourceCropMap.source == source)
    )
    markets = await session.execute(
        select(
            SourceMarketMap.country, SourceMarketMap.source_market, SourceMarketMap.market_id
        ).where(SourceMarketMap.source == source)
    )
    areas = await session.execute(
        select(SourceAreaMap.country, SourceAreaMap.source_area, SourceAreaMap.area_id).where(
            SourceAreaMap.source == source
        )
    )
    market_area = await session.execute(select(Market.id, Market.area_id))
    return SourceMaps(
        crops={(c, n, v): crop for c, n, v, crop in crops.all()},
        markets={(c, n): m for c, n, m in markets.all()},
        areas={(c, n): a for c, n, a in areas.all()},
        market_area=dict(market_area.tuples().all()),
    )


_QUOTE_COLUMNS = (
    "source, country, price_type, market_id, area_id, crop_id, variety, trade_date,"
    " rep_price, low_price, high_price, volume_kg, run_id, fetched_at"
)


async def upsert_quotes(
    session: AsyncSession, quotes: Sequence[NormalizedQuote], run_id: int, fetched_at: datetime
) -> None:
    """Insert or overwrite by the source key (a later fetch replaces an earlier one).

    Rows are streamed with COPY into a session-local staging table, then merged with one
    INSERT … ON CONFLICT; this is about ten times faster than batched INSERTs."""
    if not quotes:
        return
    connection = await session.connection()
    raw = await connection.get_raw_connection()
    driver: psycopg.AsyncConnection[Any] = raw.driver_connection  # type: ignore[assignment]
    async with driver.cursor() as cur:
        await cur.execute(
            "CREATE TEMP TABLE IF NOT EXISTS quotes_stage"
            " (LIKE quotes INCLUDING DEFAULTS) ON COMMIT DELETE ROWS"
        )
        await cur.execute("TRUNCATE quotes_stage")
        async with cur.copy(f"COPY quotes_stage ({_QUOTE_COLUMNS}) FROM STDIN") as copy:
            for q in quotes:
                await copy.write_row(
                    (
                        q.source,
                        q.country,
                        q.price_type,
                        q.market_id,
                        q.area_id,
                        q.crop_id,
                        q.variety,
                        q.trade_date,
                        q.rep_price,
                        q.low_price,
                        q.high_price,
                        q.volume_kg,
                        run_id,
                        fetched_at,
                    )
                )
        await cur.execute(
            f"INSERT INTO quotes ({_QUOTE_COLUMNS})"
            f" SELECT {_QUOTE_COLUMNS} FROM quotes_stage"
            " ON CONFLICT ON CONSTRAINT uq_quotes_source_key DO UPDATE SET"
            " rep_price = EXCLUDED.rep_price, low_price = EXCLUDED.low_price,"
            " high_price = EXCLUDED.high_price, volume_kg = EXCLUDED.volume_kg,"
            " run_id = EXCLUDED.run_id, fetched_at = EXCLUDED.fetched_at"
        )


async def delete_quotes_except(
    session: AsyncSession, country: str, sources: Sequence[str]
) -> list[date]:
    """Deletes the country's quotes from every other source; returns the trade dates hit."""
    result = await session.execute(
        text(
            "WITH gone AS (DELETE FROM quotes WHERE country = :country"
            " AND NOT (source = ANY(CAST(:sources AS varchar[]))) RETURNING trade_date)"
            " SELECT DISTINCT trade_date FROM gone ORDER BY trade_date"
        ),
        {"country": country, "sources": list(sources)},
    )
    return list(result.scalars().all())


_MARKET_DAILY = text(
    """
    INSERT INTO market_daily (market_id, crop_id, trade_date, country, area_id,
                              rep_price, low_price, high_price, volume_kg, fetched_at)
    SELECT market_id, crop_id, trade_date, country, area_id,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY rep_price),
           percentile_cont(0.5) WITHIN GROUP (ORDER BY low_price),
           percentile_cont(0.5) WITHIN GROUP (ORDER BY high_price),
           sum(volume_kg), max(fetched_at)
    FROM quotes
    WHERE price_type = 'wholesale' AND country = :country AND trade_date = ANY(:dates)
    GROUP BY market_id, crop_id, trade_date, country, area_id
    """
)

# Wholesale: median of the markets that reported that day; retail: the area's survey price.
_AREA_DAILY = text(
    """
    INSERT INTO area_daily (area_id, crop_id, price_type, trade_date, country, price,
                            n_markets, min_market, max_market, volume_kg, fetched_at)
    SELECT area_id, crop_id, 'wholesale', trade_date, country,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY rep_price),
           count(*), min(rep_price), max(rep_price), sum(volume_kg), max(fetched_at)
    FROM market_daily
    WHERE country = :country AND trade_date = ANY(:dates)
    GROUP BY area_id, crop_id, trade_date, country
    UNION ALL
    SELECT area_id, crop_id, 'retail', trade_date, country,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY rep_price),
           0, NULL, NULL, NULL, max(fetched_at)
    FROM quotes
    WHERE price_type = 'retail' AND country = :country AND trade_date = ANY(:dates)
    GROUP BY area_id, crop_id, trade_date, country
    """
)


async def aggregate(session: AsyncSession, country: str, dates: Sequence[date]) -> None:
    """Recomputes market_daily and area_daily for the affected dates of one country."""
    params = {"country": country, "dates": list(dates)}
    await session.execute(
        text("DELETE FROM area_daily WHERE country = :country AND trade_date = ANY(:dates)"),
        params,
    )
    await session.execute(
        text("DELETE FROM market_daily WHERE country = :country AND trade_date = ANY(:dates)"),
        params,
    )
    await session.execute(_MARKET_DAILY, params)
    await session.execute(_AREA_DAILY, params)
