"""Shared work mailbox connectors (Gmail / Microsoft 365).

OAuth tokens are stored when provided; sync is a no-op until credentials exist.
Paste/forward path does not require a connection.
"""

from __future__ import annotations

import base64
import datetime as dt
import logging
import uuid
from typing import Any, Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.engagement import (
    ai_extract_engagement,
    create_engagement,
    match_customer_from_email_text,
    recompute_fit_for_customer,
)
from app.models import MailboxConnection
from app.settings import get_settings

logger = logging.getLogger(__name__)


def _enc(value: str | None) -> str | None:
    if not value:
        return None
    # Lightweight obfuscation for local/staging; replace with KMS in production.
    return base64.urlsafe_b64encode(value.encode("utf-8")).decode("ascii")


def _dec(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return base64.urlsafe_b64decode(value.encode("ascii")).decode("utf-8")
    except Exception:
        return None


class MailboxProvider(Protocol):
    name: str

    def list_threads_since(
        self,
        *,
        access_token: str,
        cursor: str | None,
        limit: int = 25,
    ) -> tuple[list[dict[str, Any]], str | None]:
        ...

    def get_thread(self, *, access_token: str, thread_id: str) -> dict[str, Any] | None:
        ...


class GmailProvider:
    name = "gmail"

    def list_threads_since(
        self,
        *,
        access_token: str,
        cursor: str | None,
        limit: int = 25,
    ) -> tuple[list[dict[str, Any]], str | None]:
        # Stub until OAuth is configured — returns empty so jobs stay safe.
        _ = (access_token, cursor, limit)
        return [], cursor

    def get_thread(self, *, access_token: str, thread_id: str) -> dict[str, Any] | None:
        _ = (access_token, thread_id)
        return None


class MicrosoftProvider:
    name = "microsoft"

    def list_threads_since(
        self,
        *,
        access_token: str,
        cursor: str | None,
        limit: int = 25,
    ) -> tuple[list[dict[str, Any]], str | None]:
        _ = (access_token, cursor, limit)
        return [], cursor

    def get_thread(self, *, access_token: str, thread_id: str) -> dict[str, Any] | None:
        _ = (access_token, thread_id)
        return None


PROVIDERS: dict[str, MailboxProvider] = {
    "gmail": GmailProvider(),
    "microsoft": MicrosoftProvider(),
}


def connection_to_out(row: MailboxConnection) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "provider": row.provider,
        "email_address": row.email_address,
        "status": row.status,
        "sync_cursor": row.sync_cursor,
        "last_synced_at": row.last_synced_at.isoformat() if row.last_synced_at else None,
        "last_error": row.last_error,
        "has_access_token": bool(row.access_token_enc),
        "has_refresh_token": bool(row.refresh_token_enc),
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def list_connections(
    db: Session, *, connection_id: uuid.UUID | None = None
) -> list[dict[str, Any]]:
    q = select(MailboxConnection).order_by(MailboxConnection.created_at.desc())
    if connection_id:
        q = q.where(MailboxConnection.id == connection_id)
    rows = list(db.execute(q).scalars().all())
    return [connection_to_out(r) for r in rows]


def upsert_connection(
    db: Session,
    *,
    provider: str,
    email_address: str,
    access_token: str | None = None,
    refresh_token: str | None = None,
    created_by: str | None = None,
    status: str = "pending",
) -> MailboxConnection:
    email = email_address.strip().lower()
    row = db.scalar(select(MailboxConnection).where(MailboxConnection.email_address == email))
    if not row:
        row = MailboxConnection(
            id=uuid.uuid4(),
            provider=provider,
            email_address=email,
            created_by=created_by,
        )
        db.add(row)
    row.provider = provider
    row.status = status
    if access_token:
        row.access_token_enc = _enc(access_token)
        row.status = "active"
    if refresh_token:
        row.refresh_token_enc = _enc(refresh_token)
    row.updated_at = dt.datetime.now(dt.timezone.utc)
    db.flush()
    return row


async def sync_mailbox(
    db: Session,
    *,
    connection_id: uuid.UUID | None = None,
    limit: int = 25,
) -> dict[str, Any]:
    """Pull new threads (when tokens exist) and create engagements for matched customers."""
    settings = get_settings()
    _ = settings  # reserved for OAuth client ids later

    q = select(MailboxConnection).where(MailboxConnection.status.in_(("active", "pending")))
    if connection_id:
        q = q.where(MailboxConnection.id == connection_id)
    connections = list(db.execute(q).scalars().all())
    if not connections:
        return {
            "synced": 0,
            "engagements_created": 0,
            "message": "No mailbox connections. Add Gmail or Microsoft via owner settings, or paste threads in Studio Agent.",
        }

    created = 0
    scanned = 0
    for conn in connections:
        provider = PROVIDERS.get(conn.provider)
        if not provider:
            conn.last_error = f"Unknown provider {conn.provider}"
            continue
        token = _dec(conn.access_token_enc)
        if not token:
            conn.last_error = "Missing access token — paste OAuth token or complete connect flow"
            conn.status = "pending"
            continue
        try:
            threads, new_cursor = provider.list_threads_since(
                access_token=token, cursor=conn.sync_cursor, limit=limit
            )
            scanned += len(threads)
            for th in threads:
                thread_id = str(th.get("id") or "")
                body = str(th.get("body") or th.get("snippet") or "")
                if not body.strip():
                    continue
                customer = match_customer_from_email_text(db, body)
                if not customer and th.get("from_email"):
                    from sqlalchemy import func

                    from app.models import Customer

                    customer = db.scalar(
                        select(Customer).where(
                            func.lower(Customer.email) == str(th["from_email"]).lower()
                        )
                    )
                if not customer:
                    continue
                extracted = await ai_extract_engagement(
                    text=body, customer=customer, channel="email_inbound"
                )
                create_engagement(
                    db,
                    customer=customer,
                    channel="email_inbound",
                    summary=extracted["summary"],
                    raw_email=body[:100_000],
                    outcome=extracted["outcome"],
                    interest_tags=extracted.get("interest_tags") or [],
                    offer_family=extracted.get("offer_family"),
                    mailbox_thread_id=thread_id or None,
                    ai_summary=extracted["summary"],
                    ai_sentiment=extracted.get("ai_sentiment"),
                    suggested_stage=extracted.get("suggested_stage"),
                    apply_stage=False,
                    sale_amount_hint_cents=extracted.get("sale_amount_hint_cents"),
                )
                recompute_fit_for_customer(db, customer)
                created += 1
            if new_cursor is not None:
                conn.sync_cursor = new_cursor
            conn.last_synced_at = dt.datetime.now(dt.timezone.utc)
            conn.last_error = None
            if conn.status == "pending" and token:
                conn.status = "active"
        except Exception as exc:
            logger.exception("mailbox sync failed for %s", conn.email_address)
            conn.last_error = str(exc)[:2000]

    return {
        "synced": scanned,
        "engagements_created": created,
        "connections": len(connections),
    }
