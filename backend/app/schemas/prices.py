"""Price responses. Prices are per kg in the country's currency; ratios are fractions."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import I18nText, StalenessOut

PriceType = Literal["wholesale", "retail"]
Reason = Literal["no_retail_area", "no_retail_crop", "no_data"]


class ChangeOut(BaseModel):
    """Latest vs the previous trading day with data; |pct| < 0.05% is flat."""

    pct: float
    diff_per_kg: float
    direction: Literal["up", "down", "flat"]
    prev_trade_date: date | None


class SourceOut(BaseModel):
    id: str
    name: I18nText


class PriceItemOut(BaseModel):
    crop_id: str
    price_per_kg: float | None
    reason: Reason | None = Field(description="Why there is no price (null when there is one).")
    trade_date: date | None
    staleness: StalenessOut
    change: ChangeOut | None
    spark: list[float | None] = Field(description="Last 7 calendar days; null = no data.")


class PricesOut(BaseModel):
    country: str
    area_id: str
    type: PriceType
    currency: str
    today: date
    fetched_at: datetime | None
    items: list[PriceItemOut]


class MarketsSummaryOut(BaseModel):
    count: int = Field(description="Markets with a price on the latest trade date.")
    total: int = Field(description="All markets of the area.")
    min_per_kg: float | None
    max_per_kg: float | None


class StatsOut(BaseModel):
    vs_avg7_pct: float | None
    pos30: float | None = Field(description="0 = 30-day low, 1 = 30-day high.")
    volatility: Literal["low", "mid", "high"] | None
    volatility_pct: float | None
    arrivals: Literal["low", "normal", "high"] | None
    arrivals_ratio: float | None
    high7_per_kg: float | None
    low7_per_kg: float | None
    high30_per_kg: float | None
    low30_per_kg: float | None
    change7_pct: float | None
    change30_pct: float | None


class SeriesPointOut(BaseModel):
    date: date
    price_per_kg: float | None


class QuoteOut(BaseModel):
    crop_id: str
    area_id: str
    type: PriceType
    currency: str
    today: date
    trade_date: date | None
    staleness: StalenessOut
    fetched_at: datetime | None
    price_per_kg: float | None
    reason: Reason | None
    markets: MarketsSummaryOut | None = Field(description="Wholesale only.")
    change: ChangeOut | None
    stats: StatsOut
    series: list[SeriesPointOut]
    source: SourceOut | None


class RankOut(BaseModel):
    position: int | None
    total: int


class CompareRowOut(BaseModel):
    area_id: str
    price_per_kg: float | None
    n_markets: int
    distance_km: int = Field(description="Straight line between area centres (not road).")
    diff_per_kg: float | None = Field(description="This area minus the area being viewed.")
    trade_date: date | None
    staleness: StalenessOut
    rank: int | None = Field(description="By price, highest first; equal prices share a rank.")
    is_base: bool


class CompareOut(BaseModel):
    crop_id: str
    area_id: str
    type: PriceType
    currency: str
    today: date
    rank: RankOut
    rows: list[CompareRowOut]


class MarketRowOut(BaseModel):
    market_id: str
    name: I18nText
    km_from_center: int | None
    price_per_kg: float | None
    trade_date: date | None
    staleness: StalenessOut
    diff_per_kg: float | None = Field(description="Market price minus the area median.")


class MarketsOut(BaseModel):
    crop_id: str
    area_id: str
    currency: str
    today: date
    median_per_kg: float | None
    trade_date: date | None
    staleness: StalenessOut
    rows: list[MarketRowOut]


class MarketOut(BaseModel):
    crop_id: str
    market_id: str
    area_id: str
    name: I18nText
    km_from_center: int | None
    currency: str
    today: date
    trade_date: date | None
    staleness: StalenessOut
    fetched_at: datetime | None
    price_per_kg: float | None
    reason: Literal["no_data"] | None
    low_per_kg: float | None
    high_per_kg: float | None
    change: ChangeOut | None
    source: SourceOut | None
