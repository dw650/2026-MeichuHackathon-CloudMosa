"""News job entry point (docs/06 §1.6). The worker runs it at 00:00 local time of each country
and once at start-up (only for countries whose news is missing or older than a day); run it by
hand with

    docker compose exec worker python -m app.news --once [--country TW]
"""

import argparse
import asyncio
from collections.abc import Callable, Sequence
from datetime import UTC, datetime

from app.config import Settings, get_settings
from app.db.session import create_engine, create_sessionmaker
from app.ingest.news.job import NewsOptions, run_news
from app.ingest.news.pipeline import NewsRunSummary
from app.middleware import configure_logging

# One news run at a time in a process (the start-up run and a midnight run may meet).
_lock = asyncio.Lock()


def _utc_now() -> datetime:
    return datetime.now(UTC)


def news_options(settings: Settings) -> NewsOptions:
    return NewsOptions(
        source=settings.news_source.strip().lower(),
        gemini_api_key=settings.gemini_api_key.strip(),
        gemini_model=settings.gemini_model.strip(),
        summary_api_base=settings.summary_api_base.strip(),
        summary_model=settings.summary_model.strip(),
        summary_api_key=settings.summary_api_key.strip(),
    )


async def run_news_once(
    settings: Settings,
    countries: Sequence[str] | None = None,
    *,
    startup: bool = False,
    clock: Callable[[], datetime] = _utc_now,
) -> list[NewsRunSummary]:
    async with _lock:
        engine = create_engine(settings)
        try:
            return await run_news(
                create_sessionmaker(engine),
                news_options(settings),
                countries=countries,
                startup=startup,
                clock=clock,
            )
        finally:
            await engine.dispose()


def describe(run: NewsRunSummary) -> str:
    text = (
        f"{run.country} {run.source}: {run.status}, {run.items_new} new of {run.items_in} on"
        f" topic, {run.articles} articles read, {run.model_calls} model calls,"
        f" {run.summaries} summaries"
    )
    return f"{text} ({run.error})" if run.error else text


async def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="run once now and exit")
    parser.add_argument(
        "--country", action="append", help="only this country (e.g. TW); repeat for more"
    )
    args = parser.parse_args(argv)
    if not args.once:
        parser.error("the worker schedules the daily runs; use --once for a run by hand")
    settings = get_settings()
    configure_logging(settings.log_level)
    countries = [c.upper() for c in args.country] if args.country else None
    runs = await run_news_once(settings, countries)
    if not runs:
        print(f"news: nothing ran (NEWS_SOURCE={settings.news_source!r})")
    for run in runs:
        print(describe(run))


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(main())
