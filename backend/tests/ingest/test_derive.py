"""Estimated prices (docs/06 §4): the seed's ratios and which countries estimate what."""

import pytest

from app.ingest import derive, registry
from app.ingest.providers.base import SourceInfo
from app.seed.loader import load_derive_seed, load_seed_files
from app.seed.schema import CountryDerive, DeriveSeedFile

SEEDS = load_seed_files()
RULES = load_derive_seed()


def source(source_id: str, countries: tuple[str, ...], types: tuple[str, ...], **kw: object):
    return SourceInfo(
        id=source_id,
        countries=countries,
        price_types=types,  # type: ignore[arg-type]
        build=lambda ctx: None,  # type: ignore[arg-type,return-value]
        **kw,  # type: ignore[arg-type]
    )


MOCK = source("mock", (), ("wholesale", "retail"), fallback=True)
TW_REAL = source("tw_moa", ("TW",), ("wholesale",))
MY_REAL = source("my_pricecatcher", ("MY",), ("retail",))


def plan_for(*infos: SourceInfo) -> dict[str, derive.Derivation]:
    return derive.plan(RULES, infos, registry.coverage(infos, SEEDS))


# ---------- the seed file ----------


def test_the_seed_file_covers_every_seeded_country() -> None:
    assert {s.country.code for s in SEEDS} == set(RULES.countries)


def test_taiwan_and_india_estimate_retail_malaysia_estimates_wholesale() -> None:
    assert [(c, r.from_type, r.to_type) for c, r in sorted(RULES.countries.items())] == [
        ("IN", "wholesale", "retail"),
        ("MY", "retail", "wholesale"),
        ("TW", "wholesale", "retail"),
    ]


def test_every_ratio_names_a_crop_of_that_country() -> None:
    crops = {s.country.code: {c.id for c in s.crops} for s in SEEDS}
    unknown = {
        (code, crop)
        for code, rules in RULES.countries.items()
        for crop in rules.crops
        if crop not in crops[code]
    }
    assert unknown == set()


def test_a_ratio_of_zero_is_rejected() -> None:
    with pytest.raises(ValueError, match="ratios must be"):
        CountryDerive.model_validate(
            {"from": "wholesale", "to": "retail", "default": 1.6, "crops": {"onion": 0}}
        )


def test_estimating_a_price_type_from_itself_is_rejected() -> None:
    with pytest.raises(ValueError, match="different price types"):
        CountryDerive.model_validate({"from": "retail", "to": "retail", "default": 1.6})


def test_a_country_key_that_is_not_a_country_code_is_rejected() -> None:
    with pytest.raises(ValueError, match="not country codes"):
        DeriveSeedFile.model_validate(
            {"countries": {"Taiwan": {"from": "wholesale", "to": "retail", "default": 1.6}}}
        )


# ---------- ratios ----------


def test_a_crop_ratio_wins_over_its_category_and_the_default() -> None:
    rules = plan_for(MOCK, TW_REAL)["TW"]
    assert rules.ratio("bokchoy", "veg") == 1.8  # leafy, listed under crops
    assert rules.ratio("tomato", "veg") == 1.7  # its category
    assert rules.ratio("mushroom", "other") == 1.6  # the default


def test_storable_staples_get_the_smallest_markup() -> None:
    rules = plan_for(MOCK, TW_REAL)["TW"]
    assert rules.ratio("rice", "cereal") == 1.3
    assert rules.ratio("garlic", "spice") == 1.5


# ---------- the market spread ----------


def test_a_market_factor_stays_inside_the_spread_and_never_changes() -> None:
    rules = plan_for(MOCK, MY_REAL)["MY"]
    factors = [rules.market_factor(f"m{i}") for i in range(50)]
    assert all(0.96 <= f <= 1.04 for f in factors)
    assert rules.market_factor("m7") == factors[7]


def test_markets_of_one_area_do_not_all_get_the_same_factor() -> None:
    rules = plan_for(MOCK, MY_REAL)["MY"]
    assert len({rules.market_factor(f"m{i}") for i in range(20)}) > 1


def test_without_a_spread_every_market_keeps_the_area_price() -> None:
    rules = plan_for(MOCK, TW_REAL)["TW"]
    assert rules.market_factor("taipei1") == 1.0


# ---------- which countries estimate ----------


def test_a_country_on_mock_data_estimates_nothing() -> None:
    assert plan_for(MOCK) == {}


def test_only_the_country_of_the_real_source_estimates() -> None:
    assert sorted(plan_for(MOCK, TW_REAL)) == ["TW"]
    assert sorted(plan_for(MOCK, TW_REAL, MY_REAL)) == ["MY", "TW"]


def test_a_country_with_no_enabled_source_estimates_nothing() -> None:
    assert plan_for(TW_REAL) == {"TW": plan_for(TW_REAL)["TW"]}
    assert "IN" not in plan_for(TW_REAL)


def test_a_source_that_reports_both_types_is_left_alone() -> None:
    both = source("tw_both", ("TW",), ("wholesale", "retail"))
    assert plan_for(MOCK, both) == {}


def test_a_source_reporting_only_the_estimated_type_estimates_nothing() -> None:
    """Taiwan's seed estimates retail from wholesale; a retail-only Taiwan source has
    nothing to estimate it from, so it stays missing rather than being guessed."""
    retail_only = source("tw_retail", ("TW",), ("retail",))
    assert plan_for(MOCK, retail_only) == {}


def test_the_derivation_knows_its_country_and_direction() -> None:
    plan = plan_for(MOCK, MY_REAL)["MY"]
    assert (plan.country, plan.from_type, plan.to_type) == ("MY", "retail", "wholesale")


def test_estimated_price_types_lists_what_each_country_estimates() -> None:
    plan = plan_for(MOCK, TW_REAL, MY_REAL)
    assert derive.estimated_price_types(plan, SEEDS) == {
        "IN": [],
        "TW": ["retail"],
        "MY": ["wholesale"],
    }
