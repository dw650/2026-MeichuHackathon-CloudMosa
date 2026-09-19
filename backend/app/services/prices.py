"""Price views: home list, quote, comparison and markets (docs/04 §6, docs/06 §3–§4).

Every view is built from the aggregate tables; the arithmetic lives in `stats`, `freshness`,
`compare` and `nearby`. Missing prices stay None with a reason; nothing is filled in."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Area, AreaDaily, Country, Crop, MarketDaily
from app.errors import ApiError
from app.repositories import catalog as catalog_repo
from app.repositories import prices as repo
from app.services import stats
from app.services.catalog import require_country
from app.services.compare import competition_ranks, diff, haversine_km, market_rows
from app.services.demo import NO_DEMO, Demo
from app.services.freshness import WINDOW_DAYS, Staleness, is_fresh, staleness
from app.services.nearby import Candidate, Extreme, Place, extremes, nearest
from app.services.sources import source_info
from app.services.stats import Point
from app.timeutil import country_tz, local_today

HISTORY_DAYS = 60  # enough history to find the trading day before the latest one
SPARK_DAYS = 7


# ---------- helpers ----------


def _money(value: object) -> float:
    return round(float(value), 4)  # type: ignore[arg-type]


def _opt_money(value: object | None) -> float | None:
    return None if value is None else _money(value)


def _ratio(value: float | None) -> float | None:
    return None if value is None else round(value, 6)


def _local(moment: datetime | None, country: Country) -> datetime | None:
    if moment is None:
        return None
    return moment.astimezone(country_tz(country.utc_offset_min)).replace(microsecond=0)


def _area_point(row: AreaDaily) -> Point:
    volume = None if row.volume_kg is None else float(row.volume_kg)
    return Point(row.trade_date, _money(row.price), volume, row.n_markets)


def _market_point(row: MarketDaily) -> Point:
    volume = None if row.volume_kg is None else float(row.volume_kg)
    return Point(row.trade_date, _money(row.rep_price), volume, 1)


def _staleness_out(s: Staleness) -> dict[str, Any]:
    return {"days": s.days, "state": s.state}


def _change_out(latest: Point | None, prev: Point | None) -> dict[str, Any] | None:
    if latest is None or prev is None:
        return None
    ch = stats.change(latest.price, prev.price, prev.day)
    if ch is None:
        return None
    return {
        "pct": round(ch.pct, 6),
        "diff_per_kg": round(ch.diff, 4),
        "direction": ch.direction,
        "prev_trade_date": ch.prev_date,
    }


@dataclass(frozen=True)
class _Latest:
    point: Point | None
    prev: Point | None
    staleness: Staleness


def _latest(points: Sequence[Point], today: date, closed: Sequence[int]) -> _Latest:
    """The latest point within the 30-day window and the trading day before it."""
    ordered = sorted(points, key=lambda p: p.day)
    recent = [p for p in ordered if p.day > today - timedelta(days=WINDOW_DAYS)]
    point = recent[-1] if recent else None
    prev = None
    if point is not None:
        earlier = [p for p in ordered if p.day < point.day]
        prev = earlier[-1] if earlier else None
    return _Latest(point, prev, staleness(point.day if point else None, today, closed))


def _reason(area: Area, crop: Crop, price_type: str) -> str:
    if price_type == "retail" and not crop.has_retail:
        return "no_retail_crop"
    if price_type == "retail" and not area.has_retail:
        return "no_retail_area"
    return "no_data"


async def _area_in(session: AsyncSession, country: Country, area_id: str) -> Area:
    area = await catalog_repo.get_area(session, area_id)
    if area is None or area.country != country.code:
        raise ApiError(404, "area_not_found", f"Area {area_id!r} not found in {country.code}")
    return area


async def _crop_in(session: AsyncSession, country: Country, crop_id: str) -> Crop:
    crop = await catalog_repo.get_crop(session, country.code, crop_id)
    if crop is None:
        raise ApiError(404, "crop_not_found", f"Crop {crop_id!r} not found in {country.code}")
    return crop


# ---------- views ----------


async def home_prices(
    session: AsyncSession,
    cc: str,
    area_id: str,
    price_type: str,
    crop_ids: list[str] | None,
    now: datetime,
    demo: Demo = NO_DEMO,
) -> dict[str, Any]:
    """Area price, change and 7-day sparkline of many crops (home and crop lists)."""
    country = await require_country(session, cc)
    area = await _area_in(session, country, area_id)
    today = local_today(country.utc_offset_min, now)
    until = demo.until(area.id, today)
    crops = await catalog_repo.get_crops(session, country.code)
    if crop_ids is not None:
        by_id = {c.id: c for c in crops}
        crops = [by_id[c] for c in dict.fromkeys(crop_ids) if c in by_id]
    rows = await repo.area_daily_rows(
        session,
        country=country.code,
        price_type=price_type,
        start=today - timedelta(days=HISTORY_DAYS - 1),
        end=until,
        area_ids=[area.id],
        crop_ids=[c.id for c in crops],
    )
    by_crop: dict[str, list[AreaDaily]] = {}
    for row in rows:
        by_crop.setdefault(row.crop_id, []).append(row)
    items = []
    fetched: list[datetime] = []
    for crop in crops:
        crop_rows = by_crop.get(crop.id, [])
        points = [_area_point(r) for r in crop_rows]
        latest = _latest(points, today, country.closed_weekdays)
        if latest.point is not None:
            fetched.append(
                next(r.fetched_at for r in crop_rows if r.trade_date == latest.point.day)
            )
        items.append(
            {
                "crop_id": crop.id,
                "price_per_kg": latest.point.price if latest.point else None,
                "reason": None if latest.point else _reason(area, crop, price_type),
                "trade_date": latest.point.day if latest.point else None,
                "staleness": _staleness_out(latest.staleness),
                "change": _change_out(latest.point, latest.prev),
                "spark": [v for _, v in stats.daily_series(points, today, SPARK_DAYS)],
            }
        )
    return {
        "country": country.code,
        "area_id": area.id,
        "type": price_type,
        "currency": country.currency,
        "today": today,
        "fetched_at": _local(max(fetched), country) if fetched else None,
        "items": items,
    }


async def quote(
    session: AsyncSession,
    cc: str,
    area_id: str,
    crop_id: str,
    price_type: str,
    days: int,
    now: datetime,
    demo: Demo = NO_DEMO,
) -> dict[str, Any]:
    """Area price with markets, change, indicators and the daily series (detail screen)."""
    country = await require_country(session, cc)
    area = await _area_in(session, country, area_id)
    crop = await _crop_in(session, country, crop_id)
    today = local_today(country.utc_offset_min, now)
    until = demo.until(area.id, today)
    rows = await repo.area_daily_rows(
        session,
        country=country.code,
        price_type=price_type,
        start=today - timedelta(days=HISTORY_DAYS - 1),
        end=until,
        area_ids=[area.id],
        crop_ids=[crop.id],
    )
    points = [_area_point(r) for r in rows]
    latest = _latest(points, today, country.closed_weekdays)
    point = latest.point
    row = next((r for r in rows if point and r.trade_date == point.day), None)
    total_markets = len(await catalog_repo.get_markets(session, area.id))
    markets: dict[str, Any] | None = None
    if price_type == "wholesale":
        markets = {
            "count": row.n_markets if row else 0,
            "total": total_markets,
            "min_per_kg": _opt_money(row.min_market) if row else None,
            "max_per_kg": _opt_money(row.max_market) if row else None,
        }
    source_id = None
    if point is not None:
        source_id = await repo.quote_source(
            session, area_id=area.id, crop_id=crop.id, price_type=price_type, day=point.day
        )
    return {
        "crop_id": crop.id,
        "area_id": area.id,
        "type": price_type,
        "currency": country.currency,
        "today": today,
        "trade_date": point.day if point else None,
        "staleness": _staleness_out(latest.staleness),
        "fetched_at": _local(row.fetched_at if row else None, country),
        "price_per_kg": point.price if point else None,
        "reason": None if point else _reason(area, crop, price_type),
        "markets": markets,
        "change": _change_out(point, latest.prev),
        "stats": _stats(points, point, today, price_type),
        "series": [
            {"date": d, "price_per_kg": v} for d, v in stats.daily_series(points, today, days)
        ],
        "source": source_info(source_id),
        "nearby": await _nearby(session, country, area, crop, price_type, today, demo, latest),
    }


def _extreme_out(e: Extreme) -> dict[str, Any]:
    return {
        "area_id": e.area_id,
        "price_per_kg": e.price,
        "diff_per_kg": round(e.diff, 4),
        "distance_km": e.distance_km,
        "is_base": e.is_base,
    }


async def _nearby(
    session: AsyncSession,
    country: Country,
    area: Area,
    crop: Crop,
    price_type: str,
    today: date,
    demo: Demo,
    latest: _Latest,
) -> dict[str, Any] | None:
    """Highest and lowest price around the viewed area on its latest trade date (docs/02 §5.4).

    Only a fresh price of the viewed area is compared, and only with nearby areas whose latest
    trade date is the same day, so the card needs no date of its own."""
    point = latest.point
    if point is None or not is_fresh(latest.staleness):
        return None
    areas = await catalog_repo.get_areas(session, country.code)
    places = [Place(a.id, a.lat, a.lon) for a in areas]
    close = nearest(Place(area.id, area.lat, area.lon), places)
    rows = await repo.area_daily_rows(
        session,
        country=country.code,
        price_type=price_type,
        start=point.day,
        end=today,
        area_ids=[area_id for area_id, _ in close],
        crop_ids=[crop.id],
    )
    latest_row: dict[str, AreaDaily] = {}
    for row in rows:  # ordered by date, so the last one per area wins
        if row.trade_date <= demo.until(row.area_id, today):
            latest_row[row.area_id] = row
    neighbours = [
        Candidate(area_id, _money(latest_row[area_id].price), km)
        for area_id, km in close
        if area_id in latest_row and latest_row[area_id].trade_date == point.day
    ]
    found = extremes(area.id, point.price, neighbours)
    if found is None:
        return None
    return {"highest": _extreme_out(found.highest), "lowest": _extreme_out(found.lowest)}


def _stats(
    points: list[Point], point: Point | None, today: date, price_type: str
) -> dict[str, Any]:
    w7 = stats.window(points, today, 7)
    w30 = stats.window(points, today, 30)
    vol = stats.volatility(w7)
    arr = stats.arrivals([p for p in points if point and p.day <= point.day])
    arr = arr if price_type == "wholesale" and point else None
    return {
        "vs_avg7_pct": _ratio(stats.vs_average(point.price, w7)) if point else None,
        "pos30": _ratio(stats.position30(point.price, w30)) if point else None,
        "volatility": vol[1] if vol else None,
        "volatility_pct": _ratio(vol[0]) if vol else None,
        "arrivals": arr[1] if arr else None,
        "arrivals_ratio": _ratio(arr[0]) if arr else None,
        "high7_per_kg": max((p.price for p in w7), default=None),
        "low7_per_kg": min((p.price for p in w7), default=None),
        "high30_per_kg": max((p.price for p in w30), default=None),
        "low30_per_kg": min((p.price for p in w30), default=None),
        "change7_pct": _ratio(stats.range_change(w7)),
        "change30_pct": _ratio(stats.range_change(w30)),
    }


async def compare(
    session: AsyncSession,
    cc: str,
    area_id: str,
    crop_id: str,
    price_type: str,
    now: datetime,
    demo: Demo = NO_DEMO,
) -> dict[str, Any]:
    """Every area of the country: price, straight-line distance, difference and rank."""
    country = await require_country(session, cc)
    base = await _area_in(session, country, area_id)
    crop = await _crop_in(session, country, crop_id)
    today = local_today(country.utc_offset_min, now)
    areas = await catalog_repo.get_areas(session, country.code)
    rows = await repo.area_daily_rows(
        session,
        country=country.code,
        price_type=price_type,
        start=today - timedelta(days=WINDOW_DAYS - 1),
        end=today,
        crop_ids=[crop.id],
    )
    latest_row: dict[str, AreaDaily] = {}
    for row in rows:  # ordered by date, so the last one per area wins
        if row.trade_date <= demo.until(row.area_id, today):
            latest_row[row.area_id] = row
    prices = {
        a.id: _opt_money(latest_row[a.id].price) if a.id in latest_row else None for a in areas
    }
    ranks = competition_ranks(prices)
    base_price = prices[base.id]
    out: list[dict[str, Any]] = []
    for a in areas:
        area_row = latest_row.get(a.id)
        fresh = staleness(area_row.trade_date if area_row else None, today, country.closed_weekdays)
        delta = diff(prices[a.id], base_price)
        out.append(
            {
                "area_id": a.id,
                "price_per_kg": prices[a.id],
                "n_markets": area_row.n_markets if area_row else 0,
                "distance_km": haversine_km(base.lat, base.lon, a.lat, a.lon),
                "diff_per_kg": None if delta is None else round(delta, 4),
                "trade_date": area_row.trade_date if area_row else None,
                "staleness": _staleness_out(fresh),
                "rank": ranks[a.id],
                "is_base": a.id == base.id,
            }
        )

    def display_order(r: dict[str, Any]) -> tuple[bool, float, int]:
        price = r["price_per_kg"]
        return (price is None, -(price or 0.0), r["distance_km"])

    out.sort(key=display_order)
    return {
        "crop_id": crop.id,
        "area_id": base.id,
        "type": price_type,
        "currency": country.currency,
        "today": today,
        "rank": {"position": ranks[base.id], "total": sum(p is not None for p in prices.values())},
        "rows": out,
    }


async def markets(
    session: AsyncSession, cc: str, area_id: str, crop_id: str, now: datetime, demo: Demo = NO_DEMO
) -> dict[str, Any]:
    """Wholesale markets of an area with their difference from the area median."""
    country = await require_country(session, cc)
    area = await _area_in(session, country, area_id)
    crop = await _crop_in(session, country, crop_id)
    today = local_today(country.utc_offset_min, now)
    until = demo.until(area.id, today)
    start = today - timedelta(days=WINDOW_DAYS - 1)
    catalog = await catalog_repo.get_markets(session, area.id)
    rows = await repo.market_daily_rows(
        session, market_ids=[m.id for m in catalog], crop_id=crop.id, start=start, end=until
    )
    latest_row: dict[str, MarketDaily] = {r.market_id: r for r in rows}
    area_rows = await repo.area_daily_rows(
        session,
        country=country.code,
        price_type="wholesale",
        start=start,
        end=until,
        area_ids=[area.id],
        crop_ids=[crop.id],
    )
    area_latest = area_rows[-1] if area_rows else None
    median = _opt_money(area_latest.price) if area_latest else None
    prices = {
        m.id: _opt_money(latest_row[m.id].rep_price) if m.id in latest_row else None
        for m in catalog
    }
    by_id = {m.id: m for m in catalog}
    out = []
    for r in market_rows(prices, median):
        m = by_id[r.market_id]
        row = latest_row.get(m.id)
        fresh = staleness(row.trade_date if row else None, today, country.closed_weekdays)
        out.append(
            {
                "market_id": m.id,
                "name": m.name,
                "km_from_center": m.km_from_center,
                "price_per_kg": r.price,
                "trade_date": row.trade_date if row else None,
                "staleness": _staleness_out(fresh),
                "diff_per_kg": None if r.diff is None else round(r.diff, 4),
            }
        )
    area_fresh = staleness(
        area_latest.trade_date if area_latest else None, today, country.closed_weekdays
    )
    return {
        "crop_id": crop.id,
        "area_id": area.id,
        "currency": country.currency,
        "today": today,
        "median_per_kg": median,
        "trade_date": area_latest.trade_date if area_latest else None,
        "staleness": _staleness_out(area_fresh),
        "rows": out,
    }


async def market(
    session: AsyncSession,
    cc: str,
    crop_id: str,
    market_id: str,
    now: datetime,
    demo: Demo = NO_DEMO,
) -> dict[str, Any]:
    """One market: representative price, change, day range and source."""
    country = await require_country(session, cc)
    crop = await _crop_in(session, country, crop_id)
    found = await catalog_repo.get_market(session, market_id)
    area = await catalog_repo.get_area(session, found.area_id) if found else None
    if found is None or area is None or area.country != country.code:
        raise ApiError(404, "market_not_found", f"Market {market_id!r} not found in {country.code}")
    today = local_today(country.utc_offset_min, now)
    rows = await repo.market_daily_rows(
        session,
        market_ids=[found.id],
        crop_id=crop.id,
        start=today - timedelta(days=HISTORY_DAYS - 1),
        end=demo.until(area.id, today),
    )
    latest = _latest([_market_point(r) for r in rows], today, country.closed_weekdays)
    point = latest.point
    row = next((r for r in rows if point and r.trade_date == point.day), None)
    source_id = None
    if point is not None:
        source_id = await repo.quote_source(
            session,
            area_id=area.id,
            crop_id=crop.id,
            price_type="wholesale",
            day=point.day,
            market_id=found.id,
        )
    return {
        "crop_id": crop.id,
        "market_id": found.id,
        "area_id": area.id,
        "name": found.name,
        "km_from_center": found.km_from_center,
        "currency": country.currency,
        "today": today,
        "trade_date": point.day if point else None,
        "staleness": _staleness_out(latest.staleness),
        "fetched_at": _local(row.fetched_at if row else None, country),
        "price_per_kg": point.price if point else None,
        "reason": None if point else "no_data",
        "low_per_kg": _opt_money(row.low_price) if row else None,
        "high_per_kg": _opt_money(row.high_price) if row else None,
        "change": _change_out(point, latest.prev),
        "source": source_info(source_id),
    }
