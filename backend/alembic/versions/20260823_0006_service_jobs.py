"""Phase I extension — field service / repair jobs at customer sites

Revision ID: 20260823_0006
Revises: 20260823_0005
Create Date: 2026-08-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260823_0006"
down_revision = "20260823_0005"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')
    op.execute(f'REVOKE ALL ON TABLE public."{table}" FROM anon, authenticated')


def upgrade() -> None:
    op.create_table(
        "service_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_type", sa.String(length=40), nullable=False, server_default="repair"),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("hours", sa.Numeric(6, 2), nullable=True),
        sa.Column("amount_cents", sa.Integer(), nullable=True),
        sa.Column("part_number", sa.String(length=80), nullable=True),
        sa.Column("site_notes", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="completed"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["staff_id"], ["admin_staff.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_service_jobs_staff", "service_jobs", ["staff_id", "completed_at"])
    op.create_index("ix_service_jobs_customer", "service_jobs", ["customer_id", "completed_at"])
    _rls("service_jobs")


def downgrade() -> None:
    op.drop_table("service_jobs")
