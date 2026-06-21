-- ============================================================
-- 027: Platform fee on commitment payments
-- ============================================================
-- Owambe charges 5% of the total contract value, capped at
-- ₦50,000, collected from the organiser at checkout alongside
-- the vendor's commitment fee.
-- platform_fee_kobo tracks Owambe's cut per transaction.
-- The vendor's payment schedule is unaffected — it is still
-- calculated from amount_kobo (the commitment portion only).
-- ============================================================

ALTER TABLE commitment_payments
  ADD COLUMN IF NOT EXISTS platform_fee_kobo INTEGER NOT NULL DEFAULT 0;
