-- Migration 3: building structure limits, building name, category
-- people (e.g. security guards), recurring expense intervals, and
-- previous-years history
-- Run this in Supabase SQL Editor (safe to run more than once)

-- Building name + structure controls (buildings / floors / apartments per floor)
alter table building_settings add column if not exists building_name text not null default '';
alter table building_settings add column if not exists num_buildings integer not null default 1;
alter table building_settings add column if not exists num_floors integer not null default 13;
alter table building_settings add column if not exists mezzanine_floors integer not null default 2;
alter table building_settings add column if not exists apartments_per_floor integer not null default 0;

-- Which building an apartment belongs to (only meaningful when num_buildings > 1)
alter table apartments add column if not exists building_no integer not null default 1;

-- Months between occurrences of a recurring expense (1 = monthly)
alter table expenses add column if not exists recurring_interval integer not null default 1;

-- People working under an expense category (security guards, cleaners, ...)
create table if not exists category_people (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references expense_categories(id) on delete cascade,
  name text not null
);
create index if not exists idx_category_people_category_id on category_people(category_id);

-- Migrated totals for previous years, with an optional percentage
-- breakdown of the expenditure keyed by category name
create table if not exists yearly_history (
  id uuid primary key default uuid_generate_v4(),
  year integer not null unique,
  income numeric not null default 0,
  expenditure numeric not null default 0,
  expense_breakdown jsonb not null default '{}'::jsonb
);
