"""India Agmarknet 2.0 provider (docs/06 §1.6): real wholesale prices of the mandis (APMCs).

The backend API of the official site (agmarknet.gov.in) needs no key but is undocumented, so a
run asks little, one request after another. One request is one state × one commodity × one
month: every market's minimum, maximum and modal price in ₹ per quintal and its arrivals in
tonnes, by date and variety. The answer is the month so far, so a late report is picked up by
asking for the month again. The same data is published on data.gov.in under the Government Open
Data License – India.

The name maps in the seed decide what is asked for: crops by commodity id, markets by
"<state id>|<market name>" (a market name is only unique within a state), so the states to ask
come from the mapped markets.

`fetch(day)` keeps the pipeline's one-day contract. The first call of a run asks for every
(state, commodity) pair in each month of the planned days and keeps the rows of the planned
days; the later calls read from that batch."""

import asyncio
import json
import logging
from collections.abc import Callable, Sequence
from datetime import date, datetime, timedelta
from typing import Any

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
)
from app.seed.schema import SeedFile

SOURCE = "in_agmarknet"
URL = "https://api.agmarknet.gov.in/v1/prices-and-arrivals/date-wise/specific-commodity"
REFRESH_DAYS = 3  # every run also reads today and the two days before (late reports)
REFRESH_HOURS = "20"  # India time: once in the evening, when most markets have reported
# The columns a row must have, and the units their titles must name.
COLUMNS = {
    "arrivalDate": "",
    "arrivals": "Tonnes",
    "variety": "",
    "minimumPrice": "Quintal",
    "maximumPrice": "Quintal",
    "modalPrice": "Quintal",
}
PRICE_FIELDS = ("arrivals", "variety", "minimumPrice", "maximumPrice", "modalPrice")
# The source answers 403 to a generic client name, so every request says who we are.
HEADERS = {
    "User-Agent": "agri-prices/1.0 (Meichu Hackathon 2026 project; agricultural price app)",
    "Accept": "application/json",
}

logger = logging.getLogger("app.ingest.in_agmarknet")


def codes_from_seeds(seeds: Sequence[SeedFile]) -> tuple[list[str], list[str]]:
    """(state ids, commodity ids) to ask for, from `source_maps.in_agmarknet`, in seed order."""
    states: list[str] = []
    commodities: list[str] = []
    for seed in seeds:
        maps = seed.source_maps.get(SOURCE)
        if maps is None:
            continue
        for m in maps.markets:
            state = m.source_market.split("|", 1)[0]
            if state not in states:
                states.append(state)
        for c in maps.crops:
            if c.source_name not in commodities:
                commodities.append(c.source_name)
    return states, commodities


def _flatten(payload: Any, state: str, commodity: str, wanted: set[str]) -> list[RawRow]:
    """The rows of the planned days, one per market, date and variety, in the source's own
    field names plus the state and commodity of the request."""
    if not isinstance(payload, dict) or payload.get("success") is not True:
        raise UpstreamError(f"Agmarknet refused the query: {str(payload)[:200]}")
    columns = {c.get("key"): str(c.get("title", "")) for c in payload.get("columns") or []}
    for key, unit in COLUMNS.items():
        if key not in columns or unit not in columns[key]:
            raise UpstreamError(f"Agmarknet columns changed: {columns}")
    markets = payload.get("markets")
    if not isinstance(markets, list):
        raise UpstreamError("Agmarknet answer has no market list")
    rows: list[RawRow] = []
    for market in markets:
        for day in market.get("dates") or []:
            if day.get("arrivalDate") not in wanted:
                continue
            for entry in day.get("data") or []:
                rows.append(
                    {
                        "stateId": state,
                        "commodityId": commodity,
                        "marketName": market.get("marketName", ""),
                        "arrivalDate": day["arrivalDate"],
                    }
                    | {k: entry.get(k) for k in PRICE_FIELDS}
                )
    return rows


async def _json(response: httpx.Response) -> Any:
    try:
        return json.loads(await response.aread())
    except ValueError as exc:
        raise UpstreamError(f"Agmarknet answered with something that is not JSON: {exc}") from exc


class AgmarknetProvider:
    source = SOURCE
    countries: tuple[str, ...] = ("IN",)

    def __init__(
        self,
        states: Sequence[str],
        commodities: Sequence[str],
        today_of: Callable[[str], date],
        *,
        plan: Sequence[date] | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Sleep = asyncio.sleep,
        policy: RetryPolicy | None = None,
    ) -> None:
        """`plan`: the trade dates to fetch (default: the whole window)."""
        self.states = list(states)
        self.commodities = list(commodities)
        self.plan = sorted(plan) if plan is not None else None
        self.stats = FetchStats()
        self._today_of = today_of
        self._transport = transport
        self._sleep = sleep
        self._policy = policy or RetryPolicy()
        self._batch: tuple[date, dict[date, list[RawRow]]] | None = None  # (today, by date)

    # ---------- fetch ----------

    def _days(self, today: date) -> list[date]:
        if self.plan is None:
            return [today - timedelta(days=i) for i in reversed(range(WINDOW_DAYS))]
        return [d for d in self.plan if d <= today]

    async def fetch(self, day: date) -> list[RawRow]:
        today = self._today_of("IN")
        days = self._days(today)
        if day not in days:
            return []
        if self._batch is None or self._batch[0] != today:
            self._batch = (today, await self._download(days))
        return self._batch[1].get(day, [])

    async def _download(self, days: list[date]) -> dict[date, list[RawRow]]:
        wanted = {d.strftime("%d/%m/%Y") for d in days}
        months = sorted({(d.year, d.month) for d in days})
        by_day: dict[date, list[RawRow]] = {}
        http = Fetcher(
            "Agmarknet", policy=self._policy, transport=self._transport, sleep=self._sleep
        )
        try:
            async with http:
                for year, month in months:
                    for state in self.states:
                        for commodity in self.commodities:
                            params = {
                                "year": str(year),
                                "month": str(month),
                                "stateId": state,
                                "commodityId": commodity,
                                "includeExcel": "false",
                            }
                            what = f"state {state}, commodity {commodity}, {year}-{month:02d}"
                            payload = await http.get(
                                URL, params=params, read=_json, headers=HEADERS, what=what
                            )
                            for row in _flatten(payload, state, commodity, wanted):
                                day = datetime.strptime(row["arrivalDate"], "%d/%m/%Y").date()
                                by_day.setdefault(day, []).append(row)
        finally:
            self.stats.requests += http.requests
        logger.info(
            "in_agmarknet: %d rows for %d days in %d months, %d requests",
            sum(len(rows) for rows in by_day.values()),
            len(days),
            len(months),
            self.stats.requests,
        )
        return by_day

    # ---------- normalize ----------

    def normalize(self, raw: RawRow, maps: SourceMaps) -> NormalizedQuote | None:
        return fmt.agmarknet(raw, maps, SOURCE)


def _build(ctx: BuildContext) -> AgmarknetProvider:
    states, commodities = codes_from_seeds(ctx.seeds)
    return AgmarknetProvider(states, commodities, ctx.today_of, plan=ctx.days)


INFO = SourceInfo(
    id=SOURCE,
    countries=AgmarknetProvider.countries,
    price_types=("wholesale",),
    build=_build,
    network=True,
    refresh_days=REFRESH_DAYS,
    refresh_hours=REFRESH_HOURS,
    fresh_for=timedelta(hours=6),
)
