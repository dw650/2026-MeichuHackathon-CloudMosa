"""Loads and validates the seed YAML files."""

from pathlib import Path

import yaml

from app.seed.schema import DeriveSeedFile, IntlSeedFile, SeedFile

SEED_DIR = Path(__file__).resolve().parent


def load_seed_file(path: Path) -> SeedFile:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return SeedFile.model_validate(data)


def load_seed_files(seed_dir: Path = SEED_DIR) -> list[SeedFile]:
    """Every country file (`TW.yaml`, named after the country code), by the country's sort
    key. Other `*.yaml` files next to them (`derive.yaml`) have their own loader."""
    country_files = [p for p in sorted(seed_dir.glob("*.yaml")) if len(p.stem) == 2]
    seeds = [load_seed_file(p) for p in country_files]
    return sorted(seeds, key=lambda s: s.country.sort)


DERIVE_FILE = SEED_DIR / "derive.yaml"


def load_derive_seed(path: Path = DERIVE_FILE) -> DeriveSeedFile:
    """The ratios estimating each country's missing price type (docs/06 §4)."""
    return DeriveSeedFile.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))


INTL_SERIES_FILE = SEED_DIR / "intl" / "series.yaml"


def load_intl_series(path: Path = INTL_SERIES_FILE) -> IntlSeedFile:
    """The series of the international reference prices page (bonus B5)."""
    return IntlSeedFile.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
