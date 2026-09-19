"""Reads the article behind a headline: Google News link → publisher URL → page → main text.

Requests are spaced out (Google and publishers separately), limited in size and time, and a
publisher page gets one retry. When Google starts refusing (429, 403, 5xx) the reader stops
asking it for the rest of the run. Nothing is stored here; the caller only keeps the URL."""

import asyncio
import logging
import time
from dataclasses import dataclass

import httpx

from app.ingest.news import gnews
from app.ingest.news.article import decode_html, extract_text
from app.ingest.news.base import BROWSER_UA, Monotonic, Pacer, Sleep

TIMEOUT = httpx.Timeout(20.0, connect=10.0)
MAX_PAGE_BYTES = 3_000_000  # some news pages are 1–2 MB of markup
GOOGLE_PACE_S = 2.0
PUBLISHER_PACE_S = 1.0
RETRY_PAUSE_S = 3.0
ACCEPT_LANGUAGE = {
    "zh-TW": "zh-TW,zh;q=0.9,en;q=0.7",
    "en": "en-IN,en;q=0.9",
    "ms": "ms-MY,ms;q=0.9,en;q=0.8",
}

logger = logging.getLogger("app.ingest.news")


class _PageTooLargeError(Exception):
    pass


@dataclass(frozen=True)
class Article:
    """`url`: the publisher URL when the link could be resolved; `text`: the page's main text
    when it could be read."""

    url: str | None
    text: str | None


class ArticleReader:
    def __init__(
        self,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Sleep = asyncio.sleep,
        clock: Monotonic = time.monotonic,
    ) -> None:
        self.requests = 0
        self.google_refused = False
        self._sleep = sleep
        self._google = Pacer(GOOGLE_PACE_S, sleep, clock)
        self._publisher = Pacer(PUBLISHER_PACE_S, sleep, clock)
        self._client = httpx.AsyncClient(
            transport=transport,
            timeout=TIMEOUT,
            headers={"User-Agent": BROWSER_UA},
            follow_redirects=True,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def read(self, link: str, lang: str) -> Article:
        url = await self.resolve(link)
        if url is None:
            return Article(url=None, text=None)
        return Article(url=url, text=await self.text(url, lang))

    async def resolve(self, link: str) -> str | None:
        """The publisher URL behind a Google News link (other links are returned as they are)."""
        aid = gnews.article_id(link)
        if aid is None:
            return link if link.startswith(("http://", "https://")) else None
        if self.google_refused:
            return None
        page = await self._google_call("GET", gnews.ARTICLE_URL.format(id=aid))
        params = gnews.decoding_params(page) if page is not None else None
        if params is None:
            return None
        signature, timestamp = params
        answer = await self._google_call(
            "POST",
            gnews.BATCH_URL,
            content=gnews.batch_body(aid, timestamp, signature),
            headers=gnews.BATCH_HEADERS,
        )
        return gnews.parse_batch(answer) if answer is not None else None

    async def _google_call(
        self,
        method: str,
        url: str,
        *,
        content: str | None = None,
        headers: dict[str, str] | None = None,
    ) -> str | None:
        await self._google.wait()
        self.requests += 1
        try:
            response = await self._client.request(method, url, content=content, headers=headers)
        except httpx.HTTPError as exc:
            logger.info("news: Google link request failed: %r", exc)
            return None
        if response.status_code in (403, 429) or response.status_code >= 500:
            logger.warning(
                "news: Google answered HTTP %s; no more links this run", response.status_code
            )
            self.google_refused = True
            return None
        return None if response.is_error else response.text

    async def text(self, url: str, lang: str) -> str | None:
        """Main text of a publisher page; one retry for network errors and 5xx answers."""
        headers = {
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": ACCEPT_LANGUAGE.get(lang, "en;q=0.9"),
        }
        for attempt in range(2):
            if attempt:
                await self._sleep(RETRY_PAUSE_S)
            await self._publisher.wait()
            self.requests += 1
            try:
                page = await self._page(url, headers)
            except _PageTooLargeError:
                logger.info("news: page %s is too large", url)
                return None
            except httpx.HTTPError as exc:
                logger.info("news: page %s failed: %r", url, exc)
                continue
            if page is None:
                return None
            return extract_text(page)
        return None

    async def _page(self, url: str, headers: dict[str, str]) -> str | None:
        """The decoded page; None for answers that are not HTML or are client errors (no
        retry). Raises for network errors and 5xx answers (retried)."""
        async with self._client.stream("GET", url, headers=headers) as response:
            if response.status_code >= 500:
                raise httpx.HTTPStatusError(
                    f"HTTP {response.status_code}", request=response.request, response=response
                )
            kind = response.headers.get("content-type", "")
            if response.is_error or ("html" not in kind and kind):
                return None
            chunks: list[bytes] = []
            size = 0
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > MAX_PAGE_BYTES:
                    raise _PageTooLargeError(url)
                chunks.append(chunk)
            return decode_html(b"".join(chunks), response.charset_encoding)
