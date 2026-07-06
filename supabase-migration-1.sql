-- Migration 1: floors as text (mezzanine M1/M2), second phone,
-- second inhabitant, payer relation
-- Run this in Supabase SQL Editor (safe to run more than once)

-- Floor becomes text so mezzanine floors "M1" and "M2" can be stored
alter table apartments alter column floor drop default;
alter table apartments alter column floor type text using floor::text;
alter table apartments alter column floor set default '1';

-- Second phone number and second inhabitant per apartment
alter table apartments add column if not exists phone2 text not null default '';
alter table apartments add column if not exists secondary_resident_name text not null default '';

-- Relation of the person who paid (father, mother, sister, brother, friend, other)
alter table payments add column if not exists payer_relation text not null default '';
