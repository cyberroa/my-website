from __future__ import annotations

import datetime as dt
import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.engagement import HOT_LEAD_THRESHOLD, compute_score
from app.models import (
    CampaignRecipient,
    ContactSubmission,
    Customer,
    CustomerEngagementSnapshot,
    Event,
    OpportunitySnapshot,
    SellSubmission,
    ServiceJob,
)

logger = logging.getLogger(__name__)

OPPORTUNITY_TYPES = (
    "warm_parts_inquiry",
    "cooling_engaged",
    "sell_equipment",
    "consent_ready_nurture",
    "hot_lead",
    # Buyer-side / service expansion (agentic CRM)
    "buy_used_petct",
    "buy_new_petct",
    "audit_candidate",
    "service_contract_gap",
)

BUYER_INTENTS = frozenset(
    {
        "buy_equipment",
        "buy_used",
        "buy_new",
        "system_purchase",
        "petct_purchase",
        "equipment_purchase",
    }
)
AUDIT_INTENTS = frozenset({"service_request", "audit_request", "pm_request", "repair_request"})


def _as_utc(value: dt.datetime) -> dt.datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=dt.timezone.utc)
    return value


def detect_customer_opportunities(
    db: Session,
    customer: Customer,
    *,
    as_of: dt.date | None = None,
    now: dt.datetime | None = None,
) -> list[dict[str, Any]]:
    """Rule-first opportunity detection for one customer."""
    day = as_of or dt.date.today()
    now = now or dt.datetime.now(dt.timezone.utc)
    since_7 = now - dt.timedelta(days=7)
    since_3 = now - dt.timedelta(days=3)
    since_90 = now - dt.timedelta(days=90)
    since_365 = now - dt.timedelta(days=365)

    events = list(
        db.execute(
            select(Event)
            .where(Event.customer_id == customer.id)
            .order_by(Event.occurred_at.desc())
            .limit(120)
        )
        .scalars()
        .all()
    )
    score = compute_score(events, now)

    snaps = list(
        db.execute(
            select(CustomerEngagementSnapshot)
            .where(CustomerEngagementSnapshot.customer_id == customer.id)
            .order_by(CustomerEngagementSnapshot.snapshot_date.desc())
            .limit(8)
        )
        .scalars()
        .all()
    )
    latest_warmth = float(snaps[0].score) if snaps else score
    prior_warmth = float(snaps[min(6, len(snaps) - 1)].score) if len(snaps) > 1 else latest_warmth
    warmth_delta = latest_warmth - prior_warmth

    contacts = list(
        db.execute(
            select(ContactSubmission)
            .where(ContactSubmission.email == customer.email)
            .order_by(ContactSubmission.created_at.desc())
            .limit(10)
        )
        .scalars()
        .all()
    )
    sells = list(
        db.execute(
            select(SellSubmission)
            .where(SellSubmission.email == customer.email)
            .order_by(SellSubmission.created_at.desc())
            .limit(10)
        )
        .scalars()
        .all()
    )
    service_jobs = list(
        db.execute(
            select(ServiceJob)
            .where(ServiceJob.customer_id == customer.id)
            .order_by(ServiceJob.created_at.desc())
            .limit(20)
        )
        .scalars()
        .all()
    )

    recent_part_views = sum(
        1
        for e in events
        if e.type in ("part_view", "part_click", "inventory_search")
        and _as_utc(e.occurred_at) >= since_7
    )
    recent_email_engage = False
    recip = list(
        db.execute(
            select(CampaignRecipient)
            .where(CampaignRecipient.email == customer.email)
            .order_by(CampaignRecipient.created_at.desc())
            .limit(20)
        )
        .scalars()
        .all()
    )
    for r in recip:
        if (r.opened_at and _as_utc(r.opened_at) >= since_7) or (
            r.clicked_at and _as_utc(r.clicked_at) >= since_7
        ):
            recent_email_engage = True
            break

    tags_lower = {t.lower() for t in (customer.tags or [])}
    notes_blob = " ".join(
        filter(
            None,
            [
                customer.notes or "",
                " ".join(customer.tags or []),
                " ".join((c.subject or "") + " " + (c.message or "") for c in contacts[:5]),
            ],
        )
    ).lower()

    found: list[dict[str, Any]] = []

    # hot_lead
    if score >= HOT_LEAD_THRESHOLD:
        found.append(
            {
                "opportunity_type": "hot_lead",
                "score": round(score, 1),
                "reasons": [f"Engagement score {score} ≥ hot threshold {HOT_LEAD_THRESHOLD}"],
            }
        )

    # sell_equipment (customer selling TO Titan)
    sell_hit = None
    for s in sells:
        if _as_utc(s.created_at) >= since_7 or (s.ai_intent or "") == "sell_equipment":
            sell_hit = s
            break
    if sell_hit:
        reasons = ["Sell inquiry on file"]
        if sell_hit.ai_intent:
            reasons.append(f"Intent: {sell_hit.ai_intent}")
        found.append(
            {
                "opportunity_type": "sell_equipment",
                "score": round(max(score, 25.0), 1),
                "reasons": reasons,
            }
        )

    # warm_parts_inquiry
    urgent_contact = any(
        (c.ai_urgency or "") == "high" and _as_utc(c.created_at) >= since_3 for c in contacts
    )
    parts_intent = any(
        (c.ai_intent or "") in ("parts_inquiry", "service_request")
        and _as_utc(c.created_at) >= since_7
        for c in contacts
    )
    if (urgent_contact or parts_intent or recent_part_views >= 2) and (
        score >= 15 or warmth_delta > 0 or recent_part_views
    ):
        reasons = []
        if urgent_contact:
            reasons.append("High-urgency contact in last 3 days")
        if parts_intent:
            reasons.append("Parts/service intent on recent contact")
        if recent_part_views:
            reasons.append(f"{recent_part_views} part views/searches in 7 days")
        if warmth_delta > 0:
            reasons.append(f"Warmth rising (+{warmth_delta:.1f})")
        found.append(
            {
                "opportunity_type": "warm_parts_inquiry",
                "score": round(max(score, 20.0 + recent_part_views), 1),
                "reasons": reasons or ["Parts interest signals"],
            }
        )

    # cooling_engaged
    if (recent_email_engage or prior_warmth >= HOT_LEAD_THRESHOLD * 0.6) and warmth_delta < -3:
        found.append(
            {
                "opportunity_type": "cooling_engaged",
                "score": round(abs(warmth_delta) + 10, 1),
                "reasons": [
                    f"Warmth dropped {warmth_delta:.1f} over recent snapshots",
                    "Prior email engagement or elevated warmth",
                ],
            }
        )

    # consent_ready_nurture
    if customer.consent_marketing and score < 12 and recent_part_views == 0 and not sell_hit:
        found.append(
            {
                "opportunity_type": "consent_ready_nurture",
                "score": 8.0,
                "reasons": ["Marketing consent with low recent activity"],
            }
        )

    # --- Buyer-side PET/CT intent ---
    buy_used_hit = (
        any((c.ai_intent or "").lower() in ("buy_used", "buy_equipment") for c in contacts)
        or "buy_used" in tags_lower
        or "used pet" in notes_blob
        or "used ct" in notes_blob
        or "refurbished" in notes_blob
        or "pre-owned" in notes_blob
    )
    buy_new_hit = (
        any((c.ai_intent or "").lower() in ("buy_new", "system_purchase") for c in contacts)
        or "buy_new" in tags_lower
        or "new pet" in notes_blob
        or "new system" in notes_blob
        or "capital purchase" in notes_blob
    )
    generic_buy = any((c.ai_intent or "").lower() in BUYER_INTENTS for c in contacts) or any(
        k in notes_blob for k in ("looking to buy", "need a system", "replace our", "upgrade our pet")
    )

    if buy_used_hit or (generic_buy and not buy_new_hit):
        found.append(
            {
                "opportunity_type": "buy_used_petct",
                "score": round(max(score, 28.0), 1),
                "reasons": [
                    "Signals indicate interest in used/refurbished PET/CT systems",
                    "Titan offer: System Sales (pre-owned GE PET/CT)",
                ],
            }
        )
    if buy_new_hit:
        found.append(
            {
                "opportunity_type": "buy_new_petct",
                "score": round(max(score, 30.0), 1),
                "reasons": [
                    "Signals indicate interest in new PET/CT acquisition",
                    "Titan offer: consult + competitive system sourcing",
                ],
            }
        )

    # --- Audit / service contract ---
    recent_audits = [
        j
        for j in service_jobs
        if (j.job_type or "") == "audit" and j.completed_at and _as_utc(j.completed_at) >= since_365
    ]
    any_audit_ever = any((j.job_type or "") == "audit" for j in service_jobs)
    audit_intent = any(
        (c.ai_intent or "").lower() in AUDIT_INTENTS and _as_utc(c.created_at) >= since_90
        for c in contacts
    ) or any(k in notes_blob for k in ("mechanical audit", "pet/ct audit", "inspection", "pm overdue"))
    follow_up_jobs = [j for j in service_jobs if j.follow_up_needed]

    if (audit_intent or follow_up_jobs or ("audit" in tags_lower)) and not recent_audits:
        found.append(
            {
                "opportunity_type": "audit_candidate",
                "score": round(max(score, 24.0), 1),
                "reasons": [
                    "No completed PET/CT audit in the last year"
                    if any_audit_ever or audit_intent
                    else "Audit/inspection interest without recent audit on file",
                    "Titan offer: mechanical audits, inspections, and repairs",
                ],
            }
        )

    has_contract_tag = any(t in tags_lower for t in ("service_contract", "under_contract", "pm_contract"))
    if (any_audit_ever or parts_intent or recent_part_views >= 1) and not has_contract_tag:
        found.append(
            {
                "opportunity_type": "service_contract_gap",
                "score": round(max(score * 0.5, 14.0), 1),
                "reasons": [
                    "Active service/parts relationship without service-contract tag",
                    "Titan offer: flexible service contracts and PM schedules",
                ],
            }
        )

    return found


def run_opportunity_detection(
    db: Session,
    *,
    as_of: dt.date | None = None,
    customer_limit: int = 2000,
) -> dict[str, Any]:
    day = as_of or dt.date.today()
    now = dt.datetime.now(dt.timezone.utc)
    customers = list(
        db.execute(select(Customer).order_by(Customer.updated_at.desc()).limit(customer_limit))
        .scalars()
        .all()
    )
    written = 0
    by_type: dict[str, int] = {t: 0 for t in OPPORTUNITY_TYPES}

    for c in customers:
        opps = detect_customer_opportunities(db, c, as_of=day, now=now)
        for opp in opps:
            otype = opp["opportunity_type"]
            existing = db.scalar(
                select(OpportunitySnapshot).where(
                    OpportunitySnapshot.customer_id == c.id,
                    OpportunitySnapshot.opportunity_type == otype,
                    OpportunitySnapshot.as_of_date == day,
                )
            )
            if existing:
                existing.score = opp["score"]
                existing.reasons = opp["reasons"]
            else:
                db.add(
                    OpportunitySnapshot(
                        id=uuid.uuid4(),
                        customer_id=c.id,
                        opportunity_type=otype,
                        score=opp["score"],
                        reasons=opp["reasons"],
                        as_of_date=day,
                    )
                )
            written += 1
            by_type[otype] = by_type.get(otype, 0) + 1

    db.commit()
    return {
        "as_of_date": day.isoformat(),
        "customers_scanned": len(customers),
        "snapshots_written": written,
        "by_type": by_type,
    }


def customer_latest_opportunities(db: Session, customer_id: uuid.UUID, days: int = 7) -> list[dict]:
    since = dt.date.today() - dt.timedelta(days=days)
    rows = (
        db.execute(
            select(OpportunitySnapshot)
            .where(
                OpportunitySnapshot.customer_id == customer_id,
                OpportunitySnapshot.as_of_date >= since,
            )
            .order_by(OpportunitySnapshot.score.desc(), OpportunitySnapshot.as_of_date.desc())
        )
        .scalars()
        .all()
    )
    best: dict[str, OpportunitySnapshot] = {}
    for r in rows:
        prev = best.get(r.opportunity_type)
        if not prev or float(r.score) > float(prev.score):
            best[r.opportunity_type] = r
    return [
        {
            "opportunity_type": r.opportunity_type,
            "score": float(r.score),
            "reasons": r.reasons or [],
            "as_of_date": r.as_of_date.isoformat(),
        }
        for r in best.values()
    ]


def hot_opportunities_above_threshold(
    db: Session, *, min_score: float = 40.0, days: int = 1
) -> list[dict[str, Any]]:
    since = dt.date.today() - dt.timedelta(days=days)
    rows = list(
        db.execute(
            select(OpportunitySnapshot, Customer)
            .join(Customer, Customer.id == OpportunitySnapshot.customer_id)
            .where(
                OpportunitySnapshot.as_of_date >= since,
                OpportunitySnapshot.score >= min_score,
            )
            .order_by(OpportunitySnapshot.score.desc())
            .limit(40)
        ).all()
    )
    seen: set[tuple[str, str]] = set()
    out: list[dict[str, Any]] = []
    for snap, customer in rows:
        key = (str(customer.id), snap.opportunity_type)
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "customer_id": str(customer.id),
                "email": customer.email,
                "name": customer.name,
                "company": customer.company,
                "opportunity_type": snap.opportunity_type,
                "score": float(snap.score),
                "reasons": snap.reasons or [],
            }
        )
    return out
