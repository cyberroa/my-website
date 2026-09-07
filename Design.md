# Titan Imaging — Design System

Design governance for the public marketing site (`frontend/app/(public)`) and shared UI patterns used in admin. **Read this before adding or changing Tailwind classes on pages and components.**

Related files:

| File | Role |
|------|------|
| [`frontend/tailwind.config.ts`](frontend/tailwind.config.ts) | **Source of truth** for color and font tokens |
| [`frontend/app/globals.css`](frontend/app/globals.css) | Base styles, scrollbar stability, future `@layer` utilities |
| [`frontend/app/layout.tsx`](frontend/app/layout.tsx) | Font loading (Inter, Orbitron) |
| [`frontend/app/(public)/layout.tsx`](frontend/app/(public)/layout.tsx) | Public shell: header offset, footer, widgets |

**Phase 4.5 status:** This document is the contract. Shared primitives (`frontend/components/ui/*`) and page refactors follow in Steps 2–4 of the design polish track (see [`implementation-plan.md`](implementation-plan.md) §Phase 4.5).

---

## Brand intent

- **Audience:** Hospitals, imaging centers, biomedical engineers — professional, trustworthy, technical.
- **Mood:** Dark industrial / medical imaging; high contrast; restrained accent use.
- **Voice in UI:** Clear headings, short supporting copy, strong CTAs for contact, inventory, and booking.

---

## Color tokens

Defined in `tailwind.config.ts`. Use **semantic Tailwind classes**, not raw hex, in components and pages.

| Token | Tailwind class | Hex | Usage |
|-------|----------------|-----|--------|
| Page background | `bg-background` | `#000000` | Body, full-bleed sections |
| Raised surfaces | `bg-background-raised` | `#111111` | Header, footer, elevated panels |
| Cards | `bg-background-card` | `#0a0a0a` | Form panels, error states |
| Muted blocks | `bg-background-muted` | `#1e1e1e` | Secondary sections, loading skeletons |
| Primary accent (public) | `text-accent-ice` / `bg-accent-ice` | `#6EC9F0` | Eyebrows, CTAs, stats, forms, widgets on public marketing pages |
| Admin accent | `text-accent-admin` / `bg-accent-admin` | `#2BB4FF` | Workbench CTAs, nav, in-progress — electric mid-tone |
| Highlight | `text-accent-highlight` | `#7DEAFF` | Icy Lambo highlight — scheduled / upcoming |
| Deep | `text-accent-deep` | `#0076E6` | Cerulean shadows — pending / waiting |
| Navy | `text-accent-navy` / `bg-accent-navy` | `#0B3D73` | Midnight contours — grounded chrome |
| Engagement up | `text-accent-signal` | `#34D399` | Healthy activity, hot leads |
| Watch / stale | `text-accent-caution` | `#FFFF84` | Quiet accounts, medium priority — pale yellow |
| High priority | `text-accent-alert` | `#E07A5F` | Urgent labels only — terracotta, not brand red |
| Titanium accent | `text-accent-titanium` / `bg-accent-titanium` | `#a9b4c2` | Unused legacy token — keep in config until removed; do not use in new code |
| Primary accent (legacy) | `text-accent` / `bg-accent` | `#00ffd5` | Sparingly — special highlights |
| Primary text | `text-text-primary` / `text-white` | `#ffffff` | Headings, body on dark |
| Secondary text | `text-text-secondary` | `#bbbbbb` | Supporting copy, labels |
| Muted text | `text-text-muted` | `#777777` | Captions, footnotes |
| Borders | `border-white/5`, `border-white/10` | — | Dividers, inputs, cards |

**Do not** introduce new grays as `#0d0d0d` in new code — prefer `bg-background-card` or add a token in `tailwind.config.ts` if a third surface level is needed.

---

## Typography

Fonts are loaded in root layout:

- **Body:** `font-sans` → Inter (`--font-inter`)
- **Display / brand:** `font-display` → Orbitron (`--font-orbitron`), weights 500 and 700

### Scale (canonical — target for all pages)

| Role | Classes | Notes |
|------|---------|--------|
| **Page title (H1)** | `text-3xl font-bold md:text-5xl` | Hero only; tighten with `leading-tight tracking-tight` on home |
| **Section title (H2)** | `text-2xl font-bold md:text-3xl` | Content sections below hero |
| **Section subtitle (H3)** | `text-lg font-semibold` | Cards, accordion titles |
| **Body** | `text-base text-text-secondary` | Default paragraph |
| **Small / caption** | `text-sm text-text-muted` or `text-xs` | Footnotes, form hints |
| **Eyebrow** | `font-display text-[11px] uppercase tracking-[0.25em] text-accent-ice` | Public pages use default `tone="ice"`; admin uses `tone="admin"` via `AdminPageHeader` |

### Metadata titles

Page `<title>` uses template `%s | TITAN IMAGING` from root layout. Keep route metadata titles short (e.g. `"About Us"`, `"Parts Inventory"`).

---

## Layout

### Public shell

From `(public)/layout.tsx`:

- **Header:** `PrototypeHeader` — fixed 48px bar, transparent → solid on scroll, mega-nav panels, ice Contact CTA
- **Side vignette:** `PrototypeSideVignette` — desktop edge fades
- **Main:** full-bleed black background; **no top padding offset** (heroes sit under transparent nav)
- **Footer:** `PrototypeFooter` — 3-column explore/company links + `StaffAccessLink`
- **Widgets:** `ChatWidget`, `PageViewTracker`, `ConsentBanner`

### Containers (canonical widths)

| Context | Classes |
|---------|---------|
| Default content | `mx-auto max-w-6xl px-6` |
| Narrow prose / forms | `mx-auto max-w-4xl px-6` |
| Wide grids (stats, cards) | `mx-auto max-w-5xl px-6` |
| Header inner | `mx-auto max-w-7xl px-6 md:px-12` |

Pick **one** max-width per section type; avoid mixing `max-w-4xl` and `max-w-6xl` on the same page without reason.

### Section vertical rhythm

| Pattern | Classes |
|---------|---------|
| Standard section | `py-16 md:py-20` |
| Hero (inner pages) | `min-h-[45vh]`, `px-6`, `pb-12 pt-4`, centered text |
| Hero (home) | `min-h-[85vh] md:min-h-[90vh]`, `px-5`, `pb-14 pt-6` |
| Tight band | `py-12` |

---

## Page templates

### Marketing page (About, Services, Contact, Book, Insights, Testimonials)

1. **Hero** — full-width background image, gradient overlay, eyebrow + H1 + optional subtitle  
2. **Content section(s)** — `Container` + H2 + body or feature grid  
3. **Optional CTA band** — dark muted background, headline + primary button  
4. **Footer** — global via layout  

**Hero gradient (standard):**  
`bg-gradient-to-b from-black/45 via-black/75 to-black` over `object-cover` image.

**Hero gradient (home / high drama):**  
`from-black/40 via-black/70 to-black` — slightly lighter top for banner visibility.

### Inventory

Uses `InventoryBrowser` (banner + search + filters + grid). Keep search input styling aligned with form inputs below.

### Admin

Uses `AdminShell` + sidebar nav. Page headers reuse **eyebrow + title + optional actions** pattern (see Admin UI).

---

## Components

### Implemented today (inline patterns — migrate to primitives in Step 2)

These class bundles are duplicated across pages. **Do not copy-paste new instances** — use the primitives once they exist, or match these exact strings:

**Primary link button (marketing)**  
`rounded-lg bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-accent-ice`  
Sizes: `md` = `px-8 py-3`, `lg` = `px-8 py-4` (home CTAs).

**Secondary / outline button**  
`rounded-lg border-2 border-white px-8 py-4 text-sm font-semibold text-white transition hover:border-accent-ice hover:text-accent-ice`

**Form submit (accent fill)**  
`w-full rounded-lg bg-accent-ice py-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70`

### UI primitives (`frontend/components/ui/`)

Import from `@/components/ui` or individual files:

| Component | Purpose |
|-----------|---------|
| `Eyebrow` | Single eyebrow spec |
| `PageHero` | Image hero with `size="home" \| "standard" \| "compact"` |
| `Container` | `maxWidth`: `default` \| `narrow` \| `wide` \| `full` |
| `Section` | `spacing`: `standard` \| `tight` \| `none` |
| `SectionHeading` | H2 + optional description |
| `Button` / `LinkButton` | `variant`: `primary` \| `secondary` \| `accent`; `size`: `sm` \| `md` \| `lg` |
| `AdminPageHeader` | Eyebrow + title + description + optional `actions` slot |

Helper: [`frontend/lib/cn.ts`](frontend/lib/cn.ts) for conditional class names.

---

## Forms

### Labels

`mb-2 block text-xs font-semibold text-text-secondary`  
Optional hint: `<span className="font-normal text-text-muted">(optional)</span>`

### Text inputs and textareas

```
w-full rounded-lg border border-white/10 bg-background-card px-4 py-3.5 text-white
outline-none ring-accent-ice/20 placeholder:text-text-muted focus:ring-2
```

Textareas: add `min-h-[120px] resize-y`.

### Success message

`rounded-lg border border-accent-ice/20 bg-accent-ice/10 px-4 py-3 text-center text-sm text-accent-ice`

### Error message

`rounded-lg border border-white/10 bg-background-card px-4 py-3 text-center text-sm text-text-secondary`  
Use `text-accent-ice underline` on inline phone/email links.

### Form layout

`space-y-5` between fields. Primary submit full-width on mobile-friendly flows.

---

## Navigation

**Header:** `PrototypeHeader` — grouped mega-nav from `frontend/lib/prototype-nav.ts`; logo links to `/` (or `/prototype` on preview route).

**Active nav link:** pathname match; ice accent on hover/active in mega panels.

**Staff access:** `StaffAccessLink` in header + footer — shows **Admin** when OAuth session active, **Staff login** otherwise.

**Mobile:** hamburger toggles full-width nav stack.

---

## Imagery

Centralize paths in [`frontend/lib/images.ts`](frontend/lib/images.ts). Hero images: `fill` + `object-cover` + `sizes="100vw"` + `priority` on above-the-fold heroes only.

Alt text: decorative hero backgrounds use `alt=""`; content images need descriptive alt.

---

## Admin UI

- Shell: Workbench wraps staff routes with `data-area="admin"` + `WorkbenchNav`; **electric blue** (`accent-admin`, `#2BB4FF`) distinguishes staff UI from public ice. Charcoal shell (`#101014`) with a soft electric-blue atmosphere and light grid.
- **Nav:** grouped dropdowns from [`frontend/lib/workbench-nav.ts`](frontend/lib/workbench-nav.ts) — AI · CRM · Marketing · Sales & Pay · Inventory (hover/click panels on desktop; accordion on mobile). Do not add flat link lists to the header.
- **AI Studio** (`/workbench/studio`): centered composer — large prompt shell, pill model menu, Text/Image mode, suggestion chips; electric-blue accent (not public ice, not papaya).
- **Design.md presets:** Composer palette menu loads marketing design presets from [`frontend/lib/design-presets.ts`](frontend/lib/design-presets.ts) (condensed Design.md system prompts: Titan Imaging, Public Ice, Email Campaign, LinkedIn Social, Hero / Landing).
- **Shared classes:** [`frontend/lib/workbench-ui.ts`](frontend/lib/workbench-ui.ts) — `workbenchBtnPrimary`, `workbenchCard`, `workbenchLink`, `workbenchMono`, etc.
- **Buttons:** prefer `Button` / `LinkButton` with `variant="admin"` or `variant="adminOutline"` from `@/components/ui`.
- **Page headers:** `WorkbenchPageHeader` with `tone="admin"` eyebrow.
- **Login:** full-screen centered; electric-blue eyebrow + `bg-accent-admin` primary CTA (same atmosphere as shell).
- **Tables:** `workbenchTableWrap` / `workbenchTableHead` / `workbenchTableRow` patterns; mono slugs and action links use `text-accent-admin`. Destructive actions use `text-red-300` only.
- **Forms:** inputs inside `[data-area="admin"]` get lifted fills + electric-blue focus ring via `globals.css`; cards use lighter borders/shadows.
- **Nav:** sticky glass bar; electric-blue brand; active links as electric-blue pills; outlined “View site”; electric-blue “Sign out”.

---

## Motion and interaction

- Transitions: `transition` on buttons and links; `hover:brightness-110` on accent fills.
- Loading: `animate-pulse` skeletons for Suspense fallbacks (see inventory page).
- Avoid heavy animation; medical B2B tone stays calm.

---

## Accessibility

- **Focus:** public inputs use `ring-accent-ice/20`; admin inputs (`[data-area="admin"]`) use an electric-blue focus ring in `globals.css`. Ensure keyboard nav works in mobile menu (`aria-expanded`, `aria-label` on menu button).
- **Contrast:** White / `#bbbbbb` on `#000000` meets goals for body text; verify new accent combinations.
- **Forms:** Every input has `htmlFor` / `id`; required fields marked in copy where helpful.
- **Landmarks:** One `<main>` per page where possible; header/footer semantic elements already in layout components.

---

## How to change the brand globally

1. **Colors / fonts** — Edit [`frontend/tailwind.config.ts`](frontend/tailwind.config.ts) (and `globals.css` CSS variables if used).
2. **Update this file** — Token table and any class examples that reference old values.
3. **Update primitives** — Once `components/ui/*` exist, change variants there first.
4. **Avoid** hunting through every page — refactor pages to primitives so step 3 is sufficient.

### Checklist for a retheme PR

- [ ] `tailwind.config.ts` updated  
- [ ] `Design.md` token table updated  
- [ ] `components/ui/*` updated (when present)  
- [ ] Spot-check: Home, Inventory, Contact, one Workbench page (electric-blue accent)  
- [ ] `npm run lint` + visual check on Vercel preview  

---

## Anti-patterns (do not add)

- One-off hex backgrounds (`bg-[#0d0d0d]`) instead of tokens  
- New eyebrow tracking sizes per page  
- Inline `style={{}}` for colors that belong in Tailwind config  
- Different primary button padding on every page  
- Light-mode sections without an explicit design decision  

---

## References

- Implementation track: [`implementation-plan.md`](implementation-plan.md) §Phase 4.5  
- Frontend app: [`frontend/`](frontend/)  
- Production polish / cutover: [`docs/production-cutover.md`](docs/production-cutover.md)
