# Rename admin_staff to workbench_staff
# Revision ID: 20260823_0009
# Revises: 20260823_0008
# Create Date: 2026-08-23

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260823_0009"
down_revision = "20260823_0008"
branch_labels = None
depends_on = None


def _rename_constraint_if_exists(table, old, new):
    conn = op.get_bind()
    exists = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid JOIN pg_namespace n ON t.relnamespace = n.oid WHERE c.conname = :name AND n.nspname = 'public' AND t.relname = :table"
        ),
        {"name": old, "table": table},
    ).first()
    if exists:
        op.execute(f"ALTER TABLE {table} RENAME CONSTRAINT {old} TO {new}")


def upgrade():
    op.rename_table("admin_staff", "workbench_staff")
    op.alter_column("workbench_staff", "staff_tier", new_column_name="workbench_tier")
    _rename_constraint_if_exists("workbench_staff", "uq_admin_staff_email", "uq_workbench_staff_email")
    op.execute("ALTER INDEX IF EXISTS ix_admin_staff_email RENAME TO ix_workbench_staff_email")
    op.execute("ALTER INDEX IF EXISTS ix_admin_staff_id RENAME TO ix_workbench_staff_id")


def downgrade():
    op.execute("ALTER INDEX IF EXISTS ix_workbench_staff_email RENAME TO ix_admin_staff_email")
    op.execute("ALTER INDEX IF EXISTS ix_workbench_staff_id RENAME TO ix_admin_staff_id")
    _rename_constraint_if_exists("workbench_staff", "uq_workbench_staff_email", "uq_admin_staff_email")
    op.alter_column("workbench_staff", "workbench_tier", new_column_name="staff_tier")
    op.rename_table("workbench_staff", "admin_staff")
