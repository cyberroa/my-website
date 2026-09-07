"""Service jobs — PET/CT audit scheduling + report intake

Revision ID: 20260823_0007
Revises: 20260823_0006
Create Date: 2026-08-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260823_0007"
down_revision = "20260823_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("service_jobs", "completed_at", existing_type=sa.DateTime(timezone=True), nullable=True)
    op.add_column("service_jobs", sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("service_jobs", sa.Column("audit_report", sa.Text(), nullable=True))
    op.add_column(
        "service_jobs",
        sa.Column("follow_up_needed", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("ix_service_jobs_scheduled", "service_jobs", ["scheduled_at"])


def downgrade() -> None:
    op.drop_index("ix_service_jobs_scheduled", table_name="service_jobs")
    op.drop_column("service_jobs", "follow_up_needed")
    op.drop_column("service_jobs", "audit_report")
    op.drop_column("service_jobs", "scheduled_at")
    op.alter_column("service_jobs", "completed_at", existing_type=sa.DateTime(timezone=True), nullable=False)
