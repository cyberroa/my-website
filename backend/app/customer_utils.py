from __future__ import annotations

import re
from typing import Any

from app.models import Customer

HONORIFICS = frozenset({"mr", "mrs", "ms", "miss", "dr", "prof", "sir", "madam"})


def normalize_website(raw: str | None) -> str | None:
    if not raw or not raw.strip():
        return None
    url = raw.strip()
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", url):
        url = f"https://{url.lstrip('/')}"
    return url[:500]


def hostname_for_logo(website: str | None, email: str | None) -> str | None:
    from urllib.parse import urlparse

    host: str | None = None
    if website:
        parsed = urlparse(website if "://" in website else f"https://{website}")
        host = (parsed.hostname or "").lower().strip(".")
        if host.startswith("www."):
            host = host[4:]
    consumer = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com"}
    if (not host or host in consumer) and email and "@" in email:
        domain = email.split("@", 1)[1].lower().strip()
        if domain not in consumer:
            host = domain
    return host or None


def guessed_logo_url(website: str | None, email: str | None) -> str | None:
    host = hostname_for_logo(website, email)
    if not host:
        return None
    return f"https://www.google.com/s2/favicons?domain={host}&sz=128"


def build_customer_search_document(c: Customer) -> str:
    parts = [
        c.email or "",
        c.name or "",
        c.company or "",
        c.website or "",
        c.phone or "",
        c.role or "",
        c.source or "",
        c.notes or "",
        " ".join(c.tags or []),
    ]
    return " ".join(p for p in parts if p).lower()


def refresh_customer_search_document(c: Customer) -> None:
    c.search_document = build_customer_search_document(c)


def parse_first_name(name: str | None) -> str:
    if not name or not name.strip():
        return ""
    parts = name.strip().split()
    if not parts:
        return ""
    token = parts[0].rstrip(".")
    if token.lower() in HONORIFICS and len(parts) > 1:
        token = parts[1].rstrip(".")
    return token


def email_local_part_name(email: str) -> str:
    local = email.split("@", 1)[0]
    local = local.replace(".", " ").replace("_", " ").replace("-", " ")
    word = local.split()[0] if local.split() else local
    return word.title() if word else ""


def customer_template_variables(c: Customer) -> dict[str, Any]:
    full_name = c.name or c.email
    first = parse_first_name(c.name)
    if not first and c.email:
        first = email_local_part_name(c.email)
    return {
        "email": c.email,
        "name": full_name,
        "first_name": first,
        "company": c.company or "",
        "phone": c.phone or "",
        "role": c.role or "",
        "website": c.website or "",
    }


def manual_recipient_variables(email: str) -> dict[str, Any]:
    first = email_local_part_name(email)
    return {
        "email": email,
        "name": email,
        "first_name": first,
        "company": "",
        "phone": "",
        "role": "",
        "website": "",
    }
