-- 09_tasks.sql
-- Granular assignable tasks (under milestones or standalone)

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  milestone_id uuid references project_milestones(id) on delete set null,
  
  title text not null,
  description text,
  
  assigned_to uuid references auth.users,
  due_date date,
  completed_at timestamptz,
  status text default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  
  created_by uuid not null references auth.users default auth.uid(),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_tasks_project on tasks(project_id);
create index idx_tasks_assigned on tasks(assigned_to);
create index idx_tasks_status on tasks(status);
create index idx_tasks_milestone on tasks(milestone_id);
