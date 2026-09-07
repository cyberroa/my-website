"""Seed synthetic Workbench CRM data for local agentic testing.

Zero OpenRouter spend. Idempotent — safe to re-run.

Creates demo imaging-center personas with tags, notes, events, form signals,
segments + playbooks, evidence suggestions, and sample completed agent tasks.

Usage (from backend/, venv active):

    python -m app.scripts.seed_demo_crm

Then (still free — rule-based, no LLM):

    # via Workbench UI or curl with staff JWT:
    # POST /api/v1/workbench/ai/jobs/opportunities/manual
    # POST /api/v1/workbench/ai/jobs/fit-scores/manual

Keep AI_ENABLED=false until you deliberately queue research on one demo customer.
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import select

from app.customer_utils import normalize_website, refresh_customer_search_document
from app.db import SessionLocal
from app.models import (
    AgentTask,
    ContactSubmission,
    Customer,
    CustomerEvidence,
    Event,
    Segment,
    SellSubmission,
)

DEMO_TAG = "demo"
DEMO_SOURCE = "seed_demo_crm"
NOW = dt.datetime.now(dt.timezone.utc)


def _days_ago(n: int) -> dt.datetime:
    return NOW - dt.timedelta(days=n)


# Personas designed to light up opportunity detectors + fit scores without LLM.
PERSONAS: list[dict[str, Any]] = [
    {
        "email": "biomed@riverside-petct.example.com",
        "name": "Morgan Blake",
        "company": "Riverside PET/CT",
        "website": "https://riverside-petct.example.com",
        "role": "Biomedical Engineer",
        "tags": [DEMO_TAG, "GE-Omni", "parts-warm", "price-sensitive"],
        "notes": "Viewing CT tubes repeatedly. Mentions competitor quotes.",
        "persona": "parts_warm",
        "events": [
            ("part_view", 1, {"part_number": "CT-1001"}),
            ("part_view", 2, {"part_number": "CT-1001"}),
            ("inventory_search", 2, {"q": "x-ray tube"}),
            ("part_click", 1, {"part_number": "CT-1002"}),
        ],
        "contact": {
            "subject": "CT tube availability",
            "message": "Need OEM or refurbished CT X-Ray Tube Assembly quote ASAP.",
            "ai_intent": "parts_inquiry",
            "ai_urgency": "high",
            "days_ago": 2,
        },
    },
    {
        "email": "director@lakeside-imaging.example.com",
        "name": "Priya Nair",
        "company": "Lakeside Imaging Center",
        "website": "https://lakeside-imaging.example.com",
        "role": "Imaging Director",
        "tags": [DEMO_TAG, "audit", "fleet-aging"],
        "notes": "Considering PET/CT mechanical audit; no audit on file this year.",
        "persona": "audit_candidate",
        "events": [
            ("page_view", 5, {"path": "/services"}),
            ("page_view", 4, {"path": "/contact"}),
        ],
        "contact": {
            "subject": "Mechanical audit scheduling",
            "message": "We want a PET/CT mechanical audit / inspection before budget season.",
            "ai_intent": "audit_request",
            "ai_urgency": "medium",
            "days_ago": 6,
        },
    },
    {
        "email": "purchasing@heartland-rad.example.com",
        "name": "Chris Ortega",
        "company": "Heartland Radiology",
        "website": "https://heartland-rad.example.com",
        "role": "Purchasing Manager",
        "tags": [DEMO_TAG, "buy_used", "system-buyer"],
        "notes": "Looking to buy used / refurbished GE PET/CT for second site.",
        "persona": "buy_used",
        "events": [
            ("page_view", 3, {"path": "/inventory"}),
            ("page_view", 2, {"path": "/sell"}),
        ],
        "contact": {
            "subject": "Used PET/CT systems",
            "message": "Evaluating pre-owned GE PET/CT. Need competitive pricing vs other dealers.",
            "ai_intent": "buy_used",
            "ai_urgency": "medium",
            "days_ago": 4,
        },
    },
    {
        "email": "cfo@metrohealth-imaging.example.com",
        "name": "Sam Okonkwo",
        "company": "MetroHealth Imaging",
        "website": "https://metrohealth-imaging.example.com",
        "role": "CFO",
        "tags": [DEMO_TAG, "buy_new", "capital"],
        "notes": "Capital purchase discussion for new PET/CT acquisition.",
        "persona": "buy_new",
        "events": [("page_view", 7, {"path": "/services"})],
        "contact": {
            "subject": "New system consult",
            "message": "Exploring new PET/CT capital purchase and install partners.",
            "ai_intent": "buy_new",
            "ai_urgency": "low",
            "days_ago": 5,
        },
    },
    {
        "email": "ops@canyon-diagnostic.example.com",
        "name": "Jordan Lee",
        "company": "Canyon Diagnostic",
        "website": "https://canyon-diagnostic.example.com",
        "role": "Ops Manager",
        "tags": [DEMO_TAG, "sell_to_titan"],
        "notes": "Has surplus CT detector modules to sell to Titan.",
        "persona": "sell_to_titan",
        "events": [("page_view", 2, {"path": "/sell"})],
        "sell": {
            "part_details": "GE CT Detector Module lot — 4 units, tested",
            "message": "Want a fair quote to sell equipment to Titan.",
            "ai_intent": "sell_equipment",
            "days_ago": 3,
        },
    },
    {
        "email": "tech@bayou-pet.example.com",
        "name": "Riley Santos",
        "company": "Bayou PET Services",
        "website": "https://bayou-pet.example.com",
        "role": "Lead Tech",
        "tags": [DEMO_TAG, "hot-lead", "parts-warm"],
        "notes": "Heavy recent engagement — treat as hot lead for parts.",
        "persona": "hot_lead",
        "events": [
            ("part_view", 0, {"part_number": "PET-2001"}),
            ("part_view", 0, {"part_number": "PET-2002"}),
            ("part_click", 0, {"part_number": "PET-2001"}),
            ("inventory_search", 1, {"q": "PMT"}),
            ("part_view", 1, {"part_number": "CT-1001"}),
            ("page_view", 0, {"path": "/contact"}),
            ("page_view", 1, {"path": "/book"}),
        ],
        "contact": {
            "subject": "Urgent PET PMT",
            "message": "Scanner down — need PET PMT Assembly with overnight ship.",
            "ai_intent": "parts_inquiry",
            "ai_urgency": "high",
            "days_ago": 1,
        },
    },
    {
        "email": "admin@quiet-valley-mri.example.com",
        "name": "Pat Nguyen",
        "company": "Quiet Valley Imaging",
        "website": "https://quiet-valley.example.com",
        "role": "Admin",
        "tags": [DEMO_TAG, "neglect-risk", "consent-ready"],
        "notes": "Marketing consent but quiet 30+ days — win-back candidate.",
        "persona": "neglect",
        "events": [
            ("page_view", 35, {"path": "/inventory"}),
            ("part_view", 40, {"part_number": "GEN-4001"}),
        ],
        "contact": None,
    },
    {
        "email": "service@northstar-imaging.example.com",
        "name": "Casey Brooks",
        "company": "Northstar Imaging",
        "website": "https://northstar-imaging.example.com",
        "role": "Service Manager",
        "tags": [DEMO_TAG, "service_contract_gap", "parts-warm"],
        "notes": "Buys parts often; no service_contract tag — contract gap play.",
        "persona": "contract_gap",
        "events": [
            ("part_view", 3, {"part_number": "CT-1003"}),
            ("part_view", 8, {"part_number": "CT-1002"}),
            ("inventory_search", 4, {"q": "gantry"}),
        ],
        "contact": {
            "subject": "Service follow-up",
            "message": "Need ongoing PM / service request options after parts install.",
            "ai_intent": "service_request",
            "ai_urgency": "medium",
            "days_ago": 5,
        },
    },
    {
        "email": "ceo@twin-rivers-scan.example.com",
        "name": "Avery Kim",
        "company": "Twin Rivers Scan Center",
        "website": "https://twin-rivers.example.com",
        "role": "CEO",
        "tags": [DEMO_TAG, "cooling", "GE-Omni"],
        "notes": "Was engaged; warmth cooling — re-engage play.",
        "persona": "cooling",
        "events": [
            ("part_view", 12, {"part_number": "CT-1001"}),
            ("page_view", 14, {"path": "/services"}),
        ],
        "contact": {
            "subject": "Earlier parts quote",
            "message": "Following up later — still interested in parts inquiry.",
            "ai_intent": "parts_inquiry",
            "ai_urgency": "low",
            "days_ago": 12,
        },
    },
    {
        "email": "biomed@pacific-omni.example.com",
        "name": "Drew Patel",
        "company": "Pacific Omni Imaging",
        "website": "https://pacific-omni.example.com",
        "role": "Biomed Lead",
        "tags": [DEMO_TAG, "GE-Omni", "audit", "parts-warm"],
        "notes": "Multi-signal account: audit interest + parts browsing.",
        "persona": "multi",
        "events": [
            ("part_view", 2, {"part_number": "PET-2001"}),
            ("page_view", 3, {"path": "/services"}),
            ("inventory_search", 2, {"q": "omni"}),
        ],
        "contact": {
            "subject": "Audit + parts",
            "message": "Need mechanical audit and also shopping detector crystal options.",
            "ai_intent": "service_request",
            "ai_urgency": "high",
            "days_ago": 2,
        },
    },
]


SEGMENTS: list[dict[str, Any]] = [
    {
        "name": "Demo — Audit candidates",
        "slug": "demo-audit-candidates",
        "description": "Synthetic segment for PET/CT mechanical audit outreach testing.",
        "filter_json": {
            "tags_any": ["audit", "fleet-aging"],
            "exclude_unsubscribed": True,
            "opportunity_types": ["audit_candidate", "service_contract_gap"],
            "opportunity_max_age_days": 14,
        },
        "labels": ["demo", "audit", "fleet-aging"],
        "recommended_services": [
            "PET/CT mechanical audits & inspections",
            "Service contracts",
            "Parts & Support",
        ],
        "playbook_markdown": """# Demo — Audit candidates

**Who:** Imaging centers with aging GE PET/CT fleets and no recent audit.

**Titan offers:** Mechanical audits/inspections, documented findings, follow-up repairs, PM/service contracts.

**Angles:** Extend equipment life; catch failures before downtime; beat OEM audit premiums.

**Do not say:** Guaranteed uptime percentages without a site visit.
""",
        "research_summary": "Seeded playbook for local testing — audit/inspection outreach.",
    },
    {
        "name": "Demo — Used system buyers",
        "slug": "demo-used-system-buyers",
        "description": "Synthetic buyers of used/refurbished GE PET/CT.",
        "filter_json": {
            "tags_any": ["buy_used", "system-buyer"],
            "exclude_unsubscribed": True,
            "opportunity_types": ["buy_used_petct"],
            "opportunity_max_age_days": 14,
        },
        "labels": ["demo", "buy_used", "system-sales"],
        "recommended_services": ["System Sales", "Installation & De-Installation", "Parts & Support"],
        "playbook_markdown": """# Demo — Used system buyers

**Who:** Facilities evaluating pre-owned GE PET/CT for expansion or replacement.

**Titan offers:** Refurbished/pre-owned systems, install, commissioning, ongoing parts.

**Angles:** Competitive vs other dealers; tested systems; Titan as first call.

**Do not say:** Invent specific serial numbers not in inventory.
""",
        "research_summary": "Seeded playbook for used-system campaign drafts.",
    },
    {
        "name": "Demo — Parts warmth / neglect",
        "slug": "demo-parts-warmth",
        "description": "Warm parts browsers and quiet consent accounts for nurture/win-back.",
        "filter_json": {
            "tags_any": ["parts-warm", "neglect-risk", "hot-lead", "consent-ready"],
            "exclude_unsubscribed": True,
            "consent_marketing": True,
        },
        "labels": ["demo", "parts", "winback"],
        "recommended_services": ["Parts & Support", "PET/CT mechanical audits & inspections"],
        "playbook_markdown": """# Demo — Parts warmth / neglect

**Who:** Active parts browsers plus quiet consented accounts at risk of competitor sites.

**Titan offers:** Live inventory, rapid ship, expert guidance; optional audit CTA for quiet accounts.

**Angles:** Beat competitor price; don't let accounts go dark.
""",
        "research_summary": "Seeded for parts nurture and win-back Studio presets.",
    },
]


def _get_or_create_customer(db, persona: dict[str, Any]) -> tuple[Customer, bool]:
    existing = db.scalar(select(Customer).where(Customer.email == persona["email"]))
    if existing:
        # Refresh demo fields so re-runs stay useful
        existing.name = persona["name"]
        existing.company = persona["company"]
        existing.website = normalize_website(persona.get("website"))
        existing.role = persona.get("role")
        existing.tags = list(persona["tags"])
        existing.notes = persona.get("notes")
        existing.source = DEMO_SOURCE
        existing.consent_marketing = True
        existing.consent_source = DEMO_SOURCE
        existing.consent_at = existing.consent_at or NOW
        refresh_customer_search_document(existing)
        return existing, False

    c = Customer(
        id=uuid.uuid4(),
        email=persona["email"],
        name=persona["name"],
        company=persona["company"],
        website=normalize_website(persona.get("website")),
        role=persona.get("role"),
        tags=list(persona["tags"]),
        notes=persona.get("notes"),
        source=DEMO_SOURCE,
        consent_marketing=True,
        consent_source=DEMO_SOURCE,
        consent_at=NOW,
    )
    refresh_customer_search_document(c)
    db.add(c)
    db.flush()
    return c, True


def _seed_events(db, customer: Customer, persona: dict[str, Any]) -> int:
    """Replace prior demo events for this customer so counts stay stable."""
    old = list(
        db.execute(
            select(Event).where(
                Event.customer_id == customer.id,
                Event.url == "https://demo.titanimaging.local/seed",
            )
        )
        .scalars()
        .all()
    )
    for e in old:
        db.delete(e)
    db.flush()

    added = 0
    for etype, days_ago, payload in persona.get("events") or []:
        db.add(
            Event(
                id=uuid.uuid4(),
                customer_id=customer.id,
                type=etype,
                url="https://demo.titanimaging.local/seed",
                payload={**payload, "demo": True},
                occurred_at=_days_ago(days_ago),
            )
        )
        added += 1
    return added


def _seed_contact(db, customer: Customer, persona: dict[str, Any]) -> bool:
    spec = persona.get("contact")
    if not spec:
        return False
    # One demo contact per email — update if exists
    existing = db.scalar(
        select(ContactSubmission)
        .where(ContactSubmission.email == customer.email)
        .order_by(ContactSubmission.created_at.desc())
        .limit(1)
    )
    when = _days_ago(int(spec.get("days_ago", 3)))
    if existing and (existing.ai_summary or "").startswith("[demo]"):
        existing.subject = spec["subject"]
        existing.message = spec["message"]
        existing.ai_intent = spec.get("ai_intent")
        existing.ai_urgency = spec.get("ai_urgency")
        existing.ai_summary = f"[demo] {spec['subject']}"
        existing.ai_model = "seed_demo_crm"
        existing.ai_analyzed_at = when
        existing.created_at = when
        return False

    db.add(
        ContactSubmission(
            id=uuid.uuid4(),
            name=customer.name or "Demo",
            email=customer.email,
            subject=spec["subject"],
            message=spec["message"],
            created_at=when,
            ai_intent=spec.get("ai_intent"),
            ai_urgency=spec.get("ai_urgency"),
            ai_sentiment="neutral",
            ai_summary=f"[demo] {spec['subject']}",
            ai_model="seed_demo_crm",
            ai_analyzed_at=when,
        )
    )
    return True


def _seed_sell(db, customer: Customer, persona: dict[str, Any]) -> bool:
    spec = persona.get("sell")
    if not spec:
        return False
    existing = db.scalar(
        select(SellSubmission)
        .where(SellSubmission.email == customer.email)
        .order_by(SellSubmission.created_at.desc())
        .limit(1)
    )
    when = _days_ago(int(spec.get("days_ago", 3)))
    if existing and (existing.ai_summary or "").startswith("[demo]"):
        existing.part_details = spec["part_details"]
        existing.message = spec.get("message")
        existing.ai_intent = spec.get("ai_intent")
        existing.ai_summary = "[demo] sell-to-titan"
        existing.ai_model = "seed_demo_crm"
        existing.ai_analyzed_at = when
        existing.created_at = when
        return False

    db.add(
        SellSubmission(
            id=uuid.uuid4(),
            name=customer.name or "Demo",
            email=customer.email,
            company=customer.company,
            part_details=spec["part_details"],
            message=spec.get("message"),
            created_at=when,
            ai_intent=spec.get("ai_intent"),
            ai_summary="[demo] sell-to-titan",
            ai_model="seed_demo_crm",
            ai_analyzed_at=when,
        )
    )
    return True


def _seed_evidence(db, customer: Customer, persona: dict[str, Any]) -> int:
    # Keep at most a few demo evidence rows per customer
    existing = list(
        db.execute(
            select(CustomerEvidence).where(
                CustomerEvidence.customer_id == customer.id,
                CustomerEvidence.source == DEMO_SOURCE,
            )
        )
        .scalars()
        .all()
    )
    if existing:
        return 0

    rows = [
        {
            "observation": f"Demo seed: persona={persona['persona']} company={customer.company}",
            "strength": "weak",
            "suggested_field": "tags",
            "suggested_value": "demo-reviewed",
            "status": "suggested",
        },
        {
            "observation": f"Internal timeline shows notes: {(customer.notes or '')[:180]}",
            "strength": "strong",
            "suggested_field": None,
            "suggested_value": None,
            "status": "accepted",
        },
    ]
    for r in rows:
        db.add(
            CustomerEvidence(
                id=uuid.uuid4(),
                customer_id=customer.id,
                source=DEMO_SOURCE,
                tool_name="seed_demo_crm",
                observation=r["observation"],
                strength=r["strength"],
                suggested_field=r["suggested_field"],
                suggested_value=r["suggested_value"],
                status=r["status"],
                observed_at=_days_ago(1),
            )
        )
    return len(rows)


def _seed_agent_task(db, customer: Customer, persona: dict[str, Any]) -> bool:
    existing = db.scalar(
        select(AgentTask).where(
            AgentTask.subject_type == "customer",
            AgentTask.subject_id == customer.id,
            AgentTask.kind == "demo_seed",
        )
    )
    if existing:
        return False

    db.add(
        AgentTask(
            id=uuid.uuid4(),
            kind="demo_seed",
            subject_type="customer",
            subject_id=customer.id,
            status="completed",
            due_at=_days_ago(1),
            reason="Pre-seeded completed research stub (no OpenRouter)",
            payload_json={"persona": persona["persona"]},
            result_summary=(
                f"Demo stub for {customer.company}: map to Titan offers based on persona "
                f"«{persona['persona']}». Re-queue real research only when AI_ENABLED=true."
            ),
            steps_json=[
                {"tool": "seed_demo_crm", "detail": "Synthetic context only — no web research"},
                {"tool": "read_customer_timeline", "detail": "Would load events/forms in a live run"},
            ],
            open_questions=["Confirm preferred CTA: audit, parts quote, or system consult?"],
            created_by="seed_demo_crm",
            started_at=_days_ago(1),
            completed_at=_days_ago(1),
        )
    )
    return True


def _seed_segments(db) -> tuple[int, int]:
    created = updated = 0
    for spec in SEGMENTS:
        existing = db.scalar(select(Segment).where(Segment.slug == spec["slug"]))
        if existing:
            existing.name = spec["name"]
            existing.description = spec["description"]
            existing.filter_json = spec["filter_json"]
            existing.labels = list(spec["labels"])
            existing.recommended_services = list(spec["recommended_services"])
            existing.playbook_markdown = spec["playbook_markdown"]
            existing.research_summary = spec["research_summary"]
            existing.last_researched_at = _days_ago(1)
            updated += 1
            continue
        db.add(
            Segment(
                id=uuid.uuid4(),
                name=spec["name"],
                slug=spec["slug"],
                description=spec["description"],
                filter_json=spec["filter_json"],
                labels=list(spec["labels"]),
                recommended_services=list(spec["recommended_services"]),
                playbook_markdown=spec["playbook_markdown"],
                research_summary=spec["research_summary"],
                last_researched_at=_days_ago(1),
                research_budget_used=0,
            )
        )
        created += 1
    return created, updated


def main() -> None:
    # Ensure base parts/categories exist
    from app.scripts.seed import main as base_seed

    base_seed()

    db = SessionLocal()
    try:
        customers_new = customers_upd = 0
        events = contacts = sells = evidence = tasks = 0

        for persona in PERSONAS:
            customer, created = _get_or_create_customer(db, persona)
            if created:
                customers_new += 1
            else:
                customers_upd += 1
            events += _seed_events(db, customer, persona)
            if _seed_contact(db, customer, persona):
                contacts += 1
            if _seed_sell(db, customer, persona):
                sells += 1
            evidence += _seed_evidence(db, customer, persona)
            if _seed_agent_task(db, customer, persona):
                tasks += 1

        seg_new, seg_upd = _seed_segments(db)
        db.commit()

        print("Demo CRM seed complete (no OpenRouter calls).")
        print(f"  customers: {customers_new} created, {customers_upd} updated")
        print(f"  events: {events}  contacts: {contacts}  sells: {sells}")
        print(f"  evidence: {evidence}  agent stubs: {tasks}")
        print(f"  segments: {seg_new} created, {seg_upd} updated")
        print()
        print("Next (still free — rule-based):")
        print("  1. start-backend && start-frontend")
        print("  2. Workbench → Customers (filter demo / .example.com)")
        print("  3. POST /api/v1/workbench/ai/jobs/opportunities/manual")
        print("  4. POST /api/v1/workbench/ai/jobs/fit-scores/manual")
        print("  5. Keep AI_ENABLED=false until one deliberate Studio/agent test")
    finally:
        db.close()


if __name__ == "__main__":
    main()
