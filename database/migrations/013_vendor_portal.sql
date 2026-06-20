-- ============================================================
-- 013: Vendor Portal
-- ============================================================

-- 1. Extend vendors table
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commitment_fee_percentage INTEGER NOT NULL DEFAULT 20
    CHECK (commitment_fee_percentage >= 10 AND commitment_fee_percentage <= 50),
  ADD COLUMN IF NOT EXISTS service_fee INTEGER,
  ADD COLUMN IF NOT EXISTS per_unit_cost INTEGER,
  ADD COLUMN IF NOT EXISTS per_unit_label TEXT,
  ADD COLUMN IF NOT EXISTS has_material_costs BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS balance_payment_methods TEXT[] NOT NULL DEFAULT ARRAY['bank_transfer'],
  ADD COLUMN IF NOT EXISTS cancellation_policy JSONB NOT NULL DEFAULT '{
    "full_refund_days": 14,
    "partial_refund_days": 7,
    "partial_refund_percentage": 50
  }'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id) WHERE user_id IS NOT NULL;

-- 2. Vendor availability
CREATE TABLE IF NOT EXISTS vendor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'blocked' CHECK (status IN ('blocked', 'booked')),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor_id, date)
);

CREATE INDEX IF NOT EXISTS idx_vendor_availability_vendor ON vendor_availability(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_availability_date ON vendor_availability(date);

ALTER TABLE vendor_availability ENABLE ROW LEVEL SECURITY;

-- 3. Platform settings
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (key, value) VALUES
  ('max_vendor_choices',      '3'),
  ('booking_response_hours',  '48'),
  ('commitment_hold_hours',   '48'),
  ('commitment_fee_min_pct',  '10'),
  ('commitment_fee_max_pct',  '50'),
  ('review_reminder_schedule','[7, 4, 4, 4, 4]')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
