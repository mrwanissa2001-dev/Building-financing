-- Migration 5: dashboard-effect toggles and expense paid status
-- Run this in Supabase SQL Editor (safe to run more than once)

-- A transfer can be recorded for reference only, without shifting the
-- dashboard's Cash on Hand / Bank Balance
alter table transfers add column if not exists on_dashboard boolean not null default true;

-- A migrated prior year can be kept record-only: its cash/bank splits
-- never touch the dashboard balances when this is false
alter table yearly_history add column if not exists on_dashboard boolean not null default true;

-- An expense can be logged before it is actually paid (a bill still
-- owed). Unpaid expenses stay in the log but are kept out of every
-- dashboard money total and show as "not paid" in the recurring grid.
alter table expenses add column if not exists paid boolean not null default true;
