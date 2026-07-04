-- BuildFin: Building Finance Manager - Database Schema
-- Run this SQL in your Supabase SQL Editor to create all required tables

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Expense Categories
create table expense_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique
);

-- Seed default categories
insert into expense_categories (name) values
  ('maintenance'),
  ('water'),
  ('electricity'),
  ('internet'),
  ('security'),
  ('cleaning'),
  ('extras'),
  ('other');

-- Apartments
create table apartments (
  id uuid primary key default uuid_generate_v4(),
  unit_number text not null unique,
  floor integer not null default 0,
  primary_resident_name text not null,
  phone text not null default '',
  email text not null default '',
  payment_interval text not null default 'monthly'
    check (payment_interval in ('monthly', 'bimonthly', 'quarterly', 'biannual', 'annual')),
  monthly_due_amount numeric not null default 0,
  occupancy_status text not null default 'active'
    check (occupancy_status in ('active', 'mia', 'traveling_but_paying')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Payments
create table payments (
  id uuid primary key default uuid_generate_v4(),
  apartment_id uuid not null references apartments(id) on delete cascade,
  payer_name text not null,
  amount numeric not null,
  method text not null check (method in ('cash', 'bank')),
  date_paid date not null,
  period_start date not null,
  period_end date not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Expenses
create table expenses (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references expense_categories(id),
  amount numeric not null,
  method text not null check (method in ('cash', 'bank')),
  date date not null,
  vendor text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Building Settings (single row)
create table building_settings (
  id uuid primary key default uuid_generate_v4(),
  total_apartments integer not null default 0,
  expected_yearly_income numeric not null default 0,
  expected_yearly_expenditure numeric not null default 0
);

-- Insert default settings row
insert into building_settings (total_apartments, expected_yearly_income, expected_yearly_expenditure)
values (0, 0, 0);

-- Indexes for common queries
create index idx_payments_apartment_id on payments(apartment_id);
create index idx_payments_date_paid on payments(date_paid);
create index idx_expenses_category_id on expenses(category_id);
create index idx_expenses_date on expenses(date);

-- Row Level Security (optional, enable if using Supabase Auth)
-- alter table apartments enable row level security;
-- alter table payments enable row level security;
-- alter table expenses enable row level security;
-- alter table expense_categories enable row level security;
-- alter table building_settings enable row level security;
