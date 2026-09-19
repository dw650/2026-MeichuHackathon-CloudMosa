"""The news job over every country (docs/06 §1.4, §8): which countries run, the daily budgets,
and the start-up rule. The worker and the `python -m app.news` command call `run_news`.

Budgets (rolling 24 hours, all countries together): at most DAILY_ARTICLES pages read and
DAILY_MODEL_CALLS model calls; one country's run gets at most its share (the daily amount
divided by the number of countries), so one country cannot use up the day."""

import asyncio
import logging
import math
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.ingest.news.base import Monotonic, NewsSource, Sleep
from app.ingest.news.config import NewsConfig, load_news_config
from app.ingest.news.demo import DemoNewsSource
from app.ingest.news.pipeline import NewsRunSummary, run_country
from app.ingest.news.reader import ArticleReader
from app.ingest.news.rss import GoogleNewsSource
from app.ingest.news.summarize import build_summaries
from app.repositories import catalog as catalog_repo
from app.repositories import news as repo

NEWS_SOURCES = ("google", "demo")
DAILY_ARTICLES = 30
DAILY_MODEL_CALLS = 30
FRESH_FOR = timedelta(days=1)  # start-up runs skip countries fetched more recently

logger = logging.getLogger("app.ingest.news")


def _utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True)
class NewsOptions:
    """`source`: google (Google News), demo (fixed items) or off. The rest sets up the
    summarisers; empty means not used."""

    source: str = "google"
    gemini_api_key: str = ""
    gemini_model: str = ""
    summary_api_base: str = ""
    summary_model: str = ""
    summary_api_key: str = ""


def allowance(daily: int, used: int, countries: int) -> int:
    """What one country's run may spend: its share of the day, within what is left."""
    share = math.ceil(daily / max(1, countries))
    return max(0, min(share, daily - used))


async def _countries(maker: async_sessionmaker[AsyncSession], config: NewsConfig) -> list[str]:
    """Countries both configured and seeded, in the configuration's order."""
    async with maker() as session:
        seeded = {c.code for c in await catalog_repo.get_countries(session)}
    return [cc for cc in config.countries if cc in seeded]


async def run_news(
    maker: async_sessionmaker[AsyncSession],
    options: NewsOptions,
    *,
    countries: Sequence[str] | None = None,
    startup: bool = False,
    config: NewsConfig | None = None,
    clock: Callable[[], datetime] = _utc_now,
    transport: httpx.AsyncBaseTransport | None = None,
    sleep: Sleep = asyncio.sleep,
    monotonic: Monotonic = time.monotonic,
) -> list[NewsRunSummary]:
    """One run per country (all, or the ones asked for). At start-up a country is skipped when
    it has news from this source and its last successful run is less than a day old, so
    redeploys do not fetch again. Items of another source (demo ⇄ google) are removed first."""
    if options.source not in NEWS_SOURCES:
        logger.info("news: NEWS_SOURCE=%r, nothing to do", options.source)
        return []
    config = config or load_news_config()
    everywhere = await _countries(maker, config)
    targets = [cc for cc in everywhere if not countries or cc in countries]
    for cc in sorted(set(countries or ()) - set(targets)):
        logger.warning("news: %s is not both configured and seeded; skipped", cc)
    source: NewsSource
    if options.source == "google":
        source = GoogleNewsSource(transport=transport, sleep=sleep, clock=monotonic)
    else:
        source = DemoNewsSource(clock)
    results: list[NewsRunSummary] = []
    for cc in targets:
        async with maker() as session:
            removed = await repo.delete_other_sources(session, cc, source.id)
            await session.commit()
            if removed:
                logger.info("news %s: removed %d items of other sources", cc, removed)
            if startup:
                last = await repo.last_success(session, cc, source.id)
                fresh = last is not None and clock() - last < FRESH_FOR
                if fresh and await repo.count_items(session, cc, source.id) > 0:
                    logger.info("news %s: fetched at %s, not again at start-up", cc, last)
                    continue
            reader = None
            summaries = None
            articles = 0
            if source.id == "google":
                used_articles, used_calls = await repo.usage_since(session, clock() - FRESH_FOR)
                articles = allowance(DAILY_ARTICLES, used_articles, len(everywhere))
                summaries = build_summaries(
                    gemini_api_key=options.gemini_api_key,
                    gemini_model=options.gemini_model,
                    summary_api_base=options.summary_api_base,
                    summary_model=options.summary_model,
                    summary_api_key=options.summary_api_key,
                    calls=allowance(DAILY_MODEL_CALLS, used_calls, len(everywhere)),
                    transport=transport,
                    sleep=sleep,
                    clock=monotonic,
                )
                if summaries is not None:
                    reader = ArticleReader(transport=transport, sleep=sleep, clock=monotonic)
            try:
                results.append(
                    await run_country(
                        session,
                        cc,
                        config.countries[cc],
                        source,
                        reader=reader,
                        summaries=summaries,
                        articles=articles,
                        clock=clock,
                    )
                )
            finally:
                if reader is not None:
                    await reader.aclose()
    return results
