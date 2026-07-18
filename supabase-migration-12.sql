-- Migration 12: Time-limited access (subscription period)
--
-- Admin grants each approved user a number of months of access. When the
-- period ends the user is signed out and cannot sign in again until the
-- admin extends their access.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_until  timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_months integer;

-- The admin account never expires (NULL = unlimited access)
UPDATE profiles
SET access_until = NULL, access_months = NULL
WHERE email = 'fprojects82@gmail.com';
