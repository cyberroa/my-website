"""Customer evidence ledger — observations only; no self-graded confidence."""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Customer, CustomerEvidence

ALLOWED_STRONG_FIELDS = frozenset({"tags", "notes", "role", "company", "phone", "website", "source"})


def evidence_to_out(row: CustomerEvidence) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "customer_id": str(row.customer_id),
        "source": row.source,
        "tool_name": row.tool_name,
        "observation": row.observation,
        "strength": row.strength,
        "suggested_field": row.suggested_field,
        "suggested_value": row.suggested_value,
        "status": row.status,
        "observed_at": row.observed_at.isoformat() if row.observed_at else None,
        "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
        "resolved_by": row.resolved_by,
    }


def record_evidence(
    db: Session,
    *,
    customer_id: uuid.UUID,
    observation: str,
    source: str = "agent",
    tool_name: str | None = None,
    strength: str = "weak",
    suggested_field: str | None = None,
    suggested_value: str | None = None,
) -> CustomerEvidence:
    strength = strength if strength in ("strong", "weak") else "weak"
    status = "accepted" if strength == "strong" and suggested_field in ALLOWED_STRONG_FIELDS else "suggested"
    row = CustomerEvidence(
        id=uuid.uuid4(),
        customer_id=customer_id,
        source=source[:120],
        tool_name=(tool_name or "")[:120] or None,
        observation=observation.strip()[:20_000],
        strength=strength,
        suggested_field=suggested_field,
        suggested_value=suggested_value,
        status=status,
        observed_at=dt.datetime.now(dt.timezone.utc),
    )
    db.add(row)
    if status == "accepted" and suggested_field and suggested_value is not None:
        _apply_field(db, customer_id, suggested_field, suggested_value)
    db.flush()
    return row


def _apply_field(db: Session, customer_id: uuid.UUID, field: str, value: str) -> None:
    customer = db.get(Customer, customer_id)
    if not customer or field not in ALLOWED_STRONG_FIELDS:
        return
    if field == "tags":
        tags = [t.strip() for t in value.split(",") if t.strip()]
        existing = list(customer.tags or [])
        for t in tags:
            if t not in existing:
                existing.append(t)
        customer.tags = existing
    elif field == "notes":
        prev = (customer.notes or "").strip()
        customer.notes = f"{prev}\n{value}".strip() if prev else value
    else:
        setattr(customer, field, value[:500] if field != "notes" else value)


def list_evidence(
    db: Session,
    customer_id: uuid.UUID,
    *,
    status: str | None = None,
    limit: int = 50,
) -> list[CustomerEvidence]:
    q = select(CustomerEvidence).where(CustomerEvidence.customer_id == customer_id)
    if status:
        q = q.where(CustomerEvidence.status == status)
    q = q.order_by(CustomerEvidence.observed_at.desc()).limit(limit)
    return list(db.execute(q).scalars().all())


def resolve_evidence(
    db: Session,
    evidence_id: uuid.UUID,
    *,
    action: str,
    resolved_by: str | None,
) -> CustomerEvidence:
    row = db.get(CustomerEvidence, evidence_id)
    if not row:
        raise ValueError("Evidence not found")
    if action == "accept":
        row.status = "accepted"
        if row.suggested_field and row.suggested_value is not None:
            _apply_field(db, row.customer_id, row.suggested_field, row.suggested_value)
    elif action == "reject":
        row.status = "rejected"
    else:
        raise ValueError("action must be accept or reject")
    row.resolved_at = dt.datetime.now(dt.timezone.utc)
    row.resolved_by = resolved_by
    db.commit()
    db.refresh(row)
    return row


def pending_suggestion_count(db: Session) -> int:
    from sqlalchemy import func

    return (
        db.scalar(
            select(func.count())
            .select_from(CustomerEvidence)
            .where(CustomerEvidence.status == "suggested")
        )
        or 0
    )
