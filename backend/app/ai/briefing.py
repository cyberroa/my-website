from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.client import chat_completion, resolve_model
from app.ai.prompts import BRIEFING_SYSTEM, briefing_user_prompt
from app.ai.types import CustomerBriefingOut
from app.engagement import compute_score
from app.models import Campaign, CampaignRecipient, Customer, CustomerBriefing, Event
from app.settings import get_settings

logger = logging.getLogger(__name__)


def _timeline_payload_for_hash(items: list[dict[str, Any]]) -> str:
    # Stable subset so hash ignores ordering noise from float scores
    return json.dumps(items, sort_keys=True, default=str)


def build_briefing_context(db: Session, customer: Customer) -> tuple[dict[str, Any], str, float]:
    events = (
        db.execute(
            select(Event)
            .where(Event.customer_id == customer.id)
            .order_by(Event.occurred_at.desc())
            .limit(80)
        )
        .scalars()
        .all()
    )
    score = compute_score(list(events))

    event_rows: list[dict[str, Any]] = []
    for ev in events[:40]:
        event_rows.append(
            {
                "type": ev.type,
                "at": ev.occurred_at.isoformat(),
                "url": ev.url,
                "payload": ev.payload or {},
            }
        )

    recipients = (
        db.execute(
            select(CampaignRecipient, Campaign)
            .join(Campaign, Campaign.id == CampaignRecipient.campaign_id)
            .where(CampaignRecipient.email == customer.email)
            .order_by(CampaignRecipient.created_at.desc())
            .limit(20)
        ).all()
    )
    campaign_rows: list[dict[str, Any]] = []
    for recip, camp in recipients:
        campaign_rows.append(
            {
                "campaign": camp.name,
                "status": recip.status,
                "opened_at": recip.opened_at.isoformat() if recip.opened_at else None,
                "clicked_at": recip.clicked_at.isoformat() if recip.clicked_at else None,
                "sent_at": recip.sent_at.isoformat() if recip.sent_at else None,
            }
        )

    context: dict[str, Any] = {
        "customer": {
            "email": customer.email,
            "name": customer.name,
            "company": customer.company,
            "role": customer.role,
            "tags": list(customer.tags or []),
            "source": customer.source,
            "notes": customer.notes,
            "consent_marketing": customer.consent_marketing,
        },
        "engagement_score": score,
        "recent_events": event_rows,
        "campaign_activity": campaign_rows,
    }
    digest = hashlib.sha256(_timeline_payload_for_hash([context]).encode("utf-8")).hexdigest()[:32]
    return context, digest, score


async def generate_customer_briefing(
    db: Session,
    customer: Customer,
    *,
    force: bool = False,
) -> CustomerBriefingOut:
    context, timeline_hash, score = build_briefing_context(db, customer)
    existing = db.get(CustomerBriefing, customer.id)

    if existing and not force and existing.timeline_hash == timeline_hash and existing.content.strip():
        return CustomerBriefingOut(
            customer_id=str(customer.id),
            content=existing.content,
            model=existing.model,
            timeline_hash=existing.timeline_hash,
            generated_at=existing.generated_at,
            cached=True,
            score=score,
        )

    settings = get_settings()
    model = resolve_model("briefing", settings)
    context_json = json.dumps(context, indent=2, default=str)
    # Cap prompt size for very active customers
    if len(context_json) > 12_000:
        context_json = context_json[:12_000] + "\n…(truncated)"

    content = await chat_completion(
        messages=[
            {"role": "system", "content": BRIEFING_SYSTEM},
            {"role": "user", "content": briefing_user_prompt(context_json)},
        ],
        model=model,
        response_format="text",
        temperature=0.35,
        max_tokens=600,
        settings=settings,
    )

    if existing:
        existing.content = content
        existing.model = model
        existing.timeline_hash = timeline_hash
        existing.generated_at = datetime.now(timezone.utc)
        row = existing
    else:
        row = CustomerBriefing(
            customer_id=customer.id,
            content=content,
            model=model,
            timeline_hash=timeline_hash,
        )
        db.add(row)

    db.commit()
    db.refresh(row)

    return CustomerBriefingOut(
        customer_id=str(customer.id),
        content=row.content,
        model=row.model,
        timeline_hash=row.timeline_hash,
        generated_at=row.generated_at,
        cached=False,
        score=score,
    )


async def ensure_customer_briefing(db: Session, customer: Customer) -> CustomerBriefingOut:
    """Return cached briefing or generate; surfaces AiDisabledError to caller."""
    return await generate_customer_briefing(db, customer, force=False)
