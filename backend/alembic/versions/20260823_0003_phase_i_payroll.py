"""Phase I — admin staff, pay policies, conversions, earnings

Revision ID: 20260823_0003
Revises: 20260823_0002
Create Date: 2026-08-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260823_0003"
down_revision = "20260823_0002"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')
    op.execute(f'REVOKE ALL ON TABLE public."{table}" FROM anon, authenticated')


def upgrade() -> None:
    op.create_table(
        "admin_staff",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=True),
        sa.Column("role", sa.String(length=24), nullable=False, server_default="admin"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("title", sa.String(length=120), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.UniqueConstraint("email", name="uq_admin_staff_email"),
    )
    _rls("admin_staff")

    op.create_table(
        "pay_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("commission_rate_bps", sa.Integer(), nullable=False, server_default="500"),
        sa.Column("commission_applies_to", sa.String(length=24), nullable=False, server_default="closer"),
        sa.Column("hourly_rate_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("terms_markdown", sa.Text(), nullable=False, server_default=""),
        sa.Column("effective_from", sa.Date(), nullable=True),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    _rls("pay_policies")

    op.create_table(
        "staff_pay_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("policy_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("policy_version", sa.Integer(), nullable=False),
        sa.Column("assigned_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="pending_acceptance"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["staff_id"], ["admin_staff.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["policy_id"], ["pay_policies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["assigned_by"], ["admin_staff.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_staff_pay_assignments_staff", "staff_pay_assignments", ["staff_id"])
    _rls("staff_pay_assignments")

    op.create_table(
        "sale_conversions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_type", sa.String(length=40), nullable=True),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="won"),
        sa.Column("lead_owner_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("closer_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["lead_owner_staff_id"], ["admin_staff.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["closer_staff_id"], ["admin_staff.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_staff_id"], ["admin_staff.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sale_conversions_closed", "sale_conversions", ["closed_at"])
    _rls("sale_conversions")

    op.create_table(
        "time_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("hours", sa.Numeric(6, 2), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False, server_default="other"),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["staff_id"], ["admin_staff.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_time_entries_staff_date", "time_entries", ["staff_id", "work_date"])
    _rls("time_entries")

    op.create_table(
        "support_activity",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["staff_id"], ["admin_staff.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    _rls("support_activity")

    op.create_table(
        "earnings_ledger",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_type", sa.String(length=24), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("policy_assignment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("earned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="owed"),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_by_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["staff_id"], ["admin_staff.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["policy_assignment_id"], ["staff_pay_assignments.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["paid_by_staff_id"], ["admin_staff.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_earnings_ledger_staff", "earnings_ledger", ["staff_id", "status"])
    _rls("earnings_ledger")


def downgrade() -> None:
    op.drop_table("earnings_ledger")
    op.drop_table("support_activity")
    op.drop_table("time_entries")
    op.drop_table("sale_conversions")
    op.drop_table("staff_pay_assignments")
    op.drop_table("pay_policies")
    op.drop_table("admin_staff")
