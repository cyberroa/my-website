"""Phase 4B — engagement snapshots, AI segments, daily briefings, AI studio

Revision ID: 20260823_0002
Revises: 20260823_0001
Create Date: 2026-08-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260823_0002"
down_revision = "20260823_0001"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')
    op.execute(f'REVOKE ALL ON TABLE public."{table}" FROM anon, authenticated')


def upgrade() -> None:
    op.create_table(
        "customer_engagement_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("score", sa.Numeric(10, 1), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("customer_id", "snapshot_date", name="uq_engagement_snapshot_day"),
    )
    op.create_index("ix_engagement_snapshots_date", "customer_engagement_snapshots", ["snapshot_date"])
    _rls("customer_engagement_snapshots")

    op.add_column("segments", sa.Column("ai_managed", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("segments", sa.Column("ai_proposal_status", sa.String(length=24), nullable=True))
    op.add_column("segments", sa.Column("ai_rationale", sa.Text(), nullable=True))
    op.add_column("segments", sa.Column("ai_proposed_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "daily_briefings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("markdown_body", sa.Text(), nullable=False, server_default=""),
        sa.Column("html_body", sa.Text(), nullable=True),
        sa.Column("chart_payload", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("emailed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("slacked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("report_date", name="uq_daily_briefing_date"),
    )
    _rls("daily_briefings")

    op.create_table(
        "ai_prompt_presets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False, server_default="general"),
        sa.Column("system_prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column("user_prompt_template", sa.Text(), nullable=False, server_default=""),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_ai_prompt_preset_slug"),
    )
    _rls("ai_prompt_presets")

    op.create_table(
        "ai_studio_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("preset_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column("user_prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column("context_json", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.Column("output_text", sa.Text(), nullable=True),
        sa.Column("output_image_url", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(length=320), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["preset_id"], ["ai_prompt_presets.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_studio_runs_created", "ai_studio_runs", ["created_at"])
    _rls("ai_studio_runs")


def downgrade() -> None:
    op.drop_table("ai_studio_runs")
    op.drop_table("ai_prompt_presets")
    op.drop_table("daily_briefings")
    op.drop_column("segments", "ai_proposed_at")
    op.drop_column("segments", "ai_rationale")
    op.drop_column("segments", "ai_proposal_status")
    op.drop_column("segments", "ai_managed")
    op.drop_table("customer_engagement_snapshots")
