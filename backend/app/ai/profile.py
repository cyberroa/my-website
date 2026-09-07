from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.ai.briefing import ensure_customer_briefing
from app.ai.client import AiDisabledError, chat_completion, resolve_model
from app.ai.prompts import PROFILE_SYSTEM, profile_user_prompt
from app.models import Customer
from app.settings import get_settings

logger = logging.getLogger(__name__)


async def enrich_customer_profile(db: Session, customer: Customer) -> dict[str, Any] | None:
    """Suggest tags/notes from import row + customer fields; merge into customer."""
    row = {
        "email": customer.email,
        "name": customer.name,
        "company": customer.company,
        "phone": customer.phone,
        "role": customer.role,
        "tags": list(customer.tags or []),
        "source": customer.source,
        "notes": customer.notes,
    }
    try:
        raw = await chat_completion(
            messages=[
                {"role": "system", "content": PROFILE_SYSTEM},
                {"role": "user", "content": profile_user_prompt(json.dumps(row, default=str))},
            ],
            model=resolve_model("profile"),
            response_format="json",
            temperature=0.25,
            max_tokens=400,
        )
        data = json.loads(raw)
    except (AiDisabledError, json.JSONDecodeError, Exception):
        logger.exception("Profile enrichment failed for %s", customer.email)
        return None

    suggested = data.get("suggested_tags") or []
    if isinstance(suggested, list) and suggested:
        merged = sorted(set(list(customer.tags or []) + [str(t).strip() for t in suggested if str(t).strip()]))
        customer.tags = merged

    note = (data.get("profile_note") or "").strip()
    if note:
        prefix = customer.notes or ""
        if note not in prefix:
            customer.notes = f"{prefix}\n\n[AI profile] {note}".strip() if prefix else f"[AI profile] {note}"

    db.commit()
    db.refresh(customer)
    return data


async def post_import_enrich(db: Session, customer_ids: list) -> int:
    """Enrich a batch of customers after import; returns count processed."""
    if not get_settings().ai_enabled:
        return 0
    count = 0
    for cid in customer_ids:
        c = db.get(Customer, cid)
        if not c:
            continue
        try:
            await enrich_customer_profile(db, c)
            await ensure_customer_briefing(db, c)
            count += 1
        except AiDisabledError:
            break
        except Exception:
            logger.exception("Post-import enrich failed for %s", cid)
    return count
