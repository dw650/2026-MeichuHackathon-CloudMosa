"""International reference price responses (bonus B5). Local prices are per kg in the
country's currency, converted with the latest daily rate; `usd` is the price as published."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import I18nText

IntlReason = Literal["no_data", "no_fx"]


class FxOut(BaseModel):
    currency: str
    per_usd: float = Field(description="Units of the currency for one US dollar.")
    rate_date: date = Field(description="The rate's day as published by the provider (UTC).")


class IntlChangeOut(BaseModel):
    """The latest month against the month before; |pct| < 0.05% is flat."""

    pct: float
    diff_per_kg: float | None = Field(description="In the country's currency; null without a rate.")
    direction: Literal["up", "down", "flat"]
    prev_month: date


class IntlItemOut(BaseModel):
    id: str
    name: I18nText
    spec: I18nText = Field(description="Grade or origin, e.g. Thai 5% broken.")
    source_name: str = Field(description="The series as the World Bank names it.")
    icon: str
    category: str
    month: date | None = Field(description="First day of the latest month with a price.")
    usd: float | None = Field(description="The published monthly average, US$ per `usd_unit`.")
    usd_unit: Literal["mt", "kg"]
    price_per_kg: float | None
    reason: IntlReason | None = Field(
        description="Why there is no local price: no_data (no month yet) or no_fx (no rate)."
    )
    change: IntlChangeOut | None


class IntlPricesOut(BaseModel):
    country: str
    currency: str
    today: date
    fx: FxOut | None = Field(description="The rate every month is converted with.")
    published: date | None = Field(description="Update date of the World Bank file.")
    items: list[IntlItemOut]


class IntlPointOut(BaseModel):
    month: date
    usd: float | None
    price_per_kg: float | None


class IntlStatsOut(BaseModel):
    """Over the months of `series` that have a price."""

    high_per_kg: float | None
    low_per_kg: float | None
    avg_per_kg: float | None
    vs_avg_pct: float | None = Field(description="Latest price against the average.")


class IntlSeriesOut(IntlItemOut):
    country: str
    currency: str
    today: date
    fx: FxOut | None
    published: date | None
    stats: IntlStatsOut
    series: list[IntlPointOut] = Field(
        description="The 12 months up to `month`, oldest first; null = no price that month."
    )
