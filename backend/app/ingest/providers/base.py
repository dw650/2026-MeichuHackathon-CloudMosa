"""The contract every data source follows (docs/04 §5.2, docs/06 §1.4).

A source is a `PriceProvider`: it fetches raw rows in the source's own format, then normalizes
each row to a standard quote (per kg, our ids). Its facts live in one `SourceInfo` next to the
provider (countries, price types, window, refresh schedule, whether it downloads anything), and
`app.ingest.registry` collects them, so the worker never needs to know a source by name."""

import hashlib
import json
from collections import Counter
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Literal, Protocol

from app.seed.schema import SeedFile

RawRow = dict[str, Any]
PriceType = Literal["wholesale", "retail"]
WINDOW_DAYS = 60  # the days a run covers: today and the 59 before, as the validator accepts
Validators = Mapping[str, str]  # HTTP cache validators of one file: etag, last_modified


@dataclass(frozen=True)
class NormalizedQuote:
    """One price observation in our units: local currency per kg, our ids, local trade date."""

    source: str
    country: str
    price_type: str  # wholesale | retail
    area_id: str
    market_id: str | None
    crop_id: str
    variety: str
    trade_date: date
    rep_price: float | None  # None when the source left it empty; the validator drops it
    low_price: float | None = None
    high_price: float | None = None
    volume_kg: float | None = None


@dataclass(frozen=True)
class SourceMaps:
    """Name maps for one source, loaded from source_*_map (keys include the country)."""

    crops: dict[tuple[str, str, str], str]  # (country, source_name, source_variety) → crop
    markets: dict[tuple[str, str], str]  # (country, source_market) → market
    areas: dict[tuple[str, str], str]  # (country, source_area) → area
    market_area: dict[str, str]  # market → area

    def crop(
        self, country: str, name: str, variety: str = "", *, exact: bool = False
    ) -> str | None:
        """Exact (name, variety) first, then the name alone (empty variety = any). With
        `exact`, only listed pairs match and an empty variety means "no variety"."""
        key = (country, name.strip(), variety.strip())
        if exact:
            return self.crops.get(key)
        return self.crops.get(key) or self.crops.get((country, name.strip(), ""))

    def market(self, country: str, name: str) -> str | None:
        return self.markets.get((country, name.strip()))

    def area(self, country: str, name: str) -> str | None:
        return self.areas.get((country, name.strip()))

    def fingerprint(self) -> str:
        """Changes whenever a name map of the source changes (or a mapped market moves)."""
        mapped = set(self.markets.values())
        payload = [
            sorted(self.crops.items()),
            sorted(self.markets.items()),
            sorted(self.areas.items()),
            sorted((m, a) for m, a in self.market_area.items() if m in mapped),
        ]
        text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        return hashlib.sha256(text.encode()).hexdigest()


@dataclass
class FetchStats:
    """What a provider's fetches cost in one run, and what they left out before normalizing."""

    requests: int = 0  # HTTP requests sent, retries included
    # Rows skipped while reading a download (for example the unmapped rows of a big file that
    # is filtered as it streams in), per reason; they count as dropped rows of the run.
    dropped: Counter[str] = field(default_factory=Counter)
    # Cache validators of the files downloaded in full, by URL; kept with a successful run so
    # the next runs can ask "has it changed?" instead of downloading it again.
    files: dict[str, dict[str, str]] = field(default_factory=dict)


class PriceProvider(Protocol):
    source: str
    countries: tuple[str, ...]
    stats: FetchStats

    async def fetch(self, day: date) -> list[RawRow]:
        """Raw rows for one trade date, in the source's format (the mock does the same). A
        network source downloads what the run needs on the first call and answers the later
        calls from that batch; days it was not asked for give no rows and no request."""
        ...

    def normalize(self, raw: RawRow, maps: SourceMaps) -> NormalizedQuote | None:
        """Our standard quote, or None when a name cannot be mapped (never guessed)."""
        ...


@dataclass(frozen=True)
class BuildContext:
    """What the worker gives a source's factory for one run."""

    seeds: Sequence[SeedFile]
    countries: tuple[str, ...]  # the countries the source covers in this run
    today_of: Callable[[str], date]  # a country's local date
    # Network sources: the trade dates to fetch (docs/06 §8); None = the whole window.
    days: tuple[date, ...] | None = None
    # Network sources: validators of files an earlier run already ingested, by URL.
    files: Mapping[str, Validators] = field(default_factory=dict)


@dataclass(frozen=True)
class SourceInfo:
    """Everything the worker needs to know about a source, declared next to its provider."""

    id: str  # `PROVIDERS` value, quotes.source and ingest_runs.source
    countries: tuple[str, ...]  # the countries it covers (the fallback source covers the rest)
    price_types: tuple[PriceType, ...]
    build: Callable[[BuildContext], PriceProvider]
    network: bool = False  # downloads from the internet: the fetch policy applies
    # Covers every seeded country no other enabled source covers (the mock), so a country
    # always has exactly one source.
    fallback: bool = False
    window_days: int = WINDOW_DAYS
    refresh_days: int = 0  # scheduled runs always fetch today and the days before, this many
    refresh_hours: str | None = None  # hourly refresh (cron hours, the country's local time)
    # Start-up run skipped when the last successful run is younger than this.
    fresh_for: timedelta = timedelta(0)
