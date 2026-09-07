"""Scrape competitor sources and upsert listings."""

from __future__ import annotations

import datetime as dt
import logging
import re
import uuid
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.competitors.firecrawl import FirecrawlDisabledError, FirecrawlError, scrape_url
from app.competitors.normalize import extract_listings_from_firecrawl, slugify
from app.models import CompetitorListing, CompetitorSource, Part

logger = logging.getLogger(__name__)

DEFAULT_SOURCES: list[dict[str, Any]] = [
    {
        "name": "Block Imaging",
        "slug": "block-imaging",
        "base_url": "https://www.blockimaging.com",
        "scrape_urls": ["https://www.blockimaging.com/parts"],
        "active": False,
        "notes": "Edit scrape_urls to real catalog pages, then activate and scrape.",
    },
    {
        "name": "MRI Resources",
        "slug": "mri-resources",
        "base_url": "https://www.mriresources.com",
        "scrape_urls": ["https://www.mriresources.com"],
        "active": False,
        "notes": "Placeholder — replace with inventory/search URLs before scraping.",
    },
]


def seed_default_sources(db: Session) -> int:
    added = 0
    for row in DEFAULT_SOURCES:
        exists = db.execute(
            select(CompetitorSource).where(CompetitorSource.slug == row["slug"])
        ).scalar_one_or_none()
        if exists:
            continue
        db.add(
            CompetitorSource(
                id=uuid.uuid4(),
                name=row["name"],
                slug=row["slug"],
                base_url=row.get("base_url"),
                scrape_urls=list(row.get("scrape_urls") or []),
                active=bool(row.get("active", False)),
                notes=row.get("notes"),
            )
        )
        added += 1
    if added:
        db.commit()
    return added


def source_to_out(src: CompetitorSource) -> dict[str, Any]:
    return {
        "id": str(src.id),
        "name": src.name,
        "slug": src.slug,
        "base_url": src.base_url,
        "scrape_urls": list(src.scrape_urls or []),
        "active": src.active,
        "notes": src.notes,
        "last_scraped_at": src.last_scraped_at.isoformat() if src.last_scraped_at else None,
        "last_error": src.last_error,
        "created_at": src.created_at.isoformat() if src.created_at else None,
        "updated_at": src.updated_at.isoformat() if src.updated_at else None,
    }


def listing_to_out(row: CompetitorListing, *, source_name: str | None = None) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "source_id": str(row.source_id),
        "source_name": source_name,
        "external_sku": row.external_sku,
        "part_number": row.part_number,
        "title": row.title,
        "price_cents": row.price_cents,
        "currency": row.currency,
        "availability": row.availability,
        "listing_url": row.listing_url,
        "scraped_at": row.scraped_at.isoformat() if row.scraped_at else None,
    }


async def scrape_source(db: Session, source_id: uuid.UUID) -> dict[str, Any]:
    src = db.get(CompetitorSource, source_id)
    if not src:
        raise ValueError("source not found")
    urls = [u for u in (src.scrape_urls or []) if isinstance(u, str) and u.strip()]
    if not urls:
        raise ValueError("source has no scrape_urls")

    scraped_at = dt.datetime.now(dt.timezone.utc)
    all_listings: list[dict[str, Any]] = []
    errors: list[str] = []

    for url in urls:
        try:
            data = await scrape_url(url.strip())
            all_listings.extend(extract_listings_from_firecrawl(data, page_url=url.strip()))
        except FirecrawlDisabledError:
            raise
        except FirecrawlError as e:
            errors.append(f"{url}: {e}")
            logger.warning("Scrape failed for %s: %s", url, e)
        except Exception as e:  # noqa: BLE001
            errors.append(f"{url}: {e}")
            logger.exception("Unexpected scrape error for %s", url)

    # Replace prior listings for this source (full refresh per scrape)
    db.execute(delete(CompetitorListing).where(CompetitorListing.source_id == src.id))
    for item in all_listings:
        db.add(
            CompetitorListing(
                id=uuid.uuid4(),
                source_id=src.id,
                external_sku=item.get("external_sku"),
                part_number=item.get("part_number"),
                title=item["title"],
                price_cents=item.get("price_cents"),
                currency=item.get("currency") or "USD",
                availability=item.get("availability"),
                listing_url=item.get("listing_url"),
                raw_json=item.get("raw_json") or {},
                scraped_at=scraped_at,
            )
        )

    src.last_scraped_at = scraped_at
    src.last_error = "; ".join(errors)[:2000] if errors else None
    src.updated_at = scraped_at
    db.commit()

    return {
        "source_id": str(src.id),
        "urls": len(urls),
        "listings": len(all_listings),
        "errors": errors,
        "scraped_at": scraped_at.isoformat(),
    }


async def scrape_all_active_sources(db: Session) -> dict[str, Any]:
    seed_default_sources(db)
    sources = (
        db.execute(select(CompetitorSource).where(CompetitorSource.active.is_(True)))
        .scalars()
        .all()
    )
    results: list[dict[str, Any]] = []
    for src in sources:
        try:
            results.append(await scrape_source(db, src.id))
        except FirecrawlDisabledError as e:
            return {"ok": False, "error": str(e), "results": results}
        except Exception as e:  # noqa: BLE001
            results.append({"source_id": str(src.id), "error": str(e)})
    return {"ok": True, "sources": len(sources), "results": results}


def compare_listings(db: Session, *, limit: int = 100) -> list[dict[str, Any]]:
    """Match competitor part_numbers to Titan parts; return price deltas."""
    titan_parts = {
        p.part_number.upper(): p
        for p in db.execute(select(Part)).scalars().all()
        if p.part_number
    }
    listings = (
        db.execute(
            select(CompetitorListing, CompetitorSource)
            .join(CompetitorSource, CompetitorListing.source_id == CompetitorSource.id)
            .order_by(CompetitorListing.scraped_at.desc())
            .limit(limit * 5)
        )
        .all()
    )
    rows: list[dict[str, Any]] = []
    for listing, source in listings:
        pn = (listing.part_number or listing.external_sku or "").upper()
        if not pn or pn not in titan_parts:
            continue
        part = titan_parts[pn]
        titan_cents = int(round(float(part.price) * 100)) if part.price is not None else None
        delta = None
        if titan_cents is not None and listing.price_cents is not None:
            delta = listing.price_cents - titan_cents
        rows.append(
            {
                "part_number": part.part_number,
                "titan_name": part.name,
                "titan_price_cents": titan_cents,
                "titan_status": part.status,
                "competitor": source.name,
                "competitor_title": listing.title,
                "competitor_price_cents": listing.price_cents,
                "currency": listing.currency,
                "availability": listing.availability,
                "listing_url": listing.listing_url,
                "delta_cents": delta,
                "scraped_at": listing.scraped_at.isoformat() if listing.scraped_at else None,
            }
        )
        if len(rows) >= limit:
            break
    return rows


def ensure_slug(name: str, slug: str | None) -> str:
    if slug and slug.strip():
        return re.sub(r"[^a-z0-9\-]+", "-", slug.strip().lower()).strip("-")[:200]
    return slugify(name)
