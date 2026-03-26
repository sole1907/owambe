CREATE TABLE plus_one_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_invite_id UUID NOT NULL REFERENCES guest_invites (id) ON DELETE CASCADE,
  requested_count INTEGER NOT NULL CHECK (requested_count > 0),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plus_one_requests_invite ON plus_one_requests (guest_invite_id);
CREATE INDEX idx_plus_one_requests_status ON plus_one_requests (status);
