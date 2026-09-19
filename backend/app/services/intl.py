"""International reference prices (bonus B5, docs/06 §1.3): the World Bank Pink Sheet's monthly
US dollar prices, shown per kg in the country's currency. Every month is converted with the
latest daily rate (the page says so, with the rate's date); the published US dollar price is
kept next to it. A missing price or rate stays None with a reason; nothing is filled in."""

from collections.abc import Mapping, Sequence
from datetime import date, datetime
from statistics import mean
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import FxRate, IntlPrice, IntlSeries
from app.errors import ApiError
from app.repositories import intl as repo
from app.services import stats
from app.services.catalog import require_country
from app.timeutil import local_today

KG_PER_UNIT = {"mt": 1000.0, "kg": 1.0}
TREND_MONTHS = 12
# The list looks this far back from the newest month anywhere, so a series that lags the
# others still shows its own latest month.
LOOKBACK_MONTHS = 24
PINK_SOURCE = "wb_pink"


def add_months(month: date, n: int) -> date:
    """First day of the month `n` months after `month` (negative = before)."""
    index = month.year * 12 + month.month - 1 + n
    return date(index // 12, index % 12 + 1, 1)


def per_kg(usd: float, unit: str, per_usd: float | None) -> float | None:
    """A published price (US dollars per `unit`) in local currency per kg."""
    if per_usd is None:
        return None
    return usd / KG_PER_UNIT[unit] * per_usd


def _money(value: float | None) -> float | None:
    return None if value is None else round(value, 4)


def _rate(rate: FxRate | None) -> float | None:
    return None if rate is None else float(rate.per_usd)


def item_view(
    series: IntlSeries, points: Mapping[date, float], rate: FxRate | None
) -> dict[str, Any]:
    """One series: its latest month, the price there and the change from the month before."""
    per_usd = _rate(rate)
    month = max(points) if points else None
    usd = points[month] if month else None
    price = per_kg(usd, series.unit, per_usd) if usd is not None else None
    change = None
    if month is not None and usd is not None:
        prev_month = add_months(month, -1)
        prev = points.get(prev_month)
        moved = stats.change(usd, prev, prev_month)
        if moved is not None and prev is not None:
            prev_price = per_kg(prev, series.unit, per_usd)
            change = {
                "pct": round(moved.pct, 6),
                "diff_per_kg": None
                if price is None or prev_price is None
                else round(price - prev_price, 4),
                "direction": moved.direction,
                "prev_month": prev_month,
            }
    reason = "no_data" if month is None else "no_fx" if per_usd is None else None
    return {
        "id": series.id,
        "name": series.name,
        "spec": series.spec,
        "source_name": series.source_column,
        "icon": series.icon,
        "category": series.category,
        "month": month,
        "usd": usd,
        "usd_unit": series.unit,
        "price_per_kg": _money(price),
        "reason": reason,
        "change": change,
    }


def trend_view(
    series: IntlSeries, points: Mapping[date, float], rate: FxRate | None
) -> dict[str, Any]:
    """The 12 months up to the latest one (None where the month has no price), with their
    high, low and average, and the latest price against that average."""
    per_usd = _rate(rate)
    item = item_view(series, points, rate)
    month: date | None = item["month"]
    months = [add_months(month, i - TREND_MONTHS + 1) for i in range(TREND_MONTHS)] if month else []
    rows: list[dict[str, Any]] = []
    values: list[float] = []
    for m in months:
        usd = points.get(m)
        local = _money(per_kg(usd, series.unit, per_usd)) if usd is not None else None
        rows.append({"month": m, "usd": usd, "price_per_kg": local})
        if local is not None:
            values.append(local)
    average = mean(values) if values else None
    price = item["price_per_kg"]
    vs_avg = None
    if price is not None and average:
        vs_avg = round(price / average - 1, 6)
    return item | {
        "series": rows,
        "stats": {
            "high_per_kg": max(values) if values else None,
            "low_per_kg": min(values) if values else None,
            "avg_per_kg": _money(average),
            "vs_avg_pct": vs_avg,
        },
    }


def _by_series(rows: Sequence[IntlPrice]) -> dict[str, dict[date, float]]:
    out: dict[str, dict[date, float]] = {}
    for row in rows:
        out.setdefault(row.series_id, {})[row.month] = float(row.usd)
    return out


def _fx_out(rate: FxRate | None) -> dict[str, Any] | None:
    if rate is None:
        return None
    return {"currency": rate.currency, "per_usd": float(rate.per_usd), "rate_date": rate.rate_date}


async def _context(session: AsyncSession, cc: str, now: datetime) -> dict[str, Any]:
    country = await require_country(session, cc)
    rate = await repo.get_rate(session, country.currency)
    source = await repo.get_source(session, PINK_SOURCE)
    return {
        "country": country.code,
        "currency": country.currency,
        "today": local_today(country.utc_offset_min, now),
        "fx": rate,
        "published": source.data_date if source else None,
    }


async def _since(session: AsyncSession) -> date | None:
    newest = await repo.latest_month(session)
    return add_months(newest, -LOOKBACK_MONTHS) if newest else None


async def intl_prices(session: AsyncSession, cc: str, now: datetime) -> dict[str, Any]:
    """Every series of the page, in the seed's order (the list, keys 1–6)."""
    context = await _context(session, cc, now)
    since = await _since(session)
    points = _by_series(await repo.prices_since(session, since)) if since else {}
    rate = context["fx"]
    items = [item_view(s, points.get(s.id, {}), rate) for s in await repo.get_series(session)]
    return context | {"fx": _fx_out(rate), "items": items}


async def intl_series(
    session: AsyncSession, cc: str, series_id: str, now: datetime
) -> dict[str, Any]:
    """One series with its 12-month trend."""
    context = await _context(session, cc, now)
    series = await repo.get_one_series(session, series_id)
    if series is None:
        raise ApiError(404, "series_not_found", f"Series {series_id!r} not found")
    since = await _since(session)
    rows = await repo.prices_since(session, since, series_id) if since else []
    points = _by_series(rows).get(series_id, {})
    return context | {"fx": _fx_out(context["fx"])} | trend_view(series, points, context["fx"])
