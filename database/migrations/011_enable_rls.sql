-- Enable Row-Level Security on all tables.
-- The API uses the service_role key which bypasses RLS, so no existing
-- functionality is affected. These policies block direct anon/public access.

-- ============================================================
-- Enable RLS
-- ============================================================
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors              ENABLE ROW LEVEL SECURITY;
ALTER TABLE events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_lists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_invites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE plus_one_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_lists           ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_list_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Public read-only access for catalog data
-- (vendors and vendor_categories are public browsing data)
-- ============================================================
CREATE POLICY "Public can read active vendor categories"
  ON vendor_categories FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Public can read active vendors"
  ON vendors FOR SELECT
  USING (is_active = TRUE);

-- ============================================================
-- All other tables: no anon policies
-- Access is exclusively through the service_role API.
-- ============================================================
-- users, events, event_plans, checklist_items, guest_lists,
-- guest_invites, plus_one_requests, gift_lists, gift_list_items,
-- audit_logs — no policies added, so all direct anon access is denied.
