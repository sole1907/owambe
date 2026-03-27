# Implementation Checklist

Each chunk is scoped to be completable in a single session. Work through them in order — later chunks depend on earlier ones.

Status key: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Chunk 1 — Project Setup & Monorepo Structure ✅

- [x] Initialise Next.js app (`/web`)
- [x] Initialise backend API (`/api`) — NestJS
- [x] Set up monorepo structure (npm workspaces)
- [x] Configure ESLint, Prettier, TypeScript for both apps
- [x] Set up GitHub repo and connect Vercel (frontend) and Render (backend)
- [x] Add `.env.example` files for both apps with all required keys

---

## Chunk 2 — Database Schema & Migrations ✅

- [x] Create Supabase project (manual — needs your account)
- [x] Write migration: `users` table
- [x] Write migration: `events` table + `event_plans` + `checklist_items`
- [x] Write migration: `vendors` table
- [x] Write migration: `vendor_categories` table
- [x] Write migration: `guest_lists` table
- [x] Write migration: `guest_invites` table (token, QR code URL, allocation, check-in status)
- [x] Write migration: `plus_one_requests` table (guest_invite_id, requested_count, status)
- [x] Write migration: `gift_lists` + `gift_list_items` table
- [x] Write migration: `audit_logs` table
- [x] Add all indexes (vendor category, location, event type, invite token)
- [x] Seed vendor categories (13 categories for Nigerian owambe context)

---

## Chunk 3 — Authentication ✅

- [x] Configure Supabase Auth (email/password)
- [x] Backend: auth middleware (JWT validation)
- [x] Backend: role-based access control (user vs admin)
- [x] Frontend: sign up page
- [x] Frontend: log in page
- [x] Frontend: protected route wrapper
- [x] Frontend: session persistence + logout

---

## Chunk 4 — Event Onboarding Questionnaire (Frontend) ✅

- [x] Build step-by-step questionnaire UI (one question per screen)
- [x] Questions: event type, date, location, guest count, budget, style/theme, existing vendors
- [x] Progress indicator
- [x] Store answers in local state as user progresses
- [x] Submit answers to backend on completion

---

## Chunk 5 — Event Plan Generation (Backend) ✅

- [x] API endpoint: `POST /events/generate-plan`
- [x] Accept questionnaire answers as input
- [x] Rule-based checklist generation (based on event type + timeline)
  - [x] Define checklist templates per event type (wedding, birthday, naming ceremony, corporate, burial, other)
  - [x] Adjust timeline milestones based on event date
- [x] Budget breakdown logic (allocate % per vendor category based on event type)
- [x] Return: checklist, proposed plan summary, budget allocation
- [x] Save event + generated plan to DB

---

## Chunk 6 — Event Plan Display & Management (Frontend) ✅

- [x] Display generated checklist (checkable items)
- [x] Display proposed event plan (budget breakdown, milestones)
- [x] Allow host to edit checklist items (add, remove, rename)
- [x] Allow host to adjust budget allocations
- [x] Save changes back to backend

---

## Chunk 7 — Vendor Seed Data & Discovery (Backend + Frontend) ✅

- [x] Seed 20–30 vendor records in DB (name, category, location, price range, rating, photos, contact)
- [x] API endpoint: `GET /vendors` (with filters: category, location, budget)
- [x] Vendor recommendation endpoint: `GET /events/:id/recommended-vendors`
  - [x] Filter by location match
  - [x] Filter by budget range
  - [x] Sort by curated ranking/rating
- [x] Frontend: vendor browsing page (filterable list)
- [x] Frontend: vendor profile page (photos, pricing, reviews, contact button)
- [x] Frontend: recommended vendors section on event plan page
- [x] Contact vendor via WhatsApp/phone (link out)
- [x] Home page with hero, features, and redirect for logged-in users

---

## Chunk 8 — Guest List Management (Backend + Frontend) ✅

- [x] API: `POST /events/:id/guests` — add a guest (name, email, plus-one allocation)
- [x] API: `GET /events/:id/guests` — list all guests
- [x] API: `GET /events/:id/guests/stats` — totals, RSVP breakdown
- [x] API: `PATCH /guests/:id` — update guest details or allocation
- [x] API: `DELETE /guests/:id` — remove a guest
- [x] Frontend: guest list tab on event page (add, edit, remove guests)
- [x] Frontend: set plus-one allocation per guest when adding
- [x] Frontend: stats summary (total invites, total spots, accepted count)

---

## Chunk 9 — Smart Invites & QR Codes (Backend + Frontend) ✅

- [x] On guest creation, generate unique invite token (UUID)
- [x] Generate QR code image from invite link and store in Supabase storage
- [x] API: `GET /invites/:token` — public endpoint, returns event info + guest allocation
- [x] Frontend: guest-facing invite page (event details, QR code, allocated spots)
- [x] Integrate Resend — send invite email to guest on creation
  - [x] Invite email template (event name, date, location, QR code, allocated spots)
- [x] API: `POST /invites/:token/request-plus-one` — guest submits a request for extra spots
- [x] Store request in `plus_one_requests` table with status `pending`
- [x] Host notified by email when plus-one request is submitted

---

## Chunk 10 — Plus-One Approval Flow (Backend + Frontend) ✅

- [x] On new plus-one request, send email notification to host
  - [x] Email: guest name, event name, number requested, link to approve/reject in app
- [x] API: `PATCH /plus-one-requests/:id` — host approves or rejects
- [x] API: `GET /events/:id/plus-one-requests` — list pending requests for an event
- [x] On approval: update guest invite allocation, regenerate QR code
- [x] On approval/rejection: send outcome email to guest
- [x] Frontend: pending requests list on guest list page (approve/reject buttons)
- [x] Frontend: badge/counter showing pending requests on Guests tab

---

## Chunk 11 — Check-in Interface (Frontend + Backend) ✅

- [x] API: `POST /check-in` — accepts QR token, returns guest info, validates, marks as arrived
  - [x] Return: guest name, total allocation, guests already checked in, remaining
  - [x] Prevent over-check-in (can't check in more than allocation)
- [x] Frontend: check-in page (mobile-optimised, no login required for coordinator)
  - [x] Manual token/name lookup option
  - [x] QR code scanner (use device camera via browser API)
  - [x] Display result: green (valid) / red (invalid or over-limit)
  - [x] Show checked-in count per guest

---

## Chunk 12 — Gift List & Cash Contributions (Backend + Frontend) ✅

- [x] API: `POST /events/:id/gift-list/items` — add gift list items
- [x] API: `GET /events/:id/gift-list` — fetch gift list (public)
- [x] API: `PATCH /gift-list/items/:id` — update item (mark as purchased, etc.)
- [x] API: `DELETE /gift-list/items/:id` — remove item
- [x] Paystack: generate cash contribution payment page per event
- [x] API: `POST /events/:id/gift-list/cash-contribution` — enable + create Paystack page
- [x] Frontend: gift list management tab on event page (add items, enable cash contributions)
- [x] Frontend: shareable gift list page at `/gifts/[eventId]` (public-facing, no auth)
- [x] Display cash contribution link with copy/share button on both host and public views

---

## Chunk 13 — Admin Portal: Vendor Management ✅

- [x] Separate admin route `/admin` (protected by admin role — redirects non-admins)
- [x] Vendor list view — all vendors (active + inactive), category, city, price range, rating
- [x] Filter vendors by status (all / active / inactive)
- [x] Toggle active/inactive inline from the list
- [x] Add new vendor form (name, category, location, price range, contact, photos, featured flag)
- [x] Edit vendor (full form pre-populated, active/featured toggles)

---

## Chunk 13b — Admin Portal: Analytics Dashboard ✅

- [x] Track and display: questionnaire completions, plans saved (events with generated plans)
- [x] Track and display: vendor profile views (PostHog `vendor_viewed` event on GET /vendors/:slug)
- [x] Track and display: guest lists created, invites sent (PostHog `guest_added` + `invite_sent`)
- [x] PostHog integration on backend — `plan_generated`, `vendor_viewed`, `guest_added`, `invite_sent`
- [x] Admin analytics page at `/admin/analytics` — live DB counts: events by type, questionnaire conversion rate, guests/invites/check-ins, plus-one request breakdown, vendor stats
- [x] `POSTHOG_KEY` added to API `.env.example` and config

---

## Chunk 14b — Tests (>90% Coverage) ✅

- [x] Shared Supabase mock builder (`api/src/test/supabase.mock.ts`) — chainable + awaitable
- [x] `api/src/events/plan-generator/budget-templates.spec.ts` — all 6 types, sums to 100%, positive %
- [x] `api/src/events/plan-generator/checklist-templates.spec.ts` — all types, non-empty titles, ordered
- [x] `api/src/events/plan-generator/plan-generator.service.spec.ts` — due dates, null dates, budget amounts, fallback, sortOrder
- [x] `api/src/analytics/posthog.service.spec.ts` — init with/without key, capture, no-op, shutdown
- [x] `api/src/analytics/analytics.service.spec.ts` — zeroed stats, full aggregation
- [x] `api/src/email/email.service.spec.ts` — all 3 emails: subject, recipient, HTML content, Resend failure safety
- [x] `api/src/auth/auth.service.spec.ts` — signUp/signIn success and failure paths
- [x] `api/src/invites/invites.service.spec.ts` — checkIn, getInviteByToken, requestPlusOne, reviewPlusOneRequest
- [x] `api/src/guests/guests.service.spec.ts` — addGuest, getGuests, updateGuest, deleteGuest
- [x] `api/src/gifts/gifts.service.spec.ts` — getGiftList, addItem, updateItem, deleteItem, enableCashContribution
- [x] `api/src/vendors/vendors.service.spec.ts` — getVendors, getVendor, getCategories, adminCreateVendor, adminUpdateVendor
- [x] `web/jest.config.ts` — Next.js/SWC, jsdom, path aliases, 90%/80% thresholds
- [x] `web/jest.setup.ts` — `@testing-library/jest-dom` imports
- [x] `web/__tests__/lib/api.test.ts` — GET/POST/PATCH/DELETE, token headers, error handling
- [x] `web/__tests__/lib/posthog.test.ts` — init (with/without key, SSR guard, idempotent), capture, identify, reset
- [x] `api/package.json` — coverage exclusions, 90% threshold, `test:cov` script
- [x] `web/package.json` — jest + @types/jest added, `test` and `test:cov` scripts
- [x] `.github/workflows/ci.yml` — `npm run test:cov` added to both web and api jobs

---

## Chunk 14 — Email Templates & Notifications Polish ✅

- [x] Invite email (event details + QR code)
- [x] Plus-one request notification to host
- [x] Plus-one approved email to guest
- [x] Plus-one rejected email to guest
- [x] All emails mobile-friendly and consistently branded

---

## Chunk 15 — CI/CD, Analytics & Final Deployment ✅

- [x] GitHub Actions: lint + build check on every PR and push to master/develop (`.github/workflows/ci.yml`)
- [x] PostHog frontend: `posthog-js` installed; `PostHogBootstrap` component initialises on mount, identifies users on sign-in, resets on sign-out
- [x] PostHog events instrumented: `vendor_contact_clicked` (method: whatsapp/phone/instagram), `checkin_scanned` (success/failure + allocation info)
- [x] Backend PostHog events already wired in Chunk 13b: `plan_generated`, `vendor_viewed`, `guest_added`, `invite_sent`
- [x] Environment variable reference documented at `docs/deployment-env-vars.md` (Render + Vercel + Supabase Storage steps)
- [x] Smoke test checklist documented (sign-up → event → guests → invite → check-in → gifts → admin)

---

## Summary

| Chunk | Area                              | Depends On |
| ----- | --------------------------------- | ---------- |
| 1     | Project setup                     | —          |
| 2     | DB schema                         | 1          |
| 3     | Auth                              | 2          |
| 4     | Questionnaire UI                  | 3          |
| 5     | Plan generation (backend)         | 2          |
| 6     | Plan display (frontend)           | 4, 5       |
| 7     | Vendor discovery                  | 2, 6       |
| 8     | Guest list management             | 3, 2       |
| 9     | Smart invites & QR codes          | 8          |
| 10    | Plus-one approval flow            | 9          |
| 11    | Check-in interface                | 9, 10      |
| 12    | Gift list & payments              | 3, 2       |
| 13    | Admin portal: vendor management   | 3, 7       |
| 13b   | Admin portal: analytics dashboard | 13         |
| 14    | Email polish                      | 9, 10      |
| 14b   | Tests (>90% coverage)             | all        |
| 15    | CI/CD & deployment                | all        |
