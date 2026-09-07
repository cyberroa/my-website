from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Always load backend/.env regardless of process cwd (uvicorn aliases, IDE runners).
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "local"
    port: int = 8000

    database_url: str
    cors_origins: str = "http://localhost:3000"

    resend_api_key: str | None = None
    admin_notify_email: str | None = None
    email_from: str | None = None
    email_from_customer: str | None = None

    supabase_url: str | None = None
    supabase_jwt_secret: str | None = None
    admin_email_allowlist: str = ""
    public_site_url: str = "http://localhost:3000"
    public_api_url: str | None = None

    # Phase 4A — campaigns, engagement, social
    resend_webhook_secret: str | None = None
    mailing_address: str | None = None
    unsubscribe_signing_secret: str | None = None
    social_webhook_url: str | None = None
    social_callback_secret: str | None = None

    # Phase 4B — OpenRouter AI (briefings, sentiment; later segments/campaigns)
    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    ai_enabled: bool = True
    ai_model_default: str = "openai/gpt-4o-mini"
    ai_model_briefing: str | None = None
    ai_model_sentiment: str | None = None
    ai_model_segment: str | None = None
    ai_model_campaign: str | None = None
    ai_model_daily_report: str | None = None
    ai_model_studio: str | None = None
    ai_model_profile: str | None = None
    # Comma-separated OpenRouter model IDs for AI Studio dropdown
    ai_allowed_models: str = (
        "openai/gpt-4o-mini,anthropic/claude-sonnet-4,openai/gpt-4o,google/gemini-2.0-flash-001"
    )
    # Optional OpenRouter attribution headers
    openrouter_http_referer: str | None = None
    openrouter_app_title: str = "Titan Imaging Workbench"

    # Phase G — daily staff briefings
    staff_briefing_emails: str = ""
    slack_webhook_url: str | None = None
    cron_secret: str | None = None

    # Phase H — Gemini image generation (optional; separate from OpenRouter)
    google_ai_api_key: str | None = None
    gemini_image_model: str = "gemini-2.5-flash-image"

    # Phase I — owner emails (bootstrap owner role on staff)
    owner_emails: str = ""

    # Sprint 3 — Firecrawl competitor scrape
    firecrawl_api_key: str | None = None
    firecrawl_base_url: str = "https://api.firecrawl.dev"

    @property
    def ai_allowed_models_list(self) -> list[str]:
        raw = (self.ai_allowed_models or "").strip()
        if not raw:
            return [self.ai_model_default]
        return [m.strip() for m in raw.split(",") if m.strip()]

    @property
    def staff_briefing_emails_list(self) -> list[str]:
        raw = (self.staff_briefing_emails or "").strip()
        if not raw:
            return []
        return [e.strip() for e in raw.split(",") if e.strip()]

    @property
    def owner_emails_set(self) -> set[str]:
        raw = (self.owner_emails or "").strip()
        if not raw:
            return set()
        return {e.strip().lower() for e in raw.split(",") if e.strip()}

    @property
    def cors_origin_list(self) -> list[str]:
        raw = (self.cors_origins or "").strip()
        if not raw:
            return []
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def admin_email_allowlist_set(self) -> set[str]:
        raw = (self.admin_email_allowlist or "").strip()
        if not raw:
            return set()
        return {e.strip().lower() for e in raw.split(",") if e.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()

