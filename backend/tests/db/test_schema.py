from datetime import date
from decimal import Decimal

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DATA_TABLES, Base, Quote
from tests.conftest import _connect, alembic_config
from tests.factories import add_minimal_catalog


def _tables(url: str) -> set[str]:
    with _connect(url) as conn:
        rows = conn.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        ).fetchall()
    return {r[0] for r in rows}


def test_migrations_downgrade_to_base_and_upgrade_to_head(database_url: str) -> None:
    cfg = alembic_config(database_url)
    command.downgrade(cfg, "base")
    assert not set(DATA_TABLES) & _tables(database_url)
    command.upgrade(cfg, "head")
    assert set(DATA_TABLES) <= _tables(database_url)


def test_migrations_match_the_models(database_url: str) -> None:
    engine = create_engine(database_url)
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    engine.dispose()
    assert diff == []


def _quote(**overrides: object) -> Quote:
    fields: dict[str, object] = {
        "source": "mock",
        "country": "IN",
        "price_type": "wholesale",
        "market_id": "m1",
        "area_id": "a1",
        "crop_id": "onion",
        "variety": "Red",
        "trade_date": date(2026, 9, 19),
        "rep_price": Decimal("23.5"),
    }
    fields.update(overrides)
    return Quote(**fields)


async def test_quotes_unique_key_rejects_a_duplicate_wholesale_row(session: AsyncSession) -> None:
    await add_minimal_catalog(session)
    session.add(_quote())
    await session.commit()
    session.add(_quote(rep_price=Decimal("24")))
    with pytest.raises(IntegrityError):
        await session.commit()


async def test_quotes_unique_key_covers_retail_rows_without_a_market(
    session: AsyncSession,
) -> None:
    await add_minimal_catalog(session)
    session.add(_quote(price_type="retail", market_id=None, variety=""))
    await session.commit()
    session.add(_quote(price_type="retail", market_id=None, variety=""))
    with pytest.raises(IntegrityError):
        await session.commit()


async def test_quotes_with_another_variety_or_day_are_allowed(session: AsyncSession) -> None:
    await add_minimal_catalog(session)
    session.add_all([_quote(), _quote(variety="White"), _quote(trade_date=date(2026, 9, 18))])
    await session.commit()


async def test_quotes_reject_non_positive_prices(session: AsyncSession) -> None:
    await add_minimal_catalog(session)
    session.add(_quote(rep_price=Decimal("0")))
    with pytest.raises(IntegrityError):
        await session.commit()
