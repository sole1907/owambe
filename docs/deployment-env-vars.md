# Deployment Environment Variables

## Render (API backend)

Set these in **Environment → Environment Variables** on each service (dev & prod).

| Variable | Description | Example |
|---|---|---|
| `PORT` | Port the API listens on | `3001` |
| `NODE_ENV` | `staging` (develop branch) or `production` (master) | `production` |
| `SUPABASE_URL` | Supabase project URL — **Settings → API → Project URL** | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — **Settings → API → service_role** ⚠️ keep secret | `eyJ...` |
| `JWT_SECRET` | Random secret used to sign JWTs — generate with `openssl rand -base64 48` | `abc123...` |
| `RESEND_API_KEY` | Resend API key — **resend.com → API Keys** | `re_...` |
| `PAYSTACK_SECRET_KEY` | Paystack secret key — **dashboard.paystack.com → Settings → API Keys** | `sk_live_...` |
| `POSTHOG_KEY` | PostHog project API key (server-side) — **posthog.com → Project → API Keys** | `phc_...` |
| `APP_URL` | Public URL of the frontend (used in email links) | `https://owambe.vercel.app` |

> **Tip:** Mark `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, and `PAYSTACK_SECRET_KEY` as **Secret** in Render so they are encrypted at rest and not visible in logs.

---

## Vercel (Web frontend)

Set these in **Project → Settings → Environment Variables**. Apply to Production, Preview, and Development as appropriate.

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Render API URL for each environment | `https://owambe-api.onrender.com` |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key (client-side) — same key as backend | `phc_...` |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host (default is fine) | `https://app.posthog.com` |

> `NEXT_PUBLIC_*` variables are embedded into the client bundle at build time — never put secrets here.

---

## Supabase Storage (manual step)

Before deploying, create the `invites` bucket in Supabase Storage:

1. Go to **Storage → New bucket**
2. Name: `invites`
3. Set **Public bucket** to ✅ enabled
4. This bucket stores QR code images (no PII — only UUID-based filenames)

---

## Database migrations

Run all migrations **in order** via the Supabase SQL Editor:

```
001_create_users.sql
002_create_vendor_categories.sql
003_create_vendors.sql
004_create_events.sql
005_create_event_plans.sql
006_create_guest_lists.sql
007_create_plus_one_requests.sql
008_create_gift_lists.sql
009_create_audit_logs.sql
010_seed_vendors.sql
```

---

## Smoke test checklist

Run through these flows after each production deployment:

- [ ] Sign up → log in → dashboard loads
- [ ] Create new event (questionnaire → plan generated → checklist shows)
- [ ] Browse vendors → vendor profile → contact button works
- [ ] Add guest → invite email received → QR code in email
- [ ] Visit `/invite/[token]` → request plus-one → host email received → approve → guest email received
- [ ] Visit `/checkin?eventId=[id]` → scan QR → green result shown
- [ ] Add gift list item → enable cash contribution → public page visible at `/gifts/[id]`
- [ ] Admin: `/admin/vendors` → add vendor → appears in list
- [ ] Admin: `/admin/analytics` → numbers load
