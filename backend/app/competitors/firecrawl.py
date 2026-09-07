"""Firecrawl HTTP client (scrape + JSON extract)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.settings import Settings, get_settings

logger = logging.getLogger(__name__)

LISTINGS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "listings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sku": {"type": "string", "description": "Part/SKU number if shown"},
                    "part_number": {"type": "string", "description": "GE or OEM part number"},
                    "title": {"type": "string"},
                    "price": {"type": ["number", "string"], "description": "List price if shown"},
                    "currency": {"type": "string"},
                    "availability": {"type": "string"},
                    "url": {"type": "string", "description": "Absolute or relative listing URL"},
                },
                "required": ["title"],
            },
        }
    },
    "required": ["listings"],
}

EXTRACT_PROMPT = (
    "Extract medical imaging / PET-CT / GE parts and equipment listings from this page. "
    "Prefer SKU and part numbers when present. Include price and availability when shown. "
    "Return an empty listings array if this is not a catalog/product page."
)


class FirecrawlError(Exception):
    """Firecrawl API or parse failure."""


class FirecrawlDisabledError(FirecrawlError):
    """Missing API key."""


def firecrawl_is_ready(settings: Settings | None = None) -> bool:
    s = settings or get_settings()
    return bool((s.firecrawl_api_key or "").strip())


async def scrape_url(
    url: str,
    *,
    settings: Settings | None = None,
    timeout: float = 120.0,
) -> dict[str, Any]:
    """Scrape one URL; return Firecrawl data dict (expects .json / markdown)."""
    s = settings or get_settings()
    key = (s.firecrawl_api_key or "").strip()
    if not key:
        raise FirecrawlDisabledError("FIRECRAWL_API_KEY is not configured")

    base = (s.firecrawl_base_url or "https://api.firecrawl.dev").rstrip("/")
    endpoint = f"{base}/v2/scrape"
    payload: dict[str, Any] = {
        "url": url,
        "formats": [
            "markdown",
            {
                "type": "json",
                "schema": LISTINGS_SCHEMA,
                "prompt": EXTRACT_PROMPT,
            },
        ],
        "onlyMainContent": True,
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(endpoint, json=payload, headers=headers)

    if resp.status_code >= 400:
        detail = resp.text[:800]
        logger.warning("Firecrawl scrape failed %s: %s", resp.status_code, detail)
        raise FirecrawlError(f"Firecrawl HTTP {resp.status_code}: {detail}")

    body = resp.json()
    if isinstance(body, dict) and body.get("success") is False:
        raise FirecrawlError(str(body.get("error") or body)[:800])

    # v2 often returns { success, data: { markdown, json, ... } }
    data = body.get("data") if isinstance(body, dict) else None
    if isinstance(data, dict):
        return data
    if isinstance(body, dict) and ("json" in body or "markdown" in body):
        return body
    raise FirecrawlError(f"Unexpected Firecrawl response shape: {str(body)[:400]}")
