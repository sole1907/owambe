CREATE TABLE vendor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendor_categories_slug ON vendor_categories (slug);

-- Seed default categories
INSERT INTO vendor_categories (name, slug, description) VALUES
  ('Venues', 'venues', 'Event halls, outdoor spaces, and private venues'),
  ('Caterers', 'caterers', 'Food and drink catering services'),
  ('Photographers', 'photographers', 'Event photography'),
  ('Videographers', 'videographers', 'Event videography and coverage'),
  ('DJs', 'djs', 'Disc jockeys and sound equipment'),
  ('Live Bands', 'live-bands', 'Live music performances'),
  ('MCs', 'mcs', 'Masters of ceremony and event hosts'),
  ('Decorators', 'decorators', 'Event decoration and styling'),
  ('Makeup Artists', 'makeup-artists', 'Bridal and event makeup'),
  ('Event Coordinators', 'event-coordinators', 'Full event planning and coordination'),
  ('Security', 'security', 'Event security and crowd management'),
  ('Waitstaff', 'waitstaff', 'Serving staff and bar attendants'),
  ('Aso-ebi Vendors', 'aso-ebi-vendors', 'Fabric and aso-ebi coordination');
