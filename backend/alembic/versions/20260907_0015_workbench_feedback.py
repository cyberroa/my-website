"""Staff workbench feedback inbox

Revision ID: 20260907_0015
Revises: 20260907_0014
Create Date: 2026-09-07
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "20260907_0015"
down_revision = "20260907_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workbench_feedback",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("staff_email", sa.String(320), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("page_path", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_workbench_feedback_staff_email", "workbench_feedback", ["staff_email"])
    op.create_index("ix_workbench_feedback_created_at", "workbench_feedback", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_workbench_feedback_created_at", table_name="workbench_feedback")
    op.drop_index("ix_workbench_feedback_staff_email", table_name="workbench_feedback")
    op.drop_table("workbench_feedback")
