from __future__ import annotations

import datetime as dt
from typing import Any

from sqlalchemy import Select, and_, func, or_, select, union
from sqlalchemy.orm import Session

from app.models import Customer, CustomerFitScore, Segment
from app.segments import build_segment_query

OFFER_FAMILIES = frozenset({"parts", "audit", "used_system", "new_system", "sell_to_titan"})


def _token_clauses(q: str) -> list[Any]:
    tokens = [t for t in q.lower().split() if t]
    if not tokens:
        return []
    clauses = []
    for token in tokens:
        like = f"%{token}%"
        clauses.append(
            or_(
                func.coalesce(Customer.search_document, "").ilike(like),
                Customer.email.ilike(like),
                func.coalesce(Customer.website, "").ilike(like),
            )
        )
    return clauses


def _search_where(q: str | None) -> Any | None:
    if not q or not q.strip():
        return None
    term = q.strip()
    like_full = f"%{term.lower()}%"
    conditions: list[Any] = [
        func.coalesce(Customer.search_document, "").ilike(like_full),
        Customer.email.ilike(like_full),
        func.coalesce(Customer.name, "").ilike(like_full),
        func.coalesce(Customer.company, "").ilike(like_full),
        func.coalesce(Customer.website, "").ilike(like_full),
        func.coalesce(Customer.phone, "").ilike(like_full),
        func.coalesce(Customer.role, "").ilike(like_full),
        func.coalesce(Customer.source, "").ilike(like_full),
        func.coalesce(Customer.notes, "").ilike(like_full),
    ]
    token_clauses = _token_clauses(term)
    if token_clauses:
        conditions.append(and_(*token_clauses) if len(token_clauses) > 1 else token_clauses[0])
    return or_(*conditions)


def _best_fit_subquery(offer_family: str, days: int = 7):
    since = dt.date.today() - dt.timedelta(days=days)
    ranked = (
        select(
            CustomerFitScore.customer_id.label("customer_id"),
            CustomerFitScore.score.label("score"),
            func.row_number()
            .over(
                partition_by=CustomerFitScore.customer_id,
                order_by=(CustomerFitScore.score.desc(), CustomerFitScore.as_of_date.desc()),
            )
            .label("rn"),
        )
        .where(
            CustomerFitScore.offer_family == offer_family,
            CustomerFitScore.as_of_date >= since,
        )
        .subquery()
    )
    return select(ranked.c.customer_id, ranked.c.score).where(ranked.c.rn == 1).subquery()


def _union_segment_ids(segment_filters: list[dict[str, Any]]) -> Select | None:
    if not segment_filters:
        return None
    selects = [build_segment_query(f).with_only_columns(Customer.id) for f in segment_filters]
    if len(selects) == 1:
        return selects[0]
    return union(*selects)


def search_customers(
    db: Session,
    q: str | None,
    *,
    segment_filter_json: dict[str, Any] | None = None,
    segment_filters: list[dict[str, Any]] | None = None,
    tag: str | None = None,
    offer_family: str | None = None,
    limit: int = 25,
    offset: int = 0,
) -> tuple[list[tuple[Customer, float | None]], int]:
    filters = list(segment_filters or [])
    if segment_filter_json is not None:
        filters.append(segment_filter_json)

    best = _best_fit_subquery(offer_family) if offer_family else None
    if best is not None:
        base: Select = select(Customer, best.c.score).join(best, best.c.customer_id == Customer.id)
    else:
        base = select(Customer)

    id_scope = _union_segment_ids(filters)
    if id_scope is not None:
        base = base.where(Customer.id.in_(id_scope))

    if tag:
        base = base.where(Customer.tags.any(tag))

    where = _search_where(q)
    if where is not None:
        base = base.where(where)

    if best is not None:
        base = base.order_by(best.c.score.desc(), Customer.created_at.desc())
    else:
        base = base.order_by(Customer.created_at.desc())

    count_stmt = base.with_only_columns(Customer.id).order_by(None)
    total = int(db.scalar(select(func.count()).select_from(count_stmt.subquery())) or 0)

    page = db.execute(base.offset(offset).limit(limit)).all()
    if best is not None:
        return [(row[0], float(row[1]) if row[1] is not None else None) for row in page], total
    return [(row[0], None) for row in page], total


def search_segments(
    db: Session,
    q: str | None,
    *,
    limit: int = 25,
    offset: int = 0,
) -> tuple[list[Segment], int]:
    base = select(Segment)
    if q and q.strip():
        term = q.strip()
        like = f"%{term.lower()}%"
        base = base.where(
            or_(
                Segment.name.ilike(like),
                Segment.slug.ilike(like),
                func.coalesce(Segment.description, "").ilike(like),
            )
        ).order_by(Segment.name.asc())
    else:
        base = base.order_by(Segment.name.asc())

    count_q = base.with_only_columns(func.count(Segment.id)).order_by(None)
    total = int(db.scalar(count_q) or 0)
    rows = db.execute(base.offset(offset).limit(limit)).scalars().all()
    return list(rows), total
