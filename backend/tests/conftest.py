"""Shared fixtures. Database tests use a separate `*_test` database on the compose `db`."""

import os
from collections.abc import AsyncIterator

import httpx
import psycopg
import pytest
from psycopg import sql
from sqlalchemy.engine import make_url

from app.config import Settings
from app.main import create_app


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


@pytest.fixture(scope="session")
def database_url() -> str:
    _ensure_database(TEST_DATABASE_URL)
    return TEST_DATABASE_URL


@pytest.fixture
def settings(database_url: str) -> Settings:
    return Settings(database_url=database_url, db_null_pool=True, demo_mode=False)


@pytest.fixture
async def client(settings: Settings) -> AsyncIterator[httpx.AsyncClient]:
    app = create_app(settings)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await app.state.engine.dispose()
