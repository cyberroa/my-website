"""Research agent work queue — claimDue leases, tools, skills."""

from __future__ import annotations

import datetime as dt
import json
import logging
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.ai.client import chat_completion, resolve_model
from app.ai.evidence import record_evidence
from app.ai.opportunities import customer_latest_opportunities
from app.models import (
    AgentTask,
    CompetitorListing,
    Customer,
    Event,
    Part,
    Segment,
)
from app.segments import build_segment_query, segment_count

logger = logging.getLogger(__name__)

SKILLS_DIR = Path(__file__).resolve().parent / "skills"
LEASE_MINUTES = 15
DEFAULT_BUDGET = 6  # tool steps per run


def load_skills() -> str:
    parts: list[str] = []
    if SKILLS_DIR.is_dir():
        for path in sorted(SKILLS_DIR.glob("*.md")):
            parts.append(f"## {path.stem}\n\n{path.read_text(encoding='utf-8')}")
    return "\n\n".join(parts) if parts else "Follow evidence rules; never guess."


def enqueue_task(
    db: Session,
    *,
    kind: str,
    subject_type: str,
    subject_id: uuid.UUID,
    reason: str | None = None,
    payload: dict | None = None,
    due_at: dt.datetime | None = None,
    created_by: str | None = None,
) -> AgentTask:
    task = AgentTask(
        id=uuid.uuid4(),
        kind=kind,
        subject_type=subject_type,
        subject_id=subject_id,
        status="pending",
        due_at=due_at or dt.datetime.now(dt.timezone.utc),
        reason=reason,
        payload_json=payload or {},
        created_by=created_by,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def claim_due(db: Session, *, limit: int = 5) -> list[AgentTask]:
    """Lease due tasks with SKIP LOCKED (CompAI claimDue pattern)."""
    now = dt.datetime.now(dt.timezone.utc)
    lease_until = now + dt.timedelta(minutes=LEASE_MINUTES)
    # Release expired leases
    db.execute(
        text(
            """
            UPDATE agent_tasks
            SET status = 'pending', lease_until = NULL
            WHERE status = 'leased' AND lease_until IS NOT NULL AND lease_until < :now
            """
        ),
        {"now": now},
    )
    db.commit()

    rows = list(
        db.execute(
            text(
                """
                SELECT id FROM agent_tasks
                WHERE status = 'pending' AND due_at <= :now
                ORDER BY due_at ASC
                FOR UPDATE SKIP LOCKED
                LIMIT :lim
                """
            ),
            {"now": now, "lim": limit},
        ).all()
    )
    claimed: list[AgentTask] = []
    for (task_id,) in rows:
        task = db.get(AgentTask, task_id)
        if not task:
            continue
        task.status = "leased"
        task.lease_until = lease_until
        task.started_at = now
        claimed.append(task)
    db.commit()
    for t in claimed:
        db.refresh(t)
    return claimed


def task_to_out(t: AgentTask) -> dict[str, Any]:
    return {
        "id": str(t.id),
        "kind": t.kind,
        "subject_type": t.subject_type,
        "subject_id": str(t.subject_id),
        "status": t.status,
        "due_at": t.due_at.isoformat() if t.due_at else None,
        "lease_until": t.lease_until.isoformat() if t.lease_until else None,
        "reason": t.reason,
        "payload_json": t.payload_json or {},
        "result_summary": t.result_summary,
        "steps_json": t.steps_json or [],
        "open_questions": t.open_questions or [],
        "error": t.error,
        "created_by": t.created_by,
        "started_at": t.started_at.isoformat() if t.started_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def list_tasks_for_subject(
    db: Session, subject_type: str, subject_id: uuid.UUID, *, limit: int = 20
) -> list[AgentTask]:
    return list(
        db.execute(
            select(AgentTask)
            .where(AgentTask.subject_type == subject_type, AgentTask.subject_id == subject_id)
            .order_by(AgentTask.created_at.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )


# --- Tools ---


def tool_read_customer_timeline(db: Session, customer_id: uuid.UUID) -> dict:
    c = db.get(Customer, customer_id)
    if not c:
        return {"error": "customer not found"}
    events = list(
        db.execute(
            select(Event)
            .where(Event.customer_id == customer_id)
            .order_by(Event.occurred_at.desc())
            .limit(40)
        )
        .scalars()
        .all()
    )
    opps = customer_latest_opportunities(db, customer_id)
    return {
        "customer": {
            "id": str(c.id),
            "email": c.email,
            "name": c.name,
            "company": c.company,
            "tags": list(c.tags or []),
            "notes": (c.notes or "")[:2000],
            "website": c.website,
            "consent_marketing": c.consent_marketing,
        },
        "recent_events": [
            {"type": e.type, "occurred_at": e.occurred_at.isoformat(), "payload": e.payload or {}}
            for e in events
        ],
        "opportunities": opps,
    }


def tool_read_segment_members(db: Session, segment_id: uuid.UUID) -> dict:
    seg = db.get(Segment, segment_id)
    if not seg:
        return {"error": "segment not found"}
    count = segment_count(db, seg.filter_json)
    q = build_segment_query(seg.filter_json).limit(15)
    members = list(db.execute(q).scalars().all())
    return {
        "segment": {
            "id": str(seg.id),
            "name": seg.name,
            "slug": seg.slug,
            "description": seg.description,
            "labels": list(seg.labels or []),
            "playbook_markdown": (seg.playbook_markdown or "")[:3000],
            "recommended_services": list(seg.recommended_services or []),
            "member_count": count,
        },
        "sample_members": [
            {"id": str(m.id), "email": m.email, "company": m.company, "tags": list(m.tags or [])}
            for m in members
        ],
    }


def tool_search_inventory(db: Session, query: str = "", limit: int = 12) -> dict:
    q = select(Part).order_by(Part.updated_at.desc()).limit(limit)
    if query.strip():
        like = f"%{query.strip()}%"
        q = (
            select(Part)
            .where((Part.part_number.ilike(like)) | (Part.name.ilike(like)))
            .order_by(Part.updated_at.desc())
            .limit(limit)
        )
    parts = list(db.execute(q).scalars().all())
    return {
        "parts": [
            {
                "part_number": p.part_number,
                "name": p.name,
                "status": p.status,
                "stock_quantity": p.stock_quantity,
                "price": float(p.price) if p.price is not None else None,
            }
            for p in parts
        ]
    }


def tool_read_competitor_listings(db: Session, part_number: str | None = None, limit: int = 15) -> dict:
    q = select(CompetitorListing).order_by(CompetitorListing.scraped_at.desc()).limit(limit)
    if part_number:
        q = (
            select(CompetitorListing)
            .where(CompetitorListing.part_number.ilike(f"%{part_number}%"))
            .order_by(CompetitorListing.scraped_at.desc())
            .limit(limit)
        )
    rows = list(db.execute(q).scalars().all())
    return {
        "listings": [
            {
                "part_number": r.part_number,
                "title": r.title,
                "price_cents": r.price_cents,
                "availability": r.availability,
                "listing_url": r.listing_url,
            }
            for r in rows
        ]
    }


def tool_update_segment_playbook(
    db: Session,
    segment_id: uuid.UUID,
    *,
    playbook_markdown: str | None = None,
    research_summary: str | None = None,
    labels: list[str] | None = None,
    recommended_services: list | None = None,
) -> dict:
    seg = db.get(Segment, segment_id)
    if not seg:
        return {"error": "segment not found"}
    if playbook_markdown is not None:
        seg.playbook_markdown = playbook_markdown[:50_000]
    if research_summary is not None:
        seg.research_summary = research_summary[:20_000]
    if labels is not None:
        seg.labels = [str(x)[:80] for x in labels][:40]
    if recommended_services is not None:
        seg.recommended_services = recommended_services
    seg.last_researched_at = dt.datetime.now(dt.timezone.utc)
    seg.research_budget_used = int(seg.research_budget_used or 0) + 1
    db.flush()
    return {"ok": True, "segment_id": str(seg.id), "last_researched_at": seg.last_researched_at.isoformat()}


def tool_schedule_recheck(
    db: Session,
    *,
    subject_type: str,
    subject_id: uuid.UUID,
    days: int,
    reason: str,
    created_by: str | None = None,
) -> dict:
    due = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=max(1, min(days, 90)))
    task = enqueue_task(
        db,
        kind="recheck",
        subject_type=subject_type,
        subject_id=subject_id,
        reason=reason,
        due_at=due,
        created_by=created_by,
    )
    return {"scheduled_task_id": str(task.id), "due_at": due.isoformat(), "reason": reason}


AGENT_SYSTEM = """You are the Titan Imaging research agent. You keep CRM notes from observations only.

Return ONLY JSON with keys:
- summary: short result for staff
- steps: array of {tool, detail} describing what you inspected
- evidence: array of {observation, strength, suggested_field?, suggested_value?} for customers (customer_id required when subject is segment — pick from sample)
- playbook_markdown: optional updated segment playbook (segments only)
- research_summary: optional short research summary (segments only)
- labels: optional string array of segment labels
- recommended_services: optional array of service labels (e.g. "PET/CT mechanical audit", "Parts & Support", "Used system sales")
- open_questions: array of questions for humans when evidence is ambiguous
- recheck_days: optional int (1-90) and recheck_reason if you want another look later

Never invent personal facts. Prefer Titan offers: parts, audits, repairs, used/new PET/CT, sell-to-us.
"""


async def run_research_task(db: Session, task: AgentTask) -> AgentTask:
    steps: list[dict] = []
    try:
        context_blocks: list[dict] = []
        if task.subject_type == "customer":
            timeline = tool_read_customer_timeline(db, task.subject_id)
            steps.append({"tool": "read_customer_timeline", "detail": "Loaded customer timeline and opportunities"})
            context_blocks.append({"timeline": timeline})
            inv = tool_search_inventory(db, limit=8)
            steps.append({"tool": "search_inventory", "detail": f"{len(inv.get('parts', []))} parts sampled"})
            context_blocks.append({"inventory": inv})
            comps = tool_read_competitor_listings(db, limit=8)
            steps.append({"tool": "read_competitor_listings", "detail": f"{len(comps.get('listings', []))} competitor rows"})
            context_blocks.append({"competitors": comps})
        elif task.subject_type == "segment":
            members = tool_read_segment_members(db, task.subject_id)
            steps.append({"tool": "read_segment_members", "detail": "Loaded segment playbook and sample members"})
            context_blocks.append({"segment": members})
            inv = tool_search_inventory(db, limit=8)
            steps.append({"tool": "search_inventory", "detail": "Inventory sample for offer mapping"})
            context_blocks.append({"inventory": inv})
        else:
            raise ValueError(f"Unknown subject_type {task.subject_type}")

        skills = load_skills()
        user = (
            f"Task kind: {task.kind}\nReason: {task.reason or 'n/a'}\n"
            f"Subject: {task.subject_type} {task.subject_id}\n\n"
            f"Skills:\n{skills}\n\n"
            f"Context JSON:\n{json.dumps(context_blocks, default=str)[:40_000]}"
        )
        raw = await chat_completion(
            messages=[
                {"role": "system", "content": AGENT_SYSTEM},
                {"role": "user", "content": user},
            ],
            model=resolve_model("studio"),
            response_format="json",
            temperature=0.25,
            max_tokens=2000,
        )
        data = json.loads(raw)
        summary = (data.get("summary") or "").strip() or "Research completed"
        steps.extend(data.get("steps") or [])

        # Apply evidence
        for ev in data.get("evidence") or []:
            obs = (ev.get("observation") or "").strip()
            if not obs:
                continue
            cid = task.subject_id if task.subject_type == "customer" else None
            if task.subject_type == "segment" and ev.get("customer_id"):
                try:
                    cid = uuid.UUID(str(ev["customer_id"]))
                except ValueError:
                    cid = None
            if not cid:
                continue
            record_evidence(
                db,
                customer_id=cid,
                observation=obs,
                source="research_agent",
                tool_name="run_research_task",
                strength=ev.get("strength") or "weak",
                suggested_field=ev.get("suggested_field"),
                suggested_value=ev.get("suggested_value"),
            )
            steps.append({"tool": "record_evidence", "detail": obs[:160]})

        if task.subject_type == "segment":
            tool_update_segment_playbook(
                db,
                task.subject_id,
                playbook_markdown=data.get("playbook_markdown"),
                research_summary=data.get("research_summary") or summary,
                labels=data.get("labels"),
                recommended_services=data.get("recommended_services"),
            )
            steps.append({"tool": "update_segment_playbook", "detail": "Playbook / labels updated"})

        recheck_days = data.get("recheck_days")
        if recheck_days:
            tool_schedule_recheck(
                db,
                subject_type=task.subject_type,
                subject_id=task.subject_id,
                days=int(recheck_days),
                reason=(data.get("recheck_reason") or "Agent scheduled follow-up")[:2000],
                created_by=task.created_by,
            )
            steps.append({"tool": "schedule_recheck", "detail": f"In {recheck_days} days"})

        task.status = "completed"
        task.result_summary = summary[:10_000]
        task.steps_json = steps[:80]
        task.open_questions = list(data.get("open_questions") or [])[:20]
        task.completed_at = dt.datetime.now(dt.timezone.utc)
        task.lease_until = None
        db.commit()
        db.refresh(task)
        return task
    except Exception as exc:
        logger.exception("Agent task %s failed", task.id)
        task.status = "failed"
        task.error = str(exc)[:4000]
        task.steps_json = steps
        task.completed_at = dt.datetime.now(dt.timezone.utc)
        task.lease_until = None
        db.commit()
        db.refresh(task)
        return task


async def process_due_tasks(db: Session, *, limit: int = 5) -> dict[str, Any]:
    claimed = claim_due(db, limit=limit)
    results = []
    for task in claimed:
        done = await run_research_task(db, task)
        results.append(task_to_out(done))
    return {"claimed": len(claimed), "results": results}
