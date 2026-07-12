-- Migration 6: Authentication tables

-- profiles: one row per registered user, approval state
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  building_name TEXT,
  status        TEXT NOT NULL DEFAULT 'pending_email'
                CHECK (status IN ('pending_email', 'pending_approval', 'approved', 'rejected')),
  rejected_reason TEXT,
  is_admin      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  approved_at   TIMESTAMPTZ,
  approved_by   TEXT
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- Users can only read/update their own profile
CREATE POLICY "users_own_profile" ON profiles
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
-- Admin reads all profiles via service role only (not needed for anon)

-- active_sessions: single-session enforcement
CREATE TABLE IF NOT EXISTS active_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  device_hint   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  last_seen_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_sessions" ON active_sessions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS active_sessions_user_id_idx ON active_sessions (user_id);

-- Trigger: when a user verifies their email (email_confirmed_at becomes set),
-- the app manually updates status from pending_email -> pending_approval.
-- No trigger needed here; it's done in application code after getUser() confirms.
