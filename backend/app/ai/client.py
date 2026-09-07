from __future__ import annotations

import logging
from typing import Any, Literal

import httpx

from app.settings import Settings, get_settings

logger = logging.getLogger(__name__)


class AiError(Exception):
    """Raised when OpenRouter returns an error or unexpected payload."""


class AiDisabledError(AiError):
    """Raised when AI is turned off or the API key is missing."""


def resolve_model(
    purpose: Literal[
        "default",
        "briefing",
        "sentiment",
        "segment",
        "campaign",
        "daily_report",
        "studio",
        "profile",
    ],
    settings: Settings | None = None,
) -> str:
    s = settings or get_settings()
    overrides = {
        "briefing": s.ai_model_briefing,
        "sentiment": s.ai_model_sentiment,
        "segment": s.ai_model_segment,
        "campaign": s.ai_model_campaign,
        "daily_report": s.ai_model_daily_report,
        "studio": s.ai_model_studio,
        "profile": s.ai_model_profile,
    }
    override = overrides.get(purpose)
    if override:
        return override
    return s.ai_model_default


def ai_is_ready(settings: Settings | None = None) -> bool:
    s = settings or get_settings()
    return bool(s.ai_enabled and (s.openrouter_api_key or "").strip())


async def chat_completion(
    *,
    messages: list[dict[str, str]],
    model: str | None = None,
    response_format: Literal["text", "json"] = "text",
    temperature: float = 0.3,
    max_tokens: int = 800,
    settings: Settings | None = None,
    timeout: float = 45.0,
) -> str:
    s = settings or get_settings()
    if not s.ai_enabled:
        raise AiDisabledError("AI is disabled (AI_ENABLED=false)")
    key = (s.openrouter_api_key or "").strip()
    if not key:
        raise AiDisabledError("OPENROUTER_API_KEY is not configured")

    use_model = model or s.ai_model_default
    headers: dict[str, str] = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if s.openrouter_http_referer:
        headers["HTTP-Referer"] = s.openrouter_http_referer
    if s.openrouter_app_title:
        headers["X-Title"] = s.openrouter_app_title

    body: dict[str, Any] = {
        "model": use_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format == "json":
        body["response_format"] = {"type": "json_object"}

    url = f"{s.openrouter_base_url.rstrip('/')}/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, headers=headers, json=body)
    except httpx.TimeoutException as exc:
        raise AiError("OpenRouter request timed out") from exc
    except httpx.HTTPError as exc:
        raise AiError(f"OpenRouter network error: {exc}") from exc

    if resp.status_code >= 400:
        detail = resp.text[:500]
        logger.warning("OpenRouter error %s: %s", resp.status_code, detail)
        raise AiError(f"OpenRouter HTTP {resp.status_code}: {detail}")

    data = resp.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AiError("Unexpected OpenRouter response shape") from exc

    if not isinstance(content, str) or not content.strip():
        raise AiError("Empty completion from OpenRouter")
    return content.strip()
