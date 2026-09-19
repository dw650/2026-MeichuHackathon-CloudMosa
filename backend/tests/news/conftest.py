"""Fixtures of the news tests."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingest.seed import sync_seed


@pytest.fixture
async def seeded(session: AsyncSession) -> AsyncSession:
    """An empty database with the seed's countries, areas and crops."""
    await sync_seed(session)
    return session
