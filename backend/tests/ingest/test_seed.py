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
    assert set(seeds) == {"IN", "TW"}
    assert len(seeds["IN"].areas) == 11
    assert len(seeds["TW"].areas) == 10
    assert len(seeds["IN"].crops) == 21
    assert len(seeds["TW"].crops) == 21
    nashik = next(a for a in seeds["IN"].areas if a.id == "nashik")
    assert len(nashik.markets) == 10


def test_every_crop_category_is_allowed() -> None:
    for seed in load_seed_files():
        assert {c.category for c in seed.crops} <= CATEGORIES


def test_every_category_has_at_least_two_crops_in_each_country() -> None:
    # The home grid shows all seven categories, so none of them may open an empty list.
    for seed in load_seed_files():
        counts = {cat: sum(c.category == cat for c in seed.crops) for cat in CATEGORIES}
        assert min(counts.values()) >= 2, (seed.country.code, counts)


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
    assert first["countries"] == 2
    assert first["areas"] == 21
    assert first["crops"] == 42
    assert first["markets"] == 45


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
                " units->'wholesale'->>'default' FROM countries WHERE code = 'IN'"
            )
        )
    ).one()
    assert tuple(row) == ("INR", "en-IN", 330, [7], "nashik", "qtl")


async def test_sync_removes_entities_dropped_from_the_seed(
    session: AsyncSession, tmp_path: Path
) -> None:
    await sync_seed(session)
    data = _raw("TW")
    data["areas"][0]["markets"].pop()  # taipei loses tp2
    data["source_maps"]["mock"]["markets"] = [
        m for m in data["source_maps"]["mock"]["markets"] if m["market"] != "tp2"
    ]
    _write(tmp_path, data)
    _write(tmp_path, _raw("IN"))
    await sync_seed(session, tmp_path)
    remaining = await session.execute(text("SELECT count(*) FROM markets WHERE id = 'tp2'"))
    assert remaining.scalar_one() == 0
