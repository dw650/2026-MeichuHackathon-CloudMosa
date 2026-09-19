"""add country estimated price types

Revision ID: 9dd43cd0ca14
Revises: 23655d2e487a
Create Date: 2026-09-20 06:16:39.093473
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '9dd43cd0ca14'
down_revision: str | Sequence[str] | None = '5c1e7a9d2b40'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Empty for every existing row; the worker fills it with the price types it estimates.
    op.add_column(
        'countries',
        sa.Column(
            'estimated_price_types',
            sa.ARRAY(sa.String(length=10)),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('countries', 'estimated_price_types')
