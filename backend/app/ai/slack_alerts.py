"""Slack webhook helpers beyond daily briefing."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.ai.evidence import pending_suggestion_count
from app.ai.opportunities import hot_opportunities_above_threshold
from app.models import Segment
from app.settings import get_settings
from sqlalchemy import select

logger = logging.getLogger(__name__)


async def post_slack_text(text: str) -> bool:
    webhook = (get_settings().slack_webhook_url or "").strip()
    if not webhook:
        return False
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(webhook, json={"text": text[:3500]})
            return resp.status_code < 400
    except httpx.HTTPError:
        logger.exception("Slack webhook failed")
        return False


async def alert_hot_opportunities(db: Session, *, min_score: float = 40.0) -> dict[str, Any]:
    rows = hot_opportunities_above_threshold(db, min_score=min_score, days=1)
    if not rows:
        return {"slacked": False, "count": 0}
    lines = [f"*Titan hot opportunities* ({len(rows)} ≥ {min_score})"]
    for r in rows[:12]:
        who = r.get("company") or r.get("name") or r.get("email")
        lines.append(f"• {who} — `{r['opportunity_type']}` score {r['score']}")
    ok = await post_slack_text("\n".join(lines))
    return {"slacked": ok, "count": len(rows)}


async def alert_research_digest(db: Session) -> dict[str, Any]:
    pending = pending_suggestion_count(db)
    recent_playbooks = list(
        db.execute(
            select(Segment)
            .where(Segment.last_researched_at.isnot(None))
            .order_by(Segment.last_researched_at.desc())
            .limit(8)
        )
        .scalars()
        .all()
    )
    if pending == 0 and not recent_playbooks:
        return {"slacked": False, "pending_suggestions": 0, "playbooks": 0}
    lines = ["*Titan research digest*"]
    lines.append(f"• Evidence suggestions awaiting review: *{pending}*")
    for s in recent_playbooks:
        when = s.last_researched_at.isoformat() if s.last_researched_at else "?"
        lines.append(f"• Segment playbook updated: {s.name} ({when})")
    ok = await post_slack_text("\n".join(lines))
    return {
        "slacked": ok,
        "pending_suggestions": pending,
        "playbooks": len(recent_playbooks),
    }
