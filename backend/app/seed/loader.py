"""Loads and validates the seed YAML files."""

from pathlib import Path

import yaml

from app.seed.schema import SeedFile

SEED_DIR = Path(__file__).resolve().parent


def load_seed_file(path: Path) -> SeedFile:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return SeedFile.model_validate(data)


def load_seed_files(seed_dir: Path = SEED_DIR) -> list[SeedFile]:
    """All `*.yaml` files, ordered by the country's sort key."""
    seeds = [load_seed_file(p) for p in sorted(seed_dir.glob("*.yaml"))]
    return sorted(seeds, key=lambda s: s.country.sort)
