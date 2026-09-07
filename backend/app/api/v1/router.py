from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import (
    workbench,
    workbench_ai,
    workbench_campaigns,
    workbench_competitors,
    workbench_customers,
    workbench_engagement,
    workbench_goals,
    workbench_payroll,
    workbench_sessions,
    workbench_social,
    workbench_templates,
    categories,
    contact,
    events_public,
    inventory_alerts_public,
    parts,
    sell,
    unsubscribe_public,
    webhooks,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(parts.router, tags=["parts"])
api_router.include_router(categories.router, tags=["categories"])
api_router.include_router(contact.router, tags=["contact"])
api_router.include_router(sell.router, tags=["sell"])
api_router.include_router(workbench.router, tags=["workbench"])
api_router.include_router(workbench_customers.router, tags=["workbench-customers"])
api_router.include_router(workbench_ai.router, tags=["workbench-ai"])
api_router.include_router(workbench_engagement.router, tags=["workbench-engagement"])
api_router.include_router(workbench_goals.router, tags=["workbench-goals"])
api_router.include_router(workbench_competitors.router, tags=["workbench-competitors"])
api_router.include_router(workbench_payroll.router, tags=["workbench-payroll"])
api_router.include_router(workbench_sessions.router, tags=["workbench-sessions"])
api_router.include_router(workbench_templates.router, tags=["workbench-templates"])
api_router.include_router(workbench_campaigns.router, tags=["workbench-campaigns"])
api_router.include_router(workbench_social.router, tags=["workbench-social"])
api_router.include_router(inventory_alerts_public.router, tags=["inventory-alerts"])
api_router.include_router(events_public.router, tags=["activity"])
api_router.include_router(unsubscribe_public.router, tags=["unsubscribe"])
api_router.include_router(webhooks.router, tags=["webhooks"])
