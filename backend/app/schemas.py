from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator


class CategoryOut(BaseModel):
    id: str
    name: str
    slug: str


class PartOut(BaseModel):
    id: str
    part_number: str
    name: str
    description: str | None = None
    category: str | None = None
    stock_quantity: int
    status: str
    price: float | None = None


class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    subject: str = Field(min_length=2, max_length=200)
    message: str = Field(min_length=5, max_length=10_000)


class SellIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    company: str | None = Field(default=None, max_length=200)
    part_details: str = Field(min_length=5, max_length=10_000)
    message: str | None = Field(default=None, max_length=10_000)


class OkOut(BaseModel):
    ok: bool = True


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = Field(default=None, max_length=120)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = Field(default=None, min_length=1, max_length=120)


class PartCreate(BaseModel):
    part_number: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=20_000)
    category_slug: str | None = Field(default=None, max_length=120)
    stock_quantity: int = Field(ge=0, default=0)
    price: float | None = Field(default=None, ge=0)
    status: str = Field(default="in_stock", max_length=24)


class PartUpdate(BaseModel):
    part_number: str | None = Field(default=None, min_length=1, max_length=80)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=20_000)
    category_slug: str | None = Field(default=None, max_length=120)
    stock_quantity: int | None = Field(default=None, ge=0)
    price: float | None = Field(default=None, ge=0)
    status: str | None = Field(default=None, max_length=24)


class ImportRowError(BaseModel):
    row: int
    message: str


class ImportResult(BaseModel):
    created: int = 0
    updated: int = 0
    errors: list[ImportRowError] = []


class InventoryAlertSubscribeIn(BaseModel):
    email: EmailStr
    part_number: str = Field(min_length=1, max_length=80)
    query_text: str | None = Field(default=None, max_length=2000)


class OutreachSendIn(BaseModel):
    customer_ids: list[UUID] = Field(default_factory=list, max_length=500)
    segment_ids: list[UUID] = Field(default_factory=list, max_length=50)
    recipients: list[EmailStr] = Field(default_factory=list, max_length=500)
    template_id: UUID | None = None
    subject: str = Field(min_length=1, max_length=200)
    body_md: str = Field(min_length=1, max_length=20_000)
    body_html: str | None = Field(default=None, max_length=100_000)
    body: str | None = Field(default=None, max_length=20_000)

    @model_validator(mode="before")
    @classmethod
    def body_alias(cls, data: Any) -> Any:
        if isinstance(data, dict) and data.get("body") and not data.get("body_md"):
            data = {**data, "body_md": data["body"]}
        return data

    @model_validator(mode="after")
    def require_audience(self) -> OutreachSendIn:
        if not self.customer_ids and not self.segment_ids and not self.recipients:
            raise ValueError("At least one of customer_ids, segment_ids, or recipients is required")
        return self


class OutreachPreviewIn(BaseModel):
    customer_ids: list[UUID] = Field(default_factory=list, max_length=500)
    segment_ids: list[UUID] = Field(default_factory=list, max_length=50)
    recipients: list[EmailStr] = Field(default_factory=list, max_length=500)
    subject: str = Field(min_length=1, max_length=200)
    body_md: str = Field(min_length=1, max_length=20_000)
    body_html: str | None = Field(default=None, max_length=100_000)

    @model_validator(mode="after")
    def require_audience(self) -> OutreachPreviewIn:
        if not self.customer_ids and not self.segment_ids and not self.recipients:
            raise ValueError("At least one of customer_ids, segment_ids, or recipients is required")
        return self


class OutreachPreviewOut(BaseModel):
    recipient_count: int
    sample_email: str
    sample_name: str | None = None
    subject: str
    html: str
    text: str


class OutreachSendOut(BaseModel):
    sent: int
    skipped_suppressed: int = 0
    failed: int = 0
    audience_total: int = 0


# --------------------------------------------------------------------------
# Phase 4A — Customers
# --------------------------------------------------------------------------


class CustomerBase(BaseModel):
    email: EmailStr
    name: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    role: str | None = Field(default=None, max_length=120)
    website: str | None = Field(default=None, max_length=500)
    tags: list[str] = Field(default_factory=list)
    source: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=20_000)
    consent_marketing: bool = False
    consent_source: str | None = Field(default=None, max_length=120)
    lead_stage: str = Field(default="new", max_length=24)


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    email: EmailStr | None = None
    name: str | None = Field(default=None, max_length=200)
    company: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    role: str | None = Field(default=None, max_length=120)
    website: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = None
    source: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=20_000)
    consent_marketing: bool | None = None
    consent_source: str | None = Field(default=None, max_length=120)
    lead_stage: str | None = Field(default=None, max_length=24)
    logo_url: str | None = Field(default=None, max_length=400_000)


class CustomerOut(BaseModel):
    id: str
    email: str
    name: str | None = None
    company: str | None = None
    phone: str | None = None
    role: str | None = None
    website: str | None = None
    tags: list[str] = Field(default_factory=list)
    source: str | None = None
    notes: str | None = None
    consent_marketing: bool = False
    consent_source: str | None = None
    consent_at: datetime | None = None
    lead_stage: str = "new"
    created_at: datetime
    updated_at: datetime
    fit_score: float | None = None
    logo_url: str | None = None


class CustomerListOut(BaseModel):
    items: list[CustomerOut]
    total: int
    limit: int
    offset: int
    has_more: bool


class CustomerImportResult(BaseModel):
    created: int = 0
    updated: int = 0
    errors: list[ImportRowError] = []


# --------------------------------------------------------------------------
# Phase 4A — Segments
# --------------------------------------------------------------------------


class SegmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=20_000)
    filter_json: dict[str, Any] = Field(default_factory=dict)
    playbook_markdown: str | None = Field(default=None, max_length=50_000)
    recommended_services: list[Any] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)
    research_summary: str | None = Field(default=None, max_length=20_000)


class SegmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=20_000)
    filter_json: dict[str, Any] | None = None
    playbook_markdown: str | None = Field(default=None, max_length=50_000)
    recommended_services: list[Any] | None = None
    labels: list[str] | None = None
    research_summary: str | None = Field(default=None, max_length=20_000)


class SegmentOut(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None = None
    filter_json: dict[str, Any] = Field(default_factory=dict)
    ai_managed: bool = False
    ai_proposal_status: str | None = None
    ai_rationale: str | None = None
    playbook_markdown: str | None = None
    recommended_services: list[Any] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)
    research_summary: str | None = None
    last_researched_at: str | None = None
    research_budget_used: int = 0


class SegmentListItemOut(SegmentOut):
    member_count: int = 0


class SegmentListOut(BaseModel):
    items: list[SegmentListItemOut]
    total: int
    limit: int
    offset: int
    has_more: bool


class SegmentPreviewOut(BaseModel):
    count: int
    sample: list[CustomerOut] = Field(default_factory=list)


# --------------------------------------------------------------------------
# Phase 4A — Templates
# --------------------------------------------------------------------------


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, max_length=200)
    subject: str = Field(min_length=1, max_length=255)
    preheader: str | None = Field(default=None, max_length=255)
    body_md: str = Field(default="")
    body_html: str | None = None
    from_name: str | None = Field(default=None, max_length=120)
    reply_to: EmailStr | None = None
    tags: list[str] = Field(default_factory=list)


class TemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=1, max_length=200)
    subject: str | None = Field(default=None, min_length=1, max_length=255)
    preheader: str | None = Field(default=None, max_length=255)
    body_md: str | None = None
    body_html: str | None = None
    from_name: str | None = Field(default=None, max_length=120)
    reply_to: EmailStr | None = None
    tags: list[str] | None = None


class TemplateOut(BaseModel):
    id: str
    name: str
    slug: str
    subject: str
    preheader: str | None = None
    body_md: str
    body_html: str | None = None
    from_name: str | None = None
    reply_to: str | None = None
    tags: list[str] = Field(default_factory=list)


class TemplatePreviewIn(BaseModel):
    sample: dict[str, Any] = Field(default_factory=dict)


class TemplatePreviewOut(BaseModel):
    subject: str
    html: str
    text: str


# --------------------------------------------------------------------------
# Phase 4A — Campaigns
# --------------------------------------------------------------------------


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    template_id: str
    segment_id: str | None = None
    scheduled_at: datetime | None = None


class CampaignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    template_id: str | None = None
    segment_id: str | None = None
    scheduled_at: datetime | None = None
    status: str | None = Field(default=None, max_length=24)


class CampaignOut(BaseModel):
    id: str
    name: str
    template_id: str
    segment_id: str | None = None
    status: str
    scheduled_at: datetime | None = None
    sent_at: datetime | None = None
    stats_json: dict[str, Any] = Field(default_factory=dict)
    created_by: str | None = None
    created_at: datetime


class CampaignRecipientOut(BaseModel):
    id: str
    email: str
    customer_id: str | None = None
    status: str
    resend_message_id: str | None = None
    error: str | None = None
    sent_at: datetime | None = None
    delivered_at: datetime | None = None
    opened_at: datetime | None = None
    clicked_at: datetime | None = None
    bounced_at: datetime | None = None
    complained_at: datetime | None = None
    unsubscribed_at: datetime | None = None


class CampaignSendOut(BaseModel):
    campaign_id: str
    queued: int
    skipped_suppressed: int
    errors: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------
# Phase 4A — Events, social
# --------------------------------------------------------------------------


class EventIn(BaseModel):
    type: str = Field(min_length=1, max_length=80)
    url: str | None = Field(default=None, max_length=2000)
    cookie_id: str | None = Field(default=None, max_length=64)
    email: EmailStr | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class EventOut(BaseModel):
    id: str
    type: str
    url: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    occurred_at: datetime


class LiveSessionCustomerOut(BaseModel):
    id: str
    email: str
    name: str | None = None
    company: str | None = None


class LiveSessionOut(BaseModel):
    id: str
    first_seen_at: datetime
    last_seen_at: datetime
    score: float
    current_url: str | None = None
    latest_search: str | None = None
    parts_viewed: list[str] = Field(default_factory=list)
    customer: LiveSessionCustomerOut | None = None


class HotLeadOut(BaseModel):
    customer_id: str
    email: str
    name: str | None = None
    company: str | None = None
    score: float
    last_seen_at: datetime | None = None


class SocialPostCreate(BaseModel):
    body: str = Field(min_length=1, max_length=6000)
    link_url: str | None = Field(default=None, max_length=2000)
    first_comment: str | None = Field(default=None, max_length=6000)
    image_url: str | None = Field(default=None, max_length=2000)
    scheduled_at: datetime | None = None


class SocialPostOut(BaseModel):
    id: str
    channel: str
    body: str
    link_url: str | None = None
    first_comment: str | None = None
    image_url: str | None = None
    status: str
    external_id: str | None = None
    error: str | None = None
    scheduled_at: datetime | None = None
    posted_at: datetime | None = None
    created_at: datetime


class TimelineItem(BaseModel):
    kind: str
    occurred_at: datetime
    label: str
    data: dict[str, Any] = Field(default_factory=dict)


class CustomerTimelineOut(BaseModel):
    customer: CustomerOut
    items: list[TimelineItem] = Field(default_factory=list)


# --------------------------------------------------------------------------
# Phase 4B — AI briefings
# --------------------------------------------------------------------------


class CustomerBriefingOut(BaseModel):
    customer_id: str
    content: str
    model: str
    timeline_hash: str
    generated_at: datetime
    cached: bool = False
    score: float | None = None
    disabled: bool = False
    message: str | None = None


class AiStatusOut(BaseModel):
    enabled: bool
    configured: bool
    default_model: str
    briefing_model: str
    sentiment_model: str


class HelpAskIn(BaseModel):
    message: str = Field(min_length=2, max_length=4_000)


class HelpGuideLinkOut(BaseModel):
    title: str
    href: str


class HelpAskOut(BaseModel):
    answer: str
    guides: list[HelpGuideLinkOut]
    ai: bool = True


class HelpFeedbackIn(BaseModel):
    message: str = Field(min_length=5, max_length=8_000)
    page_path: str | None = Field(default=None, max_length=500)


class HelpFeedbackOut(BaseModel):
    id: str
    staff_email: str
    message: str
    page_path: str | None = None
    created_at: datetime
    read_at: datetime | None = None
    confirm: str = ""

