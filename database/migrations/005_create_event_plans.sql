-- Stores the generated plan and checklist for an event
CREATE TABLE event_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES events (id) ON DELETE CASCADE,
  budget_breakdown JSONB NOT NULL DEFAULT '{}', -- { "catering": 40, "venue": 30, ... } as %
  milestones JSONB NOT NULL DEFAULT '[]',       -- [{ "title": "...", "due_weeks_before": 12 }]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_event ON checklist_items (event_id);
