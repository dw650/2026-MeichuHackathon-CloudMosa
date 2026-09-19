"""News runs against the test database: storing, tagging, summarising within the budget,
pruning, failures and the start-up rule. Google, the publishers and Gemini are all scripted."""

import json
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.db.models import NewsItem, NewsRun
from app.db.session import create_engine, create_sessionmaker
from app.ingest.news import gnews
from app.ingest.news.base import RawNews, UpstreamError
from app.ingest.news.config import CountryNews, load_news_config
from app.ingest.news.job import NewsOptions, allowance, run_news
from app.ingest.news.pipeline import new_rows, run_country
from app.ingest.news.reader import Article
from app.ingest.news.rss import SEARCH_URL, parse_rss, to_raw
from app.ingest.news.summarize import (
    GEMINI_GROUNDED_MODEL,
    GEMINI_TEXT_MODEL,
    GEMINI_URL,
    Summaries,
    Summary,
    SummaryRequest,
)
from tests.news.helpers import FakeTime, Script, fixture_bytes, fixture_text

NOW = datetime(2026, 9, 19, 16, 30, tzinfo=UTC)  # 00:30 on 9/20 in Taiwan
CONFIG = load_news_config()
TW = CONFIG.countries["TW"]
TW_RAW = [
    raw for item in parse_rss(fixture_bytes("gnews_rss_TW.xml")) if (raw := to_raw(item, "zh-TW"))
]
PUBLISHER = "https://health.tvbs.com.tw/life/365962"


def clock() -> datetime:
    return NOW


class FakeSource:
    def __init__(self, items: Sequence[RawNews] | Exception, id: str = "google") -> None:
        self.items = items
        self.id = id
        self.requests = 0
        self.days: list[int] = []

    async def fetch(self, country: str, config: CountryNews, days: int) -> list[RawNews]:
        self.requests += 1
        self.days.append(days)
        if isinstance(self.items, Exception):
            raise self.items
        return list(self.items)


class FakeReader:
    def __init__(self, text: str | None = "西螺果菜市場到貨減少，菜價上漲。") -> None:
        self.text = text
        self.requests = 0
        self.google_refused = False
        self.links: list[str] = []

    async def read(self, link: str, lang: str) -> Article:
        self.requests += 2
        self.links.append(link)
        return Article(url=PUBLISHER, text=self.text)


class FakeModel:
    def __init__(self, name: str, *, grounded: bool = False, crops: tuple[str, ...] = ()) -> None:
        self.name = name
        self.grounded = grounded
        self.crops = crops
        self.requests: list[SummaryRequest] = []

    async def summarize(self, request: SummaryRequest) -> Summary | None:
        self.requests.append(request)
        return Summary(
            text=f"摘要{len(self.requests)}：台中菜價上漲三成，農業部增加供應。預計兩週內回穩。",
            crop_ids=self.crops,
            model=self.name,
        )


async def items(session: AsyncSession, country: str = "TW") -> list[NewsItem]:
    result = await session.execute(
        select(NewsItem).where(NewsItem.country == country).order_by(NewsItem.published_at.desc())
    )
    return list(result.scalars().all())


async def runs(session: AsyncSession) -> list[NewsRun]:
    result = await session.execute(select(NewsRun).order_by(NewsRun.id))
    return list(result.scalars().all())


# ---------- storing ----------


async def test_a_run_stores_on_topic_items_once_with_tags(seeded: AsyncSession) -> None:
    source = FakeSource([*TW_RAW, *TW_RAW])  # every item twice, as two searches would give
    run = await run_country(seeded, "TW", TW, source, clock=clock)
    assert run.status == "ok"
    stored = await items(seeded)
    titles = [i.title for i in stored]
    assert len(titles) == len(set(titles)) == run.items_new
    assert not any("自助餐" in t for t in titles)  # off topic: no keyword, no crop
    assert not any("竊賊" in t for t in titles)  # a topic word but no price word
    assert run.items_in == 2 * run.items_new
    assert source.days == [7]  # the first run fills a week
    theft = next(i for i in stored if i.title.startswith("母湯喔！菜價飆漲偷摘菜"))
    assert theft.area_ids == ["taichung"]
    assert (theft.source_name, theft.source_domain, theft.lang) == (
        "自由時報",
        "news.ltn.com.tw",
        "zh-TW",
    )
    assert theft.url.startswith("https://news.google.com/rss/articles/")
    assert theft.summary is None
    xiluo = next(i for i in stored if "西螺" in i.title)
    assert xiluo.area_ids == ["yunlin"]
    tpe = next(i for i in stored if "北農" in i.title)
    assert tpe.area_ids == ["taipei"]  # an alias: 北農 is Taipei's wholesale market
    [record] = await runs(seeded)
    assert (record.status, record.items_new, record.articles, record.model_calls) == (
        "ok",
        run.items_new,
        0,
        0,
    )
    assert record.finished_at == NOW


async def test_later_runs_use_the_short_window_and_skip_known_items(seeded: AsyncSession) -> None:
    await run_country(seeded, "TW", TW, FakeSource(TW_RAW), clock=clock)
    source = FakeSource(TW_RAW)
    run = await run_country(seeded, "TW", TW, source, clock=clock)
    assert source.days == [2]
    assert run.items_new == 0


def test_new_rows_filters_age_future_and_duplicate_titles() -> None:
    from app.ingest.news.match import Matcher

    matcher = Matcher.build(
        crops=[("cabbage", {"zh-TW": "甘藍", "en": "Cabbage"})],
        areas=[],
        crop_aliases={},
        area_aliases={},
        keywords=["菜價"],
    )
    base = RawNews(
        guid="g1",
        title="甘藍菜價回穩",
        url="https://x.test/1",
        published_at=NOW - timedelta(hours=1),
        source_name="S",
        source_domain=None,
        lang="zh-TW",
        crop_ids=("cabbage", "unknown"),
    )
    raw = [
        base,
        RawNews(**{**base.__dict__, "guid": "g2", "title": "甘藍菜價回穩！"}),  # same title
        RawNews(**{**base.__dict__, "guid": "g3", "published_at": NOW - timedelta(days=8)}),
        RawNews(**{**base.__dict__, "guid": "g4", "published_at": NOW + timedelta(hours=3)}),
        RawNews(**{**base.__dict__, "guid": "g5", "title": ""}),
    ]
    on_topic, rows = new_rows(
        raw,
        country="TW",
        source="google",
        matcher=matcher,
        crop_ids={"cabbage"},
        known=(set(), set()),
        now=NOW,
    )
    assert on_topic == 2
    assert [r["guid"] for r in rows] == ["g1"]
    assert rows[0]["crop_ids"] == ["cabbage"]
    assert rows[0]["source_domain"] is None


async def test_items_older_than_a_week_are_deleted(seeded: AsyncSession) -> None:
    await run_country(seeded, "TW", TW, FakeSource(TW_RAW), clock=clock)
    later = NOW + timedelta(days=5)  # the 9/14 items are now more than 7 days old
    await run_country(seeded, "TW", TW, FakeSource([]), clock=lambda: later)
    stored = await items(seeded)
    assert stored
    assert min(i.published_at for i in stored) >= later - timedelta(days=7)


async def test_a_failed_search_keeps_the_stored_items(seeded: AsyncSession) -> None:
    await run_country(seeded, "TW", TW, FakeSource(TW_RAW), clock=clock)
    before = len(await items(seeded))
    run = await run_country(seeded, "TW", TW, FakeSource(UpstreamError("all failed")), clock=clock)
    assert run.status == "failed"
    assert run.error is not None
    assert "all failed" in run.error
    assert len(await items(seeded)) == before
    assert [r.status for r in await runs(seeded)] == ["ok", "failed"]


async def test_a_country_missing_from_the_catalog_fails_its_run(seeded: AsyncSession) -> None:
    run = await run_country(seeded, "MY", CONFIG.countries["MY"], FakeSource([]), clock=clock)
    assert run.status == "failed"


# ---------- summaries ----------


async def test_pending_items_are_summarised_most_relevant_first(seeded: AsyncSession) -> None:
    await run_country(seeded, "TW", TW, FakeSource(TW_RAW), clock=clock)
    reader = FakeReader()
    flash = FakeModel("flash", crops=("cabbage", "unknown"))
    summaries = Summaries([flash], None, calls=3)
    run = await run_country(
        seeded,
        "TW",
        TW,
        FakeSource([]),
        reader=reader,
        summaries=summaries,
        articles=3,
        clock=clock,
    )
    assert (run.articles, run.model_calls, run.summaries) == (3, 3, 3)
    assert run.requests == 7  # one search + two per article read
    stored = await items(seeded)
    done = [i for i in stored if i.summary]
    assert len(done) == 3
    # Items mentioning an area come first (Taichung, Yunlin, …).
    first = flash.requests[0]
    assert first.lang == "zh-TW"
    assert first.text == "西螺果菜市場到貨減少，菜價上漲。"
    assert any(c.id == "cabbage" and "高麗菜" in c.names for c in first.crops)
    summarised = {i.title for i in done}
    assert any(t.startswith("母湯喔！") for t in summarised)
    for item in done:
        assert item.url == PUBLISHER
        assert item.summary_model == "flash"
        assert item.summary_lang == "zh-TW"
        assert item.summary_tries == 1
        assert "cabbage" in item.crop_ids
        assert "unknown" not in item.crop_ids
        assert "taichung" in item.area_ids  # the summary mentions 台中
    assert all(i.summary_tries == 0 for i in stored if not i.summary)
    [_, record] = await runs(seeded)
    assert (record.articles, record.model_calls, record.summaries) == (3, 3, 3)


async def test_without_article_text_only_a_grounded_model_is_asked(seeded: AsyncSession) -> None:
    await run_country(seeded, "TW", TW, FakeSource(TW_RAW[:3]), clock=clock)
    flash = FakeModel("flash")
    grounded = FakeModel("grounded", grounded=True)
    run = await run_country(
        seeded,
        "TW",
        TW,
        FakeSource([]),
        reader=FakeReader(text=None),
        summaries=Summaries([flash], grounded, calls=10),
        articles=10,
        clock=clock,
    )
    assert flash.requests == []
    assert len(grounded.requests) == run.summaries == 3
    assert all(r.text is None for r in grounded.requests)


async def test_no_text_and_no_grounded_model_leaves_items_title_only(seeded: AsyncSession) -> None:
    await run_country(seeded, "TW", TW, FakeSource(TW_RAW[:2]), clock=clock)
    reader = FakeReader(text=None)
    run = await run_country(
        seeded,
        "TW",
        TW,
        FakeSource([]),
        reader=reader,
        summaries=Summaries([FakeModel("flash")], None, calls=10),
        articles=10,
        clock=clock,
    )
    assert run.model_calls == 0
    stored = await items(seeded)
    assert all(i.summary is None and i.summary_tries == 1 for i in stored)
    assert all(i.url == PUBLISHER for i in stored)  # the resolved link is kept


async def test_when_the_article_budget_is_spent_the_run_stops(seeded: AsyncSession) -> None:
    await run_country(seeded, "TW", TW, FakeSource(TW_RAW), clock=clock)
    reader = FakeReader()
    run = await run_country(
        seeded,
        "TW",
        TW,
        FakeSource([]),
        reader=reader,
        summaries=Summaries([FakeModel("flash")], None, calls=10),
        articles=2,
        clock=clock,
    )
    assert run.articles == 2
    assert run.model_calls == 2
    assert sum(1 for i in await items(seeded) if i.summary_tries) == 2  # the rest keep their chance


async def test_google_refusing_leaves_the_rest_to_the_grounded_model(seeded: AsyncSession) -> None:
    await run_country(seeded, "TW", TW, FakeSource(TW_RAW[:3]), clock=clock)
    reader = FakeReader()
    reader.google_refused = True
    grounded = FakeModel("grounded", grounded=True)
    run = await run_country(
        seeded,
        "TW",
        TW,
        FakeSource([]),
        reader=reader,
        summaries=Summaries([FakeModel("flash")], grounded, calls=10),
        articles=10,
        clock=clock,
    )
    assert reader.links == []
    assert (run.articles, len(grounded.requests)) == (0, 3)


# ---------- the job over every country ----------


def gemini_answer(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json=json.loads(fixture_text("gemini_generate_content.json")))


def google_script() -> Script:
    html = {"content-type": "text/html; charset=utf-8"}
    return Script(
        {
            SEARCH_URL: [httpx.Response(200, content=fixture_bytes("gnews_rss_TW.xml"))],
            "https://news.google.com/rss/articles/": [
                httpx.Response(200, text=fixture_text("gnews_article_TW.html"), headers=html)
            ],
            gnews.BATCH_URL: [httpx.Response(200, text=fixture_text("gnews_batchexecute_TW.txt"))],
            PUBLISHER: [
                httpx.Response(200, content=fixture_bytes("publisher_pts.html"), headers=html)
            ],
            GEMINI_URL.format(model=GEMINI_TEXT_MODEL): [gemini_answer],
            GEMINI_URL.format(model=GEMINI_GROUNDED_MODEL): [
                httpx.Response(200, json=json.loads(fixture_text("gemini_grounded.json")))
            ],
        }
    )


@pytest.fixture
async def maker(settings: Settings, seeded: AsyncSession) -> Any:
    engine = create_engine(settings)
    yield create_sessionmaker(engine)
    await engine.dispose()


async def test_run_news_end_to_end_with_gemini(maker: async_sessionmaker[AsyncSession]) -> None:
    script = google_script()
    time = FakeTime()
    options = NewsOptions(source="google", gemini_api_key="key")
    [run] = await run_news(
        maker,
        options,
        countries=["TW"],
        clock=clock,
        transport=script.transport(),
        sleep=time.sleep,
        monotonic=time.clock,
    )
    assert run.status == "ok"
    assert run.items_new == 10  # 12 headlines, two off topic
    assert run.articles == run.model_calls == run.summaries == 10  # within TW's share of 15
    async with maker() as session:
        stored = await items(session)
    assert all(i.summary and i.summary_model == "gemini-3.5-flash-lite" for i in stored)
    assert all(i.url == "https://health.tvbs.com.tw/life/365962" for i in stored)
    assert all("bokchoy" in i.crop_ids for i in stored)
    # Searches, links and pages are spaced out.
    assert {1.5, 2.0} <= set(time.slept)
    assert len([u for u in script.urls() if u.startswith(SEARCH_URL)]) == 5

    # A start-up run the same day does nothing; a run by hand finds nothing new to do.
    skipped = await run_news(
        maker,
        options,
        startup=True,
        clock=clock,
        transport=script.transport(),
        sleep=time.sleep,
        monotonic=time.clock,
    )
    assert [r.country for r in skipped] == ["IN"]  # TW is fresh; IN has never run
    again = await run_news(
        maker,
        options,
        countries=["TW"],
        clock=clock,
        transport=script.transport(),
        sleep=time.sleep,
        monotonic=time.clock,
    )
    assert again[0].items_new == 0
    assert again[0].model_calls == 0


async def test_start_up_runs_only_countries_without_fresh_news(
    maker: async_sessionmaker[AsyncSession],
) -> None:
    demo = NewsOptions(source="demo")
    first = await run_news(maker, demo, startup=True, clock=clock)
    assert [r.country for r in first] == ["TW", "IN"]  # the configuration's order
    assert await run_news(maker, demo, startup=True, clock=clock) == []
    later = await run_news(
        maker, demo, startup=True, clock=lambda: NOW + timedelta(days=1, minutes=1)
    )
    assert [r.country for r in later] == ["TW", "IN"]


async def test_start_up_refetches_a_country_whose_news_is_missing(
    maker: async_sessionmaker[AsyncSession],
) -> None:
    demo = NewsOptions(source="demo")
    await run_news(maker, demo, clock=clock)
    async with maker() as session:
        await session.execute(text("DELETE FROM news_items WHERE country = 'TW'"))
        await session.commit()
    # Fetched within the day, but TW has no news any more (e.g. a switch to google and back).
    again = await run_news(maker, demo, startup=True, clock=clock)
    assert [r.country for r in again] == ["TW"]


async def test_demo_and_real_items_never_mix(maker: async_sessionmaker[AsyncSession]) -> None:
    await run_news(maker, NewsOptions(source="demo"), clock=clock)
    async with maker() as session:
        demo_items = await items(session)
    assert demo_items
    assert {i.source_name for i in demo_items} == {"示範資料"}
    assert {i.summary_model for i in demo_items if i.summary} == {"demo"}
    script = google_script()
    time = FakeTime()
    await run_news(
        maker,
        NewsOptions(source="google"),
        countries=["TW"],
        clock=clock,
        transport=script.transport(),
        sleep=time.sleep,
        monotonic=time.clock,
    )
    async with maker() as session:
        stored = await items(session)
    assert stored
    assert {i.source for i in stored} == {"google"}
    assert all(i.summary is None for i in stored)  # no model configured: titles only
    assert not any(u.startswith("https://news.google.com/rss/articles/") for u in script.urls())


async def test_budgets_are_shared_by_the_day(maker: async_sessionmaker[AsyncSession]) -> None:
    async with maker() as session:
        await session.execute(
            text(
                "INSERT INTO news_runs (country, source, started_at, status, articles, model_calls)"
                " VALUES ('IN', 'google', :t, 'ok', 30, 28)"
            ),
            {"t": NOW - timedelta(hours=3)},
        )
        await session.commit()
    script = google_script()
    time = FakeTime()
    [run] = await run_news(
        maker,
        NewsOptions(source="google", gemini_api_key="key"),
        countries=["TW"],
        clock=clock,
        transport=script.transport(),
        sleep=time.sleep,
        monotonic=time.clock,
    )
    # No page reads left today; two model calls left, used on headlines with grounding.
    assert (run.articles, run.model_calls, run.summaries) == (0, 2, 2)
    grounded = GEMINI_URL.format(model=GEMINI_GROUNDED_MODEL)
    assert len([u for u in script.urls() if u == grounded]) == 2


async def test_off_unknown_and_unseeded_countries(maker: async_sessionmaker[AsyncSession]) -> None:
    assert await run_news(maker, NewsOptions(source="off"), clock=clock) == []
    assert await run_news(maker, NewsOptions(source="demo"), countries=["MY"], clock=clock) == []


def test_allowance_is_a_share_of_what_is_left() -> None:
    assert allowance(30, 0, 2) == 15
    assert allowance(30, 20, 2) == 10
    assert allowance(30, 30, 2) == 0
    assert allowance(30, 0, 3) == 10
    assert allowance(30, 0, 0) == 30
