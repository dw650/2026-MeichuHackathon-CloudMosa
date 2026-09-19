"""Shared types of the news pipeline: raw items from a source, and request pacing."""

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.ingest.news.config import CountryNews

Sleep = Callable[[float], Awaitable[None]]
Monotonic = Callable[[], float]
# A normal desktop browser: some publishers refuse unknown clients.
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
    " Chrome/129.0.0.0 Safari/537.36"
)


class UpstreamError(RuntimeError):
    """A news search failed or answered with something unusable."""


@dataclass(frozen=True)
class RawNews:
    """One headline as a source gives it (title already without the " - source" suffix)."""

    guid: str
    title: str
    url: str
    published_at: datetime
    source_name: str
    source_domain: str | None
    lang: str
    # Only the demo source has these; real items get them from the summariser.
    summary: str | None = None
    summary_lang: str | None = None
    crop_ids: tuple[str, ...] = ()


class NewsSource(Protocol):
    """Where headlines come from: `google` (Google News RSS) or `demo` (fixed items)."""

    id: str
    requests: int

    async def fetch(self, country: str, config: CountryNews, days: int) -> list[RawNews]:
        """Headlines of the last `days` days."""
        ...


class Pacer:
    """Keeps at least `interval` seconds between two calls of `wait` (polite request pacing)."""

    def __init__(
        self, interval: float, sleep: Sleep = asyncio.sleep, clock: Monotonic = time.monotonic
    ) -> None:
        self.interval = interval
        self._sleep = sleep
        self._clock = clock
        self._last: float | None = None

    async def wait(self) -> None:
        if self._last is not None:
            gap = self.interval - (self._clock() - self._last)
            if gap > 0:
                await self._sleep(gap)
        self._last = self._clock()
