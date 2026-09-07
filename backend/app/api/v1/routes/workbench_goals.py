from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.client import AiDisabledError, AiError
from app.ai.goals import (
    approve_goal_segment,
    draft_campaign_for_goal,
    generate_segment_for_goal,
    goal_to_out,
    refresh_goal_membership,
    seed_default_goals,
)
from app.ai.opportunities import OPPORTUNITY_TYPES, customer_latest_opportunities
from app.auth import WorkbenchUser, get_current_workbench_user
from app.db import get_db
from app.models import MarketingGoal

router = APIRouter(prefix="/workbench/goals", dependencies=[Depends(get_current_workbench_user)])


@router.get("/opportunity-types")
def list_opportunity_types():
    return {
        "types": list(OPPORTUNITY_TYPES),
        "labels": {
            "warm_parts_inquiry": "Warm parts inquiry",
            "cooling_engaged": "Cooling engaged",
            "sell_equipment": "Sell equipment",
            "consent_ready_nurture": "Consent-ready nurture",
            "hot_lead": "Hot lead",
        },
    }


@router.get("")
def list_goals(db: Session = Depends(get_db), admin: WorkbenchUser = Depends(get_current_workbench_user)):
    seed_default_goals(db, created_by=admin.email)
    rows = (
        db.execute(select(MarketingGoal).order_by(MarketingGoal.created_at.desc())).scalars().all()
    )
    return [goal_to_out(g, db) for g in rows]


@router.post("/seed")
def seed_goals(db: Session = Depends(get_db), admin: WorkbenchUser = Depends(get_current_workbench_user)):
    return {"added": seed_default_goals(db, created_by=admin.email)}


@router.post("")
def create_goal(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name required")
    types = body.get("opportunity_types") or []
    if not isinstance(types, list) or not types:
        raise HTTPException(status_code=400, detail="opportunity_types required")
    g = MarketingGoal(
        id=uuid.uuid4(),
        name=name[:200],
        description=(body.get("description") or None),
        opportunity_types=[str(t) for t in types][:10],
        channel=(body.get("channel") or "email")[:40],
        auto_refresh=bool(body.get("auto_refresh", True)),
        draft_on_threshold=body.get("draft_on_threshold"),
        active=True,
        segment_link_status="none",
        created_by=admin.email,
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return goal_to_out(g, db)


@router.get("/{goal_id}")
def get_goal(goal_id: str, db: Session = Depends(get_db)):
    g = db.get(MarketingGoal, goal_id)
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal_to_out(g, db)


@router.patch("/{goal_id}")
def update_goal(goal_id: str, body: dict[str, Any], db: Session = Depends(get_db)):
    g = db.get(MarketingGoal, goal_id)
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    if "name" in body and body["name"]:
        g.name = str(body["name"]).strip()[:200]
    if "description" in body:
        g.description = body["description"]
    if "opportunity_types" in body and isinstance(body["opportunity_types"], list):
        g.opportunity_types = [str(t) for t in body["opportunity_types"]][:10]
    if "channel" in body and body["channel"]:
        g.channel = str(body["channel"])[:40]
    if "auto_refresh" in body:
        g.auto_refresh = bool(body["auto_refresh"])
    if "draft_on_threshold" in body:
        g.draft_on_threshold = body["draft_on_threshold"]
    if "active" in body:
        g.active = bool(body["active"])
    db.commit()
    db.refresh(g)
    return goal_to_out(g, db)


@router.delete("/{goal_id}")
def delete_goal(goal_id: str, db: Session = Depends(get_db)):
    g = db.get(MarketingGoal, goal_id)
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(g)
    db.commit()
    return {"ok": True}


@router.post("/{goal_id}/generate-segment")
async def generate_segment(goal_id: str, db: Session = Depends(get_db)):
    g = db.get(MarketingGoal, goal_id)
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    try:
        seg = await generate_segment_for_goal(db, g)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    db.refresh(g)
    return {
        "goal": goal_to_out(g, db),
        "segment": {
            "id": str(seg.id),
            "name": seg.name,
            "slug": seg.slug,
            "filter_json": seg.filter_json,
            "ai_rationale": seg.ai_rationale,
            "ai_proposal_status": seg.ai_proposal_status,
        },
    }


@router.post("/{goal_id}/approve-segment")
def approve_segment(goal_id: str, db: Session = Depends(get_db)):
    g = db.get(MarketingGoal, goal_id)
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    try:
        g = approve_goal_segment(db, g)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return goal_to_out(g, db)


@router.post("/{goal_id}/refresh")
def refresh_goal(goal_id: str, db: Session = Depends(get_db)):
    g = db.get(MarketingGoal, goal_id)
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    try:
        result = refresh_goal_membership(db, g)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.refresh(g)
    return {"goal": goal_to_out(g, db), "refresh": result}


@router.post("/{goal_id}/draft-campaign")
async def draft_campaign(goal_id: str, db: Session = Depends(get_db)):
    g = db.get(MarketingGoal, goal_id)
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    try:
        result = await draft_campaign_for_goal(db, g)
    except AiDisabledError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return result
