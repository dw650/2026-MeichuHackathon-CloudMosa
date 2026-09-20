"""One news run of one country (docs/06 §1.6):

search → keep on-topic headlines of the last 7 days → drop duplicates (guid or title) → tag
crops and areas → store → summarise the items the list will show, newest first, within the
day's budget (read the article, then ask the models) → delete items older than 7 days →
record the run.

A failed search keeps the stored items; a failed article or model only leaves that item
title-only. Every run is recorded with what it spent (articles read, model calls), which the
next runs count against the daily budgets."""

import logging
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import NEWS_KEEP_DAYS, NEWS_LIST_ITEMS
from app.ingest.news.base import NewsSource, RawNews, UpstreamError
from app.ingest.news.config import CountryNews
from app.ingest.news.match import Matcher, crop_terms, title_key
from app.ingest.news.reader import Reader
from app.ingest.news.summarize import CropChoice, Summaries, SummaryRequest
from app.repositories import catalog as catalog_repo
from app.repositories import news as repo
from app.timeutil import country_tz

FIRST_WINDOW_DAYS = 7  # a country's first run fills the whole list
WINDOW_DAYS = 2  # later runs overlap a day, so a late or failed day is caught up
MAX_TRIES = 2  # an item is offered to the summariser at most twice
FUTURE_SLACK = timedelta(hours=1)

logger = logging.getLogger("app.ingest.news")


@dataclass
class NewsRunSummary:
    country: str
    source: str
    status: str = "ok"
    items_in: int = 0
    items_new: int = 0
    requests: int = 0
    articles: int = 0
    model_calls: int = 0
    summaries: int = 0
    error: str | None = None


@dataclass(frozen=True)
class CountryCatalog:
    utc_offset_min: int
    crops: list[tuple[str, dict[str, str]]]
    areas: list[tuple[str, dict[str, str]]]


@dataclass
class Budget:
    """What one country's run may spend."""

    articles: int
    used: int = field(default=0)

    @property
    def left(self) -> int:
        return max(0, self.articles - self.used)


async def load_catalog(session: AsyncSession, country: str) -> CountryCatalog | None:
    row = await catalog_repo.get_country(session, country)
    if row is None:
        return None
    crops = await catalog_repo.get_crops(session, country)
    areas = await catalog_repo.get_areas(session, country)
    return CountryCatalog(
        utc_offset_min=row.utc_offset_min,
        crops=[(c.id, dict(c.name)) for c in crops],
        areas=[(a.id, dict(a.name)) for a in areas],
    )


def matcher_for(catalog: CountryCatalog, config: CountryNews) -> Matcher:
    return Matcher.build(
        crops=catalog.crops,
        areas=catalog.areas,
        crop_aliases=config.crop_aliases,
        area_aliases=config.area_aliases,
        keywords=config.keywords,
        topics=config.topics,
        price_words=config.price_words,
        exclude=config.exclude,
        exclude_sources=config.exclude_sources,
        confusable=config.confusable,
    )


def crop_choices(catalog: CountryCatalog, config: CountryNews) -> tuple[CropChoice, ...]:
    terms = crop_terms(catalog.crops, config.crop_aliases)
    return tuple(CropChoice(cid, tuple(names)) for cid, names in terms.items())


def _merge(*groups: Iterable[str]) -> list[str]:
    """Crop ids of several sources, in order, without repeats."""
    return list(dict.fromkeys(cid for group in groups for cid in group))


def new_rows(
    raw: list[RawNews],
    *,
    country: str,
    source: str,
    matcher: Matcher,
    crop_ids: set[str],
    known: tuple[set[str], set[str]],
    now: datetime,
) -> tuple[int, list[dict[str, object]]]:
    """(on-topic items in the answer, rows to add): recent, from a publisher we keep, on topic,
    not stored yet, and not repeated within the answer (same guid or same title).

    Only what comes in is filtered; stored items are never removed by these rules."""
    oldest = now - timedelta(days=NEWS_KEEP_DAYS)
    guids, keys = set(known[0]), set(known[1])
    on_topic = 0
    rows: list[dict[str, object]] = []
    for item in raw:
        if not (oldest <= item.published_at <= now + FUTURE_SLACK) or not item.title:
            continue
        if matcher.blocked_source(item.source_name, item.source_domain):
            continue
        if not matcher.relevant(item.title):
            continue
        on_topic += 1
        key = title_key(item.title)
        if not key or item.guid in guids or key in keys:
            continue
        guids.add(item.guid)
        keys.add(key)
        text = f"{item.title} {item.summary or ''}"
        rows.append(
            {
                "country": country,
                "source": source,
                "guid": item.guid[:400],
                "title": item.title,
                "title_key": key,
                "lang": item.lang,
                "source_name": item.source_name[:120],
                "source_domain": (item.source_domain or "")[:120] or None,
                "url": item.url,
                "published_at": item.published_at,
                "summary": item.summary,
                "summary_lang": item.summary_lang if item.summary else None,
                "summary_model": source if item.summary else None,
                "crop_ids": _merge(
                    matcher.crop_ids(item.title), [c for c in item.crop_ids if c in crop_ids]
                ),
                "area_ids": matcher.area_ids(text),
                "fetched_at": now,
            }
        )
    return on_topic, rows


async def summarize_pending(
    session: AsyncSession,
    *,
    country: str,
    config: CountryNews,
    catalog: CountryCatalog,
    matcher: Matcher,
    reader: Reader,
    summaries: Summaries,
    budget: Budget,
    now: datetime,
    run: NewsRunSummary,
) -> None:
    """Summarises the items the list will show, newest first, while the budget lasts.

    The candidates are exactly the items the API returns (`repo.list_items`, the same order and
    limit), so the budget goes to what people see; items stored by an earlier run that still
    have no summary are in there too, until the retry cap. Anything below the list waits for
    its turn (docs/06 §1.6).

    The crop tags of an item that gets a summary come from the model alone: it read the article
    and its ids are limited to the country's crop list, while the keyword matcher cannot tell
    that 「不是香蕉苒果」 is not about bananas. When the article cannot be read there is no
    summary, and the model is asked for the crops of the headline alone instead."""
    calls_before = summaries.calls
    choices = crop_choices(catalog, config)
    known_crops = {c.id for c in choices}
    tz = country_tz(catalog.utc_offset_min)
    since = now - timedelta(days=NEWS_KEEP_DAYS)
    listed = await repo.list_items(session, country, since, NEWS_LIST_ITEMS)
    items = [i for i in listed if i.summary is None and i.summary_tries < MAX_TRIES]
    try:
        for item in items:
            read = budget.left > 0 and not reader.google_refused
            # A tag-only call is worth a model call only when this run cannot read the article
            # at all; when the page budget is merely spent the item waits for the next run,
            # which may still get it a real summary.
            tag_only = reader.google_refused and summaries.tags_crops
            if not summaries.available or not (read or summaries.reads_headlines or tag_only):
                break  # nothing more this run can do; the items keep their chances
            url, text = None, None
            if read:
                budget.used += 1
                article = await reader.read(item.url, item.lang)
                url, text = article.url, article.text
            fields: dict[str, object] = {"summary_tries": item.summary_tries + 1}
            if url:
                fields["url"] = url
            ask = SummaryRequest(
                title=item.title,
                source=item.source_name,
                published=item.published_at.astimezone(tz).date(),
                lang=config.summary_lang,
                crops=choices,
                text=text,
                # No article text and no model that can find one: ask for the crops only.
                tags_only=text is None and not summaries.reads_headlines,
            )
            # No model that fits this request answers at all, and none is charged for.
            result = await summaries.summarize(ask)
            if result is not None:
                crops = [c for c in result.crop_ids if c in known_crops]
                if ask.tags_only:
                    # A tag-only answer has no summary, and none is ever made up.
                    fields["crop_ids"] = crops
                elif result.text:
                    run.summaries += 1
                    fields |= {
                        "summary": result.text,
                        "summary_lang": config.summary_lang,
                        "summary_model": result.model[:80],
                        "crop_ids": crops,
                        "area_ids": matcher.area_ids(f"{item.title} {result.text}"),
                    }
            await repo.update_item(session, item.id, **fields)
            await session.commit()
    finally:
        run.articles += budget.used
        run.model_calls += summaries.calls - calls_before


def _utc_now() -> datetime:
    return datetime.now(UTC)


async def run_country(
    session: AsyncSession,
    country: str,
    config: CountryNews,
    source: NewsSource,
    *,
    reader: Reader | None = None,
    summaries: Summaries | None = None,
    articles: int = 0,
    clock: Callable[[], datetime] = _utc_now,
) -> NewsRunSummary:
    """One run for one country. `reader` and `summaries` are left out when no model is set up
    (items stay title-only and no article is read); `articles` caps the pages read. A failure
    is recorded and the stored items stay as they were."""
    now = clock()
    run = NewsRunSummary(country=country, source=source.id)
    run_id = await repo.start_run(session, country, source.id, now)
    await session.commit()
    requests_before = source.requests
    reader_before = reader.requests if reader else 0
    try:
        catalog = await load_catalog(session, country)
        if catalog is None:
            raise UpstreamError(f"country {country} is not in the catalog")
        matcher = matcher_for(catalog, config)
        stored = await repo.count_items(session, country, source.id)
        days = WINDOW_DAYS if stored else FIRST_WINDOW_DAYS
        raw = await source.fetch(country, config, days)
        run.items_in, rows = new_rows(
            raw,
            country=country,
            source=source.id,
            matcher=matcher,
            crop_ids={cid for cid, _ in catalog.crops},
            known=await repo.known_keys(session, country),
            now=now,
        )
        run.items_new = await repo.insert_items(session, rows)
        await session.commit()
        if reader is not None and summaries is not None:
            await summarize_pending(
                session,
                country=country,
                config=config,
                catalog=catalog,
                matcher=matcher,
                reader=reader,
                summaries=summaries,
                budget=Budget(articles=articles),
                now=now,
                run=run,
            )
        await repo.delete_older_than(session, country, now - timedelta(days=NEWS_KEEP_DAYS))
        await session.commit()
    except Exception as exc:
        await session.rollback()
        run.status, run.error = "failed", f"{type(exc).__name__}: {exc}"[:2000]
        logger.exception("news %s: run failed", country)
    run.requests = (source.requests - requests_before) + (
        (reader.requests - reader_before) if reader else 0
    )
    await repo.finish_run(
        session,
        run_id,
        finished_at=clock(),
        status=run.status,
        items_in=run.items_in,
        items_new=run.items_new,
        requests=run.requests,
        articles=run.articles,
        model_calls=run.model_calls,
        summaries=run.summaries,
        error=run.error,
    )
    await session.commit()
    logger.info(
        "news %s: %s, %d on topic, %d new, %d articles, %d model calls, %d summaries",
        country,
        run.status,
        run.items_in,
        run.items_new,
        run.articles,
        run.model_calls,
        run.summaries,
    )
    return run
