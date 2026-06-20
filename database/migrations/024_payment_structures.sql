-- ============================================================
-- 024: Vendor payment structures + booking cancellations
-- ============================================================
-- Implements the 3-bucket payment model agreed in design:
--   commitment % → released X days before event
--   materials %  → released Y days before event (for material-cost vendors)
--   balance %    → released Z hours after event (quality guarantee)
-- Buckets must sum to 100. Balance must be >= 20%.
-- Vendor must agree to terms before structure goes live.
-- ============================================================

-- 1. Vendor payment structure (one per vendor, versioned by terms agreement)
CREATE TABLE IF NOT EXISTS vendor_payment_structures (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id                 UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  -- Bucket percentages (must sum to 100)
  commitment_pct            INTEGER NOT NULL DEFAULT 20,
  materials_pct             INTEGER NOT NULL DEFAULT 0,
  balance_pct               INTEGER NOT NULL DEFAULT 80,

  -- Release timings
  commitment_release_days   INTEGER NOT NULL DEFAULT 30,  -- days before event
  materials_release_days    INTEGER NOT NULL DEFAULT 14,  -- days before event
  balance_release_hours     INTEGER NOT NULL DEFAULT 48,  -- hours after event

  -- Terms agreement
  terms_agreed_at           TIMESTAMPTZ,
  terms_version             INTEGER NOT NULL DEFAULT 1,
  is_active                 BOOLEAN NOT NULL DEFAULT FALSE, -- inactive until terms agreed

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(vendor_id),
  CONSTRAINT pcts_sum_to_100     CHECK (commitment_pct + materials_pct + balance_pct = 100),
  CONSTRAINT balance_min_20      CHECK (balance_pct >= 20),
  CONSTRAINT commitment_min_10   CHECK (commitment_pct >= 10),
  CONSTRAINT commitment_release  CHECK (commitment_release_days >= 7),
  CONSTRAINT materials_release   CHECK (materials_release_days >= 7),
  CONSTRAINT balance_release_min CHECK (balance_release_hours >= 24),
  CONSTRAINT balance_release_max CHECK (balance_release_hours <= 168)
);

CREATE INDEX IF NOT EXISTS idx_vps_vendor ON vendor_payment_structures(vendor_id);
ALTER TABLE vendor_payment_structures ENABLE ROW LEVEL SECURITY;

-- 2. Per-booking payment schedule (created when interest is committed)
--    Tracks when each bucket is due to be released to the vendor
CREATE TABLE IF NOT EXISTS interest_payment_schedule (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id         UUID NOT NULL REFERENCES vendor_interests(id) ON DELETE CASCADE,
  bucket              TEXT NOT NULL CHECK (bucket IN ('commitment', 'materials', 'balance')),

  amount_kobo         INTEGER NOT NULL,         -- snapshot at time of booking
  pct_snapshot        INTEGER NOT NULL,         -- % used to compute amount
  scheduled_at        TIMESTAMPTZ NOT NULL,     -- when this bucket is due for release
  released_at         TIMESTAMPTZ,              -- when actually released
  refunded_at         TIMESTAMPTZ,              -- if refunded due to cancellation

  status              TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled', 'released', 'refunded', 'skipped')),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ips_interest ON interest_payment_schedule(interest_id);
CREATE INDEX IF NOT EXISTS idx_ips_status   ON interest_payment_schedule(status, scheduled_at);
ALTER TABLE interest_payment_schedule ENABLE ROW LEVEL SECURITY;

-- 3. Booking cancellations
CREATE TABLE IF NOT EXISTS booking_cancellations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id               UUID NOT NULL REFERENCES vendor_interests(id) ON DELETE CASCADE,

  cancelled_by              TEXT NOT NULL CHECK (cancelled_by IN ('organiser', 'vendor')),
  cancelled_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Funds accounting
  held_funds_returned_kobo  INTEGER NOT NULL DEFAULT 0,  -- returned to organiser immediately
  outstanding_kobo          INTEGER NOT NULL DEFAULT 0,  -- vendor owes organiser (already released)

  -- Repayment tracking (vendor cancellations only)
  repayment_deadline        TIMESTAMPTZ,
  extension_requested_at    TIMESTAMPTZ,
  extension_granted         BOOLEAN NOT NULL DEFAULT FALSE,
  repayment_completed_at    TIMESTAMPTZ,

  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN (
                                'pending',           -- awaiting vendor repayment
                                'extension_granted', -- vendor got extra 7 days
                                'repaid',            -- vendor paid everything back
                                'escalated',         -- deadline passed, no repayment
                                'no_outstanding'     -- nothing owed (held covered everything)
                              )),

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_interest ON booking_cancellations(interest_id);
ALTER TABLE booking_cancellations ENABLE ROW LEVEL SECURITY;

-- 4. Cancellation timeline events (organiser transparency thread)
CREATE TABLE IF NOT EXISTS cancellation_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancellation_id     UUID NOT NULL REFERENCES booking_cancellations(id) ON DELETE CASCADE,
  event_type          TEXT NOT NULL,  -- e.g. 'cancelled', 'held_returned', 'repayment_demanded', etc.
  message             TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ce_cancellation ON cancellation_events(cancellation_id, created_at);
ALTER TABLE cancellation_events ENABLE ROW LEVEL SECURITY;

-- 5. Extend vendor_interests to track cancellation + total contract amount
ALTER TABLE vendor_interests
  ADD COLUMN IF NOT EXISTS total_contract_kobo  INTEGER,       -- full agreed amount in kobo
  ADD COLUMN IF NOT EXISTS cancelled_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by         TEXT CHECK (cancelled_by IN ('organiser', 'vendor'));

-- Extend vendor_interests status to include 'cancelled'
ALTER TABLE vendor_interests
  DROP CONSTRAINT IF EXISTS vendor_interests_status_check;

ALTER TABLE vendor_interests
  ADD CONSTRAINT vendor_interests_status_check
    CHECK (status IN ('pending', 'available', 'quoted', 'unavailable', 'expired', 'committed', 'cancelled'));
