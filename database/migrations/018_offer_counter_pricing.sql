-- Migration 018: Replace service_fee with offer/counter negotiation pricing
-- Adds offered_price (user's initial offer), counter_price (vendor counter),
-- agreed_price (final agreed amount used for commitment fee calculation).
-- Adds 'quoted' status for when vendor has countered but user hasn't accepted yet.

-- 1. Add pricing negotiation columns to vendor_interests
ALTER TABLE vendor_interests
  ADD COLUMN IF NOT EXISTS offered_price   NUMERIC,
  ADD COLUMN IF NOT EXISTS counter_price   NUMERIC,
  ADD COLUMN IF NOT EXISTS agreed_price    NUMERIC;

-- 2. Extend status to include 'quoted' (vendor countered, awaiting user acceptance)
ALTER TABLE vendor_interests
  DROP CONSTRAINT IF EXISTS vendor_interests_status_check;

ALTER TABLE vendor_interests
  ADD CONSTRAINT vendor_interests_status_check
    CHECK (status IN ('pending', 'available', 'quoted', 'unavailable', 'expired', 'committed'));
