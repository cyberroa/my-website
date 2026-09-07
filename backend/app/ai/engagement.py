"""Customer engagement logging, lead stages, and AI extraction."""

from __future__ import annotations

import datetime as dt
import json
import logging
import re
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.client import AiDisabledError, AiError, chat_completion, resolve_model
from app.ai.evidence import record_evidence
from app.models import (
    Campaign,
    CampaignRecipient,
    Customer,
    CustomerEngagement,
    SaleConversion,
    WorkbenchStaff,
)

logger = logging.getLogger(__name__)

LEAD_STAGES = (
    "new",
    "contacted",
    "engaged",
    "qualified",
    "proposal",
    "won",
    "lost",
)

STAGE_RANK = {s: i for i, s in enumerate(LEAD_STAGES) if s not in ("lost",)}
STAGE_RANK["lost"] = -1

CHANNELS = frozenset(
    {"phone", "meeting", "email_inbound", "email_paste", "note", "studio_agent"}
)
OUTCOMES = frozenset(
    {
        "interested",
        "callback",
        "objection",
        "not_interested",
        "meeting_set",
        "won",
        "lost",
        "other",
    }
)
OFFER_FAMILIES = frozenset(
    {"parts", "audit", "used_system", "new_system", "sell_to_titan"}
)

OUTCOME_TO_STAGE = {
    "callback": "contacted",
    "objection": "engaged",
    "interested": "engaged",
    "meeting_set": "qualified",
    "won": "won",
    "lost": "lost",
    "not_interested": "lost",
    "other": None,
}

AUTO_APPLY_OUTCOMES = frozenset(
    {"interested", "meeting_set", "won", "lost", "not_interested", "callback"}
)

_EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)


def _skill_text() -> str:
    path = Path(__file__).resolve().parent / "skills" / "engagement.md"
    if path.is_file():
        return path.read_text(encoding="utf-8")[:12_000]
    return ""


def normalize_stage(stage: str | None) -> str | None:
    if not stage:
        return None
    s = stage.strip().lower()
    return s if s in LEAD_STAGES else None


def should_advance(current: str, suggested: str) -> bool:
    cur = normalize_stage(current) or "new"
    sug = normalize_stage(suggested)
    if not sug:
        return False
    if sug == "lost":
        return cur != "won"
    if cur == "won" or cur == "lost":
        return False
    return STAGE_RANK.get(sug, 0) >= STAGE_RANK.get(cur, 0)


def suggest_stage_from_outcome(outcome: str, current: str) -> str | None:
    mapped = OUTCOME_TO_STAGE.get(outcome)
    if not mapped:
        return None
    if should_advance(current, mapped) or mapped == "lost":
        return mapped
    return None


def engagement_to_out(row: CustomerEngagement) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "customer_id": str(row.customer_id),
        "staff_id": str(row.staff_id) if row.staff_id else None,
        "channel": row.channel,
        "occurred_at": row.occurred_at.isoformat() if row.occurred_at else None,
        "summary": row.summary,
        "notes": row.notes,
        "transcript": row.transcript,
        "outcome": row.outcome,
        "interest_tags": list(row.interest_tags or []),
        "offer_family": row.offer_family,
        "campaign_id": str(row.campaign_id) if row.campaign_id else None,
        "campaign_recipient_id": str(row.campaign_recipient_id)
        if row.campaign_recipient_id
        else None,
        "outreach_batch_id": str(row.outreach_batch_id) if row.outreach_batch_id else None,
        "mailbox_thread_id": row.mailbox_thread_id,
        "ai_summary": row.ai_summary,
        "ai_sentiment": row.ai_sentiment,
        "suggested_stage": row.suggested_stage,
        "applied_stage": row.applied_stage,
        "sale_amount_hint_cents": row.sale_amount_hint_cents,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def create_engagement(
    db: Session,
    *,
    customer: Customer,
    channel: str,
    summary: str,
    staff_id: uuid.UUID | None = None,
    notes: str | None = None,
    transcript: str | None = None,
    raw_email: str | None = None,
    outcome: str = "other",
    interest_tags: list[str] | None = None,
    offer_family: str | None = None,
    campaign_id: uuid.UUID | None = None,
    campaign_recipient_id: uuid.UUID | None = None,
    outreach_batch_id: uuid.UUID | None = None,
    mailbox_thread_id: str | None = None,
    ai_summary: str | None = None,
    ai_sentiment: str | None = None,
    suggested_stage: str | None = None,
    apply_stage: bool | None = None,
    sale_amount_hint_cents: int | None = None,
    occurred_at: dt.datetime | None = None,
    record_evidence_row: bool = True,
) -> CustomerEngagement:
    channel = channel if channel in CHANNELS else "note"
    outcome = outcome if outcome in OUTCOMES else "other"
    if offer_family and offer_family not in OFFER_FAMILIES:
        offer_family = None

    current = getattr(customer, "lead_stage", None) or "new"
    suggested = normalize_stage(suggested_stage) or suggest_stage_from_outcome(outcome, current)

    auto = apply_stage if apply_stage is not None else (outcome in AUTO_APPLY_OUTCOMES)
    applied: str | None = None
    if auto and suggested and should_advance(current, suggested):
        customer.lead_stage = suggested
        applied = suggested
    elif auto and suggested == "lost" and current != "won":
        customer.lead_stage = "lost"
        applied = "lost"

    row = CustomerEngagement(
        id=uuid.uuid4(),
        customer_id=customer.id,
        staff_id=staff_id,
        channel=channel,
        occurred_at=occurred_at or dt.datetime.now(dt.timezone.utc),
        summary=(summary or "")[:20_000],
        notes=(notes or None),
        transcript=(transcript[:50_000] if transcript else None),
        raw_email=(raw_email[:100_000] if raw_email else None),
        outcome=outcome,
        interest_tags=list(interest_tags or []),
        offer_family=offer_family,
        campaign_id=campaign_id,
        campaign_recipient_id=campaign_recipient_id,
        outreach_batch_id=outreach_batch_id,
        mailbox_thread_id=(mailbox_thread_id[:255] if mailbox_thread_id else None),
        ai_summary=ai_summary,
        ai_sentiment=(ai_sentiment[:40] if ai_sentiment else None),
        suggested_stage=suggested,
        applied_stage=applied,
        sale_amount_hint_cents=sale_amount_hint_cents,
    )
    db.add(row)
    db.flush()

    if record_evidence_row and (summary or ai_summary):
        strength = (
            "strong"
            if outcome in ("interested", "meeting_set", "won", "not_interested", "lost")
            else "weak"
        )
        obs = ai_summary or summary
        record_evidence(
            db,
            customer_id=customer.id,
            observation=f"[{channel}/{outcome}] {obs}"[:20_000],
            source="engagement",
            tool_name=channel,
            strength=strength,
            suggested_field="notes" if strength == "strong" else None,
            suggested_value=obs[:2000] if strength == "strong" else None,
        )

    return row


def list_engagements(
    db: Session,
    customer_id: uuid.UUID,
    *,
    limit: int = 50,
) -> list[CustomerEngagement]:
    return list(
        db.execute(
            select(CustomerEngagement)
            .where(CustomerEngagement.customer_id == customer_id)
            .order_by(CustomerEngagement.occurred_at.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )


def recent_campaigns_for_customer(db: Session, customer: Customer, limit: int = 8) -> list[dict]:
    rows = db.execute(
        select(CampaignRecipient, Campaign)
        .join(Campaign, Campaign.id == CampaignRecipient.campaign_id)
        .where(CampaignRecipient.email == customer.email)
        .order_by(CampaignRecipient.created_at.desc())
        .limit(limit)
    ).all()
    out = []
    for recip, camp in rows:
        out.append(
            {
                "campaign_id": str(camp.id),
                "campaign_name": camp.name,
                "recipient_id": str(recip.id),
                "status": recip.status,
                "sent_at": recip.sent_at.isoformat() if recip.sent_at else None,
            }
        )
    return out


def extract_emails_from_text(text: str) -> list[str]:
    found = _EMAIL_RE.findall(text or "")
    # Prefer non-titan addresses as customer candidates first
    uniq: list[str] = []
    for e in found:
        el = e.lower()
        if el not in uniq:
            uniq.append(el)
    return uniq


def match_customer_from_email_text(db: Session, text: str) -> Customer | None:
    emails = extract_emails_from_text(text)
    for email in emails:
        if email.endswith("@titanimaging.com") or email.endswith("@titan-imaging.com"):
            continue
        c = db.scalar(select(Customer).where(func.lower(Customer.email) == email))
        if c:
            return c
    for email in emails:
        c = db.scalar(select(Customer).where(func.lower(Customer.email) == email))
        if c:
            return c
    return None


def rule_based_extract(text: str, *, current_stage: str = "new") -> dict[str, Any]:
    """Fallback when AI is disabled — keyword heuristics."""
    lower = (text or "").lower()
    outcome = "other"
    if any(w in lower for w in ("not interested", "unsubscribe", "stop emailing", "no thanks")):
        outcome = "not_interested"
    elif any(w in lower for w in ("closed", "signed", "purchase order", "po sent", "won the deal")):
        outcome = "won"
    elif any(w in lower for w in ("meeting", "demo scheduled", "site visit", "calendar invite")):
        outcome = "meeting_set"
    elif any(w in lower for w in ("interested", "send quote", "pricing", "want to buy", "looking for")):
        outcome = "interested"
    elif any(w in lower for w in ("call back", "callback", "follow up", "next week")):
        outcome = "callback"
    elif any(w in lower for w in ("too expensive", "budget", "competitor", "concern")):
        outcome = "objection"

    offer = None
    if "audit" in lower:
        offer = "audit"
    elif "used" in lower or "refurbished" in lower:
        offer = "used_system"
    elif "new system" in lower or "new pet" in lower:
        offer = "new_system"
    elif "sell" in lower and ("equipment" in lower or "scanner" in lower):
        offer = "sell_to_titan"
    elif "part" in lower:
        offer = "parts"

    suggested = suggest_stage_from_outcome(outcome, current_stage)
    summary = (text or "").strip().split("\n")[0][:280] or "Engagement logged"
    return {
        "summary": summary,
        "outcome": outcome,
        "interest_tags": [],
        "offer_family": offer,
        "ai_sentiment": "neutral",
        "suggested_stage": suggested,
        "sale_amount_hint_cents": None,
        "next_actions": _default_next_actions(outcome, suggested),
    }


def _default_next_actions(outcome: str, stage: str | None) -> list[dict[str, str]]:
    actions: list[dict[str, str]] = []
    if outcome in ("interested", "meeting_set", "callback", "objection"):
        actions.append(
            {"id": "draft_email", "label": "Draft follow-up email", "href": "/workbench/studio?mode=text"}
        )
        actions.append(
            {"id": "log_call", "label": "Log another call", "href": "/workbench/studio?mode=agent"}
        )
    if outcome == "won" or stage == "won":
        actions.append({"id": "record_sale", "label": "Record sale", "href": "/workbench/sales"})
    if stage and stage not in ("won", "lost"):
        actions.append(
            {
                "id": "view_customer",
                "label": "Open customer dossier",
                "href": "",
            }
        )
    return actions


async def ai_extract_engagement(
    *,
    text: str,
    customer: Customer,
    channel: str,
    dossier: dict[str, Any] | None = None,
) -> dict[str, Any]:
    current = getattr(customer, "lead_stage", None) or "new"
    try:
        skill = _skill_text()
        system = (
            "You extract structured CRM engagement data from a staff note or email thread. "
            "Return ONLY valid JSON with keys: summary (string), outcome "
            "(interested|callback|objection|not_interested|meeting_set|won|lost|other), "
            "interest_tags (string[]), offer_family (parts|audit|used_system|new_system|sell_to_titan|null), "
            "ai_sentiment (positive|neutral|negative), suggested_stage "
            "(new|contacted|engaged|qualified|proposal|won|lost), "
            "sale_amount_hint_cents (int|null), next_actions "
            "(array of {id,label} for staff — never invent commission amounts to post). "
            "Never auto-post commissions. Prefer advancing stage conservatively.\n\n"
            f"{skill}"
        )
        user = json.dumps(
            {
                "channel": channel,
                "current_lead_stage": current,
                "customer": {
                    "email": customer.email,
                    "name": customer.name,
                    "company": customer.company,
                    "lead_stage": current,
                },
                "dossier": dossier or {},
                "staff_text": text[:30_000],
            },
            default=str,
        )
        raw = await chat_completion(
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            model=resolve_model("sentiment"),
            response_format="json",
            temperature=0.2,
            max_tokens=900,
        )
        data = json.loads(raw)
        outcome = data.get("outcome") if data.get("outcome") in OUTCOMES else "other"
        suggested = normalize_stage(data.get("suggested_stage")) or suggest_stage_from_outcome(
            outcome, current
        )
        offer = data.get("offer_family")
        if offer not in OFFER_FAMILIES:
            offer = None
        tags = data.get("interest_tags") or []
        if not isinstance(tags, list):
            tags = []
        hint = data.get("sale_amount_hint_cents")
        try:
            hint_i = int(hint) if hint is not None else None
        except (TypeError, ValueError):
            hint_i = None
        actions = data.get("next_actions") or _default_next_actions(outcome, suggested)
        if not isinstance(actions, list):
            actions = _default_next_actions(outcome, suggested)
        return {
            "summary": str(data.get("summary") or text[:280])[:2000],
            "outcome": outcome,
            "interest_tags": [str(t)[:80] for t in tags][:20],
            "offer_family": offer,
            "ai_sentiment": str(data.get("ai_sentiment") or "neutral")[:40],
            "suggested_stage": suggested,
            "sale_amount_hint_cents": hint_i,
            "next_actions": actions[:8],
        }
    except (AiDisabledError, AiError, json.JSONDecodeError, TypeError) as exc:
        logger.info("engagement AI extract fallback: %s", exc)
        return rule_based_extract(text, current_stage=current)


def recompute_fit_for_customer(db: Session, customer: Customer) -> list[dict[str, Any]]:
    from app.ai.fit_scores import compute_fit_scores_for_customer, persist_scores_for_customer

    scores = compute_fit_scores_for_customer(db, customer)
    persist_scores_for_customer(db, customer.id, scores)
    return scores


def analytics_overview(db: Session, *, hours: int = 24) -> dict[str, Any]:
    now = dt.datetime.now(dt.timezone.utc)
    since = now - dt.timedelta(hours=hours)

    stage_rows = db.execute(
        select(Customer.lead_stage, func.count())
        .group_by(Customer.lead_stage)
    ).all()
    pipeline = {s: 0 for s in LEAD_STAGES}
    for stage, count in stage_rows:
        key = stage if stage in pipeline else "new"
        pipeline[key] = int(count)

    total_open = sum(pipeline[s] for s in LEAD_STAGES if s not in ("won", "lost"))
    won = pipeline.get("won", 0)
    conversion_rate = (won / (won + total_open)) if (won + total_open) else 0.0

    recent = list(
        db.execute(
            select(CustomerEngagement, Customer)
            .join(Customer, Customer.id == CustomerEngagement.customer_id)
            .order_by(CustomerEngagement.occurred_at.desc())
            .limit(40)
        ).all()
    )

    pending = [
        (e, c)
        for e, c in recent
        if e.suggested_stage
        and not e.applied_stage
        and e.suggested_stage != (c.lead_stage or "new")
    ]

    progressions: list[dict[str, Any]] = []
    for e, c in pending[:15]:
        progressions.append(
            {
                "type": "stage_suggestion",
                "title": f"Suggested {e.suggested_stage} for {c.company or c.email}",
                "detail": e.ai_summary or e.summary,
                "customer_id": str(c.id),
                "customer_email": c.email,
                "engagement_id": str(e.id),
                "current_stage": c.lead_stage or "new",
                "suggested_stage": e.suggested_stage,
                "actions": [
                    {
                        "id": "apply_stage",
                        "label": f"Move to {e.suggested_stage}",
                        "href": f"/workbench/customers/{c.id}",
                    },
                    {
                        "id": "studio_agent",
                        "label": "Open Studio Agent",
                        "href": f"/workbench/studio?mode=agent&customer={c.id}",
                    },
                    {
                        "id": "draft_email",
                        "label": "Draft nurture",
                        "href": f"/workbench/studio?mode=text&customer={c.id}",
                    },
                ],
            }
        )

    # Stalled qualified
    week_ago = now - dt.timedelta(days=7)
    stalled = list(
        db.execute(
            select(Customer)
            .where(Customer.lead_stage == "qualified", Customer.updated_at < week_ago)
            .order_by(Customer.updated_at.asc())
            .limit(10)
        )
        .scalars()
        .all()
    )
    for c in stalled:
        progressions.append(
            {
                "type": "stalled",
                "title": f"Qualified 7d+ — no proposal ({c.company or c.email})",
                "detail": "Lead has been qualified without stage movement for a week.",
                "customer_id": str(c.id),
                "customer_email": c.email,
                "current_stage": "qualified",
                "actions": [
                    {
                        "id": "studio_agent",
                        "label": "Log outreach",
                        "href": f"/workbench/studio?mode=agent&customer={c.id}",
                    },
                    {
                        "id": "record_sale",
                        "label": "Record sale",
                        "href": "/workbench/sales",
                    },
                ],
            }
        )

    for e, c in recent[:12]:
        if e.channel in ("email_inbound", "email_paste") and e.outcome in (
            "interested",
            "meeting_set",
            "callback",
        ):
            progressions.append(
                {
                    "type": "email_signal",
                    "title": f"Email signal — {e.outcome} ({c.company or c.email})",
                    "detail": e.ai_summary or e.summary,
                    "customer_id": str(c.id),
                    "customer_email": c.email,
                    "engagement_id": str(e.id),
                    "current_stage": c.lead_stage or "new",
                    "actions": [
                        {
                            "id": "studio_agent",
                            "label": "Open Studio Agent",
                            "href": f"/workbench/studio?mode=agent&customer={c.id}",
                        },
                        {
                            "id": "log_call",
                            "label": "Log call",
                            "href": f"/workbench/studio?mode=agent&customer={c.id}",
                        },
                    ],
                }
            )

    # De-dupe by customer_id + type
    seen: set[str] = set()
    unique_prog = []
    for p in progressions:
        key = f"{p.get('type')}:{p.get('customer_id')}"
        if key in seen:
            continue
        seen.add(key)
        unique_prog.append(p)

    recent_out = []
    for e, c in recent[:25]:
        item = engagement_to_out(e)
        item["customer_email"] = c.email
        item["customer_name"] = c.name
        item["customer_company"] = c.company
        item["customer_lead_stage"] = c.lead_stage or "new"
        recent_out.append(item)

    return {
        "pipeline": pipeline,
        "conversion_rate": round(conversion_rate, 4),
        "open_leads": total_open,
        "won": won,
        "recent_engagements": recent_out,
        "progressions": unique_prog[:20],
        "generated_at": now.isoformat(),
        "window_hours": hours,
    }


def apply_engagement_stage(
    db: Session,
    engagement_id: uuid.UUID,
    *,
    stage: str | None = None,
) -> CustomerEngagement:
    row = db.get(CustomerEngagement, engagement_id)
    if not row:
        raise ValueError("Engagement not found")
    customer = db.get(Customer, row.customer_id)
    if not customer:
        raise ValueError("Customer not found")
    target = normalize_stage(stage) or normalize_stage(row.suggested_stage)
    if not target:
        raise ValueError("No stage to apply")
    if should_advance(customer.lead_stage or "new", target) or target == "lost":
        customer.lead_stage = target
        row.applied_stage = target
    return row
