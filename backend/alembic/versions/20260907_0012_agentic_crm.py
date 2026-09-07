"""Agentic CRM: segment playbooks, evidence ledger, agent queue, fit scores

Revision ID: 20260907_0012
Revises: 20260823_0011
Create Date: 2026-09-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260907_0012"
down_revision = "20260823_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("segments", sa.Column("playbook_markdown", sa.Text(), nullable=True))
    op.add_column(
        "segments",
        sa.Column("recommended_services", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
    )
    op.add_column(
        "segments",
        sa.Column("labels", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"),
    )
    op.add_column("segments", sa.Column("research_summary", sa.Text(), nullable=True))
    op.add_column(
        "segments",
        sa.Column("last_researched_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "segments",
        sa.Column("research_budget_used", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "customer_evidence",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(120), nullable=False, server_default="agent"),
        sa.Column("tool_name", sa.String(120), nullable=True),
        sa.Column("observation", sa.Text(), nullable=False),
        sa.Column("strength", sa.String(16), nullable=False, server_default="weak"),
        sa.Column("suggested_field", sa.String(80), nullable=True),
        sa.Column("suggested_value", sa.Text(), nullable=True),
        sa.Column("status", sa.String(24), nullable=False, server_default="suggested"),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.String(320), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_customer_evidence_customer_id", "customer_evidence", ["customer_id"])

    op.create_table(
        "agent_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("kind", sa.String(64), nullable=False),
        sa.Column("subject_type", sa.String(32), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("result_summary", sa.Text(), nullable=True),
        sa.Column("steps_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("open_questions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(320), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_agent_tasks_kind", "agent_tasks", ["kind"])
    op.create_index("ix_agent_tasks_subject_id", "agent_tasks", ["subject_id"])
    op.create_index("ix_agent_tasks_status", "agent_tasks", ["status"])
    op.create_index("ix_agent_tasks_due_at", "agent_tasks", ["due_at"])

    op.create_table(
        "customer_fit_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("offer_family", sa.String(40), nullable=False),
        sa.Column("score", sa.Numeric(10, 1), nullable=False, server_default="0"),
        sa.Column("reasons", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("as_of_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_customer_fit_scores_customer_id", "customer_fit_scores", ["customer_id"])
    op.create_index("ix_customer_fit_scores_offer_family", "customer_fit_scores", ["offer_family"])
    op.create_index("ix_customer_fit_scores_as_of_date", "customer_fit_scores", ["as_of_date"])
    op.create_index(
        "uq_customer_fit_scores_day",
        "customer_fit_scores",
        ["customer_id", "offer_family", "as_of_date"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_customer_fit_scores_day", table_name="customer_fit_scores")
    op.drop_index("ix_customer_fit_scores_as_of_date", table_name="customer_fit_scores")
    op.drop_index("ix_customer_fit_scores_offer_family", table_name="customer_fit_scores")
    op.drop_index("ix_customer_fit_scores_customer_id", table_name="customer_fit_scores")
    op.drop_table("customer_fit_scores")

    op.drop_index("ix_agent_tasks_due_at", table_name="agent_tasks")
    op.drop_index("ix_agent_tasks_status", table_name="agent_tasks")
    op.drop_index("ix_agent_tasks_subject_id", table_name="agent_tasks")
    op.drop_index("ix_agent_tasks_kind", table_name="agent_tasks")
    op.drop_table("agent_tasks")

    op.drop_index("ix_customer_evidence_customer_id", table_name="customer_evidence")
    op.drop_table("customer_evidence")

    op.drop_column("segments", "research_budget_used")
    op.drop_column("segments", "last_researched_at")
    op.drop_column("segments", "research_summary")
    op.drop_column("segments", "labels")
    op.drop_column("segments", "recommended_services")
    op.drop_column("segments", "playbook_markdown")
