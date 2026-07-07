-- Migration 4: cash<->bank transfers, extra payments (not tied to
-- months, optionally hidden from the dashboard), and prior-year
-- cash/bank splits so migrated years carry into the balances
-- Run this in Supabase SQL Editor (safe to run more than once)

-- Money moved between the cash box and the bank account
create table if not exists transfers (
  id uuid primary key default uuid_generate_v4(),
  amount numeric not null,
  from_method text not null check (from_method in ('cash', 'bank')),
  to_method text not null check (to_method in ('cash', 'bank')),
  date date not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_transfers_date on transfers(date);

-- Extra payments: money received that does not advance the month
-- coverage (e.g. a resident settling last year's dues), with a switch
-- to keep it off the dashboard numbers
alter table payments add column if not exists extra boolean not null default false;
alter table payments add column if not exists on_dashboard boolean not null default true;

-- How a prior year's totals split between cash and bank — these carry
-- into the dashboard's Cash on Hand / Bank Balance
alter table yearly_history add column if not exists income_cash numeric not null default 0;
alter table yearly_history add column if not exists income_bank numeric not null default 0;
alter table yearly_history add column if not exists expenditure_cash numeric not null default 0;
alter table yearly_history add column if not exists expenditure_bank numeric not null default 0;
