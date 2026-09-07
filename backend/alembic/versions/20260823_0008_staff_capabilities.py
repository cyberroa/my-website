"""Staff tiers + capabilities (RBAC for Titan Workbench)

Revision ID: 20260823_0008
Revises: 20260823_0007
Create Date: 2026-08-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260823_0008"
down_revision = "20260823_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "admin_staff",
        sa.Column("staff_tier", sa.String(length=24), nullable=False, server_default="staff"),
    )
    op.add_column(
        "admin_staff",
        sa.Column(
            "capabilities",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )

    # Backfill from legacy role column
    op.execute(
        """
        UPDATE admin_staff
        SET staff_tier = 'owner',
            capabilities = '["marketing","sales","support","accounting","technician"]'::jsonb
        WHERE lower(role) = 'owner'
        """
    )
    op.execute(
        """
        UPDATE admin_staff
        SET staff_tier = 'admin',
            capabilities = '[]'::jsonb
        WHERE lower(role) = 'admin'
        """
    )
    op.execute(
        """
        UPDATE admin_staff
        SET staff_tier = 'staff',
            capabilities = '[]'::jsonb
        WHERE lower(role) NOT IN ('owner', 'admin')
        """
    )


def downgrade() -> None:
    op.drop_column("admin_staff", "capabilities")
    op.drop_column("admin_staff", "staff_tier")
