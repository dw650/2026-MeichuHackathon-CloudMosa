"""Malaysia PriceCatcher provider (docs/06 §1.5): KPDN's price survey, open data on
data.gov.my (CC BY 4.0, no key).

The source publishes one CSV per month, `pricecatcher_YYYY-MM.csv` (date, premise_code,
item_code, price in RM per the item's unit), updated every day around 12:00 UTC with that day's
prices: some 40 000 rows a day, several times more on the day weekly items are reported. The
premise lookup, `lookup_premise.csv`, gives each premise its type, state and district.

The seed maps decide what a premise is: a wholesale market (the "Borong" premises, by code) or a
retail point of an area: every wet market ("Pasar Basah") the lookup places in a mapped district,
so a wet market that opens later is picked up without a seed change.

`fetch(day)` keeps the pipeline's one-day contract. The first call of a run reads the premise
lookup (kept for the life of the worker process and asked about with its validators afterwards,
so an unchanged lookup answers 304), then downloads each month file of the planned days once
(with the validators of an earlier run, so an unchanged file answers 304 and costs nothing),
reads it as it streams in and keeps only the mapped premises and items of the planned days, each
row joined with its premise's type, state and district; the other rows of those days are
counted as unmapped, never stored."""

import asyncio
import csv
import io
import logging
import sys
from collections import Counter
from collections.abc import Callable, Mapping, Sequence
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
LOOKUP_URL = f"{BASE_URL}lookup_premise.csv"
COLUMNS = ["date", "premise_code", "item_code", "price"]
LOOKUP_COLUMNS = {"premise_code", "premise_type", "state", "district"}
REFRESH_DAYS = 3  # every run also reads today and the two days before
REFRESH_HOURS = "20-23"  # Malaysia time: the day's prices appear around 20:00 (12:00 UTC)

logger = logging.getLogger("app.ingest.my_pricecatcher")

Premise = tuple[str, str, str]  # (premise_type, state, district) from lookup_premise.csv


def month_url(year: int, month: int) -> str:
    return f"{BASE_URL}pricecatcher_{year:04d}-{month:02d}.csv"


@dataclass(frozen=True)
class Wanted:
    """What `source_maps.my_pricecatcher` asks for: the premise codes of wholesale markets, the
    districts whose wet markets are retail points ("State/District", or a whole federal
    territory by its state) and the item codes."""

    markets: frozenset[str]
    districts: frozenset[str]
    items: frozenset[str]


def wanted_from_seeds(seeds: Sequence[SeedFile]) -> Wanted:
    markets: set[str] = set()
    districts: set[str] = set()
    items: set[str] = set()
    for seed in seeds:
        maps = seed.source_maps.get(SOURCE)
        if maps is None:
            continue
        markets |= {m.source_market for m in maps.markets}
        districts |= {m.source_area for m in maps.areas}
        items |= {m.source_name for m in maps.crops}
    return Wanted(frozenset(markets), frozenset(districts), frozenset(items))


@dataclass(frozen=True)
class Lookup:
    """The premise lookup as last downloaded: its validators and every premise by code."""

    validators: dict[str, str]
    premises: dict[str, Premise]


# The premise lookup by URL, for the life of the worker process: later runs ask whether it
# changed instead of downloading it again. A new process downloads it once.
LOOKUPS: dict[str, Lookup] = {}


@dataclass
class _File:
    """What one month file gave: rows of the planned days by ISO date, and what was left out."""

    status: int
    validators: dict[str, str] = field(default_factory=dict)
    rows: dict[str, list[RawRow]] = field(default_factory=dict)
    dropped: Counter[str] = field(default_factory=Counter)
    lines: int = 0


def _validators(response: httpx.Response) -> dict[str, str]:
    found = {}
    for key, header in (("etag", "ETag"), ("last_modified", "Last-Modified")):
        if response.headers.get(header):
            found[key] = response.headers[header]
    return found


def _conditional(validators: Validators) -> dict[str, str]:
    headers = {}
    if validators.get("etag"):
        headers["If-None-Match"] = validators["etag"]
    if validators.get("last_modified"):
        headers["If-Modified-Since"] = validators["last_modified"]
    return headers


class PriceCatcherProvider:
    source = SOURCE
    countries: tuple[str, ...] = ("MY",)

    def __init__(
        self,
        wanted: Wanted,
        today_of: Callable[[str], date],
        *,
        plan: Sequence[date] | None = None,
        files: Mapping[str, Validators] | None = None,
        lookups: dict[str, Lookup] | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Sleep = asyncio.sleep,
        policy: RetryPolicy | None = None,
    ) -> None:
        """`plan`: the trade dates to fetch (default: the whole window). `files`: validators of
        month files an earlier run already ingested, by URL. `lookups`: where the premise
        lookup is kept between runs (default: for the life of the process)."""
        self.wanted = wanted
        self.plan = sorted(plan) if plan is not None else None
        self.files = dict(files or {})
        self.stats = FetchStats()
        self._lookups = LOOKUPS if lookups is None else lookups
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
        try:
            async with http:
                premises = self._kept(await self._lookup(http))

                async def read(response: httpx.Response) -> _File:
                    return await self._read(response, wanted, premises)

                for year, month in months:
                    url = month_url(year, month)
                    got = await http.get(
                        url,
                        read=read,
                        headers=_conditional(self.files.get(url, {})),
                        allow={304, 404},
                    )
                    self._keep(url, got, current=(year, month) >= (today.year, today.month))
                    for iso, rows in got.rows.items():
                        by_day.setdefault(iso, []).extend(rows)
        finally:
            self.stats.requests += http.requests
        return by_day

    async def _lookup(self, http: Fetcher) -> Lookup:
        """The premise lookup: the kept copy when it has not changed, else a fresh download."""
        cached = self._lookups.get(LOOKUP_URL)

        async def read(response: httpx.Response) -> Lookup | None:
            if response.status_code == 304:
                return None
            text = (await response.aread()).decode("utf-8-sig")
            rows = csv.DictReader(io.StringIO(text))
            if not set(rows.fieldnames or ()) >= LOOKUP_COLUMNS:
                head = text[:80]
                raise UpstreamError(f"PriceCatcher lookup has unexpected columns: {head!r}")
            premises: dict[str, Premise] = {}
            for row in rows:
                premises[(row["premise_code"] or "").strip()] = (
                    sys.intern((row["premise_type"] or "").strip()),
                    sys.intern((row["state"] or "").strip()),
                    sys.intern((row["district"] or "").strip()),
                )
            return Lookup(_validators(response), premises)

        headers = _conditional(cached.validators) if cached else {}
        got = await http.get(LOOKUP_URL, read=read, headers=headers, allow={304})
        if got is None:
            if cached is None:
                raise UpstreamError("PriceCatcher answered 304 for a lookup never downloaded")
            logger.info("my_pricecatcher: lookup_premise.csv not modified")
            return cached
        self._lookups[LOOKUP_URL] = got
        logger.info("my_pricecatcher: lookup_premise.csv read, %d premises", len(got.premises))
        return got

    def _kept(self, lookup: Lookup) -> dict[str, Premise]:
        """The premises whose rows are kept: the mapped wholesale markets, and every wet market
        the lookup places in a mapped district."""
        kept = {code: lookup.premises.get(code, ("", "", "")) for code in self.wanted.markets}
        for code, premise in lookup.premises.items():
            kind, state, district = premise
            if kind == fmt.PRICECATCHER_WET_MARKET and any(
                name in self.wanted.districts
                for name in fmt.pricecatcher_districts(state, district)
            ):
                kept[code] = premise
        return kept

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

    async def _read(
        self, response: httpx.Response, wanted: set[str], premises: Mapping[str, Premise]
    ) -> _File:
        """Reads a month file as it streams in; builds everything afresh on every attempt."""
        if response.status_code != 200:
            return _File(status=response.status_code)
        got = _File(status=200, validators=_validators(response))
        lines = response.aiter_lines()
        head = await anext(lines, "")
        if head.strip().lstrip("﻿").split(",") != COLUMNS:
            raise UpstreamError(f"PriceCatcher file has unexpected columns: {head[:80]!r}")
        items = self.wanted.items
        async for line in lines:
            if not line:
                continue
            got.lines += 1
            parts = line.split(",")
            if len(parts) != len(COLUMNS):
                got.dropped["malformed"] += 1
                continue
            iso, code, item, price = parts
            if iso not in wanted:
                continue
            premise = premises.get(code)
            if premise is not None and item in items:
                kind, state, district = premise
                row = {
                    "date": sys.intern(iso),
                    "premise_code": sys.intern(code),
                    "item_code": sys.intern(item),
                    "price": price,
                    "premise_type": kind,
                    "state": state,
                    "district": district,
                }
                got.rows.setdefault(iso, []).append(row)
            else:
                got.dropped["unmapped"] += 1
        return got

    # ---------- normalize ----------

    def normalize(self, raw: RawRow, maps: SourceMaps) -> NormalizedQuote | None:
        return fmt.pricecatcher(raw, maps, SOURCE)


def _build(ctx: BuildContext) -> PriceCatcherProvider:
    return PriceCatcherProvider(
        wanted_from_seeds(ctx.seeds), ctx.today_of, plan=ctx.days, files=ctx.files
    )


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
