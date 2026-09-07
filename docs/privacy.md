# Privacy & consent — Titan Imaging platform

This document captures how the Titan Imaging web app and admin platform handle
personal data. Share the public-facing portions with customers on the website's
privacy page; keep the operational notes for internal reference.

## Public-facing summary (drop into the website privacy page)

**What we collect**

- Contact info you submit through our forms (name, email, company, phone).
- Basic engagement data when you browse titanimaging.com (pages viewed,
  searches, parts you clicked). This is stored against a first-party cookie
  (`ti_sid`) and only tied back to your email if you contact us or subscribe.
- Inventory alert subscriptions (your email + the part number you asked us to
  notify you about).

**What we do with it**

- Fulfill quotes, trade-ins, and part alerts you requested.
- Send marketing email **only** to contacts who gave explicit consent
  (`consent_marketing = true`) or who opted into an inventory alert.
- Improve the site (which parts get searched, what's out of stock).

**What we don't do**

- Sell your data.
- Use third-party ad trackers. (We do not set any tracking cookies besides
  our own first-party session cookie.)

**Your controls**

- Every marketing email has a one-click unsubscribe link and a
  `List-Unsubscribe` header. Clicking it stops all marketing email globally.
- You can email `privacy@titanimaging.com` to request a copy of your data or
  deletion. We respond within 30 days.

## Operational notes (internal)

### Consent model

- Contacts imported via `customer_import_template.csv` require
  `consent_marketing = true` to be included in campaigns.
- Inventory alert subscriptions are treated as **transactional** opt-ins
  limited to the specific part they subscribed for. They do **not** imply
  general marketing consent.
- If a contact unsubscribes via the generic `/api/v1/unsubscribe` endpoint,
  the system:
  1. Adds the email to the `unsubscribes` table (global suppression).
  2. Deactivates every `InventoryAlertSubscription` for that email.
  3. Marks the triggering `CampaignRecipient` row as `unsubscribed`.
- Bounces and spam complaints from the Resend webhook are **also** added to
  the suppression list automatically.

### Engagement tracking

- Controlled by `NEXT_PUBLIC_ENABLE_TRACKING` (frontend) and the `ti_consent`
  cookie.
- The consent banner must be accepted before any event is recorded. Declined
  or pending states keep `track.ts` silent.
- We store a first-party `ti_sid` cookie (opaque UUID) with a 1-year TTL. No
  IP or fingerprinting data is stored alongside it beyond what the server
  logs already capture.

### Retention

| Data | Retention |
|------|-----------|
| Customer records (`customers`) | Kept until deletion request. |
| Engagement events (`events`) | 24 months rolling, then archived/aggregated. |
| Browser sessions (`sessions`) | 90 days rolling. |
| Unsubscribes (`unsubscribes`) | **Indefinite** — we must never re-email a suppressed address. |
| Campaign recipients (`campaign_recipients`) | Same as campaigns (retained for reporting). |

### Data subject requests

- **Access**: run `SELECT * FROM customers WHERE email = $1` plus the
  `/workbench/customers/{id}/timeline` endpoint and email the result as JSON.
- **Delete**: delete the `customers` row; unsubscribe list entry is preserved.
  Event rows can be anonymized by nulling `customer_id` and `email` instead
  of hard-deleting.

### Secrets touching personal data

- `RESEND_WEBHOOK_SECRET`
- `UNSUBSCRIBE_SIGNING_SECRET`
- `SOCIAL_CALLBACK_SECRET`
- `SUPABASE_JWT_SECRET`

All are stored in Render (backend) and Vercel (frontend) as environment
variables only.
