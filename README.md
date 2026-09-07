# Titan Imaging

Public marketing site + admin analytics/CRM platform for Titan Imaging
(refurbished CT/PET parts).

- **Frontend:** Next.js 15 (App Router, TypeScript, Tailwind) deployed to Vercel.
- **Backend:** FastAPI + SQLAlchemy + Alembic, deployed to Render.
- **Data + auth:** Supabase (Postgres, Google OAuth, JWKS).
- **Email:** Resend (transactional + campaigns) with CAN-SPAM footers and
  global unsubscribe.
- **Social:** Make scenario that publishes to LinkedIn; see
  [`docs/phase4a-make-setup.md`](docs/phase4a-make-setup.md).

## Repo layout

```
backend/               FastAPI app, Alembic migrations, requirements.txt
frontend/              Next.js app
docs/
  roadmap.md                       **Master product roadmap** (status, phases A–I, API key checklist)
  analytics-adblock-mitigation.md  Strategy for Brave/uBlock/Pi-hole coverage loss
  deploy-staging.md                Staging environment setup (Supabase/Render/Vercel/Resend/Make)
  phase4a-make-setup.md            Make/LinkedIn runbook
  privacy.md                       Privacy + consent policy (public + internal)
  production-cutover.md            Checklist + cost + hardening for going live
  vercel-transfer.md               Transferring the Vercel project between Hobby accounts
inventory-templates/
  README.md               Bulk-import conventions
  inventory_import_template.csv
  customer_import_template.csv
  campaigns/              Starter email templates (Markdown)
Design.md                 Public/admin UI design system and governance
docs/roadmap.md           **Master roadmap** — phases, admin map, API key activation, laptop workflow
implementation-plan.md  Phase-by-phase plan (detailed history)
```

## Design system

UI tokens, typography, layout rules, and component conventions are documented in
[`Design.md`](Design.md). Read it before changing styles in `frontend/`. Shared UI
primitives under `frontend/components/ui/` are introduced in Phase 4.5 (see
[`implementation-plan.md`](implementation-plan.md)).

## Local dev quickstart

**Backend**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows / PowerShell
pip install -r requirements.txt
copy .env.example .env    # fill DATABASE_URL etc.
alembic upgrade head
python -m uvicorn app.main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
copy .env.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000. The admin app lives at `/workbench`; sign in with a
Google account whose email is on `NEXT_PUBLIC_ADMIN_EMAIL_ALLOWLIST` and
`ADMIN_EMAIL_ALLOWLIST`.

## Admin features

See **[`docs/roadmap.md`](docs/roadmap.md)** for the full admin URL map, AI phases, and payroll setup.

- **AI Studio** (`/workbench`) — prompts, OpenRouter models, Gemini images, promote to templates/social.
- **Live / Market Map / Briefings** — engagement, graph CRM, daily AI reports.
- **Parts / Categories / Import** — inventory CRUD and bulk upload.
- **Customers** — CRM with CSV/XLSX import, timeline, AI briefing, tagging, consent.
- **Templates / Segments / Campaigns** — email marketing with Resend tracking.
- **Social** — LinkedIn posts via Make.
- **Team / My Pay / Sales / Payroll** — staff profiles, pay acceptance, conversions, owner payout charts.

## Phase 4A deployment checklist

1. Apply the new migration: `alembic upgrade head` against Supabase.
2. Add the Phase 4A env vars on Render:
   - `RESEND_WEBHOOK_SECRET`
   - `MAILING_ADDRESS`
   - `UNSUBSCRIBE_SIGNING_SECRET`
   - `SOCIAL_WEBHOOK_URL` and `SOCIAL_CALLBACK_SECRET`
3. Add `NEXT_PUBLIC_ENABLE_TRACKING=true` on Vercel (or `false` to silence
   analytics).
4. In Resend, add a webhook that points to
   `https://<render-host>/api/v1/webhooks/resend` and paste its signing
   secret into `RESEND_WEBHOOK_SECRET`.
5. Build the Make scenario following `docs/phase4a-make-setup.md` and paste
   its webhook URL into `SOCIAL_WEBHOOK_URL`.

## Staging environment

**In progress.** The `staging` branch is live on GitHub. Finish setup in
[`docs/deploy-staging.md`](docs/deploy-staging.md):

- **Test:** `staging` branch → `titan-imaging-staging.vercel.app` (after Vercel alias)
- **Production:** merge `staging` → `main` → `titanimagingservice.com`

Workflow: feature branch → PR **`staging`** → test → PR **`staging` → `main`**.

The legacy **`prod`** branch is retired; delete it on GitHub once staging smoke tests pass.

## Production cutover

When the domain is ready and you're flipping the switch from "demo" to
"real customers," work through
[`docs/production-cutover.md`](docs/production-cutover.md). Covers Render
cold-start mitigation (upgrade vs. external pinger), email deliverability
hardening, DNS cutover order, 2FA + secret rotation, observability, and
projected monthly cost.

## Privacy

See [`docs/privacy.md`](docs/privacy.md). TL;DR: marketing emails only go to
contacts with explicit consent or specific inventory-alert opt-ins; every
email has a one-click unsubscribe; tracking is consent-gated on the public
site.
