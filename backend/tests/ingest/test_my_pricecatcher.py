"""my_pricecatcher: Malaysia's PriceCatcher (KPDN via data.gov.my, CC BY 4.0) monthly files.

`tests/fixtures/my_pricecatcher/` holds real rows saved on 2026-09-20: every row of twelve
items at four premises (wet markets 3181 Pasar Pudu and 8616 Pasar Chow Kit in Kuala Lumpur,
11551 Pasar Besar Siti Khadijah in Kota Bharu, the mini market 17532 in Kuala Lumpur) on
2026-08-27 to 08-30 and 09-01, 09-02, 09-14, 09-15, 09-17 (08-31 Merdeka Day and 09-16 Malaysia
Day have no rows in the source); real rows of the wholesale premises 18151 (Johor Bahru) and
16822 (Kuala Terengganu) from June 2025 (they stopped reporting in early 2026); and the lookup
rows of every mapped premise and item. FakeStorage answers like storage.data.gov.my: one CSV per
month, ETag and Last-Modified headers, 304 for an unchanged file, 404 for a missing one."""

import hashlib
from collections.abc import Sequence
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import worker
from app.config import Settings
from app.ingest import registry
from app.ingest.http import UpstreamError
from app.ingest.maps import maps_from_seeds
from app.ingest.normalize import normalize_all
from app.ingest.pipeline import run_provider
from app.ingest.providers import my_pricecatcher as pc
from app.ingest.providers.base import BuildContext, RawRow
from app.ingest.seed import sync_seed
from app.seed.loader import load_seed_files

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "my_pricecatcher"
SEEDS = load_seed_files()
TODAY = date(2026, 9, 17)  # Thursday; the sample ends here
NOW = datetime(2026, 9, 17, 13, 0, tzinfo=UTC)  # 21:00 in Malaysia, after the day's update
HEADER = "date,premise_code,item_code,price\n"


def sample(month: str) -> str:
    return (FIXTURES / f"pricecatcher_{month}.csv").read_text(encoding="utf-8")


class FakeStorage:
    """storage.data.gov.my over the fixtures. `files` maps a month to its CSV text; months that
    are not listed answer 404. `failures` are served first, one per request."""

    def __init__(
        self,
        files: dict[str, str] | None = None,
        failures: Sequence[int | Exception] = (),
    ) -> None:
        self.files = files if files is not None else self.default()
        self.failures = list(failures)
        self.requests: list[httpx.Request] = []

    @staticmethod
    def default() -> dict[str, str]:
        # July is in the 60-day window but none of the sample premises reported then.
        return {"2026-07": HEADER, "2026-08": sample("2026-08"), "2026-09": sample("2026-09")}

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.failures:
            failure = self.failures.pop(0)
            if isinstance(failure, Exception):
                raise failure
            return httpx.Response(failure, text="busy")
        name = request.url.path.rsplit("/", 1)[-1]
        month = name.removeprefix("pricecatcher_").removesuffix(".csv")
        body = self.files.get(month)
        if body is None:
            return httpx.Response(404, text="<Error><Code>NoSuchKey</Code></Error>")
        etag = '"' + hashlib.md5(body.encode()).hexdigest() + '"'
        headers = {"ETag": etag, "Last-Modified": "Thu, 17 Sep 2026 12:00:39 GMT"}
        if request.headers.get("If-None-Match") == etag:
            return httpx.Response(304, headers=headers)
        return httpx.Response(200, text=body, headers=headers)

    @property
    def months(self) -> list[str]:
        return [r.url.path.rsplit("_", 1)[-1].removesuffix(".csv") for r in self.requests]


class Sleeps(list[float]):
    async def __call__(self, seconds: float) -> None:
        self.append(seconds)


def make(
    server: FakeStorage,
    plan: Sequence[date] | None = None,
    today: date = TODAY,
    **options: Any,
) -> pc.PriceCatcherProvider:
    premises, items = pc.codes_from_seeds(SEEDS)
    return pc.PriceCatcherProvider(
        premises,
        items,
        today_of=lambda _c: today,
        plan=plan,
        transport=httpx.MockTransport(server),
        sleep=Sleeps(),
        **options,
    )


def window(today: date = TODAY) -> list[date]:
    return [today - timedelta(days=i) for i in reversed(range(60))]


async def fetch_all(provider: pc.PriceCatcherProvider, days: Sequence[date]) -> list[RawRow]:
    rows: list[RawRow] = []
    for day in days:
        rows += await provider.fetch(day)
    return rows


# ---------- fetch ----------


async def test_a_full_run_reads_the_three_months_of_the_window_once() -> None:
    server = FakeStorage()
    provider = make(server)
    rows = await fetch_all(provider, window())
    await fetch_all(provider, window())
    assert server.months == ["2026-07", "2026-08", "2026-09"]
    assert provider.stats.requests == 3
    # Only mapped premises and items stay: the three wet markets, not the mini market 17532,
    # and not the chicken (1), local cabbage (105) or Indian onion (1440) rows.
    assert {r["premise_code"] for r in rows} == {"3181", "8616", "11551"}
    assert {r["item_code"] for r in rows} <= set(pc.codes_from_seeds(SEEDS)[1])
    assert "1" not in {r["item_code"] for r in rows}
    days = {r["date"] for r in rows}
    assert "2026-08-31" not in days  # Merdeka Day
    assert "2026-09-16" not in days  # Malaysia Day
    assert {"2026-08-27", "2026-09-17"} <= days
    total = len(sample("2026-08").splitlines()) + len(sample("2026-09").splitlines()) - 2
    assert len(rows) + provider.stats.dropped["unmapped"] == total


async def test_fetch_returns_the_rows_of_that_day() -> None:
    provider = make(FakeStorage())
    rows = await provider.fetch(date(2026, 9, 1))
    assert rows
    assert {r["date"] for r in rows} == {"2026-09-01"}
    assert set(rows[0]) == {"date", "premise_code", "item_code", "price"}


async def test_a_plan_downloads_only_the_months_it_needs() -> None:
    server = FakeStorage()
    plan = [date(2026, 8, 30), date(2026, 9, 1)]
    provider = make(server, plan=plan)
    rows = await fetch_all(provider, window())
    assert server.months == ["2026-08", "2026-09"]
    assert {r["date"] for r in rows} == {"2026-08-30", "2026-09-01"}
    # Rows of other days in those files are neither kept nor counted.
    kept_or_dropped = len(rows) + provider.stats.dropped["unmapped"]
    in_plan = [
        line
        for month in ("2026-08", "2026-09")
        for line in sample(month).splitlines()[1:]
        if line[:10] in {"2026-08-30", "2026-09-01"}
    ]
    assert kept_or_dropped == len(in_plan)


async def test_an_empty_plan_sends_nothing() -> None:
    server = FakeStorage()
    provider = make(server, plan=[])
    assert await fetch_all(provider, window()) == []
    assert server.requests == []


async def test_unchanged_files_are_not_downloaded_again() -> None:
    server = FakeStorage()
    first = make(server)
    await fetch_all(first, window())
    validators = first.stats.files
    assert set(validators) == {pc.month_url(2026, m) for m in (7, 8, 9)}
    assert validators[pc.month_url(2026, 9)]["last_modified"] == "Thu, 17 Sep 2026 12:00:39 GMT"

    again = make(server, files=validators)
    assert await fetch_all(again, window()) == []
    sent = server.requests[3:]
    assert [r.headers["If-None-Match"] for r in sent] == [
        validators[str(r.url)]["etag"] for r in sent
    ]
    assert all(r.headers["If-Modified-Since"] for r in sent)
    # The validators stay with the run, so the next run can ask again.
    assert again.stats.files == validators

    # A file that changed is downloaded again.
    server.files["2026-09"] += "2026-09-17,3181,114,9.5\n"
    changed = make(server, files=validators)
    rows = await fetch_all(changed, window())
    assert {r["date"][:7] for r in rows} == {"2026-09"}
    assert changed.stats.files[pc.month_url(2026, 9)] != validators[pc.month_url(2026, 9)]


async def test_this_months_file_may_not_exist_yet() -> None:
    # On the 1st, the new month's file appears only with that evening's update.
    server = FakeStorage({"2026-09": sample("2026-09")})
    provider = make(server, plan=[date(2026, 9, 30), date(2026, 10, 1)], today=date(2026, 10, 1))
    assert await fetch_all(provider, [date(2026, 9, 30), date(2026, 10, 1)]) == []
    assert server.months == ["2026-09", "2026-10"]


async def test_a_missing_older_month_fails_the_run() -> None:
    server = FakeStorage({"2026-09": sample("2026-09")})
    provider = make(server, plan=[date(2026, 8, 30), date(2026, 9, 1)])
    with pytest.raises(UpstreamError, match="2026-08"):
        await provider.fetch(date(2026, 9, 1))


async def test_unexpected_columns_fail_the_run() -> None:
    server = FakeStorage({"2026-09": "tarikh,premis,barang,harga\n2026-09-17,3181,114,9.0\n"})
    provider = make(server, plan=[TODAY])
    with pytest.raises(UpstreamError, match="columns"):
        await provider.fetch(TODAY)


async def test_unreadable_lines_are_counted() -> None:
    server = FakeStorage({"2026-09": HEADER + "2026-09-17,3181,114\n2026-09-17,3181,114,9.0\n"})
    provider = make(server, plan=[TODAY])
    rows = await provider.fetch(TODAY)
    assert len(rows) == 1
    assert provider.stats.dropped["malformed"] == 1


async def test_busy_answers_are_retried() -> None:
    server = FakeStorage(failures=[503, httpx.ReadTimeout("slow")])
    provider = make(server, plan=[TODAY])
    assert await provider.fetch(TODAY)
    assert provider.stats.requests == 3


def test_codes_come_from_the_seed_maps() -> None:
    premises, items = pc.codes_from_seeds(SEEDS)
    assert len(premises) == 79 + 7  # wet markets and wholesale markets
    assert {"3181", "8616", "11551", "18147"} <= premises
    assert "17532" not in premises  # a mini market
    assert len(items) == 20
    assert {"114", "1458", "917"} <= items


# ---------- normalize and the pipeline ----------


async def test_real_rows_become_retail_points_and_area_medians(session: AsyncSession) -> None:
    await sync_seed(session)
    provider = make(FakeStorage())
    summary = await run_provider(session, provider, {"IN": TODAY, "TW": TODAY, "MY": TODAY}, NOW)
    assert summary.status == "ok"
    assert summary.requests == 3

    async def area_price(area: str, crop: str, day: date) -> tuple[float, int] | None:
        result = await session.execute(
            text(
                "SELECT price, n_markets FROM area_daily WHERE area_id = :a AND crop_id = :c"
                " AND price_type = 'retail' AND trade_date = :d"
            ),
            {"a": area, "c": crop, "d": day},
        )
        row = result.one_or_none()
        return None if row is None else (float(row[0]), row[1])

    # TOMATO on 2026-09-17: Pasar Pudu 6.0, Pasar Chow Kit 5.0 → Kuala Lumpur 5.5 (the mini
    # market's 6.99 is left out).
    assert await area_price("kualalumpur", "tomato", TODAY) == (5.5, 0)
    # Kota Bharu has one wet market in the sample: Siti Khadijah, 7.0.
    assert await area_price("kotabharu", "tomato", TODAY) == (7.0, 0)
    assert await area_price("kualalumpur", "tomato", date(2026, 9, 16)) is None

    stored = await session.execute(
        text("SELECT count(*), count(DISTINCT source) FROM quotes WHERE country = 'MY'")
    )
    count, sources = stored.one()
    assert sources == 1
    runs = await session.execute(
        text(
            "SELECT rows_in, rows_ok, rows_dropped, drop_reasons, requests, files FROM ingest_runs"
        )
    )
    rows_in, rows_ok, rows_dropped, reasons, requests, files = runs.one()
    assert rows_in == rows_ok + rows_dropped
    assert reasons["unmapped"] > 0
    assert count < rows_ok  # the points of an area became one row per crop and day
    assert requests == 3
    assert set(files) == {pc.month_url(2026, m) for m in (7, 8, 9)}


async def test_wholesale_markets_give_market_prices(session: AsyncSession) -> None:
    # Real "Borong" rows from June 2025, when the wholesale markets still reported.
    await sync_seed(session)
    today = date(2025, 6, 20)
    server = FakeStorage(
        {"2025-04": HEADER, "2025-05": HEADER, "2025-06": sample("2025-06")},
    )
    provider = make(server, today=today)
    days = {"IN": today, "TW": today, "MY": today}
    summary = await run_provider(session, provider, days, datetime(2025, 6, 20, 13, tzinfo=UTC))
    assert summary.status == "ok"
    result = await session.execute(
        text(
            "SELECT area_id, price, n_markets FROM area_daily WHERE crop_id = 'tomato'"
            " AND price_type = 'wholesale' AND trade_date = '2025-06-18' ORDER BY area_id"
        )
    )
    assert [(a, float(p), n) for a, p, n in result.tuples().all()] == [
        ("johorbahru", 3.0, 1),
        ("kualaterengganu", 3.5, 1),
    ]


def test_normalize_uses_the_shared_pricecatcher_format() -> None:
    provider = make(FakeStorage())
    maps = maps_from_seeds(SEEDS, pc.SOURCE)
    row = {"date": "2026-09-17", "premise_code": "8616", "item_code": "114", "price": "5.0"}
    quotes, dropped = normalize_all(provider, [row], maps)
    (q,) = quotes
    assert (q.source, q.area_id, q.point, q.rep_price) == (pc.SOURCE, "kualalumpur", "8616", 5.0)
    assert dropped == {}


# ---------- worker ----------


def offline(monkeypatch: pytest.MonkeyPatch, server: FakeStorage) -> None:
    """Makes the worker build my_pricecatcher over `server` instead of the real storage."""

    def build(ctx: BuildContext) -> pc.PriceCatcherProvider:
        premises, items = pc.codes_from_seeds(ctx.seeds)
        return pc.PriceCatcherProvider(
            premises,
            items,
            ctx.today_of,
            plan=ctx.days,
            files=ctx.files,
            transport=httpx.MockTransport(server),
            sleep=Sleeps(),
        )

    monkeypatch.setitem(registry.SOURCES, pc.SOURCE, replace(pc.INFO, build=build))


async def test_malaysia_switches_between_demo_and_real_prices(
    settings: Settings, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    server = FakeStorage()
    offline(monkeypatch, server)
    demo = settings.model_copy(update={"providers": "mock"})
    real = settings.model_copy(update={"providers": "mock,my_pricecatcher"})

    async def sources() -> list[tuple[str, str]]:
        result = await session.execute(
            text("SELECT DISTINCT country, source FROM quotes ORDER BY country, source")
        )
        return [(c, s) for c, s in result.tuples().all()]

    await worker.run_once(demo, lambda: NOW)
    assert ("MY", "mock") in await sources()

    summaries = await worker.run_once(real, lambda: NOW, startup=True)
    assert [(s.source, s.status) for s in summaries] == [("mock", "ok"), (pc.SOURCE, "ok")]
    assert await sources() == [("IN", "mock"), ("MY", pc.SOURCE), ("TW", "mock")]
    wholesale = await session.execute(
        text("SELECT count(*) FROM area_daily WHERE country = 'MY' AND price_type = 'wholesale'")
    )
    assert wholesale.scalar_one() == 0  # the wholesale markets report nothing in 2026

    # A restart right after: nothing is downloaded.
    sent = len(server.requests)
    again = await worker.run_once(real, lambda: NOW + timedelta(minutes=10), startup=True)
    assert [(s.source, s.status) for s in again] == [("mock", "ok"), (pc.SOURCE, "skipped")]
    assert len(server.requests) == sent

    # The evening refresh asks again about the days it has no prices for and the last three
    # days; no file changed, so every answer is "not modified" and nothing is downloaded.
    refreshed = await worker.run_once(real, lambda: NOW + timedelta(hours=1), refresh=pc.SOURCE)
    assert [(s.source, s.status, s.rows_ok) for s in refreshed] == [(pc.SOURCE, "ok", 0)]
    assert server.months[sent:] == ["2026-07", "2026-08", "2026-09"]
    assert all(r.headers.get("If-None-Match") for r in server.requests[sent:])

    await worker.run_once(demo, lambda: NOW)
    assert await sources() == [("IN", "mock"), ("MY", "mock"), ("TW", "mock")]
