from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.engagement import compute_score
from app.models import Customer, CustomerEngagementSnapshot, Event


def snapshot_date_today() -> dt.date:
    return dt.datetime.now(dt.timezone.utc).date()


def run_engagement_snapshots(db: Session, *, for_date: dt.date | None = None) -> dict[str, int]:
    """Compute daily engagement scores for all customers with events."""
    day = for_date or snapshot_date_today()
    now = dt.datetime.now(dt.timezone.utc)

    customer_ids = db.execute(
        select(Event.customer_id)
        .where(Event.customer_id.isnot(None))
        .distinct()
    ).scalars().all()

    scores: list[tuple[uuid.UUID, float]] = []
    for cid in customer_ids:
        if not cid:
            continue
        events = (
            db.execute(select(Event).where(Event.customer_id == cid)).scalars().all()
        )
        score = compute_score(list(events), now)
        scores.append((cid, score))

    scores.sort(key=lambda x: x[1], reverse=True)
    written = 0
    for rank, (cid, score) in enumerate(scores, start=1):
        existing = db.scalar(
            select(CustomerEngagementSnapshot).where(
                CustomerEngagementSnapshot.customer_id == cid,
                CustomerEngagementSnapshot.snapshot_date == day,
            )
        )
        if existing:
            existing.score = score
            existing.rank = rank
        else:
            db.add(
                CustomerEngagementSnapshot(
                    id=uuid.uuid4(),
                    customer_id=cid,
                    snapshot_date=day,
                    score=score,
                    rank=rank,
                )
            )
        written += 1
    db.commit()
    return {"snapshots_written": written, "snapshot_date": day.isoformat()}


def customer_warmth_history(
    db: Session, customer_id: uuid.UUID, limit: int = 30
) -> list[dict]:
    rows = (
        db.execute(
            select(CustomerEngagementSnapshot)
            .where(CustomerEngagementSnapshot.customer_id == customer_id)
            .order_by(CustomerEngagementSnapshot.snapshot_date.asc())
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return [
        {
            "date": r.snapshot_date.isoformat(),
            "score": float(r.score),
            "rank": r.rank,
        }
        for r in rows
    ]


def warmth_movers(db: Session, days: int = 7, limit: int = 10) -> dict[str, list]:
    """Compare latest snapshot to prior for warmer/colder lists."""
    latest_date = db.scalar(select(func.max(CustomerEngagementSnapshot.snapshot_date)))
    if not latest_date:
        return {"warmers": [], "coolers": []}

    prior_date = latest_date - dt.timedelta(days=days)
    latest = {
        r.customer_id: float(r.score)
        for r in db.execute(
            select(CustomerEngagementSnapshot).where(
                CustomerEngagementSnapshot.snapshot_date == latest_date
            )
        ).scalars().all()
    }
    prior = {
        r.customer_id: float(r.score)
        for r in db.execute(
            select(CustomerEngagementSnapshot).where(
                CustomerEngagementSnapshot.snapshot_date == prior_date
            )
        ).scalars().all()
    }

    deltas: list[tuple[uuid.UUID, float]] = []
    for cid, score in latest.items():
        old = prior.get(cid, 0.0)
        deltas.append((cid, score - old))

    deltas.sort(key=lambda x: x[1], reverse=True)
    warmers = []
    for cid, delta in deltas[:limit]:
        if delta <= 0:
            break
        c = db.get(Customer, cid)
        if c:
            warmers.append({"customer_id": str(cid), "email": c.email, "name": c.name, "delta": round(delta, 1)})

    coolers = []
    for cid, delta in sorted(deltas, key=lambda x: x[1])[:limit]:
        if delta >= 0:
            break
        c = db.get(Customer, cid)
        if c:
            coolers.append({"customer_id": str(cid), "email": c.email, "name": c.name, "delta": round(delta, 1)})

    return {"warmers": warmers, "coolers": coolers}
