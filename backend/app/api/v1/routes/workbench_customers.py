from __future__ import annotations

import csv
import datetime as dt
import io
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from openpyxl import load_workbook
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.ai.briefing import generate_customer_briefing
from app.ai.jobs import enqueue_import_profile_enrichment
from app.ai.client import AiDisabledError, AiError, ai_is_ready, resolve_model
from app.ai.opportunities import customer_latest_opportunities
from app.auth import get_current_workbench_user
from app.customer_search import search_customers
from app.customer_utils import normalize_website, refresh_customer_search_document
from app.db import get_db
from app.models import (
    Campaign,
    CampaignRecipient,
    ContactSubmission,
    Customer,
    CustomerEngagement,
    Event,
    SaleConversion,
    Segment,
    SellSubmission,
)
from app.schemas import (
    AiStatusOut,
    CustomerBriefingOut,
    CustomerCreate,
    CustomerImportResult,
    CustomerListOut,
    CustomerOut,
    CustomerTimelineOut,
    CustomerUpdate,
    ImportRowError,
    OkOut,
    TimelineItem,
)
from app.settings import get_settings

router = APIRouter(prefix="/workbench/customers", dependencies=[Depends(get_current_workbench_user)])


def customer_to_out(c: Customer) -> CustomerOut:
    return CustomerOut(
        id=str(c.id),
        email=c.email,
        name=c.name,
        company=c.company,
        phone=c.phone,
        role=c.role,
        website=c.website,
        tags=list(c.tags or []),
        source=c.source,
        notes=c.notes,
        consent_marketing=c.consent_marketing,
        consent_source=c.consent_source,
        consent_at=c.consent_at,
        lead_stage=getattr(c, "lead_stage", None) or "new",
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


def _customer_to_out(c: Customer) -> CustomerOut:
    return customer_to_out(c)


@router.get("", response_model=CustomerListOut)
def list_customers(
    search: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    segment_id: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    segment_filter: dict[str, Any] | None = None
    if segment_id:
        seg = db.get(Segment, segment_id)
        if not seg:
            raise HTTPException(status_code=404, detail="Segment not found")
        segment_filter = dict(seg.filter_json or {})

    rows, total = search_customers(
        db,
        search,
        segment_filter_json=segment_filter,
        tag=tag,
        limit=limit,
        offset=offset,
    )
    items = [_customer_to_out(c) for c in rows]
    return CustomerListOut(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < total,
    )


@router.get("/ai/status", response_model=AiStatusOut)
def ai_status():
    s = get_settings()
    return AiStatusOut(
        enabled=bool(s.ai_enabled),
        configured=ai_is_ready(s),
        default_model=s.ai_model_default,
        briefing_model=resolve_model("briefing", s),
        sentiment_model=resolve_model("sentiment", s),
    )


@router.post("", response_model=CustomerOut)
def create_customer(body: CustomerCreate, db: Session = Depends(get_db)):
    email = str(body.email).strip().lower()
    if db.scalar(select(Customer).where(Customer.email == email)) is not None:
        raise HTTPException(status_code=400, detail="Customer with this email already exists")
    c = Customer(
        id=uuid.uuid4(),
        email=email,
        name=body.name,
        company=body.company,
        phone=body.phone,
        role=body.role,
        website=normalize_website(body.website),
        tags=body.tags or [],
        source=body.source,
        notes=body.notes,
        consent_marketing=body.consent_marketing,
        consent_source=body.consent_source,
        consent_at=dt.datetime.now(dt.timezone.utc) if body.consent_marketing else None,
        lead_stage=(body.lead_stage or "new")[:24],
    )
    refresh_customer_search_document(c)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _customer_to_out(c)


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: str, db: Session = Depends(get_db)):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return _customer_to_out(c)


@router.patch("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: str, body: CustomerUpdate, db: Session = Depends(get_db)):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    if body.email is not None:
        new_email = str(body.email).strip().lower()
        other = db.scalar(
            select(Customer).where(Customer.email == new_email, Customer.id != c.id)
        )
        if other is not None:
            raise HTTPException(status_code=400, detail="Email already in use")
        c.email = new_email
    for field in ("name", "company", "phone", "role", "source", "notes", "consent_source"):
        v = getattr(body, field)
        if v is not None:
            setattr(c, field, v)
    if body.lead_stage is not None:
        from app.ai.engagement import LEAD_STAGES, normalize_stage

        stage = normalize_stage(body.lead_stage)
        if stage not in LEAD_STAGES:
            raise HTTPException(status_code=400, detail="Invalid lead_stage")
        c.lead_stage = stage
    if body.website is not None:
        c.website = normalize_website(body.website)
    if body.tags is not None:
        c.tags = body.tags
    if body.consent_marketing is not None:
        previous = c.consent_marketing
        c.consent_marketing = body.consent_marketing
        if body.consent_marketing and not previous:
            c.consent_at = dt.datetime.now(dt.timezone.utc)
    refresh_customer_search_document(c)
    db.commit()
    db.refresh(c)
    return _customer_to_out(c)


@router.delete("/{customer_id}", response_model=OkOut)
def delete_customer(customer_id: str, db: Session = Depends(get_db)):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(c)
    db.commit()
    return OkOut()


@router.get("/{customer_id}/timeline", response_model=CustomerTimelineOut)
def customer_timeline(customer_id: str, db: Session = Depends(get_db)):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    items: list[TimelineItem] = []

    events = (
        db.execute(
            select(Event)
            .where(Event.customer_id == c.id)
            .order_by(Event.occurred_at.desc())
            .limit(200)
        )
        .scalars()
        .all()
    )
    for ev in events:
        items.append(
            TimelineItem(
                kind=f"event:{ev.type}",
                occurred_at=ev.occurred_at,
                label=ev.type,
                data={"url": ev.url, **(ev.payload or {})},
            )
        )

    recipients = (
        db.execute(
            select(CampaignRecipient, Campaign)
            .join(Campaign, Campaign.id == CampaignRecipient.campaign_id)
            .where(CampaignRecipient.email == c.email)
            .order_by(CampaignRecipient.created_at.desc())
            .limit(200)
        ).all()
    )
    for recip, camp in recipients:
        # Emit a single row per notable campaign interaction, newest interaction first.
        for label, when in [
            ("campaign:unsubscribed", recip.unsubscribed_at),
            ("campaign:complained", recip.complained_at),
            ("campaign:bounced", recip.bounced_at),
            ("campaign:clicked", recip.clicked_at),
            ("campaign:opened", recip.opened_at),
            ("campaign:delivered", recip.delivered_at),
            ("campaign:sent", recip.sent_at),
        ]:
            if when is not None:
                items.append(
                    TimelineItem(
                        kind=label,
                        occurred_at=when,
                        label=f"{camp.name} — {label.split(':', 1)[1]}",
                        data={"campaign_id": str(camp.id), "status": recip.status},
                    )
                )
                break
        else:
            items.append(
                TimelineItem(
                    kind="campaign:queued",
                    occurred_at=recip.created_at,
                    label=f"{camp.name} — queued",
                    data={"campaign_id": str(camp.id), "status": recip.status},
                )
            )

    items.sort(key=lambda x: x.occurred_at, reverse=True)

    # Contact / sell submissions matched by email (include AI sentiment when present)
    contacts = (
        db.execute(
            select(ContactSubmission)
            .where(ContactSubmission.email == c.email)
            .order_by(ContactSubmission.created_at.desc())
            .limit(50)
        )
        .scalars()
        .all()
    )
    for row in contacts:
        data: dict = {"subject": row.subject, "message": row.message}
        if row.ai_sentiment:
            data.update(
                {
                    "ai_sentiment": row.ai_sentiment,
                    "ai_intent": row.ai_intent,
                    "ai_urgency": row.ai_urgency,
                    "ai_summary": row.ai_summary,
                }
            )
        items.append(
            TimelineItem(
                kind="form:contact",
                occurred_at=row.created_at,
                label=f"Contact — {row.subject}",
                data=data,
            )
        )

    sells = (
        db.execute(
            select(SellSubmission)
            .where(SellSubmission.email == c.email)
            .order_by(SellSubmission.created_at.desc())
            .limit(50)
        )
        .scalars()
        .all()
    )
    for row in sells:
        data = {"part_details": row.part_details, "message": row.message, "company": row.company}
        if row.ai_sentiment:
            data.update(
                {
                    "ai_sentiment": row.ai_sentiment,
                    "ai_intent": row.ai_intent,
                    "ai_urgency": row.ai_urgency,
                    "ai_summary": row.ai_summary,
                }
            )
        items.append(
            TimelineItem(
                kind="form:sell",
                occurred_at=row.created_at,
                label="Sell inquiry",
                data=data,
            )
        )

    engagements = (
        db.execute(
            select(CustomerEngagement)
            .where(CustomerEngagement.customer_id == c.id)
            .order_by(CustomerEngagement.occurred_at.desc())
            .limit(100)
        )
        .scalars()
        .all()
    )
    for eng in engagements:
        items.append(
            TimelineItem(
                kind=f"engagement:{eng.channel}",
                occurred_at=eng.occurred_at,
                label=f"{eng.channel} — {eng.outcome}",
                data={
                    "id": str(eng.id),
                    "summary": eng.summary,
                    "outcome": eng.outcome,
                    "offer_family": eng.offer_family,
                    "ai_summary": eng.ai_summary,
                    "suggested_stage": eng.suggested_stage,
                    "applied_stage": eng.applied_stage,
                    "campaign_id": str(eng.campaign_id) if eng.campaign_id else None,
                    "staff_id": str(eng.staff_id) if eng.staff_id else None,
                },
            )
        )

    conversions = (
        db.execute(
            select(SaleConversion)
            .where(SaleConversion.customer_id == c.id)
            .order_by(SaleConversion.closed_at.desc())
            .limit(50)
        )
        .scalars()
        .all()
    )
    for conv in conversions:
        items.append(
            TimelineItem(
                kind=f"sale:{conv.status}",
                occurred_at=conv.closed_at,
                label=f"Sale {conv.status} — ${conv.amount_cents / 100:.2f}",
                data={
                    "id": str(conv.id),
                    "amount_cents": conv.amount_cents,
                    "source_type": conv.source_type,
                    "source_id": str(conv.source_id) if conv.source_id else None,
                    "closer_staff_id": str(conv.closer_staff_id) if conv.closer_staff_id else None,
                    "lead_owner_staff_id": str(conv.lead_owner_staff_id)
                    if conv.lead_owner_staff_id
                    else None,
                    "notes": conv.notes,
                },
            )
        )

    items.sort(key=lambda x: x.occurred_at, reverse=True)
    return CustomerTimelineOut(customer=_customer_to_out(c), items=items[:500])


@router.get("/{customer_id}/opportunities")
def customer_opportunities(customer_id: str, db: Session = Depends(get_db)):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    from app.ai.fit_scores import customer_fit_scores_out

    return {
        "opportunities": customer_latest_opportunities(db, c.id),
        "fit_scores": customer_fit_scores_out(db, c.id),
    }


@router.get("/{customer_id}/evidence")
def customer_evidence_list(
    customer_id: str,
    db: Session = Depends(get_db),
    status: str | None = Query(default=None),
):
    from app.ai.evidence import evidence_to_out, list_evidence

    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    rows = list_evidence(db, c.id, status=status, limit=80)
    return {"items": [evidence_to_out(r) for r in rows]}


@router.post("/{customer_id}/evidence/{evidence_id}/resolve")
def customer_evidence_resolve(
    customer_id: str,
    evidence_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin=Depends(get_current_workbench_user),
):
    from app.ai.evidence import evidence_to_out, resolve_evidence

    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    action = (body.get("action") or "").strip()
    try:
        row = resolve_evidence(
            db,
            uuid.UUID(evidence_id),
            action=action,
            resolved_by=getattr(admin, "email", None),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if str(row.customer_id) != str(c.id):
        raise HTTPException(status_code=404, detail="Evidence not found for customer")
    return evidence_to_out(row)


@router.get("/{customer_id}/agent/tasks")
def customer_agent_tasks(customer_id: str, db: Session = Depends(get_db)):
    from app.ai.agent_queue import list_tasks_for_subject, task_to_out

    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    rows = list_tasks_for_subject(db, "customer", c.id)
    return [task_to_out(t) for t in rows]


@router.post("/{customer_id}/agent/research")
def customer_enqueue_research(
    customer_id: str,
    body: dict[str, Any] | None = None,
    db: Session = Depends(get_db),
    admin=Depends(get_current_workbench_user),
):
    from app.ai.agent_queue import enqueue_task, task_to_out

    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    body = body or {}
    task = enqueue_task(
        db,
        kind="research",
        subject_type="customer",
        subject_id=c.id,
        reason=(body.get("reason") or "Customer research from Workbench")[:2000],
        created_by=getattr(admin, "email", None),
    )
    return task_to_out(task)


@router.get("/{customer_id}/briefing", response_model=CustomerBriefingOut)
async def get_customer_briefing(customer_id: str, db: Session = Depends(get_db)):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    try:
        return await generate_customer_briefing(db, c, force=False)
    except AiDisabledError as exc:
        return CustomerBriefingOut(
            customer_id=str(c.id),
            content="",
            model="",
            timeline_hash="",
            generated_at=dt.datetime.now(dt.timezone.utc),
            cached=False,
            disabled=True,
            message=str(exc),
        )
    except AiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/{customer_id}/briefing/regenerate", response_model=CustomerBriefingOut)
async def regenerate_customer_briefing(customer_id: str, db: Session = Depends(get_db)):
    c = db.get(Customer, customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    try:
        return await generate_customer_briefing(db, c, force=True)
    except AiDisabledError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


# --------------------------------------------------------------------------
# Import
# --------------------------------------------------------------------------


EXPECTED_HEADERS = (
    "email",
    "name",
    "company",
    "phone",
    "role",
    "website",
    "tags",
    "source",
    "notes",
    "consent_marketing",
)


def _normalize_header(h: str | None) -> str:
    if h is None:
        return ""
    return h.strip().lower().replace(" ", "_")


def _parse_csv(raw: bytes) -> list[dict[str, str]]:
    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV has no header row")
    fieldmap = {_normalize_header(f): f for f in reader.fieldnames if f}
    out: list[dict[str, str]] = []
    for line in reader:
        row: dict[str, str] = {}
        for key in EXPECTED_HEADERS:
            src = fieldmap.get(key)
            row[key] = (line.get(src, "") if src else "") or ""
        out.append(row)
    return out


def _parse_xlsx(raw: bytes) -> list[dict[str, str]]:
    wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration:
        raise HTTPException(status_code=400, detail="Excel file is empty")
    headers = [_normalize_header(str(c) if c is not None else "") for c in header_row]
    idx = {h: i for i, h in enumerate(headers) if h}

    def cell(r: tuple[Any, ...], key: str) -> str:
        i = idx.get(key)
        if i is None or i >= len(r):
            return ""
        v = r[i]
        if v is None:
            return ""
        return str(v).strip()

    out: list[dict[str, str]] = []
    for r in rows_iter:
        if all((cell(r, k) == "" for k in EXPECTED_HEADERS)):
            continue
        out.append({k: cell(r, k) for k in EXPECTED_HEADERS})
    return out


def _parse_tags(raw: str) -> list[str]:
    if not raw:
        return []
    return [t.strip() for t in raw.split(",") if t.strip()]


def _parse_bool(raw: str) -> bool:
    return raw.strip().lower() in ("1", "true", "yes", "y", "t")


@router.post("/import", response_model=CustomerImportResult)
async def import_customers(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    dry_run: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    raw = await file.read()
    name = (file.filename or "").lower()
    if name.endswith(".csv"):
        try:
            rows = _parse_csv(raw)
        except UnicodeDecodeError as e:
            raise HTTPException(status_code=400, detail=f"CSV must be UTF-8: {e}") from e
    elif name.endswith(".xlsx"):
        rows = _parse_xlsx(raw)
    else:
        raise HTTPException(status_code=400, detail="Upload a .csv or .xlsx file")

    result = CustomerImportResult()
    now = dt.datetime.now(dt.timezone.utc)
    enriched_ids: list[uuid.UUID] = []
    for i, row in enumerate(rows, start=2):
        email_raw = (row.get("email") or "").strip().lower()
        if not email_raw or "@" not in email_raw:
            result.errors.append(ImportRowError(row=i, message="valid email is required"))
            continue
        tags = _parse_tags(row.get("tags") or "")
        consent = _parse_bool(row.get("consent_marketing") or "")

        existing = db.scalar(select(Customer).where(Customer.email == email_raw))
        if dry_run:
            if existing:
                result.updated += 1
            else:
                result.created += 1
            continue

        if existing:
            existing.name = (row.get("name") or "").strip() or existing.name
            existing.company = (row.get("company") or "").strip() or existing.company
            existing.phone = (row.get("phone") or "").strip() or existing.phone
            existing.role = (row.get("role") or "").strip() or existing.role
            existing.website = normalize_website((row.get("website") or "").strip()) or existing.website
            existing.source = (row.get("source") or "").strip() or existing.source
            existing.notes = (row.get("notes") or "").strip() or existing.notes
            if tags:
                existing.tags = sorted(set((existing.tags or []) + tags))
            if consent and not existing.consent_marketing:
                existing.consent_marketing = True
                existing.consent_source = "import"
                existing.consent_at = now
            refresh_customer_search_document(existing)
            db.commit()
            result.updated += 1
            enriched_ids.append(existing.id)
        else:
            c = Customer(
                id=uuid.uuid4(),
                email=email_raw,
                name=(row.get("name") or "").strip() or None,
                company=(row.get("company") or "").strip() or None,
                phone=(row.get("phone") or "").strip() or None,
                role=(row.get("role") or "").strip() or None,
                website=normalize_website((row.get("website") or "").strip()),
                tags=tags,
                source=(row.get("source") or "import").strip() or "import",
                notes=(row.get("notes") or "").strip() or None,
                consent_marketing=consent,
                consent_source="import" if consent else None,
                consent_at=now if consent else None,
            )
            refresh_customer_search_document(c)
            db.add(c)
            db.commit()
            result.created += 1
            enriched_ids.append(c.id)

    if not dry_run and enriched_ids:
        enqueue_import_profile_enrichment(background_tasks, enriched_ids)

    return result
