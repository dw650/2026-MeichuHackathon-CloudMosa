"""Builds SourceMaps from parsed seed files (the pipeline loads the same maps from the DB)."""

from app.ingest.providers.base import SourceMaps
from app.seed.schema import SeedFile


def maps_from_seeds(seeds: list[SeedFile], source: str) -> SourceMaps:
    crops: dict[tuple[str, str, str], str] = {}
    markets: dict[tuple[str, str], str] = {}
    areas: dict[tuple[str, str], str] = {}
    market_area: dict[str, str] = {}
    for seed in seeds:
        cc = seed.country.code
        for area in seed.areas:
            for market in area.markets:
                market_area[market.id] = area.id
        maps = seed.source_maps.get(source)
        if maps is None:
            continue
        crops.update({(cc, m.source_name, m.source_variety): m.crop for m in maps.crops})
        markets.update({(cc, m.source_market): m.market for m in maps.markets})
        areas.update({(cc, m.source_area): m.area for m in maps.areas})
    return SourceMaps(crops=crops, markets=markets, areas=areas, market_area=market_area)
