# Database Migrations

All migrations are plain SQL files, numbered in order. Run them sequentially in Supabase's SQL editor or via the Supabase CLI.

## Running migrations

### Option A — Supabase SQL Editor (easiest for MVP)
1. Open your Supabase project → SQL Editor
2. Run each file in order: `001_`, `002_`, `003_`, ...

### Option B — Supabase CLI
```bash
supabase db push
```

## Migration files

| File | Description |
|------|-------------|
| 001_create_users.sql | Users table |
| 002_create_vendor_categories.sql | Vendor categories + seed data |
| 003_create_vendors.sql | Vendor profiles |
| 004_create_events.sql | Events |
| 005_create_event_plans.sql | Generated plans and checklists |
| 006_create_guest_lists.sql | Guest lists and invites (with QR tokens) |
| 007_create_plus_one_requests.sql | Plus-one approval requests |
| 008_create_gift_lists.sql | Gift lists and items |
| 009_create_audit_logs.sql | Audit logs |
