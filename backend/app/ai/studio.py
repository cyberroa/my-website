from __future__ import annotations

import datetime as dt
import json
import re
import uuid

from sqlalchemy.orm import Session

from app.ai.client import chat_completion, resolve_model
from app.ai.evidence import list_evidence
from app.ai.fit_scores import customer_fit_scores_out
from app.ai.images import generate_gemini_image, store_image_data_url
from app.ai.opportunities import customer_latest_opportunities
from app.ai.prompts import STUDIO_DEFAULT_SYSTEM
from app.models import AiPromptPreset, AiStudioRun, Campaign, Customer, EmailTemplate, Segment, SocialPost
from app.settings import get_settings


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.strip().lower())
    return s.strip("-")[:200] or "preset"


def enrich_studio_context(db: Session, context: dict | None) -> dict:
    """Load segment playbooks and customer dossiers into Studio context."""
    ctx = dict(context or {})
    segment_id = ctx.get("segment_id")
    customer_id = ctx.get("customer_id")

    if segment_id:
        try:
            seg = db.get(Segment, uuid.UUID(str(segment_id)))
        except ValueError:
            seg = None
        if seg:
            ctx["segment"] = {
                "id": str(seg.id),
                "name": seg.name,
                "slug": seg.slug,
                "description": seg.description,
                "labels": list(seg.labels or []),
                "playbook_markdown": seg.playbook_markdown,
                "research_summary": seg.research_summary,
                "recommended_services": list(seg.recommended_services or []),
                "filter_json": dict(seg.filter_json or {}),
                "last_researched_at": seg.last_researched_at.isoformat() if seg.last_researched_at else None,
            }

    if customer_id:
        try:
            cid = uuid.UUID(str(customer_id))
            customer = db.get(Customer, cid)
        except ValueError:
            customer = None
            cid = None
        if customer and cid:
            ctx["customer"] = {
                "id": str(customer.id),
                "email": customer.email,
                "name": customer.name,
                "company": customer.company,
                "tags": list(customer.tags or []),
                "notes": (customer.notes or "")[:3000],
                "website": customer.website,
            }
            ctx["opportunities"] = customer_latest_opportunities(db, cid)
            ctx["fit_scores"] = customer_fit_scores_out(db, cid)
            ctx["evidence"] = [
                {
                    "observation": e.observation,
                    "strength": e.strength,
                    "status": e.status,
                    "suggested_field": e.suggested_field,
                }
                for e in list_evidence(db, cid, limit=15)
            ]

    return ctx


async def studio_complete(
    db: Session,
    *,
    model: str | None,
    system_prompt: str | None,
    user_prompt: str,
    context: dict | None,
    created_by: str | None,
    preset_id: uuid.UUID | None = None,
) -> AiStudioRun:
    settings = get_settings()
    use_model = model or resolve_model("studio", settings)
    system = (system_prompt or STUDIO_DEFAULT_SYSTEM).strip()
    ctx = enrich_studio_context(db, context)
    ctx_block = json.dumps(ctx, default=str) if ctx else ""
    user = user_prompt
    if ctx_block:
        user = f"{user_prompt}\n\nContext JSON:\n{ctx_block}"

    output = await chat_completion(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        model=use_model,
        response_format="text",
        temperature=0.55,
        max_tokens=2000,
        settings=settings,
    )

    run = AiStudioRun(
        id=uuid.uuid4(),
        preset_id=preset_id,
        model=use_model,
        system_prompt=system,
        user_prompt=user_prompt,
        context_json=ctx,
        output_text=output,
        created_by=created_by,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


async def studio_image(db: Session, *, prompt: str, created_by: str | None) -> AiStudioRun:
    data_url = await generate_gemini_image(prompt)
    if not data_url:
        raise ValueError("Image generation not configured (set GOOGLE_AI_API_KEY)")

    run = AiStudioRun(
        id=uuid.uuid4(),
        model=get_settings().gemini_image_model,
        system_prompt="",
        user_prompt=prompt,
        context_json={},
        output_text=None,
        output_image_url=store_image_data_url(data_url),
        created_by=created_by,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def promote_studio_output(
    db: Session,
    *,
    output_text: str,
    target: str,
    name: str,
    image_url: str | None,
    created_by: str | None,
    segment_id: uuid.UUID | None = None,
    template_id: uuid.UUID | None = None,
) -> dict:
    if target == "template":
        slug = _slugify(name)
        tpl = EmailTemplate(
            id=uuid.uuid4(),
            name=name,
            slug=slug,
            subject=name[:255],
            body_md=output_text,
            body_html=None,
            tags=["ai-studio"],
        )
        db.add(tpl)
        db.commit()
        return {"type": "template", "id": str(tpl.id)}

    if target == "social":
        post = SocialPost(
            id=uuid.uuid4(),
            body=output_text,
            image_url=image_url,
            status="queued",
            created_by=created_by,
        )
        db.add(post)
        db.commit()
        return {"type": "social", "id": str(post.id)}

    if target == "campaign":
        # Allow one-shot: create template then draft campaign bound to segment
        if not template_id:
            slug = _slugify(name)
            tpl = EmailTemplate(
                id=uuid.uuid4(),
                name=name,
                slug=f"{slug}-{str(uuid.uuid4())[:8]}",
                subject=name[:255],
                body_md=output_text,
                body_html=None,
                tags=["ai-studio", "campaign-draft"],
            )
            db.add(tpl)
            db.flush()
            template_id = tpl.id
        camp = Campaign(
            id=uuid.uuid4(),
            name=name,
            template_id=uuid.UUID(template_id) if isinstance(template_id, str) else template_id,
            segment_id=segment_id,
            status="draft",
            stats_json={"ai_generated": True},
            created_by=created_by,
        )
        db.add(camp)
        db.commit()
        return {
            "type": "campaign",
            "id": str(camp.id),
            "template_id": str(camp.template_id),
            "segment_id": str(segment_id) if segment_id else None,
        }

    raise ValueError(f"Unknown promote target: {target}")


def seed_default_presets(db: Session) -> int:
    defaults = [
        {
            "name": "Warm lead nurture",
            "slug": "warm-lead-nurture",
            "category": "email",
            "system_prompt": STUDIO_DEFAULT_SYSTEM,
            "user_prompt_template": "Write a short follow-up email for a warm lead interested in GE PET/CT parts. Mention recent site activity if in context.",
        },
        {
            "name": "LinkedIn teaser",
            "slug": "linkedin-teaser",
            "category": "social",
            "system_prompt": STUDIO_DEFAULT_SYSTEM,
            "user_prompt_template": "Write a LinkedIn post announcing back-in-stock parts or service availability. Professional tone.",
        },
        {
            "name": "Customer outreach",
            "slug": "customer-outreach",
            "category": "outreach",
            "system_prompt": STUDIO_DEFAULT_SYSTEM,
            "user_prompt_template": "Draft a personalized outreach email using customer context JSON.",
        },
        {
            "name": "PET/CT audit outreach",
            "slug": "audit-outreach",
            "category": "email",
            "system_prompt": STUDIO_DEFAULT_SYSTEM,
            "user_prompt_template": "Draft an email offering a PET/CT mechanical audit / inspection. Emphasize extending equipment life and catching issues before downtime. Use segment playbook if present.",
        },
        {
            "name": "Used system buyer",
            "slug": "used-system-buyer",
            "category": "email",
            "system_prompt": STUDIO_DEFAULT_SYSTEM,
            "user_prompt_template": "Draft outreach for a prospect interested in used/refurbished GE PET/CT systems. Highlight Titan System Sales and competitive pricing vs competitors in context.",
        },
        {
            "name": "New system buyer",
            "slug": "new-system-buyer",
            "category": "email",
            "system_prompt": STUDIO_DEFAULT_SYSTEM,
            "user_prompt_template": "Draft consultative outreach for a facility evaluating new PET/CT acquisition. Position Titan as the first call for sourcing, install, and ongoing support.",
        },
        {
            "name": "Parts nurture",
            "slug": "parts-nurture",
            "category": "email",
            "system_prompt": STUDIO_DEFAULT_SYSTEM,
            "user_prompt_template": "Write a parts nurture email referencing inventory context and beating competitor prices when competitor listings are present.",
        },
        {
            "name": "Win-back neglect rescue",
            "slug": "winback-neglect",
            "category": "email",
            "system_prompt": STUDIO_DEFAULT_SYSTEM,
            "user_prompt_template": "Draft a respectful win-back email for a quiet account so they do not drift to a competitor. Offer audit, parts, or a quick consult CTA.",
        },
    ]
    added = 0
    for d in defaults:
        existing = db.query(AiPromptPreset).filter(AiPromptPreset.slug == d["slug"]).first()
        if existing:
            continue
        db.add(
            AiPromptPreset(
                id=uuid.uuid4(),
                name=d["name"],
                slug=d["slug"],
                category=d["category"],
                system_prompt=d["system_prompt"],
                user_prompt_template=d["user_prompt_template"],
            )
        )
        added += 1
    if added:
        db.commit()
    return added
