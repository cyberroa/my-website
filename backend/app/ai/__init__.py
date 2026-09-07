"""OpenRouter-backed AI helpers for Phase 4B (briefings, sentiment, later CRM automation)."""

from app.ai.briefing import ensure_customer_briefing, generate_customer_briefing
from app.ai.client import AiDisabledError, AiError, chat_completion, resolve_model
from app.ai.sentiment import analyze_submission_text

__all__ = [
    "AiDisabledError",
    "AiError",
    "analyze_submission_text",
    "chat_completion",
    "ensure_customer_briefing",
    "generate_customer_briefing",
    "resolve_model",
]
