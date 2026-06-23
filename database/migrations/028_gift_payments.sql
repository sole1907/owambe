-- Extend gift_lists with organiser bank account for receiving direct transfers
ALTER TABLE gift_lists
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_recipient_code TEXT;

-- Add soft-claim tracking to wishlist items
ALTER TABLE gift_list_items
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS claimed_by_name TEXT;

-- Paystack inline cash gift payments (gifter pays inflated amount; platform transfers gift_amount to organiser)
CREATE TABLE event_gift_payments (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_list_id          UUID        NOT NULL REFERENCES gift_lists (id) ON DELETE CASCADE,
  event_id              UUID        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  gifter_name           TEXT        NOT NULL,
  gifter_email          TEXT,
  message               TEXT,
  gift_amount_kobo      INTEGER     NOT NULL,
  charge_kobo           INTEGER     NOT NULL,
  platform_fee_kobo     INTEGER     NOT NULL DEFAULT 10000,
  paystack_reference    TEXT        UNIQUE,
  paystack_transfer_code TEXT,
  status                TEXT        NOT NULL DEFAULT 'pending',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Self-reported direct bank transfers (organiser confirms after receipt)
CREATE TABLE event_gift_direct_transfers (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_list_id UUID        NOT NULL REFERENCES gift_lists (id) ON DELETE CASCADE,
  event_id     UUID        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  gifter_name  TEXT        NOT NULL,
  amount_naira INTEGER     NOT NULL,
  message      TEXT,
  status       TEXT        NOT NULL DEFAULT 'pending',
  confirmed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_gift_payments_gift_list  ON event_gift_payments (gift_list_id);
CREATE INDEX idx_event_gift_payments_reference  ON event_gift_payments (paystack_reference);
CREATE INDEX idx_event_gift_direct_transfers_gl ON event_gift_direct_transfers (gift_list_id);
