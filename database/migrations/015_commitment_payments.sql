-- ============================================================
-- 015: Commitment payments (Phase 3 - Paystack escrow)
-- ============================================================

-- 1. Extend vendor_interests status to include 'committed'
ALTER TABLE vendor_interests
  DROP CONSTRAINT IF EXISTS vendor_interests_status_check;

ALTER TABLE vendor_interests
  ADD CONSTRAINT vendor_interests_status_check
    CHECK (status IN ('pending', 'available', 'unavailable', 'expired', 'committed'));

-- 2. Commitment payments ledger
CREATE TABLE IF NOT EXISTS commitment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id UUID NOT NULL REFERENCES vendor_interests(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  amount_kobo INTEGER NOT NULL,       -- in kobo (Paystack unit)
  commitment_pct INTEGER NOT NULL,    -- snapshot of vendor's commitment_fee_percentage at time of payment

  paystack_reference TEXT NOT NULL UNIQUE,
  paystack_access_code TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'refunded')),

  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commitment_payments_interest   ON commitment_payments(interest_id);
CREATE INDEX IF NOT EXISTS idx_commitment_payments_user       ON commitment_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_commitment_payments_reference  ON commitment_payments(paystack_reference);

ALTER TABLE commitment_payments ENABLE ROW LEVEL SECURITY;
