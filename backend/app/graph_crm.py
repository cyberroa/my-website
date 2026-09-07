from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.engagement import compute_score, HOT_LEAD_THRESHOLD
from app.models import CompetitorListing, CompetitorSource, Customer, Event, Part, Segment
from app.segments import segment_customers


def build_market_graph(db: Session, *, scope: str = "market", limit: int = 40) -> dict[str, Any]:
    """Build nodes/edges for admin market map (SQL aggregates, no LLM)."""
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    node_ids: set[str] = set()

    def add_node(nid: str, ntype: str, label: str, meta: dict | None = None) -> None:
        if nid in node_ids:
            return
        node_ids.add(nid)
        nodes.append({"id": nid, "type": ntype, "label": label, "meta": meta or {}})

    def add_edge(source: str, target: str, etype: str) -> None:
        edges.append({"source": source, "target": target, "type": etype})

    # Hot customers
    customers = db.execute(select(Customer).order_by(Customer.updated_at.desc()).limit(limit * 2)).scalars().all()
    scored: list[tuple[Customer, float]] = []
    for c in customers:
        events = db.execute(select(Event).where(Event.customer_id == c.id).limit(100)).scalars().all()
        score = compute_score(list(events))
        if score >= HOT_LEAD_THRESHOLD * 0.5:
            scored.append((c, score))
    scored.sort(key=lambda x: x[1], reverse=True)
    for c, score in scored[:limit]:
        cid = f"customer:{c.id}"
        add_node(cid, "customer", c.name or c.email, {"email": c.email, "score": score, "company": c.company})
        for tag in (c.tags or [])[:3]:
            tid = f"tag:{tag}"
            add_node(tid, "tag", tag)
            add_edge(cid, tid, "tagged")

    # Segments (approved or manual)
    segments = db.execute(select(Segment).limit(15)).scalars().all()
    for seg in segments:
        sid = f"segment:{seg.id}"
        add_node(sid, "segment", seg.name, {"slug": seg.slug, "ai_managed": seg.ai_managed})
        sample = segment_customers(db, seg.filter_json, limit=5)
        for c in sample:
            cid = f"customer:{c.id}"
            if cid not in node_ids:
                add_node(cid, "customer", c.name or c.email, {"email": c.email})
            add_edge(cid, sid, "in_segment")

    # Part interest from recent events
    part_events = (
        db.execute(
            select(Event)
            .where(Event.type.in_(("part_view", "part_click", "inventory_search")))
            .order_by(Event.occurred_at.desc())
            .limit(50)
        )
        .scalars()
        .all()
    )
    for ev in part_events:
        payload = ev.payload or {}
        pn = payload.get("part_number") or payload.get("partNumber")
        if pn:
            pid = f"part:{pn}"
            add_node(pid, "part", str(pn))
            if ev.customer_id:
                cid = f"customer:{ev.customer_id}"
                if cid in node_ids:
                    add_edge(cid, pid, "viewed")

    # Top parts catalog nodes
    parts = db.execute(select(Part).order_by(Part.updated_at.desc()).limit(10)).scalars().all()
    for p in parts:
        pid = f"part:{p.part_number}"
        add_node(pid, "part", p.part_number, {"name": p.name, "status": p.status})

    # Competitor listings matched to Titan part numbers
    comp_rows = (
        db.execute(
            select(CompetitorListing, CompetitorSource)
            .join(CompetitorSource, CompetitorListing.source_id == CompetitorSource.id)
            .where(CompetitorListing.part_number.isnot(None))
            .order_by(CompetitorListing.scraped_at.desc())
            .limit(30)
        )
        .all()
    )
    for listing, source in comp_rows:
        sid = f"competitor:{source.slug}"
        add_node(sid, "competitor", source.name, {"slug": source.slug})
        pn = (listing.part_number or "").strip()
        if not pn:
            continue
        pid = f"part:{pn}"
        if pid not in node_ids:
            add_node(pid, "part", pn, {"competitor_title": listing.title})
        add_edge(sid, pid, "lists")

    return {"nodes": nodes[:80], "edges": edges[:120], "scope": scope}
