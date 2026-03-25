# Implementation Checklist

Each chunk is scoped to be completable in a single session. Work through them in order — later chunks depend on earlier ones.

Status key: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Chunk 1 — Project Setup & Monorepo Structure ✅
- [x] Initialise Next.js app (`/web`)
- [x] Initialise backend API (`/api`) — NestJS
- [x] Set up monorepo structure (npm workspaces)
- [x] Configure ESLint, Prettier, TypeScript for both apps
- [ ] Set up GitHub repo and connect Vercel (frontend) and Render (backend)
- [x] Add `.env.example` files for both apps with all required keys

---

## Chunk 2 — Database Schema & Migrations
- [ ] Create Supabase project
- [ ] Write migration: `users` table
- [ ] Write migration: `events` table
- [ ] Write migration: `vendors` table
- [ ] Write migration: `vendor_categories` table
- [ ] Write migration: `guest_lists` table
- [ ] Write migration: `guest_invites` table (token, QR code URL, allocation, check-in status)
- [ ] Write migration: `plus_one_requests` table (guest_invite_id, requested_count, status)
- [ ] Write migration: `gift_lists` table
- [ ] Write migration: `audit_logs` table
- [ ] Add all indexes (vendor category, location, event type, invite token)
- [ ] Seed vendor categories (venues, caterers, photographers, DJs, decorators)

---

## Chunk 3 — Authentication
- [ ] Configure Supabase Auth (email/password)
- [ ] Backend: auth middleware (JWT validation)
- [ ] Backend: role-based access control (user vs admin)
- [ ] Frontend: sign up page
- [ ] Frontend: log in page
- [ ] Frontend: protected route wrapper
- [ ] Frontend: session persistence + logout

---

## Chunk 4 — Event Onboarding Questionnaire (Frontend)
- [ ] Build step-by-step questionnaire UI (one question per screen)
- [ ] Questions: event type, date, location, guest count, budget, style/theme, existing vendors
- [ ] Progress indicator
- [ ] Store answers in local state as user progresses
- [ ] Submit answers to backend on completion

---

## Chunk 5 — Event Plan Generation (Backend)
- [ ] API endpoint: `POST /events/generate-plan`
- [ ] Accept questionnaire answers as input
- [ ] Rule-based checklist generation (based on event type + timeline)
  - [ ] Define checklist templates per event type (wedding, birthday, corporate, etc.)
  - [ ] Adjust timeline milestones based on event date
- [ ] Budget breakdown logic (allocate % per vendor category based on event type)
- [ ] Return: checklist, proposed plan summary, budget allocation
- [ ] Save event + generated plan to DB

---

## Chunk 6 — Event Plan Display & Management (Frontend)
- [ ] Display generated checklist (checkable items)
- [ ] Display proposed event plan (budget breakdown, milestones)
- [ ] Allow host to edit checklist items (add, remove, rename)
- [ ] Allow host to adjust budget allocations
- [ ] Save changes back to backend

---

## Chunk 7 — Vendor Seed Data & Discovery (Backend + Frontend)
- [ ] Seed 20–30 vendor records in DB (name, category, location, price range, rating, photos, contact)
- [ ] API endpoint: `GET /vendors` (with filters: category, location, budget)
- [ ] Vendor recommendation endpoint: `GET /events/:id/recommended-vendors`
  - [ ] Filter by location match
  - [ ] Filter by budget range
  - [ ] Sort by curated ranking/rating
- [ ] Frontend: vendor browsing page (filterable list)
- [ ] Frontend: vendor profile page (photos, pricing, reviews, contact button)
- [ ] Frontend: recommended vendors section on event plan page
- [ ] Contact vendor via WhatsApp/phone (link out)

---

## Chunk 8 — Guest List Management (Backend + Frontend)
- [ ] API: `POST /events/:id/guests` — add a guest (name, email, plus-one allocation)
- [ ] API: `GET /events/:id/guests` — list all guests
- [ ] API: `PATCH /guests/:id` — update guest details or allocation
- [ ] API: `DELETE /guests/:id` — remove a guest
- [ ] Frontend: guest list page (add, edit, remove guests)
- [ ] Frontend: set plus-one allocation per guest when adding

---

## Chunk 9 — Smart Invites & QR Codes (Backend + Frontend)
- [ ] On guest creation, generate unique invite token (UUID)
- [ ] Generate QR code image from invite link and store in Supabase storage
- [ ] API: `GET /invites/:token` — public endpoint, returns event info + guest allocation
- [ ] Frontend: guest-facing invite page (event details, QR code, allocated spots)
- [ ] Integrate Resend/SendGrid — send invite email to guest on creation
  - [ ] Invite email template (event name, date, location, QR code, allocated spots)
- [ ] API: `POST /invites/:token/request-plus-one` — guest submits a request for extra spots
- [ ] Store request in `plus_one_requests` table with status `pending`

---

## Chunk 10 — Plus-One Approval Flow (Backend + Frontend)
- [ ] On new plus-one request, send email notification to host
  - [ ] Email: guest name, event name, number requested, link to approve/reject in app
- [ ] API: `PATCH /plus-one-requests/:id` — host approves or rejects
- [ ] On approval: update guest invite allocation, regenerate QR code if needed
- [ ] On approval/rejection: send outcome email to guest
- [ ] Frontend: pending requests list on guest list page (approve/reject buttons)
- [ ] Frontend: badge/counter showing pending requests

---

## Chunk 11 — Check-in Interface (Frontend + Backend)
- [ ] API: `POST /check-in` — accepts QR token, returns guest info, validates, marks as arrived
  - [ ] Return: guest name, total allocation, guests already checked in, remaining
  - [ ] Prevent over-check-in (can't check in more than allocation)
- [ ] Frontend: check-in page (mobile-optimised, no login required for coordinator)
  - [ ] Manual token/name lookup option
  - [ ] QR code scanner (use device camera via browser API)
  - [ ] Display result: green (valid) / red (invalid or over-limit)
  - [ ] Show checked-in count per guest

---

## Chunk 12 — Gift List & Cash Contributions (Backend + Frontend)
- [ ] API: `POST /events/:id/gift-list` — create gift list items
- [ ] API: `GET /events/:id/gift-list` — fetch gift list
- [ ] API: `PATCH /gift-list/:id` — update item (mark as purchased, etc.)
- [ ] Paystack/Flutterwave: generate cash contribution link per event
- [ ] Frontend: gift list creation page
- [ ] Frontend: shareable gift list page (public-facing)
- [ ] Display cash contribution link with copy/share button

---

## Chunk 13 — Admin Portal: Vendor Management
- [ ] Separate admin route (protected by admin role)
- [ ] Vendor list view (all vendors, status, category)
- [ ] Add new vendor form (name, category, location, price range, photos, contact)
- [ ] Edit/deactivate vendor

---

## Chunk 13b — Admin Portal: Analytics Dashboard
- [ ] Track and display: questionnaire completions, plans saved
- [ ] Track and display: vendor profile views and contact clicks
- [ ] Track and display: guest lists created, invites sent
- [ ] PostHog integration on backend events

---

## Chunk 14 — Email Templates & Notifications Polish
- [ ] Invite email (event details + QR code)
- [ ] Plus-one request notification to host
- [ ] Plus-one approved email to guest
- [ ] Plus-one rejected email to guest
- [ ] Ensure all emails are mobile-friendly and branded

---

## Chunk 15 — CI/CD, Analytics & Final Deployment
- [ ] GitHub Actions: lint + build check on every PR
- [ ] PostHog: instrument key events (questionnaire completed, plan saved, vendor clicked, invite sent, check-in scanned)
- [ ] Environment variables set on Vercel and Render
- [ ] Final deployment smoke test (all flows end-to-end)
- [ ] HTTPS verified on all endpoints

---

## Summary

| Chunk | Area | Depends On |
|-------|------|------------|
| 1 | Project setup | — |
| 2 | DB schema | 1 |
| 3 | Auth | 2 |
| 4 | Questionnaire UI | 3 |
| 5 | Plan generation (backend) | 2 |
| 6 | Plan display (frontend) | 4, 5 |
| 7 | Vendor discovery | 2, 6 |
| 8 | Guest list management | 3, 2 |
| 9 | Smart invites & QR codes | 8 |
| 10 | Plus-one approval flow | 9 |
| 11 | Check-in interface | 9, 10 |
| 12 | Gift list & payments | 3, 2 |
| 13 | Admin portal: vendor management | 3, 7 |
| 13b | Admin portal: analytics dashboard | 13 |
| 14 | Email polish | 9, 10 |
| 15 | CI/CD & deployment | all |
