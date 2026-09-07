from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.client import AiDisabledError, AiError, ai_is_ready, chat_completion, resolve_model
from app.auth import WorkbenchUser, get_current_workbench_user
from app.db import get_db
from app.models import WorkbenchFeedback, WorkbenchStaff
from app.schemas import HelpAskIn, HelpAskOut, HelpFeedbackIn, HelpFeedbackOut, HelpGuideLinkOut
from app.settings import get_settings
from app.staff_permissions import (
    CAPABILITIES,
    is_owner_tier,
    require_owner_or_ops_lead,
    sync_legacy_role,
)
from app.workbench_help import catalog_prompt, fallback_answer, match_guides

router = APIRouter(
    prefix="/workbench/help",
    tags=["workbench-help"],
    dependencies=[Depends(get_current_workbench_user)],
)


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
        active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _feedback_out(row: WorkbenchFeedback, *, include_confirm: bool = False) -> HelpFeedbackOut:
    return HelpFeedbackOut(
        id=str(row.id),
        staff_email=row.staff_email,
        message=row.message,
        page_path=row.page_path,
        created_at=row.created_at,
        read_at=row.read_at,
        confirm="Your feedback has been sent to the Admin." if include_confirm else "",
    )


@router.post("/ask", response_model=HelpAskOut)
async def help_ask(
    body: HelpAskIn,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    _ensure_staff(db, admin)
    guides = match_guides(body.message)
    guide_models = [HelpGuideLinkOut(title=g["title"], href=g["href"]) for g in guides]
    if not ai_is_ready():
        return HelpAskOut(answer=fallback_answer(body.message, guides), guides=guide_models, ai=False)
    try:
        model = resolve_model("default")
        raw = await chat_completion(
            messages=[
                {"role": "system", "content": catalog_prompt()},
                {"role": "user", "content": body.message.strip()},
            ],
            model=model,
            temperature=0.2,
            max_tokens=500,
        )
    except (AiDisabledError, AiError):
        return HelpAskOut(answer=fallback_answer(body.message, guides), guides=guide_models, ai=False)
    return HelpAskOut(answer=raw, guides=guide_models, ai=True)


@router.post("/feedback", response_model=HelpFeedbackOut)
def help_feedback_create(
    body: HelpFeedbackIn,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    _ensure_staff(db, admin)
    row = WorkbenchFeedback(
        id=uuid.uuid4(),
        staff_email=admin.email,
        message=body.message.strip(),
        page_path=(body.page_path or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _feedback_out(row, include_confirm=True)


@router.get("/feedback", response_model=list[HelpFeedbackOut])
def help_feedback_list(
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_owner_or_ops_lead(me)
    rows = db.execute(
        select(WorkbenchFeedback).order_by(WorkbenchFeedback.created_at.desc())
    ).scalars().all()
    return [_feedback_out(r) for r in rows]


@router.patch("/feedback/{feedback_id}/read", response_model=HelpFeedbackOut)
def help_feedback_mark_read(
    feedback_id: str,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_owner_or_ops_lead(me)
    try:
        fid = uuid.UUID(feedback_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Feedback not found")
    row = db.get(WorkbenchFeedback, fid)
    if not row:
        raise HTTPException(status_code=404, detail="Feedback not found")
    if row.read_at is None:
        row.read_at = dt.datetime.now(dt.timezone.utc)
        db.commit()
        db.refresh(row)
    return _feedback_out(row)
