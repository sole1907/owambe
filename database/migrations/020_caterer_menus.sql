-- ============================================================
-- 020: Caterer menu items, pricing tiers, and menu selections
-- ============================================================
-- Adds per-item menu configuration for caterers, tiered pricing
-- by serving count, and per-interest menu selections for quotes.
-- Run this AFTER migrations 001–019.
-- ============================================================

-- ── 1. CATERER MENU ITEMS ───────────────────────────────────
-- Each row is one dish/drink offered by a caterer vendor.

CREATE TABLE IF NOT EXISTS caterer_menu_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL
    CHECK (category IN ('Rice Dishes', 'Swallows & Soups', 'Small Chops', 'Proteins', 'Drinks')),
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caterer_menu_items_vendor
  ON caterer_menu_items(vendor_id);

ALTER TABLE caterer_menu_items ENABLE ROW LEVEL SECURITY;

-- ── 2. CATERER MENU PRICING TIERS ───────────────────────────
-- Volume-based pricing per menu item.
-- Tiers must not overlap; the application is responsible for
-- ordering and selecting the correct tier at quote time.

CREATE TABLE IF NOT EXISTS caterer_menu_pricing_tiers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id      UUID NOT NULL REFERENCES caterer_menu_items(id) ON DELETE CASCADE,
  min_servings      INT NOT NULL DEFAULT 1,
  max_servings      INT,          -- NULL means "unlimited" (open-ended top tier)
  price_per_serving NUMERIC NOT NULL,  -- in Naira
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_serving_range
    CHECK (max_servings IS NULL OR max_servings > min_servings)
);

CREATE INDEX IF NOT EXISTS idx_caterer_menu_pricing_tiers_item
  ON caterer_menu_pricing_tiers(menu_item_id);

ALTER TABLE caterer_menu_pricing_tiers ENABLE ROW LEVEL SECURITY;

-- ── 3. VENDOR INTEREST MENU SELECTIONS ──────────────────────
-- Line items chosen by an event organiser when requesting a
-- catering quote. Prices and names are snapshotted at the time
-- of selection so historical records remain accurate even if
-- the menu item is later updated.

CREATE TABLE IF NOT EXISTS vendor_interest_menu_selections (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id        UUID NOT NULL REFERENCES vendor_interests(id) ON DELETE CASCADE,
  menu_item_id       UUID NOT NULL REFERENCES caterer_menu_items(id),
  menu_item_name     TEXT NOT NULL,     -- snapshot at order time
  menu_item_category TEXT NOT NULL,     -- snapshot at order time
  servings           INT NOT NULL,
  price_per_serving  NUMERIC NOT NULL,  -- snapshot at order time
  subtotal           NUMERIC NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interest_menu_selections_interest
  ON vendor_interest_menu_selections(interest_id);

ALTER TABLE vendor_interest_menu_selections ENABLE ROW LEVEL SECURITY;

-- ── 4. DISCOUNT COLUMNS ON VENDOR_INTERESTS ─────────────────
-- Tracks any discount negotiation on a catering interest.

ALTER TABLE vendor_interests
  ADD COLUMN IF NOT EXISTS discount_requested NUMERIC,
  ADD COLUMN IF NOT EXISTS discount_offered   NUMERIC;
