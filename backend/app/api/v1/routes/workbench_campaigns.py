from __future__ import annotations

import asyncio
import datetime as dt
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import WorkbenchUser, get_current_workbench_user
from app.customer_utils import customer_template_variables, manual_recipient_variables
from app.db import get_db
from app.email import send_campaign_email
from app.models import (
    Campaign,
    CampaignRecipient,
    Customer,
    EmailTemplate,
    Segment,
)
from app.schemas import (
    CampaignCreate,
    CampaignOut,
    CampaignRecipientOut,
    CampaignSendOut,
    CampaignUpdate,
    OkOut,
    TemplatePreviewIn,
    TemplatePreviewOut,
)
from app.segments import segment_count, segment_customers
from app.suppression import is_suppressed
from app.templating import template_to_text_html

router = APIRouter(prefix="/workbench/campaigns", dependencies=[Depends(get_current_workbench_user)])


SEND_BATCH_SIZE = 25
SEND_BATCH_PAUSE_SECONDS = 1.0


def _campaign_to_out(c: Campaign) -> CampaignOut:
    return CampaignOut(
        id=str(c.id),
        name=c.name,
        template_id=str(c.template_id),
        segment_id=str(c.segment_id) if c.segment_id else None,
        status=c.status,
        scheduled_at=c.scheduled_at,
        sent_at=c.sent_at,
        stats_json=dict(c.stats_json or {}),
        created_by=c.created_by,
        created_at=c.created_at,
    )


def _recipient_to_out(r: CampaignRecipient) -> CampaignRecipientOut:
    return CampaignRecipientOut(
        id=str(r.id),
        email=r.email,
        customer_id=str(r.customer_id) if r.customer_id else None,
        status=r.status,
        resend_message_id=r.resend_message_id,
        error=r.error,
        sent_at=r.sent_at,
        delivered_at=r.delivered_at,
        opened_at=r.opened_at,
        clicked_at=r.clicked_at,
        bounced_at=r.bounced_at,
        complained_at=r.complained_at,
        unsubscribed_at=r.unsubscribed_at,
    )


@router.get("", response_model=list[CampaignOut])
def list_campaigns(db: Session = Depends(get_db)):
    rows = (
        db.execute(select(Campaign).order_by(Campaign.created_at.desc())).scalars().all()
    )
    return [_campaign_to_out(c) for c in rows]


@router.post("", response_model=CampaignOut)
def create_campaign(
    body: CampaignCreate,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    tpl = db.get(EmailTemplate, body.template_id)
    if not tpl:
        raise HTTPException(status_code=400, detail="Template not found")
    if body.segment_id:
        seg = db.get(Segment, body.segment_id)
        if not seg:
            raise HTTPException(status_code=400, detail="Segment not found")
    c = Campaign(
        id=uuid.uuid4(),
        name=body.name.strip(),
        template_id=uuid.UUID(body.template_id),
        segment_id=uuid.UUID(body.segment_id) if body.segment_id else None,
        status="draft",
        scheduled_at=body.scheduled_at,
        stats_json={},
        created_by=admin.email,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _campaign_to_out(c)


@router.get("/{campaign_id}", response_model=CampaignOut)
def get_campaign(campaign_id: str, db: Session = Depends(get_db)):
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return _campaign_to_out(c)


@router.patch("/{campaign_id}", response_model=CampaignOut)
def update_campaign(
    campaign_id: str, body: CampaignUpdate, db: Session = Depends(get_db)
):
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.status not in ("draft", "scheduled"):
        raise HTTPException(
            status_code=400, detail="Campaign cannot be edited once sending/sent"
        )
    if body.name is not None:
        c.name = body.name.strip()
    if body.template_id is not None:
        tpl = db.get(EmailTemplate, body.template_id)
        if not tpl:
            raise HTTPException(status_code=400, detail="Template not found")
        c.template_id = uuid.UUID(body.template_id)
    if body.segment_id is not None:
        if body.segment_id == "":
            c.segment_id = None
        else:
            seg = db.get(Segment, body.segment_id)
            if not seg:
                raise HTTPException(status_code=400, detail="Segment not found")
            c.segment_id = uuid.UUID(body.segment_id)
    if body.scheduled_at is not None:
        c.scheduled_at = body.scheduled_at
    if body.status is not None and body.status in ("draft", "scheduled"):
        c.status = body.status
    db.commit()
    db.refresh(c)
    return _campaign_to_out(c)


@router.delete("/{campaign_id}", response_model=OkOut)
def delete_campaign(campaign_id: str, db: Session = Depends(get_db)):
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.status in ("sending",):
        raise HTTPException(status_code=400, detail="Campaign is currently sending")
    db.delete(c)
    db.commit()
    return OkOut()


@router.post("/{campaign_id}/preview", response_model=TemplatePreviewOut)
def preview_campaign(
    campaign_id: str,
    body: TemplatePreviewIn,
    db: Session = Depends(get_db),
):
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    tpl = db.get(EmailTemplate, c.template_id)
    if not tpl:
        raise HTTPException(status_code=400, detail="Template missing")
    sample = body.sample or {
        "name": "Jane Doe",
        "company": "St. Mary's Radiology",
        "email": "jane@example.com",
    }
    subject, html_out, text_out = template_to_text_html(
        tpl.subject, tpl.body_md, tpl.body_html, sample
    )
    return TemplatePreviewOut(subject=subject, html=html_out, text=text_out)


@router.get("/{campaign_id}/recipients", response_model=list[CampaignRecipientOut])
def list_campaign_recipients(
    campaign_id: str,
    db: Session = Depends(get_db),
):
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    rows = (
        db.execute(
            select(CampaignRecipient)
            .where(CampaignRecipient.campaign_id == c.id)
            .order_by(CampaignRecipient.created_at.asc())
            .limit(1000)
        )
        .scalars()
        .all()
    )
    return [_recipient_to_out(r) for r in rows]


@router.post("/{campaign_id}/send", response_model=CampaignSendOut)
async def send_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
):
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.status not in ("draft", "scheduled"):
        raise HTTPException(status_code=400, detail=f"Campaign is already {c.status}")
    tpl = db.get(EmailTemplate, c.template_id)
    if not tpl:
        raise HTTPException(status_code=400, detail="Template missing")

    if c.segment_id:
        seg = db.get(Segment, c.segment_id)
        if not seg:
            raise HTTPException(status_code=400, detail="Segment missing")
        audience = segment_customers(db, seg.filter_json, limit=None)
        audience_total = segment_count(db, seg.filter_json)
    else:
        audience = list(db.execute(select(Customer)).scalars().all())
        audience_total = len(audience)

    c.status = "sending"
    c.stats_json = {
        **(c.stats_json or {}),
        "audience_total": audience_total,
        "started_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    db.commit()

    queued = 0
    skipped = 0
    errors: list[str] = []

    seen_emails: set[str] = set()
    for cust in audience:
        email = (cust.email or "").strip().lower()
        if not email or email in seen_emails:
            continue
        seen_emails.add(email)
        if is_suppressed(db, email):
            skipped += 1
            continue
        existing = db.scalar(
            select(CampaignRecipient).where(
                CampaignRecipient.campaign_id == c.id,
                CampaignRecipient.email == email,
            )
        )
        if existing:
            continue
        r = CampaignRecipient(
            id=uuid.uuid4(),
            campaign_id=c.id,
            customer_id=cust.id,
            email=email,
            status="queued",
        )
        db.add(r)
        queued += 1
    db.commit()

    tags = [{"name": "campaign_id", "value": str(c.id)}]
    pending = list(
        db.execute(
            select(CampaignRecipient).where(
                CampaignRecipient.campaign_id == c.id,
                CampaignRecipient.status == "queued",
            )
        )
        .scalars()
        .all()
    )

    sent_count = 0
    failed_count = 0
    now = dt.datetime.now(dt.timezone.utc)
    for i, r in enumerate(pending):
        try:
            variables = (
                customer_template_variables(r.customer)
                if r.customer
                else manual_recipient_variables(r.email)
            )
            subject, html_out, text_out = template_to_text_html(
                tpl.subject, tpl.body_md, tpl.body_html, variables
            )
            ok, msg_id = await send_campaign_email(
                r.email,
                subject,
                text_out,
                html=html_out,
                campaign_id=str(c.id),
                tags=tags,
            )
            if ok:
                r.status = "sent"
                r.sent_at = now
                r.resend_message_id = msg_id
                sent_count += 1
            else:
                r.status = "failed"
                r.error = "send failed"
                failed_count += 1
                errors.append(f"{r.email}: send failed")
        except Exception as exc:
            db.rollback()
            r = db.get(CampaignRecipient, r.id)
            if r is not None:
                r.status = "failed"
                r.error = f"{type(exc).__name__}: {exc}"[:500]
            failed_count += 1
            errors.append(f"{r.email if r else '?'}: {type(exc).__name__}")
        try:
            db.commit()
        except Exception:
            db.rollback()
        if (i + 1) % SEND_BATCH_SIZE == 0 and i + 1 < len(pending):
            await asyncio.sleep(SEND_BATCH_PAUSE_SECONDS)

    c.status = "sent" if failed_count == 0 else "sent_with_errors"
    c.sent_at = dt.datetime.now(dt.timezone.utc)
    c.stats_json = {
        **(c.stats_json or {}),
        "queued": queued,
        "skipped_suppressed": skipped,
        "sent": sent_count,
        "failed": failed_count,
        "audience_total": audience_total,
        "finished_at": c.sent_at.isoformat(),
    }
    db.commit()

    return CampaignSendOut(
        campaign_id=str(c.id),
        queued=queued,
        skipped_suppressed=skipped,
        errors=errors[:50],
    )
