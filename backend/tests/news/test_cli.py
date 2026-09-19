"""`python -m app.news --once [--country TW]` and the worker's news jobs."""

from datetime import UTC, datetime, timedelta

import pytest
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.ext.asyncio import AsyncSession

from app import news
from app.config import Settings
from app.ingest.news.pipeline import NewsRunSummary
from app.seed.loader import load_seed_files
from app.timeutil import country_tz
from app.worker import schedule_news


def test_options_are_trimmed_and_the_source_lower_cased() -> None:
    options = news.news_options(
        Settings(news_source=" Demo ", gemini_api_key=" k ", summary_api_base=" http://lab/v1 ")
    )
    assert (options.source, options.gemini_api_key, options.summary_api_base) == (
        "demo",
        "k",
        "http://lab/v1",
    )


def test_describe_a_run() -> None:
    run = NewsRunSummary("TW", "google", items_in=12, items_new=11, articles=3, model_calls=4)
    assert news.describe(run) == (
        "TW google: ok, 11 new of 12 on topic, 3 articles read, 4 model calls, 0 summaries"
    )
    failed = NewsRunSummary("IN", "google", status="failed", error="UpstreamError: down")
    assert news.describe(failed).endswith("(UpstreamError: down)")


async def test_the_command_needs_once() -> None:
    with pytest.raises(SystemExit):
        await news.main([])


async def test_the_command_runs_the_asked_countries(
    seeded: AsyncSession,
    settings: Settings,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    demo = settings.model_copy(update={"news_source": "demo"})
    monkeypatch.setattr(news, "get_settings", lambda: demo)
    await news.main(["--once", "--country", "tw"])
    out = capsys.readouterr().out.splitlines()
    assert len(out) == 1
    assert out[0].startswith("TW demo: ok, 6 new of 6 on topic")


async def test_the_command_says_when_news_is_off(
    seeded: AsyncSession,
    settings: Settings,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    off = settings.model_copy(update={"news_source": "off"})
    monkeypatch.setattr(news, "get_settings", lambda: off)
    await news.main(["--once"])
    assert "nothing ran (NEWS_SOURCE='off')" in capsys.readouterr().out


def test_news_runs_at_midnight_local_time_and_once_at_start_up() -> None:
    seeds = load_seed_files()
    scheduler = AsyncIOScheduler()
    schedule_news(scheduler, Settings(news_source="google"), seeds)
    now = datetime(2026, 9, 19, 12, 0, tzinfo=UTC)
    for seed in seeds:
        job = scheduler.get_job(f"news-{seed.country.code}")
        assert job is not None
        assert job.kwargs == {"countries": [seed.country.code]}
        fire = job.trigger.get_next_fire_time(None, now)
        local = fire.astimezone(country_tz(seed.country.utc_offset_min))
        assert (local.hour, local.minute) == (0, 0)
        assert fire - now < timedelta(days=1)
    startup = scheduler.get_job("news-startup")
    assert startup is not None
    assert startup.kwargs == {"startup": True}


def test_no_news_jobs_when_news_is_off() -> None:
    scheduler = AsyncIOScheduler()
    schedule_news(scheduler, Settings(news_source="off"), load_seed_files())
    assert scheduler.get_jobs() == []
