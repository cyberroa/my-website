from __future__ import annotations

import datetime as dt
import logging
import uuid

from fastapi import BackgroundTasks

from app.ai.client import AiDisabledError, ai_is_ready, resolve_model
from app.ai.sentiment import analyze_submission_text
from app.db import SessionLocal
from app.models import ContactSubmission, SellSubmission
from app.settings import get_settings

logger = logging.getLogger(__name__)


async def _analyze_and_store(
    *,
    kind: str,
    submission_id: uuid.UUID,
    name: str,
    email: str,
    subject: str | None,
    body: str,
) -> None:
    if not ai_is_ready():
        return
    db = SessionLocal()
    try:
        result = await analyze_submission_text(
            kind=kind,
            name=name,
            email=email,
            subject=subject,
            body=body,
        )
        model = resolve_model("sentiment")
        now = dt.datetime.now(dt.timezone.utc)
        if kind == "contact":
            row = db.get(ContactSubmission, submission_id)
        else:
            row = db.get(SellSubmission, submission_id)
        if not row:
            return
        row.ai_sentiment = result.sentiment
        row.ai_intent = result.intent
        row.ai_urgency = result.urgency
        row.ai_summary = (result.one_line_summary or "")[:280]
        row.ai_model = model
        row.ai_analyzed_at = now
        db.commit()
    except AiDisabledError:
        return
    except Exception:
        logger.exception("Sentiment analysis failed for %s %s", kind, submission_id)
        db.rollback()
    finally:
        db.close()


def enqueue_sentiment_analysis(
    background_tasks: BackgroundTasks,
    *,
    kind: str,
    submission_id: uuid.UUID,
    name: str,
    email: str,
    subject: str | None,
    body: str,
) -> None:
    settings = get_settings()
    if not settings.ai_enabled or not (settings.openrouter_api_key or "").strip():
        return
    background_tasks.add_task(
        _analyze_and_store,
        kind=kind,
        submission_id=submission_id,
        name=name,
        email=email,
        subject=subject,
        body=body,
    )


async def _enrich_imported_customers(customer_ids: list[uuid.UUID]) -> None:
    from app.ai.profile import post_import_enrich

    db = SessionLocal()
    try:
        n = await post_import_enrich(db, customer_ids)
        logger.info("Post-import AI enrichment completed for %s customers", n)
    except Exception:
        logger.exception("Post-import enrichment batch failed")
    finally:
        db.close()


def enqueue_import_profile_enrichment(
    background_tasks: BackgroundTasks,
    customer_ids: list[uuid.UUID],
) -> None:
    settings = get_settings()
    if not settings.ai_enabled or not (settings.openrouter_api_key or "").strip():
        return
    if not customer_ids:
        return
    background_tasks.add_task(_enrich_imported_customers, customer_ids)
