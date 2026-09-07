from __future__ import annotations

import datetime as dt
import json
import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.client import chat_completion, resolve_model
from app.ai.prompts import SEGMENT_SYSTEM, segment_proposal_user_prompt
from app.ai.snapshots import warmth_movers
from app.models import Customer, Segment
from app.segments import segment_count


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.strip().lower())
    return s.strip("-")[:200] or "segment"


async def propose_segment(db: Session) -> Segment:
    stats = {
        "total_customers": db.scalar(select(func.count()).select_from(Customer)) or 0,
        "marketing_consent": db.scalar(
            select(func.count()).select_from(Customer).where(Customer.consent_marketing.is_(True))
        )
        or 0,
        "warmth_movers": warmth_movers(db),
        "top_sources": [
            {"source": r[0], "count": r[1]}
            for r in db.execute(
                select(Customer.source, func.count())
                .where(Customer.source.isnot(None))
                .group_by(Customer.source)
                .order_by(func.count().desc())
                .limit(5)
            ).all()
        ],
    }
    raw = await chat_completion(
        messages=[
            {"role": "system", "content": SEGMENT_SYSTEM},
            {"role": "user", "content": segment_proposal_user_prompt(json.dumps(stats, default=str))},
        ],
        model=resolve_model("segment"),
        response_format="json",
        temperature=0.4,
        max_tokens=600,
    )
    data = json.loads(raw)
    name = (data.get("name") or "AI Segment").strip()[:200]
    slug = _slugify(data.get("slug") or name)
    base_slug = slug
    n = 1
    while db.scalar(select(Segment).where(Segment.slug == slug)) is not None:
        slug = f"{base_slug}-{n}"
        n += 1

    seg = Segment(
        id=uuid.uuid4(),
        name=name,
        slug=slug,
        description=(data.get("description") or "").strip() or None,
        filter_json=data.get("filter_json") or {},
        ai_managed=True,
        ai_proposal_status="pending",
        ai_rationale=(data.get("rationale") or "").strip() or None,
        ai_proposed_at=dt.datetime.now(dt.timezone.utc),
    )
    db.add(seg)
    db.commit()
    db.refresh(seg)
    return seg


def approve_ai_segment(db: Session, segment_id: uuid.UUID) -> Segment:
    seg = db.get(Segment, segment_id)
    if not seg:
        raise ValueError("Segment not found")
    seg.ai_proposal_status = "approved"
    seg.ai_managed = True
    db.commit()
    db.refresh(seg)
    return seg


def reject_ai_segment(db: Session, segment_id: uuid.UUID) -> Segment:
    seg = db.get(Segment, segment_id)
    if not seg:
        raise ValueError("Segment not found")
    seg.ai_proposal_status = "rejected"
    db.commit()
    db.refresh(seg)
    return seg


def segment_stats_for_proposal(db: Session, seg: Segment) -> dict:
    return {
        "name": seg.name,
        "count": segment_count(db, seg.filter_json),
        "filter_json": seg.filter_json,
        "rationale": seg.ai_rationale,
        "status": seg.ai_proposal_status,
    }
