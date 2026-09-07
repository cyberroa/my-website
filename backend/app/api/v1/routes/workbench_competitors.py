"""Admin competitor sources, listings, compare, scrape."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import WorkbenchUser, get_current_workbench_user
from app.competitors.firecrawl import FirecrawlDisabledError, FirecrawlError, firecrawl_is_ready
from app.competitors.scrape import (
    compare_listings,
    ensure_slug,
    listing_to_out,
    scrape_all_active_sources,
    scrape_source,
    seed_default_sources,
    source_to_out,
)
from app.db import get_db
from app.models import CompetitorListing, CompetitorSource

router = APIRouter(prefix="/workbench/competitors", dependencies=[Depends(get_current_workbench_user)])


@router.get("/status")
def competitors_status():
    return {
        "firecrawl_configured": firecrawl_is_ready(),
        "scraper": "firecrawl",
    }


@router.get("/sources")
def list_sources(db: Session = Depends(get_db), admin: WorkbenchUser = Depends(get_current_workbench_user)):
    seed_default_sources(db)
    rows = (
        db.execute(select(CompetitorSource).order_by(CompetitorSource.name.asc())).scalars().all()
    )
    out = []
    for src in rows:
        d = source_to_out(src)
        count = db.execute(
            select(func.count()).select_from(CompetitorListing).where(
                CompetitorListing.source_id == src.id
            )
        ).scalar_one()
        d["listing_count"] = int(count or 0)
        out.append(d)
    return out


@router.post("/sources/seed")
def seed_sources(db: Session = Depends(get_db), admin: WorkbenchUser = Depends(get_current_workbench_user)):
    return {"added": seed_default_sources(db)}


@router.post("/sources")
def create_source(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name required")
    slug = ensure_slug(name, body.get("slug"))
    exists = db.execute(
        select(CompetitorSource).where(CompetitorSource.slug == slug)
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=409, detail="slug already exists")
    urls = body.get("scrape_urls") or []
    if not isinstance(urls, list):
        raise HTTPException(status_code=400, detail="scrape_urls must be a list")
    src = CompetitorSource(
        id=uuid.uuid4(),
        name=name[:200],
        slug=slug,
        base_url=(body.get("base_url") or None),
        scrape_urls=[str(u).strip() for u in urls if str(u).strip()][:50],
        active=bool(body.get("active", False)),
        notes=(body.get("notes") or None),
    )
    db.add(src)
    db.commit()
    db.refresh(src)
    return source_to_out(src)


@router.patch("/sources/{source_id}")
def update_source(
    source_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    src = db.get(CompetitorSource, uuid.UUID(source_id))
    if not src:
        raise HTTPException(status_code=404, detail="Not found")
    if "name" in body and body["name"]:
        src.name = str(body["name"]).strip()[:200]
    if "slug" in body and body["slug"]:
        src.slug = ensure_slug(src.name, body["slug"])
    if "base_url" in body:
        src.base_url = body["base_url"] or None
    if "scrape_urls" in body:
        urls = body["scrape_urls"] or []
        if not isinstance(urls, list):
            raise HTTPException(status_code=400, detail="scrape_urls must be a list")
        src.scrape_urls = [str(u).strip() for u in urls if str(u).strip()][:50]
    if "active" in body:
        src.active = bool(body["active"])
    if "notes" in body:
        src.notes = body["notes"] or None
    db.commit()
    db.refresh(src)
    return source_to_out(src)


@router.delete("/sources/{source_id}")
def delete_source(
    source_id: str,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    src = db.get(CompetitorSource, uuid.UUID(source_id))
    if not src:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(src)
    db.commit()
    return {"ok": True}


@router.get("/listings")
def list_listings(
    source_id: str | None = None,
    q: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 500))
    stmt = (
        select(CompetitorListing, CompetitorSource)
        .join(CompetitorSource, CompetitorListing.source_id == CompetitorSource.id)
        .order_by(CompetitorListing.scraped_at.desc())
        .limit(limit)
    )
    if source_id:
        stmt = stmt.where(CompetitorListing.source_id == uuid.UUID(source_id))
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            (CompetitorListing.title.ilike(like))
            | (CompetitorListing.part_number.ilike(like))
            | (CompetitorListing.external_sku.ilike(like))
        )
    rows = db.execute(stmt).all()
    return [listing_to_out(listing, source_name=source.name) for listing, source in rows]


@router.get("/compare")
def compare(limit: int = 100, db: Session = Depends(get_db)):
    return compare_listings(db, limit=max(1, min(limit, 500)))


@router.post("/sources/{source_id}/scrape")
async def scrape_one(
    source_id: str,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    try:
        return await scrape_source(db, uuid.UUID(source_id))
    except FirecrawlDisabledError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except FirecrawlError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/scrape")
async def scrape_active(
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    try:
        return await scrape_all_active_sources(db)
    except FirecrawlDisabledError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
