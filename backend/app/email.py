from __future__ import annotations

import json
from typing import Any

import httpx

from app.email_footer import html_footer, list_unsubscribe_headers, text_footer
from app.settings import get_settings


async def _send_via_resend(body: dict[str, Any]) -> tuple[bool, str | None, dict | None]:
    """Low-level Resend send. Returns (ok, message_id, raw_response)."""
    settings = get_settings()
    if not settings.resend_api_key:
        return False, None, None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                "https://api.resend.com/emails",
                json=body,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            )
        try:
            data = res.json()
        except Exception:
            data = None
        msg_id = None
        if isinstance(data, dict):
            msg_id = data.get("id") or data.get("message_id")
        return res.is_success, msg_id, data if isinstance(data, dict) else None
    except Exception:
        return False, None, None


async def send_customer_email(
    to_email: str,
    subject: str,
    text: str,
    *,
    html: str | None = None,
    campaign_id: str | None = None,
    tags: list[dict[str, str]] | None = None,
    include_footer: bool = True,
) -> bool:
    """
    Send a transactional/marketing email to a customer. Appends the CAN-SPAM footer,
    sets List-Unsubscribe headers, and returns False if skipped/failed.
    Callers should check suppression list before calling this.
    """
    ok, _msg_id, _ = await _send_customer_email_full(
        to_email=to_email,
        subject=subject,
        text=text,
        html=html,
        campaign_id=campaign_id,
        tags=tags,
        include_footer=include_footer,
    )
    return ok


async def _send_customer_email_full(
    to_email: str,
    subject: str,
    text: str,
    *,
    html: str | None = None,
    campaign_id: str | None = None,
    tags: list[dict[str, str]] | None = None,
    include_footer: bool = True,
) -> tuple[bool, str | None, dict | None]:
    settings = get_settings()
    if not settings.resend_api_key:
        return False, None, None
    email_from = settings.email_from_customer or settings.email_from or settings.admin_notify_email
    if not email_from:
        return False, None, None

    final_text = text + (text_footer(to_email, campaign_id) if include_footer else "")
    final_html = html
    if html is not None and include_footer:
        final_html = html + html_footer(to_email, campaign_id)

    body: dict[str, Any] = {
        "from": email_from,
        "to": [to_email],
        "subject": subject,
        "text": final_text,
    }
    if final_html:
        body["html"] = final_html
    if include_footer:
        body["headers"] = list_unsubscribe_headers(to_email, campaign_id)
    if tags:
        body["tags"] = tags

    return await _send_via_resend(body)


async def send_campaign_email(
    to_email: str,
    subject: str,
    text: str,
    *,
    html: str | None = None,
    campaign_id: str | None = None,
    tags: list[dict[str, str]] | None = None,
) -> tuple[bool, str | None]:
    """Send a campaign email. Returns (ok, resend_message_id)."""
    ok, msg_id, _ = await _send_customer_email_full(
        to_email=to_email,
        subject=subject,
        text=text,
        html=html,
        campaign_id=campaign_id,
        tags=tags,
        include_footer=True,
    )
    return ok, msg_id


async def send_bulk_emails(recipients: list[str], subject: str, text: str) -> int:
    """Send the same message to each recipient. Returns count of successful sends."""
    n = 0
    for addr in recipients:
        if await send_customer_email(addr.strip(), subject, text):
            n += 1
    return n


async def send_admin_email(to_email: str, subject: str, html: str, text: str | None = None) -> bool:
    """Staff/internal email without marketing footer."""
    settings = get_settings()
    if not settings.resend_api_key:
        return False
    email_from = settings.email_from or settings.admin_notify_email
    if not email_from:
        return False
    body: dict[str, Any] = {
        "from": email_from,
        "to": [to_email.strip()],
        "subject": subject,
        "html": html,
        "text": text or subject,
    }
    ok, _, _ = await _send_via_resend(body)
    return ok


async def maybe_send_admin_email(subject: str, text: str, payload: dict) -> None:
    """
    Best-effort internal notification. Never raises; failures don't break form UX.
    No unsubscribe footer (internal tool email).
    """
    settings = get_settings()
    if not settings.resend_api_key or not settings.admin_notify_email:
        return

    email_from = settings.email_from or settings.admin_notify_email

    body = {
        "from": email_from,
        "to": [settings.admin_notify_email],
        "subject": subject,
        "text": f"{text}\n\n---\n\n{json.dumps(payload, indent=2, default=str)}",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                "https://api.resend.com/emails",
                json=body,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            )
    except Exception:
        return
