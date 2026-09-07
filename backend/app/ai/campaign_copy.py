from __future__ import annotations

import json

from app.ai.client import chat_completion, resolve_model
from app.ai.prompts import CAMPAIGN_SYSTEM, SOCIAL_SYSTEM, campaign_draft_user_prompt, social_draft_user_prompt


async def generate_email_draft(
    *,
    goal: str,
    segment_name: str | None = None,
    context: dict | None = None,
) -> dict:
    ctx = json.dumps(context or {}, default=str)
    raw = await chat_completion(
        messages=[
            {"role": "system", "content": CAMPAIGN_SYSTEM},
            {
                "role": "user",
                "content": campaign_draft_user_prompt(
                    goal=goal, segment_name=segment_name, context_json=ctx
                ),
            },
        ],
        model=resolve_model("campaign"),
        response_format="json",
        temperature=0.5,
        max_tokens=1200,
    )
    return json.loads(raw)


async def generate_social_draft(*, goal: str, context: dict | None = None) -> dict:
    ctx = json.dumps(context or {}, default=str)
    raw = await chat_completion(
        messages=[
            {"role": "system", "content": SOCIAL_SYSTEM},
            {"role": "user", "content": social_draft_user_prompt(goal=goal, context_json=ctx)},
        ],
        model=resolve_model("campaign"),
        response_format="json",
        temperature=0.55,
        max_tokens=800,
    )
    return json.loads(raw)
