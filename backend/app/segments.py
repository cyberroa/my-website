from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models import Customer, OpportunitySnapshot, Unsubscribe


def build_segment_query(filter_json: dict[str, Any] | None) -> Select:
    """
    Build a SELECT Customer query from a segment's `filter_json`.

    Supported keys (all optional, AND-combined):
      - consent_marketing: bool
      - source: str (exact match)
      - tags_any: list[str] (customer.tags && filter)
      - tags_all: list[str] (customer.tags @> filter)
      - email_contains: str (ILIKE)
      - company_contains: str (ILIKE)
      - exclude_unsubscribed: bool (default true)
      - opportunity_types: list[str] (Phase J — recent opportunity snapshots)
      - opportunity_max_age_days: int (default 7)
      - min_opportunity_score: float (optional)
    """
    f = filter_json or {}
    q: Select = select(Customer)

    if f.get("consent_marketing") is True:
        q = q.where(Customer.consent_marketing.is_(True))
    elif f.get("consent_marketing") is False:
        q = q.where(Customer.consent_marketing.is_(False))

    source = f.get("source")
    if isinstance(source, str) and source.strip():
        q = q.where(Customer.source == source.strip())

    tags_any = f.get("tags_any") or []
    if isinstance(tags_any, list) and tags_any:
        q = q.where(Customer.tags.op("&&")(list(tags_any)))

    tags_all = f.get("tags_all") or []
    if isinstance(tags_all, list) and tags_all:
        q = q.where(Customer.tags.op("@>")(list(tags_all)))

    ec = f.get("email_contains")
    if isinstance(ec, str) and ec.strip():
        q = q.where(Customer.email.ilike(f"%{ec.strip()}%"))

    cc = f.get("company_contains")
    if isinstance(cc, str) and cc.strip():
        q = q.where(Customer.company.ilike(f"%{cc.strip()}%"))

    if f.get("exclude_unsubscribed", True):
        sub_q = select(Unsubscribe.email)
        q = q.where(Customer.email.notin_(sub_q))

    opp_types = f.get("opportunity_types") or []
    if isinstance(opp_types, list) and opp_types:
        max_age = f.get("opportunity_max_age_days", 7)
        try:
            max_age_i = int(max_age)
        except (TypeError, ValueError):
            max_age_i = 7
        since = dt.date.today() - dt.timedelta(days=max(1, max_age_i))
        opp_q = select(OpportunitySnapshot.customer_id).where(
            OpportunitySnapshot.opportunity_type.in_([str(t) for t in opp_types]),
            OpportunitySnapshot.as_of_date >= since,
        )
        min_score = f.get("min_opportunity_score")
        if min_score is not None:
            try:
                opp_q = opp_q.where(OpportunitySnapshot.score >= float(min_score))
            except (TypeError, ValueError):
                pass
        q = q.where(Customer.id.in_(opp_q.distinct()))

    return q.order_by(Customer.created_at.desc())


def segment_count(db: Session, filter_json: dict[str, Any] | None) -> int:
    q = (
        build_segment_query(filter_json)
        .with_only_columns(func.count(Customer.id))
        .order_by(None)
    )
    return int(db.scalar(q) or 0)


def segment_customers(
    db: Session,
    filter_json: dict[str, Any] | None,
    limit: int | None = None,
    offset: int = 0,
) -> list[Customer]:
    q = build_segment_query(filter_json).order_by(Customer.created_at.desc())
    if offset:
        q = q.offset(offset)
    if limit:
        q = q.limit(limit)
    return list(db.execute(q).scalars().all())
