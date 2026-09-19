"""add country categories

Revision ID: 5c3e1f7a9b20
Revises: 74f6aadac0c6
Create Date: 2026-09-20 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '5c3e1f7a9b20'
down_revision: str | Sequence[str] | None = '74f6aadac0c6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing rows get an empty list; the seed sync fills each country's categories.
    op.add_column(
        'countries',
        sa.Column(
            'categories',
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.alter_column('countries', 'categories', server_default=None)


def downgrade() -> None:
    op.drop_column('countries', 'categories')
