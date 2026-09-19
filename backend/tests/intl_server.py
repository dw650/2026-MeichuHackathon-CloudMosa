"""A stand-in for the three B5 addresses (official page, monthly file, exchange rates) that
serves the saved real samples in tests/fixtures, so no test touches the network."""

import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import httpx

from app.ingest.intl.refresh import IntlConfig

FIXTURES = Path(__file__).resolve().parent / "fixtures"
PAGE_URL = "https://www.worldbank.org/en/research/commodity-markets"
FILE_URL = (
    "https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026"
    "/related/CMO-Historical-Data-Monthly.xlsx"
)
FX_URL = "https://open.er-api.com/v6/latest/USD"
LAST_MODIFIED = "Wed, 02 Sep 2026 20:17:37 GMT"
CONFIG = IntlConfig(page_url=PAGE_URL, file_url="", fallback_url=FILE_URL, fx_url=FX_URL)

PAGE = (FIXTURES / "wb_commodity_markets_excerpt.html").read_text(encoding="utf-8")
SAMPLE = (FIXTURES / "wb_pink_monthly_sample.xlsx").read_bytes()


def fx_payload(**changes: Any) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((FIXTURES / "er_api_latest_usd.json").read_text("utf-8"))
    data.update(changes)
    return data


class IntlServer:
    """Answers like the real servers: the page, the file (304 for a matching
    If-Modified-Since) and the rates. `down` lists addresses that answer 503; `files` adds
    other file addresses with their content."""

    def __init__(
        self,
        *,
        page: str = PAGE,
        files: dict[str, bytes] | None = None,
        last_modified: str = LAST_MODIFIED,
        fx: dict[str, Any] | None = None,
        down: Iterable[str] = (),
    ) -> None:
        self.page = page
        self.files = {FILE_URL: SAMPLE} | (files or {})
        self.last_modified = last_modified
        self.fx = fx if fx is not None else fx_payload()
        self.down = set(down)
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        url = str(request.url)
        if url in self.down:
            return httpx.Response(503, text="Service Unavailable")
        if url == PAGE_URL:
            return httpx.Response(200, text=self.page, headers={"Content-Type": "text/html"})
        if url == FX_URL:
            return httpx.Response(200, json=self.fx)
        if url in self.files:
            if request.headers.get("If-Modified-Since") == self.last_modified:
                return httpx.Response(304)
            headers = {"Last-Modified": self.last_modified}
            return httpx.Response(200, content=self.files[url], headers=headers)
        return httpx.Response(404, text="Not Found")

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self)

    def hits(self, url: str) -> int:
        return sum(1 for r in self.requests if str(r.url) == url)

    def conditional(self, url: str) -> list[bool]:
        """For each request of `url`: was it conditional?"""
        return ["If-Modified-Since" in r.headers for r in self.requests if str(r.url) == url]
