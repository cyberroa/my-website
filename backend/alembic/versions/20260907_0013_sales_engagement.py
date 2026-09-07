"""Sales engagement: lead_stage, engagements, mailbox connections

Revision ID: 20260907_0013
Revises: 20260907_0012
Create Date: 2026-09-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260907_0013"
down_revision = "20260907_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customers",
        sa.Column("lead_stage", sa.String(24), nullable=False, server_default="new"),
    )
    op.create_index("ix_customers_lead_stage", "customers", ["lead_stage"])

    op.create_table(
        "customer_engagements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "staff_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workbench_staff.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("channel", sa.String(32), nullable=False, server_default="note"),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column("raw_email", sa.Text(), nullable=True),
        sa.Column("outcome", sa.String(40), nullable=False, server_default="other"),
        sa.Column(
            "interest_tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column("offer_family", sa.String(40), nullable=True),
        sa.Column(
            "campaign_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("campaigns.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "campaign_recipient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("campaign_recipients.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("outreach_batch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("mailbox_thread_id", sa.String(255), nullable=True),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("ai_sentiment", sa.String(40), nullable=True),
        sa.Column("suggested_stage", sa.String(24), nullable=True),
        sa.Column("applied_stage", sa.String(24), nullable=True),
        sa.Column("sale_amount_hint_cents", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_customer_engagements_customer_id", "customer_engagements", ["customer_id"])
    op.create_index("ix_customer_engagements_staff_id", "customer_engagements", ["staff_id"])
    op.create_index("ix_customer_engagements_channel", "customer_engagements", ["channel"])
    op.create_index("ix_customer_engagements_occurred_at", "customer_engagements", ["occurred_at"])
    op.create_index("ix_customer_engagements_outcome", "customer_engagements", ["outcome"])
    op.create_index("ix_customer_engagements_offer_family", "customer_engagements", ["offer_family"])
    op.create_index("ix_customer_engagements_campaign_id", "customer_engagements", ["campaign_id"])
    op.create_index(
        "ix_customer_engagements_mailbox_thread_id", "customer_engagements", ["mailbox_thread_id"]
    )

    op.create_table(
        "mailbox_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("provider", sa.String(24), nullable=False),
        sa.Column("email_address", postgresql.CITEXT(), nullable=False, unique=True),
        sa.Column("access_token_enc", sa.Text(), nullable=True),
        sa.Column("refresh_token_enc", sa.Text(), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sync_cursor", sa.Text(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("created_by", sa.String(320), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("mailbox_connections")
    op.drop_index("ix_customer_engagements_mailbox_thread_id", table_name="customer_engagements")
    op.drop_index("ix_customer_engagements_campaign_id", table_name="customer_engagements")
    op.drop_index("ix_customer_engagements_offer_family", table_name="customer_engagements")
    op.drop_index("ix_customer_engagements_outcome", table_name="customer_engagements")
    op.drop_index("ix_customer_engagements_occurred_at", table_name="customer_engagements")
    op.drop_index("ix_customer_engagements_channel", table_name="customer_engagements")
    op.drop_index("ix_customer_engagements_staff_id", table_name="customer_engagements")
    op.drop_index("ix_customer_engagements_customer_id", table_name="customer_engagements")
    op.drop_table("customer_engagements")
    op.drop_index("ix_customers_lead_stage", table_name="customers")
    op.drop_column("customers", "lead_stage")
