"""Taiwan MOA FarmTransData provider (docs/06 §1, bonus B2): real wholesale prices."""

from collections.abc import Callable, Sequence
from datetime import date

from app.ingest import normalize as fmt
from app.ingest.providers.base import NormalizedQuote, RawRow, SourceMaps
from app.seed.schema import SeedFile

SOURCE = "tw_moa"


def products_from_seeds(seeds: Sequence[SeedFile]) -> list[str]:
    """The product names to ask for ("甘藍-初秋", "香蕉"), from `source_maps.tw_moa`."""
    products: list[str] = []
    for seed in seeds:
        maps = seed.source_maps.get(SOURCE)
        for m in maps.crops if maps else []:
            name = f"{m.source_name}-{m.source_variety}" if m.source_variety else m.source_name
            if name not in products:
                products.append(name)
    return products


class TwMoaProvider:
    source = SOURCE
    countries: tuple[str, ...] = ("TW",)

    def __init__(self, products: Sequence[str], today_of: Callable[[str], date]) -> None:
        self.products = list(products)
        self._today_of = today_of

    async def fetch(self, day: date) -> list[RawRow]:
        raise NotImplementedError

    def normalize(self, raw: RawRow, maps: SourceMaps) -> NormalizedQuote | None:
        return fmt.moa_farmtrans(raw, maps, SOURCE, exact=True)
