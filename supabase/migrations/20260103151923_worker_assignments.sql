-- 09_worker_assignments.sql
-- Worker assignments to projects/milestones (supports the Task Assignments tab)
create table worker_assignments (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references workers(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  milestone_id uuid references project_milestones(id) on delete set null, -- optional specific milestone
  task_description text, -- extra details if not tied to a milestone
  assigned_role text,     -- e.g., "Lead Mason"
  start_date date,
  end_date date,
  status assignment_status default 'assigned' not null,
  -- Optional fields to support performance tracking
  tasks_assigned int default 1 check (tasks_assigned >= 0),
  tasks_completed int default 0 check (tasks_completed >= 0 and tasks_completed <= tasks_assigned),
  quality_score smallint check (quality_score between 0 and 100), -- manual rating
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  created_by uuid references auth.users(id) default auth.uid() not null
);

-- Indexes
create index idx_worker_assignments_worker on worker_assignments(worker_id);
create index idx_worker_assignments_project on worker_assignments(project_id);
create index idx_worker_assignments_milestone on worker_assignments(milestone_id);
create index idx_worker_assignments_status on worker_assignments(status);