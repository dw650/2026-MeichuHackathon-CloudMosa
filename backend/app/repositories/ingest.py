"""Writes of the ingest pipeline: runs, quotes and the two aggregate tables."""

from collections.abc import Sequence
from datetime import date, datetime
from typing import Any

import psycopg
from sqlalchemy import select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import IngestRun, Market, SourceAreaMap, SourceCropMap, SourceMarketMap
from app.ingest.derive import Derivation
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


async def last_success(session: AsyncSession, source: str) -> tuple[datetime, str | None] | None:
    """(finished_at, maps_hash) of the source's latest successful run."""
    row = (
        await session.execute(
            select(IngestRun.finished_at, IngestRun.maps_hash)
            .where(
                IngestRun.source == source,
                IngestRun.status == "ok",
                IngestRun.finished_at.is_not(None),
            )
            .order_by(IngestRun.id.desc())
            .limit(1)
        )
    ).first()
    if row is None or row[0] is None:
        return None
    return row[0], row[1]


async def run_files(
    session: AsyncSession, source: str, maps_hash: str | None, limit: int = 200
) -> dict[str, dict[str, str]]:
    """Validators of the files the source's successful runs downloaded with these name maps,
    by URL; the latest run wins."""
    rows = await session.execute(
        select(IngestRun.files)
        .where(
            IngestRun.source == source,
            IngestRun.status == "ok",
            IngestRun.maps_hash == maps_hash,
            text("files <> '{}'::jsonb"),
        )
        .order_by(IngestRun.id.desc())
        .limit(limit)
    )
    merged: dict[str, dict[str, str]] = {}
    for files in rows.scalars().all():
        for url, validators in files.items():
            merged.setdefault(url, validators)
    return merged


async def covered_days(
    session: AsyncSession, source: str, countries: Sequence[str], first: date, last: date
) -> set[date]:
    """Trade dates between `first` and `last` the source has at least one quote for."""
    result = await session.execute(
        text(
            "SELECT DISTINCT trade_date FROM quotes WHERE source = :source"
            " AND country = ANY(CAST(:countries AS varchar[]))"
            " AND trade_date BETWEEN :first AND :last"
        ),
        {"source": source, "countries": list(countries), "first": first, "last": last},
    )
    return set(result.scalars().all())


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

# Wholesale: median of the markets that reported that day (after the estimated market rows,
# if any, so they count like the real ones).
_AREA_WHOLESALE = text(
    """
    INSERT INTO area_daily (area_id, crop_id, price_type, trade_date, country, price,
                            n_markets, min_market, max_market, volume_kg, fetched_at)
    SELECT area_id, crop_id, 'wholesale', trade_date, country,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY rep_price),
           count(*), min(rep_price), max(rep_price), sum(volume_kg), max(fetched_at)
    FROM market_daily
    WHERE country = :country AND trade_date = ANY(:dates)
    GROUP BY area_id, crop_id, trade_date, country
    """
)

# Retail: the area's survey price (the median when the source surveys several points).
_AREA_RETAIL = text(
    """
    INSERT INTO area_daily (area_id, crop_id, price_type, trade_date, country, price,
                            n_markets, min_market, max_market, volume_kg, fetched_at)
    SELECT area_id, crop_id, 'retail', trade_date, country,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY rep_price),
           0, NULL, NULL, NULL, max(fetched_at)
    FROM quotes
    WHERE price_type = 'retail' AND country = :country AND trade_date = ANY(:dates)
    GROUP BY area_id, crop_id, trade_date, country
    """
)

# ---------- estimated prices (docs/06 §3.6) ----------
#
# Only ever written for a price type the country's source does not report, and never over a
# row that source produced (the NOT EXISTS guards). Ratios and market factors are worked out
# in app.ingest.derive and arrive as parallel arrays.

# Wholesale from retail (Malaysia): one market row per market of the area, from the area's
# retail price. No volume and no day range: neither is estimated, both stay missing.
_ESTIMATED_MARKETS = text(
    """
    INSERT INTO market_daily (market_id, crop_id, trade_date, country, area_id,
                              rep_price, low_price, high_price, volume_kg, fetched_at)
    SELECT m.market_id, a.crop_id, a.trade_date, a.country, a.area_id,
           a.price * m.factor / r.ratio, NULL, NULL, NULL, a.fetched_at
    FROM area_daily a
    JOIN unnest(CAST(:crop_ids AS varchar[]), CAST(:ratios AS float8[]))
         AS r(crop_id, ratio) ON r.crop_id = a.crop_id
    JOIN unnest(CAST(:market_ids AS varchar[]), CAST(:market_areas AS varchar[]),
                CAST(:factors AS float8[]))
         AS m(market_id, area_id, factor) ON m.area_id = a.area_id
    WHERE a.country = :country AND a.trade_date = ANY(:dates) AND a.price_type = :from_type
      AND NOT EXISTS (
          SELECT 1 FROM market_daily d
          WHERE d.market_id = m.market_id AND d.crop_id = a.crop_id
            AND d.trade_date = a.trade_date
      )
    """
)

# Retail from wholesale (Taiwan, India): retail has no market rows, so the area's wholesale
# price is multiplied straight through. Areas and crops with no retail trade at all keep
# showing "—" with their reason rather than an invented price.
_ESTIMATED_AREA_RETAIL = text(
    """
    INSERT INTO area_daily (area_id, crop_id, price_type, trade_date, country, price,
                            n_markets, min_market, max_market, volume_kg, fetched_at)
    SELECT a.area_id, a.crop_id, 'retail', a.trade_date, a.country,
           a.price * r.ratio, 0, NULL, NULL, NULL, a.fetched_at
    FROM area_daily a
    JOIN areas ar ON ar.id = a.area_id
    JOIN crops c ON c.country = a.country AND c.id = a.crop_id
    JOIN unnest(CAST(:crop_ids AS varchar[]), CAST(:ratios AS float8[]))
         AS r(crop_id, ratio) ON r.crop_id = a.crop_id
    WHERE a.country = :country AND a.trade_date = ANY(:dates) AND a.price_type = :from_type
      AND ar.has_retail AND c.has_retail
      AND NOT EXISTS (
          SELECT 1 FROM area_daily d
          WHERE d.area_id = a.area_id AND d.crop_id = a.crop_id
            AND d.price_type = 'retail' AND d.trade_date = a.trade_date
      )
    """
)


async def _estimate_params(
    session: AsyncSession, country: str, estimate: Derivation
) -> dict[str, Any]:
    """The country's crops and markets with the ratio and market factor of each, as the
    arrays the two estimate statements join against."""
    crops = (
        await session.execute(
            text("SELECT id, category FROM crops WHERE country = :country"), {"country": country}
        )
    ).all()
    markets = (
        await session.execute(
            text(
                "SELECT m.id, m.area_id FROM markets m JOIN areas a ON a.id = m.area_id"
                " WHERE a.country = :country ORDER BY m.area_id, m.id"
            ),
            {"country": country},
        )
    ).all()
    by_area: dict[str, list[str]] = {}
    for market_id, area_id in markets:
        by_area.setdefault(area_id, []).append(market_id)
    factors = {m: f for ids in by_area.values() for m, f in estimate.market_factors(ids).items()}
    return {
        "crop_ids": [crop_id for crop_id, _ in crops],
        "ratios": [estimate.ratio(crop_id, category) for crop_id, category in crops],
        "market_ids": [market_id for market_id, _ in markets],
        "market_areas": [area_id for _, area_id in markets],
        "factors": [factors[market_id] for market_id, _ in markets],
        "from_type": estimate.from_type,
    }


async def aggregate(
    session: AsyncSession,
    country: str,
    dates: Sequence[date],
    estimate: Derivation | None = None,
) -> None:
    """Recomputes market_daily and area_daily for the affected dates of one country. With an
    `estimate`, the price type the country's source does not report is worked out from the one
    it does (docs/06 §3.6), after the real rows and never over them."""
    params: dict[str, Any] = {"country": country, "dates": list(dates)}
    await session.execute(
        text("DELETE FROM area_daily WHERE country = :country AND trade_date = ANY(:dates)"),
        params,
    )
    await session.execute(
        text("DELETE FROM market_daily WHERE country = :country AND trade_date = ANY(:dates)"),
        params,
    )
    await session.execute(_MARKET_DAILY, params)
    await session.execute(_AREA_RETAIL, params)
    estimated = await _estimate_params(session, country, estimate) if estimate else {}
    if estimate and estimate.to_type == "wholesale":
        await session.execute(_ESTIMATED_MARKETS, params | estimated)
    await session.execute(_AREA_WHOLESALE, params)
    if estimate and estimate.to_type == "retail":
        await session.execute(_ESTIMATED_AREA_RETAIL, params | estimated)
