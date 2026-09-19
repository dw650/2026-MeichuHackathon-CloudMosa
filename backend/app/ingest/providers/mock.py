"""Mock provider (docs/06 §7): deterministic data in the real sources' formats.

India wholesale looks like Agmarknet 2.0 rows (₹ per quintal, arrivals in tonnes,
dd/mm/yyyy); India retail like DoCA rows (₹ per kg). Taiwan wholesale looks like MOA
FarmTransData rows (NT$ per kg, Minguo dates); Taiwan retail like price survey rows.
Malaysia looks like PriceCatcher rows joined with the premise lookup (RM per kg, one price
per premise: a wholesale market, or one made-up wet market per district). Two metadata keys
route each row: `_country` and `_type` (wholesale | retail); everything else mimics the
source.
"""

import hashlib
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, timedelta
from functools import cache
from typing import Any

from app.ingest import normalize as fmt
from app.ingest.providers.base import (
    WINDOW_DAYS,
    BuildContext,
    FetchStats,
    NormalizedQuote,
    RawRow,
    SourceInfo,
    SourceMaps,
)
from app.seed.schema import AreaSeed, CropSeed, MarketSeed, SeedFile
from app.timeutil import to_roc

SOURCE = "mock"
WALK_STEP = 0.035  # daily random walk ±3.5%
MARKET_NOISE = 0.02  # market price ±2%
RETAIL_NOISE = 0.025  # retail price ±2.5%
VOLUME_NOISE = 0.10  # daily volume ±10%


def unit_random(key: str) -> float:
    """A stable pseudo-random number in [0, 1) derived from `key` (same key, same number)."""
    digest = hashlib.blake2b(key.encode(), digest_size=8).digest()
    return int.from_bytes(digest) / 2**64


def _jitter(key: str, spread: float) -> float:
    return 1 + (unit_random(key) - 0.5) * 2 * spread


@dataclass(frozen=True)
class _Names:
    """Source names the mock prints, inverted from the seed's `source_maps.mock`."""

    crops: dict[str, str]
    markets: dict[str, str]
    areas: dict[str, str]


@cache
def _trading_days(today: date, closed: tuple[int, ...]) -> tuple[date, ...]:
    start = today - timedelta(days=WINDOW_DAYS - 1)
    days = (start + timedelta(days=i) for i in range(WINDOW_DAYS))
    return tuple(d for d in days if d.isoweekday() not in closed)


def _rounded(value: float | None, digits: int | None = None) -> float | None:
    return None if value is None else round(value, digits)


def _pricecatcher(
    day: date, premise: str, item: str, price: float, kind: str, district: str
) -> RawRow:
    """A PriceCatcher row: ISO date, codes as text, the price in RM as the source prints it,
    and the premise's type, state and district from the lookup (`district` as the seed names
    it: "State/District", or a whole federal territory by its state)."""
    state, _, name = district.partition("/")
    return {
        "date": day.isoformat(),
        "premise_code": premise,
        "item_code": item,
        "price": repr(round(price, 2)),
        "premise_type": kind,
        "state": state,
        "district": name,
    }


def _max_lag(*lags: int | None) -> int | None:
    """Combined lag; None (never any data) wins."""
    if any(lag is None for lag in lags):
        return None
    return max(lag for lag in lags if lag is not None)


class MockProvider:
    source = SOURCE

    def __init__(self, seeds: list[SeedFile], today_of: Callable[[str], date]) -> None:
        self.seeds = seeds
        self.countries = tuple(s.country.code for s in seeds)
        self.stats = FetchStats()  # generated locally: no requests, nothing left out
        self._today_of = today_of
        self._series_cache: dict[tuple[str, str, date], dict[date, float]] = {}
        self._volume_cache: dict[tuple[str, str, date], dict[date, float]] = {}
        self._names: dict[str, _Names] = {}
        for seed in seeds:
            maps = seed.source_maps.get(SOURCE)
            if maps is not None:
                self._names[seed.country.code] = _Names(
                    crops={m.crop: m.source_name for m in maps.crops},
                    markets={m.market: m.source_market for m in maps.markets},
                    areas={m.area: m.source_area for m in maps.areas},
                )

    # ---------- fetch ----------

    async def fetch(self, day: date) -> list[RawRow]:
        rows: list[RawRow] = []
        for seed in self.seeds:
            today = self._today_of(seed.country.code)
            if not today - timedelta(days=WINDOW_DAYS - 1) <= day <= today:
                continue
            if day.isoweekday() in seed.country.closed_weekdays:
                continue
            rows += self._rows(seed, day, today)
        return rows

    def _rows(self, seed: SeedFile, day: date, today: date) -> list[RawRow]:
        names = self._names.get(seed.country.code)
        if names is None:
            return []
        rows: list[RawRow] = []
        for crop in seed.crops:
            source_crop = names.crops.get(crop.id)
            if source_crop is None:
                continue
            for area in seed.areas:
                for market in area.markets:
                    lag = _max_lag(area.mock.lag, market.mock.lag, crop.mock.lag)
                    source_market = names.markets.get(market.id)
                    if lag is None or day > today - timedelta(days=lag) or source_market is None:
                        continue
                    rows.append(
                        self._wholesale(
                            seed, day, today, area, market, crop, source_crop, source_market
                        )
                    )
                lag = _max_lag(area.mock.lag, crop.mock.lag)
                source_area = names.areas.get(area.id)
                if (
                    area.retail
                    and crop.mock.rt is not None
                    and lag is not None
                    and day <= today - timedelta(days=lag)
                    and source_area is not None
                ):
                    rows.append(
                        self._retail(seed, day, today, area, crop, source_crop, source_area)
                    )
        return rows

    # ---------- price model ----------

    def _trading_days(self, seed: SeedFile, today: date) -> tuple[date, ...]:
        return _trading_days(today, tuple(seed.country.closed_weekdays))

    def _series(self, seed: SeedFile, crop: CropSeed, today: date) -> dict[date, float]:
        """National level for a crop: the latest trading day = p, the one before = p/(1+chg),
        earlier days a ±3.5% random walk (docs/06 §7.4)."""
        key = (seed.country.code, crop.id, today)
        cached = self._series_cache.get(key)
        if cached is not None:
            return cached
        days = self._trading_days(seed, today)
        series: dict[date, float] = {}
        level = crop.mock.p
        for i, day in enumerate(reversed(days)):
            if i == 1:
                level = crop.mock.p / (1 + crop.mock.chg)
            elif i > 1:
                step = unit_random(f"{seed.country.code}:{crop.id}:{day}:walk") - 0.5
                level = level / (1 + step * 2 * WALK_STEP)
            series[day] = level
        self._series_cache[key] = series
        return series

    def _volume(self, seed: SeedFile, crop: CropSeed, day: date, today: date) -> float | None:
        """Latest trading day = arr; the 7 trading days before average exactly arr / arrR;
        earlier days vary ±10% around that average. None when the crop has no arrivals."""
        if crop.mock.arr is None or crop.mock.arr_ratio is None:
            return None
        key = (seed.country.code, crop.id, today)
        volumes = self._volume_cache.get(key)
        if volumes is None:
            days = self._trading_days(seed, today)
            base = crop.mock.arr / crop.mock.arr_ratio
            volumes = {
                d: base * _jitter(f"{seed.country.code}:{crop.id}:{d}:vol", VOLUME_NOISE)
                for d in days
            }
            prior = days[-8:-1]
            scale = base * len(prior) / sum(volumes[d] for d in prior)
            volumes.update({d: volumes[d] * scale for d in prior})
            volumes[days[-1]] = crop.mock.arr
            self._volume_cache[key] = volumes
        return volumes[day]

    def _market_price(
        self,
        seed: SeedFile,
        day: date,
        today: date,
        area: AreaSeed,
        market: MarketSeed,
        crop: CropSeed,
    ) -> float:
        level = self._series(seed, crop, today)[day]
        noise = _jitter(f"{seed.country.code}:{crop.id}:{market.id}:{day}:mkt", MARKET_NOISE)
        return level * area.mock.k * market.mock.k * noise

    def _retail_price(
        self, seed: SeedFile, day: date, today: date, area: AreaSeed, crop: CropSeed
    ) -> float:
        """Retail moves half as much as wholesale: rt × (p + (level − p) / 2) × area k."""
        assert crop.mock.rt is not None
        level = self._series(seed, crop, today)[day]
        noise = _jitter(f"{seed.country.code}:{crop.id}:{area.id}:{day}:retail", RETAIL_NOISE)
        return crop.mock.rt * (crop.mock.p + (level - crop.mock.p) / 2) * area.mock.k * noise

    # ---------- source formats ----------

    def _wholesale(
        self,
        seed: SeedFile,
        day: date,
        today: date,
        area: AreaSeed,
        market: MarketSeed,
        crop: CropSeed,
        source_crop: str,
        source_market: str,
    ) -> RawRow:
        price = self._market_price(seed, day, today, area, market, crop)
        code = seed.country.code
        head: dict[str, Any] = {"_country": code, "_type": "wholesale"}
        if code == "MY":
            district = self._names[code].areas.get(area.id, "")
            return head | _pricecatcher(day, source_market, source_crop, price, "Borong", district)
        low = None if crop.mock.lo is None else price * crop.mock.lo / crop.mock.p
        high = None if crop.mock.hi is None else price * crop.mock.hi / crop.mock.p
        middle = None if low is None or high is None else (high + low) / 2
        # Each market carries an equal share of the area's arrivals.
        volume = self._volume(seed, crop, day, today)
        share = None if volume is None else volume / len(area.markets)
        if code == "TW":
            return head | {
                "交易日期": to_roc(day),
                "作物名稱": f"{source_crop}-{crop.variety['zh-TW']}",
                "市場名稱": source_market,
                "上價": _rounded(high, 1),
                "中價": _rounded(middle, 1),
                "下價": _rounded(low, 1),
                "平均價": round(price, 1),
                "交易量": _rounded(share),
            }
        if code == "IN":
            # Agmarknet 2.0 rows: ₹ per quintal, arrivals in tonnes, the market as
            # "<state id>|<market name>" in the seed (docs/06 §1.6).
            state, _, name = source_market.partition("|")
            return head | {
                "stateId": state,
                "commodityId": source_crop,
                "marketName": name,
                "arrivalDate": day.strftime("%d/%m/%Y"),
                "arrivals": _rounded(share, 3),
                "variety": crop.variety["en"],
                "minimumPrice": _rounded(low, 0),
                "maximumPrice": _rounded(high, 0),
                "modalPrice": float(round(price)),
            }
        raise ValueError(f"the mock has no wholesale format for {code}")

    def _retail(
        self,
        seed: SeedFile,
        day: date,
        today: date,
        area: AreaSeed,
        crop: CropSeed,
        source_crop: str,
        source_area: str,
    ) -> RawRow:
        price = self._retail_price(seed, day, today, area, crop)
        code = seed.country.code
        head: dict[str, Any] = {"_country": code, "_type": "retail"}
        if code == "MY":
            # The area's source name is its district; the demo makes up one wet market there.
            return head | _pricecatcher(
                day, f"demo-{area.id}", source_crop, price, fmt.PRICECATCHER_WET_MARKET, source_area
            )
        if code == "TW":
            return head | {
                "調查日期": to_roc(day),
                "縣市": source_area,
                "品項": source_crop,
                "零售價": round(price, 1),
            }
        if code == "IN":
            # India retail is quoted per kg: the base price p is per quintal.
            return head | {
                "centre": source_area,
                "state": area.region["en"],
                "commodity": source_crop,
                "date": day.strftime("%d/%m/%Y"),
                "retail_price": f"{price / 100:.2f}",
            }
        raise ValueError(f"the mock has no retail format for {code}")

    # ---------- normalize ----------

    def normalize(self, raw: RawRow, maps: SourceMaps) -> NormalizedQuote | None:
        """Routes each row to the normalizer of the format it imitates."""
        kind = (raw.get("_country"), raw.get("_type"))
        if kind == ("IN", "wholesale"):
            return fmt.agmarknet(raw, maps, SOURCE)
        if kind == ("IN", "retail"):
            return fmt.in_retail(raw, maps, SOURCE)
        if kind == ("TW", "wholesale"):
            return fmt.moa_farmtrans(raw, maps, SOURCE)
        if kind == ("TW", "retail"):
            return fmt.tw_retail(raw, maps, SOURCE)
        if kind in {("MY", "wholesale"), ("MY", "retail")}:
            return fmt.pricecatcher(raw, maps, SOURCE)
        raise fmt.RowError(f"unknown row kind {kind}")


def _build(ctx: BuildContext) -> MockProvider:
    return MockProvider([s for s in ctx.seeds if s.country.code in ctx.countries], ctx.today_of)


# The demo covers every country no real source covers, over the whole window on every run.
INFO = SourceInfo(
    id=SOURCE,
    countries=(),
    price_types=("wholesale", "retail"),
    build=_build,
    fallback=True,
)
