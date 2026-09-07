from __future__ import annotations

import json
import logging
import re

from app.ai.client import chat_completion, resolve_model
from app.ai.prompts import SENTIMENT_SYSTEM, sentiment_user_prompt
from app.ai.types import SentimentResult
from app.settings import get_settings

logger = logging.getLogger(__name__)


def _extract_json(text: str) -> dict:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            return json.loads(match.group(0))
        raise


async def analyze_submission_text(
    *,
    kind: str,
    name: str,
    email: str,
    subject: str | None,
    body: str,
) -> SentimentResult:
    settings = get_settings()
    model = resolve_model("sentiment", settings)
    raw = await chat_completion(
        messages=[
            {"role": "system", "content": SENTIMENT_SYSTEM},
            {
                "role": "user",
                "content": sentiment_user_prompt(
                    kind=kind,
                    subject=subject,
                    body=body,
                    name=name,
                    email=email,
                ),
            },
        ],
        model=model,
        response_format="json",
        temperature=0.1,
        max_tokens=300,
        settings=settings,
    )
    try:
        data = _extract_json(raw)
        return SentimentResult.model_validate(data)
    except Exception:
        logger.exception("Failed to parse sentiment JSON: %s", raw[:300])
        return SentimentResult(
            sentiment="neutral",
            intent="general",
            urgency="low",
            one_line_summary=(body[:120] + "…") if len(body) > 120 else body,
        )
