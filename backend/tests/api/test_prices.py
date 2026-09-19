from datetime import date, timedelta

import httpx
import pytest

TODAY = date(2026, 9, 19)
IN_NASHIK = {"country": "IN", "area": "nashik", "type": "wholesale"}


def day(n: int) -> str:
    return (TODAY - timedelta(days=n)).isoformat()


# ---------- /crops/{crop}/quote ----------


async def test_quote_matches_the_documented_shape(api: httpx.AsyncClient) -> None:
    res = await api.get("/api/v1/crops/onion/quote", params=IN_NASHIK | {"days": 30})
    assert res.status_code == 200
    assert res.headers["Cache-Control"] == "public, max-age=60"
    q = res.json()
    keys = [
        *("crop_id", "area_id", "type", "currency", "today", "trade_date", "staleness"),
        *("fetched_at", "price_per_kg", "markets", "change", "stats", "series", "source"),
        "nearby",
    ]
    for key in keys:
        assert key in q
    assert (q["crop_id"], q["area_id"], q["type"], q["currency"]) == (
        "onion",
        "nashik",
        "wholesale",
        "INR",
    )
    assert (q["today"], q["trade_date"]) == ("2026-09-19", "2026-09-19")
    assert q["staleness"] == {"days": 0, "state": "today"}
    assert q["fetched_at"] == "2026-09-19T11:40:00+05:30"
    assert q["price_per_kg"] == pytest.approx(23.5, rel=0.03)
    assert q["reason"] is None
    assert (q["markets"]["count"], q["markets"]["total"]) == (7, 10)
    assert q["markets"]["min_per_kg"] <= q["price_per_kg"] <= q["markets"]["max_per_kg"]
    assert q["change"]["direction"] == "up"
    assert q["change"]["pct"] == pytest.approx(0.042, abs=0.03)
    assert q["change"]["prev_trade_date"] == "2026-09-18"
    assert q["stats"]["arrivals"] in {"low", "normal", "high"}
    assert 0 <= q["stats"]["pos30"] <= 1
    assert q["stats"]["volatility"] in {"low", "mid", "high"}
    assert q["source"] == {"id": "mock", "name": {"zh-TW": "示範資料", "en": "Demo data"}}


async def test_quote_series_has_one_entry_per_day_and_nulls_on_closed_days(
    api: httpx.AsyncClient,
) -> None:
    q = (await api.get("/api/v1/crops/onion/quote", params=IN_NASHIK | {"days": 30})).json()
    series = q["series"]
    assert len(series) == 30
    assert (series[0]["date"], series[-1]["date"]) == (day(29), day(0))
    sunday = next(p for p in series if p["date"] == "2026-09-13")
    assert sunday["price_per_kg"] is None
    assert series[-1]["price_per_kg"] == q["price_per_kg"]
    seven = (await api.get("/api/v1/crops/onion/quote", params=IN_NASHIK | {"days": 7})).json()
    assert len(seven["series"]) == 7


async def test_retail_quote_has_no_market_block_and_no_arrivals(api: httpx.AsyncClient) -> None:
    params = IN_NASHIK | {"type": "retail"}
    q = (await api.get("/api/v1/crops/onion/quote", params=params)).json()
    assert q["price_per_kg"] == pytest.approx(37.6, rel=0.04)
    assert q["markets"] is None
    assert q["stats"]["arrivals"] is None
    assert q["stats"]["volatility"] in {"low", "mid", "high"}


@pytest.mark.parametrize(
    ("crop", "area", "reason"),
    [("chilli", "nashik", "no_retail_crop"), ("onion", "ahmednagar", "no_retail_area")],
)
async def test_missing_retail_prices_carry_a_reason(
    api: httpx.AsyncClient, crop: str, area: str, reason: str
) -> None:
    params = {"country": "IN", "area": area, "type": "retail"}
    q = (await api.get(f"/api/v1/crops/{crop}/quote", params=params)).json()
    assert q["price_per_kg"] is None
    assert q["reason"] == reason
    assert q["change"] is None
    assert all(p["price_per_kg"] is None for p in q["series"])


async def test_area_without_any_data(api: httpx.AsyncClient) -> None:
    params = IN_NASHIK | {"area": "kurnool"}
    q = (await api.get("/api/v1/crops/onion/quote", params=params)).json()
    assert (q["price_per_kg"], q["reason"], q["trade_date"]) == (None, "no_data", None)
    assert q["staleness"] == {"days": None, "state": "none"}


async def test_stale_area_reports_its_latest_trade_date(api: httpx.AsyncClient) -> None:
    params = IN_NASHIK | {"area": "kolar"}
    q = (await api.get("/api/v1/crops/onion/quote", params=params)).json()
    assert q["trade_date"] == day(3)
    assert q["staleness"] == {"days": 3, "state": "stale"}
    assert q["price_per_kg"] is not None


@pytest.mark.parametrize(
    ("path", "params", "code"),
    [
        ("/api/v1/crops/onion/quote", IN_NASHIK | {"area": "taipei"}, "area_not_found"),
        ("/api/v1/crops/durian/quote", IN_NASHIK, "crop_not_found"),
        ("/api/v1/crops/onion/quote", IN_NASHIK | {"country": "XX"}, "country_not_found"),
    ],
)
async def test_unknown_ids_are_404(
    api: httpx.AsyncClient, path: str, params: dict[str, str], code: str
) -> None:
    res = await api.get(path, params=params)
    assert res.status_code == 404
    assert res.json()["error"]["code"] == code


async def test_invalid_type_is_400(api: httpx.AsyncClient) -> None:
    res = await api.get("/api/v1/crops/onion/quote", params=IN_NASHIK | {"type": "bulk"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "invalid_param"


# ---------- /prices ----------


async def test_prices_for_the_watchlist(api: httpx.AsyncClient) -> None:
    params = IN_NASHIK | {"crops": "onion,potato,wheat"}
    res = await api.get("/api/v1/prices", params=params)
    assert res.status_code == 200
    body = res.json()
    assert (body["country"], body["area_id"], body["today"]) == ("IN", "nashik", "2026-09-19")
    assert body["fetched_at"] == "2026-09-19T11:40:00+05:30"
    items = {i["crop_id"]: i for i in body["items"]}
    assert [i["crop_id"] for i in body["items"]] == ["onion", "potato", "wheat"]
    assert items["onion"]["staleness"]["state"] == "today"
    assert items["potato"]["staleness"] == {"days": 1, "state": "stale"}
    assert items["wheat"]["staleness"] == {"days": 3, "state": "stale"}
    spark = items["onion"]["spark"]
    assert len(spark) == 7
    assert spark[0] is None  # Sunday 2026-09-13
    assert spark[-1] == items["onion"]["price_per_kg"]
    assert items["onion"]["change"]["direction"] == "up"


async def test_prices_default_to_every_crop_and_skip_unknown_ids(api: httpx.AsyncClient) -> None:
    body = (await api.get("/api/v1/prices", params=IN_NASHIK)).json()
    assert len(body["items"]) == 21
    body = (await api.get("/api/v1/prices", params=IN_NASHIK | {"crops": "onion,durian"})).json()
    assert [i["crop_id"] for i in body["items"]] == ["onion"]


async def test_retail_prices_explain_missing_crops(api: httpx.AsyncClient) -> None:
    params = IN_NASHIK | {"type": "retail", "crops": "onion,chilli"}
    body = (await api.get("/api/v1/prices", params=params)).json()
    items = {i["crop_id"]: i for i in body["items"]}
    assert items["onion"]["price_per_kg"] is not None
    assert (items["chilli"]["price_per_kg"], items["chilli"]["reason"]) == (None, "no_retail_crop")
    assert items["chilli"]["spark"] == [None] * 7


async def test_prices_for_an_unknown_area(api: httpx.AsyncClient) -> None:
    res = await api.get("/api/v1/prices", params=IN_NASHIK | {"area": "nowhere"})
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "area_not_found"


# ---------- /crops/{crop}/compare ----------


async def test_compare_ranks_every_area_of_the_country(api: httpx.AsyncClient) -> None:
    res = await api.get("/api/v1/crops/onion/compare", params=IN_NASHIK)
    assert res.status_code == 200
    body = res.json()
    rows = {r["area_id"]: r for r in body["rows"]}
    assert len(rows) == 11
    assert body["rank"]["total"] == 10
    assert body["rank"]["position"] == rows["nashik"]["rank"]
    assert rows["nashik"]["is_base"] is True
    assert rows["nashik"]["diff_per_kg"] == 0
    assert rows["pune"]["distance_km"] == 165
    assert rows["pune"]["diff_per_kg"] == pytest.approx(
        rows["pune"]["price_per_kg"] - rows["nashik"]["price_per_kg"]
    )
    assert (rows["kurnool"]["price_per_kg"], rows["kurnool"]["rank"]) == (None, None)
    assert rows["kolar"]["staleness"]["state"] == "stale"
    ranked = sorted((r for r in body["rows"] if r["rank"]), key=lambda r: r["rank"])
    prices = [r["price_per_kg"] for r in ranked]
    assert prices == sorted(prices, reverse=True)
    assert body["rows"][-1]["area_id"] == "kurnool"  # no data last


async def test_compare_from_an_area_without_data_is_unranked(api: httpx.AsyncClient) -> None:
    params = IN_NASHIK | {"area": "kurnool"}
    body = (await api.get("/api/v1/crops/onion/compare", params=params)).json()
    assert body["rank"] == {"position": None, "total": 10}
    assert all(r["diff_per_kg"] is None for r in body["rows"])


# ---------- /crops/{crop}/markets ----------


async def test_markets_of_an_area_with_their_difference_from_the_median(
    api: httpx.AsyncClient,
) -> None:
    params = {"country": "IN", "area": "nashik"}
    body = (await api.get("/api/v1/crops/onion/markets", params=params)).json()
    quote = (await api.get("/api/v1/crops/onion/quote", params=IN_NASHIK)).json()
    assert body["median_per_kg"] == quote["price_per_kg"]
    rows = {r["market_id"]: r for r in body["rows"]}
    assert len(rows) == 10
    assert rows["yeola"]["staleness"] == {"days": 3, "state": "stale"}
    assert rows["malegaon"]["staleness"] == {"days": 1, "state": "stale"}
    assert (rows["manmad"]["price_per_kg"], rows["manmad"]["staleness"]["state"]) == (None, "none")
    assert body["rows"][-1]["market_id"] == "manmad"
    lasalgaon = rows["lasalgaon"]
    assert lasalgaon["name"] == {"zh-TW": "Lasalgaon", "en": "Lasalgaon"}
    assert lasalgaon["km_from_center"] == 32
    assert lasalgaon["diff_per_kg"] == pytest.approx(
        lasalgaon["price_per_kg"] - body["median_per_kg"]
    )


async def test_markets_of_an_area_without_data(api: httpx.AsyncClient) -> None:
    params = {"country": "IN", "area": "kurnool"}
    body = (await api.get("/api/v1/crops/onion/markets", params=params)).json()
    assert body["median_per_kg"] is None
    assert [r["price_per_kg"] for r in body["rows"]] == [None]


# ---------- /crops/{crop}/markets/{market} ----------


async def test_single_market(api: httpx.AsyncClient) -> None:
    res = await api.get("/api/v1/crops/cabbage/markets/tp1", params={"country": "TW"})
    assert res.status_code == 200
    m = res.json()
    assert (m["market_id"], m["area_id"], m["currency"]) == ("tp1", "taipei", "TWD")
    assert m["name"] == {"zh-TW": "台北一", "en": "Taipei 1"}
    assert m["price_per_kg"] == pytest.approx(38.5, rel=0.03)
    assert m["low_per_kg"] < m["price_per_kg"] < m["high_per_kg"]
    assert m["change"]["direction"] == "up"
    assert m["staleness"]["state"] == "today"
    assert m["fetched_at"] == "2026-09-19T14:10:00+08:00"
    assert m["source"]["id"] == "mock"


async def test_unknown_or_foreign_market_is_404(api: httpx.AsyncClient) -> None:
    for market in ("nowhere", "lasalgaon"):
        res = await api.get(f"/api/v1/crops/cabbage/markets/{market}", params={"country": "TW"})
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "market_not_found"
