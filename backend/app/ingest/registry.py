"""Every data source the worker can run, by `PROVIDERS` id (docs/06 §1.4).

Adding a source = writing its provider module with an `INFO` and listing it here."""

import logging
from collections.abc import Sequence

from app.ingest.providers import mock, tw_moa
from app.ingest.providers.base import SourceInfo
from app.seed.schema import SeedFile

logger = logging.getLogger("app.ingest.registry")

SOURCES: dict[str, SourceInfo] = {info.id: info for info in (mock.INFO, tw_moa.INFO)}


def enabled(ids: Sequence[str]) -> list[SourceInfo]:
    """The sources named in `PROVIDERS`, in that order; unknown names are logged and skipped."""
    infos: list[SourceInfo] = []
    for source_id in ids:
        info = SOURCES.get(source_id)
        if info is None:
            logger.warning("provider %r is not available yet; skipped", source_id)
        elif info not in infos:
            infos.append(info)
    return infos


def coverage(infos: Sequence[SourceInfo], seeds: Sequence[SeedFile]) -> dict[str, tuple[str, ...]]:
    """source → the seeded countries it covers in this run. A country has exactly one source:
    a real source takes its countries, and the fallback (the mock) covers the rest."""
    seeded = [s.country.code for s in seeds]
    taken = {cc for info in infos if not info.fallback for cc in info.countries}
    return {
        info.id: tuple(
            cc for cc in seeded if (cc not in taken if info.fallback else cc in info.countries)
        )
        for info in infos
    }


def owners(cover: dict[str, tuple[str, ...]], seeds: Sequence[SeedFile]) -> dict[str, set[str]]:
    """country → the sources allowed to hold its prices in this run."""
    return {
        seed.country.code: {
            src for src, countries in cover.items() if seed.country.code in countries
        }
        for seed in seeds
    }
