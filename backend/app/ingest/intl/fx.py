"""Exchange rates (bonus B5): ExchangeRate-API's open endpoint (https://open.er-api.com/v6/
latest/USD). No key; one update a day (about 00:00 UTC), and the answer says when the next one
comes. Its terms ask for the credit "Rates By Exchange Rate API" on every page that uses the
rates, allow caching and forbid passing the rates on, so the API only shows the rate of the
country being viewed, next to the prices converted with it."""

import math
import re
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

from app.ingest.intl.http import UpstreamError

BASE = "USD"
_CODE = re.compile(r"^[A-Z]{3}$")


@dataclass(frozen=True)
class FxSnapshot:
    rate_date: date  # the provider's update day (UTC)
    updated_at: datetime
    next_update_at: datetime | None
    rates: dict[str, float]  # currency → units for one US dollar
    dropped: int  # rates that were not positive numbers


def _moment(value: Any, what: str) -> datetime:
    if isinstance(value, bool) or not isinstance(value, int | float):
        raise UpstreamError(f"exchange rates: no {what} time")
    return datetime.fromtimestamp(value, tz=UTC)


def parse_rates(payload: Any) -> FxSnapshot:
    """The rates of one answer; anything but a successful USD answer raises UpstreamError."""
    if not isinstance(payload, dict):
        raise UpstreamError("exchange rates: the answer is not a JSON object")
    if payload.get("result") != "success":
        raise UpstreamError(f"exchange rates refused: {payload.get('error-type', 'unknown')}")
    if payload.get("base_code") != BASE:
        raise UpstreamError(f"exchange rates: base {payload.get('base_code')}, expected {BASE}")
    updated = _moment(payload.get("time_last_update_unix"), "update")
    following = payload.get("time_next_update_unix")
    raw = payload.get("rates")
    if not isinstance(raw, dict):
        raise UpstreamError("exchange rates: no rates")
    rates: dict[str, float] = {}
    for code, value in raw.items():
        usable = (
            isinstance(code, str)
            and _CODE.match(code) is not None
            and isinstance(value, int | float)
            and not isinstance(value, bool)
            and math.isfinite(value)
            and value > 0
        )
        if usable:
            rates[code] = float(value)
    if not set(rates) - {BASE}:
        raise UpstreamError("exchange rates: no rates")
    return FxSnapshot(
        rate_date=updated.date(),
        updated_at=updated,
        next_update_at=None if following is None else _moment(following, "next update"),
        rates=rates,
        dropped=len(raw) - len(rates),
    )
