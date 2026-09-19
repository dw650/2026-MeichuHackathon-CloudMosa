"""Seed file schema (app/seed/*.yaml). Validation fails fast on typos and dangling ids."""

from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.geo import haversine_km

LANGS = ("zh-TW", "en")
# The default seven categories (docs/02 §5.2); the international reference series use them too.
Category = Literal["cereal", "veg", "fruit", "pulse", "spice", "oil", "other"]
PriceType = Literal["wholesale", "retail"]
# Colour families of the frontend (styles/tokens.css `data-tone`).
Tone = Literal["green", "orange", "amber", "red", "olive", "yellow", "slate", "blue", "purple"]
I18n = dict[str, str]
MAX_CATEGORIES = 8  # the home grid has nine keys and the last one is 「最近」
RESERVED_CATEGORY_IDS = {"all", "recent"}  # home grid paths /cat/all (gone) and /cat/recent


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


class CategorySeed(_Model):
    """One tile of the home grid: a crop category with its name, illustration and colour."""

    id: str = Field(pattern=r"^[a-z][a-z0-9]*$", max_length=16)
    name: I18n
    icon: str = Field(pattern=r"^[a-z][a-z0-9_]*$", max_length=40)  # a crop illustration id
    tone: Tone

    _i18n = field_validator("name")(_check_i18n)


def _default(cat_id: str, zh: str, en: str, icon: str, tone: str) -> CategorySeed:
    return CategorySeed.model_validate(
        {"id": cat_id, "name": {"zh-TW": zh, "en": en}, "icon": icon, "tone": tone}
    )


# A country without its own `categories` uses these (India and Malaysia).
DEFAULT_CATEGORIES: tuple[CategorySeed, ...] = (
    _default("cereal", "穀物", "Cereals", "wheat", "amber"),
    _default("veg", "蔬菜", "Veg", "cabbage", "green"),
    _default("fruit", "水果", "Fruit", "mango", "orange"),
    _default("pulse", "豆類", "Pulses", "soybean", "olive"),
    _default("spice", "香料", "Spices", "chilli", "red"),
    _default("oil", "油籽", "Oilseed", "oil", "yellow"),
    _default("other", "其他", "Other", "box", "slate"),
)


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
    # The price type a new user of this country starts on (`*` still toggles it); retail for a
    # country whose source has retail prices only.
    default_price_type: PriceType = "wholesale"
    # The home grid's categories in keypad order; crops use their ids.
    categories: list[CategorySeed] = Field(default_factory=lambda: list(DEFAULT_CATEGORIES))

    _i18n = field_validator("name", "coverage", "area_suffix", "rep_price_label", "source_label")(
        _check_i18n
    )

    @field_validator("categories")
    @classmethod
    def _category_list(cls, value: list[CategorySeed]) -> list[CategorySeed]:
        ids = [c.id for c in value]
        if not 1 <= len(ids) <= MAX_CATEGORIES:
            raise ValueError(f"a country has 1 to at most {MAX_CATEGORIES} categories")
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate category ids")
        if reserved := RESERVED_CATEGORY_IDS.intersection(ids):
            raise ValueError(f"reserved category ids: {sorted(reserved)}")
        return value

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
    """A market. Its distance from the area centre is either a fixed demo value (`km`) or
    computed from the market's approximate coordinates (`lat`, `lon`), never both."""

    id: str
    name: I18n
    km: int | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    mock: MockLevel = MockLevel()

    _i18n = field_validator("name")(_check_i18n)

    @model_validator(mode="after")
    def _one_distance(self) -> Self:
        if (self.lat is None) != (self.lon is None):
            raise ValueError(f"market {self.id}: lat and lon go together")
        if self.km is not None and self.lat is not None:
            raise ValueError(f"market {self.id}: give km or lat/lon, not both")
        return self

    def distance_km(self, area: "AreaSeed") -> int | None:
        """Kilometres from the area centre; `None` when neither is known."""
        if self.lat is not None and self.lon is not None:
            return haversine_km(area.lat, area.lon, self.lat, self.lon)
        return self.km


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
    category: str  # one of the country's categories (checked by SeedFile)
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
        category_ids = {cat.id for cat in c.categories}
        for crop in self.crops:
            if crop.category not in category_ids:
                raise ValueError(f"crop {crop.id}: unknown category {crop.category!r}")
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
