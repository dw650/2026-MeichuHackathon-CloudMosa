"""Data freshness (docs/06 §3.5): today, closed (only closed days since), stale or none."""

from collections.abc import Collection
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

State = Literal["today", "closed", "stale", "none"]
WINDOW_DAYS = 30


@dataclass(frozen=True)
class Staleness:
    days: int | None
    state: State


def staleness(latest: date | None, today: date, closed_weekdays: Collection[int]) -> Staleness:
    """`closed_weekdays` are ISO weekdays. Nothing within the last 30 days counts as none."""
    if latest is None or (today - latest).days >= WINDOW_DAYS:
        return Staleness(days=None, state="none")
    days = (today - latest).days
    if days <= 0:
        return Staleness(days=0, state="today")
    since = (latest + timedelta(days=i) for i in range(1, days + 1))
    if all(d.isoweekday() in closed_weekdays for d in since):
        return Staleness(days=days, state="closed")
    return Staleness(days=days, state="stale")
