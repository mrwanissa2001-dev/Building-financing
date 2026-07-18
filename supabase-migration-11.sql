-- Migration 11 (fixed): RLS policies on profiles table
-- Users see/edit their own profile; the admin email sees/edits ALL profiles.
--
-- NOTE: the admin policies check the JWT email directly. Checking the
-- profiles table from inside a profiles policy causes infinite recursion,
-- which breaks every profile query (empty sidebar admin link, broken login).

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "own_profile_read" ON profiles;
CREATE POLICY "own_profile_read" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "own_profile_update" ON profiles;
CREATE POLICY "own_profile_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (on signup)
DROP POLICY IF EXISTS "own_profile_insert" ON profiles;
CREATE POLICY "own_profile_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admin (by email) can read ALL profiles (for the admin panel)
DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
CREATE POLICY "admin_read_all_profiles" ON profiles
  FOR SELECT USING ((auth.jwt() ->> 'email') = 'fprojects82@gmail.com');

-- Admin (by email) can update ALL profiles (approve/reject)
DROP POLICY IF EXISTS "admin_update_all_profiles" ON profiles;
CREATE POLICY "admin_update_all_profiles" ON profiles
  FOR UPDATE USING ((auth.jwt() ->> 'email') = 'fprojects82@gmail.com');

-- Safety: make sure the admin account itself is flagged correctly
UPDATE profiles
SET status = 'approved', is_admin = true
WHERE email = 'fprojects82@gmail.com';
