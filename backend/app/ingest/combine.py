"""One retail price per area, crop and day (docs/06 §3.3).

Some sources report retail prices for several shops or markets inside an area (PriceCatcher:
every wet market of a district). After the checks, those points become one area price: their
median, the same way the wholesale area price is the median of the area's markets."""

from collections.abc import Sequence
from dataclasses import replace
from statistics import median

from app.ingest.providers.base import NormalizedQuote


def combine_points(quotes: Sequence[NormalizedQuote]) -> list[NormalizedQuote]:
    """Retail quotes with a `point` become one quote per (source, area, crop, variety, day);
    every other quote passes through unchanged, in its order."""
    kept: list[NormalizedQuote] = []
    groups: dict[tuple[object, ...], list[NormalizedQuote]] = {}
    for q in quotes:
        if q.price_type != "retail" or not q.point:
            kept.append(q)
            continue
        key = (q.source, q.country, q.area_id, q.crop_id, q.variety, q.trade_date)
        groups.setdefault(key, []).append(q)
    for points in groups.values():
        prices = [q.rep_price for q in points if q.rep_price is not None]
        kept.append(
            replace(
                points[0],
                rep_price=median(prices),
                low_price=None,
                high_price=None,
                volume_kg=None,
                point="",
            )
        )
    return kept
