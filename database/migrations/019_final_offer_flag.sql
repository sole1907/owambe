-- Add is_final_offer flag to vendor_interests.
-- When true, the recipient can only accept or decline — no counter-offer is permitted.
ALTER TABLE vendor_interests
  ADD COLUMN IF NOT EXISTS is_final_offer BOOLEAN NOT NULL DEFAULT FALSE;
