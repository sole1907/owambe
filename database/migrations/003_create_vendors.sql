CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES vendor_categories (id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  location TEXT NOT NULL,
  city TEXT NOT NULL,
  price_min INTEGER, -- in Naira (kobo-free for MVP)
  price_max INTEGER,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  instagram TEXT,
  website TEXT,
  photos TEXT[] DEFAULT '{}',
  rating NUMERIC(2, 1) DEFAULT 0.0,
  review_count INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendors_category ON vendors (category_id);
CREATE INDEX idx_vendors_city ON vendors (city);
CREATE INDEX idx_vendors_active ON vendors (is_active);
