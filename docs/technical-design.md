# Technical Design

Digital Event Planning Assistant (Nigeria)

## 1. Architecture Overview

A lightweight, scalable, cost-free-to-start architecture:

Additional services:

- Auth (Supabase)
- File storage (Supabase)
- Payments (Paystack/Flutterwave)
- Analytics (PostHog)

---

## 2. Frontend

### Framework

- Next.js (React-based, SEO-friendly, server-side rendering)
- Hosted on Vercel (free tier)

### Responsibilities

- Questionnaire UI
- Vendor browsing
- Guest list management (add guests, set allocations, approve/reject plus-one requests)
- Gift list creation
- Event plan display
- Guest invite view (public-facing page for invitees — shows QR code, event info, allocation)
- Check-in interface (scan or lookup QR codes at the door)

---

## 3. Backend

### Option A: Node.js (Express or NestJS)

### Option B: Python (FastAPI)

Hosted on:

- Render free tier  
  or
- Fly.io free tier

### Responsibilities

- Business logic
- Vendor recommendation engine
- Event plan generation
- API endpoints for CRUD operations
- Guest invite generation (unique token + QR code per guest)
- Plus-one request/approval workflow
- Email notifications (invite delivery, request alerts, approval/rejection) via Resend/SendGrid
- Check-in endpoint (validate QR token, return guest details, mark as arrived)

---

## 4. Database

### Supabase PostgreSQL (free tier)

Tables:

- Users
- Events
- Vendors
- Vendor categories
- Guest lists
- Guest invites (unique token, QR code, allocation, check-in status)
- Plus-one requests (guest, requested count, status: pending/approved/rejected)
- Gift lists
- Logs & analytics

Indexes:

- Vendor category index
- Location index
- Event type index
- Guest invite token index (for fast QR code lookup at check-in)

---

## 5. Vendor Recommendation Engine

Simple rule-based MVP:

- Filter by location
- Filter by budget range
- Filter by category
- Sort by rating or curated ranking

Future upgrade:

- Machine learning recommendations
- Dynamic pricing insights

---

## 6. Security & Privacy

- HTTPS enforced
- JWT authentication
- Role-based access control (user vs vendor)
- Encrypted data at rest (Supabase default)
- Minimal PII storage
- Secure payment redirection (no card data stored)
- Audit logs for vendor interactions

---

## 7. Deployment Plan

### Phase 1 — MVP (Free)

- Frontend → Vercel
- Backend → Render/Fly.io
- Database → Supabase free tier
- Storage → Supabase
- Auth → Supabase
- Payments → Paystack/Flutterwave
- Analytics → PostHog free tier

### Phase 2 — Growth

- Move backend to AWS Lightsail or DigitalOcean
- Add Redis for caching
- Add Cloudflare for CDN + security

### Phase 3 — Scale

- Kubernetes cluster (EKS/GKE)
- Dedicated Postgres instance
- Vendor-side dashboards
- Event automation workflows

---

## 8. Future Technical Enhancements

- Mobile app (React Native)
- AI-driven vendor matching
- Real-time chat with vendors
- Asoebi color/style generator
- Event timeline automation
