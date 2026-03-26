CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL, -- wedding, birthday, naming_ceremony, corporate, etc.
  event_date DATE,
  event_date_approximate TEXT, -- e.g. "Q3 2025" if exact date unknown
  location TEXT,
  city TEXT,
  guest_count_estimate INTEGER,
  budget_estimate INTEGER, -- in Naira
  style_theme TEXT,
  has_existing_vendors BOOLEAN DEFAULT FALSE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'confirmed', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_user ON events (user_id);
CREATE INDEX idx_events_type ON events (event_type);
