"""Cross-country reference prices (docs/02 §5.4, docs/06 §4.1): what the same crop costs in
the other countries that grow it.

A country's national price is the median of its area prices on that country's latest trading
day for the crop, with the number of areas behind it — the area price rule one level up. It is
converted to the viewer's currency with the stored US-dollar rates (bonus B5's `fx_rates`), so
the phone gets numbers it can put straight next to the local price. Wholesale and retail are
not the same trade, so every row carries the price type it came from. A country without a
price, or a currency without a rate, keeps None and a reason; nothing is filled in."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date
from statistics import median

from app.services.compare import PRICE_DECIMALS
from app.services.intl import KG_PER_UNIT

PRICE_TYPES = ("wholesale", "retail")

# One area price of a country: price type, trade date, price per kg in that country's currency.
Point = tuple[str, date, float]


@dataclass(frozen=True)
class Rate:
    """Units of a currency for one US dollar, on the day the provider published it."""

    per_usd: float
    rate_date: date


@dataclass(frozen=True)
class CountryPoints:
    country: str
    currency: str
    points: Sequence[Point]


@dataclass(frozen=True)
class Row:
    country: str
    currency: str
    price_type: str | None
    local_per_kg: float | None
    price_per_kg: float | None  # in the viewer's currency
    n_areas: int
    trade_date: date | None
    reason: str | None  # "no_data" or "no_fx"


# A crop whose world price the Pink Sheet publishes (bonus B5's series), for the last row.
WORLD_SERIES = {
    "rice": "rice",
    "wheat": "wheat",
    "maize": "maize",
    "soybean": "soybeans",
    "sugarcane": "sugar",
}


@dataclass(frozen=True)
class World:
    """The World Bank's monthly world price of the crop: a reference, not a country."""

    series_id: str
    month: date | None
    usd: float | None
    usd_unit: str
    price_per_kg: float | None
    reason: str | None


@dataclass(frozen=True)
class Card:
    currency: str  # the viewer's
    fx_date: date | None  # oldest rate behind a converted row; None when nothing was converted
    rows: list[Row]
    world: World | None


def national(points: Sequence[Point], price_type: str) -> tuple[date, float, int] | None:
    """Latest trading day of `price_type`, the median of its area prices and how many areas."""
    days = [p for p in points if p[0] == price_type]
    if not days:
        return None
    day = max(p[1] for p in days)
    prices = [p[2] for p in days if p[1] == day]
    return day, round(median(prices), PRICE_DECIMALS), len(prices)


def pick_type(points: Sequence[Point], preferred: str) -> str | None:
    """The price type to show for a country: the viewer's when it has one, else the other.

    Countries report what their source publishes (Malaysia only retail, Taiwan and India only
    wholesale), so a row is shown labelled rather than dropped."""
    have = {p[0] for p in points}
    for kind in (preferred, *PRICE_TYPES):
        if kind in have:
            return kind
    return None


def convert(local: float, frm: Rate | None, to: Rate | None) -> float | None:
    """A price in `frm`'s currency expressed in `to`'s, through the US dollar."""
    if frm is None or to is None:
        return None
    return local / frm.per_usd * to.per_usd


def _row(other: CountryPoints, price_type: str, rates: Mapping[str, Rate], base: str) -> Row:
    kind = pick_type(other.points, price_type)
    found = national(other.points, kind) if kind else None
    if kind is None or found is None:
        return Row(other.country, other.currency, None, None, None, 0, None, "no_data")
    day, local, n_areas = found
    # The same currency needs no rate at all.
    price: float | None = (
        local
        if other.currency == base
        else convert(local, rates.get(other.currency), rates.get(base))
    )
    return Row(
        country=other.country,
        currency=other.currency,
        price_type=kind,
        local_per_kg=local,
        price_per_kg=None if price is None else round(price, PRICE_DECIMALS),
        n_areas=n_areas,
        trade_date=day,
        reason=None if price is not None else "no_fx",
    )


def _used_rate_dates(row: Row, rates: Mapping[str, Rate], base: str) -> list[date]:
    if row.price_per_kg is None or row.currency == base:
        return []
    return [rates[c].rate_date for c in (row.currency, base)]


def world_row(
    crop_id: str, month: date | None, usd: float | None, unit: str, to: Rate | None
) -> World | None:
    """The crop's world price per kg in the viewer's currency, when the Pink Sheet has it."""
    series_id = WORLD_SERIES.get(crop_id)
    if series_id is None:
        return None
    if month is None or usd is None:
        return World(series_id, None, None, unit, None, "no_data")
    per_kg = usd / KG_PER_UNIT[unit]
    price = None if to is None else round(per_kg * to.per_usd, PRICE_DECIMALS)
    return World(
        series_id=series_id,
        month=month,
        usd=usd,
        usd_unit=unit,
        price_per_kg=price,
        reason=None if price is not None else "no_fx",
    )


def card(
    currency: str,
    price_type: str,
    others: Sequence[CountryPoints],
    rates: Mapping[str, Rate],
    world: World | None = None,
) -> Card:
    """The 各國參考價 card. With no other country it still carries the empty list, so the screen
    can say that nobody else reports this crop instead of showing an empty box."""
    rows = [_row(o, price_type, rates, currency) for o in others]
    dates = [d for row in rows for d in _used_rate_dates(row, rates, currency)]
    if world is not None and world.price_per_kg is not None and currency in rates:
        dates.append(rates[currency].rate_date)
    return Card(currency=currency, fx_date=min(dates) if dates else None, rows=rows, world=world)
