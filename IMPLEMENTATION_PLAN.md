# Titan Imaging Website — Implementation Plan

> **Branch:** Create and work from a new feature branch for all implementation.  
> **Stack:** Vercel (frontend) · Supabase (DB + Auth + Storage) · Render (FastAPI backend) · Cal.com (bookings)

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Project Structure](#project-structure)
3. [Phase 1: Foundation & Frontend](#phase-1-foundation--frontend)
4. [Phase 2: Backend & Core Features](#phase-2-backend--core-features)
5. [Phase 3: Admin & Advanced](#phase-3-admin--advanced)
6. [Database Schema](#database-schema)
7. [Deployment Architecture](#deployment-architecture)
8. [Pre-Implementation Checklist](#pre-implementation-checklist)

---

## Technology Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| **Frontend** | Next.js 15 (App Router) | TypeScript, Tailwind CSS; deploy to Vercel |
| **Backend** | FastAPI (Python) | Deploy to Render; JWT validation for admin routes |
| **Database** | Supabase (PostgreSQL) | Includes Auth + Storage; migrations via Alembic |
| **Auth** | Supabase Auth + FastAPI | Supabase issues JWTs; FastAPI validates with PyJWT |
| **Storage** | Supabase Storage | Part images; optional S3 migration later |
| **Bookings** | Cal.com | Embed widget; webhooks sync to DB |
| **Hosting** | Vercel (frontend), Render (API) | No static export needed; full Next.js features |

---

## Project Structure

```
my-website/
├── frontend/                    # Next.js
│   ├── app/
│   │   ├── (public)/           # Home, About, Services, Contact, Sell To Us, Testimonials
│   │   ├── admin/              # Protected admin routes
│   │   └── layout.tsx
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── SearchBar.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── api.ts              # API client for FastAPI
│   │   └── supabase.ts         # Supabase client (auth)
│   ├── public/
│   │   └── logo.png            # TITAN IMAGING logo
│   └── package.json
├── backend/                    # FastAPI
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── parts.py
│   │   │   │   ├── categories.py
│   │   │   │   ├── contact.py
│   │   │   │   └── ...
│   │   │   └── deps.py         # Auth dependency (JWT validation)
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── db/
│   ├── alembic/                # Migrations
│   ├── requirements.txt
│   └── main.py
├── IMPLEMENTATION_PLAN.md
└── TITAN IMAGING (600 x 290 mm).png
```

---

## Phase 1: Foundation & Frontend

**Goal:** Next.js app with design system and all public pages. No backend yet.

**Duration:** 1–2 weeks

### 1.1 Project Setup

- [ ] Create Next.js 15 project with App Router, TypeScript, Tailwind CSS
- [ ] Configure `next.config.js` for Vercel (no `output: 'export'` needed)
- [ ] Set up ESLint and Prettier
- [ ] Copy logo to `frontend/public/logo.png` (from `TITAN IMAGING (600 x 290 mm).png`)

### 1.2 Design System

- [ ] Create Tailwind design tokens in `tailwind.config.js` or CSS variables:
  - Background: `#1E1E1E`, `#111111`, `#282828`, `#2A2A2A`
  - Text: `#FFFFFF`, `#BBBBBB`, `#777777`
  - Accent: `#00FFD5` or `#B0B0B0` (titanium)
- [ ] Typography: Orbitron for headings/logo, Inter for body
- [ ] Add Google Fonts or local font files

### 1.3 Layout Components

- [ ] **Header:** Logo (link to home), nav links (Contact Us, Sell To Us, About Us, Services, Testimonials)
- [ ] **Footer:** Copyright "© 2026 TITAN IMAGING. All Rights Reserved."
- [ ] **Responsive nav:** Mobile hamburger menu for small screens
- [ ] Preserve logo styling: white on dark, no layout changes

### 1.4 Public Pages

| Page | Route | Content |
|------|-------|---------|
| Home | `/` | Hero with "CT/PET Parts & Services", tagline "Precision Parts. Seamless Service. Every Time.", search bar (UI only for now) |
| About Us | `/about` | Placeholder: company story, mission |
| Services | `/services` | Placeholder: list of installation/repair services |
| Contact Us | `/contact` | Contact form UI (Name, Email, Subject, Message, Send Message button) — non-functional |
| Sell To Us | `/sell` | Placeholder or form UI for selling parts |
| Testimonials | `/testimonials` | Placeholder: testimonials carousel or list |

### 1.5 Enhancements (Optional)

- [ ] Service catalog with pricing placeholders
- [ ] Testimonials carousel on Home or Testimonials page
- [ ] Subtle hover effects on nav links and buttons

### 1.6 Deliverables

- Fully navigable Next.js site
- Dark theme matching design
- Logo integrated in header
- All 6 pages with placeholder content
- Deployable to Vercel (manual or CI)

---

## Phase 2: Backend & Core Features

**Goal:** FastAPI backend, Supabase database, working parts search and contact form.

**Duration:** 2–3 weeks

### 2.1 Backend Setup

- [ ] Create FastAPI project in `backend/`
- [ ] Add `requirements.txt`: fastapi, uvicorn, sqlalchemy, alembic, psycopg2-binary, pydantic, python-jose[cryptography], passlib[bcrypt], supabase, python-dotenv
- [ ] Configure CORS for Vercel frontend origin
- [ ] Add health check endpoint: `GET /health`
- [ ] Set up environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`

### 2.2 Database (Supabase)

- [ ] Create Supabase project; note connection string and JWT secret
- [ ] Initialize Alembic for migrations
- [ ] Implement schema (see [Database Schema](#database-schema)):
  - `categories`, `parts`, `part_images`
  - `services`, `customers`, `contact_submissions`
  - `admin_users` (or use Supabase Auth users)
- [ ] Add `tsvector` column + GIN index on `parts` for full-text search
- [ ] Create seed script: sample categories and parts

### 2.3 API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `GET /api/v1/parts` | GET | No | List parts; query params: `search`, `category`, `limit` |
| `GET /api/v1/parts/{id}` | GET | No | Part detail by ID |
| `GET /api/v1/categories` | GET | No | List categories |
| `POST /api/v1/contact` | POST | No | Submit contact form |
| `POST /api/v1/sell` | POST | No | Submit Sell To Us form |

### 2.4 Contact & Sell Forms (Backend)

- [ ] `contact_submissions` table: name, email, subject, message, created_at
- [ ] `sell_submissions` table (or similar): name, email, company, part_details, message, created_at
- [ ] Validation with Pydantic
- [ ] Optional: email notification to admin (Resend, SendGrid, or Supabase Edge Function)

### 2.5 Frontend Integration

- [ ] Create API client in `frontend/lib/api.ts` (base URL from env)
- [ ] Connect Home page search to `GET /api/v1/parts?search=...`
- [ ] Display results: part name, stock status (In Stock / Low Stock / Out of Stock)
- [ ] Connect Contact form to `POST /api/v1/contact`
- [ ] Connect Sell To Us form to `POST /api/v1/sell`
- [ ] Add loading states, error handling, success messages

### 2.6 Deploy Backend

- [ ] Deploy FastAPI to Render (connect repo, set env vars)
- [ ] Update frontend `NEXT_PUBLIC_API_URL` to Render URL

### 2.7 Deliverables

- FastAPI running on Render
- Supabase database with schema and seed data
- Parts search working end-to-end
- Contact and Sell To Us forms functional
- API docs at `https://your-api.onrender.com/docs`

---

## Phase 3: Admin & Advanced

**Goal:** Admin panel with auth, inventory management, sales, customers, bookings, calendar.

**Duration:** 3–4 weeks

### 3.1 Authentication

- [ ] Set up Supabase Auth: email/password for admin users
- [ ] Create admin user(s) in Supabase Auth
- [ ] Frontend: Supabase Auth client; login page at `/admin/login`
- [ ] FastAPI: JWT validation dependency using `SUPABASE_JWT_SECRET`
- [ ] Protected routes: require `Authorization: Bearer <token>`

### 3.2 Admin Layout & Guard

- [ ] Create `/admin` route group with layout
- [ ] Auth guard: redirect to `/admin/login` if not authenticated
- [ ] Admin nav: Dashboard, Parts, Categories, Customers, Sales, Bookings

### 3.3 Inventory Management

- [ ] **Parts List:** Table with search, filter by category, pagination
- [ ] **Add/Edit Part:** Form (part_number, name, description, category, stock, price, status)
- [ ] **Part Images:** Upload to Supabase Storage; display in form and list
- [ ] **Categories CRUD:** List, add, edit, delete categories

### 3.4 Customers & Sales

- [ ] **Customers:** CRUD in admin; fields: name, email, phone, address, company
- [ ] **Sales:** Create sale, add line items (parts/services), quantity, unit price; calculate total
- [ ] **Sales List:** Table with customer, total, status, date

### 3.5 Bookings (Cal.com)

- [ ] Create Cal.com account
- [ ] Configure event types: "Installation Consultation", "Repair Estimate"
- [ ] Embed Cal.com widget on Services page or `/book`
- [ ] Webhook handler in FastAPI: `POST /api/v1/webhooks/calcom` to store bookings in DB
- [ ] `bookings` table: customer_id, cal_com_booking_id, scheduled_at, type, status

### 3.6 Admin Bookings & Calendar

- [ ] Bookings list in admin (from DB, synced via webhook)
- [ ] Interactive calendar (e.g. FullCalendar) showing bookings

### 3.7 Services Management

- [ ] Admin CRUD for services (name, description, base_price, duration_minutes)
- [ ] Public Services page: display services from API

### 3.8 Polish & SEO

- [ ] Testimonials admin (optional `testimonials` table)
- [ ] Micro-animations, improved form UX
- [ ] Meta tags, sitemap, structured data
- [ ] Accessibility: focus states, ARIA where needed

### 3.9 Optional Enhancements

- [ ] Role-based admin (admin vs staff)
- [ ] Audit log for admin actions
- [ ] CSV export for sales/customers

### 3.10 Deliverables

- Full admin panel with auth
- Parts and categories management with image upload
- Customers and sales management
- Cal.com integration with webhook sync
- Admin calendar view
- Production-ready site

---

## Database Schema

### Core Tables

| Table | Key Fields |
|-------|------------|
| `categories` | id, name, slug, created_at |
| `parts` | id, part_number, name, description, category_id, stock_quantity, price, status, search_vector (tsvector), created_at, updated_at |
| `part_images` | id, part_id, url, sort_order |
| `services` | id, name, description, base_price, duration_minutes, created_at |
| `customers` | id, name, email, phone, address, company, created_at |
| `contact_submissions` | id, name, email, subject, message, created_at |
| `sell_submissions` | id, name, email, company, part_details, message, created_at |
| `sales` | id, customer_id, status, total, created_at |
| `sale_items` | id, sale_id, part_id, service_id, quantity, unit_price |
| `bookings` | id, customer_id, cal_com_booking_id, scheduled_at, type, status, created_at |
| `testimonials` | id, author, company, quote, created_at (optional) |

### Auth

- Use Supabase Auth for `admin_users`; no separate `admin_users` table unless linking to custom roles.
- Store Supabase user ID in session; FastAPI validates JWT.

---

## Deployment Architecture

```
User
  │
  ├─► Vercel (Next.js) ─► Static + Server Components
  │
  └─► Render (FastAPI) ─► Supabase (PostgreSQL + Auth + Storage)
                         Cal.com (webhooks)
```

### Environment Variables

**Frontend (Vercel):**
- `NEXT_PUBLIC_API_URL` — Render API URL
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public)

**Backend (Render):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` — Service role for DB access
- `SUPABASE_JWT_SECRET` — For JWT validation
- `CALCOM_WEBHOOK_SECRET` — For webhook verification

---

## Pre-Implementation Checklist

- [ ] Create new branch for implementation
- [ ] Vercel project linked to repo (Next.js preset)
- [ ] Supabase project created; connection string and JWT secret noted
- [ ] Render account created
- [ ] Cal.com account (Phase 3)
- [ ] Logo file available: `TITAN IMAGING (600 x 290 mm).png`

---

## Summary Timeline

| Phase | Duration | Key Output |
|-------|----------|------------|
| **1. Foundation & Frontend** | 1–2 weeks | Next.js site, design system, all public pages |
| **2. Backend & Core Features** | 2–3 weeks | FastAPI, Supabase, search, contact/sell forms |
| **3. Admin & Advanced** | 3–4 weeks | Auth, inventory, sales, customers, Cal.com, calendar |

**Total estimate:** 6–9 weeks for a single developer.
