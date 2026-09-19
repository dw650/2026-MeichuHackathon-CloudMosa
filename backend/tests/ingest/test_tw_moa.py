"""tw_moa (bonus B2): real MOA FarmTransData rows through the Taiwan normalizer.

`tests/fixtures/tw_moa_farmtrans.json` holds 413 real rows fetched on 2026-09-20 with
Crop=甘藍, 香蕉, 甘薯 and 番茄 for 115.09.14–115.09.16 (deduplicated): varieties we map and
varieties we do not, markets outside our areas and the market-closure notices (作物代號 "rest")
the API adds to every answer. Nothing here touches the network: FakeServer answers like the
API over those rows."""

import json
from collections import Counter
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
from app.ingest.maps import maps_from_seeds
from app.ingest.normalize import normalize_all
from app.ingest.pipeline import run_provider
from app.ingest.providers import tw_moa
from app.ingest.providers.base import BuildContext, RawRow, SourceMaps
from app.ingest.providers.tw_moa import TwMoaProvider, UpstreamError, products_from_seeds
from app.ingest.seed import sync_seed
from app.seed.loader import load_seed_files
from app.timeutil import from_roc

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "tw_moa_farmtrans.json"
ROWS: list[RawRow] = json.loads(FIXTURE.read_text(encoding="utf-8"))
SEEDS = load_seed_files()
DAY = date(2026, 9, 16)  # the fixture covers 115.09.14 (Monday) to 115.09.16
NOW = datetime(2026, 9, 16, 7, 0, tzinfo=UTC)
# A real answer when $top is above the limit (seen on 2026-09-20).
TOO_MANY = [{"errMsg": "您所要求的資料量已超過10000筆，請確認您是否正確設定top參數，謝謝。"}]


class FakeServer:
    """Answers like FarmTransData over the fixture: date range, then the crop filter (a substring
    of 作物名稱; closure notices always come along), then $skip/$top. `failures` are served
    first, one per request: a status code to answer with or an exception to raise."""

    def __init__(self, failures: Sequence[int | Exception] = (), payload: Any = None) -> None:
        self.failures = list(failures)
        self.payload = payload
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.failures:
            failure = self.failures.pop(0)
            if isinstance(failure, Exception):
                raise failure
            return httpx.Response(failure, text="Service Unavailable")
        if self.payload is not None:
            return httpx.Response(200, json=self.payload)
        q = request.url.params
        first, last = from_roc(q["StartDate"]), from_roc(q["EndDate"])
        rows = [
            r
            for r in ROWS
            if first <= from_roc(r["交易日期"]) <= last
            and (r["作物代號"] == "rest" or q["Crop"] in r["作物名稱"])
        ]
        skip, top = int(q["$skip"]), int(q["$top"])
        return httpx.Response(200, json=rows[skip : skip + top])

    @property
    def params(self) -> list[dict[str, str]]:
        return [dict(r.url.params) for r in self.requests]


class Sleeps(list[float]):
    """Records the pauses instead of waiting."""

    async def __call__(self, seconds: float) -> None:
        self.append(seconds)


def make(
    server: FakeServer,
    products: Sequence[str] = ("甘藍-初秋", "香蕉"),
    days: int = 3,
    **options: Any,
) -> tuple[TwMoaProvider, Sleeps]:
    sleeps = Sleeps()
    provider = TwMoaProvider(
        products,
        today_of=lambda _c: DAY,
        days=days,
        transport=httpx.MockTransport(server),
        sleep=sleeps,
        **options,
    )
    return provider, sleeps


async def fetch_window(provider: TwMoaProvider, days: int = 3) -> list[RawRow]:
    rows: list[RawRow] = []
    for i in reversed(range(days)):
        rows += await provider.fetch(DAY - timedelta(days=i))
    return rows


@pytest.fixture(scope="module")
def maps() -> SourceMaps:
    return maps_from_seeds(SEEDS, "tw_moa")


@pytest.fixture(scope="module")
def provider() -> TwMoaProvider:
    return TwMoaProvider(products_from_seeds(SEEDS), today_of=lambda _c: DAY)


def real(day: str, market: str, product: str) -> RawRow:
    """The one fixture row of a product at a market on a ROC date."""
    (found,) = [
        r for r in ROWS if (r["交易日期"], r["市場名稱"], r["作物名稱"]) == (day, market, product)
    ]
    return found


# ---------- normalize ----------


def test_a_real_row_becomes_a_quote_per_kg(provider: TwMoaProvider, maps: SourceMaps) -> None:
    q = provider.normalize(real("115.09.16", "台北二", "甘藍-初秋"), maps)
    assert q is not None
    assert (q.source, q.country, q.price_type, q.area_id, q.market_id, q.crop_id) == (
        "tw_moa",
        "TW",
        "wholesale",
        "taipei",
        "tp2",
        "cabbage",
    )
    assert (q.variety, q.trade_date) == ("初秋", DAY)
    assert (q.rep_price, q.low_price, q.high_price, q.volume_kg) == (49.7, 33.0, 75.0, 5400.0)


def test_only_the_listed_varieties_are_mapped(provider: TwMoaProvider, maps: SourceMaps) -> None:
    def crop(product: str) -> str | None:
        q = provider.normalize(real("115.09.16", "台北一", product), maps)
        return None if q is None else q.crop_id

    assert crop("香蕉") == "banana"  # the plain name is the common Pei-chiao banana
    assert crop("甘薯-臺農57號") == "sweetpotato"
    assert crop("番茄-牛番茄") == "tomato"
    # Other varieties, imported lots and look-alike names are never guessed.
    assert crop("香蕉-芭蕉紅芭蕉") is None
    assert crop("甘藍-改良種") is None
    assert crop("甘藍-進口 初秋") is None
    assert crop("甘薯葉") is None
    assert crop("小番茄-聖女") is None


def test_markets_outside_our_areas_are_not_mapped(
    provider: TwMoaProvider, maps: SourceMaps
) -> None:
    assert provider.normalize(real("115.09.16", "溪湖鎮", "甘藍-初秋"), maps) is None


def test_closure_notices_are_counted_apart_from_unmapped_rows(
    provider: TwMoaProvider, maps: SourceMaps
) -> None:
    quotes, dropped = normalize_all(provider, ROWS, maps)
    notices = [r for r in ROWS if r["作物代號"] == "rest"]
    assert len(notices) == 25
    assert dropped["market_closed"] == 25
    assert len(quotes) + dropped["unmapped"] + dropped["market_closed"] == len(ROWS)
    assert "malformed" not in dropped
    by_crop = Counter(q.crop_id for q in quotes)
    assert set(by_crop) == {"cabbage", "banana", "sweetpotato", "tomato"}


# ---------- fetch ----------


async def test_one_request_per_product_covers_the_whole_window() -> None:
    server = FakeServer()
    provider, _ = make(server)
    rows = await fetch_window(provider)
    assert server.params == [
        {
            "StartDate": "115.09.14",
            "EndDate": "115.09.16",
            "Crop": crop,
            "$top": "5000",
            "$skip": "0",
        }
        for crop in ("甘藍-初秋", "香蕉")
    ]
    expected = [r for r in ROWS if r["作物名稱"] == "甘藍-初秋" or r["作物名稱"].startswith("香蕉")]
    assert len([r for r in rows if r["作物代號"] != "rest"]) == len(expected)
    # Every answer repeats the closure notices of the period; each is kept once.
    assert len([r for r in rows if r["作物代號"] == "rest"]) == 25


async def test_fetch_returns_the_rows_of_that_day_only() -> None:
    provider, _ = make(FakeServer())
    rows = await provider.fetch(DAY)
    assert rows
    assert {r["交易日期"] for r in rows} == {"115.09.16"}


async def test_the_window_is_downloaded_once_per_run() -> None:
    server = FakeServer()
    provider, _ = make(server)
    await fetch_window(provider)
    await fetch_window(provider)
    assert len(server.requests) == 2


async def test_days_outside_the_window_need_no_request() -> None:
    server = FakeServer()
    provider, _ = make(server, days=3)
    assert await provider.fetch(DAY - timedelta(days=3)) == []
    assert await provider.fetch(DAY + timedelta(days=1)) == []
    assert server.requests == []


async def test_full_pages_are_followed() -> None:
    server = FakeServer()
    provider, _ = make(server, products=["甘藍-初秋"], page_size=10)
    rows = await fetch_window(provider)
    skips = [int(p["$skip"]) for p in server.params]
    assert skips == list(range(0, 10 * len(skips), 10))
    assert {p["$top"] for p in server.params} == {"10"}
    expected = [r for r in ROWS if r["作物名稱"] == "甘藍-初秋" or r["作物代號"] == "rest"]
    assert len(expected) == 56  # 31 prices + 25 notices: six pages, the last one short
    assert sorted(map(json.dumps, rows)) == sorted(map(json.dumps, expected))


async def test_rows_dated_outside_the_window_are_reported(
    caplog: pytest.LogCaptureFixture,
) -> None:
    odd = {**real("115.09.16", "台北二", "甘藍-初秋"), "交易日期": "2026-09-16"}
    provider, _ = make(FakeServer(payload=[odd]), products=["甘藍-初秋"])
    with caplog.at_level("WARNING", logger="app.ingest.tw_moa"):
        assert await fetch_window(provider) == []
    assert "1 rows dated outside" in caplog.text


async def test_endless_paging_is_cut_off() -> None:
    provider, _ = make(FakeServer(), products=["甘藍-初秋"], page_size=1)
    with pytest.raises(UpstreamError, match="pages"):
        await provider.fetch(DAY)


async def test_requests_are_spaced_out() -> None:
    provider, sleeps = make(FakeServer())
    await fetch_window(provider)
    assert sleeps == [tw_moa.PAUSE_S]  # none before the first request


async def test_busy_answers_and_timeouts_are_retried_with_backoff() -> None:
    server = FakeServer(failures=[503, httpx.ConnectTimeout("slow"), 429])
    provider, sleeps = make(server, products=["甘藍-初秋"], attempts=4)
    rows = await fetch_window(provider)
    assert len(rows) == 56
    assert len(server.requests) == 4
    assert sleeps == [tw_moa.BACKOFF_S, tw_moa.BACKOFF_S * 2, tw_moa.BACKOFF_S * 4]


async def test_the_run_fails_when_the_retries_run_out() -> None:
    server = FakeServer(failures=[503, 503, 503])
    provider, _ = make(server, products=["甘藍-初秋"])
    with pytest.raises(UpstreamError, match="3 attempts"):
        await provider.fetch(DAY)
    assert len(server.requests) == 3


async def test_a_client_error_is_not_retried() -> None:
    server = FakeServer(failures=[404])
    provider, _ = make(server, products=["甘藍-初秋"])
    with pytest.raises(UpstreamError, match="404"):
        await provider.fetch(DAY)
    assert len(server.requests) == 1


@pytest.mark.parametrize(
    ("payload", "message"),
    [(TOO_MANY, "10000"), ({"rows": []}, "not a list"), (["x"], "not a list")],
)
async def test_an_error_answer_fails_the_run(payload: Any, message: str) -> None:
    provider, _ = make(FakeServer(payload=payload))
    with pytest.raises(UpstreamError, match=message):
        await provider.fetch(DAY)


async def test_an_answer_that_is_not_json_fails_the_run() -> None:
    def html(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>maintenance</html>")

    provider = TwMoaProvider(["香蕉"], today_of=lambda _c: DAY, transport=httpx.MockTransport(html))
    with pytest.raises(UpstreamError, match="JSON"):
        await provider.fetch(DAY)


def test_products_come_from_the_seed_maps() -> None:
    products = products_from_seeds(SEEDS)
    assert products[:3] == ["甘藍-初秋", "小白菜-土白菜", "香蕉"]
    assert "濕香菇" in products
    assert len(products) == len(set(products)) == 18


# ---------- pipeline ----------


async def test_real_rows_flow_through_the_pipeline(session: AsyncSession) -> None:
    await sync_seed(session)
    provider, _ = make(FakeServer(), products=products_from_seeds(SEEDS))
    summary = await run_provider(session, provider, {"IN": DAY, "TW": DAY}, now=NOW)
    assert summary.status == "ok"

    area = await session.execute(
        text(
            "SELECT price, n_markets, min_market, max_market FROM area_daily WHERE"
            " area_id = 'taipei' AND crop_id = 'cabbage' AND price_type = 'wholesale'"
            " AND trade_date = :d"
        ),
        {"d": DAY},
    )
    price, n, low, high = area.one()
    # 甘藍-初秋 on 115.09.16: 台北一 48.6 and 台北二 49.7 (see the fixture).
    assert (float(price), n, float(low), float(high)) == (49.15, 2, 48.6, 49.7)

    runs = await session.execute(text("SELECT rows_in, rows_ok, drop_reasons FROM ingest_runs"))
    rows_in, rows_ok, reasons = runs.one()
    assert reasons["market_closed"] == 25
    assert rows_in == rows_ok + sum(reasons.values())
    sources = await session.execute(text("SELECT DISTINCT source, country FROM quotes"))
    assert sources.all() == [("tw_moa", "TW")]


def offline(monkeypatch: pytest.MonkeyPatch) -> None:
    """Makes the worker build tw_moa over FakeServer instead of the real API."""

    def build(ctx: BuildContext) -> TwMoaProvider:
        server = httpx.MockTransport(FakeServer())
        products = products_from_seeds(ctx.seeds)
        return TwMoaProvider(
            products, ctx.today_of, plan=ctx.days, transport=server, sleep=Sleeps()
        )

    monkeypatch.setitem(registry.SOURCES, tw_moa.SOURCE, replace(tw_moa.INFO, build=build))


async def test_a_country_never_mixes_demo_and_real_prices(
    settings: Settings, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:

    def clock() -> datetime:
        return NOW

    async def sources() -> list[tuple[str, str]]:
        result = await session.execute(
            text("SELECT DISTINCT country, source FROM quotes ORDER BY country, source")
        )
        return [(c, s) for c, s in result.tuples().all()]

    async def count(where: str) -> int:
        result = await session.execute(
            text(f"SELECT count(*) FROM area_daily WHERE country = 'TW' AND {where}"),
            {"d": DAY - timedelta(days=2)},
        )
        return int(result.scalar_one())

    offline(monkeypatch)
    demo = settings.model_copy(update={"providers": "mock"})
    real = settings.model_copy(update={"providers": "mock,tw_moa"})

    await worker.run_once(demo, clock)
    assert await sources() == [("IN", "mock"), ("MY", "mock"), ("TW", "mock")]

    summaries = await worker.run_once(real, clock)
    assert [(s.source, s.status) for s in summaries] == [("mock", "ok"), ("tw_moa", "ok")]
    assert await sources() == [("IN", "mock"), ("MY", "mock"), ("TW", "tw_moa")]
    # Nothing of the demo is left in Taiwan: no retail, no days before the real sample.
    assert await count("price_type = 'retail'") == 0
    assert await count("trade_date < :d") == 0
    assert await count("price_type = 'wholesale'") > 0

    # The hourly refresh runs the real source alone.
    refreshed = await worker.run_once(real, clock, refresh="tw_moa")
    assert [(s.source, s.status) for s in refreshed] == [("tw_moa", "ok")]

    await worker.run_once(demo, clock)
    assert await sources() == [("IN", "mock"), ("MY", "mock"), ("TW", "mock")]
