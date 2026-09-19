"""Taiwan MOA FarmTransData provider (docs/06 §1, bonus B2): real wholesale prices.

The open data API needs no key. It filters by a ROC date range and a crop name (a substring
of 作物名稱) and pages with $top/$skip (at most 10 000 rows per answer). Every answer also
carries the market-closure notices of the period, whatever the crop.

`fetch(day)` keeps the pipeline's one-day contract, but the first call of a run downloads the
provider's whole window with one request per mapped product (sequential, spaced out, retried
with backoff) and the later calls read from that batch: a run costs about 20 requests instead
of one per day and product. The rows then go through the same normalizer as the mock's Taiwan
rows, with exact (name, variety) matching."""

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable, Sequence
from datetime import date, timedelta

import httpx

from app.ingest import normalize as fmt
from app.ingest.providers.base import NormalizedQuote, RawRow, SourceMaps
from app.seed.schema import SeedFile
from app.timeutil import to_roc

SOURCE = "tw_moa"
URL = "https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx"
WINDOW_DAYS = 60  # a full run: every day the validator still accepts
REFRESH_DAYS = 3  # an hourly refresh: today and the two days before
PAGE_SIZE = 5000  # one product over 60 days is about 1 500 rows; the API refuses > 10 000
MAX_PAGES = 20
ATTEMPTS = 3
TIMEOUT = httpx.Timeout(60.0, connect=10.0)  # the API takes 2–10 s per answer
PAUSE_S = 1.0  # between two requests
BACKOFF_S = 5.0  # before a retry, doubled each time

logger = logging.getLogger("app.ingest.tw_moa")

Sleep = Callable[[float], Awaitable[None]]


class UpstreamError(RuntimeError):
    """The API failed, refused the query or answered with something that is not a row list."""


def products_from_seeds(seeds: Sequence[SeedFile]) -> list[str]:
    """The product names to ask for ("甘藍-初秋", "香蕉"), from `source_maps.tw_moa`."""
    products: list[str] = []
    for seed in seeds:
        maps = seed.source_maps.get(SOURCE)
        for m in maps.crops if maps else []:
            name = f"{m.source_name}-{m.source_variety}" if m.source_variety else m.source_name
            if name not in products:
                products.append(name)
    return products


def _rows(response: httpx.Response) -> list[RawRow]:
    try:
        payload = response.json()
    except ValueError as exc:
        raise UpstreamError(
            f"FarmTransData answered with something that is not JSON: {exc}"
        ) from exc
    if not isinstance(payload, list) or not all(isinstance(r, dict) for r in payload):
        raise UpstreamError(f"FarmTransData answer is not a list of rows: {str(payload)[:200]}")
    errors = [r["errMsg"] for r in payload if "errMsg" in r]
    if errors:
        raise UpstreamError(f"FarmTransData refused the query: {errors[0]}")
    return payload


class TwMoaProvider:
    source = SOURCE
    countries: tuple[str, ...] = ("TW",)

    def __init__(
        self,
        products: Sequence[str],
        today_of: Callable[[str], date],
        *,
        days: int = WINDOW_DAYS,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Sleep = asyncio.sleep,
        page_size: int = PAGE_SIZE,
        attempts: int = ATTEMPTS,
    ) -> None:
        self.products = list(products)
        self.days = days
        self._today_of = today_of
        self._transport = transport
        self._sleep = sleep
        self._page_size = page_size
        self._attempts = attempts
        self._requests = 0
        self._batch: tuple[date, dict[str, list[RawRow]]] | None = None  # (today, by ROC date)

    # ---------- fetch ----------

    async def fetch(self, day: date) -> list[RawRow]:
        today = self._today_of("TW")
        first = today - timedelta(days=self.days - 1)
        if not first <= day <= today:
            return []
        if self._batch is None or self._batch[0] != today:
            self._batch = (today, await self._download(first, today))
        return self._batch[1].get(to_roc(day), [])

    async def _download(self, first: date, last: date) -> dict[str, list[RawRow]]:
        """Every product over [first, last], grouped by the ROC trade date. Rows repeated
        across answers (the closure notices) are kept once."""
        by_day: dict[str, list[RawRow]] = {}
        seen: set[str] = set()
        async with httpx.AsyncClient(transport=self._transport, timeout=TIMEOUT) as client:
            for product in self.products:
                for row in await self._product(client, product, first, last):
                    key = json.dumps(row, sort_keys=True, ensure_ascii=False)
                    if key not in seen:
                        seen.add(key)
                        by_day.setdefault(str(row.get("交易日期", "")).strip(), []).append(row)
        logger.info(
            "tw_moa: %d rows for %s to %s, %d requests", len(seen), first, last, self._requests
        )
        window = {to_roc(first + timedelta(days=i)) for i in range((last - first).days + 1)}
        outside = sum(len(rows) for d, rows in by_day.items() if d not in window)
        if outside:
            logger.warning("tw_moa: %d rows dated outside %s to %s ignored", outside, first, last)
        return by_day

    async def _product(
        self, client: httpx.AsyncClient, product: str, first: date, last: date
    ) -> list[RawRow]:
        rows: list[RawRow] = []
        for page in range(MAX_PAGES):
            params = {
                "StartDate": to_roc(first),
                "EndDate": to_roc(last),
                "Crop": product,
                "$top": str(self._page_size),
                "$skip": str(page * self._page_size),
            }
            batch = await self._get(client, params)
            rows += batch
            if len(batch) < self._page_size:
                return rows
        raise UpstreamError(f"more than {MAX_PAGES} pages for {product!r}")

    async def _get(self, client: httpx.AsyncClient, params: dict[str, str]) -> list[RawRow]:
        """One answer. Busy answers (429, 5xx) and network errors are retried after a growing
        pause; any other error fails the run, which keeps the previous data."""
        if self._requests:
            await self._sleep(PAUSE_S)
        self._requests += 1
        error = ""
        for attempt in range(1, self._attempts + 1):
            if attempt > 1:
                await self._sleep(BACKOFF_S * 2 ** (attempt - 2))
            try:
                response = await client.get(URL, params=params)
            except httpx.TransportError as exc:
                error = repr(exc)
                continue
            if response.status_code == 429 or response.status_code >= 500:
                error = f"HTTP {response.status_code}"
                continue
            if response.is_error:
                raise UpstreamError(f"FarmTransData answered HTTP {response.status_code}")
            return _rows(response)
        raise UpstreamError(
            f"FarmTransData failed {self._attempts} attempts for {params['Crop']!r}: {error}"
        )

    # ---------- normalize ----------

    def normalize(self, raw: RawRow, maps: SourceMaps) -> NormalizedQuote | None:
        return fmt.moa_farmtrans(raw, maps, SOURCE, exact=True)
