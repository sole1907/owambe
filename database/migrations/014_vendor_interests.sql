-- ============================================================
-- 014: Vendor Interests (A/B/C shortlisting) + venue media
-- ============================================================

-- 1. Add venue-specific columns to vendors
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS capacity INTEGER,       -- max guests (venues only)
  ADD COLUMN IF NOT EXISTS videos TEXT[] DEFAULT '{}'; -- video URLs

-- 2. Vendor interests table (event organiser shortlists vendors A/B/C)
CREATE TABLE IF NOT EXISTS vendor_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id   UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES vendor_categories(id),

  -- A=1, B=2, C=3
  preference_rank INTEGER NOT NULL CHECK (preference_rank BETWEEN 1 AND 3),

  -- Lifecycle status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'available', 'unavailable', 'expired')),

  event_date DATE,          -- the event date sent to the vendor
  expires_at TIMESTAMPTZ,   -- when the inquiry window closes (48h from creation)
  vendor_response_at TIMESTAMPTZ,
  vendor_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A vendor can only appear once per event
  UNIQUE(event_id, vendor_id),
  -- A rank slot (A/B/C) is unique per event+category
  UNIQUE(event_id, category_id, preference_rank)
);

CREATE INDEX IF NOT EXISTS idx_vendor_interests_event     ON vendor_interests(event_id);
CREATE INDEX IF NOT EXISTS idx_vendor_interests_vendor    ON vendor_interests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_interests_status    ON vendor_interests(status);
CREATE INDEX IF NOT EXISTS idx_vendor_interests_expires   ON vendor_interests(expires_at) WHERE status = 'pending';

ALTER TABLE vendor_interests ENABLE ROW LEVEL SECURITY;
