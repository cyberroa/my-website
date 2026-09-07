from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    EarningsLedger,
    PayPolicy,
    SaleConversion,
    ServiceJob,
    StaffPayAssignment,
    TimeEntry,
)


def get_active_assignment(db: Session, staff_id: uuid.UUID) -> StaffPayAssignment | None:
    return db.scalar(
        select(StaffPayAssignment)
        .where(
            StaffPayAssignment.staff_id == staff_id,
            StaffPayAssignment.status == "active",
            StaffPayAssignment.accepted_at.isnot(None),
        )
        .order_by(StaffPayAssignment.assigned_at.desc())
    )


def get_policy_for_assignment(db: Session, assignment: StaffPayAssignment) -> PayPolicy | None:
    return db.get(PayPolicy, assignment.policy_id)


def compute_commission_cents(amount_cents: int, rate_bps: int) -> int:
    return int(amount_cents * rate_bps / 10000)


def record_conversion_earnings(db: Session, conversion: SaleConversion) -> list[EarningsLedger]:
    if conversion.status != "won":
        return []

    rows: list[EarningsLedger] = []
    now = dt.datetime.now(dt.timezone.utc)

    for staff_id, role in [
        (conversion.closer_staff_id, "closer"),
        (conversion.lead_owner_staff_id, "lead_owner"),
    ]:
        if not staff_id:
            continue
        assignment = get_active_assignment(db, staff_id)
        if not assignment:
            continue
        policy = get_policy_for_assignment(db, assignment)
        if not policy:
            continue

        applies = policy.commission_applies_to
        if applies == "closer" and role != "closer":
            continue
        if applies == "lead_owner" and role != "lead_owner":
            continue
        if applies == "both_split" and role not in ("closer", "lead_owner"):
            continue

        amount = compute_commission_cents(conversion.amount_cents, policy.commission_rate_bps)
        if applies == "both_split":
            amount = amount // 2
        if amount <= 0:
            continue

        ledger = EarningsLedger(
            id=uuid.uuid4(),
            staff_id=staff_id,
            source_type="commission",
            source_id=conversion.id,
            policy_assignment_id=assignment.id,
            amount_cents=amount,
            earned_at=conversion.closed_at,
            status="owed",
        )
        db.add(ledger)
        rows.append(ledger)

    if rows:
        db.commit()
    return rows


def record_time_entry_earnings(db: Session, entry: TimeEntry) -> EarningsLedger | None:
    assignment = get_active_assignment(db, entry.staff_id)
    if not assignment:
        return None
    policy = get_policy_for_assignment(db, assignment)
    if not policy or policy.hourly_rate_cents <= 0:
        return None

    hours = float(entry.hours)
    amount = int(hours * policy.hourly_rate_cents)
    if amount <= 0:
        return None

    earned_at = dt.datetime.combine(entry.work_date, dt.time(12, 0), tzinfo=dt.timezone.utc)
    ledger = EarningsLedger(
        id=uuid.uuid4(),
        staff_id=entry.staff_id,
        source_type="hourly",
        source_id=entry.id,
        policy_assignment_id=assignment.id,
        amount_cents=amount,
        earned_at=earned_at,
        status="owed",
    )
    db.add(ledger)
    db.commit()
    db.refresh(ledger)
    return ledger


def void_conversion_earnings(db: Session, conversion_id: uuid.UUID) -> int:
    rows = (
        db.execute(
            select(EarningsLedger).where(
                EarningsLedger.source_type == "commission",
                EarningsLedger.source_id == conversion_id,
                EarningsLedger.status != "void",
            )
        )
        .scalars()
        .all()
    )
    for r in rows:
        r.status = "void"
    db.commit()
    return len(rows)


def record_adhoc_earning(
    db: Session,
    *,
    staff_id: uuid.UUID,
    amount_cents: int,
    description: str,
    earned_at: dt.datetime | None = None,
) -> EarningsLedger:
    """One-off ledger line: bonus, event pay, expense reimbursement, etc."""
    desc = (description or "").strip()
    if not desc:
        raise ValueError("description required")
    if amount_cents == 0:
        raise ValueError("amount_cents must be non-zero")

    assignment = get_active_assignment(db, staff_id)
    ledger_id = uuid.uuid4()
    when = earned_at or dt.datetime.now(dt.timezone.utc)

    ledger = EarningsLedger(
        id=ledger_id,
        staff_id=staff_id,
        source_type="adhoc",
        source_id=ledger_id,  # self-ref — no separate adhoc table
        policy_assignment_id=assignment.id if assignment else None,
        amount_cents=amount_cents,
        earned_at=when,
        status="owed",
        note=desc[:2000],
    )
    db.add(ledger)
    db.commit()
    db.refresh(ledger)
    return ledger


def void_adhoc_earning(db: Session, ledger_id: uuid.UUID) -> bool:
    row = db.get(EarningsLedger, ledger_id)
    if not row or row.source_type != "adhoc" or row.status == "void":
        return False
    row.status = "void"
    db.commit()
    return True


SERVICE_JOB_TYPES = frozenset({"repair", "pm", "install", "calibration", "audit", "other"})


def _service_pay_cents(job: ServiceJob, policy: PayPolicy | None) -> int | None:
    """Flat amount on the job wins; else hours × hourly rate from active policy."""
    if job.amount_cents is not None and job.amount_cents > 0:
        return job.amount_cents
    if job.hours is not None and float(job.hours) > 0 and policy and policy.hourly_rate_cents > 0:
        return int(float(job.hours) * policy.hourly_rate_cents)
    return None


def record_service_job_earnings(db: Session, job: ServiceJob) -> EarningsLedger | None:
    if job.status != "completed":
        return None

    assignment = get_active_assignment(db, job.staff_id)
    policy = get_policy_for_assignment(db, assignment) if assignment else None
    amount = _service_pay_cents(job, policy)
    if amount is None or amount <= 0:
        return None

    note_parts = [job.job_type, job.summary]
    if job.part_number:
        note_parts.append(f"PN {job.part_number}")
    if job.job_type == "audit" and job.audit_report:
        snippet = job.audit_report.strip().replace("\n", " ")[:120]
        note_parts.append(f"audit: {snippet}")
    note = ": ".join(note_parts)[:2000]

    earned_at = job.completed_at or dt.datetime.now(dt.timezone.utc)
    ledger = EarningsLedger(
        id=uuid.uuid4(),
        staff_id=job.staff_id,
        source_type="service",
        source_id=job.id,
        policy_assignment_id=assignment.id if assignment else None,
        amount_cents=amount,
        earned_at=earned_at,
        status="owed",
        note=note,
    )
    db.add(ledger)
    db.commit()
    db.refresh(ledger)
    return ledger


def void_service_job_earnings(db: Session, job_id: uuid.UUID) -> int:
    rows = (
        db.execute(
            select(EarningsLedger).where(
                EarningsLedger.source_type == "service",
                EarningsLedger.source_id == job_id,
                EarningsLedger.status != "void",
            )
        )
        .scalars()
        .all()
    )
    for r in rows:
        r.status = "void"
    if rows:
        db.commit()
    return len(rows)


