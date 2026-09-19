"""Exchange rates for the international prices (bonus B5).

`tests/fixtures/er_api_latest_usd.json` is the real answer of https://open.er-api.com/v6/latest/USD
fetched on 2026-09-20 (the rates of 2026-09-19), with the rates cut down to six currencies."""

import json
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pytest

from app.ingest.intl.fx import parse_rates
from app.ingest.intl.http import UpstreamError

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "er_api_latest_usd.json"


def payload(**changes: Any) -> dict[str, Any]:
    data: dict[str, Any] = json.loads(FIXTURE.read_text(encoding="utf-8"))
    data.update(changes)
    return data


def test_the_real_answer_gives_the_rates_of_its_update_day() -> None:
    snapshot = parse_rates(payload())
    assert snapshot.rate_date == date(2026, 9, 19)
    assert snapshot.updated_at == datetime(2026, 9, 19, 0, 2, 31, tzinfo=UTC)
    assert snapshot.next_update_at == datetime(2026, 9, 20, 0, 30, 21, tzinfo=UTC)
    assert snapshot.rates["TWD"] == pytest.approx(31.834145)
    assert snapshot.rates["INR"] == pytest.approx(95.989567)
    assert snapshot.rates["MYR"] == pytest.approx(4.081091)
    assert snapshot.rates["USD"] == 1
    assert len(snapshot.rates) == 6
    assert snapshot.dropped == 0


def test_rates_that_are_not_positive_numbers_are_dropped() -> None:
    rates = {"USD": 1, "TWD": 31.8, "XXX": 0, "BAD": "12", "YYY": -3, "usd": 1, "ZZZ": True}
    snapshot = parse_rates(payload(rates=rates))
    assert snapshot.rates == {"USD": 1, "TWD": 31.8}
    assert snapshot.dropped == 5


def test_an_unknown_next_update_is_left_empty() -> None:
    data = payload()
    del data["time_next_update_unix"]
    assert parse_rates(data).next_update_at is None


@pytest.mark.parametrize(
    ("data", "message"),
    [
        ({"result": "error", "error-type": "unsupported-code"}, "unsupported-code"),
        (["not", "an", "object"], "not a JSON object"),
        (payload(base_code="EUR"), "base EUR"),
        (payload(rates=[]), "no rates"),
        (payload(rates={"USD": 1}), "no rates"),
        (payload(time_last_update_unix="yesterday"), "update time"),
    ],
)
def test_answers_we_cannot_use_are_refused(data: Any, message: str) -> None:
    with pytest.raises(UpstreamError, match=message):
        parse_rates(data)
