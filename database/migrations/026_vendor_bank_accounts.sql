-- ============================================================
-- 026: Vendor bank accounts for payout transfers
-- ============================================================
-- Stores the bank account each vendor wants payouts sent to.
-- paystack_recipient_code is created lazily on first transfer.
-- Test vendors are seeded with a Paystack test account so the
-- cron can process releases end-to-end in the test environment.
-- ============================================================

-- 1. Vendor bank accounts table
CREATE TABLE IF NOT EXISTS vendor_bank_accounts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id                UUID NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,
  account_number           TEXT NOT NULL,
  bank_code                TEXT NOT NULL,
  bank_name                TEXT NOT NULL,
  account_name             TEXT NOT NULL,
  paystack_recipient_code  TEXT,                      -- set lazily on first transfer
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vba_vendor ON vendor_bank_accounts(vendor_id);

-- 2. Add transfer-tracking columns + widen status constraint
ALTER TABLE interest_payment_schedule
  ADD COLUMN IF NOT EXISTS paystack_transfer_code  TEXT,
  ADD COLUMN IF NOT EXISTS transfer_error          TEXT;

-- Drop the old check constraint and replace with one that includes 'processing'
ALTER TABLE interest_payment_schedule
  DROP CONSTRAINT IF EXISTS interest_payment_schedule_status_check;

ALTER TABLE interest_payment_schedule
  ADD CONSTRAINT interest_payment_schedule_status_check
  CHECK (status IN ('scheduled', 'processing', 'released', 'refunded', 'skipped'));

-- 3. Seed all test vendors with Paystack test bank account details.
--    paystack_recipient_code will be created lazily on the first
--    transfer attempt. Using account_number 0000000001 + Access Bank
--    (044) which Paystack accepts in test mode.
INSERT INTO vendor_bank_accounts (vendor_id, account_number, bank_code, bank_name, account_name)
SELECT
  v.id,
  '0000000001',
  '044',
  'Access Bank',
  v.name
FROM vendors v
WHERE v.is_test_vendor = TRUE
ON CONFLICT (vendor_id) DO NOTHING;
