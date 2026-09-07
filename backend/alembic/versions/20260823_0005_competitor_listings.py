"""Sprint 3 — competitor sources + listings (Firecrawl)

Revision ID: 20260823_0005
Revises: 20260823_0004
Create Date: 2026-08-23
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260823_0005"
down_revision = "20260823_0004"
branch_labels = None
depends_on = None


def _rls(table: str) -> None:
    op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')
    op.execute(f'REVOKE ALL ON TABLE public."{table}" FROM anon, authenticated')


def upgrade() -> None:
    op.create_table(
        "competitor_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("base_url", sa.Text(), nullable=True),
        sa.Column("scrape_urls", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("last_scraped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
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
        sa.UniqueConstraint("slug", name="uq_competitor_source_slug"),
    )
    _rls("competitor_sources")

    op.create_table(
        "competitor_listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_sku", sa.String(length=120), nullable=True),
        sa.Column("part_number", sa.String(length=120), nullable=True, index=True),
        sa.Column("title", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("price_cents", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("availability", sa.String(length=80), nullable=True),
        sa.Column("listing_url", sa.Text(), nullable=True),
        sa.Column("raw_json", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.Column("scraped_at", sa.DateTime(timezone=True), nullable=False),
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
        sa.ForeignKeyConstraint(["source_id"], ["competitor_sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_competitor_listings_source_sku",
        "competitor_listings",
        ["source_id", "external_sku"],
    )
    op.create_index("ix_competitor_listings_scraped", "competitor_listings", ["scraped_at"])
    _rls("competitor_listings")


def downgrade() -> None:
    op.drop_table("competitor_listings")
    op.drop_table("competitor_sources")
