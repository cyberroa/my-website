"""Customer logo URL

Revision ID: 20260907_0014
Revises: 20260907_0013
Create Date: 2026-09-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260907_0014"
down_revision = "20260907_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("logo_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("customers", "logo_url")
