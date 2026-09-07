from __future__ import annotations

import hashlib
import hmac
import json
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import WorkbenchUser, get_current_workbench_user
from app.db import get_db
from app.models import SocialPost
from app.schemas import OkOut, SocialPostCreate, SocialPostOut
from app.settings import get_settings

router = APIRouter(prefix="/workbench/social", dependencies=[Depends(get_current_workbench_user)])


def _post_to_out(p: SocialPost) -> SocialPostOut:
    return SocialPostOut(
        id=str(p.id),
        channel=p.channel,
        body=p.body,
        link_url=p.link_url,
        first_comment=p.first_comment,
        image_url=p.image_url,
        status=p.status,
        external_id=p.external_id,
        error=p.error,
        scheduled_at=p.scheduled_at,
        posted_at=p.posted_at,
        created_at=p.created_at,
    )


@router.get("/posts", response_model=list[SocialPostOut])
def list_posts(db: Session = Depends(get_db)):
    rows = (
        db.execute(select(SocialPost).order_by(SocialPost.created_at.desc()).limit(200))
        .scalars()
        .all()
    )
    return [_post_to_out(p) for p in rows]


@router.post("/posts", response_model=SocialPostOut)
async def create_post(
    body: SocialPostCreate,
    db: Session = Depends(get_db),
    admin: WorkbenchUser = Depends(get_current_workbench_user),
):
    settings = get_settings()

    post = SocialPost(
        id=uuid.uuid4(),
        channel="linkedin",
        body=body.body,
        link_url=body.link_url,
        first_comment=body.first_comment,
        image_url=body.image_url,
        status="queued",
        scheduled_at=body.scheduled_at,
        created_by=admin.email,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    if not settings.social_webhook_url:
        post.status = "error_no_webhook"
        post.error = "SOCIAL_WEBHOOK_URL is not configured"
        db.commit()
        return _post_to_out(post)

    payload = {
        "post_id": str(post.id),
        "channel": post.channel,
        "body": post.body,
        "link_url": post.link_url,
        "first_comment": post.first_comment,
        "image_url": post.image_url,
        "scheduled_at": post.scheduled_at.isoformat() if post.scheduled_at else None,
        "callback_url": f"{(settings.public_api_url or '').rstrip('/')}/api/v1/webhooks/social",
    }
    body_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if settings.social_callback_secret:
        sig = hmac.new(
            settings.social_callback_secret.encode("utf-8"), body_bytes, hashlib.sha256
        ).hexdigest()
        headers["X-Signature"] = f"sha256={sig}"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(settings.social_webhook_url, content=body_bytes, headers=headers)
        post.response_json = {"status_code": r.status_code, "body": r.text[:2000]}
        if r.is_success:
            post.status = "sent_to_make"
        else:
            post.status = "failed"
            post.error = f"Make webhook returned {r.status_code}"
    except Exception as e:
        post.status = "failed"
        post.error = f"{type(e).__name__}: {e}"

    db.commit()
    return _post_to_out(post)


@router.delete("/posts/{post_id}", response_model=OkOut)
def delete_post(post_id: str, db: Session = Depends(get_db)):
    p = db.get(SocialPost, post_id)
    if not p:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(p)
    db.commit()
    return OkOut()
