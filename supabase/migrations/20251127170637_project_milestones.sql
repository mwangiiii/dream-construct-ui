-- 05_project_milestones.sql

create table project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  
  title text not null,
  description text,
  
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  
  progress_percent smallint default 0 check (progress_percent between 0 and 100),
  status text default 'not_started', -- not_started, in_progress, completed, delayed
  
  sort_order int default 0,
  
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  created_by uuid references auth.users default auth.uid()
);

-- Indexes
create index idx_milestones_project on project_milestones(project_id);
create index idx_milestones_status on project_milestones(status);
