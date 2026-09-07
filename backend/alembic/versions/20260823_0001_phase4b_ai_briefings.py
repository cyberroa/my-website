"""Phase 4B Sprint 2 — AI briefings + submission sentiment

Revision ID: 20260823_0001
Revises: 20260822_0001
Create Date: 2026-08-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260823_0001"
down_revision = "20260822_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customer_briefings",
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("model", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("timeline_hash", sa.String(length=64), nullable=False, server_default=""),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("customer_id"),
    )
    op.execute('ALTER TABLE public."customer_briefings" ENABLE ROW LEVEL SECURITY')
    op.execute('REVOKE ALL ON TABLE public."customer_briefings" FROM anon, authenticated')

    for table in ("contact_submissions", "sell_submissions"):
        op.add_column(table, sa.Column("ai_sentiment", sa.String(length=40), nullable=True))
        op.add_column(table, sa.Column("ai_intent", sa.String(length=40), nullable=True))
        op.add_column(table, sa.Column("ai_urgency", sa.String(length=20), nullable=True))
        op.add_column(table, sa.Column("ai_summary", sa.String(length=280), nullable=True))
        op.add_column(table, sa.Column("ai_model", sa.String(length=120), nullable=True))
        op.add_column(table, sa.Column("ai_analyzed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    for table in ("contact_submissions", "sell_submissions"):
        op.drop_column(table, "ai_analyzed_at")
        op.drop_column(table, "ai_model")
        op.drop_column(table, "ai_summary")
        op.drop_column(table, "ai_urgency")
        op.drop_column(table, "ai_intent")
        op.drop_column(table, "ai_sentiment")

    op.execute('GRANT ALL ON TABLE public."customer_briefings" TO anon, authenticated')
    op.drop_table("customer_briefings")
