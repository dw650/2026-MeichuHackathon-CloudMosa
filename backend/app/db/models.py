"""SQLAlchemy models (docs/04 §7). Prices are numeric(12,4) per kg in local currency."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, ClassVar

from sqlalchemy import (
    ARRAY,
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Multilingual text is stored as {"zh-TW": "...", "en": "..."}.
I18n = dict[str, str]
PRICE = Numeric(12, 4)
PRICE_TYPES = ("wholesale", "retail")
# News items older than this are deleted and never listed (docs/06 §1.6).
NEWS_KEEP_DAYS = 7
# How many items the news list shows, one per digit key; the job summarises exactly these.
NEWS_LIST_ITEMS = 9


class Base(DeclarativeBase):
    type_annotation_map: ClassVar[dict[Any, Any]] = {I18n: JSONB, dict[str, Any]: JSONB}


class Country(Base):
    __tablename__ = "countries"

    code: Mapped[str] = mapped_column(String(2), primary_key=True)
    sort: Mapped[int] = mapped_column(SmallInteger)
    name: Mapped[I18n]
    coverage: Mapped[I18n]
    currency: Mapped[str] = mapped_column(String(3))
    locale: Mapped[str] = mapped_column(String(16))
    utc_offset_min: Mapped[int] = mapped_column(SmallInteger)
    up_is_pos: Mapped[bool]
    # ISO weekdays (1 = Monday … 7 = Sunday) with no trading.
    closed_weekdays: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger))
    default_area_id: Mapped[str] = mapped_column(String(40))
    default_recent_area_ids: Mapped[list[str]] = mapped_column(ARRAY(String(40)))
    area_suffix: Mapped[I18n]
    rep_price_label: Mapped[I18n]
    # The real-world source named on the About page, e.g. "Agmarknet".
    source_label: Mapped[I18n]
    # Price types this country has no source for, estimated from the other one (docs/06 §3.6).
    # Written by the worker each run; every screen showing such a price says it is an estimate.
    estimated_price_types: Mapped[list[str]] = mapped_column(
        ARRAY(String(10)), server_default=text("'{}'")
    )
    # Per price type: {"default": "qtl", "options": [{"id", "per_kg", "decimals", "label"}]}.
    units: Mapped[dict[str, Any]]
    # The price type a new user of this country starts on: wholesale or retail.
    default_price_type: Mapped[str] = mapped_column(String(10), server_default="wholesale")
    # The home grid's categories in order: [{"id", "name", "icon", "tone"}] (docs/02 §5.2).
    categories: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)


class Area(Base):
    __tablename__ = "areas"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    country: Mapped[str] = mapped_column(ForeignKey("countries.code", ondelete="CASCADE"))
    name: Mapped[I18n]
    region: Mapped[I18n]
    lat: Mapped[float]
    lon: Mapped[float]
    has_retail: Mapped[bool]
    sort: Mapped[int] = mapped_column(SmallInteger)

    __table_args__ = (Index("ix_areas_country", "country"),)


class Market(Base):
    __tablename__ = "markets"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    area_id: Mapped[str] = mapped_column(ForeignKey("areas.id", ondelete="CASCADE"))
    name: Mapped[I18n]
    km_from_center: Mapped[int | None] = mapped_column(SmallInteger)
    sort: Mapped[int] = mapped_column(SmallInteger)

    __table_args__ = (Index("ix_markets_area", "area_id"),)


class Crop(Base):
    __tablename__ = "crops"

    country: Mapped[str] = mapped_column(
        ForeignKey("countries.code", ondelete="CASCADE"), primary_key=True
    )
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[I18n]
    category: Mapped[str] = mapped_column(String(16))
    variety: Mapped[I18n]
    sort: Mapped[int] = mapped_column(SmallInteger)
    default_watch: Mapped[bool]
    has_retail: Mapped[bool]


class SourceCropMap(Base):
    """Source crop name (+ variety, "" = any) → our crop id."""

    __tablename__ = "source_crop_map"

    source: Mapped[str] = mapped_column(String(20), primary_key=True)
    country: Mapped[str] = mapped_column(String(2), primary_key=True)
    source_name: Mapped[str] = mapped_column(String(80), primary_key=True)
    source_variety: Mapped[str] = mapped_column(String(80), primary_key=True, server_default="")
    crop_id: Mapped[str] = mapped_column(String(40))

    __table_args__ = (
        ForeignKeyConstraint(
            ["country", "crop_id"], ["crops.country", "crops.id"], ondelete="CASCADE"
        ),
    )


class SourceMarketMap(Base):
    """Source market name or code → our market id (wholesale rows)."""

    __tablename__ = "source_market_map"

    source: Mapped[str] = mapped_column(String(20), primary_key=True)
    country: Mapped[str] = mapped_column(String(2), primary_key=True)
    source_market: Mapped[str] = mapped_column(String(80), primary_key=True)
    market_id: Mapped[str] = mapped_column(ForeignKey("markets.id", ondelete="CASCADE"))


class SourceAreaMap(Base):
    """Source reporting centre or city → our area id (retail rows have no market)."""

    __tablename__ = "source_area_map"

    source: Mapped[str] = mapped_column(String(20), primary_key=True)
    country: Mapped[str] = mapped_column(String(2), primary_key=True)
    source_area: Mapped[str] = mapped_column(String(80), primary_key=True)
    area_id: Mapped[str] = mapped_column(ForeignKey("areas.id", ondelete="CASCADE"))


class IngestRun(Base):
    __tablename__ = "ingest_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(20))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10))  # running | ok | failed
    rows_in: Mapped[int] = mapped_column(Integer, server_default="0")
    rows_ok: Mapped[int] = mapped_column(Integer, server_default="0")
    rows_dropped: Mapped[int] = mapped_column(Integer, server_default="0")
    # Dropped rows per reason (unmapped, non_positive, …) for the health check and logs.
    drop_reasons: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    error: Mapped[str | None] = mapped_column(Text)
    # Network sources (docs/06 §8): HTTP requests sent, cache validators of the files
    # downloaded ({url: {etag, last_modified}}) and a fingerprint of the source's name maps,
    # so later runs can skip what they already have.
    requests: Mapped[int] = mapped_column(Integer, server_default="0")
    files: Mapped[dict[str, Any]] = mapped_column(server_default=text("'{}'::jsonb"))
    maps_hash: Mapped[str | None] = mapped_column(String(64))

    __table_args__ = (
        CheckConstraint("status IN ('running', 'ok', 'failed')", name="ck_ingest_runs_status"),
        Index("ix_ingest_runs_source_started", "source", "started_at"),
    )


class Quote(Base):
    """Normalized quote. Wholesale rows have a market; retail rows only an area."""

    __tablename__ = "quotes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(20))
    country: Mapped[str] = mapped_column(String(2))
    price_type: Mapped[str] = mapped_column(String(10))
    market_id: Mapped[str | None] = mapped_column(ForeignKey("markets.id", ondelete="CASCADE"))
    area_id: Mapped[str] = mapped_column(ForeignKey("areas.id", ondelete="CASCADE"))
    crop_id: Mapped[str] = mapped_column(String(40))
    variety: Mapped[str] = mapped_column(String(80), server_default="")
    trade_date: Mapped[date] = mapped_column(Date)
    rep_price: Mapped[Decimal] = mapped_column(PRICE)
    low_price: Mapped[Decimal | None] = mapped_column(PRICE)
    high_price: Mapped[Decimal | None] = mapped_column(PRICE)
    volume_kg: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    run_id: Mapped[int | None] = mapped_column(ForeignKey("ingest_runs.id", ondelete="SET NULL"))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # One row per (source, market or area, crop, variety, trade date); re-fetches overwrite.
        UniqueConstraint(
            "source",
            "price_type",
            "area_id",
            "market_id",
            "crop_id",
            "variety",
            "trade_date",
            name="uq_quotes_source_key",
            postgresql_nulls_not_distinct=True,
        ),
        ForeignKeyConstraint(
            ["country", "crop_id"], ["crops.country", "crops.id"], ondelete="CASCADE"
        ),
        CheckConstraint("price_type IN ('wholesale', 'retail')", name="ck_quotes_price_type"),
        CheckConstraint(
            "(price_type = 'wholesale') = (market_id IS NOT NULL)", name="ck_quotes_market_by_type"
        ),
        CheckConstraint("rep_price > 0", name="ck_quotes_rep_positive"),
        Index("ix_quotes_crop_date", "country", "crop_id", "trade_date"),
    )


class MarketDaily(Base):
    """Median of a market's quotes for one crop and day."""

    __tablename__ = "market_daily"

    market_id: Mapped[str] = mapped_column(
        ForeignKey("markets.id", ondelete="CASCADE"), primary_key=True
    )
    crop_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    trade_date: Mapped[date] = mapped_column(Date, primary_key=True)
    country: Mapped[str] = mapped_column(String(2))
    area_id: Mapped[str] = mapped_column(ForeignKey("areas.id", ondelete="CASCADE"))
    rep_price: Mapped[Decimal] = mapped_column(PRICE)
    low_price: Mapped[Decimal | None] = mapped_column(PRICE)
    high_price: Mapped[Decimal | None] = mapped_column(PRICE)
    volume_kg: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        ForeignKeyConstraint(
            ["country", "crop_id"], ["crops.country", "crops.id"], ondelete="CASCADE"
        ),
        Index("ix_market_daily_area_crop_date", "area_id", "crop_id", "trade_date"),
    )


class AreaDaily(Base):
    """Area price per day: wholesale = median of market prices; retail = the survey price."""

    __tablename__ = "area_daily"

    area_id: Mapped[str] = mapped_column(
        ForeignKey("areas.id", ondelete="CASCADE"), primary_key=True
    )
    crop_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    price_type: Mapped[str] = mapped_column(String(10), primary_key=True)
    trade_date: Mapped[date] = mapped_column(Date, primary_key=True)
    country: Mapped[str] = mapped_column(String(2))
    price: Mapped[Decimal] = mapped_column(PRICE)
    n_markets: Mapped[int] = mapped_column(SmallInteger)
    min_market: Mapped[Decimal | None] = mapped_column(PRICE)
    max_market: Mapped[Decimal | None] = mapped_column(PRICE)
    volume_kg: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        ForeignKeyConstraint(
            ["country", "crop_id"], ["crops.country", "crops.id"], ondelete="CASCADE"
        ),
        CheckConstraint("price_type IN ('wholesale', 'retail')", name="ck_area_daily_price_type"),
        Index(
            "ix_area_daily_lookup",
            "area_id",
            "crop_id",
            "price_type",
            text("trade_date DESC"),
        ),
        Index("ix_area_daily_compare", "country", "crop_id", "price_type", "trade_date"),
    )


# ---------- international reference prices (bonus B5, docs/06 §1.3) ----------


class IntlSeries(Base):
    """A World Bank Pink Sheet series of the international prices page, synced from
    app/seed/intl/series.yaml. `source_column` is its name in the monthly sheet, as published."""

    __tablename__ = "intl_series"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    sort: Mapped[int] = mapped_column(SmallInteger)
    source_column: Mapped[str] = mapped_column(String(80))
    unit: Mapped[str] = mapped_column(String(4))  # of the US dollar price: mt | kg
    icon: Mapped[str] = mapped_column(String(20))
    category: Mapped[str] = mapped_column(String(16))
    name: Mapped[I18n]
    spec: Mapped[I18n]

    __table_args__ = (CheckConstraint("unit IN ('mt', 'kg')", name="ck_intl_series_unit"),)


class IntlPrice(Base):
    """Monthly average of a series in US dollars per its unit, as published."""

    __tablename__ = "intl_prices"

    series_id: Mapped[str] = mapped_column(
        ForeignKey("intl_series.id", ondelete="CASCADE"), primary_key=True
    )
    month: Mapped[date] = mapped_column(Date, primary_key=True)  # first day of the month
    usd: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("usd > 0", name="ck_intl_prices_usd_positive"),
        CheckConstraint("EXTRACT(DAY FROM month) = 1", name="ck_intl_prices_first_day"),
    )


class FxRate(Base):
    """Latest daily rate of a currency: units for one US dollar, on the provider's day."""

    __tablename__ = "fx_rates"

    currency: Mapped[str] = mapped_column(String(3), primary_key=True)
    per_usd: Mapped[Decimal] = mapped_column(Numeric(18, 6))
    rate_date: Mapped[date] = mapped_column(Date)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (CheckConstraint("per_usd > 0", name="ck_fx_rates_positive"),)


class IntlSource(Base):
    """Download state of a B5 source (`wb_pink`, `er_api`): what we hold and when we last
    checked, so restarts never download again and the next check can be conditional."""

    __tablename__ = "intl_sources"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    url: Mapped[str] = mapped_column(Text)
    etag: Mapped[str | None] = mapped_column(Text)
    last_modified: Mapped[str | None] = mapped_column(Text)
    # wb_pink: "Updated on" date of the file; er_api: the rate date.
    data_date: Mapped[date | None] = mapped_column(Date)
    # er_api: when the provider publishes its next rates.
    next_update_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


INTL_TABLES = ("intl_prices", "intl_series", "fx_rates", "intl_sources")


class NewsItem(Base):
    """A news headline of a country for the 新聞 page. Only the headline, a short summary, the
    source, the link and the tags are stored, never the article text (docs/06 §1.6)."""

    __tablename__ = "news_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    country: Mapped[str] = mapped_column(ForeignKey("countries.code", ondelete="CASCADE"))
    source: Mapped[str] = mapped_column(String(20))  # google | demo
    guid: Mapped[str] = mapped_column(String(400))
    title: Mapped[str] = mapped_column(Text)
    # The title's letters and digits only, for duplicates (match.title_key).
    title_key: Mapped[str] = mapped_column(String(200))
    lang: Mapped[str] = mapped_column(String(10))
    source_name: Mapped[str] = mapped_column(String(120))
    source_domain: Mapped[str | None] = mapped_column(String(120))
    # The publisher's URL once resolved, else the Google News link. Never opened by the app.
    url: Mapped[str] = mapped_column(Text)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    summary: Mapped[str | None] = mapped_column(Text)
    summary_lang: Mapped[str | None] = mapped_column(String(10))
    summary_model: Mapped[str | None] = mapped_column(String(80))
    summary_tries: Mapped[int] = mapped_column(SmallInteger, server_default="0")
    crop_ids: Mapped[list[str]] = mapped_column(ARRAY(String(40)), server_default=text("'{}'"))
    # Areas the title or summary mention; the list puts the user's area first.
    area_ids: Mapped[list[str]] = mapped_column(ARRAY(String(40)), server_default=text("'{}'"))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("country", "guid", name="uq_news_items_guid"),
        UniqueConstraint("country", "title_key", name="uq_news_items_title"),
        Index("ix_news_items_country_published", "country", "published_at"),
    )


class NewsRun(Base):
    """One news run of a country: what it fetched and what it spent (the daily budgets)."""

    __tablename__ = "news_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    country: Mapped[str] = mapped_column(String(2))
    source: Mapped[str] = mapped_column(String(20))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10))  # running | ok | failed
    items_in: Mapped[int] = mapped_column(Integer, server_default="0")
    items_new: Mapped[int] = mapped_column(Integer, server_default="0")
    requests: Mapped[int] = mapped_column(Integer, server_default="0")
    articles: Mapped[int] = mapped_column(Integer, server_default="0")
    model_calls: Mapped[int] = mapped_column(Integer, server_default="0")
    summaries: Mapped[int] = mapped_column(Integer, server_default="0")
    error: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint("status IN ('running', 'ok', 'failed')", name="ck_news_runs_status"),
        Index("ix_news_runs_country_started", "country", "source", "started_at"),
    )


DATA_TABLES = (
    *INTL_TABLES,
    "news_items",
    "news_runs",
    "area_daily",
    "market_daily",
    "quotes",
    "ingest_runs",
    "source_area_map",
    "source_market_map",
    "source_crop_map",
    "crops",
    "markets",
    "areas",
    "countries",
)
