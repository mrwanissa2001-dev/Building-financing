-- Migration 7: Per-user data isolation via RLS

-- Add user_id column to all existing data tables
ALTER TABLE apartments        ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE payments          ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE expenses          ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE category_people   ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE yearly_history    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE transfers         ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE building_settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Enable RLS on all data tables
ALTER TABLE apartments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_people    ENABLE ROW LEVEL SECURITY;
ALTER TABLE yearly_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_settings  ENABLE ROW LEVEL SECURITY;

-- RLS policies: each user sees only their own rows
CREATE POLICY "owner_apartments"   ON apartments         USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_payments"     ON payments           USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_expenses"     ON expenses           USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_categories"   ON expense_categories USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_people"       ON category_people    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_history"      ON yearly_history     USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_transfers"    ON transfers          USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_settings"     ON building_settings  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Existing rows: assign to the first admin user
-- (Run this manually after setting up the admin account:)
-- UPDATE apartments         SET user_id = '<admin-uuid>' WHERE user_id IS NULL;
-- UPDATE payments           SET user_id = '<admin-uuid>' WHERE user_id IS NULL;
-- (etc for all tables)
