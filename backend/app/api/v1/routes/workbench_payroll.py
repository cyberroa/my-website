from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import WorkbenchUser, get_current_workbench_user
from app.db import get_db
from app.models import (
    WorkbenchStaff,
    Customer,
    EarningsLedger,
    Event,
    PayPolicy,
    SaleConversion,
    ServiceJob,
    StaffPayAssignment,
    SupportActivity,
    TimeEntry,
)
from app.payroll import (
    SERVICE_JOB_TYPES,
    get_active_assignment,
    record_adhoc_earning,
    record_conversion_earnings,
    record_service_job_earnings,
    record_time_entry_earnings,
    void_adhoc_earning,
    void_conversion_earnings,
    void_service_job_earnings,
)
from app.settings import get_settings
from app.staff_permissions import (
    CAP_LABELS,
    CAPABILITIES,
    STAFF_TIERS,
    TIER_LABELS,
    default_landing_href,
    effective_capabilities,
    is_owner_tier,
    normalize_capabilities,
    normalize_tier,
    require_accounting,
    require_any_capability,
    require_owner_tier,
    sync_legacy_role,
)

router = APIRouter(prefix="/workbench", dependencies=[Depends(get_current_workbench_user)])


def _staff_out(s: WorkbenchStaff) -> dict:
    tier = normalize_tier(getattr(s, "staff_tier", None), legacy_role=s.role)
    caps = normalize_capabilities(getattr(s, "capabilities", None) or [])
    eff = sorted(effective_capabilities(s))
    return {
        "id": str(s.id),
        "email": s.email,
        "display_name": s.display_name,
        "role": s.role,
        "staff_tier": tier,
        "staff_tier_label": TIER_LABELS.get(tier, tier),
        "capabilities": caps,
        "effective_capabilities": eff,
        "active": s.active,
        "phone": s.phone,
        "title": s.title,
        "notes": s.notes,
        "created_at": s.created_at.isoformat(),
    }


def _ensure_staff(db: Session, admin: WorkbenchUser) -> WorkbenchStaff:
    row = db.scalar(select(WorkbenchStaff).where(WorkbenchStaff.email == admin.email))
    if row:
        # Sync owner emails → owner tier if configured
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


def _apply_staff_fields(s: WorkbenchStaff, body: dict[str, Any]) -> None:
    if "display_name" in body and body["display_name"] is not None:
        s.display_name = str(body["display_name"])[:200]
    if "active" in body and body["active"] is not None:
        s.active = bool(body["active"])
    if "phone" in body:
        s.phone = body["phone"]
    if "title" in body:
        s.title = body["title"]
    if "notes" in body:
        s.notes = body["notes"]
    raw_tier = body.get("staff_tier") or body.get("workbench_tier")
    if raw_tier is not None:
        tier = normalize_tier(str(raw_tier))
        if tier not in STAFF_TIERS:
            raise HTTPException(status_code=400, detail="invalid staff_tier")
        s.staff_tier = tier
    if "capabilities" in body:
        s.capabilities = normalize_capabilities(body["capabilities"])
    # Owner / ops lead: clear explicit caps (implied by tier)
    if s.staff_tier == "owner":
        s.capabilities = sorted(CAPABILITIES)
    elif s.staff_tier == "admin":
        s.capabilities = []
    sync_legacy_role(s)


# --- Staff ---


@router.get("/staff/me")
def staff_me(db: Session = Depends(get_db), admin: WorkbenchUser = Depends(get_current_workbench_user)):
    s = _ensure_staff(db, admin)
    assignment = get_active_assignment(db, s.id)
    pending = db.scalar(
        select(StaffPayAssignment)
        .where(
            StaffPayAssignment.staff_id == s.id,
            StaffPayAssignment.status == "pending_acceptance",
        )
        .order_by(StaffPayAssignment.assigned_at.desc())
    )
    policy = None
    if pending or assignment:
        pid = (pending or assignment).policy_id
        p = db.get(PayPolicy, pid)
        if p:
            policy = {
                "id": str(p.id),
                "name": p.name,
                "version": p.version,
                "commission_rate_bps": p.commission_rate_bps,
                "hourly_rate_cents": p.hourly_rate_cents,
                "terms_markdown": p.terms_markdown,
            }
    return {
        "staff": _staff_out(s),
        "staff_tier": normalize_tier(s.staff_tier, legacy_role=s.role),
        "capabilities": normalize_capabilities(s.capabilities or []),
        "effective_capabilities": sorted(effective_capabilities(s)),
        "default_landing": default_landing_href(s),
        "tier_labels": TIER_LABELS,
        "capability_labels": CAP_LABELS,
        "active_assignment": {
            "id": str(assignment.id),
            "accepted_at": assignment.accepted_at.isoformat() if assignment and assignment.accepted_at else None,
            "status": assignment.status if assignment else None,
        }
        if assignment
        else None,
        "pending_assignment": {
            "id": str(pending.id),
            "status": pending.status,
            "policy": policy,
        }
        if pending
        else None,
    }


@router.get("/staff/roles")
def list_role_options():
    return {
        "tiers": [{"id": t, "label": TIER_LABELS[t]} for t in ("owner", "admin", "staff")],
        "capabilities": [{"id": c, "label": CAP_LABELS[c]} for c in sorted(CAPABILITIES)],
    }


@router.get("/staff")
def list_staff(db: Session = Depends(get_db), admin: WorkbenchUser = Depends(get_current_workbench_user)):
    _ensure_staff(db, admin)
    rows = db.execute(select(WorkbenchStaff).order_by(WorkbenchStaff.email.asc())).scalars().all()
    return [_staff_out(s) for s in rows]


@router.post("/staff")
def create_staff(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_owner_tier(me)
    email = (body.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email required")
    if db.scalar(select(WorkbenchStaff).where(WorkbenchStaff.email == email)):
        raise HTTPException(status_code=400, detail="Staff already exists")
    tier = normalize_tier(body.get("staff_tier") or body.get("workbench_tier") or body.get("role") or "staff")
    s = WorkbenchStaff(
        id=uuid.uuid4(),
        email=email,
        display_name=(body.get("display_name") or email.split("@")[0])[:200],
        role="admin",
        staff_tier=tier,
        capabilities=normalize_capabilities(body.get("capabilities") or []),
        active=True,
        phone=body.get("phone"),
        title=body.get("title"),
    )
    if s.staff_tier == "owner":
        s.capabilities = sorted(CAPABILITIES)
    elif s.staff_tier == "admin":
        s.capabilities = []
    sync_legacy_role(s)
    db.add(s)
    db.commit()
    db.refresh(s)
    return _staff_out(s)


@router.patch("/staff/{staff_id}")
def update_staff(
    staff_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_owner_tier(me)
    s = db.get(WorkbenchStaff, staff_id)
    if not s:
        raise HTTPException(status_code=404, detail="Staff not found")
    _apply_staff_fields(s, body)
    db.commit()
    db.refresh(s)
    return _staff_out(s)


# --- Pay policies ---


@router.get("/pay-policies")
def list_policies(db: Session = Depends(get_db)):
    rows = db.execute(select(PayPolicy).order_by(PayPolicy.created_at.desc())).scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "version": p.version,
            "active": p.active,
            "is_default": p.is_default,
            "commission_rate_bps": p.commission_rate_bps,
            "commission_applies_to": p.commission_applies_to,
            "hourly_rate_cents": p.hourly_rate_cents,
            "currency": p.currency,
            "terms_markdown": p.terms_markdown,
        }
        for p in rows
    ]


@router.post("/pay-policies")
def create_policy(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_owner_tier(me)
    p = PayPolicy(
        id=uuid.uuid4(),
        name=(body.get("name") or "Default Package")[:200],
        version=1,
        active=True,
        is_default=bool(body.get("is_default")),
        commission_rate_bps=int(body.get("commission_rate_bps") or 500),
        commission_applies_to=(body.get("commission_applies_to") or "closer")[:24],
        hourly_rate_cents=int(body.get("hourly_rate_cents") or 0),
        currency=(body.get("currency") or "USD")[:3],
        terms_markdown=(body.get("terms_markdown") or "")[:20_000],
    )
    if p.is_default:
        for row in db.execute(select(PayPolicy).where(PayPolicy.is_default.is_(True))).scalars():
            row.is_default = False
    db.add(p)
    db.commit()
    return {"id": str(p.id)}


@router.post("/staff/{staff_id}/pay-assignment")
def assign_policy(
    staff_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_owner_tier(me)
    staff = db.get(WorkbenchStaff, staff_id)
    policy = db.get(PayPolicy, body.get("policy_id"))
    if not staff or not policy:
        raise HTTPException(status_code=404, detail="Staff or policy not found")

    for row in db.execute(
        select(StaffPayAssignment).where(
            StaffPayAssignment.staff_id == staff.id,
            StaffPayAssignment.status.in_(("active", "pending_acceptance")),
        )
    ).scalars():
        row.status = "revoked"

    a = StaffPayAssignment(
        id=uuid.uuid4(),
        staff_id=staff.id,
        policy_id=policy.id,
        policy_version=policy.version,
        assigned_by=me.id,
        assigned_at=dt.datetime.now(dt.timezone.utc),
        status="pending_acceptance",
    )
    db.add(a)
    db.commit()
    return {"id": str(a.id), "status": a.status}


@router.post("/staff/me/pay-assignment/accept")
def accept_assignment(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    aid = body.get("assignment_id")
    a = db.get(StaffPayAssignment, aid)
    if not a or a.staff_id != me.id:
        raise HTTPException(status_code=404, detail="Assignment not found")
    now = dt.datetime.now(dt.timezone.utc)
    a.accepted_at = now
    a.status = "active"
    db.commit()
    return {"ok": True, "accepted_at": now.isoformat()}


# --- Sales conversions ---


@router.get("/sales/conversions")
def list_conversions(
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
    limit: int = Query(default=100, le=500),
):
    me = _ensure_staff(db, admin)
    require_any_capability(me, "sales")
    rows = (
        db.execute(select(SaleConversion).order_by(SaleConversion.closed_at.desc()).limit(limit))
        .scalars()
        .all()
    )
    out = []
    for c in rows:
        cust = db.get(Customer, c.customer_id)
        out.append(
            {
                "id": str(c.id),
                "customer_id": str(c.customer_id),
                "customer_email": cust.email if cust else None,
                "amount_cents": c.amount_cents,
                "currency": c.currency,
                "closed_at": c.closed_at.isoformat(),
                "status": c.status,
                "source_type": c.source_type,
                "source_id": str(c.source_id) if c.source_id else None,
                "lead_owner_staff_id": str(c.lead_owner_staff_id) if c.lead_owner_staff_id else None,
                "closer_staff_id": str(c.closer_staff_id) if c.closer_staff_id else None,
                "notes": c.notes,
            }
        )
    return out


@router.post("/sales/conversions")
def create_conversion(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_any_capability(me, "sales")
    cust = db.get(Customer, body.get("customer_id"))
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    closed_at = body.get("closed_at")
    if isinstance(closed_at, str):
        closed_at = dt.datetime.fromisoformat(closed_at.replace("Z", "+00:00"))
    else:
        closed_at = dt.datetime.now(dt.timezone.utc)

    conv = SaleConversion(
        id=uuid.uuid4(),
        customer_id=cust.id,
        source_type=(body.get("source_type") or None),
        source_id=uuid.UUID(body["source_id"]) if body.get("source_id") else None,
        amount_cents=int(body.get("amount_cents") or 0),
        currency=(body.get("currency") or "USD")[:3],
        closed_at=closed_at,
        status=(body.get("status") or "won")[:24],
        lead_owner_staff_id=uuid.UUID(body["lead_owner_staff_id"])
        if body.get("lead_owner_staff_id")
        else None,
        closer_staff_id=uuid.UUID(body["closer_staff_id"]) if body.get("closer_staff_id") else me.id,
        notes=body.get("notes"),
        created_by_staff_id=me.id,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    if conv.status == "won":
        record_conversion_earnings(db, conv)
    return {"id": str(conv.id)}


@router.post("/sales/conversions/{conversion_id}/void")
def void_conversion(
    conversion_id: str,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_owner_tier(me)
    c = db.get(SaleConversion, conversion_id)
    if not c:
        raise HTTPException(status_code=404, detail="Conversion not found")
    c.status = "void"
    void_conversion_earnings(db, c.id)
    db.commit()
    return {"ok": True}


# --- Time entries ---


@router.get("/time-entries")
def list_time_entries(
    db: Session = Depends(get_db),
    staff_id: str | None = None,
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    q = select(TimeEntry).order_by(TimeEntry.work_date.desc())
    if staff_id:
        q = q.where(TimeEntry.staff_id == uuid.UUID(staff_id))
    elif not is_owner_tier(me):
        q = q.where(TimeEntry.staff_id == me.id)
    rows = db.execute(q.limit(200)).scalars().all()
    return [
        {
            "id": str(r.id),
            "staff_id": str(r.staff_id),
            "work_date": r.work_date.isoformat(),
            "hours": float(r.hours),
            "category": r.category,
            "customer_id": str(r.customer_id) if r.customer_id else None,
            "notes": r.notes,
        }
        for r in rows
    ]


@router.post("/time-entries")
def create_time_entry(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    work_date = body.get("work_date") or dt.date.today().isoformat()
    if isinstance(work_date, str):
        work_date = dt.date.fromisoformat(work_date)
    entry = TimeEntry(
        id=uuid.uuid4(),
        staff_id=uuid.UUID(body["staff_id"]) if body.get("staff_id") else me.id,
        work_date=work_date,
        hours=float(body.get("hours") or 0),
        category=(body.get("category") or "other")[:40],
        customer_id=uuid.UUID(body["customer_id"]) if body.get("customer_id") else None,
        notes=body.get("notes"),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    record_time_entry_earnings(db, entry)
    return {"id": str(entry.id)}


# --- Support activity ---


@router.post("/support-activity")
def log_support(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    row = SupportActivity(
        id=uuid.uuid4(),
        staff_id=me.id,
        customer_id=uuid.UUID(body["customer_id"]) if body.get("customer_id") else None,
        summary=(body.get("summary") or "").strip(),
        occurred_at=dt.datetime.now(dt.timezone.utc),
    )
    if not row.summary:
        raise HTTPException(status_code=400, detail="summary required")
    db.add(row)
    db.commit()
    return {"id": str(row.id)}


# --- Service jobs (field tech site work) ---


def _service_job_out(job: ServiceJob, *, customer_email: str | None = None, staff_name: str | None = None) -> dict:
    return {
        "id": str(job.id),
        "staff_id": str(job.staff_id),
        "staff_name": staff_name,
        "customer_id": str(job.customer_id),
        "customer_email": customer_email,
        "job_type": job.job_type,
        "summary": job.summary,
        "hours": float(job.hours) if job.hours is not None else None,
        "amount_cents": job.amount_cents,
        "part_number": job.part_number,
        "site_notes": job.site_notes,
        "scheduled_at": job.scheduled_at.isoformat() if job.scheduled_at else None,
        "audit_report": job.audit_report,
        "follow_up_needed": bool(job.follow_up_needed),
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "status": job.status,
        "created_at": job.created_at.isoformat(),
    }


def _parse_dt(raw: str) -> dt.datetime:
    return dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))


def _log_audit_customer_event(db: Session, job: ServiceJob) -> None:
    if job.job_type != "audit" or job.status != "completed":
        return
    db.add(
        Event(
            id=uuid.uuid4(),
            customer_id=job.customer_id,
            type="service_audit_completed",
            payload={
                "service_job_id": str(job.id),
                "summary": job.summary,
                "audit_report": job.audit_report,
                "follow_up_needed": job.follow_up_needed,
                "part_number": job.part_number,
                "staff_id": str(job.staff_id),
            },
            occurred_at=job.completed_at or dt.datetime.now(dt.timezone.utc),
        )
    )


@router.get("/service-jobs/types")
def list_service_job_types():
    return {"types": sorted(SERVICE_JOB_TYPES)}


@router.get("/service-jobs")
def list_service_jobs(
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
    staff_id: str | None = None,
    customer_id: str | None = None,
    status: str | None = None,
    job_type: str | None = None,
    limit: int = Query(100, ge=1, le=500),
):
    me = _ensure_staff(db, admin)
    require_any_capability(me, "technician", "support")
    stmt = (
        select(ServiceJob, Customer, WorkbenchStaff)
        .join(Customer, ServiceJob.customer_id == Customer.id)
        .join(WorkbenchStaff, ServiceJob.staff_id == WorkbenchStaff.id)
        .order_by(func.coalesce(ServiceJob.completed_at, ServiceJob.scheduled_at).desc())
        .limit(limit)
    )
    if not is_owner_tier(me):
        stmt = stmt.where(ServiceJob.staff_id == me.id)
    elif staff_id:
        stmt = stmt.where(ServiceJob.staff_id == uuid.UUID(staff_id))
    if customer_id:
        stmt = stmt.where(ServiceJob.customer_id == uuid.UUID(customer_id))
    if status:
        stmt = stmt.where(ServiceJob.status == status)
    if job_type:
        stmt = stmt.where(ServiceJob.job_type == job_type)

    rows = db.execute(stmt).all()
    return [
        _service_job_out(job, customer_email=c.email, staff_name=s.display_name or s.email)
        for job, c, s in rows
    ]


@router.post("/service-jobs")
def create_service_job(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    """Log completed repair/service, or schedule a PET/CT audit (status=scheduled)."""
    me = _ensure_staff(db, admin)
    require_any_capability(me, "technician", "support")
    mode = (body.get("mode") or "complete").strip().lower()

    customer_raw = body.get("customer_id")
    if not customer_raw:
        raise HTTPException(status_code=400, detail="customer_id required")
    try:
        customer_id = uuid.UUID(str(customer_raw))
    except ValueError as e:
        raise HTTPException(status_code=400, detail="invalid customer_id") from e

    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    job_type = (body.get("job_type") or "repair").strip().lower()[:40]
    if job_type not in SERVICE_JOB_TYPES:
        raise HTTPException(status_code=400, detail=f"job_type must be one of: {', '.join(sorted(SERVICE_JOB_TYPES))}")

    if body.get("staff_id"):
        if not is_owner_tier(me):
            raise HTTPException(status_code=403, detail="Owner access required to assign staff")
        staff_id = uuid.UUID(str(body["staff_id"]))
    else:
        staff_id = me.id

    staff = db.get(WorkbenchStaff, staff_id)
    if not staff or not staff.active:
        raise HTTPException(status_code=404, detail="Staff not found")

    if mode == "schedule":
        if job_type != "audit":
            raise HTTPException(status_code=400, detail="Only audit jobs can be scheduled via mode=schedule")
        scheduled_raw = body.get("scheduled_at")
        if not scheduled_raw:
            raise HTTPException(status_code=400, detail="scheduled_at required")
        try:
            scheduled_at = _parse_dt(str(scheduled_raw))
        except ValueError as e:
            raise HTTPException(status_code=400, detail="invalid scheduled_at") from e

        summary = (body.get("summary") or "PET/CT audit scheduled").strip()[:4000]
        job = ServiceJob(
            id=uuid.uuid4(),
            staff_id=staff_id,
            customer_id=customer_id,
            job_type="audit",
            summary=summary,
            part_number=(body.get("part_number") or None),
            site_notes=(body.get("site_notes") or None),
            scheduled_at=scheduled_at,
            status="scheduled",
            completed_at=None,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return _service_job_out(job, customer_email=customer.email, staff_name=staff.display_name or staff.email)

    # --- complete (default) ---
    summary = (body.get("summary") or "").strip()
    if not summary:
        raise HTTPException(status_code=400, detail="summary required")

    audit_report = (body.get("audit_report") or "").strip() or None
    if job_type == "audit" and not audit_report:
        raise HTTPException(status_code=400, detail="audit_report required for completed audit jobs")

    hours = body.get("hours")
    hours_val = float(hours) if hours is not None and str(hours).strip() != "" else None

    amount_cents = body.get("amount_cents")
    amount_val = None
    if amount_cents is not None and str(amount_cents).strip() != "":
        try:
            amount_val = int(amount_cents)
        except (TypeError, ValueError) as e:
            raise HTTPException(status_code=400, detail="invalid amount_cents") from e
        if not is_owner_tier(me) and amount_val is not None:
            raise HTTPException(status_code=403, detail="Owner sets flat service pay amounts")

    completed_at = dt.datetime.now(dt.timezone.utc)
    if body.get("completed_at"):
        try:
            completed_at = _parse_dt(str(body["completed_at"]))
        except ValueError as e:
            raise HTTPException(status_code=400, detail="invalid completed_at") from e

    follow_up = bool(body.get("follow_up_needed", False))

    job = ServiceJob(
        id=uuid.uuid4(),
        staff_id=staff_id,
        customer_id=customer_id,
        job_type=job_type,
        summary=summary[:4000],
        hours=hours_val,
        amount_cents=amount_val,
        part_number=(body.get("part_number") or None),
        site_notes=(body.get("site_notes") or None),
        audit_report=audit_report[:20000] if audit_report else None,
        follow_up_needed=follow_up,
        completed_at=completed_at,
        status="completed",
    )
    db.add(job)
    _log_audit_customer_event(db, job)
    db.commit()
    db.refresh(job)

    ledger = record_service_job_earnings(db, job)
    out = _service_job_out(job, customer_email=customer.email, staff_name=staff.display_name or staff.email)
    out["ledger_id"] = str(ledger.id) if ledger else None
    out["earnings_cents"] = ledger.amount_cents if ledger else None
    return out


@router.post("/service-jobs/{job_id}/complete")
def complete_service_job(
    job_id: str,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    """Submit audit report (or finish a scheduled job) and mark completed."""
    me = _ensure_staff(db, admin)
    require_any_capability(me, "technician", "support")
    job = db.get(ServiceJob, uuid.UUID(job_id))
    if not job:
        raise HTTPException(status_code=404, detail="Service job not found")
    if job.status != "scheduled":
        raise HTTPException(status_code=400, detail="Job is not scheduled")
    if not is_owner_tier(me) and job.staff_id != me.id:
        raise HTTPException(status_code=403, detail="Not assigned to this job")

    customer = db.get(Customer, job.customer_id)
    staff = db.get(WorkbenchStaff, job.staff_id)

    summary = (body.get("summary") or job.summary or "").strip()
    if not summary:
        raise HTTPException(status_code=400, detail="summary required")

    audit_report = (body.get("audit_report") or "").strip()
    if job.job_type == "audit" and not audit_report:
        raise HTTPException(status_code=400, detail="audit_report required")

    hours = body.get("hours")
    if hours is not None and str(hours).strip() != "":
        job.hours = float(hours)
    if body.get("part_number"):
        job.part_number = str(body["part_number"])[:80]
    if body.get("site_notes"):
        job.site_notes = str(body["site_notes"])

    job.summary = summary[:4000]
    job.audit_report = audit_report[:20000] if audit_report else None
    job.follow_up_needed = bool(body.get("follow_up_needed", job.follow_up_needed))
    job.completed_at = dt.datetime.now(dt.timezone.utc)
    if body.get("completed_at"):
        try:
            job.completed_at = _parse_dt(str(body["completed_at"]))
        except ValueError as e:
            raise HTTPException(status_code=400, detail="invalid completed_at") from e
    job.status = "completed"

    _log_audit_customer_event(db, job)
    db.commit()
    db.refresh(job)

    ledger = record_service_job_earnings(db, job)
    out = _service_job_out(
        job,
        customer_email=customer.email if customer else None,
        staff_name=staff.display_name or staff.email if staff else None,
    )
    out["ledger_id"] = str(ledger.id) if ledger else None
    out["earnings_cents"] = ledger.amount_cents if ledger else None
    return out


@router.post("/service-jobs/{job_id}/void")
def void_service_job(
    job_id: str,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_owner_tier(me)
    job = db.get(ServiceJob, uuid.UUID(job_id))
    if not job:
        raise HTTPException(status_code=404, detail="Service job not found")
    job.status = "void"
    void_service_job_earnings(db, job.id)
    db.commit()
    return {"ok": True}


# --- Payroll summary ---


@router.get("/payroll/summary")
def payroll_summary(
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
    from_date: str | None = None,
    to_date: str | None = None,
):
    me = _ensure_staff(db, admin)
    require_accounting(me)

    start = dt.date.fromisoformat(from_date) if from_date else dt.date.today().replace(day=1)
    end = dt.date.fromisoformat(to_date) if to_date else dt.date.today()
    start_dt = dt.datetime.combine(start, dt.time.min, tzinfo=dt.timezone.utc)
    end_dt = dt.datetime.combine(end, dt.time.max, tzinfo=dt.timezone.utc)

    staff_rows = db.execute(select(WorkbenchStaff).where(WorkbenchStaff.active.is_(True))).scalars().all()
    summary = []
    for s in staff_rows:
        ledgers = (
            db.execute(
                select(EarningsLedger).where(
                    EarningsLedger.staff_id == s.id,
                    EarningsLedger.earned_at >= start_dt,
                    EarningsLedger.earned_at <= end_dt,
                    EarningsLedger.status != "void",
                )
            )
            .scalars()
            .all()
        )
        commission = sum(r.amount_cents for r in ledgers if r.source_type == "commission")
        hourly = sum(r.amount_cents for r in ledgers if r.source_type == "hourly")
        adhoc = sum(r.amount_cents for r in ledgers if r.source_type == "adhoc")
        service = sum(r.amount_cents for r in ledgers if r.source_type == "service")
        owed = sum(r.amount_cents for r in ledgers if r.status == "owed")
        paid = sum(r.amount_cents for r in ledgers if r.status == "paid")
        hours_logged = (
            db.scalar(
                select(func.coalesce(func.sum(TimeEntry.hours), 0)).where(
                    TimeEntry.staff_id == s.id,
                    TimeEntry.work_date >= start,
                    TimeEntry.work_date <= end,
                )
            )
            or 0
        )
        sales_count = (
            db.scalar(
                select(func.count())
                .select_from(SaleConversion)
                .where(
                    SaleConversion.closer_staff_id == s.id,
                    SaleConversion.status == "won",
                    SaleConversion.closed_at >= start_dt,
                    SaleConversion.closed_at <= end_dt,
                )
            )
            or 0
        )
        support_count = (
            db.scalar(
                select(func.count())
                .select_from(SupportActivity)
                .where(
                    SupportActivity.staff_id == s.id,
                    SupportActivity.occurred_at >= start_dt,
                    SupportActivity.occurred_at <= end_dt,
                )
            )
            or 0
        )
        service_count = (
            db.scalar(
                select(func.count())
                .select_from(ServiceJob)
                .where(
                    ServiceJob.staff_id == s.id,
                    ServiceJob.status == "completed",
                    ServiceJob.completed_at >= start_dt,
                    ServiceJob.completed_at <= end_dt,
                )
            )
            or 0
        )
        summary.append(
            {
                "staff_id": str(s.id),
                "display_name": s.display_name or s.email,
                "email": s.email,
                "commission_cents": commission,
                "hourly_cents": hourly,
                "adhoc_cents": adhoc,
                "service_cents": service,
                "total_cents": commission + hourly + adhoc + service,
                "owed_cents": owed,
                "paid_cents": paid,
                "hours_logged": float(hours_logged),
                "sales_closed": sales_count,
                "support_logs": support_count,
                "service_jobs": service_count,
            }
        )

    weekly_trend = []
    for i in range(6, -1, -1):
        d = dt.date.today() - dt.timedelta(days=i * 7)
        week_end = d + dt.timedelta(days=6)
        w_start = dt.datetime.combine(d, dt.time.min, tzinfo=dt.timezone.utc)
        w_end = dt.datetime.combine(week_end, dt.time.max, tzinfo=dt.timezone.utc)
        total = (
            db.scalar(
                select(func.coalesce(func.sum(EarningsLedger.amount_cents), 0)).where(
                    EarningsLedger.earned_at >= w_start,
                    EarningsLedger.earned_at <= w_end,
                    EarningsLedger.status != "void",
                )
            )
            or 0
        )
        weekly_trend.append({"week_start": d.isoformat(), "total_cents": int(total)})

    return {"from": start.isoformat(), "to": end.isoformat(), "staff": summary, "weekly_trend": weekly_trend}


@router.post("/payroll/ledger/{ledger_id}/mark-paid")
def mark_paid(
    ledger_id: str,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_accounting(me)
    row = db.get(EarningsLedger, ledger_id)
    if not row:
        raise HTTPException(status_code=404, detail="Ledger entry not found")
    row.status = "paid"
    row.paid_at = dt.datetime.now(dt.timezone.utc)
    row.paid_by_staff_id = me.id
    db.commit()
    return {"ok": True}


@router.get("/payroll/ledger")
def list_ledger(
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
    staff_id: str | None = None,
    source_type: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    limit: int = Query(100, ge=1, le=500),
):
    me = _ensure_staff(db, admin)
    accounting = is_owner_tier(me) or "accounting" in effective_capabilities(me)
    if not accounting and staff_id and staff_id != str(me.id):
        raise HTTPException(status_code=403, detail="Accounting access required")

    start = dt.date.fromisoformat(from_date) if from_date else dt.date.today().replace(day=1)
    end = dt.date.fromisoformat(to_date) if to_date else dt.date.today()
    start_dt = dt.datetime.combine(start, dt.time.min, tzinfo=dt.timezone.utc)
    end_dt = dt.datetime.combine(end, dt.time.max, tzinfo=dt.timezone.utc)

    stmt = (
        select(EarningsLedger, WorkbenchStaff)
        .join(WorkbenchStaff, EarningsLedger.staff_id == WorkbenchStaff.id)
        .where(
            EarningsLedger.earned_at >= start_dt,
            EarningsLedger.earned_at <= end_dt,
            EarningsLedger.status != "void",
        )
        .order_by(EarningsLedger.earned_at.desc())
        .limit(limit)
    )
    if not accounting:
        stmt = stmt.where(EarningsLedger.staff_id == me.id)
    elif staff_id:
        stmt = stmt.where(EarningsLedger.staff_id == uuid.UUID(staff_id))
    if source_type:
        stmt = stmt.where(EarningsLedger.source_type == source_type)

    rows = db.execute(stmt).all()
    return [
        {
            "id": str(r.id),
            "staff_id": str(r.staff_id),
            "staff_name": s.display_name or s.email,
            "source_type": r.source_type,
            "source_id": str(r.source_id),
            "amount_cents": r.amount_cents,
            "earned_at": r.earned_at.isoformat(),
            "status": r.status,
            "note": r.note,
            "paid_at": r.paid_at.isoformat() if r.paid_at else None,
        }
        for r, s in rows
    ]


@router.post("/payroll/adhoc")
def create_adhoc(
    body: dict[str, Any],
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    """Accounting/owner: record bonus, event pay, expense reimbursement, or any one-off."""
    me = _ensure_staff(db, admin)
    require_accounting(me)

    staff_raw = body.get("staff_id")
    if not staff_raw:
        raise HTTPException(status_code=400, detail="staff_id required")
    try:
        staff_id = uuid.UUID(str(staff_raw))
    except ValueError as e:
        raise HTTPException(status_code=400, detail="invalid staff_id") from e

    staff = db.get(WorkbenchStaff, staff_id)
    if not staff or not staff.active:
        raise HTTPException(status_code=404, detail="Staff not found")

    try:
        amount_cents = int(body.get("amount_cents"))
    except (TypeError, ValueError) as e:
        raise HTTPException(status_code=400, detail="amount_cents required (integer)") from e

    description = (body.get("description") or body.get("note") or "").strip()
    earned_at = None
    if body.get("earned_at"):
        try:
            earned_at = dt.datetime.fromisoformat(str(body["earned_at"]).replace("Z", "+00:00"))
        except ValueError as e:
            raise HTTPException(status_code=400, detail="invalid earned_at") from e

    try:
        row = record_adhoc_earning(
            db,
            staff_id=staff_id,
            amount_cents=amount_cents,
            description=description,
            earned_at=earned_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return {
        "id": str(row.id),
        "staff_id": str(row.staff_id),
        "source_type": row.source_type,
        "amount_cents": row.amount_cents,
        "note": row.note,
        "earned_at": row.earned_at.isoformat(),
        "status": row.status,
    }


@router.post("/payroll/ledger/{ledger_id}/void")
def void_ledger(
    ledger_id: str,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    me = _ensure_staff(db, admin)
    require_accounting(me)
    try:
        lid = uuid.UUID(ledger_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="invalid ledger_id") from e
    row = db.get(EarningsLedger, lid)
    if not row:
        raise HTTPException(status_code=404, detail="Ledger entry not found")
    if row.source_type == "adhoc":
        if not void_adhoc_earning(db, lid):
            raise HTTPException(status_code=400, detail="Unable to void")
        return {"ok": True}
    if row.source_type == "service":
        void_service_job_earnings(db, row.source_id)
        job = db.get(ServiceJob, row.source_id)
        if job and job.status == "completed":
            job.status = "void"
            db.commit()
        return {"ok": True}
    raise HTTPException(
        status_code=400,
        detail="Void adhoc/service here, or void sales to clear commission",
    )
