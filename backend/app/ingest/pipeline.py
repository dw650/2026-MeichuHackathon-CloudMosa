"""fetch → normalize → validate → upsert quotes → aggregate → record the run (docs/04 §5.2)."""

import logging
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.ingest.normalize import normalize_all
from app.ingest.providers.base import PriceProvider
from app.ingest.validate import MAX_AGE_DAYS, validate
from app.repositories import ingest as repo

logger = logging.getLogger("app.ingest.pipeline")


@dataclass(frozen=True)
class RunSummary:
    source: str
    status: str
    rows_in: int = 0
    rows_ok: int = 0
    rows_dropped: int = 0
    error: str | None = None


def _window(today: dict[str, date]) -> list[date]:
    """Every trade date any covered country can still accept (today back 59 days)."""
    first = min(today.values()) - timedelta(days=MAX_AGE_DAYS - 1)
    last = max(today.values())
    return [first + timedelta(days=i) for i in range((last - first).days + 1)]


async def run_provider(
    session: AsyncSession,
    provider: PriceProvider,
    today: dict[str, date],
    now: datetime | None = None,
    clock: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> RunSummary:
    """Runs one provider. A failure is recorded and the previous data stays untouched."""
    started = now or clock()
    run_id = await repo.start_run(session, provider.source, started)
    await session.commit()
    try:
        rows = []
        for day in _window({c: today[c] for c in provider.countries}):
            rows += await provider.fetch(day)
        fetched_at = now or clock()
        maps = await repo.load_source_maps(session, provider.source)
        quotes, dropped = normalize_all(provider, rows, maps)
        result = validate(quotes, today)
        reasons = Counter(dropped) + Counter(result.dropped)
        if result.duplicates:
            reasons["duplicate"] += result.duplicates
        await repo.upsert_quotes(session, result.kept, run_id, fetched_at)
        affected: dict[str, set[date]] = {}
        for q in result.kept:
            affected.setdefault(q.country, set()).add(q.trade_date)
        for country, dates in affected.items():
            await repo.aggregate(session, country, sorted(dates))
        summary = RunSummary(
            source=provider.source,
            status="ok",
            rows_in=len(rows),
            rows_ok=len(result.kept),
            rows_dropped=sum(reasons.values()),
        )
        await repo.finish_run(
            session,
            run_id,
            status="ok",
            finished_at=now or clock(),
            rows_in=summary.rows_in,
            rows_ok=summary.rows_ok,
            rows_dropped=summary.rows_dropped,
            drop_reasons=dict(reasons),
        )
        await session.commit()
    except Exception as exc:
        await session.rollback()
        logger.exception("ingest run %s (%s) failed", run_id, provider.source)
        await repo.finish_run(
            session, run_id, status="failed", finished_at=now or clock(), error=str(exc)[:1000]
        )
        await session.commit()
        return RunSummary(source=provider.source, status="failed", error=str(exc))
    logger.info(
        "ingest %s: %d rows in, %d ok, %d dropped %s",
        provider.source,
        summary.rows_in,
        summary.rows_ok,
        summary.rows_dropped,
        dict(reasons),
    )
    return summary
