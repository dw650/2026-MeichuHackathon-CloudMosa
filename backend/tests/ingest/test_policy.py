"""Fetch policy of network sources (docs/06 §8): what a run downloads, and when it can skip."""

from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

from app.ingest.policy import LastRun, plan_fetch
from app.ingest.providers.base import SourceInfo
from app.ingest.providers.mock import MockProvider

TODAY = date(2026, 9, 20)
FIRST = TODAY - timedelta(days=59)
NOW = datetime(2026, 9, 20, 4, 0, tzinfo=UTC)
WINDOW = [FIRST + timedelta(days=i) for i in range(60)]
FILES = {"https://example.test/2026-09.csv": {"etag": '"abc"'}}


def _never(_ctx: object) -> MockProvider:
    raise AssertionError("not built in these tests")


INFO = SourceInfo(
    id="net",
    countries=("TW",),
    price_types=("wholesale",),
    build=_never,
    network=True,
    refresh_days=3,
    fresh_for=timedelta(hours=6),
)


def last(hours_ago: float = 1, maps_hash: str = "h1") -> LastRun:
    return LastRun(finished_at=NOW - timedelta(hours=hours_ago), maps_hash=maps_hash, files=FILES)


def plan(covered: set[date], previous: LastRun | None, *, startup: bool = False, **kw: object):
    return plan_fetch(
        replace(INFO, **kw),  # type: ignore[arg-type]
        FIRST,
        TODAY,
        covered=covered,
        last=previous,
        maps_hash="h1",
        now=NOW,
        startup=startup,
    )


def test_a_first_run_fetches_the_whole_window_without_validators() -> None:
    result = plan(set(), None)
    assert result.days == tuple(WINDOW)
    assert result.files == {}
    assert result.skip is None


def test_a_scheduled_run_fetches_the_missing_days_and_the_last_few() -> None:
    covered = set(WINDOW) - {WINDOW[10], WINDOW[-1]}
    result = plan(covered, last())
    assert result.days == (WINDOW[10], WINDOW[-3], WINDOW[-2], WINDOW[-1])
    assert result.files == FILES


def test_the_start_up_run_is_skipped_after_a_recent_success() -> None:
    result = plan(set(WINDOW), last(hours_ago=2), startup=True)
    assert result.days == ()
    assert result.skip is not None
    assert "2:00:00" in result.skip


def test_an_old_success_does_not_skip_the_start_up_run() -> None:
    result = plan(set(WINDOW), last(hours_ago=7), startup=True)
    assert result.skip is None
    assert result.days == tuple(WINDOW[-3:])


def test_a_recent_success_without_data_is_not_trusted() -> None:
    # The prices were removed (for example the source was switched off and on again).
    result = plan(set(), last(hours_ago=1), startup=True)
    assert result.skip is None
    assert result.days == tuple(WINDOW)
    assert result.files == {}


def test_changed_name_maps_fetch_the_whole_window_again() -> None:
    # A crop or market added to the seed needs its history, not only the last days.
    result = plan(set(WINDOW), last(hours_ago=1, maps_hash="old"), startup=True)
    assert result.skip is None
    assert result.days == tuple(WINDOW)
    assert result.files == {}


def test_a_source_without_refresh_days_fetches_only_missing_days() -> None:
    result = plan(set(WINDOW) - {WINDOW[5]}, last(), refresh_days=0)
    assert result.days == (WINDOW[5],)
