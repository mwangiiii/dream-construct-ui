-- 1:1 extension of auth.users
create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  full_name    text,
  avatar_url   text,
  phone        text,
  company_name text,
  job_title    text,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

-- Indexes
create index idx_profiles_full_name on profiles(full_name);
