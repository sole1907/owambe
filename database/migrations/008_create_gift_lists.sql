CREATE TABLE gift_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES events (id) ON DELETE CASCADE,
  cash_contribution_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  cash_contribution_link TEXT, -- Paystack payment link
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gift_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_list_id UUID NOT NULL REFERENCES gift_lists (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_estimate INTEGER, -- in Naira
  is_purchased BOOLEAN NOT NULL DEFAULT FALSE,
  purchased_by TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gift_list_items_gift_list ON gift_list_items (gift_list_id);
