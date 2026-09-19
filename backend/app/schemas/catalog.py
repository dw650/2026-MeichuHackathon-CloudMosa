"""Catalog responses: countries, areas and crops."""

from datetime import date

from pydantic import BaseModel

from app.schemas.common import I18nText, StalenessOut


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
    units: UnitsOut


class CountriesOut(BaseModel):
    countries: list[CountryOut]


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


class CropsOut(BaseModel):
    country: str
    crops: list[CropOut]
