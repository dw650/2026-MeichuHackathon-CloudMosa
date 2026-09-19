import csv
import json
from pathlib import Path
from typing import Any

import pytest
import yaml
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingest.normalize import SOURCE_KEY_MAX
from app.ingest.seed import sync_seed
from app.seed.loader import SEED_DIR, load_seed_file, load_seed_files

DEFAULT_CATEGORIES = ["cereal", "veg", "fruit", "pulse", "spice", "oil", "other"]
TW_CATEGORIES = ["leafy", "root", "gourd", "fruitveg", "spice", "fruit"]


def test_seed_files_have_the_expected_areas_and_crops() -> None:
    seeds = {s.country.code: s for s in load_seed_files()}
    assert list(seeds) == ["IN", "TW", "MY"]
    assert len(seeds["IN"].areas) == 64
    assert len(seeds["TW"].areas) == 13
    assert len(seeds["MY"].areas) == 75
    assert len(seeds["IN"].crops) == 21
    assert len(seeds["TW"].crops) == 30
    assert len(seeds["MY"].crops) == 21
    nashik = next(a for a in seeds["IN"].areas if a.id == "nashik")
    assert len(nashik.markets) == 24
    assert sum(len(a.markets) for a in seeds["IN"].areas) == 429


def test_countries_without_their_own_categories_get_the_default_seven() -> None:
    seeds = {s.country.code: s for s in load_seed_files()}
    for code in ("IN", "MY"):
        assert [c.id for c in seeds[code].country.categories] == DEFAULT_CATEGORIES
    veg = seeds["IN"].country.categories[1]
    assert (veg.name, veg.icon, veg.tone) == ({"zh-TW": "蔬菜", "en": "Veg"}, "cabbage", "green")


def test_taiwan_has_categories_for_fruit_and_vegetable_markets() -> None:
    tw = next(s for s in load_seed_files() if s.country.code == "TW")
    assert [c.id for c in tw.country.categories] == TW_CATEGORIES
    assert tw.country.categories[0].name == {"zh-TW": "葉菜類", "en": "Leafy"}


def test_every_crop_category_is_one_of_its_countrys() -> None:
    for seed in load_seed_files():
        assert {c.category for c in seed.crops} <= {c.id for c in seed.country.categories}


# Malaysia's source reports no grain but wheat flour and nothing for "other" at the wet
# markets (docs/06 §1.5); those two categories are short on purpose.
SHORT_CATEGORIES = {"MY": {"cereal": 1, "other": 0}}
# Malaysia's 蔬菜 grew to ten with brinjal (the cross-country card): the tenth card has no
# digit key, like any long list (docs/02 §5.3).
LONG_CATEGORIES = {"MY": {"veg": 10}}


def test_every_category_has_two_to_nine_crops_in_each_country() -> None:
    # The home grid shows every category, so none of them should open an empty list; a list
    # gives its first nine crops the number keys 1–9.
    for seed in load_seed_files():
        short = SHORT_CATEGORIES.get(seed.country.code, {})
        most = LONG_CATEGORIES.get(seed.country.code, {})
        for cat in seed.country.categories:
            count = sum(c.category == cat.id for c in seed.crops)
            if cat.id in short:
                assert count == short[cat.id], (seed.country.code, cat.id, count)
            else:
                assert 2 <= count <= most.get(cat.id, 9), (seed.country.code, cat.id, count)


def test_default_watchlists_match_the_spec() -> None:
    seeds = {s.country.code: s for s in load_seed_files()}
    assert [c.id for c in seeds["IN"].crops if c.watch] == [
        "onion",
        "tomato",
        "potato",
        "chilli",
        "chickpea",
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


def test_a_crop_may_only_use_a_category_of_its_country(tmp_path: Path) -> None:
    data = _raw("TW")
    data["crops"][0]["category"] = "cereal"  # one of the default seven, but not Taiwan's
    with pytest.raises(ValidationError, match="category"):
        load_seed_file(_write(tmp_path, data))


def _category(cat_id: str) -> dict[str, Any]:
    return {"id": cat_id, "name": {"zh-TW": "類", "en": "Kind"}, "icon": "box", "tone": "slate"}


@pytest.mark.parametrize(
    ("categories", "message"),
    [
        ([_category("leafy"), _category("leafy")], "duplicate"),
        ([_category("recent")], "reserved"),
        ([_category("all")], "reserved"),
        ([_category("intl")], "reserved"),
        ([_category(f"c{i}") for i in range(8)], "at most 7"),
        ([{**_category("x"), "tone": "pink"}], "tone"),
        ([{**_category("x"), "name": {"en": "Kind"}}], "missing translations"),
    ],
)
def test_bad_category_lists_are_rejected(
    tmp_path: Path, categories: list[dict[str, Any]], message: str
) -> None:
    data = _raw("TW")
    data["country"]["categories"] = categories
    with pytest.raises(ValidationError, match=message):
        load_seed_file(_write(tmp_path, data))


def test_a_market_distance_comes_from_its_coordinates(tmp_path: Path) -> None:
    tw = next(s for s in load_seed_files() if s.country.code == "TW")
    taipei = next(a for a in tw.areas if a.id == "taipei")
    # Taipei 2 (民族東路 336) is about 4 km from the city's centre.
    assert [m.distance_km(taipei) for m in taipei.markets] == [7, 4]
    data = _raw("TW")
    market = data["areas"][0]["markets"][0]
    market["km"] = 3  # a distance and coordinates at the same time
    with pytest.raises(ValidationError, match="km or lat/lon"):
        load_seed_file(_write(tmp_path, data))
    data = _raw("TW")
    del data["areas"][0]["markets"][0]["lon"]
    with pytest.raises(ValidationError, match="lat and lon"):
        load_seed_file(_write(tmp_path, data))


def test_taiwan_lists_every_fruit_and_vegetable_market_of_farmtransdata() -> None:
    """The 19 markets of FarmTransData that trade fruit and vegetables (2026-07 to 09), each in
    its county; counties without a market are not areas (docs/06 §7.2)."""
    tw = next(s for s in load_seed_files() if s.country.code == "TW")
    maps = tw.source_maps["tw_moa"]
    area_of = {m.id: a.id for a in tw.areas for m in a.markets}
    assert {m.source_market: area_of[m.market] for m in maps.markets} == {
        "台北一": "taipei",
        "台北二": "taipei",
        "三重區": "newtaipei",
        "板橋區": "newtaipei",
        "桃農": "taoyuan",
        "台中市": "taichung",
        "豐原區": "taichung",
        "東勢鎮": "taichung",
        "溪湖鎮": "changhua",
        "永靖鄉": "changhua",
        "南投市": "nantou",
        "西螺鎮": "yunlin",
        "嘉義市": "chiayi",
        "高雄市": "kaohsiung",
        "鳳山區": "kaohsiung",
        "屏東市": "pingtung",
        "宜蘭市": "yilan",
        "花蓮市": "hualien",
        "台東市": "taitung",
    }
    assert all(a.markets for a in tw.areas)
    assert all(m.lat is not None and m.km is None for a in tw.areas for m in a.markets)
    # The demo prints the same market names, and every crop has a real product.
    assert tw.source_maps["mock"].markets == maps.markets
    assert {m.crop for m in maps.crops} == {c.id for c in tw.crops}


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
    assert first["areas"] == 152  # India 64, Taiwan 13, Malaysia 75
    assert first["crops"] == 72
    assert first["markets"] == 458


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


async def test_sync_stores_categories_and_market_distances(session: AsyncSession) -> None:
    await sync_seed(session)
    rows = await session.execute(text("SELECT code, categories FROM countries ORDER BY sort"))
    categories = {code: [c["id"] for c in cats] for code, cats in rows.tuples().all()}
    assert categories == {"IN": DEFAULT_CATEGORIES, "TW": TW_CATEGORIES, "MY": DEFAULT_CATEGORIES}
    km = await session.execute(
        text("SELECT id, km_from_center FROM markets WHERE id IN ('tp2', 'lasalgaon')")
    )
    assert dict(km.tuples().all()) == {"tp2": 4, "lasalgaon": 32}


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


# Display names that differ from Agmarknet's district names.
AGMARKNET_DISTRICT = {
    "amravati": "Amarawati",
    "ballari": "Bellary",
    "bengaluru": "Bengaluru",
    "sambhajinagar": "Chattrapati Sambhajinagar",
}


def test_india_maps_follow_the_agmarknet_filters() -> None:
    """Checked against the source's own lists (tests/fixtures/in_agmarknet/filters_excerpt.json):
    every market is "<state id>|<market name>" of a market in the area's district and state,
    every crop an Agmarknet commodity id, and the demo uses the same names."""
    path = (
        Path(__file__).resolve().parents[1] / "fixtures" / "in_agmarknet" / "filters_excerpt.json"
    )
    filters = json.loads(path.read_text(encoding="utf-8"))
    states = {s["state_id"]: s["state_name"] for s in filters["state_data"]}
    districts = {d["id"]: d["district_name"] for d in filters["district_data"]}
    markets = {
        f"{m['state_id']}|{' '.join(m['mkt_name'].split())}"[:SOURCE_KEY_MAX]: m
        for m in filters["market_data"]
    }
    commodities = {str(c["cmdt_id"]) for c in filters["cmdt_data"]}
    india = next(s for s in load_seed_files() if s.country.code == "IN")
    area_of_market = {m.id: a for a in india.areas for m in a.markets}
    maps = india.source_maps["in_agmarknet"]
    assert {m.market for m in maps.markets} == set(area_of_market)  # every market is mapped
    for m in maps.markets:
        source = markets[m.source_market]
        area = area_of_market[m.market]
        district = districts[source["district_id"]]
        assert district == AGMARKNET_DISTRICT.get(area.id, area.name["en"]), m
        state = states[source["state_id"]]
        assert state == area.region["en"] or (state, area.id) == ("NCT of Delhi", "delhi"), m
    assert {c.source_name for c in maps.crops} <= commodities
    assert len(maps.crops) == len(india.crops)
    mock = india.source_maps["mock"]
    assert mock.crops == maps.crops
    assert {(m.source_market, m.market) for m in mock.markets} <= {
        (m.source_market, m.market) for m in maps.markets
    }
    assert {area_of_market[m.market].id for m in mock.markets} == {a.id for a in india.areas}
