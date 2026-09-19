"""News items and news runs (docs/04 §7): writes of the news job, reads of the news API."""

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import NewsItem, NewsRun

# ---------- runs ----------


async def start_run(session: AsyncSession, country: str, source: str, started_at: datetime) -> int:
    result = await session.execute(
        insert(NewsRun)
        .values(country=country, source=source, started_at=started_at, status="running")
        .returning(NewsRun.id)
    )
    return int(result.scalar_one())


async def finish_run(session: AsyncSession, run_id: int, **fields: Any) -> None:
    await session.execute(update(NewsRun).where(NewsRun.id == run_id).values(**fields))


async def last_success(session: AsyncSession, country: str, source: str) -> datetime | None:
    """Start of the latest successful run of a country from a source."""
    result = await session.execute(
        select(func.max(NewsRun.started_at)).where(
            NewsRun.country == country, NewsRun.source == source, NewsRun.status == "ok"
        )
    )
    return result.scalar_one()


async def usage_since(session: AsyncSession, since: datetime) -> tuple[int, int]:
    """(articles read, model calls) of every run started since `since`, all countries."""
    result = await session.execute(
        select(
            func.coalesce(func.sum(NewsRun.articles), 0),
            func.coalesce(func.sum(NewsRun.model_calls), 0),
        ).where(NewsRun.started_at >= since)
    )
    articles, calls = result.one()
    return int(articles), int(calls)


async def last_fetch(session: AsyncSession, country: str) -> datetime | None:
    """End of the latest successful run of a country (the list's data time)."""
    result = await session.execute(
        select(func.max(NewsRun.finished_at)).where(
            NewsRun.country == country, NewsRun.status == "ok"
        )
    )
    return result.scalar_one()


# ---------- items: writes ----------


async def known_keys(session: AsyncSession, country: str) -> tuple[set[str], set[str]]:
    """(guids, title keys) already stored for a country."""
    result = await session.execute(
        select(NewsItem.guid, NewsItem.title_key).where(NewsItem.country == country)
    )
    rows = result.tuples().all()
    return {g for g, _ in rows}, {k for _, k in rows}


async def insert_items(session: AsyncSession, rows: Sequence[dict[str, Any]]) -> int:
    """Adds new items; duplicates (same guid or title) are skipped. Returns how many were added."""
    if not rows:
        return 0
    result = await session.execute(
        insert(NewsItem).values(list(rows)).on_conflict_do_nothing().returning(NewsItem.id)
    )
    return len(result.all())


async def pending_summaries(
    session: AsyncSession, country: str, since: datetime, max_tries: int, limit: int
) -> list[NewsItem]:
    """Items without a summary, tried fewer than `max_tries` times: those mentioning an area,
    then a crop, then the newest first."""
    result = await session.execute(
        select(NewsItem)
        .where(
            NewsItem.country == country,
            NewsItem.summary.is_(None),
            NewsItem.summary_tries < max_tries,
            NewsItem.published_at >= since,
        )
        .order_by(
            (func.cardinality(NewsItem.area_ids) > 0).desc(),
            (func.cardinality(NewsItem.crop_ids) > 0).desc(),
            NewsItem.published_at.desc(),
            NewsItem.id.desc(),
        )
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_item(session: AsyncSession, item_id: int, **fields: Any) -> None:
    await session.execute(update(NewsItem).where(NewsItem.id == item_id).values(**fields))


async def delete_older_than(session: AsyncSession, country: str, before: datetime) -> int:
    result = await session.execute(
        delete(NewsItem)
        .where(NewsItem.country == country, NewsItem.published_at < before)
        .returning(NewsItem.id)
    )
    return len(result.all())


async def delete_other_sources(session: AsyncSession, country: str, source: str) -> int:
    """Removes a country's items from other sources (demo items never mix with real ones)."""
    result = await session.execute(
        delete(NewsItem)
        .where(NewsItem.country == country, NewsItem.source != source)
        .returning(NewsItem.id)
    )
    return len(result.all())


async def count_items(session: AsyncSession, country: str, source: str) -> int:
    result = await session.execute(
        select(func.count())
        .select_from(NewsItem)
        .where(NewsItem.country == country, NewsItem.source == source)
    )
    return int(result.scalar_one())


# ---------- items: reads ----------


async def list_items(
    session: AsyncSession, country: str, area_id: str, since: datetime, limit: int
) -> list[NewsItem]:
    """A country's recent items: those mentioning the area first, then the newest first."""
    result = await session.execute(
        select(NewsItem)
        .where(NewsItem.country == country, NewsItem.published_at >= since)
        .order_by(
            NewsItem.area_ids.any(area_id).desc(),  # type: ignore[arg-type]
            NewsItem.published_at.desc(),
            NewsItem.id.desc(),
        )
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_item(session: AsyncSession, item_id: int) -> NewsItem | None:
    return await session.get(NewsItem, item_id)
