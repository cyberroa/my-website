"""Normalize Firecrawl extract payloads into listing rows."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urljoin


_PRICE_RE = re.compile(
    r"(?P<cur>\$|USD|EUR|€|£)?\s*(?P<num>\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)",
    re.I,
)
_SKU_CLEAN = re.compile(r"[^A-Za-z0-9\-_/]")


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return (s or "competitor")[:200]


def normalize_part_number(raw: str | None) -> str | None:
    if not raw:
        return None
    cleaned = _SKU_CLEAN.sub("", str(raw).strip().upper())
    return cleaned[:120] or None


def price_to_cents(value: Any) -> tuple[int | None, str]:
    """Parse price to cents + currency (default USD)."""
    currency = "USD"
    if value is None:
        return None, currency
    if isinstance(value, (int, float)):
        return int(round(float(value) * 100)), currency
    text = str(value).strip()
    if not text:
        return None, currency
    if "€" in text or re.search(r"\beur\b", text, re.I):
        currency = "EUR"
    elif "£" in text or re.search(r"\bgbp\b", text, re.I):
        currency = "GBP"
    m = _PRICE_RE.search(text.replace(" ", ""))
    if not m:
        # try plain float
        try:
            return int(round(float(text.replace(",", "")) * 100)), currency
        except ValueError:
            return None, currency
    num = m.group("num").replace(",", "")
    try:
        return int(round(float(num) * 100)), currency
    except ValueError:
        return None, currency


def extract_listings_from_firecrawl(
    data: dict[str, Any],
    *,
    page_url: str,
) -> list[dict[str, Any]]:
    """Pull listing dicts from Firecrawl scrape data."""
    raw_json = data.get("json")
    items: list[Any] = []
    if isinstance(raw_json, dict):
        listings = raw_json.get("listings")
        if isinstance(listings, list):
            items = listings
        elif any(k in raw_json for k in ("title", "sku", "part_number")):
            items = [raw_json]
    elif isinstance(raw_json, list):
        items = raw_json

    out: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()[:500]
        if not title:
            continue
        sku = normalize_part_number(item.get("sku") or item.get("external_sku"))
        pn = normalize_part_number(item.get("part_number") or item.get("sku"))
        price_cents, currency = price_to_cents(item.get("price"))
        if item.get("currency"):
            currency = str(item["currency"]).strip().upper()[:3] or currency
        listing_url = item.get("url") or item.get("listing_url")
        if listing_url:
            listing_url = urljoin(page_url, str(listing_url))
        else:
            listing_url = page_url
        out.append(
            {
                "external_sku": sku,
                "part_number": pn or sku,
                "title": title,
                "price_cents": price_cents,
                "currency": currency,
                "availability": (str(item.get("availability") or "").strip()[:80] or None),
                "listing_url": listing_url,
                "raw_json": item,
            }
        )
    return out
