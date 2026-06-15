-- ============================================================
-- 016: Vendor reviews & review reminder tracking
-- ============================================================

-- 1. Vendor reviews
CREATE TABLE IF NOT EXISTS vendor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest_id  UUID NOT NULL REFERENCES vendor_interests(id) ON DELETE CASCADE,

  rating  INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One review per commitment
  UNIQUE(interest_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor ON vendor_reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_event  ON vendor_reviews(event_id);

ALTER TABLE vendor_reviews ENABLE ROW LEVEL SECURITY;

-- 2. Review reminder tracking (how many reminders sent per commitment)
CREATE TABLE IF NOT EXISTS review_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id     UUID NOT NULL REFERENCES vendor_interests(id) ON DELETE CASCADE,
  reminder_number INTEGER NOT NULL,  -- 1-based index into review_reminder_schedule
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(interest_id, reminder_number)
);

CREATE INDEX IF NOT EXISTS idx_review_reminders_interest ON review_reminders(interest_id);
