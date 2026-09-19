"""Normalizers for each source format (docs/06 §2): our ids, per kg, local trade date.

Each returns None when a name cannot be mapped (the row is counted, never guessed) and raises
RowError when the row cannot be used (for example an unreadable date)."""

from datetime import date, datetime
from typing import Any

from app.ingest.providers.base import NormalizedQuote, PriceProvider, RawRow, SourceMaps
from app.timeutil import from_roc

KG_PER_QUINTAL = 100
KG_PER_TONNE = 1000
SOURCE_KEY_MAX = 80  # width of source_market_map.source_market; longer keys are cut there


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


def _iso(text: Any) -> date:
    try:
        return date.fromisoformat(str(text).strip())
    except ValueError as exc:
        raise RowError(f"bad ISO date {text!r}") from exc


def agmarknet(raw: RawRow, maps: SourceMaps, source: str) -> NormalizedQuote | None:
    """India Agmarknet 2.0: ₹ per quintal and arrivals in tonnes; the modal price is the
    representative price. A market is "<state id>|<market name>" (the source pads some names
    with spaces, collapsed here; cut to SOURCE_KEY_MAX like in the seed); a crop is a commodity
    id, any variety unless the map names one."""
    name = " ".join(str(raw.get("marketName", "")).split())
    market = maps.market("IN", f"{raw.get('stateId', '')}|{name}"[:SOURCE_KEY_MAX])
    variety = str(raw.get("variety", "")).strip()
    crop = maps.crop("IN", str(raw.get("commodityId", "")), variety)
    if market is None or crop is None or market not in maps.market_area:
        return None
    tonnes = number(raw.get("arrivals"))
    return NormalizedQuote(
        source=source,
        country="IN",
        price_type="wholesale",
        area_id=maps.market_area[market],
        market_id=market,
        crop_id=crop,
        variety=variety,
        trade_date=_dmy(raw.get("arrivalDate")),
        rep_price=_per_kg(number(raw.get("modalPrice")), KG_PER_QUINTAL),
        low_price=_per_kg(number(raw.get("minimumPrice")), KG_PER_QUINTAL),
        high_price=_per_kg(number(raw.get("maximumPrice")), KG_PER_QUINTAL),
        volume_kg=None if tonnes is None or tonnes <= 0 else tonnes * KG_PER_TONNE,
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


PRICECATCHER_WET_MARKET = "Pasar Basah"  # premise_type of a wet market in lookup_premise.csv


def pricecatcher_districts(state: str, district: str) -> tuple[str, str]:
    """The seed names a PriceCatcher district "State/District", or a whole state by its name
    alone (a federal territory: PriceCatcher splits W.P. Kuala Lumpur into constituencies). The
    district is tried first."""
    return f"{state}/{district}", state


def pricecatcher(raw: RawRow, maps: SourceMaps, source: str) -> NormalizedQuote | None:
    """Malaysia PriceCatcher (KPDN): one price per premise, item and day, in RM per the item's
    unit, joined with the premise's row of lookup_premise.csv (type, state, district). The seed
    maps only items sold per kg, matched exactly by item code.

    A premise mapped to a market (the wholesale "Borong" premises) gives a wholesale quote; a
    wet market of a mapped district gives a retail point of that area, and the pipeline keeps
    the median of an area's points. Any other premise or item is unmapped."""
    item = str(raw.get("item_code", "")).strip()
    premise = str(raw.get("premise_code", "")).strip()
    crop = maps.crop("MY", item, exact=True)
    market = maps.market("MY", premise)
    area: str | None = None
    if market:
        area = maps.market_area.get(market)
    elif str(raw.get("premise_type", "")).strip() == PRICECATCHER_WET_MARKET:
        state = str(raw.get("state", "")).strip()
        district = str(raw.get("district", "")).strip()
        for name in pricecatcher_districts(state, district):
            area = maps.area("MY", name)
            if area:
                break
    if crop is None or area is None:
        return None
    return NormalizedQuote(
        source=source,
        country="MY",
        price_type="wholesale" if market else "retail",
        area_id=area,
        market_id=market,
        crop_id=crop,
        variety=item,
        trade_date=_iso(raw.get("date")),
        rep_price=number(raw.get("price")),
        point="" if market else premise,
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
