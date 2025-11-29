-- 04_projects.sql
-- Core projects table – fully normalized

create table projects (
  id uuid primary key default gen_random_uuid(),
  project_number text unique not null, -- e.g., PRJ-2025-001
  title text not null,
  description text,
  
  -- Key relationships
  client_id uuid not null references profiles(id),
  manager_id uuid references profiles(id), -- main project manager
  
  -- Dates
  start_date date,
  expected_completion_date date,
  actual_completion_date date,
  
  -- Budget & financial
  budget_numeric numeric(14,2),
  currency char(3) default 'USD',
  
  -- Address (construction site)
  site_address text,
  site_city text,
  site_state text,
  site_zip text,
  site_country text default 'USA',
  
  -- Status & metadata
  status text default 'planning', -- we'll create a proper status table later if needed
  progress_percent smallint default 0 check (progress_percent between 0 and 100),
  
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  created_by uuid references auth.users not null default auth.uid()
);

-- Indexes for performance
create index idx_projects_client on projects(client_id);
create index idx_projects_manager on projects(manager_id);
create index idx_projects_status on projects(status);
create index idx_projects_number on projects(project_number);
