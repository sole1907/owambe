CREATE TABLE guest_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES events (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE guest_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_list_id UUID NOT NULL REFERENCES guest_lists (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  allocation INTEGER NOT NULL DEFAULT 1, -- number of spots (including themselves)
  token TEXT NOT NULL UNIQUE,            -- unique UUID used in invite URL
  qr_code_url TEXT,                      -- stored in Supabase storage
  rsvp_status TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'accepted', 'declined')),
  checked_in_count INTEGER NOT NULL DEFAULT 0,
  invite_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guest_invites_guest_list ON guest_invites (guest_list_id);
CREATE INDEX idx_guest_invites_token ON guest_invites (token); -- fast QR lookup
CREATE INDEX idx_guest_invites_email ON guest_invites (email);
