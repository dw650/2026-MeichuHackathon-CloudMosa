"""add country default price type

Revision ID: 5c1e7a9d2b40
Revises: 23655d2e487a
Create Date: 2026-09-20 05:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '5c1e7a9d2b40'
down_revision: str | Sequence[str] | None = '23655d2e487a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing countries start on wholesale; the seed sync sets each country's own default.
    op.add_column(
        'countries',
        sa.Column(
            'default_price_type',
            sa.String(length=10),
            server_default='wholesale',
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column('countries', 'default_price_type')
