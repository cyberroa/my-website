"""Composite fit scores per customer × Titan offer family."""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.opportunities import detect_customer_opportunities
from app.models import Customer, CustomerEngagement, CustomerFitScore, Event

OFFER_FAMILIES = (
    "parts",
    "audit",
    "used_system",
    "new_system",
    "sell_to_titan",
)

OUTCOME_SCORE_DELTA = {
    "interested": 18.0,
    "meeting_set": 22.0,
    "callback": 8.0,
    "objection": 6.0,
    "won": 30.0,
    "not_interested": -15.0,
    "lost": -20.0,
    "other": 2.0,
}

STAGE_SCORE_DELTA = {
    "contacted": 4.0,
    "engaged": 10.0,
    "qualified": 16.0,
    "proposal": 20.0,
    "won": 28.0,
    "lost": -12.0,
}

# Map opportunity types → offer families
OPP_TO_OFFER = {
    "warm_parts_inquiry": "parts",
    "hot_lead": "parts",
    "audit_candidate": "audit",
    "service_contract_gap": "audit",
    "buy_used_petct": "used_system",
    "buy_new_petct": "new_system",
    "sell_equipment": "sell_to_titan",
    "cooling_engaged": "parts",
    "consent_ready_nurture": "parts",
}


def compute_fit_scores_for_customer(
    db: Session,
    customer: Customer,
    *,
    as_of: dt.date | None = None,
    now: dt.datetime | None = None,
) -> list[dict[str, Any]]:
    day = as_of or dt.date.today()
    now = now or dt.datetime.now(dt.timezone.utc)
    opps = detect_customer_opportunities(db, customer, as_of=day, now=now)
    by_family: dict[str, dict[str, Any]] = {
        f: {"offer_family": f, "score": 0.0, "reasons": []} for f in OFFER_FAMILIES
    }

    for opp in opps:
        family = OPP_TO_OFFER.get(opp["opportunity_type"])
        if not family:
            continue
        bucket = by_family[family]
        bucket["score"] = max(float(bucket["score"]), float(opp["score"]))
        for r in opp.get("reasons") or []:
            if r not in bucket["reasons"]:
                bucket["reasons"].append(r)
        label = opp["opportunity_type"]
        if label not in bucket["reasons"]:
            bucket["reasons"].append(f"Opportunity: {label}")

    # Neglect signal boosts parts win-back lightly
    events = list(
        db.execute(
            select(Event)
            .where(Event.customer_id == customer.id)
            .order_by(Event.occurred_at.desc())
            .limit(5)
        )
        .scalars()
        .all()
    )
    if events:
        last = events[0].occurred_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=dt.timezone.utc)
        days_quiet = (now - last).days
        if days_quiet >= 21 and customer.consent_marketing:
            b = by_family["parts"]
            b["score"] = max(float(b["score"]), 12.0)
            b["reasons"].append(f"Quiet {days_quiet} days with marketing consent (neglect risk)")

    # Engagement / email progression signals (last 45 days)
    since_eng = now - dt.timedelta(days=45)
    engagements = list(
        db.execute(
            select(CustomerEngagement)
            .where(
                CustomerEngagement.customer_id == customer.id,
                CustomerEngagement.occurred_at >= since_eng,
            )
            .order_by(CustomerEngagement.occurred_at.desc())
            .limit(25)
        )
        .scalars()
        .all()
    )
    for eng in engagements:
        family = eng.offer_family if eng.offer_family in OFFER_FAMILIES else "parts"
        bucket = by_family[family]
        delta = float(OUTCOME_SCORE_DELTA.get(eng.outcome, 2.0))
        # Recency decay: full weight within 7d, half after
        occurred = eng.occurred_at
        if occurred.tzinfo is None:
            occurred = occurred.replace(tzinfo=dt.timezone.utc)
        age_days = max(0, (now - occurred).days)
        weight = 1.0 if age_days <= 7 else 0.5
        add = delta * weight
        if add >= 0:
            bucket["score"] = float(bucket["score"]) + add
        else:
            bucket["score"] = max(0.0, float(bucket["score"]) + add)
        reason = f"Engagement {eng.channel}/{eng.outcome}"
        if reason not in bucket["reasons"]:
            bucket["reasons"].append(reason)
        if eng.channel in ("email_inbound", "email_paste") and eng.ai_sentiment == "positive":
            bucket["score"] = float(bucket["score"]) + 4.0 * weight
            if "Positive email intent" not in bucket["reasons"]:
                bucket["reasons"].append("Positive email intent")

    stage = getattr(customer, "lead_stage", None) or "new"
    stage_boost = STAGE_SCORE_DELTA.get(stage)
    if stage_boost:
        # Spread stage confidence across families that already have signal, else parts
        targets = [f for f, b in by_family.items() if float(b["score"]) > 0] or ["parts"]
        for f in targets:
            b = by_family[f]
            if stage_boost >= 0:
                b["score"] = float(b["score"]) + float(stage_boost) / len(targets)
            else:
                b["score"] = max(0.0, float(b["score"]) + float(stage_boost) / len(targets))
            label = f"Lead stage: {stage}"
            if label not in b["reasons"]:
                b["reasons"].append(label)

    return [v for v in by_family.values() if float(v["score"]) > 0]


def persist_scores_for_customer(
    db: Session,
    customer_id: uuid.UUID,
    scores: list[dict[str, Any]],
    *,
    as_of: dt.date | None = None,
) -> int:
    day = as_of or dt.date.today()
    written = 0
    for s in scores:
        existing = db.scalar(
            select(CustomerFitScore).where(
                CustomerFitScore.customer_id == customer_id,
                CustomerFitScore.offer_family == s["offer_family"],
                CustomerFitScore.as_of_date == day,
            )
        )
        if existing:
            existing.score = s["score"]
            existing.reasons = s["reasons"]
        else:
            db.add(
                CustomerFitScore(
                    id=uuid.uuid4(),
                    customer_id=customer_id,
                    offer_family=s["offer_family"],
                    score=s["score"],
                    reasons=s["reasons"],
                    as_of_date=day,
                )
            )
        written += 1
    db.flush()
    return written


def run_fit_score_snapshots(
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
    for c in customers:
        scores = compute_fit_scores_for_customer(db, c, as_of=day, now=now)
        for s in scores:
            existing = db.scalar(
                select(CustomerFitScore).where(
                    CustomerFitScore.customer_id == c.id,
                    CustomerFitScore.offer_family == s["offer_family"],
                    CustomerFitScore.as_of_date == day,
                )
            )
            if existing:
                existing.score = s["score"]
                existing.reasons = s["reasons"]
            else:
                db.add(
                    CustomerFitScore(
                        id=uuid.uuid4(),
                        customer_id=c.id,
                        offer_family=s["offer_family"],
                        score=s["score"],
                        reasons=s["reasons"],
                        as_of_date=day,
                    )
                )
            written += 1
    db.commit()
    return {"as_of_date": day.isoformat(), "customers_scanned": len(customers), "scores_written": written}


def top_ranked(
    db: Session,
    offer_family: str,
    *,
    limit: int = 10,
    days: int = 7,
) -> list[dict[str, Any]]:
    since = dt.date.today() - dt.timedelta(days=days)
    rows = list(
        db.execute(
            select(CustomerFitScore, Customer)
            .join(Customer, Customer.id == CustomerFitScore.customer_id)
            .where(
                CustomerFitScore.offer_family == offer_family,
                CustomerFitScore.as_of_date >= since,
            )
            .order_by(CustomerFitScore.score.desc())
            .limit(limit * 3)
        ).all()
    )
    best: dict[uuid.UUID, tuple[CustomerFitScore, Customer]] = {}
    for score_row, customer in rows:
        prev = best.get(customer.id)
        if not prev or float(score_row.score) > float(prev[0].score):
            best[customer.id] = (score_row, customer)
    ranked = sorted(best.values(), key=lambda x: float(x[0].score), reverse=True)[:limit]
    return [
        {
            "customer_id": str(c.id),
            "email": c.email,
            "name": c.name,
            "company": c.company,
            "offer_family": s.offer_family,
            "score": float(s.score),
            "reasons": s.reasons or [],
            "as_of_date": s.as_of_date.isoformat(),
        }
        for s, c in ranked
    ]


def customer_fit_scores_out(db: Session, customer_id: uuid.UUID, days: int = 7) -> list[dict]:
    since = dt.date.today() - dt.timedelta(days=days)
    rows = list(
        db.execute(
            select(CustomerFitScore)
            .where(
                CustomerFitScore.customer_id == customer_id,
                CustomerFitScore.as_of_date >= since,
            )
            .order_by(CustomerFitScore.score.desc())
        )
        .scalars()
        .all()
    )
    best: dict[str, CustomerFitScore] = {}
    for r in rows:
        prev = best.get(r.offer_family)
        if not prev or float(r.score) > float(prev.score):
            best[r.offer_family] = r
    return [
        {
            "offer_family": r.offer_family,
            "score": float(r.score),
            "reasons": r.reasons or [],
            "as_of_date": r.as_of_date.isoformat(),
        }
        for r in best.values()
    ]


def dashboard_rankings(db: Session) -> dict[str, Any]:
    return {
        "audit_candidates": top_ranked(db, "audit", limit=10),
        "system_buyers_used": top_ranked(db, "used_system", limit=10),
        "system_buyers_new": top_ranked(db, "new_system", limit=10),
        "parts_warmth": top_ranked(db, "parts", limit=10),
        "sell_to_titan": top_ranked(db, "sell_to_titan", limit=10),
        "at_risk": top_ranked(db, "parts", limit=10),  # neglect-boosted parts scores surface here
    }
