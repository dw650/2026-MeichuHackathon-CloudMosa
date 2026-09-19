"""The worker's part in B5: when the international prices are checked, and the settings."""

from datetime import UTC, datetime, timedelta

import httpx
import pytest
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.ingest.intl.pink_sheet import KNOWN_MONTHLY_URL
from app.seed.loader import load_seed_files
from app.seed.schema import SeedFile
from app.timeutil import country_tz
from app.worker import intl_config, run_intl, schedule_intl
from tests.intl_server import FILE_URL, PAGE_URL, SAMPLE, IntlServer

T0 = datetime(2026, 9, 19, 6, 10, tzinfo=UTC)


def with_malaysia() -> list[SeedFile]:
    """IN, TW and a third country on Taiwan's UTC offset (MY is added by another bonus item)."""
    seeds = load_seed_files()
    tw = next(s for s in seeds if s.country.code == "TW")
    my = tw.model_copy(update={"country": tw.country.model_copy(update={"code": "MY"})})
    return [*seeds, my]


def test_the_checks_run_with_the_daily_jobs_once_per_utc_offset() -> None:
    scheduler = AsyncIOScheduler()
    schedule_intl(scheduler, Settings(), with_malaysia())
    jobs = {job.id: job for job in scheduler.get_jobs()}
    assert sorted(jobs) == ["intl-330", "intl-480"]
    now = datetime(2026, 9, 19, 12, 0, tzinfo=UTC)
    for offset, job in ((330, jobs["intl-330"]), (480, jobs["intl-480"])):
        fire = job.trigger.get_next_fire_time(None, now)
        local = fire.astimezone(country_tz(offset))
        assert (local.hour, local.minute) == (0, 5)
        assert fire - now < timedelta(days=1)


def test_nothing_is_scheduled_when_the_page_is_switched_off() -> None:
    scheduler = AsyncIOScheduler()
    schedule_intl(scheduler, Settings(intl_prices=False), load_seed_files())
    assert scheduler.get_jobs() == []


def test_the_addresses_come_from_the_settings() -> None:
    config = intl_config(Settings(pink_sheet_url=" https://example.test/m.xlsx "))
    assert config.file_url == "https://example.test/m.xlsx"
    assert config.fallback_url == KNOWN_MONTHLY_URL
    defaults = intl_config(Settings())
    assert defaults.page_url == PAGE_URL
    assert defaults.file_url == ""
    assert defaults.fx_url == "https://open.er-api.com/v6/latest/USD"
    assert KNOWN_MONTHLY_URL == FILE_URL


async def test_switched_off_the_series_still_follow_the_seed_but_nothing_is_asked(
    settings: Settings, session: AsyncSession
) -> None:
    def refuse(request: httpx.Request) -> httpx.Response:
        raise AssertionError(f"unexpected request to {request.url}")

    off = settings.model_copy(update={"intl_prices": False})
    assert await run_intl(off, lambda: T0, transport=httpx.MockTransport(refuse)) == []
    count = await session.execute(text("SELECT count(*) FROM intl_series"))
    assert count.scalar_one() == 6


async def test_a_start_up_downloads_only_what_is_missing_or_old(
    settings: Settings, session: AsyncSession
) -> None:
    server = IntlServer(files={"https://example.test/m.xlsx": SAMPLE})
    fixed = settings.model_copy(update={"pink_sheet_url": "https://example.test/m.xlsx"})
    first = await run_intl(fixed, lambda: T0, transport=server.transport())
    assert [(s.source, s.status) for s in first] == [("er_api", "ok"), ("wb_pink", "ok")]
    assert server.hits(PAGE_URL) == 0

    # A deploy restarts the worker an hour later: nothing is downloaded again.
    again = await run_intl(fixed, lambda: T0 + timedelta(hours=1), transport=server.transport())
    assert again == []
    assert len(server.requests) == 2


@pytest.mark.parametrize("hours", [23, 30])
async def test_a_start_up_a_day_later_checks_again(
    settings: Settings, session: AsyncSession, hours: int
) -> None:
    server = IntlServer()
    await run_intl(settings, lambda: T0, transport=server.transport())
    at = T0 + timedelta(hours=hours)
    later = await run_intl(settings, lambda: at, transport=server.transport())
    assert sorted(s.source for s in later) == ["er_api", "wb_pink"]
    assert server.conditional(FILE_URL) == [False, True]
