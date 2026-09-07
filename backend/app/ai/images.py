from __future__ import annotations

import logging

import httpx

from app.settings import get_settings

logger = logging.getLogger(__name__)


class GeminiImageError(Exception):
    """Raised when image generation fails for a reason other than missing config."""

    def __init__(self, message: str, *, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


async def generate_gemini_image(prompt: str, *, size: str = "1024x1024") -> str:
    """Generate image via Google Gemini API; returns a data URL.

    Raises:
        GeminiImageError: missing key, HTTP/API failure, or unexpected response shape.
    """
    settings = get_settings()
    key = (settings.google_ai_api_key or "").strip()
    if not key:
        raise GeminiImageError("Image generation not configured (set GOOGLE_AI_API_KEY)")

    model = (settings.gemini_image_model or "").strip()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
    }
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(url, json=body)
    except httpx.HTTPError as exc:
        logger.exception("Gemini image request failed")
        raise GeminiImageError(f"Gemini request failed: {exc}") from exc

    if resp.status_code >= 400:
        detail = resp.text[:400]
        logger.warning("Gemini image error %s: %s", resp.status_code, detail)
        if resp.status_code == 404:
            raise GeminiImageError(
                f"Gemini model '{model}' not found. Set GEMINI_IMAGE_MODEL to an "
                f"image-capable model (e.g. gemini-2.5-flash-image).",
                status_code=404,
            )
        if resp.status_code == 429:
            raise GeminiImageError(
                "Gemini quota exceeded for this API key. Wait and retry, or check "
                "plan/billing in Google AI Studio.",
                status_code=429,
            )
        raise GeminiImageError(
            f"Gemini image API error ({resp.status_code}): {detail}",
            status_code=resp.status_code,
        )

    data = resp.json()
    for cand in data.get("candidates") or []:
        for part in (cand.get("content") or {}).get("parts") or []:
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                return f"data:{mime};base64,{inline['data']}"

    # Sometimes the model returns text-only (safety / refused)
    raise GeminiImageError(
        "Gemini returned no image data. Try a different prompt or model "
        f"(current: {model})."
    )


def store_image_data_url(data_url: str) -> str:
    """For MVP return data URL as-is; production can upload to Supabase Storage."""
    return data_url
