-- Migration 10: Admin auto-setup + skip email verification
-- Run this in Supabase SQL Editor

-- 1. Confirm the admin email (bypass email verification)
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email = 'fprojects82@gmail.com';

-- 2. Ensure admin profile exists and is approved
UPDATE profiles
SET status = 'approved', is_admin = true
WHERE email = 'fprojects82@gmail.com';

-- 3. Auto-confirm all new sign-ups so email verification is never required.
--    Go to Supabase Dashboard -> Authentication -> Providers -> Email
--    and DISABLE "Confirm email" toggle.
--    This migration handles existing rows; the toggle prevents future ones
--    from needing confirmation.

-- 4. Confirm any existing unconfirmed users
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- 5. Migrate any legacy "pending_email" profiles to "pending_approval"
UPDATE profiles
SET status = 'pending_approval'
WHERE status = 'pending_email';
