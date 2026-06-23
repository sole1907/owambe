CREATE TABLE event_collaborators (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES users (id) ON DELETE CASCADE, -- null until invite accepted
  invited_email TEXT       NOT NULL,
  role         TEXT        NOT NULL DEFAULT 'coordinator',
  status       TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'active', 'revoked')),
  invite_token TEXT        NOT NULL UNIQUE,
  invited_by   UUID        NOT NULL REFERENCES users (id),
  message      TEXT,
  accepted_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_collaborators_event ON event_collaborators (event_id);
CREATE INDEX idx_event_collaborators_token ON event_collaborators (invite_token);
CREATE INDEX idx_event_collaborators_user  ON event_collaborators (user_id);
