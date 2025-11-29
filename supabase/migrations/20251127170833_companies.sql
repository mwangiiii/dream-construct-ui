-- 08_companies.sql
-- For multi-company / multi-client support

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  tax_id text,
  phone text,
  email text,
  website text,
  
  -- Address
  address text,
  city text,
  state text,
  zip_code text,
  country text default 'USA',
  
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Link profiles to companies
alter table profiles
  add column if not exists company_id uuid references companies(id);

create index idx_companies_name on companies(name);
create index idx_profiles_company on profiles(company_id);