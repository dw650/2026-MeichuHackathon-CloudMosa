"""Fetch policy of the network sources (docs/06 §8). Pure: the pipeline supplies the facts.

The server redeploys on every push, so a run must not download everything again:

- **Start-up**: skipped when the source had a successful run within `fresh_for`, with the same
  name maps, and still has prices in the window; the next scheduled run catches up.
- **Every run**: the days of the window the source has no prices for, plus the last
  `refresh_days` days (the source may still update them). Validators of files an earlier run
  ingested go along, so an unchanged file costs a "not modified" answer instead of a download.
- **Everything again**, without validators, when the source has no prices in the window (a first
  run, or its prices were removed) or its name maps changed (a new crop needs its history)."""

from collections.abc import Collection, Mapping
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from app.ingest.providers.base import SourceInfo, Validators


@dataclass(frozen=True)
class LastRun:
    """The source's latest successful run."""

    finished_at: datetime
    maps_hash: str | None
    files: Mapping[str, Validators] = field(default_factory=dict)  # merged over its runs


@dataclass(frozen=True)
class FetchPlan:
    days: tuple[date, ...]  # trade dates to fetch, oldest first; empty = nothing to fetch
    files: Mapping[str, Validators] = field(default_factory=dict)  # validators to send
    skip: str | None = None  # why the run is skipped


def plan_fetch(
    info: SourceInfo,
    first: date,
    today: date,
    *,
    covered: Collection[date],
    last: LastRun | None,
    maps_hash: str,
    now: datetime,
    startup: bool,
) -> FetchPlan:
    """`first`..`today` is the window; `covered` the days the source has prices for."""
    window = [first + timedelta(days=i) for i in range((today - first).days + 1)]
    have = set(covered) & set(window)
    trusted = last is not None and last.maps_hash == maps_hash and bool(have)
    if not trusted or last is None:
        return FetchPlan(days=tuple(window))
    age = now - last.finished_at
    if startup and age < info.fresh_for:
        return FetchPlan(days=(), skip=f"last success {age} ago")
    recent = set(window[-info.refresh_days :]) if info.refresh_days else set()
    days = sorted((set(window) - have) | recent)
    return FetchPlan(days=tuple(days), files=last.files)
