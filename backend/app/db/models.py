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
    # Per price type: {"default": "qtl", "options": [{"id", "per_kg", "decimals", "label"}]}.
    units: Mapped[dict[str, Any]]


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


DATA_TABLES = (
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
