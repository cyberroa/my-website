from __future__ import annotations

import datetime as dt
import json
import logging
import re
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.campaign_copy import generate_email_draft
from app.ai.client import AiDisabledError, chat_completion, resolve_model
from app.ai.opportunities import OPPORTUNITY_TYPES
from app.models import MarketingGoal, Segment
from app.segments import segment_count

logger = logging.getLogger(__name__)

SEED_GOALS: list[dict[str, Any]] = [
    {
        "name": "Re-engage cooling GE parts leads",
        "description": "Customers whose warmth dropped after engagement — 7-day email re-engage.",
        "opportunity_types": ["cooling_engaged"],
        "channel": "email",
        "draft_on_threshold": 10,
    },
    {
        "name": "Hot leads — staff priority",
        "description": "Engagement score above hot threshold; prioritize outreach.",
        "opportunity_types": ["hot_lead"],
        "channel": "outreach",
        "draft_on_threshold": 5,
    },
    {
        "name": "Sell-to-us inquiries",
        "description": "Buy-side follow-up for equipment sell submissions.",
        "opportunity_types": ["sell_equipment"],
        "channel": "email",
        "draft_on_threshold": 5,
    },
    {
        "name": "Used PET/CT system buyers",
        "description": "Accounts signaling interest in used/refurbished GE PET/CT systems.",
        "opportunity_types": ["buy_used_petct"],
        "channel": "email",
        "draft_on_threshold": 5,
    },
    {
        "name": "Audit candidates",
        "description": "Facilities due for PET/CT mechanical audits and inspections.",
        "opportunity_types": ["audit_candidate", "service_contract_gap"],
        "channel": "email",
        "draft_on_threshold": 8,
    },
    {
        "name": "Consent-ready nurture",
        "description": "Marketing-consent contacts with low recent activity.",
        "opportunity_types": ["consent_ready_nurture"],
        "channel": "email",
        "draft_on_threshold": 25,
    },
]

GOAL_SEGMENT_SYSTEM = """You refine a Titan Imaging marketing segment filter for a staff-defined goal.

Return ONLY JSON:
- name: segment name (max 80 chars)
- slug: lowercase hyphenated slug
- description: 1-2 sentences
- filter_json: object using ONLY these keys: consent_marketing (bool), source (str), tags_any (array), tags_all (array), email_contains, company_contains, exclude_unsubscribed (bool), opportunity_types (array of strings), opportunity_max_age_days (int), min_opportunity_score (number)
- rationale: why this filter matches the goal

You MUST include opportunity_types from the goal (you may narrow but not invent unrelated types). Prefer opportunity_max_age_days between 3 and 14.
"""


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.strip().lower())
    return s.strip("-")[:200] or "goal-segment"


def goal_to_out(g: MarketingGoal, db: Session | None = None) -> dict[str, Any]:
    count = g.last_member_count
    if db is not None and g.segment_id:
        seg = db.get(Segment, g.segment_id)
        if seg:
            count = segment_count(db, seg.filter_json)
    pending_name = None
    segment_name = None
    if db is not None:
        if g.pending_segment_id:
            ps = db.get(Segment, g.pending_segment_id)
            pending_name = ps.name if ps else None
        if g.segment_id:
            s = db.get(Segment, g.segment_id)
            segment_name = s.name if s else None
    return {
        "id": str(g.id),
        "name": g.name,
        "description": g.description,
        "opportunity_types": list(g.opportunity_types or []),
        "channel": g.channel,
        "segment_id": str(g.segment_id) if g.segment_id else None,
        "segment_name": segment_name,
        "pending_segment_id": str(g.pending_segment_id) if g.pending_segment_id else None,
        "pending_segment_name": pending_name,
        "auto_refresh": g.auto_refresh,
        "draft_on_threshold": g.draft_on_threshold,
        "active": g.active,
        "segment_link_status": g.segment_link_status,
        "last_member_count": count,
        "last_refreshed_at": g.last_refreshed_at.isoformat() if g.last_refreshed_at else None,
        "last_draft_at": g.last_draft_at.isoformat() if g.last_draft_at else None,
        "created_at": g.created_at.isoformat(),
    }


def seed_default_goals(db: Session, *, created_by: str | None = None) -> int:
    existing = db.scalar(select(func.count()).select_from(MarketingGoal)) or 0
    if existing > 0:
        return 0
    for row in SEED_GOALS:
        db.add(
            MarketingGoal(
                id=uuid.uuid4(),
                name=row["name"],
                description=row.get("description"),
                opportunity_types=list(row["opportunity_types"]),
                channel=row.get("channel") or "email",
                auto_refresh=True,
                draft_on_threshold=row.get("draft_on_threshold"),
                active=True,
                segment_link_status="none",
                created_by=created_by,
            )
        )
    db.commit()
    return len(SEED_GOALS)


def deterministic_filter(goal: MarketingGoal) -> dict[str, Any]:
    types = [t for t in (goal.opportunity_types or []) if t in OPPORTUNITY_TYPES]
    f: dict[str, Any] = {
        "opportunity_types": types or list(goal.opportunity_types or []),
        "opportunity_max_age_days": 7,
        "exclude_unsubscribed": True,
    }
    if "consent_ready_nurture" in f["opportunity_types"]:
        f["consent_marketing"] = True
    return f


async def generate_segment_for_goal(db: Session, goal: MarketingGoal) -> Segment:
    """Create a pending segment for the goal (does not attach as live until approve)."""
    base_filter = deterministic_filter(goal)
    name = f"{goal.name} (audience)"
    slug = _slugify(name)
    description = goal.description
    rationale = "Deterministic filter from goal opportunity types."

    try:
        raw = await chat_completion(
            messages=[
                {"role": "system", "content": GOAL_SEGMENT_SYSTEM},
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "goal": {
                                "name": goal.name,
                                "description": goal.description,
                                "opportunity_types": goal.opportunity_types,
                                "channel": goal.channel,
                            },
                            "base_filter": base_filter,
                            "allowed_opportunity_types": list(OPPORTUNITY_TYPES),
                        },
                        default=str,
                    ),
                },
            ],
            model=resolve_model("segment"),
            response_format="json",
            temperature=0.3,
            max_tokens=500,
        )
        data = json.loads(raw)
        name = (data.get("name") or name).strip()[:200]
        slug = _slugify(data.get("slug") or name)
        description = (data.get("description") or description or "").strip() or None
        rationale = (data.get("rationale") or rationale).strip()
        fj = data.get("filter_json") or {}
        if isinstance(fj, dict):
            # Force opportunity types from goal
            fj["opportunity_types"] = list(goal.opportunity_types or [])
            if "opportunity_max_age_days" not in fj:
                fj["opportunity_max_age_days"] = 7
            if "exclude_unsubscribed" not in fj:
                fj["exclude_unsubscribed"] = True
            base_filter = fj
    except (AiDisabledError, json.JSONDecodeError, Exception):
        logger.info("Goal segment AI refine skipped/failed; using deterministic filter")

    base_slug = slug
    n = 1
    while db.scalar(select(Segment).where(Segment.slug == slug)) is not None:
        slug = f"{base_slug}-{n}"
        n += 1

    seg = Segment(
        id=uuid.uuid4(),
        name=name,
        slug=slug,
        description=description,
        filter_json=base_filter,
        ai_managed=True,
        ai_proposal_status="pending",
        ai_rationale=rationale,
        ai_proposed_at=dt.datetime.now(dt.timezone.utc),
    )
    db.add(seg)
    db.flush()

    goal.pending_segment_id = seg.id
    goal.segment_link_status = "pending"
    db.commit()
    db.refresh(goal)
    db.refresh(seg)
    return seg


def approve_goal_segment(db: Session, goal: MarketingGoal) -> MarketingGoal:
    if not goal.pending_segment_id:
        raise ValueError("No pending segment to approve")
    seg = db.get(Segment, goal.pending_segment_id)
    if not seg:
        raise ValueError("Pending segment missing")
    seg.ai_proposal_status = "approved"
    goal.segment_id = seg.id
    goal.pending_segment_id = None
    goal.segment_link_status = "approved"
    goal.last_member_count = segment_count(db, seg.filter_json)
    goal.last_refreshed_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    db.refresh(goal)
    return goal


def refresh_goal_membership(db: Session, goal: MarketingGoal) -> dict[str, Any]:
    if not goal.segment_id:
        raise ValueError("Goal has no approved segment")
    seg = db.get(Segment, goal.segment_id)
    if not seg:
        raise ValueError("Linked segment missing")

    # Keep opportunity_types aligned with goal
    fj = dict(seg.filter_json or {})
    fj["opportunity_types"] = list(goal.opportunity_types or [])
    if "opportunity_max_age_days" not in fj:
        fj["opportunity_max_age_days"] = 7
    seg.filter_json = fj

    count = segment_count(db, fj)
    prev = goal.last_member_count
    goal.last_member_count = count
    goal.last_refreshed_at = dt.datetime.now(dt.timezone.utc)

    # Refresh lightweight playbook summary when membership shifts
    types = ", ".join(goal.opportunity_types or []) or "general"
    summary = (
        f"Goal-linked segment for «{goal.name}» targeting opportunities: {types}. "
        f"Members now: {count} (was {prev}). "
        f"Recommended Titan angles: map offers from opportunity types "
        f"(parts, PET/CT audits, used/new systems, sell-to-us)."
    )
    seg.research_summary = summary[:20_000]
    if not seg.playbook_markdown:
        seg.playbook_markdown = (
            f"# {seg.name}\n\n"
            f"**Goal:** {goal.name}\n\n"
            f"{goal.description or ''}\n\n"
            f"**Opportunity types:** {types}\n\n"
            f"Use Titan offers that match this subset: parts & support, mechanical audits, "
            f"service contracts, used/new PET/CT systems, sell-to-us.\n"
        )
    labels = list(seg.labels or [])
    for t in goal.opportunity_types or []:
        if t not in labels:
            labels.append(t)
    seg.labels = labels[:40]

    flag = None
    if count == 0:
        flag = "empty"
    elif prev is not None and prev > 0 and count >= max(50, prev * 5):
        flag = "exploded"
    elif prev is not None and prev >= 10 and count <= max(1, prev // 5):
        flag = "collapsed"

    db.commit()
    return {
        "goal_id": str(goal.id),
        "member_count": count,
        "previous_count": prev,
        "flag": flag,
        "playbook_refreshed": True,
    }


def refresh_all_auto_goals(db: Session) -> dict[str, Any]:
    goals = (
        db.execute(
            select(MarketingGoal).where(
                MarketingGoal.active.is_(True),
                MarketingGoal.auto_refresh.is_(True),
                MarketingGoal.segment_link_status == "approved",
                MarketingGoal.segment_id.isnot(None),
            )
        )
        .scalars()
        .all()
    )
    results = []
    for g in goals:
        try:
            results.append(refresh_goal_membership(db, g))
        except ValueError as exc:
            results.append({"goal_id": str(g.id), "error": str(exc)})
    return {"refreshed": len(results), "results": results}


async def draft_campaign_for_goal(db: Session, goal: MarketingGoal) -> dict[str, Any]:
    count = goal.last_member_count
    if goal.segment_id:
        seg = db.get(Segment, goal.segment_id)
        if seg:
            count = segment_count(db, seg.filter_json)
            goal.last_member_count = count

    draft = await generate_email_draft(
        goal=goal.description or goal.name,
        segment_name=goal.name,
        context={
            "goal_name": goal.name,
            "opportunity_types": goal.opportunity_types,
            "channel": goal.channel,
            "member_count": count,
        },
    )
    goal.last_draft_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    return {"draft": draft, "member_count": count}
