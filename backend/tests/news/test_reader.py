"""Link → publisher URL → page → text, over the saved real answers (no network)."""

import httpx
import pytest

from app.ingest.news import gnews, reader
from app.ingest.news.reader import ArticleReader
from tests.news.helpers import FakeTime, Script, fixture_bytes, fixture_text

AID = (
    "CBMiT0FVX3lxTE5EYTYtM1F6bjJQN2pVeDl3UXgxRFNLdFJqWEtYMVpSenItbXp0Skhnc2tsVTlXeTM4UEpCSkx3dnZy"
    "RmZ4WFIyaEgtVHZmY1U"
)
LINK = f"https://news.google.com/rss/articles/{AID}?oc=5"
PUBLISHER = "https://health.tvbs.com.tw/life/365962"
HTML = {"content-type": "text/html; charset=utf-8"}


def google_ok() -> dict[str, list[object]]:
    return {
        gnews.ARTICLE_URL.format(id=AID): [
            httpx.Response(200, text=fixture_text("gnews_article_TW.html"), headers=HTML)
        ],
        gnews.BATCH_URL: [httpx.Response(200, text=fixture_text("gnews_batchexecute_TW.txt"))],
    }


def page(name: str = "publisher_pts.html") -> httpx.Response:
    return httpx.Response(200, content=fixture_bytes(name), headers=HTML)


def make(script: Script, time: FakeTime) -> ArticleReader:
    return ArticleReader(transport=script.transport(), sleep=time.sleep, clock=time.clock)


async def test_read_resolves_the_link_and_extracts_the_text() -> None:
    script = Script({**google_ok(), PUBLISHER: [page()]})
    time = FakeTime()
    r = make(script, time)
    article = await r.read(LINK, "zh-TW")
    await r.aclose()
    assert article.url == PUBLISHER
    assert article.text is not None
    assert "西螺果菜市場" in article.text
    assert r.requests == 3
    batch = script.requests[1]
    assert batch.method == "POST"
    assert batch.headers["content-type"].startswith("application/x-www-form-urlencoded")
    assert script.requests[2].headers["accept-language"].startswith("zh-TW")
    assert time.slept == [reader.GOOGLE_PACE_S]


async def test_links_that_are_not_google_news_are_read_directly() -> None:
    script = Script({PUBLISHER: [page()]})
    r = make(script, FakeTime())
    article = await r.read(PUBLISHER, "en")
    assert article.url == PUBLISHER
    assert await r.resolve("ftp://example.test/x") is None
    assert r.requests == 1
    await r.aclose()


async def test_google_refusing_stops_further_link_requests() -> None:
    script = Script({gnews.ARTICLE_URL.format(id=AID): [httpx.Response(429)]})
    r = make(script, FakeTime())
    assert await r.read(LINK, "zh-TW") == reader.Article(url=None, text=None)
    assert r.google_refused
    assert await r.resolve(LINK) is None
    assert r.requests == 1  # the second link was not even tried
    await r.aclose()


async def test_a_page_without_parameters_or_a_bad_batch_answer_gives_no_url() -> None:
    script = Script(
        {
            gnews.ARTICLE_URL.format(id=AID): [
                httpx.Response(200, text="<html>consent page</html>", headers=HTML),
                httpx.Response(200, text=fixture_text("gnews_article_TW.html"), headers=HTML),
            ],
            gnews.BATCH_URL: [httpx.Response(400, text="bad")],
        }
    )
    r = make(script, FakeTime())
    assert await r.resolve(LINK) is None  # no data-n-a-sg on the page
    assert await r.resolve(LINK) is None  # batchexecute refused
    assert not r.google_refused
    await r.aclose()


async def test_network_errors_on_google_give_no_url() -> None:
    script = Script({gnews.ARTICLE_URL.format(id=AID): [httpx.ConnectError("down")]})
    r = make(script, FakeTime())
    assert await r.resolve(LINK) is None
    assert not r.google_refused
    await r.aclose()


async def test_publisher_pages_get_one_retry() -> None:
    script = Script({PUBLISHER: [httpx.Response(502), page()]})
    time = FakeTime()
    r = make(script, time)
    text = await r.text(PUBLISHER, "zh-TW")
    assert text is not None
    assert r.requests == 2
    assert reader.RETRY_PAUSE_S in time.slept
    failing = Script({PUBLISHER: [httpx.ReadTimeout("slow")]})
    r2 = make(failing, FakeTime())
    assert await r2.text(PUBLISHER, "en") is None
    assert r2.requests == 2
    await r.aclose()
    await r2.aclose()


async def test_client_errors_and_non_html_answers_give_no_text() -> None:
    script = Script(
        {
            "https://a.test/403": [httpx.Response(403, text="Forbidden", headers=HTML)],
            "https://a.test/pdf": [
                httpx.Response(200, content=b"%PDF", headers={"content-type": "application/pdf"})
            ],
        }
    )
    r = make(script, FakeTime())
    assert await r.text("https://a.test/403", "en") is None
    assert await r.text("https://a.test/pdf", "en") is None
    assert r.requests == 2  # neither is retried
    await r.aclose()


async def test_oversized_pages_are_abandoned(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(reader, "MAX_PAGE_BYTES", 1000)
    script = Script({PUBLISHER: [page()]})
    r = make(script, FakeTime())
    assert await r.text(PUBLISHER, "zh-TW") is None
    assert r.requests == 1
    await r.aclose()
