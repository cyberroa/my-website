"""Customer website + fuzzy search (pg_trgm, search_document)

Revision ID: 20260823_0011
Revises: 20260823_0010
Create Date: 2026-08-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260823_0011"
down_revision = "20260823_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.add_column("customers", sa.Column("website", sa.String(length=500), nullable=True))
    op.add_column("customers", sa.Column("search_document", sa.Text(), nullable=True))
    op.execute(
        """
        UPDATE customers SET search_document = lower(trim(concat_ws(' ',
            coalesce(email::text, ''),
            coalesce(name, ''),
            coalesce(company, ''),
            coalesce(website, ''),
            coalesce(phone, ''),
            coalesce(role, ''),
            coalesce(source, ''),
            coalesce(notes, ''),
            coalesce(array_to_string(tags, ' '), '')
        )))
        """
    )
    op.create_index(
        "ix_customers_search_document_trgm",
        "customers",
        ["search_document"],
        postgresql_using="gin",
        postgresql_ops={"search_document": "gin_trgm_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_customers_search_document_trgm", table_name="customers")
    op.drop_column("customers", "search_document")
    op.drop_column("customers", "website")
