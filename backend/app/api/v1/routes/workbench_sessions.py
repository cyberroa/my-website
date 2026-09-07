from __future__ import annotations

import datetime as dt
import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import get_current_workbench_user
from app.db import get_db
from app.engagement import HOT_LEAD_THRESHOLD, compute_score, summarize_session_activity
from app.models import BrowserSession, Customer, Event
from app.schemas import HotLeadOut, LiveSessionCustomerOut, LiveSessionOut

router = APIRouter(prefix="/workbench/sessions", dependencies=[Depends(get_current_workbench_user)])


def _customer_summary(c: Customer | None) -> LiveSessionCustomerOut | None:
    if c is None:
        return None
    return LiveSessionCustomerOut(
        id=str(c.id),
        email=c.email,
        name=c.name,
        company=c.company,
    )


@router.get("/live", response_model=list[LiveSessionOut])
def list_live_sessions(
    minutes: int = Query(default=15, ge=1, le=120),
    db: Session = Depends(get_db),
):
    now = dt.datetime.now(dt.timezone.utc)
    since = now - dt.timedelta(minutes=minutes)

    sessions = db.scalars(
        select(BrowserSession)
        .where(BrowserSession.last_seen_at >= since)
        .options(selectinload(BrowserSession.customer))
        .order_by(BrowserSession.last_seen_at.desc())
        .limit(200)
    ).all()

    if not sessions:
        return []

    session_ids = [s.id for s in sessions]
    events = db.scalars(
        select(Event)
        .where(Event.session_id.in_(session_ids), Event.occurred_at >= since)
        .order_by(Event.occurred_at.desc())
    ).all()

    events_by_session: dict[uuid.UUID, list[Event]] = defaultdict(list)
    for ev in events:
        if ev.session_id is not None:
            events_by_session[ev.session_id].append(ev)

    out: list[LiveSessionOut] = []
    for session in sessions:
        session_events = events_by_session.get(session.id, [])
        activity = summarize_session_activity(session_events)
        out.append(
            LiveSessionOut(
                id=str(session.id),
                first_seen_at=session.first_seen_at,
                last_seen_at=session.last_seen_at,
                score=compute_score(session_events, now),
                current_url=activity["current_url"],  # type: ignore[arg-type]
                latest_search=activity["latest_search"],  # type: ignore[arg-type]
                parts_viewed=activity["parts_viewed"],  # type: ignore[arg-type]
                customer=_customer_summary(session.customer),
            )
        )
    return out


@router.get("/hot-leads", response_model=list[HotLeadOut])
def list_hot_leads(
    hours: int = Query(default=24, ge=1, le=168),
    threshold: float = Query(default=HOT_LEAD_THRESHOLD, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    now = dt.datetime.now(dt.timezone.utc)
    since = now - dt.timedelta(hours=hours)

    events = db.scalars(
        select(Event)
        .where(Event.customer_id.is_not(None), Event.occurred_at >= since)
        .order_by(Event.occurred_at.desc())
    ).all()

    events_by_customer: dict[uuid.UUID, list[Event]] = defaultdict(list)
    for ev in events:
        if ev.customer_id is not None:
            events_by_customer[ev.customer_id].append(ev)

    if not events_by_customer:
        return []

    customer_ids = list(events_by_customer.keys())
    customers = db.scalars(select(Customer).where(Customer.id.in_(customer_ids))).all()
    customer_map = {c.id: c for c in customers}

    leads: list[HotLeadOut] = []
    for customer_id, customer_events in events_by_customer.items():
        score = compute_score(customer_events, now)
        if score < threshold:
            continue
        customer = customer_map.get(customer_id)
        if customer is None:
            continue
        last_seen = max(ev.occurred_at for ev in customer_events)
        leads.append(
            HotLeadOut(
                customer_id=str(customer.id),
                email=customer.email,
                name=customer.name,
                company=customer.company,
                score=score,
                last_seen_at=last_seen,
            )
        )

    leads.sort(key=lambda row: (row.score, row.last_seen_at or now), reverse=True)
    return leads[:limit]
