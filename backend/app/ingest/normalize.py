"""Normalizers for each source format (docs/06 §2): our ids, per kg, local trade date.

Each returns None when a name cannot be mapped (the row is counted, never guessed) and raises
RowError when the row cannot be used (for example an unreadable date)."""

from datetime import date, datetime
from typing import Any

from app.ingest.providers.base import NormalizedQuote, PriceProvider, RawRow, SourceMaps
from app.timeutil import from_roc

KG_PER_QUINTAL = 100


class RowError(ValueError):
    """A row the pipeline cannot use; counted under `reason` (`malformed` by default)."""

    def __init__(self, message: str, reason: str = "malformed") -> None:
        super().__init__(message)
        self.reason = reason


def number(value: Any) -> float | None:
    """Source numbers may be strings, blanks or placeholders such as "NR"."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        return float(value)
    text = str(value).strip().replace(",", "")
    try:
        return float(text)
    except ValueError:
        return None


def _per_kg(value: float | None, kg_per_unit: float) -> float | None:
    return None if value is None else value / kg_per_unit


def _dmy(text: Any) -> date:
    try:
        return datetime.strptime(str(text).strip(), "%d/%m/%Y").date()
    except ValueError as exc:
        raise RowError(f"bad date {text!r}") from exc


def _roc(text: Any) -> date:
    try:
        return from_roc(str(text))
    except ValueError as exc:
        raise RowError(f"bad ROC date {text!r}") from exc


def datagov_mandi(raw: RawRow, maps: SourceMaps, source: str) -> NormalizedQuote | None:
    """data.gov.in mandi prices: ₹ per quintal; modal price is the representative price."""
    market = maps.market("IN", raw.get("market", ""))
    crop = maps.crop("IN", raw.get("commodity", ""), raw.get("variety", ""))
    if market is None or crop is None or market not in maps.market_area:
        return None
    arrivals_qtl = number(raw.get("arrival_qtl"))
    return NormalizedQuote(
        source=source,
        country="IN",
        price_type="wholesale",
        area_id=maps.market_area[market],
        market_id=market,
        crop_id=crop,
        variety=str(raw.get("variety", "")).strip(),
        trade_date=_dmy(raw.get("arrival_date")),
        rep_price=_per_kg(number(raw.get("modal_price")), KG_PER_QUINTAL),
        low_price=_per_kg(number(raw.get("min_price")), KG_PER_QUINTAL),
        high_price=_per_kg(number(raw.get("max_price")), KG_PER_QUINTAL),
        volume_kg=None if arrivals_qtl is None else arrivals_qtl * KG_PER_QUINTAL,
    )


def in_retail(raw: RawRow, maps: SourceMaps, source: str) -> NormalizedQuote | None:
    """India retail survey: ₹ per kg for a reporting centre (an area, no market)."""
    area = maps.area("IN", raw.get("centre", ""))
    crop = maps.crop("IN", raw.get("commodity", ""))
    if area is None or crop is None:
        return None
    return NormalizedQuote(
        source=source,
        country="IN",
        price_type="retail",
        area_id=area,
        market_id=None,
        crop_id=crop,
        variety="",
        trade_date=_dmy(raw.get("date")),
        rep_price=number(raw.get("retail_price")),
    )


def moa_farmtrans(
    raw: RawRow, maps: SourceMaps, source: str, *, exact: bool = False
) -> NormalizedQuote | None:
    """Taiwan MOA FarmTransData: NT$ per kg; the average price is the representative price.

    `exact` maps only the listed (name, variety) pairs (the real source). The API also sends a
    closure notice per market and category (作物代號 "rest", prices 0); it is not a price."""
    if raw.get("作物代號") == "rest":
        raise RowError(f"closure notice from {raw.get('市場名稱')!r}", reason="market_closed")
    name, _, variety = str(raw.get("作物名稱", "")).partition("-")
    market = maps.market("TW", raw.get("市場名稱", ""))
    crop = maps.crop("TW", name, variety, exact=exact)
    if market is None or crop is None or market not in maps.market_area:
        return None
    return NormalizedQuote(
        source=source,
        country="TW",
        price_type="wholesale",
        area_id=maps.market_area[market],
        market_id=market,
        crop_id=crop,
        variety=variety.strip(),
        trade_date=_roc(raw.get("交易日期")),
        rep_price=number(raw.get("平均價")),
        low_price=number(raw.get("下價")),
        high_price=number(raw.get("上價")),
        volume_kg=number(raw.get("交易量")),
    )


def tw_retail(raw: RawRow, maps: SourceMaps, source: str) -> NormalizedQuote | None:
    """Taiwan retail price survey: NT$ per kg for a city or county."""
    area = maps.area("TW", raw.get("縣市", ""))
    crop = maps.crop("TW", raw.get("品項", ""))
    if area is None or crop is None:
        return None
    return NormalizedQuote(
        source=source,
        country="TW",
        price_type="retail",
        area_id=area,
        market_id=None,
        crop_id=crop,
        variety="",
        trade_date=_roc(raw.get("調查日期")),
        rep_price=number(raw.get("零售價")),
    )


def normalize_all(
    provider: PriceProvider, rows: list[RawRow], maps: SourceMaps
) -> tuple[list[NormalizedQuote], dict[str, int]]:
    """Normalizes a batch; unmapped and malformed rows are counted, not raised."""
    quotes: list[NormalizedQuote] = []
    counts: dict[str, int] = {}
    for raw in rows:
        try:
            quote = provider.normalize(raw, maps)
        except RowError as exc:
            counts[exc.reason] = counts.get(exc.reason, 0) + 1
            continue
        if quote is None:
            counts["unmapped"] = counts.get("unmapped", 0) + 1
        else:
            quotes.append(quote)
    return quotes, counts
