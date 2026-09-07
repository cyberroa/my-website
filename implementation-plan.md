# Titan Imaging Website — Implementation Plan

> **Repo:** `cyberroa/titan-imaging` (GitHub). **Vercel:** set **Root Directory** to `frontend` for deploys.
> **Branch workflow:** Feature branch → PR into `staging` → test on staging → PR into `main` (production on Vercel). The legacy `prod` branch is retired; delete it on GitHub once staging is verified.
> **Stack:** Vercel (frontend) · Supabase (DB + Auth + Storage) · Render (FastAPI backend) · Resend (email) · Make (social automation) · Calendly (bookings)

**Status (as of May 2026):**
- **Phase 1 complete** — Next.js public site on Vercel
- **Phase 2 complete** — FastAPI on Render, Postgres (Supabase), public API, inventory + forms wired
- **Phase 3 complete** — Google OAuth admin, inventory/customer CRUD, bulk Excel import, outreach, inventory alerts (Cal.com migration deferred — Calendly still in use)
- **Phase 4A complete** — Email campaigns (Resend), engagement tracking, social composer (Make/LinkedIn), customer 360 timeline, segments + templates
- **Phase 4.5 complete** — Design system governance ([`Design.md`](Design.md)); shared UI primitives, public page refactors, admin headers via `AdminPageHeader`
- **Phase 4B in progress** — Sprint 1 done; Phases A–I AI + payroll implemented in code (migrate `20260823_0002` + `20260823_0003`, set `OPENROUTER_API_KEY` to activate)

Operational items remaining for full production readiness:
- Domain verification for `titanimagingservice.com` in Resend (waiting on uncle's DNS access)
- Vercel project transfer from `cyberroa` → `byronroark` account (free; doc in `docs/vercel-transfer.md`)
- Staging environment provisioning — **in progress** ([`docs/deploy-staging.md`](docs/deploy-staging.md); `staging` branch created)
- Brave/adblock mitigation Option B — **done** (`POST /api/v1/activity`; see `docs/analytics-adblock-mitigation.md`)

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Project Structure](#project-structure)
3. [Phase 1: Foundation & Frontend](#phase-1-foundation--frontend) — complete
4. [Phase 2: Backend & Core Features](#phase-2-backend--core-features) — complete
5. [Phase 3: Admin & Advanced](#phase-3-admin--advanced) — complete
6. [Phase 4A: Campaigns, Engagement, Social](#phase-4a-campaigns-engagement-social) — complete
7. [Phase 4.5: Design System & Polish](#phase-45-design-system--polish) — complete
8. [Phase 4B: Analytics Platform & AI](#phase-4b-analytics-platform--ai) — in progress
9. [Database Schema](#database-schema)
10. [Deployment Architecture](#deployment-architecture)
11. [Continuing from Another Machine](#continuing-from-another-machine)
12. [Pre-Implementation Checklist](#pre-implementation-checklist)
13. [Summary Timeline](#summary-timeline)

> **Roadmap (recommended):** For a single up-to-date view of phases A–I, admin URLs, API key activation, and laptop workflow, read **[`docs/roadmap.md`](docs/roadmap.md)**.

---

## Technology Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| **Frontend** | Next.js 15 (App Router) | TypeScript, Tailwind CSS; deploys to Vercel |
| **Backend** | FastAPI (Python) | Deploys to Render; JWKS-validated Supabase JWTs for `/admin` |
| **Database** | Supabase (PostgreSQL) | Includes Auth + Storage; migrations via Alembic; `citext`, `tsvector`, `JSONB`, `ARRAY(Text)` |
| **Auth** | Supabase Auth + FastAPI | Google OAuth via Supabase; FastAPI validates JWTs (JWKS preferred, HS256 fallback) |
| **Storage** | Supabase Storage | Reserved for future part image uploads |
| **Email** | Resend | Transactional + campaign sends; Svix-signed delivery webhooks; `List-Unsubscribe` headers |
| **Social** | Make (Integromat) | Webhook-driven LinkedIn posts; HMAC-SHA256 callback verification |
| **Bookings** | Calendly | Inline iframe on `/book` and `/contact`; Cal.com migration deferred |
| **Hosting** | Vercel + Render | Hobby tiers today; production cutover docs cover paid-tier upgrade decisions |
| **CI/Security** | GitHub Actions + Dependabot | Weekly `pip-audit` + `npm audit`; major version bumps blocked to avoid breaking PRs |

---

## Project Structure (current)

```
titan-imaging/
├── frontend/                    # Next.js 15 — Vercel root directory
│   ├── app/
│   │   ├── (public)/            # Home, About, Services, Contact, Sell, Book, Inventory, Insights, Testimonials
│   │   ├── admin/               # Admin pages (auth-gated)
│   │   │   ├── login/           # Google OAuth entry
│   │   │   ├── parts/           # Inventory CRUD
│   │   │   ├── categories/      # Category CRUD
│   │   │   ├── import/          # Bulk Excel/CSV import
│   │   │   ├── customers/       # Customer CRUD + 360 timeline at /admin/customers/[id]
│   │   │   ├── templates/       # Email template editor
│   │   │   ├── segments/        # Audience segment builder (filter JSON)
│   │   │   ├── campaigns/       # Compose + send + recipient detail
│   │   │   ├── social/          # LinkedIn composer + post history
│   │   │   ├── alerts/          # Inventory alert subscribers list
│   │   │   └── outreach/        # One-off bulk email
│   │   ├── auth/callback/       # OAuth redirect handler
│   │   └── layout.tsx
│   ├── components/              # Header, Footer, ConsentBanner, PageViewTracker, forms/, admin/AdminNav, …
│   ├── lib/
│   │   ├── api.ts               # API client; base URL from NEXT_PUBLIC_API_URL
│   │   ├── track.ts             # Engagement tracking client (page_view, search, click, identify)
│   │   ├── images.ts            # Central asset paths
│   │   ├── nav.ts               # Nav config
│   │   ├── site.ts              # Site URL / canonical helpers
│   │   ├── calendly.ts          # Calendly iframe helper
│   │   └── services-data.ts
│   ├── public/images/           # Static assets
│   └── package.json
├── backend/                     # FastAPI — Render (rootDir backend)
│   ├── alembic/versions/        # 20260413_0001_init.py + 20260418_0001_phase4a_campaigns.py
│   ├── app/
│   │   ├── api/v1/routes/       # admin*.py, public routes, webhooks, events_public
│   │   ├── models.py            # Categories, Parts, Customers, Segments, Templates, Campaigns,
│   │   │                        # CampaignRecipients, Unsubscribes, Sessions, Events, SocialPosts, …
│   │   ├── schemas.py           # Pydantic request/response models
│   │   ├── settings.py          # Env vars (pydantic-settings)
│   │   ├── auth.py              # Supabase JWT verification (JWKS + HS256 fallback)
│   │   ├── email.py             # Resend integration + suppression checks
│   │   ├── email_footer.py      # CAN-SPAM footer + List-Unsubscribe headers
│   │   ├── suppression.py       # Suppression list management
│   │   ├── unsubscribe_tokens.py # Signed unsubscribe tokens
│   │   ├── templating.py        # Variable substitution + Markdown→HTML
│   │   ├── segments.py          # Customer segment query builder
│   │   ├── inventory_alerts.py  # Notify-on-restock logic
│   │   └── part_utils.py        # Stock/availability helpers
│   ├── scripts/
│   └── requirements.txt
├── docs/
│   ├── analytics-adblock-mitigation.md  # Brave/uBlock/Pi-hole strategy
│   ├── deploy-staging.md                # Staging tier setup (Supabase/Render/Vercel/Resend/Make)
│   ├── phase4a-make-setup.md            # Make scenario runbook for LinkedIn
│   ├── privacy.md                       # Privacy + consent policy (public + internal)
│   ├── production-cutover.md            # Pre-launch hardening checklist
│   └── vercel-transfer.md               # Hobby-account project transfer guide
├── inventory-templates/                 # CSV templates + email campaign starters
│   ├── customer_import_template.csv
│   ├── inventory_template.csv
│   ├── README.md
│   └── campaigns/                       # welcome.md, back_in_stock.md, nurture_followup.md
├── .github/
│   ├── dependabot.yml                   # Weekly minor+patch only; majors ignored
│   └── workflows/security-audit.yml     # pip-audit + npm audit on PR/push/weekly
├── render.yaml                          # Render Blueprint
├── legacy/static-site/                  # Previous static HTML (reference)
└── implementation-plan.md               # This file
```

---

## Phase 1: Foundation & Frontend — **complete**

**Goal:** Next.js app with design system and all public pages.
**Duration:** 1–2 weeks (shipped)

### 1.1 Project Setup
- [x] Next.js 15 + App Router + TypeScript + Tailwind CSS
- [x] ESLint + Prettier (`npm run format` / `format:check`)
- [x] Logo + banner assets in `frontend/public/images/`

### 1.2 Design System
- [x] Tailwind tokens + CSS variables; dark theme; accent + titanium palette
- [x] Typography: Orbitron (display), Inter (body) via `next/font/google`

### 1.3 Layout & Public Pages
- [x] Header / Footer / responsive nav
- [x] Pages: Home, About, Services, Contact, Sell, Book (Calendly embed), Inventory (API-backed), Insights, Testimonials
- [x] All pages use shared full-bleed image hero with gradient-to-black overlay
- [x] Scrollbar-gutter reservation in `globals.css` to prevent nav jump on short pages
- [x] SEO: `robots.txt`, `sitemap.xml`, JSON-LD baseline

### 1.4 Deployment
- [x] Deployed to Vercel (Hobby; auto-deploy on `main`; root directory `frontend`)

---

## Phase 2: Backend & Core Features — **complete**

**Goal:** FastAPI backend + Supabase + parts API + contact/sell forms.
**Duration:** 2–3 weeks (shipped)

### 2.1 Backend Setup
- [x] FastAPI in `backend/`
- [x] Dependencies: FastAPI, Uvicorn, SQLAlchemy 2.0, Alembic, `psycopg2-binary`, Pydantic v2, `email-validator`, `python-dotenv`, `httpx`
- [x] CORS via `CORS_ORIGINS` (comma-separated allowlist)
- [x] `GET /health` endpoint
- [x] Env: `DATABASE_URL`, `APP_ENV`

### 2.2 Database
- [x] Supabase Postgres + Alembic init migration `20260413_0001_init.py`
- [x] Tables: `categories`, `parts`, `contact_submissions`, `sell_submissions`, `inventory_alert_subscriptions`
- [x] `parts.search_vector` (`tsvector`) + GIN index
- [x] Seed script: `python -m app.scripts.seed`

### 2.3 Public API
| Endpoint | Method | Auth |
|----------|--------|------|
| `GET /api/v1/parts` | GET | No |
| `GET /api/v1/parts/{id}` | GET | No |
| `GET /api/v1/categories` | GET | No |
| `POST /api/v1/contact` | POST | No |
| `POST /api/v1/sell` | POST | No |
| `POST /api/v1/inventory-alerts/subscribe` | POST | No |
| `GET /api/v1/inventory-alerts/unsubscribe` | GET | No (signed token) |

### 2.4 Forms + Frontend Integration
- [x] Pydantic validation on contact + sell
- [x] Frontend API client (`lib/api.ts`); `NEXT_PUBLIC_API_URL` env var
- [x] Inventory loads via API with retry-on-transient-failure wrapper
- [x] Loading / error / success UX

### 2.5 Deploy
- [x] FastAPI on Render (free tier; `render.yaml` Blueprint)
- [x] Vercel `NEXT_PUBLIC_API_URL` set to Render URL

---

## Phase 3: Admin & Advanced — **complete**

**Goal:** Admin panel with Google OAuth, inventory + customer CRUD, bulk import, outreach, inventory alerts.
**Duration:** 3–4 weeks (shipped)

### 3.1 Authentication — complete
- [x] Supabase Auth Google OAuth provider enabled
- [x] Frontend: Supabase Auth client + `/admin/login` page with Google G logo
- [x] FastAPI: JWT validation via JWKS (preferred) with HS256 fallback (`backend/app/auth.py`)
- [x] Admin email allowlist (`ADMIN_EMAIL_ALLOWLIST` env var)
- [x] Protected `/admin/*` API routes require `Authorization: Bearer`

### 3.2 Admin Layout & Guard — complete
- [x] `/admin` route group with auth guard (redirect to `/admin/login` if unauthenticated)
- [x] Admin nav: Parts, Categories, Import, Customers, Templates, Segments, Campaigns, Social, Alerts, Outreach

### 3.3 Inventory Management — complete
- [x] Parts list with search, filter, pagination
- [x] Add/Edit/Delete parts (part_number, name, description, category, stock, price, status)
- [x] **Auto-reconcile status with stock** so operators don't have to remember to flip status when restocking
- [x] Categories CRUD
- [x] Bulk Excel/CSV import via `POST /admin/parts/import` (dry-run + commit modes; per-row error reporting)
- [x] CSV templates in `inventory-templates/`
- [ ] Part image uploads to Supabase Storage *(deferred; not blocking)*

### 3.4 Inventory Alerts — complete
- [x] `inventory_alert_subscriptions` table
- [x] Public subscribe endpoint on out-of-stock parts (UI on `/inventory`)
- [x] Notify-on-restock trigger fires when part transitions unavailable → available
- [x] One-shot per subscriber per part (`last_notified_at`)
- [x] Signed unsubscribe tokens

### 3.5 Bookings — Calendly retained, Cal.com deferred
- [x] Calendly iframe embedded on `/book` and `/contact`
- [ ] Cal.com migration *(deferred; not on critical path)*
- [ ] `bookings` table + webhook handler *(deferred)*

### 3.6 Polish
- [x] Hero banners standardized across all public pages
- [x] Mobile responsive nav
- [x] Form UX with optimistic states + error messaging

---

## Phase 4A: Campaigns, Engagement, Social — **complete**

**Goal:** Email campaign platform, customer 360, engagement tracking, LinkedIn social via Make.
**Duration:** ~1 week (shipped April 2026)

### 4A.1 Customer Management — complete
- [x] `customers` table (citext email, name, company, phone, role, source, tags, status, search_vector)
- [x] CRUD via `/admin/customers`
- [x] Bulk Excel/CSV import with upsert-by-email
- [x] Customer detail page at `/admin/customers/[id]` with **timeline** merging events + campaign history

### 4A.2 Email Infrastructure — complete
- [x] Resend integration (`RESEND_API_KEY`)
- [x] CAN-SPAM compliant footer (`MAILING_ADDRESS`) + `List-Unsubscribe` headers
- [x] Suppression list (`unsubscribes` table) checked before every send
- [x] Signed unsubscribe tokens (`UNSUBSCRIBE_SIGNING_SECRET`)
- [x] Generic `/api/v1/unsubscribe` endpoint (token-based)
- [x] Resend delivery webhook with Svix signature verification (`RESEND_WEBHOOK_SECRET`); updates `campaign_recipients` + writes `email.sent`/`email.delivered`/`email.opened`/`email.clicked`/`email.bounced`/`email.complained`/`email.unsubscribed` events

### 4A.3 Templates + Segments — complete
- [x] `templates` table (Markdown body → HTML at send time; variable substitution)
- [x] `segments` table (filter JSON; `build_segment_query` translates to SQL)
- [x] Admin UIs at `/admin/templates` and `/admin/segments` with live preview
- [x] Starter templates in `inventory-templates/campaigns/` (welcome, back_in_stock, nurture_followup)

### 4A.4 Campaigns — complete
- [x] `campaigns` table + `campaign_recipients` (per-recipient status tracking)
- [x] Compose / preview / send pipeline at `/admin/campaigns`
- [x] Per-recipient try/except so one failure doesn't crash the batch
- [x] Per-recipient send via Resend with proper From, Reply-To, footer, headers
- [x] Stats counters (sent / skipped_suppressed / failed)
- [x] Detail view at `/admin/campaigns/[id]` with recipient status table

### 4A.5 Engagement Tracking — complete
- [x] `sessions` table (cookie-id-based anonymous browser sessions, optional customer link)
- [x] `events` table (page_view, inventory_search, part_view, part_click, contact_submit, sell_submit, identify, plus Resend email events)
- [x] `POST /api/v1/events` ingest endpoint
- [x] Frontend `track.ts` client with first-party `ti_sid` cookie
- [x] Consent banner (`ConsentBanner.tsx`) + `ti_consent` cookie
- [x] `PageViewTracker` component for automatic page view recording
- [x] Forms (Contact, Sell) and InventoryBrowser instrumented for events
- [x] `identify()` links anonymous session → customer on form submit / email link

### 4A.6 Social via Make — complete
- [x] `social_posts` table (channel, body, scheduled_at, status, external_id)
- [x] `/admin/social` composer UI with channel selector + history
- [x] Outbound POST to `SOCIAL_WEBHOOK_URL` (Make scenario)
- [x] HMAC-SHA256 callback verification at `/api/v1/webhooks/social` (`SOCIAL_CALLBACK_SECRET`)
- [x] Make scenario runbook in `docs/phase4a-make-setup.md`

### 4A.7 Documentation — complete
- [x] `docs/privacy.md` — public + internal policy
- [x] `docs/deploy-staging.md` — staging tier setup
- [x] `docs/production-cutover.md` — pre-launch checklist
- [x] `docs/vercel-transfer.md` — Vercel project transfer between Hobby accounts
- [x] `docs/analytics-adblock-mitigation.md` — Brave/adblock strategy
- [x] `docs/phase4a-make-setup.md` — Make/LinkedIn runbook

### 4A.8 Smoke tests verified in production
- [x] Google OAuth admin login
- [x] Inventory CRUD + bulk import + auto-status reconcile
- [x] Customer CRUD + bulk import
- [x] Template + segment preview
- [x] Campaign send end-to-end (Resend + webhook + stats)
- [x] Engagement tracking (after Brave Shields workaround / fix planned in Phase 4B prerequisite)
- [x] Inventory alert trigger fires on restock
- [x] Unsubscribe flow + List-Unsubscribe header
- [ ] Social → Make → LinkedIn *(blocked on Make scenario being wired live)*

---

## Phase 4.5: Design System & Polish — **complete**

**Goal:** Professional, uniform public site and governed admin headers; one place to adjust brand tokens and patterns ([`Design.md`](Design.md)).
**Estimated duration:** ~1–1.5 weeks
**Priority:** Complete before Phase 4B (design-first).

### 4.5.1 Design governance
- [x] Author [`Design.md`](Design.md) at repo root (tokens, typography, layout, forms, admin, a11y, change procedure)
- [x] Link from [`README.md`](README.md) and this plan

### 4.5.2 Shared primitives (`frontend/components/ui/`)
- [x] `Eyebrow`, `PageHero`, `Container`, `Section`, `SectionHeading`
- [x] `Button` / `LinkButton` (primary, secondary, accent)
- [x] `AdminPageHeader`
- [x] `frontend/lib/cn.ts` class-name helper

### 4.5.3 Public page refactor (use primitives; visual parity first)
- [x] Home, Inventory / `InventoryBrowser`
- [x] Contact, Sell + forms
- [x] About, Services, Book
- [x] Testimonials, Insights

### 4.5.4 Admin consistency
- [x] Migrate admin page headers to `AdminPageHeader`
- [x] Document admin-only patterns in `Design.md`

### 4.5.5 Deliverables
- [x] `Design.md` kept in sync with `tailwind.config.ts`
- [x] Public marketing pages share hero, section, and button patterns
- [x] Global retheme achievable via tokens + `components/ui/*` without page-by-page edits

---

## Phase 4B: Analytics Platform & AI — **in progress**

**Goal:** Give Titan Imaging a competitive edge with AI-driven customer intelligence, live engagement scoring, sentiment analysis, and a queryable analytics surface.
**Estimated duration:** 4–6 weeks across sprints

### Sprint 1 — Engagement scoring + live visitors dashboard (~1 week)
**Why first:** highest ROI; directly addresses "make the sale before the customer leaves."
- [x] Server-side scoring per `BrowserSession` and `Customer`: weighted sum of event types with recency decay (`backend/app/engagement.py`)
- [x] `GET /admin/sessions/live` endpoint returning active sessions in last N minutes
- [x] `/admin/live` page: real-time table of currently-active visitors, what they're searching, parts viewed, score trending; auto-refresh every 10 sec
- [x] "Hot leads" list — identified customers above score threshold in last 24h, sortable
- [ ] Optional: Slack or email notification to uncle when a known customer crosses threshold

### Sprint 2 — AI customer briefings + customer 360 enrichment (~1 week)
- [x] `backend/app/ai/` OpenRouter abstraction (pluggable models via env)
- [x] Customer detail "Briefing" panel: LLM-generated paragraph summarizing their timeline
- [x] Cached and regenerated on new events (`timeline_hash`) / explicit regenerate
- [x] Contact/sell sentiment + intent + urgency (background task after form submit)
- [ ] Use case validation: staff opens customer page before sales call → 30-second prep

### Sprint 3 — Competitive intelligence (~1 week)
- [x] Scheduled job ingests competitor public inventory pages via **Firecrawl** (Block Imaging, MRI Resources seeds; editable URLs)
- [x] Normalize into `competitor_listings` / `competitor_sources` tables
- [x] Dashboard: `/admin/competitors` compare tab — Titan SKU vs competitor price + availability
- [ ] AI-generated weekly market briefing: what's moving, what's getting cheaper, gaps in Titan's catalog

### Sprint 4 — GraphQL layer (~3 days)
- [ ] Add Strawberry or Ariadne GraphQL endpoint at `/graphql`
- [ ] Expose customers, sessions, events, campaigns, parts with proper authz
- [ ] Optional Phase 4C: natural-language → GraphQL AI layer for ad-hoc queries

### Sprint 5 — Sentiment analysis (~3 days)
- [x] Run every `contact_submission` and `sell_submission` body through sentiment + intent classifier (OpenRouter)
- [x] Surface in customer timeline with sentiment / urgency badges
- [ ] Flag high-urgency inquiries for same-day follow-up (list filter / alert)

### Prerequisite (before Sprint 1)
- [x] Brave/adblock mitigation Option B: rename `/api/v1/events` → `/api/v1/activity` (see `docs/analytics-adblock-mitigation.md`)
- [ ] Eventually upgrade to Option C (first-party Vercel proxy) when traffic warrants

---

## Database Schema

**Phase 2 (init migration `20260413_0001_init.py`):**
`categories`, `parts`, `contact_submissions`, `sell_submissions`, `inventory_alert_subscriptions`

**Phase 4A (migration `20260418_0001_phase4a_campaigns.py`):**
`customers`, `segments`, `templates`, `campaigns`, `campaign_recipients`, `unsubscribes`, `sessions`, `events`, `social_posts`

**Phase 4B (migrations `20260823_0001`–`20260823_0003`):**
`customer_briefings`, sentiment columns, `customer_engagement_snapshots`, AI segment columns, `daily_briefings`, `ai_prompt_presets`, `ai_studio_runs`, payroll tables, `opportunity_snapshots`, `marketing_goals`, `competitor_sources`, `competitor_listings` (Firecrawl Sprint 3).

**Phase 4B AI phases (code complete; enable with env):**
- [x] B — post-import profile enrichment + briefing seed
- [x] C — daily engagement snapshots + warmth movers API
- [x] D — AI segment propose / approve
- [x] E — AI email + social draft endpoints
- [x] F — Market Map graph API + `/admin/insights`
- [x] G — Daily briefings + Resend/Slack deliver + cron jobs
- [x] H — AI Studio at `/admin` (prompts, models, Gemini images when keyed)
- [x] I — Staff payroll: team, My Pay accept, sales, payroll charts
- [x] J — Marketing goals → opportunity detection → linked segment refresh ([`docs/roadmap.md`](docs/roadmap.md) Phase J)

**Auth:** Supabase Auth + allowlist; `admin_staff` roster for payroll (owner via `OWNER_EMAILS`).

---

## Deployment Architecture

```
User browser
  │
  ├─► Vercel (Next.js) ─► Static + Server Components
  │       │
  │       └─► Render (FastAPI) ─► Supabase (Postgres + Auth + Storage)
  │                                   │
  │                                   └─► Resend (email send + webhooks)
  │                                   └─► Make (social webhooks)
  │
  └─► Calendly iframes (no backend integration today)
```

### Environment Variables (current)

**Frontend (Vercel):**
- `NEXT_PUBLIC_API_URL` — Render API base URL (no trailing slash)
- `NEXT_PUBLIC_SITE_URL` — canonical site URL
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public)
- `NEXT_PUBLIC_ENABLE_TRACKING` — `true`/`false` toggle for engagement tracking client

**Backend (Render):**
- `DATABASE_URL` — Supabase Postgres connection string
- `CORS_ORIGINS` — comma-separated allowed browser origins
- `APP_ENV` — `production` / `staging` / `development`
- `SUPABASE_URL` — Supabase project URL (for JWKS lookup)
- `SUPABASE_JWT_SECRET` — fallback for HS256 verification
- `ADMIN_EMAIL_ALLOWLIST` — comma-separated admin Gmails
- `ADMIN_NOTIFY_EMAIL` — operations notification recipient
- `RESEND_API_KEY` — Resend API key
- `RESEND_FROM_EMAIL` — verified sending address (today: `onboarding@resend.dev`; post-cutover: `alerts@titanimagingservice.com`)
- `RESEND_WEBHOOK_SECRET` — Svix signature verification
- `MAILING_ADDRESS` — CAN-SPAM-required physical address in email footers
- `UNSUBSCRIBE_SIGNING_SECRET` — token signing key
- `SOCIAL_WEBHOOK_URL` — Make scenario inbound URL
- `SOCIAL_CALLBACK_SECRET` — HMAC verification key for Make → backend callback
- `PUBLIC_SITE_URL`, `PUBLIC_API_URL` — used in email links and unsubscribe URLs

---

## Continuing from Another Machine

When you clone this repo on a new laptop and want to keep working in Cursor:

### 1. Clone and open

```bash
git clone https://github.com/cyberroa/titan-imaging.git
cd titan-imaging
cursor .
```

### 2. Set up local environment files (NOT in git)

Both `backend/.env` and `frontend/.env.local` are gitignored. You'll need to recreate them. Pull values from:
- **Render dashboard** → titan-imaging-api → Environment (for backend env vars)
- **Vercel dashboard** → titan-imaging project → Settings → Environment Variables (for frontend)
- **Supabase dashboard** → Settings → API (for `SUPABASE_URL` and anon key)
- **Resend dashboard** → API Keys (for `RESEND_API_KEY`)

Copy templates as starting points:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Then fill in real values from the dashboards above.

### 3. Install dependencies

**Backend (Python 3.11+):**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate           # PowerShell on Windows
# OR: source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

**Frontend (Node 20+):**

```bash
cd frontend
npm install
```

### 4. Run migrations (only if you want a fresh local DB)

If you're pointing `DATABASE_URL` at the Supabase production DB, skip this — migrations are already applied. If you've set up a local Postgres for offline dev:

```bash
cd backend
.venv\Scripts\activate
alembic upgrade head
python -m app.scripts.seed
```

### 5. Start dev servers

In two separate terminals:

```bash
# Backend
cd backend
.venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8080
```

```bash
# Frontend
cd frontend
npm run dev
```

Frontend at http://localhost:3000, backend at http://localhost:8080. Make sure `frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8080`.

### 6. Read these in order before making changes

- **[`docs/roadmap.md`](docs/roadmap.md)** — master roadmap, phases A–I, API keys, admin map
- This file — overall plan and current state
- [`Design.md`](Design.md) — UI tokens and patterns before editing `frontend/` styles
- `README.md` — repo overview + quickstart
- `docs/production-cutover.md` — what's left to fully launch
- `docs/deploy-staging.md` — when you eventually want a non-prod environment
- `docs/analytics-adblock-mitigation.md` — context for Phase 4B prerequisite work
- The most relevant `docs/*` for whatever feature you're touching

### 7. Branch hygiene

- Default branch: `main` (production deploys from here)
- Default branch: `main` (production deploys from here)
- Long-lived test branch: `staging` → Preview URL `titan-imaging-staging.vercel.app` (after Vercel domain alias)
- Retired: `prod` branch — use `staging` → `main` instead; delete `prod` on GitHub once staging is verified
- Feature-branch off `staging` (or off `main` for hotfixes); PR into `staging` first, then `staging` → `main`
- Vercel: Preview deploys for PRs + `staging` branch; production deploys on merge to `main`

### 8. Useful local checks before pushing

```bash
# Frontend type check + lint
cd frontend
npx tsc --noEmit
npm run lint
npm run format:check

# Backend test boot (no actual route hit, just makes sure imports + settings load)
cd backend
.venv\Scripts\activate
python -c "from app.main import app; print('ok')"
```

---

## Pre-Implementation Checklist

- [x] GitHub repo + branch workflow
- [x] Vercel project linked; root directory `frontend`
- [x] Supabase project; `DATABASE_URL`, JWKS, anon key all wired
- [x] Render account + FastAPI Web Service deployed
- [x] Logo + image assets in `frontend/public/images/`
- [x] Resend account + API key + webhook
- [x] Make account + LinkedIn-connected scenario *(scenario wired but not yet validated end-to-end)*
- [x] Dependabot + GitHub Actions security audit
- [ ] `titanimagingservice.com` verified in Resend *(pending DNS access from uncle)*
- [ ] Vercel project transferred to `byronroark` account *(see `docs/vercel-transfer.md`)*
- [ ] Staging tier provisioned *(in progress — see `docs/deploy-staging.md`)*
- [ ] Cal.com account *(deferred — not on critical path)*

---

## Summary Timeline

| Phase | Duration | Key Output |
|-------|----------|------------|
| **1. Foundation & Frontend** | 1–2 weeks | **Done** — Next.js site, design system, public pages, Vercel |
| **2. Backend & Core Features** | 2–3 weeks | **Done** — FastAPI on Render, Postgres, parts API, contact/sell |
| **3. Admin & Advanced** | 3–4 weeks | **Done** — Google OAuth, inventory + customer CRUD, bulk import, alerts |
| **4A. Campaigns, Engagement, Social** | ~1 week | **Done** — Resend campaigns, customer 360, engagement tracking, Make/LinkedIn |
| **4.5. Design System & Polish** | ~1–1.5 weeks | **Complete** — `Design.md`, UI primitives, uniform public + admin pages |
| **4B. Analytics Platform & AI** | 4–6 weeks | **In progress** — Sprint 1 live visitors + scoring; AI briefings, competitive intel, sentiment, GraphQL remain |

**Total to date:** ~7-10 weeks. Phase 4B adds another ~4-6 weeks for full delivery.
