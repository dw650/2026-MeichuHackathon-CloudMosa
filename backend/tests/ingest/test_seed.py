import csv
from pathlib import Path
from typing import Any

import pytest
import yaml
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingest.seed import sync_seed
from app.seed.loader import SEED_DIR, load_seed_file, load_seed_files

CATEGORIES = {"cereal", "veg", "fruit", "pulse", "spice", "oil", "other"}


def test_seed_files_have_the_expected_areas_and_crops() -> None:
    seeds = {s.country.code: s for s in load_seed_files()}
    assert list(seeds) == ["IN", "TW", "MY"]
    assert len(seeds["IN"].areas) == 11
    assert len(seeds["TW"].areas) == 10
    assert len(seeds["MY"].areas) == 75
    assert len(seeds["IN"].crops) == 21
    assert len(seeds["TW"].crops) == 21
    assert len(seeds["MY"].crops) == 21
    nashik = next(a for a in seeds["IN"].areas if a.id == "nashik")
    assert len(nashik.markets) == 10


def test_every_crop_category_is_allowed() -> None:
    for seed in load_seed_files():
        assert {c.category for c in seed.crops} <= CATEGORIES


# Malaysia's source reports no grain but wheat flour and nothing for "other" at the wet
# markets (docs/06 §1.5); those two categories are short on purpose.
SHORT_CATEGORIES = {"MY": {"cereal": 1, "other": 0}}


def test_every_category_has_at_least_two_crops_in_each_country() -> None:
    # The home grid shows all seven categories, so none of them should open an empty list.
    for seed in load_seed_files():
        short = SHORT_CATEGORIES.get(seed.country.code, {})
        counts = {cat: sum(c.category == cat for c in seed.crops) for cat in CATEGORIES}
        for cat, count in counts.items():
            if cat in short:
                assert count == short[cat], (seed.country.code, cat, count)
            else:
                assert count >= 2, (seed.country.code, cat, count)


def test_default_watchlists_match_the_spec() -> None:
    seeds = {s.country.code: s for s in load_seed_files()}
    assert [c.id for c in seeds["IN"].crops if c.watch] == [
        "onion",
        "tomato",
        "potato",
        "chilli",
        "soybean",
        "maize",
        "wheat",
    ]
    assert [c.id for c in seeds["TW"].crops if c.watch] == [
        "cabbage",
        "bokchoy",
        "banana",
        "sweetpotato",
        "scallion",
        "cauliflower",
    ]
    assert [c.id for c in seeds["MY"].crops if c.watch] == [
        "tomato",
        "cabbage",
        "chilli",
        "onion",
        "cucumber",
        "bokchoy",
        "garlic",
    ]


def _raw(code: str) -> dict[str, Any]:
    data: dict[str, Any] = yaml.safe_load((SEED_DIR / f"{code}.yaml").read_text(encoding="utf-8"))
    return data


def _write(tmp_path: Path, data: dict[str, Any]) -> Path:
    path = tmp_path / f"{data['country']['code']}.yaml"
    path.write_text(yaml.safe_dump(data, allow_unicode=True), encoding="utf-8")
    return path


def test_unknown_category_is_rejected(tmp_path: Path) -> None:
    data = _raw("TW")
    data["crops"][0]["category"] = "flowers"
    with pytest.raises(ValidationError):
        load_seed_file(_write(tmp_path, data))


def test_a_country_starts_on_wholesale_unless_it_says_otherwise(tmp_path: Path) -> None:
    seeds = {s.country.code: s for s in load_seed_files()}
    assert {cc: s.country.default_price_type for cc, s in seeds.items()} == {
        "IN": "wholesale",
        "TW": "wholesale",
        "MY": "retail",
    }
    data = _raw("MY")
    data["country"]["default_price_type"] = "farmgate"
    with pytest.raises(ValidationError):
        load_seed_file(_write(tmp_path, data))


def test_references_to_unknown_ids_are_rejected(tmp_path: Path) -> None:
    data = _raw("TW")
    data["source_maps"]["mock"]["markets"].append({"source_market": "X", "market": "nowhere"})
    with pytest.raises(ValidationError):
        load_seed_file(_write(tmp_path, data))
    data = _raw("TW")
    data["country"]["default_area"] = "atlantis"
    with pytest.raises(ValidationError):
        load_seed_file(_write(tmp_path, data))


async def _counts(session: AsyncSession) -> dict[str, int]:
    tables = [
        "countries",
        "areas",
        "markets",
        "crops",
        "source_crop_map",
        "source_market_map",
        "source_area_map",
    ]
    out = {}
    for t in tables:
        out[t] = (await session.execute(text(f"SELECT count(*) FROM {t}"))).scalar_one()
    return out


async def test_sync_is_repeatable(session: AsyncSession) -> None:
    await sync_seed(session)
    first = await _counts(session)
    await sync_seed(session)
    assert await _counts(session) == first
    assert first["countries"] == 3
    assert first["areas"] == 96
    assert first["crops"] == 63
    assert first["markets"] == 52


async def test_every_market_belongs_to_an_existing_area(session: AsyncSession) -> None:
    await sync_seed(session)
    orphans_sql = "SELECT count(*) FROM markets m LEFT JOIN areas a ON a.id = m.area_id"
    orphans = await session.execute(text(orphans_sql + " WHERE a.id IS NULL"))
    assert orphans.scalar_one() == 0


async def test_sync_stores_country_settings(session: AsyncSession) -> None:
    await sync_seed(session)
    row = (
        await session.execute(
            text(
                "SELECT currency, locale, utc_offset_min, closed_weekdays, default_area_id,"
                " units->'wholesale'->>'default', default_price_type FROM countries"
                " WHERE code = 'IN'"
            )
        )
    ).one()
    assert tuple(row) == ("INR", "en-IN", 330, [7], "nashik", "qtl", "wholesale")
    retail = await session.execute(
        text("SELECT default_price_type FROM countries WHERE code = 'MY'")
    )
    assert retail.scalar_one() == "retail"


async def test_sync_removes_entities_dropped_from_the_seed(
    session: AsyncSession, tmp_path: Path
) -> None:
    await sync_seed(session)
    data = _raw("TW")
    data["areas"][0]["markets"].pop()  # taipei loses tp2
    for maps in data["source_maps"].values():
        maps["markets"] = [m for m in maps["markets"] if m["market"] != "tp2"]
    _write(tmp_path, data)
    _write(tmp_path, _raw("IN"))
    await sync_seed(session, tmp_path)
    remaining = await session.execute(text("SELECT count(*) FROM markets WHERE id = 'tp2'"))
    assert remaining.scalar_one() == 0


def test_a_crop_range_and_arrivals_come_in_pairs(tmp_path: Path) -> None:
    data = _raw("TW")
    del data["crops"][0]["mock"]["hi"]
    with pytest.raises(ValidationError, match="lo and hi"):
        load_seed_file(_write(tmp_path, data))
    data = _raw("TW")
    del data["crops"][0]["mock"]["arrR"]
    with pytest.raises(ValidationError, match="arr and arrR"):
        load_seed_file(_write(tmp_path, data))


def _lookup(name: str) -> dict[str, dict[str, str]]:
    path = Path(__file__).resolve().parents[1] / "fixtures" / "my_pricecatcher" / name
    with path.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    key = "premise_code" if "premise_code" in rows[0] else "item_code"
    return {r[key]: {k: (v or "").strip() for k, v in r.items()} for r in rows}


def test_malaysia_maps_follow_the_pricecatcher_lookups() -> None:
    """Checked against the real lookups (tests/fixtures/my_pricecatcher: every wet market and
    wholesale market of lookup_premise.csv on 2026-09-20): wholesale markets are "Borong"
    premises; each area is one district of the lookup (a federal territory as a whole) with at
    least two wet markets; every item is sold per kg, so its price needs no conversion."""
    my = next(s for s in load_seed_files() if s.country.code == "MY")
    premises = _lookup("lookup_premise.csv")
    items = _lookup("lookup_item.csv")
    area_of_market = {m.id: a for a in my.areas for m in a.markets}
    areas = {a.id: a for a in my.areas}
    maps = my.source_maps["my_pricecatcher"]
    for m in maps.markets:
        premise = premises[m.source_market]
        assert premise["premise_type"] == "Borong", m
        assert premise["district"] == area_of_market[m.market].name["en"] or m.market == "klborong"
    wet: dict[str, int] = {}
    for p in premises.values():
        if p["premise_type"] == "Pasar Basah":
            for key in (f"{p['state']}/{p['district']}", p["state"]):
                wet[key] = wet.get(key, 0) + 1
    assert sorted(a.area for a in maps.areas) == sorted(areas)  # one district per area
    for a in maps.areas:
        assert wet.get(a.source_area, 0) >= 2, a
        state, _, district = a.source_area.partition("/")
        area = areas[a.area]
        assert area.region["zh-TW"] == state, a
        if district:
            assert area.name["en"] == district, a
        else:  # a whole federal territory
            assert state.startswith("W.P. "), a
            assert area.name["en"] == state.removeprefix("W.P. "), a
    for c in maps.crops:
        assert items[c.source_name]["unit"] == "1kg", c
    # The demo prints the same items, markets and districts.
    assert my.source_maps["mock"] == maps
