-- ============================================================
-- 022: Decorator styles, packages, guest-count pricing tiers,
--      and per-interest package selections
-- ============================================================
-- Parallel to the caterer menu system (020), but for decorators:
--  - style tags (aesthetic offered)
--  - package tiers (Basic / Standard / Premium) priced by guest band
-- Run this AFTER migrations 001–021.
-- ============================================================

-- ── 1. DECORATOR STYLES ─────────────────────────────────────
-- Many decorator vendors × many style names.

CREATE TABLE IF NOT EXISTS decorator_styles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id  UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  style      TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_decorator_styles_vendor ON decorator_styles(vendor_id);
ALTER TABLE decorator_styles ENABLE ROW LEVEL SECURITY;

-- ── 2. DECORATOR PACKAGES ───────────────────────────────────
-- Basic / Standard / Premium per decorator.

CREATE TABLE IF NOT EXISTS decorator_packages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,          -- e.g. 'Basic', 'Standard', 'Premium'
  description TEXT,
  includes    TEXT[] NOT NULL DEFAULT '{}',   -- bullet list of what's covered
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_decorator_packages_vendor ON decorator_packages(vendor_id);
ALTER TABLE decorator_packages ENABLE ROW LEVEL SECURITY;

-- ── 3. DECORATOR PACKAGE GUEST TIERS ────────────────────────
-- Price varies by guest count band.

CREATE TABLE IF NOT EXISTS decorator_package_guest_tiers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id   UUID NOT NULL REFERENCES decorator_packages(id) ON DELETE CASCADE,
  min_guests   INT NOT NULL DEFAULT 1,
  max_guests   INT,           -- NULL = unlimited
  price        NUMERIC NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_guest_range CHECK (max_guests IS NULL OR max_guests > min_guests)
);
CREATE INDEX IF NOT EXISTS idx_decorator_package_guest_tiers_pkg ON decorator_package_guest_tiers(package_id);
ALTER TABLE decorator_package_guest_tiers ENABLE ROW LEVEL SECURITY;

-- ── 4. VENDOR INTEREST DECORATOR SELECTIONS ─────────────────
-- Snapshot of the chosen package on a vendor_interest.

CREATE TABLE IF NOT EXISTS vendor_interest_decorator_selections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id      UUID NOT NULL REFERENCES vendor_interests(id) ON DELETE CASCADE,
  package_id       UUID REFERENCES decorator_packages(id),
  package_name     TEXT NOT NULL,     -- snapshot
  package_includes TEXT[] NOT NULL DEFAULT '{}',  -- snapshot
  guest_count      INT NOT NULL,
  price            NUMERIC NOT NULL,  -- snapshot
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_interest_decorator_sel_interest ON vendor_interest_decorator_selections(interest_id);
ALTER TABLE vendor_interest_decorator_selections ENABLE ROW LEVEL SECURITY;
