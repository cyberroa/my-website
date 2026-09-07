from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.customer_utils import manual_recipient_variables
from app.models import Customer, Segment
from app.segments import segment_customers

MAX_OUTREACH_AUDIENCE = 500


def resolve_outreach_audience(
    db: Session,
    *,
    customer_ids: list[uuid.UUID],
    segment_ids: list[uuid.UUID],
    manual_emails: list[str],
) -> list[tuple[str, Customer | None]]:
    """Return deduped (email, customer_or_none) pairs; prefer customer records."""
    by_email: dict[str, Customer | None] = {}

    for cid in customer_ids:
        c = db.get(Customer, cid)
        if c is None:
            continue
        email = (c.email or "").strip().lower()
        if email:
            by_email[email] = c

    for sid in segment_ids:
        seg = db.get(Segment, sid)
        if seg is None:
            continue
        for c in segment_customers(db, seg.filter_json, limit=None):
            email = (c.email or "").strip().lower()
            if email and email not in by_email:
                by_email[email] = c

    for addr in manual_emails:
        email = str(addr).strip().lower()
        if not email:
            continue
        if email not in by_email:
            existing = db.scalar(select(Customer).where(Customer.email == email))
            by_email[email] = existing

    return list(by_email.items())


def variables_for_recipient(email: str, customer: Customer | None) -> dict[str, Any]:
    if customer is not None:
        from app.customer_utils import customer_template_variables

        return customer_template_variables(customer)
    return manual_recipient_variables(email)
