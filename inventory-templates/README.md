# Titan Imaging bulk-import templates

These files live at the repo root (not shipped to prod) so the team can populate
inventory, customers, and campaign starter templates in a consistent way.

## Inventory (`inventory_import_template.csv`)

Bulk-create or update rows in the `parts` table via **Admin → Import** (or
`POST /api/v1/workbench/parts/import`).

### Files

- **`inventory_import_template.csv`** — UTF-8 CSV with a header row. Safe to
  edit in Excel; use **Save As → CSV UTF-8** if Excel changes encoding.
- You can also save the same sheet as **`.xlsx`**; the API accepts `.csv` or
  `.xlsx` with the same column headers.

### Columns

| Column | Required | Notes |
|--------|----------|--------|
| `part_number` | Yes | Unique part identifier (matches site search). |
| `name` | Yes | Display name. |
| `description` | No | Free text. |
| `category_slug` | No | Must match an existing category `slug` (e.g. `ct`, `pet`, `general`). Leave empty for uncategorized. |
| `stock_quantity` | No | Integer; defaults to `0`. |
| `price` | No | Decimal; optional. |
| `status` | No | e.g. `in_stock`, `out_of_stock` (must fit DB string length). |

### Behaviour

- **Upsert key:** `part_number`. If a part exists, the row **updates** it;
  otherwise it **creates** it.
- **Dry run:** In the admin UI, enable **Dry run** to validate rows without
  writing.
- **Categories:** Create categories first under **Admin → Categories** so
  `category_slug` values resolve.

## Customers (`customer_import_template.csv`)

Bulk-ingest Titan Imaging's contacts into the `customers` table via **Admin →
Customers → Bulk import** (or `POST /api/v1/workbench/customers/import`).

### Columns

| Column | Required | Notes |
|--------|----------|--------|
| `email` | Yes | Unique (case-insensitive). Used as the upsert key. |
| `name` | No | Full name of the contact. |
| `company` | No | Hospital / clinic / group. |
| `phone` | No | |
| `role` | No | e.g. `Imaging Director`, `Procurement Lead`. |
| `tags` | No | Comma-separated list (inside the single column), e.g. `hospital,repeat`. |
| `source` | No | Free-text provenance, e.g. `import`, `referral`, `tradeshow-2026`. Defaults to `import`. |
| `notes` | No | Internal notes. |
| `consent_marketing` | No | `true`/`false`. When `true`, the row is recorded as having given consent via the import and will be eligible for campaigns that filter `consent_marketing: true`. |

### Behaviour

- **Upsert key:** `email`. Existing rows are patched; missing fields are left
  alone (we do not overwrite a value with an empty cell).
- **Tags** are merged (union) on update — an import won't delete existing tags.
- **Consent** can only be raised by an import, never lowered.

## Campaign starter templates (`campaigns/`)

See `campaigns/welcome.md` and `campaigns/back_in_stock.md` for starter Markdown
bodies that paste straight into **Admin → Templates**. Placeholders:
`{{ name }}`, `{{ company }}`, `{{ email }}`.

## Privacy / consent note

Titan Imaging only sends marketing email to contacts with
`consent_marketing = true` (or to people who explicitly subscribed to an
inventory alert for a specific part). Every customer email includes a
CAN-SPAM footer with an unsubscribe link and the mailing address from
`MAILING_ADDRESS`. See `docs/privacy.md` for the retention policy and data
subject rights.
