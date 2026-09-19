"""Shared fixtures. Database tests use a separate `*_test` database on the compose `db`."""

import os
from collections.abc import AsyncIterator
from datetime import UTC, date, datetime
from pathlib import Path

import httpx
import psycopg
import pytest
from alembic import command
from alembic.config import Config
from psycopg import sql
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db.models import DATA_TABLES
from app.db.session import create_engine, create_sessionmaker
from app.ingest.pipeline import run_provider
from app.ingest.providers.mock import MockProvider
from app.ingest.seed import sync_seed
from app.main import create_app

BACKEND_DIR = Path(__file__).resolve().parents[1]

# API tests run against mock data generated for this moment:
# India 11:40 (UTC+5:30), Taiwan 14:10 (UTC+8), both on Saturday 2026-09-19.
NOW = datetime(2026, 9, 19, 6, 10, tzinfo=UTC)
TODAY = date(2026, 9, 19)


def _default_test_url() -> str:
    user = os.environ.get("POSTGRES_USER", "agri")
    password = os.environ.get("POSTGRES_PASSWORD", "agri-local-only")
    port = os.environ.get("DB_PORT", "5432")
    return f"postgresql+psycopg://{user}:{password}@127.0.0.1:{port}/agri_test"


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or _default_test_url()


def _ensure_database(url: str) -> None:
    parsed = make_url(url)
    name = parsed.database or "agri_test"
    try:
        conn = psycopg.connect(
            host=parsed.host,
            port=parsed.port,
            user=parsed.username,
            password=parsed.password,
            dbname="postgres",
            autocommit=True,
            connect_timeout=5,
        )
    except psycopg.OperationalError as exc:  # pragma: no cover - environment problem
        pytest.exit(f"Test database is not reachable ({exc}). Run `make test` to start it.")
    with conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (name,)).fetchone()
        if not exists:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))


def _connect(url: str) -> psycopg.Connection:
    parsed = make_url(url)
    return psycopg.connect(
        host=parsed.host,
        port=parsed.port,
        user=parsed.username,
        password=parsed.password,
        dbname=parsed.database,
        autocommit=True,
    )


def alembic_config(url: str) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    cfg.attributes["configure_logger"] = False
    return cfg


def truncate_all(url: str) -> None:
    with _connect(url) as conn:
        conn.execute(f"TRUNCATE {', '.join(DATA_TABLES)} RESTART IDENTITY CASCADE")


@pytest.fixture(scope="session")
def database_url() -> str:
    _ensure_database(TEST_DATABASE_URL)
    command.upgrade(alembic_config(TEST_DATABASE_URL), "head")
    return TEST_DATABASE_URL


@pytest.fixture
def clean_db(database_url: str) -> str:
    """Empties every data table before the test (not after, so failures stay inspectable)."""
    truncate_all(database_url)
    return database_url


@pytest.fixture
def settings(database_url: str) -> Settings:
    return Settings(database_url=database_url, db_null_pool=True, demo_mode=False)


@pytest.fixture
async def session(settings: Settings, clean_db: str) -> AsyncIterator[AsyncSession]:
    engine = create_engine(settings)
    async with create_sessionmaker(engine)() as s:
        yield s
    await engine.dispose()


@pytest.fixture
async def client(settings: Settings) -> AsyncIterator[httpx.AsyncClient]:
    app = create_app(settings)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await app.state.engine.dispose()


async def _ensure_mock_data(settings: Settings) -> None:
    """Loads the mock data for TODAY once; later tests reuse it until someone truncates."""
    engine = create_engine(settings)
    try:
        async with create_sessionmaker(engine)() as s:
            ready = await s.execute(
                text(
                    "SELECT count(*) FROM area_daily a JOIN ingest_runs r ON r.source = 'mock'"
                    " WHERE a.trade_date = :d AND r.status = 'ok' AND r.started_at = :now"
                ),
                {"d": TODAY, "now": NOW},
            )
            if ready.scalar_one() > 0:
                return
        truncate_all(settings.database_url)
        async with create_sessionmaker(engine)() as s:
            seeds = await sync_seed(s)
            provider = MockProvider(seeds, today_of=lambda _country: TODAY)
            await run_provider(s, provider, {"IN": TODAY, "TW": TODAY}, now=NOW)
    finally:
        await engine.dispose()


@pytest.fixture
async def api(settings: Settings, database_url: str) -> AsyncIterator[httpx.AsyncClient]:
    """Client over the mock data with the app clock fixed at NOW."""
    await _ensure_mock_data(settings)
    app = create_app(settings, clock=lambda: NOW)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await app.state.engine.dispose()
