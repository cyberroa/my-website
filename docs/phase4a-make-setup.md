# Phase 4A — Make scenario for LinkedIn posts

Titan Imaging's admin social composer (`/workbench/social`) POSTs to a Make (Integromat)
webhook. Make publishes to the Titan Imaging LinkedIn Company Page and then calls
back to our API with the final status.

This runbook lives in code so the scenario can be rebuilt from scratch.

## 0. Prereqs

- A Make account (free tier is fine — 1,000 ops/month).
- Access to Titan Imaging's **LinkedIn Page** as an admin (for OAuth consent).
- The backend env vars:
  - `SOCIAL_WEBHOOK_URL` — set to the webhook URL Make gives you in step 2.
  - `SOCIAL_CALLBACK_SECRET` — a random secret you choose (≥32 chars). Used by
    both our API (to sign incoming status callbacks) and Make (to sign outgoing ones).
  - `PUBLIC_API_URL` — e.g. `https://titan-imaging-api.onrender.com` so Make can
    reach `/api/v1/webhooks/social`.

## 1. Expected incoming payload from our API

Our backend will POST this body to Make:

```json
{
  "post_id": "uuid-of-social_posts-row",
  "channel": "linkedin",
  "body": "Hello, fresh CT tubes just landed…",
  "link_url": "https://titanimaging.com/inventory/…",
  "first_comment": "DM us for pricing",
  "image_url": "https://…/optional.jpg",
  "scheduled_at": "2026-05-01T15:00:00Z",
  "callback_url": "https://titan-imaging-api.onrender.com/api/v1/webhooks/social"
}
```

Headers include:

- `Content-Type: application/json`
- `X-Signature: sha256=<hex>` — HMAC-SHA256 of the raw body with `SOCIAL_CALLBACK_SECRET`.

## 2. Build the Make scenario

1. **Trigger — Webhooks → Custom webhook.**
   - Create a new hook; copy the URL; paste it into `SOCIAL_WEBHOOK_URL` in the
     backend environment (Render → Environment).

2. **(Optional) Module — Tools → Switch / Router.**
   - Branch A: "publish now" if `scheduled_at` is empty/past.
   - Branch B: "schedule" if `scheduled_at` is in the future — use **Make →
     Sleep** or the **Schedule** trigger in a separate scenario that reads queued
     posts from a data store.

3. **Module — LinkedIn Pages → Create a Share.**
   - Connection: authorize with a Titan Imaging LinkedIn Page admin.
   - Map:
     - `Text` ← `body`
     - `Visibility` ← "PUBLIC"
     - `Share Media Category` ← "ARTICLE" if `link_url` present, else "NONE"
     - `Media URL` ← `link_url` (only when present)
     - `Media Title/Description` — keep blank or derive from text

4. **(Optional) Module — LinkedIn Pages → Create a Comment.**
   - Parent share URN = previous module's output.
   - Text = `first_comment`. Skip if empty.

5. **Module — HTTP → Make a request (success branch).**
   - URL = `{{ 1.callback_url }}` (the URL from the trigger payload).
   - Method = `POST`.
   - Body (JSON):
     ```json
     {
       "post_id": "{{1.post_id}}",
       "external_id": "{{3.id}}",
       "status": "posted",
       "response": {{3}}
     }
     ```
   - Header `X-Signature` = `sha256={{ sha256(body, "SOCIAL_CALLBACK_SECRET") }}`
     (use Make's built-in `sha256()` function with your callback secret).

6. **Error handler branch (attach to each LinkedIn module).**
   - Same HTTP module as step 5, but with:
     ```json
     {
       "post_id": "{{1.post_id}}",
       "status": "failed",
       "error": "{{error.message}}",
       "response": {{error}}
     }
     ```

7. **Guardrail — add a filter on step 5/6 so the same `post_id` cannot trigger
   twice in a rolling 10-minute window (use Make's built-in "Data Store" keyed on
   `post_id`).**

## 3. Test

1. Point the admin UI at a non-prod Make scenario first.
2. Submit a test post via `/workbench/social`.
3. Watch Make's scenario history — LinkedIn module should succeed.
4. Our backend should flip the row to `status = "posted"` with `external_id`
   populated. Check `/workbench/social` — the table reflects it.

## 4. Going live

- Swap the Make scenario to the real LinkedIn connection.
- Verify `SOCIAL_CALLBACK_SECRET` is identical in Make and Render.
- Set `SOCIAL_WEBHOOK_URL` in Render to the production hook URL.
- Flip the Make scenario to **Active** with a schedule of "Immediately as data arrives".

## 5. Upgrade path

If we outgrow Make's free tier (or need more channels), the payload contract
stays the same. Replace step 2 with Zapier/Buffer/custom service that listens on
the same JSON shape and posts back to `/api/v1/webhooks/social`.
