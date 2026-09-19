"""Catalog responses: countries, areas and crops."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import I18nText, StalenessOut
from app.schemas.prices import PriceType


class UnitOptionOut(BaseModel):
    id: str
    per_kg: float
    decimals: int
    label: I18nText


class UnitSetOut(BaseModel):
    default: str
    options: list[UnitOptionOut]


class UnitsOut(BaseModel):
    wholesale: UnitSetOut
    retail: UnitSetOut


class CategoryOut(BaseModel):
    """A tile of the home grid (docs/02 §5.2): crops carry its `id` as their `category`."""

    id: str
    name: I18nText
    icon: str  # a crop illustration id
    tone: Literal["green", "orange", "amber", "red", "olive", "yellow", "slate", "blue", "purple"]


class CountryOut(BaseModel):
    code: str
    name: I18nText
    coverage: I18nText
    currency: str
    locale: str
    utc_offset_min: int
    today: date
    up_is_pos: bool
    closed_weekdays: list[int]
    default_area_id: str
    default_recent_area_ids: list[str]
    default_watch: list[str]
    area_suffix: I18nText
    rep_price_label: I18nText
    source_label: I18nText
    estimated_price_types: list[str] = Field(
        description="Price types no source of this country reports, estimated from the other"
        " one (docs/06 §3.6). Every screen showing such a price must say it is an estimate."
    )
    units: UnitsOut
    # The price type a new user of this country starts on (docs/02 §4).
    default_price_type: PriceType
    categories: list[CategoryOut]


class FxRateOut(BaseModel):
    """Units of the currency for one US dollar, on the provider's day (bonus B5)."""

    currency: str
    per_usd: float
    rate_date: date


class CountriesOut(BaseModel):
    countries: list[CountryOut]
    #: Rates for the display currencies (F19); a currency without one keeps its local prices.
    fx: list[FxRateOut]


class AreaOut(BaseModel):
    id: str
    name: I18nText
    region: I18nText
    lat: float
    lon: float
    has_retail: bool
    latest_trade_date: date | None
    staleness: StalenessOut


class AreasOut(BaseModel):
    country: str
    today: date
    areas: list[AreaOut]


class CropOut(BaseModel):
    id: str
    name: I18nText
    category: str
    variety: I18nText
    has_retail: bool
    default_watch: bool
    estimate_ratio: float | None = Field(
        description="What the estimated price type of this country is multiplied by for this"
        " crop (null when nothing is estimated), so a screen can name the ratio it shows."
    )


class CropsOut(BaseModel):
    country: str
    crops: list[CropOut]
