"""Provider interface (docs/04 §5.2): fetch raw rows in the source's own format, then
normalize each row to a standard quote (per kg, our ids)."""

from dataclasses import dataclass
from datetime import date
from typing import Any, Protocol

RawRow = dict[str, Any]


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


class PriceProvider(Protocol):
    source: str
    countries: tuple[str, ...]

    async def fetch(self, day: date) -> list[RawRow]:
        """Raw rows for one trade date, in the source's format (the mock does the same)."""
        ...

    def normalize(self, raw: RawRow, maps: SourceMaps) -> NormalizedQuote | None:
        """Our standard quote, or None when a name cannot be mapped (never guessed)."""
        ...
