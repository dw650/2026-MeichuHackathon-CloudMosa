"""Malaysia PriceCatcher provider (docs/06 §1.5): KPDN's price survey, open data on
data.gov.my (CC BY 4.0, no key).

The source publishes one CSV per month, `pricecatcher_YYYY-MM.csv` (date, premise_code,
item_code, price in RM per the item's unit), updated every day around 12:00 UTC with that day's
prices: some 40 000 rows a day, several times more on the day weekly items are reported. The
name maps in the seed decide what a premise is: a wholesale market ("Borong" premises) or a
retail point of an area (its wet markets).

`fetch(day)` keeps the pipeline's one-day contract. The first call of a run downloads each month
file of the planned days once (with the validators of an earlier run, so an unchanged file
answers 304 and costs nothing), reads it as it streams in and keeps only the mapped premises and
items of the planned days; the other rows of those days are counted as unmapped, never stored."""

import asyncio
import logging
import sys
from collections import Counter
from collections.abc import Callable, Collection, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta

import httpx

from app.ingest import normalize as fmt
from app.ingest.http import Fetcher, RetryPolicy, Sleep, UpstreamError
from app.ingest.providers.base import (
    WINDOW_DAYS,
    BuildContext,
    FetchStats,
    NormalizedQuote,
    RawRow,
    SourceInfo,
    SourceMaps,
    Validators,
)
from app.seed.schema import SeedFile

SOURCE = "my_pricecatcher"
BASE_URL = "https://storage.data.gov.my/pricecatcher/"
COLUMNS = ["date", "premise_code", "item_code", "price"]
REFRESH_DAYS = 3  # every run also reads today and the two days before
REFRESH_HOURS = "20-23"  # Malaysia time: the day's prices appear around 20:00 (12:00 UTC)

logger = logging.getLogger("app.ingest.my_pricecatcher")


def month_url(year: int, month: int) -> str:
    return f"{BASE_URL}pricecatcher_{year:04d}-{month:02d}.csv"


def codes_from_seeds(seeds: Sequence[SeedFile]) -> tuple[frozenset[str], frozenset[str]]:
    """(premise codes, item codes) named in `source_maps.my_pricecatcher`."""
    premises: set[str] = set()
    items: set[str] = set()
    for seed in seeds:
        maps = seed.source_maps.get(SOURCE)
        if maps is None:
            continue
        premises |= {m.source_market for m in maps.markets}
        premises |= {m.source_area for m in maps.areas}
        items |= {m.source_name for m in maps.crops}
    return frozenset(premises), frozenset(items)


@dataclass
class _File:
    """What one month file gave: rows of the planned days by ISO date, and what was left out."""

    status: int
    validators: dict[str, str] = field(default_factory=dict)
    rows: dict[str, list[RawRow]] = field(default_factory=dict)
    dropped: Counter[str] = field(default_factory=Counter)
    lines: int = 0


class PriceCatcherProvider:
    source = SOURCE
    countries: tuple[str, ...] = ("MY",)

    def __init__(
        self,
        premises: Collection[str],
        items: Collection[str],
        today_of: Callable[[str], date],
        *,
        plan: Sequence[date] | None = None,
        files: Mapping[str, Validators] | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Sleep = asyncio.sleep,
        policy: RetryPolicy | None = None,
    ) -> None:
        """`plan`: the trade dates to fetch (default: the whole window). `files`: validators of
        month files an earlier run already ingested, by URL."""
        self.premises = frozenset(premises)
        self.items = frozenset(items)
        self.plan = sorted(plan) if plan is not None else None
        self.files = dict(files or {})
        self.stats = FetchStats()
        self._today_of = today_of
        self._transport = transport
        self._sleep = sleep
        self._policy = policy or RetryPolicy()
        self._batch: tuple[date, dict[str, list[RawRow]]] | None = None  # (today, by ISO date)

    # ---------- fetch ----------

    def _days(self, today: date) -> list[date]:
        if self.plan is None:
            return [today - timedelta(days=i) for i in reversed(range(WINDOW_DAYS))]
        return [d for d in self.plan if d <= today]

    async def fetch(self, day: date) -> list[RawRow]:
        today = self._today_of("MY")
        days = self._days(today)
        if day not in days:
            return []
        if self._batch is None or self._batch[0] != today:
            self._batch = (today, await self._download(days, today))
        return self._batch[1].get(day.isoformat(), [])

    async def _download(self, days: list[date], today: date) -> dict[str, list[RawRow]]:
        wanted = {d.isoformat() for d in days}
        months = sorted({(d.year, d.month) for d in days})
        by_day: dict[str, list[RawRow]] = {}
        http = Fetcher(
            "PriceCatcher", policy=self._policy, transport=self._transport, sleep=self._sleep
        )

        async def read(response: httpx.Response) -> _File:
            return await self._read(response, wanted)

        try:
            async with http:
                for year, month in months:
                    url = month_url(year, month)
                    got = await http.get(
                        url, read=read, headers=self._conditional(url), allow={304, 404}
                    )
                    self._keep(url, got, current=(year, month) >= (today.year, today.month))
                    for iso, rows in got.rows.items():
                        by_day.setdefault(iso, []).extend(rows)
        finally:
            self.stats.requests += http.requests
        return by_day

    def _conditional(self, url: str) -> dict[str, str]:
        validators = self.files.get(url, {})
        headers = {}
        if validators.get("etag"):
            headers["If-None-Match"] = validators["etag"]
        if validators.get("last_modified"):
            headers["If-Modified-Since"] = validators["last_modified"]
        return headers

    def _keep(self, url: str, got: _File, *, current: bool) -> None:
        name = url.rsplit("/", 1)[-1]
        if got.status == 404:
            if not current:
                raise UpstreamError(f"PriceCatcher has no {name}")
            logger.info("my_pricecatcher: %s is not published yet", name)
            return
        if got.status == 304:
            logger.info("my_pricecatcher: %s not modified", name)
            self.stats.files[url] = dict(self.files.get(url, {}))
            return
        self.stats.dropped.update(got.dropped)
        if got.validators:
            self.stats.files[url] = got.validators
        logger.info(
            "my_pricecatcher: %s read, %d lines, %d rows kept, %s left out",
            name,
            got.lines,
            sum(len(rows) for rows in got.rows.values()),
            dict(got.dropped),
        )

    async def _read(self, response: httpx.Response, wanted: set[str]) -> _File:
        """Reads a month file as it streams in; builds everything afresh on every attempt."""
        if response.status_code != 200:
            return _File(status=response.status_code)
        got = _File(status=200)
        for key, header in (("etag", "ETag"), ("last_modified", "Last-Modified")):
            if response.headers.get(header):
                got.validators[key] = response.headers[header]
        lines = response.aiter_lines()
        head = await anext(lines, "")
        if head.strip().lstrip("\ufeff").split(",") != COLUMNS:
            raise UpstreamError(f"PriceCatcher file has unexpected columns: {head[:80]!r}")
        async for line in lines:
            if not line:
                continue
            got.lines += 1
            parts = line.split(",")
            if len(parts) != len(COLUMNS):
                got.dropped["malformed"] += 1
                continue
            iso, premise, item, price = parts
            if iso not in wanted:
                continue
            if premise in self.premises and item in self.items:
                row = {
                    "date": sys.intern(iso),
                    "premise_code": sys.intern(premise),
                    "item_code": sys.intern(item),
                    "price": price,
                }
                got.rows.setdefault(iso, []).append(row)
            else:
                got.dropped["unmapped"] += 1
        return got

    # ---------- normalize ----------

    def normalize(self, raw: RawRow, maps: SourceMaps) -> NormalizedQuote | None:
        return fmt.pricecatcher(raw, maps, SOURCE)


def _build(ctx: BuildContext) -> PriceCatcherProvider:
    premises, items = codes_from_seeds(ctx.seeds)
    return PriceCatcherProvider(premises, items, ctx.today_of, plan=ctx.days, files=ctx.files)


INFO = SourceInfo(
    id=SOURCE,
    countries=PriceCatcherProvider.countries,
    price_types=("wholesale", "retail"),
    build=_build,
    network=True,
    refresh_days=REFRESH_DAYS,
    refresh_hours=REFRESH_HOURS,
    fresh_for=timedelta(hours=6),
)
