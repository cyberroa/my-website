"""Phase J — opportunity snapshots + marketing goals

Revision ID: 20260823_0004
Revises: 20260823_0003
Create Date: 2026-08-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260823_0004"
down_revision = "20260823_0003"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')
    op.execute(f'REVOKE ALL ON TABLE public."{table}" FROM anon, authenticated')


def upgrade() -> None:
    op.create_table(
        "opportunity_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("opportunity_type", sa.String(length=64), nullable=False),
        sa.Column("score", sa.Numeric(10, 1), nullable=False, server_default="0"),
        sa.Column("reasons", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("as_of_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "customer_id",
            "opportunity_type",
            "as_of_date",
            name="uq_opportunity_snapshot_day",
        ),
    )
    op.create_index(
        "ix_opportunity_snapshots_type_date",
        "opportunity_snapshots",
        ["opportunity_type", "as_of_date"],
    )
    op.create_index("ix_opportunity_snapshots_customer", "opportunity_snapshots", ["customer_id"])
    _rls("opportunity_snapshots")

    op.create_table(
        "marketing_goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "opportunity_types",
            postgresql.ARRAY(sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("channel", sa.String(length=40), nullable=False, server_default="email"),
        sa.Column("segment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("pending_segment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("auto_refresh", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("draft_on_threshold", sa.Integer(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "segment_link_status",
            sa.String(length=24),
            nullable=False,
            server_default="none",
        ),
        sa.Column("last_member_count", sa.Integer(), nullable=True),
        sa.Column("last_refreshed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_draft_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=320), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["segment_id"], ["segments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["pending_segment_id"], ["segments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    _rls("marketing_goals")


def downgrade() -> None:
    op.drop_table("marketing_goals")
    op.drop_table("opportunity_snapshots")
