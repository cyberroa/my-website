from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel


class SentimentResult(BaseModel):
    sentiment: Literal["positive", "neutral", "frustrated", "urgent"] = "neutral"
    intent: Literal[
        "parts_inquiry",
        "service_request",
        "sell_equipment",
        "general",
        "other",
    ] = "general"
    urgency: Literal["low", "medium", "high"] = "low"
    one_line_summary: str = ""


class CustomerBriefingOut(BaseModel):
    customer_id: str
    content: str
    model: str
    timeline_hash: str
    generated_at: datetime
    cached: bool = False
    score: float | None = None


class AiStatusOut(BaseModel):
    enabled: bool
    configured: bool
    default_model: str
    briefing_model: str
    sentiment_model: str


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


# Loose context blob passed into briefing prompts
BriefingContext = dict[str, Any]

SentimentResultDict = dict[str, Any]
