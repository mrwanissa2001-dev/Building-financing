-- Migration 2: recurring monthly payments and expenses
-- Run this in Supabase SQL Editor (safe to run more than once)

alter table payments add column if not exists recurring boolean not null default false;
alter table expenses add column if not exists recurring boolean not null default false;
