from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.ai.jobs import enqueue_sentiment_analysis
from app.db import get_db
from app.email import maybe_send_admin_email
from app.models import SellSubmission
from app.schemas import OkOut, SellIn

router = APIRouter()


@router.post("/sell", response_model=OkOut)
async def submit_sell(
    payload: SellIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    row = SellSubmission(
        name=payload.name.strip(),
        email=str(payload.email).strip(),
        company=(payload.company.strip() if payload.company else None),
        part_details=payload.part_details.strip(),
        message=(payload.message.strip() if payload.message else None),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    body = row.part_details
    if row.message:
        body = f"{row.part_details}\n\n{row.message}"
    enqueue_sentiment_analysis(
        background_tasks,
        kind="sell",
        submission_id=row.id,
        name=row.name,
        email=row.email,
        subject="Sell inquiry",
        body=body,
    )

    await maybe_send_admin_email(
        subject="New sell submission",
        text="New sell submission received.",
        payload={
            "name": row.name,
            "email": row.email,
            "company": row.company,
            "part_details": row.part_details,
            "message": row.message,
        },
    )

    return OkOut(ok=True)
