"""Google News RSS: parsing the saved real answers and running a country's searches."""

from datetime import UTC, datetime

import httpx
import pytest

from app.ingest.news.base import UpstreamError
from app.ingest.news.config import CountryNews, Feed
from app.ingest.news.rss import (
    SEARCH_URL,
    GoogleNewsSource,
    RssItem,
    domain_of,
    parse_rss,
    search_params,
    to_raw,
)
from tests.news.helpers import FakeTime, Script, fixture_bytes

TW_FEED = Feed(hl="zh-TW", gl="TW", ceid="TW:zh-Hant", queries=["菜價", "果菜市場"])
TW = CountryNews(summary_lang="zh-TW", feeds=[TW_FEED])


def rss(name: str) -> httpx.Response:
    return httpx.Response(200, content=fixture_bytes(name), headers={"content-type": "text/xml"})


def test_parse_the_saved_taiwan_answer() -> None:
    items = parse_rss(fixture_bytes("gnews_rss_TW.xml"))
    assert len(items) == 12
    first = items[0]
    assert first.title.startswith("菜價漲到「阿娘喂」？北農釋出12種平價菜")
    assert first.title.endswith(" - TVBS 健康2.0")
    assert first.link.startswith("https://news.google.com/rss/articles/CBMi")
    assert first.guid.startswith("CBMi")
    assert first.published_at == datetime(2026, 9, 16, 7, 0, tzinfo=UTC)
    assert (first.source_name, first.source_url) == ("TVBS 健康2.0", "https://health.tvbs.com.tw")


def test_parse_the_saved_india_and_malaysia_answers() -> None:
    india = parse_rss(fixture_bytes("gnews_rss_IN.xml"))
    assert india[0].title == (
        "India: Onion prices stay elevated despite INR 35/kg buffer sales - BigMint"
    )
    malaysia = parse_rss(fixture_bytes("gnews_rss_MY.xml"))
    assert malaysia[0].source_url == "https://www.kosmo.com.my"
    assert len(malaysia) == 8


def test_items_without_title_link_or_date_are_skipped_or_dropped() -> None:
    xml = (
        b"<rss><channel>"
        b"<item><title>No link</title></item>"
        b"<item><title>Undated</title><link>https://x.test/a</link><pubDate>soon</pubDate></item>"
        b"</channel></rss>"
    )
    items = parse_rss(xml)
    assert [i.title for i in items] == ["Undated"]
    assert items[0].published_at is None
    assert items[0].guid == "https://x.test/a"  # no guid: the link stands in
    assert items[0].source_name == ""
    assert to_raw(items[0], "en") is None


def test_not_rss_is_an_upstream_error() -> None:
    with pytest.raises(UpstreamError, match="not RSS"):
        parse_rss(b"<html>Sorry</html")


def test_to_raw_cleans_the_title_and_keeps_the_domain() -> None:
    item = RssItem(
        guid="g",
        title="母湯喔！菜價飆漲偷摘菜 - 自由時報",
        link="https://news.google.com/rss/articles/x",
        published_at=datetime(2026, 9, 17, 11, 29, tzinfo=UTC),
        source_name="自由時報",
        source_url="https://news.ltn.com.tw",
    )
    raw = to_raw(item, "zh-TW")
    assert raw is not None
    assert (raw.title, raw.source_name, raw.source_domain, raw.lang) == (
        "母湯喔！菜價飆漲偷摘菜",
        "自由時報",
        "news.ltn.com.tw",
        "zh-TW",
    )
    nameless = to_raw(RssItem("g", "t", "l", item.published_at, "", "https://www.a.test/x"), "en")
    assert nameless is not None
    assert nameless.source_name == "a.test"


def test_domain_of() -> None:
    assert domain_of("https://www.chinatimes.com/realtimenews/1") == "chinatimes.com"
    assert domain_of(None) is None
    assert domain_of("not a url") is None


def test_search_params_add_the_window_and_edition() -> None:
    assert search_params(TW_FEED, "菜價", 7) == {
        "q": "菜價 when:7d",
        "hl": "zh-TW",
        "gl": "TW",
        "ceid": "TW:zh-Hant",
    }


async def test_fetch_runs_every_search_spaced_out() -> None:
    script = Script({SEARCH_URL: [rss("gnews_rss_TW.xml")]})
    time = FakeTime()
    source = GoogleNewsSource(transport=script.transport(), sleep=time.sleep, clock=time.clock)
    items = await source.fetch("TW", TW, 2)
    assert len(items) == 24  # the same answer for both searches; the pipeline dedupes
    assert source.requests == 2
    assert [r.url.params["q"] for r in script.requests] == ["菜價 when:2d", "果菜市場 when:2d"]
    assert time.slept == [1.5]
    assert "Mozilla/5.0" in script.requests[0].headers["user-agent"]
    assert items[0].title == "菜價漲到「阿娘喂」？北農釋出12種平價菜 小黃瓜只要半價 3種菜最耐放"


async def test_busy_answers_are_retried_once_then_that_search_is_skipped() -> None:
    script = Script(
        {
            SEARCH_URL: [
                httpx.Response(503),
                rss("gnews_rss_TW.xml"),  # 菜價 on its retry
                httpx.ConnectError("down"),
                httpx.Response(429),  # 果菜市場 fails twice
            ]
        }
    )
    time = FakeTime()
    source = GoogleNewsSource(transport=script.transport(), sleep=time.sleep, clock=time.clock)
    items = await source.fetch("TW", TW, 2)
    assert len(items) == 12
    assert source.requests == 4
    assert 5.0 in time.slept


async def test_the_run_fails_when_every_search_fails() -> None:
    script = Script({SEARCH_URL: [httpx.Response(404)]})
    time = FakeTime()
    source = GoogleNewsSource(transport=script.transport(), sleep=time.sleep, clock=time.clock)
    with pytest.raises(UpstreamError, match="all 2 news searches failed"):
        await source.fetch("TW", TW, 2)
    assert source.requests == 2  # a 404 is not retried
