"""Estimated prices (docs/06 §3.6).

A real source covers one price type only: Taiwan and India publish wholesale, Malaysia
publishes retail. Rather than leaving the other type empty, the pipeline estimates it from the
reported one with the ratios in `app/seed/derive.yaml`, at the aggregation step, so mock and
real data still share one path and `quotes` keeps holding only what an agency reported.

This module is the pure part: which countries estimate what, and by how much. Writing the rows
is `app.repositories.ingest.aggregate`; saying so on screen is the country's
`estimated_price_types` (docs/02 §2)."""

import hashlib
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from statistics import median

from app.ingest.providers.base import SourceInfo
from app.seed.schema import CountryDerive, DeriveSeedFile, PriceTypeName, SeedFile

# Steps the market spread is quantized to: ±4% lands on 0.2% steps, plenty for a market list.
SPREAD_STEPS = 20


@dataclass(frozen=True)
class Derivation:
    """One country's estimate: `to_type` is worked out from `to_type`'s real counterpart."""

    country: str
    rules: CountryDerive

    @property
    def from_type(self) -> PriceTypeName:
        """The price type the country's source really reports."""
        return self.rules.from_type

    @property
    def to_type(self) -> PriceTypeName:
        """The price type estimated from it."""
        return self.rules.to_type

    def ratio(self, crop_id: str, category: str) -> float:
        """Retail ÷ wholesale for this crop: its own ratio, else its category's, else the
        default. Used the other way round (wholesale = retail ÷ ratio) when estimating
        wholesale, so both directions stay on the same, single set of numbers."""
        rules = self.rules
        if crop_id in rules.crops:
            return rules.crops[crop_id]
        # The seed's keys are the seven categories; anything else falls back to the default.
        for name, ratio in rules.categories.items():
            if name == category:
                return ratio
        return rules.default

    def market_factor(self, market_id: str) -> float:
        """What a derived market price is multiplied by: 1 ± `market_spread`, fixed per market
        (a hash of its id), so an area's derived markets differ from each other but never move
        between runs. 1.0 when the country has no spread."""
        spread = self.rules.market_spread
        if spread <= 0:
            return 1.0
        digest = hashlib.sha256(market_id.encode()).digest()
        steps = int.from_bytes(digest[:8], "big") % (2 * SPREAD_STEPS + 1) - SPREAD_STEPS
        return 1.0 + spread * steps / SPREAD_STEPS

    def market_factors(self, market_ids: Sequence[str]) -> dict[str, float]:
        """The factors of the markets of one area, moved so their median is exactly 1: the
        area's estimate stays the plain divided price (the median of its markets, docs/06
        §3.2) while the markets themselves differ from each other."""
        raw = {market: self.market_factor(market) for market in market_ids}
        if not raw:
            return {}
        middle = median(raw.values())
        return {market: factor / middle for market, factor in raw.items()}


def plan(
    seed: DeriveSeedFile, infos: Sequence[SourceInfo], cover: Mapping[str, Sequence[str]]
) -> dict[str, Derivation]:
    """country → its estimate, for the countries whose enabled source leaves a price type
    empty. A country covered by a source reporting both types (the mock) is left alone, and a
    price type is never estimated from one the source does not report either."""
    reported: dict[str, set[str]] = {}
    for info in infos:
        for country in cover.get(info.id, ()):
            reported.setdefault(country, set()).update(info.price_types)
    plans = {}
    for country, rules in seed.countries.items():
        types = reported.get(country)
        if types is None or rules.to_type in types or rules.from_type not in types:
            continue
        plans[country] = Derivation(country=country, rules=rules)
    return plans


def estimated_price_types(
    plans: Mapping[str, Derivation], seeds: Sequence[SeedFile]
) -> dict[str, list[str]]:
    """What every seeded country estimates, for `countries.estimated_price_types`: the list a
    screen reads to label the price it shows as an estimate. Empty = every price is reported."""
    return {
        seed.country.code: (
            [plans[seed.country.code].to_type] if seed.country.code in plans else []
        )
        for seed in seeds
    }
