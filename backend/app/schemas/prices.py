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


class NearbyAreaOut(BaseModel):
    area_id: str
    price_per_kg: float
    diff_per_kg: float = Field(description="This area minus the area being viewed (0 for it).")
    distance_km: int = Field(description="Straight line from the viewed area (0 for it).")
    is_base: bool = Field(description="The viewed area itself: nothing nearby is higher (lower).")


class NearbyOut(BaseModel):
    """Highest and lowest price among the viewed area and the 3 nearest other areas within
    300 km that have a price on the same trade date; ties go to the viewed area."""

    highest: NearbyAreaOut
    lowest: NearbyAreaOut


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
    nearby: NearbyOut | None = Field(
        description="Null when the viewed area's price is missing or old, when no nearby area"
        " has a price on the same trade date, or when they all have the same price."
    )


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


class OtherCountryRowOut(BaseModel):
    country: str
    currency: str = Field(description="The other country's own currency.")
    type: PriceType | None = Field(
        description="What that country publishes for this crop (Malaysia retail, Taiwan and"
        " India wholesale); null when it has no price."
    )
    local_per_kg: float | None = Field(description="National price in `currency`, as stored.")
    price_per_kg: float | None = Field(
        description="The same price converted to the viewer's currency; null without a rate."
    )
    n_areas: int = Field(description="Areas behind the median (0 when there is no price).")
    trade_date: date | None
    reason: Literal["no_data", "no_fx"] | None


class WorldPriceOut(BaseModel):
    """The World Bank Pink Sheet's world price of the crop (bonus B5's series): a reference,
    not a country. Only crops with a published series have one."""

    series_id: str
    month: date | None
    usd: float | None = Field(description="The published price, US dollars per `usd_unit`.")
    usd_unit: Literal["mt", "kg"]
    price_per_kg: float | None = Field(description="Converted to the viewer's currency.")
    reason: Literal["no_data", "no_fx"] | None


class OtherCountriesOut(BaseModel):
    """各國參考價 (docs/02 §5.4): the same crop in the other countries that have it. A country's
    national price is the median of its area prices on its own latest trading day. Wholesale and
    retail are not comparable and the rate is a reference, so the client says so."""

    currency: str = Field(description="The viewer's currency, which `price_per_kg` is in.")
    fx_date: date | None = Field(
        description="Oldest rate date behind a converted row; null when nothing was converted."
    )
    rows: list[OtherCountryRowOut] = Field(
        description="Empty when no other country's catalog has this crop."
    )
    world: WorldPriceOut | None = Field(
        description="Null when the Pink Sheet publishes no series for this crop."
    )


class CompareOut(BaseModel):
    crop_id: str
    area_id: str
    type: PriceType
    currency: str
    today: date
    rank: RankOut
    rows: list[CompareRowOut]
    other_countries: OtherCountriesOut


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
