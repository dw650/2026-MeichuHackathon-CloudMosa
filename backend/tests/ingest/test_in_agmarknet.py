"""in_agmarknet: India's Agmarknet 2.0 date-wise prices (one state × commodity × month).

`tests/fixtures/in_agmarknet/` holds real answers saved on 2026-09-20: NCT of Delhi (state 25)
onion (commodity 23) for August and September 2026 and tomato (65) for September, complete;
Maharashtra (20) onion for September trimmed to four Nashik markets on 14–19 September (the
source pads their names with a space); and a real answer without any market (Delhi, ragi).
FakeAgmarknet answers like api.agmarknet.gov.in: the saved answer of a state, commodity and
month, the empty answer for any other."""

import json
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
from app.ingest.normalize import RowError, normalize_all
from app.ingest.pipeline import run_provider
from app.ingest.providers import in_agmarknet as agm
from app.ingest.providers.base import BuildContext, RawRow
from app.ingest.seed import sync_seed
from app.seed.loader import load_seed_files

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "in_agmarknet"
SEEDS = load_seed_files()
TODAY = date(2026, 9, 19)  # Saturday; the samples end here
NOW = datetime(2026, 9, 19, 14, 30, tzinfo=UTC)  # 20:00 in India, the evening refresh
STATES, COMMODITIES = agm.codes_from_seeds(SEEDS)
PER_MONTH = len(STATES) * len(COMMODITIES)  # requests for one month


def sample(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class FakeAgmarknet:
    """api.agmarknet.gov.in over the fixtures. `answers` maps "state_commodity_yyyy-mm" to an
    answer; anything else gets the real empty answer. `failures` are served first."""

    def __init__(
        self,
        answers: dict[str, Any] | None = None,
        failures: Sequence[int | Exception] = (),
    ) -> None:
        self.answers = answers if answers is not None else self.default()
        self.failures = list(failures)
        self.requests: list[httpx.Request] = []

    @staticmethod
    def default() -> dict[str, Any]:
        names = ["25_23_2026-08", "25_23_2026-09", "25_65_2026-09", "20_23_2026-09"]
        return {name: sample(f"{name}.json") for name in names}

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.failures:
            failure = self.failures.pop(0)
            if isinstance(failure, Exception):
                raise failure
            return httpx.Response(failure, text="busy")
        q = request.url.params
        key = f"{q['stateId']}_{q['commodityId']}_{q['year']}-{int(q['month']):02d}"
        answer = self.answers.get(key, sample("empty.json"))
        if isinstance(answer, str):
            return httpx.Response(200, text=answer)
        return httpx.Response(200, json=answer)

    @property
    def months(self) -> list[str]:
        """The months asked for, in order, once each."""
        seen: list[str] = []
        for r in self.requests:
            month = f"{r.url.params['year']}-{int(r.url.params['month']):02d}"
            if month not in seen:
                seen.append(month)
        return seen


class Sleeps(list[float]):
    async def __call__(self, seconds: float) -> None:
        self.append(seconds)


def make(
    server: FakeAgmarknet,
    plan: Sequence[date] | None = None,
    today: date = TODAY,
    sleep: Sleeps | None = None,
) -> agm.AgmarknetProvider:
    return agm.AgmarknetProvider(
        STATES,
        COMMODITIES,
        today_of=lambda _c: today,
        plan=plan,
        transport=httpx.MockTransport(server),
        sleep=sleep if sleep is not None else Sleeps(),
    )


def window(today: date = TODAY) -> list[date]:
    return [today - timedelta(days=i) for i in reversed(range(60))]


async def fetch_all(provider: agm.AgmarknetProvider, days: Sequence[date]) -> list[RawRow]:
    rows: list[RawRow] = []
    for day in days:
        rows += await provider.fetch(day)
    return rows


# ---------- fetch ----------


def test_states_and_commodities_come_from_the_seed_maps() -> None:
    assert STATES == ["20", "16", "25"]  # Maharashtra, Karnataka, NCT of Delhi
    assert len(COMMODITIES) == len(next(s for s in SEEDS if s.country.code == "IN").crops)
    assert {"23", "65", "1"} <= set(COMMODITIES)  # onion, tomato, wheat


async def test_a_full_run_asks_every_state_and_commodity_once_a_month() -> None:
    server = FakeAgmarknet()
    provider = make(server)
    rows = await fetch_all(provider, window())
    await fetch_all(provider, window())
    assert server.months == ["2026-07", "2026-08", "2026-09"]
    assert provider.stats.requests == len(server.requests) == 3 * PER_MONTH
    assert {r["stateId"] for r in rows} == {"20", "25"}
    assert {r["commodityId"] for r in rows} == {"23", "65"}
    days = {r["arrivalDate"] for r in rows}
    assert "15/08/2026" not in days  # Independence Day: no market in the samples reported
    assert {"01/08/2026", "19/09/2026"} <= days
    params = server.requests[0].url.params
    assert params["includeExcel"] == "false"
    # The source refuses a generic client name (HTTP 403), so it learns who we are.
    assert server.requests[0].headers["user-agent"].startswith("agri-prices/")


async def test_fetch_returns_the_rows_of_that_day() -> None:
    provider = make(FakeAgmarknet())
    rows = await provider.fetch(date(2026, 9, 18))
    assert {r["arrivalDate"] for r in rows} == {"18/09/2026"}
    assert set(rows[0]) == {
        "stateId",
        "commodityId",
        "marketName",
        "arrivalDate",
        "arrivals",
        "variety",
        "minimumPrice",
        "maximumPrice",
        "modalPrice",
    }
    lasalgaon = next(r for r in rows if r["marketName"] == "APMC Lasalgaon ")
    assert (lasalgaon["modalPrice"], lasalgaon["arrivals"]) == (4300.0, 795.8)


async def test_a_plan_asks_only_for_its_months_and_keeps_its_days() -> None:
    server = FakeAgmarknet()
    plan = [date(2026, 8, 31), date(2026, 9, 1)]
    provider = make(server, plan=plan)
    rows = await fetch_all(provider, window())
    assert server.months == ["2026-08", "2026-09"]
    assert provider.stats.requests == 2 * PER_MONTH
    assert {r["arrivalDate"] for r in rows} == {"31/08/2026", "01/09/2026"}


async def test_an_empty_plan_sends_nothing() -> None:
    server = FakeAgmarknet()
    assert await fetch_all(make(server, plan=[]), window()) == []
    assert server.requests == []


async def test_requests_are_spaced_out() -> None:
    sleeps = Sleeps()
    provider = make(FakeAgmarknet(), plan=[TODAY], sleep=sleeps)
    await provider.fetch(TODAY)
    assert sleeps == [1.0] * (PER_MONTH - 1)


@pytest.mark.parametrize(
    ("answer", "error"),
    [
        ({"success": False, "message": "Invalid commodity"}, "refused"),
        ("<html>maintenance</html>", "not JSON"),
        ({"success": True, "columns": [], "markets": []}, "columns changed"),
    ],
)
async def test_unusable_answers_fail_the_run(answer: Any, error: str) -> None:
    server = FakeAgmarknet({"20_1_2026-09": answer})
    with pytest.raises(UpstreamError, match=error):
        await make(server, plan=[TODAY]).fetch(TODAY)


async def test_a_change_of_units_fails_the_run() -> None:
    answer = sample("25_23_2026-09.json")
    for column in answer["columns"]:
        column["title"] = column["title"].replace("Quintal", "Kg")
    server = FakeAgmarknet({"25_23_2026-09": answer})
    with pytest.raises(UpstreamError, match="columns changed"):
        await make(server, plan=[TODAY]).fetch(TODAY)


async def test_an_answer_without_markets_fails_the_run() -> None:
    answer = sample("empty.json") | {"markets": None}
    server = FakeAgmarknet({"20_1_2026-09": answer})
    with pytest.raises(UpstreamError, match="no market list"):
        await make(server, plan=[TODAY]).fetch(TODAY)


async def test_busy_answers_are_retried() -> None:
    server = FakeAgmarknet(failures=[503, httpx.ReadTimeout("slow")])
    provider = make(server, plan=[TODAY])
    assert await provider.fetch(TODAY)
    assert provider.stats.requests == PER_MONTH + 2


async def test_client_errors_fail_the_run() -> None:
    server = FakeAgmarknet(failures=[404])
    provider = make(server, plan=[TODAY])
    with pytest.raises(UpstreamError, match="HTTP 404"):
        await provider.fetch(TODAY)
    assert provider.stats.requests == 1


# ---------- normalize ----------


def row(**overrides: Any) -> RawRow:
    """A real row: APMC Lasalgaon (Nashik), onion, 19 September 2026."""
    raw: RawRow = {
        "stateId": "20",
        "commodityId": "23",
        "marketName": "APMC Lasalgaon ",
        "arrivalDate": "19/09/2026",
        "arrivals": 352.0,
        "variety": "Unhali",
        "minimumPrice": 1200.0,
        "maximumPrice": 5001.0,
        "modalPrice": 4100.0,
    }
    return raw | overrides


MAPS = maps_from_seeds(SEEDS, agm.SOURCE)
PROVIDER = make(FakeAgmarknet())


def test_rows_become_quotes_per_kg_with_arrivals() -> None:
    q = PROVIDER.normalize(row(), MAPS)
    assert q is not None
    assert (q.source, q.country, q.price_type, q.area_id, q.market_id, q.crop_id) == (
        agm.SOURCE,
        "IN",
        "wholesale",
        "nashik",
        "lasalgaon",
        "onion",
    )
    assert (q.trade_date, q.variety) == (date(2026, 9, 19), "Unhali")
    assert q.rep_price == pytest.approx(41.0)
    assert (q.low_price, q.high_price) == (pytest.approx(12.0), pytest.approx(50.01))
    assert q.volume_kg == pytest.approx(352_000)  # tonnes → kg


def test_market_names_are_matched_within_their_state() -> None:
    assert PROVIDER.normalize(row(marketName="APMC  Lasalgaon"), MAPS) is not None
    assert PROVIDER.normalize(row(stateId="16"), MAPS) is None  # not a Karnataka market
    assert PROVIDER.normalize(row(marketName="APMC Nowhere"), MAPS) is None
    assert PROVIDER.normalize(row(commodityId="380"), MAPS) is None  # absinthe


def test_a_market_name_longer_than_the_map_column_is_cut_like_in_the_seed() -> None:
    name = "Shivsiddha Govind Producer Company Ltd Sanchalit Khajgi Krushi Utpann Bajar"
    raw = row(marketName=f"{name} Samati-Abhona-Kalwan")  # 99 characters with "20|"
    q = PROVIDER.normalize(raw, MAPS)
    assert q is not None
    assert q.area_id == "nashik"


def test_blank_or_zero_arrivals_are_no_arrivals() -> None:
    for arrivals in (0, None, ""):
        q = PROVIDER.normalize(row(arrivals=arrivals), MAPS)
        assert q is not None
        assert q.volume_kg is None


def test_a_bad_date_is_malformed() -> None:
    with pytest.raises(RowError):
        PROVIDER.normalize(row(arrivalDate="2026-09-19"), MAPS)
    quotes, dropped = normalize_all(PROVIDER, [row(), row(arrivalDate="?")], MAPS)
    assert len(quotes) == 1
    assert dropped == {"malformed": 1}


# ---------- the pipeline ----------


async def area_price(
    session: AsyncSession, area: str, crop: str, day: date
) -> tuple[float, int] | None:
    result = await session.execute(
        text(
            "SELECT price, n_markets FROM area_daily WHERE area_id = :a AND crop_id = :c"
            " AND price_type = 'wholesale' AND trade_date = :d"
        ),
        {"a": area, "c": crop, "d": day},
    )
    found = result.one_or_none()
    return None if found is None else (float(found[0]), found[1])


async def test_real_rows_become_market_prices_and_area_medians(session: AsyncSession) -> None:
    await sync_seed(session)
    provider = make(FakeAgmarknet())
    summary = await run_provider(session, provider, {"IN": TODAY, "TW": TODAY, "MY": TODAY}, NOW)
    assert summary.status == "ok"
    assert summary.requests == 3 * PER_MONTH
    assert summary.rows_dropped == 0

    # Nashik onion (₹/quintal modal prices of the four sample markets):
    # 19 Sep: Lasalgaon 4100, Nasik 4100, Pimpalgaon Baswant 4400, Yeola 4000 → 4100.
    # 18 Sep: 4300, 4200, 4400, 4225 → (4225 + 4300) / 2 = 4262.5.
    assert await area_price(session, "nashik", "onion", TODAY) == (41.0, 4)
    assert await area_price(session, "nashik", "onion", date(2026, 9, 18)) == (42.625, 4)
    # Delhi onion, 18 Sep: Azadpur 3359, Keshopur 4300, Gazipur 4800; 19 Sep: Azadpur only.
    assert await area_price(session, "delhi", "onion", date(2026, 9, 18)) == (43.0, 3)
    assert await area_price(session, "delhi", "onion", TODAY) == (33.75, 1)
    # Delhi tomato, 18 Sep: Azadpur 2319, Keshopur 2400 (variety "Other"), Gazipur 2200.
    assert await area_price(session, "delhi", "tomato", date(2026, 9, 18)) == (23.19, 3)

    volume = await session.execute(
        text(
            "SELECT volume_kg FROM area_daily WHERE area_id = 'nashik' AND crop_id = 'onion'"
            " AND price_type = 'wholesale' AND trade_date = :d"
        ),
        {"d": TODAY},
    )
    assert float(volume.scalar_one()) == pytest.approx((352 + 234 + 1326 + 450) * 1000)
    retail = await session.execute(
        text("SELECT count(*) FROM quotes WHERE country = 'IN' AND price_type = 'retail'")
    )
    assert retail.scalar_one() == 0  # Agmarknet has no retail prices
    runs = await session.execute(text("SELECT requests, rows_in, rows_ok FROM ingest_runs"))
    requests, rows_in, rows_ok = runs.one()
    assert requests == 3 * PER_MONTH
    assert rows_in == rows_ok > 0


# ---------- worker ----------


def offline(monkeypatch: pytest.MonkeyPatch, server: FakeAgmarknet) -> None:
    """Makes the worker build in_agmarknet over `server` instead of the real API."""

    def build(ctx: BuildContext) -> agm.AgmarknetProvider:
        states, commodities = agm.codes_from_seeds(ctx.seeds)
        return agm.AgmarknetProvider(
            states,
            commodities,
            ctx.today_of,
            plan=ctx.days,
            transport=httpx.MockTransport(server),
            sleep=Sleeps(),
        )

    monkeypatch.setitem(registry.SOURCES, agm.SOURCE, replace(agm.INFO, build=build))


async def test_india_switches_between_demo_and_real_prices(
    settings: Settings, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    server = FakeAgmarknet()
    offline(monkeypatch, server)
    demo = settings.model_copy(update={"providers": "mock"})
    real = settings.model_copy(update={"providers": "mock,in_agmarknet"})

    async def sources() -> list[tuple[str, str]]:
        result = await session.execute(
            text("SELECT DISTINCT country, source FROM quotes ORDER BY country, source")
        )
        return [(c, s) for c, s in result.tuples().all()]

    async def retail_rows() -> int:
        result = await session.execute(
            text("SELECT count(*) FROM area_daily WHERE country = 'IN' AND price_type = 'retail'")
        )
        return int(result.scalar_one())

    await worker.run_once(demo, lambda: NOW)
    assert ("IN", "mock") in await sources()
    assert await retail_rows() > 0  # the demo keeps its retail prices

    summaries = await worker.run_once(real, lambda: NOW, startup=True)
    assert [(s.source, s.status) for s in summaries] == [("mock", "ok"), (agm.SOURCE, "ok")]
    assert await sources() == [("IN", agm.SOURCE), ("MY", "mock"), ("TW", "mock")]
    assert await retail_rows() == 0  # no retail source for India: "—" with its reason

    # A restart right after: nothing is asked.
    sent = len(server.requests)
    again = await worker.run_once(real, lambda: NOW + timedelta(minutes=10), startup=True)
    assert [(s.source, s.status) for s in again] == [("mock", "ok"), (agm.SOURCE, "skipped")]
    assert len(server.requests) == sent

    # The next scheduled run asks for the days without prices and the last three days: the
    # samples cover no day before 1 August, so July is asked again along with September.
    refreshed = await worker.run_once(real, lambda: NOW + timedelta(hours=1), refresh=agm.SOURCE)
    assert [(s.source, s.status) for s in refreshed] == [(agm.SOURCE, "ok")]
    asked = FakeAgmarknet(server.answers)
    asked.requests = server.requests[sent:]
    assert asked.months == ["2026-07", "2026-08", "2026-09"]

    await worker.run_once(demo, lambda: NOW)
    assert await sources() == [("IN", "mock"), ("MY", "mock"), ("TW", "mock")]
