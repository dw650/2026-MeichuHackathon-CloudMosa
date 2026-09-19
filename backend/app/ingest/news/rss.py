"""Google News RSS searches (docs/06 §1.4): no key needed; one request per search.

Each item carries the headline with " - {publisher}" appended, a news.google.com link (a
JavaScript redirect, see gnews.py), the publication time (RFC 822, GMT) and the publisher with
its home page. The description only repeats the headline, so it is not used."""

import asyncio
import logging
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse

import httpx

from app.ingest.news.base import BROWSER_UA, Monotonic, Pacer, RawNews, Sleep, UpstreamError
from app.ingest.news.config import CountryNews, Feed
from app.ingest.news.match import clean_title

SEARCH_URL = "https://news.google.com/rss/search"
TIMEOUT = httpx.Timeout(20.0, connect=10.0)
ATTEMPTS = 2  # one retry for busy answers and network errors
BACKOFF_S = 5.0
PACE_S = 1.5  # between two searches

logger = logging.getLogger("app.ingest.news")


@dataclass(frozen=True)
class RssItem:
    guid: str
    title: str
    link: str
    published_at: datetime | None
    source_name: str
    source_url: str | None


def search_params(feed: Feed, query: str, days: int) -> dict[str, str]:
    """Query string of one search: the words plus Google's `when:` window, and the edition."""
    return {"q": f"{query} when:{days}d", "hl": feed.hl, "gl": feed.gl, "ceid": feed.ceid}


def _published(text: str | None) -> datetime | None:
    if not text:
        return None
    try:
        moment = parsedate_to_datetime(text)
    except (TypeError, ValueError):
        return None
    return (moment if moment.tzinfo else moment.replace(tzinfo=UTC)).astimezone(UTC)


def parse_rss(content: bytes) -> list[RssItem]:
    """Items of an RSS answer; items without a title or link are skipped."""
    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise UpstreamError(f"Google News answered with something that is not RSS: {exc}") from exc
    items: list[RssItem] = []
    for node in root.iter("item"):
        title = (node.findtext("title") or "").strip()
        link = (node.findtext("link") or "").strip()
        if not title or not link:
            continue
        source = node.find("source")
        items.append(
            RssItem(
                guid=(node.findtext("guid") or link).strip(),
                title=title,
                link=link,
                published_at=_published(node.findtext("pubDate")),
                source_name=(source.text or "").strip() if source is not None else "",
                source_url=source.get("url") if source is not None else None,
            )
        )
    return items


def domain_of(url: str | None) -> str | None:
    """`https://www.chinatimes.com/…` → `chinatimes.com`."""
    host = urlparse(url).hostname if url else None
    if not host:
        return None
    return host.removeprefix("www.")


def to_raw(item: RssItem, lang: str) -> RawNews | None:
    if item.published_at is None:
        return None
    return RawNews(
        guid=item.guid,
        title=clean_title(item.title, item.source_name),
        url=item.link,
        published_at=item.published_at,
        source_name=item.source_name or domain_of(item.source_url) or "",
        source_domain=domain_of(item.source_url),
        lang=lang,
    )


class GoogleNewsSource:
    """Runs every search of a country, one after another, spaced out and retried once."""

    id = "google"

    def __init__(
        self,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Sleep = asyncio.sleep,
        clock: Monotonic = time.monotonic,
    ) -> None:
        self.requests = 0
        self._transport = transport
        self._sleep = sleep
        self._pacer = Pacer(PACE_S, sleep, clock)

    async def fetch(self, country: str, config: CountryNews, days: int) -> list[RawNews]:
        """Every item of every search. One failed search is skipped; when all fail the run
        fails, which keeps the stored news."""
        out: list[RawNews] = []
        searches = failures = 0
        headers = {"User-Agent": BROWSER_UA}
        async with httpx.AsyncClient(
            transport=self._transport, timeout=TIMEOUT, headers=headers, follow_redirects=True
        ) as client:
            for feed in config.feeds:
                for query in feed.queries:
                    searches += 1
                    try:
                        items = await self._search(client, search_params(feed, query, days))
                    except UpstreamError as exc:
                        failures += 1
                        logger.warning("news %s: search %r failed: %s", country, query, exc)
                        continue
                    out += [raw for item in items if (raw := to_raw(item, feed.lang))]
        if searches and failures == searches:
            raise UpstreamError(f"all {searches} news searches failed for {country}")
        return out

    async def _search(self, client: httpx.AsyncClient, params: dict[str, str]) -> list[RssItem]:
        error = ""
        for attempt in range(1, ATTEMPTS + 1):
            if attempt > 1:
                await self._sleep(BACKOFF_S)
            await self._pacer.wait()
            self.requests += 1
            try:
                response = await client.get(SEARCH_URL, params=params)
            except httpx.TransportError as exc:
                error = repr(exc)
                continue
            if response.status_code == 429 or response.status_code >= 500:
                error = f"HTTP {response.status_code}"
                continue
            if response.is_error:
                raise UpstreamError(f"Google News answered HTTP {response.status_code}")
            return parse_rss(response.content)
        raise UpstreamError(f"Google News failed {ATTEMPTS} attempts: {error}")
