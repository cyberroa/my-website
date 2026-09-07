"""Revert workbench_tier column name to staff_tier

Revision ID: 20260823_0010
Revises: 20260823_0009
Create Date: 2026-08-23
"""

from __future__ import annotations

from alembic import op

revision = "20260823_0010"
down_revision = "20260823_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("workbench_staff", "workbench_tier", new_column_name="staff_tier")


def downgrade() -> None:
    op.alter_column("workbench_staff", "staff_tier", new_column_name="workbench_tier")
