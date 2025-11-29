-- 06_project_updates.sql
-- Activity feed / project log (like a construction daily report)

create table project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  
  title text not null,
  body text,
  
  update_type text default 'general' check (update_type in (
    'general', 'progress', 'delay', 'safety', 'weather', 'inspection', 'change_order', 'issue'
  )),
  
  posted_by uuid not null references auth.users default auth.uid(),
  posted_at timestamptz default now() not null,
  
  -- Optional attachments will reference the documents table later
  is_pinned boolean default false
);

-- Indexes
create index idx_updates_project on project_updates(project_id);
create index idx_updates_posted_by on project_updates(posted_by);
create index idx_updates_type on project_updates(update_type);
create index idx_updates_pinned on project_updates(is_pinned) where is_pinned = true;
