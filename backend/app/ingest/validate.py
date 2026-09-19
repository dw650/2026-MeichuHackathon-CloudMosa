"""Data checks (docs/06 §2.1). Failing rows are dropped and counted per reason."""

from collections import Counter
from dataclasses import dataclass, field, replace
from datetime import date, timedelta
from statistics import median

from app.ingest.providers.base import NormalizedQuote

MAX_AGE_DAYS = 60
OUTLIER_FACTOR = 5.0


@dataclass
class ValidationResult:
    kept: list[NormalizedQuote] = field(default_factory=list)
    dropped: dict[str, int] = field(default_factory=dict)
    duplicates: int = 0


def _clean_range(q: NormalizedQuote) -> NormalizedQuote:
    """Keeps the representative price but clears a range it does not fit in."""
    low, high = q.low_price, q.high_price
    if low is not None and low <= 0:
        low = None
    if high is not None and high <= 0:
        high = None
    if low is None or high is None:
        return replace(q, low_price=None, high_price=None)
    assert q.rep_price is not None
    if not low <= q.rep_price <= high:
        return replace(q, low_price=None, high_price=None)
    return q


def _key(q: NormalizedQuote) -> tuple[object, ...]:
    return (
        q.source,
        q.price_type,
        q.area_id,
        q.market_id,
        q.point,
        q.crop_id,
        q.variety,
        q.trade_date,
    )


def validate(quotes: list[NormalizedQuote], today: dict[str, date]) -> ValidationResult:
    dropped: Counter[str] = Counter()
    checked: list[NormalizedQuote] = []
    for q in quotes:
        local_today = today[q.country]
        if q.rep_price is None:
            dropped["missing_price"] += 1
        elif q.rep_price <= 0:
            dropped["non_positive_price"] += 1
        elif (
            q.low_price is not None
            and q.high_price is not None
            and q.low_price > 0
            and q.low_price > q.high_price
        ):
            dropped["inverted_range"] += 1
        elif q.trade_date > local_today:
            dropped["future_date"] += 1
        elif q.trade_date <= local_today - timedelta(days=MAX_AGE_DAYS):
            dropped["too_old"] += 1
        else:
            checked.append(_clean_range(q))

    # The same row fetched twice: the later one wins.
    unique: dict[tuple[object, ...], NormalizedQuote] = {}
    for q in checked:
        unique[_key(q)] = q
    duplicates = len(checked) - len(unique)

    # Outliers against the national median of the same crop, price type and day.
    groups: dict[tuple[object, ...], list[float]] = {}
    for q in unique.values():
        assert q.rep_price is not None
        groups.setdefault((q.country, q.crop_id, q.price_type, q.trade_date), []).append(
            q.rep_price
        )
    medians = {k: median(v) for k, v in groups.items()}
    kept: list[NormalizedQuote] = []
    for q in unique.values():
        assert q.rep_price is not None
        mid = medians[(q.country, q.crop_id, q.price_type, q.trade_date)]
        if q.rep_price > mid * OUTLIER_FACTOR or q.rep_price < mid / OUTLIER_FACTOR:
            dropped["outlier"] += 1
        else:
            kept.append(q)
    return ValidationResult(kept=kept, dropped=dict(dropped), duplicates=duplicates)
