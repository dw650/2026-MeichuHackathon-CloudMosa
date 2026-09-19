"""Country-local dates. The backend decides "today" per country (docs/06 §3.1)."""

from datetime import UTC, date, datetime, timedelta, timezone


def country_tz(utc_offset_min: int) -> timezone:
    return timezone(timedelta(minutes=utc_offset_min))


def local_today(utc_offset_min: int, now: datetime | None = None) -> date:
    """The calendar date in a country with a fixed UTC offset (India +5:30, Taiwan +8)."""
    moment = now or datetime.now(UTC)
    return moment.astimezone(country_tz(utc_offset_min)).date()


def to_roc(day: date) -> str:
    """2026-09-19 → "115.09.19" (Taiwan's Minguo calendar)."""
    return f"{day.year - 1911:03d}.{day.month:02d}.{day.day:02d}"


def from_roc(text: str) -> date:
    year, month, day = (int(part) for part in text.strip().split("."))
    return date(year + 1911, month, day)
