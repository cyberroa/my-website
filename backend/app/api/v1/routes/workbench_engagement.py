"""Engagement logging, analytics overview, mailbox sync endpoints."""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.engagement import (
    LEAD_STAGES,
    ai_extract_engagement,
    analytics_overview,
    apply_engagement_stage,
    create_engagement,
    engagement_to_out,
    list_engagements,
    match_customer_from_email_text,
    normalize_stage,
    recent_campaigns_for_customer,
    recompute_fit_for_customer,
)
from app.auth import WorkbenchUser, get_current_workbench_user
from app.db import get_db
from app.mailbox import list_connections, sync_mailbox, upsert_connection
from app.models import Customer, WorkbenchStaff
from app.settings import get_settings
from app.staff_permissions import (
    CAPABILITIES,
    is_owner_tier,
    require_any_capability,
    require_owner_tier,
    sync_legacy_role,
)

router = APIRouter(prefix="/workbench", dependencies=[Depends(get_current_workbench_user)])


def _ensure_staff(db: Session, admin: WorkbenchUser) -> WorkbenchStaff:
    row = db.scalar(select(WorkbenchStaff).where(WorkbenchStaff.email == admin.email))
    if row:
        settings = get_settings()
        if admin.email in settings.owner_emails_set and not is_owner_tier(row):
            row.staff_tier = "owner"
            row.capabilities = sorted(CAPABILITIES)
            sync_legacy_role(row)
            db.commit()
            db.refresh(row)
        return row
    settings = get_settings()
    is_owner = admin.email in settings.owner_emails_set
    row = WorkbenchStaff(
        id=uuid.uuid4(),
        email=admin.email,
        display_name=admin.email.split("@")[0],
        role="owner" if is_owner else "admin",
        staff_tier="owner" if is_owner else "admin",
        capabilities=sorted(CAPABILITIES) if is_owner else [],
    )
    sync_legacy_role(row)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/analytics/overview")
def get_analytics_overview(
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
    hours: int = Query(default=24, ge=1, le=168),
):
    me = _ensure_staff(db, admin)
    require_any_capability(me, "sales", "marketing")
    return analytics_overview(db, hours=hours)


@router.get("/analytics/pipeline/{stage}/customers")
def pipeline_customers(
    stage: str,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
    limit: int = Query(default=50, ge=1, le=200),
):
    me = _ensure_staff(db, admin)
    require_any_capability(me, "sales", "marketing")
    s = normalize_stage(stage)
    if not s:
        raise HTTPException(status_code=400, detail="Invalid stage")
    rows = list(
        db.execute(
            select(Customer)
            .where(Customer.lead_stage == s)
            .order_by(Customer.updated_at.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return {
        "stage": s,
        "items": [
            {
                "id": str(c.id),
                "email": c.email,
                "name": c.name,
                "company": c.company,
                "lead_stage": c.lead_stage,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in rows
        ],
    }


@router.get("/customers/{customer_id}/engagements")
def get_customer_engagements(
    customer_id: str,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
    limit: int = Query(default=50, ge=1, le=200),
):
    me = _ensure_staff(db, admin)
    require_any_capability(me, "sales", "marketing", "support")
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    rows = list_engagements(db, c.id, limit=limit)
    return {"items": [engagement_to_out(r) for r in rows]}


@router.post("/customers/{customer_id}/engagements")
def post_customer_engagement(
    customer_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_any_capability(me, "sales", "marketing", "support")
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    occurred_at = body.get("occurred_at")
    if isinstance(occurred_at, str):
        occurred_at = dt.datetime.fromisoformat(occurred_at.replace("Z", "+00:00"))
    else:
        occurred_at = None

    campaign_id = uuid.UUID(body["campaign_id"]) if body.get("campaign_id") else None
    campaign_recipient_id = (
        uuid.UUID(body["campaign_recipient_id"]) if body.get("campaign_recipient_id") else None
    )

    row = create_engagement(
        db,
        customer=c,
        channel=(body.get("channel") or "note")[:32],
        summary=(body.get("summary") or body.get("notes") or "Engagement")[:20_000],
        staff_id=me.id,
        notes=body.get("notes"),
        transcript=body.get("transcript"),
        outcome=(body.get("outcome") or "other")[:40],
        interest_tags=body.get("interest_tags") or [],
        offer_family=body.get("offer_family"),
        campaign_id=campaign_id,
        campaign_recipient_id=campaign_recipient_id,
        suggested_stage=body.get("suggested_stage") or body.get("apply_stage"),
        apply_stage=bool(body.get("apply_stage")) if "apply_stage" in body else None,
        occurred_at=occurred_at,
    )
    scores = recompute_fit_for_customer(db, c)
    db.commit()
    db.refresh(row)
    return {
        "engagement": engagement_to_out(row),
        "lead_stage": c.lead_stage,
        "fit_scores": scores,
    }


@router.post("/engagements/{engagement_id}/apply-stage")
def post_apply_stage(
    engagement_id: str,
    body: dict[str, Any] | None = None,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_any_capability(me, "sales", "marketing")
    body = body or {}
    try:
        row = apply_engagement_stage(
            db, uuid.UUID(engagement_id), stage=body.get("stage")
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    customer = db.get(Customer, row.customer_id)
    if customer:
        recompute_fit_for_customer(db, customer)
    db.commit()
    db.refresh(row)
    return {
        "engagement": engagement_to_out(row),
        "lead_stage": customer.lead_stage if customer else None,
    }


@router.get("/mailbox/connections")
def mailbox_list(
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_owner_tier(me)
    return {"items": list_connections(db)}


@router.post("/mailbox/connections")
def mailbox_upsert(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_owner_tier(me)
    provider = (body.get("provider") or "").strip().lower()
    email = (body.get("email_address") or "").strip().lower()
    if provider not in ("gmail", "microsoft"):
        raise HTTPException(status_code=400, detail="provider must be gmail or microsoft")
    if not email:
        raise HTTPException(status_code=400, detail="email_address required")
    row = upsert_connection(
        db,
        provider=provider,
        email_address=email,
        access_token=body.get("access_token"),
        refresh_token=body.get("refresh_token"),
        created_by=admin.email,
        status=(body.get("status") or "pending")[:24],
    )
    db.commit()
    return list_connections(db, connection_id=row.id)[0]


@router.post("/mailbox/sync")
async def mailbox_sync(
    body: dict[str, Any] | None = None,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_any_capability(me, "sales", "marketing")
    body = body or {}
    connection_id = body.get("connection_id")
    result = await sync_mailbox(
        db,
        connection_id=uuid.UUID(connection_id) if connection_id else None,
        limit=int(body.get("limit") or 25),
    )
    db.commit()
    return result


@router.post("/mailbox/sync/manual")
async def mailbox_sync_manual(
    body: dict[str, Any] | None = None,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    return await mailbox_sync(body=body, db=db, admin=admin)
