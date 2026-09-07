## Titan Imaging API (Phase 2)

FastAPI backend for parts search and form submissions. Uses **direct Postgres** (Supabase)
via `DATABASE_URL`.

### Local setup

1. Create `backend/.env` (see `backend/.env.example`).
2. Create a venv and install deps.

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
```

3. Run migrations and seed.

```bash
alembic upgrade head
python -m app.scripts.seed
# Optional: rich synthetic CRM personas for agentic Workbench testing (no OpenRouter)
python -m app.scripts.seed_demo_crm
```

4. Start the server.

```bash
uvicorn app.main:app --reload --port 8000
```

### Deploy on Render

1. Push `main` (this repo includes `render.yaml` at the root and `backend/runtime.txt` for Python 3.12).
2. In the [Render Dashboard](https://dashboard.render.com), **New** → **Blueprint**, connect this GitHub repository, and apply the blueprint (or **New** → **Web Service** and point at this repo with **Root Directory** `backend` if you prefer manual setup).
3. Set environment variables (Dashboard → your web service → **Environment**):
   - **`DATABASE_URL`** — Supabase Postgres URI. Use the **Session pooler** (or IPv4-friendly) connection string if direct `db.*.supabase.co` fails to resolve from Render; ensure it works with SQLAlchemy (e.g. `postgresql://…` or `postgresql+psycopg2://…`).
   - **`CORS_ORIGINS`** — Comma-separated browser origins allowed to call the API, e.g. `https://your-app.vercel.app,https://www.yourdomain.com` (no trailing slashes). Must include every Vercel preview URL you care about, or use your production domain only.
   - Optional: **`RESEND_API_KEY`**, **`ADMIN_NOTIFY_EMAIL`**, **`EMAIL_FROM`** for contact/sell notifications.
4. On the **free** Render plan, **`preDeployCommand` is not available**, so **`scripts/render_start.sh`** runs migrations and seed, then **uvicorn**, on each container start (seed is safe to repeat). Paid plans can use a separate pre-deploy step in the dashboard if you prefer.
5. Smoke-test: `GET https://<your-service>.onrender.com/health` should return `{"ok":true}`.

### Phase 4B AI (OpenRouter)

Optional. When `OPENROUTER_API_KEY` is set and `AI_ENABLED=true`:

- `GET /api/v1/workbench/customers/{id}/briefing` — AI call-prep summary (cached)
- `POST /api/v1/workbench/customers/{id}/briefing/regenerate` — force refresh
- Contact/sell form submits enqueue sentiment classification (background)

See `backend/.env.example` for `AI_MODEL_*` overrides. Swap models anytime via OpenRouter model IDs.

**Vercel (frontend):** set **`NEXT_PUBLIC_API_URL`** to your Render service URL (e.g. `https://titan-imaging-api.onrender.com`) so the Next.js app calls the live API.

### Endpoints

- `GET /health`
- `GET /api/v1/categories`
- `GET /api/v1/parts?search=&category=&limit=`
- `GET /api/v1/parts/{id}`
- `POST /api/v1/contact`
- `POST /api/v1/sell`

