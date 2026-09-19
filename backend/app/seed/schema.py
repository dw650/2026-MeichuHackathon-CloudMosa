"""Seed file schema (app/seed/*.yaml). Validation fails fast on typos and dangling ids."""

from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

LANGS = ("zh-TW", "en")
Category = Literal["cereal", "veg", "fruit", "pulse", "spice", "oil", "other"]
# Kept here and not imported from app.ingest, which imports this module.
PriceTypeName = Literal["wholesale", "retail"]
I18n = dict[str, str]


def _check_i18n(value: I18n) -> I18n:
    missing = [lang for lang in LANGS if lang not in value]
    if missing:
        raise ValueError(f"missing translations: {missing}")
    return value


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class UnitOption(_Model):
    id: str
    per_kg: float = Field(gt=0)
    decimals: int = Field(ge=0, le=3)
    label: I18n

    _label = field_validator("label")(_check_i18n)


class UnitSet(_Model):
    default: str
    options: list[UnitOption]

    @model_validator(mode="after")
    def _default_exists(self) -> Self:
        if self.default not in {o.id for o in self.options}:
            raise ValueError(f"default unit {self.default!r} is not an option")
        return self


class Units(_Model):
    wholesale: UnitSet
    retail: UnitSet


class CountrySeed(_Model):
    code: str = Field(pattern=r"^[A-Z]{2}$")
    sort: int
    name: I18n
    coverage: I18n
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    locale: str
    utc_offset_min: int = Field(ge=-720, le=840)
    up_is_pos: bool
    closed_weekdays: list[int]
    default_area: str
    default_recent_areas: list[str]
    area_suffix: I18n
    rep_price_label: I18n
    source_label: I18n
    units: Units

    _i18n = field_validator("name", "coverage", "area_suffix", "rep_price_label", "source_label")(
        _check_i18n
    )

    @field_validator("closed_weekdays")
    @classmethod
    def _iso_weekdays(cls, value: list[int]) -> list[int]:
        if any(not 1 <= d <= 7 for d in value):
            raise ValueError("closed_weekdays use ISO weekdays 1..7")
        return value


class MockLevel(_Model):
    """Mock parameters of an area or a market."""

    k: float = Field(default=1.0, gt=0)
    lag: int | None = Field(default=0, ge=0)


class MockCrop(_Model):
    """Mock parameters of a crop. The day range (lo, hi) and the arrivals (arr, arrR) are only
    printed by the formats that have them; Malaysia's source has neither."""

    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    p: float = Field(gt=0)
    lo: float | None = Field(default=None, gt=0)
    hi: float | None = Field(default=None, gt=0)
    chg: float
    arr: float | None = Field(default=None, gt=0)
    arr_ratio: float | None = Field(default=None, alias="arrR", gt=0)
    rt: float | None = Field(default=None, gt=0)
    lag: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def _pairs(self) -> Self:
        if (self.lo is None) != (self.hi is None):
            raise ValueError("lo and hi go together")
        if (self.arr is None) != (self.arr_ratio is None):
            raise ValueError("arr and arrR go together")
        return self


class MarketSeed(_Model):
    id: str
    name: I18n
    km: int | None = None
    mock: MockLevel = MockLevel()

    _i18n = field_validator("name")(_check_i18n)


class AreaSeed(_Model):
    id: str
    name: I18n
    region: I18n
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    retail: bool
    mock: MockLevel = MockLevel()
    markets: list[MarketSeed]

    _i18n = field_validator("name", "region")(_check_i18n)


class CropSeed(_Model):
    id: str
    name: I18n
    category: Category
    variety: I18n
    watch: bool = False
    retail: bool
    mock: MockCrop

    _i18n = field_validator("name", "variety")(_check_i18n)

    @model_validator(mode="after")
    def _retail_matches_mock(self) -> Self:
        if self.retail != (self.mock.rt is not None):
            raise ValueError(f"crop {self.id}: `retail` must match whether mock.rt is set")
        return self


class CropMap(_Model):
    source_name: str
    source_variety: str = ""
    crop: str


class MarketMap(_Model):
    source_market: str
    market: str


class AreaMap(_Model):
    source_area: str
    area: str


class SourceMaps(_Model):
    crops: list[CropMap] = []
    markets: list[MarketMap] = []
    areas: list[AreaMap] = []


class SeedFile(_Model):
    country: CountrySeed
    areas: list[AreaSeed]
    crops: list[CropSeed]
    source_maps: dict[str, SourceMaps] = {}

    @model_validator(mode="after")
    def _references_exist(self) -> Self:
        area_ids = [a.id for a in self.areas]
        market_ids = [m.id for a in self.areas for m in a.markets]
        crop_ids = [c.id for c in self.crops]
        for kind, ids in (("area", area_ids), ("market", market_ids), ("crop", crop_ids)):
            if len(ids) != len(set(ids)):
                raise ValueError(f"duplicate {kind} ids")
        c = self.country
        for area in [c.default_area, *c.default_recent_areas]:
            if area not in area_ids:
                raise ValueError(f"unknown area {area!r} in country settings")
        for source, maps in self.source_maps.items():
            for crop_map in maps.crops:
                if crop_map.crop not in crop_ids:
                    raise ValueError(f"{source}: unknown crop {crop_map.crop!r}")
            for market_map in maps.markets:
                if market_map.market not in market_ids:
                    raise ValueError(f"{source}: unknown market {market_map.market!r}")
            for area_map in maps.areas:
                if area_map.area not in area_ids:
                    raise ValueError(f"{source}: unknown area {area_map.area!r}")
        return self


# ---------- estimated prices (app/seed/derive.yaml, docs/06 §3.6) ----------

MAX_RATIO = 5.0


class CountryDerive(_Model):
    """How one country's missing price type is estimated from the one its source reports:
    `to` = `from` × ratio when estimating retail, `from` ÷ ratio the other way round."""

    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    from_type: PriceTypeName = Field(alias="from")
    to_type: PriceTypeName = Field(alias="to")
    default: float = Field(gt=0, le=MAX_RATIO)
    categories: dict[Category, float] = {}
    crops: dict[str, float] = {}
    # Retail → wholesale only: how far a derived market price may sit from the area price.
    market_spread: float = Field(default=0.0, ge=0, lt=1)

    @model_validator(mode="after")
    def _sane(self) -> Self:
        if self.from_type == self.to_type:
            raise ValueError("`from` and `to` must be different price types")
        bad = [
            r for r in [*self.categories.values(), *self.crops.values()] if not 0 < r <= MAX_RATIO
        ]
        if bad:
            raise ValueError(f"ratios must be > 0 and <= {MAX_RATIO}: {bad}")
        return self


class DeriveSeedFile(_Model):
    countries: dict[str, CountryDerive] = {}

    @field_validator("countries")
    @classmethod
    def _country_codes(cls, value: dict[str, CountryDerive]) -> dict[str, CountryDerive]:
        bad = [code for code in value if len(code) != 2 or not code.isupper()]
        if bad:
            raise ValueError(f"not country codes: {bad}")
        return value


# ---------- international reference prices (bonus B5, app/seed/intl/series.yaml) ----------

IntlUnit = Literal["mt", "kg"]


class IntlSeriesSeed(_Model):
    """One World Bank Pink Sheet series: its column in the monthly sheet and how it is shown."""

    id: str = Field(pattern=r"^[a-z][a-z0-9_]*$", max_length=20)
    column: str = Field(min_length=1, max_length=80)
    unit: IntlUnit
    icon: str
    category: Category
    name: I18n
    spec: I18n

    _i18n = field_validator("name", "spec")(_check_i18n)


class IntlSeedFile(_Model):
    series: list[IntlSeriesSeed] = Field(min_length=1, max_length=9)

    @model_validator(mode="after")
    def _unique(self) -> Self:
        for kind, values in (
            ("series id", [s.id for s in self.series]),
            ("column", [s.column for s in self.series]),
        ):
            if len(values) != len(set(values)):
                raise ValueError(f"duplicate {kind}")
        return self
