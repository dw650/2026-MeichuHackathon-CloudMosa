"""`other_countries` on the comparison: the same crop in the other countries (docs/02 §5.4)."""

from typing import Any

import httpx
import pytest

COMPARE = "/api/v1/crops/{crop}/compare"
# One area per country, only to ask that country's own comparison for the same crop.
AREAS = {"IN": "nashik", "MY": "klang", "TW": "taipei"}


async def _compare(
    api: httpx.AsyncClient, crop: str, country: str, area: str, price_type: str = "wholesale"
) -> Any:
    res = await api.get(
        COMPARE.format(crop=crop),
        params={"country": country, "area": area, "type": price_type},
    )
    assert res.status_code == 200
    return res.json()


async def _catalog(api: httpx.AsyncClient) -> dict[str, set[str]]:
    """Crop id → the countries that have it, from the catalog (never hard-coded)."""
    seen: dict[str, set[str]] = {}
    for code in ("IN", "TW", "MY"):
        res = await api.get(f"/api/v1/countries/{code}/crops")
        assert res.status_code == 200
        for crop in res.json()["crops"]:
            seen.setdefault(crop["id"], set()).add(code)
    return seen


async def _shared_crop(api: httpx.AsyncClient, country: str = "TW") -> str:
    """A crop `country` shares with at least one other country."""
    shared = [
        c for c, codes in (await _catalog(api)).items() if country in codes and len(codes) > 1
    ]
    assert shared, f"the mock catalog should share a crop between {country} and another country"
    return shared[0]


async def test_the_card_lists_every_other_country_that_has_the_crop(
    api: httpx.AsyncClient,
) -> None:
    crop = await _shared_crop(api)
    data = await _compare(api, crop, "TW", "taipei")
    card = data["other_countries"]
    assert card is not None
    assert card["currency"] == "TWD"
    assert "TW" not in [row["country"] for row in card["rows"]]
    assert card["rows"], "another country has this crop, so there is a row"
    for row in card["rows"]:
        assert row["type"] in ("wholesale", "retail", None)
        if row["price_per_kg"] is None:
            assert row["reason"] in ("no_data", "no_fx")
        else:
            # Converted into the viewer's currency, with the areas behind the median.
            assert row["reason"] is None
            assert row["n_areas"] >= 1
            assert row["trade_date"] is not None
            assert row["local_per_kg"] is not None
            if row["currency"] != "TWD":
                assert row["price_per_kg"] != pytest.approx(row["local_per_kg"])
    assert card["fx_date"] is not None


async def test_a_crop_of_one_country_only_lists_no_row(api: httpx.AsyncClient) -> None:
    """No other country has it, so the screen says so instead of showing an empty box."""
    alone = sorted(c for c, codes in (await _catalog(api)).items() if codes == {"IN"})
    assert alone, "the mock catalog should have a crop only India grows"
    card = (await _compare(api, alone[0], "IN", "nashik"))["other_countries"]
    assert card["rows"] == []
    assert card["currency"] == "INR"


async def test_a_crop_with_a_world_bank_series_gets_the_world_price(
    api: httpx.AsyncClient,
) -> None:
    """A Pink Sheet crop (wheat) carries the world price too, converted the same way."""
    card = (await _compare(api, "wheat", "IN", "nashik"))["other_countries"]
    world = card["world"]
    assert world is not None
    assert world["series_id"] == "wheat"
    assert world["month"] is not None
    assert world["usd"] is not None and world["usd_unit"] in ("mt", "kg")
    assert world["price_per_kg"] is not None and world["reason"] is None


async def test_a_crop_without_a_series_has_no_world_price(api: httpx.AsyncClient) -> None:
    crop = await _shared_crop(api)
    assert (await _compare(api, crop, "TW", "taipei"))["other_countries"]["world"] is None


async def test_the_national_price_is_the_median_of_the_countrys_latest_day(
    api: httpx.AsyncClient,
) -> None:
    """The row must match what the same country's own comparison reports that day."""
    crop = await _shared_crop(api)
    data = await _compare(api, crop, "TW", "taipei")
    row = next(
        (r for r in data["other_countries"]["rows"] if r["price_per_kg"] is not None),
        None,
    )
    assert row is not None
    their = await _compare(
        api,
        crop,
        row["country"],
        AREAS[row["country"]],
        row["type"],
    )
    same_day = sorted(
        r["price_per_kg"]
        for r in their["rows"]
        if r["price_per_kg"] is not None and r["trade_date"] == row["trade_date"]
    )
    assert len(same_day) == row["n_areas"]
    middle = len(same_day) // 2
    expected = (
        same_day[middle] if len(same_day) % 2 else (same_day[middle - 1] + same_day[middle]) / 2
    )
    assert row["local_per_kg"] == pytest.approx(expected, abs=1e-4)


async def test_a_row_is_labelled_with_the_price_type_it_came_from(
    api: httpx.AsyncClient,
) -> None:
    """The viewer's price type when the country publishes it, the other one when it does not
    (Malaysia publishes retail only in real life), never an unlabelled mix."""
    crop = await _shared_crop(api)
    for price_type in ("wholesale", "retail"):
        data = await _compare(api, crop, "TW", "taipei", price_type)
        for row in data["other_countries"]["rows"]:
            if row["price_per_kg"] is None:
                continue
            their = await _compare(api, crop, row["country"], AREAS[row["country"]], price_type)
            has_preferred = any(r["price_per_kg"] is not None for r in their["rows"])
            assert row["type"] == price_type if has_preferred else row["type"] != price_type
