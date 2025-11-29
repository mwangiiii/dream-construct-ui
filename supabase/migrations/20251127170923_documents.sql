-- 10_documents.sql
-- File management (links to Supabase Storage)

create table documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  milestone_id uuid references project_milestones(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  
  name text not null,
  file_path text not null, -- full path in storage bucket
  file_size bigint,
  mime_type text,
  
  uploaded_by uuid not null references auth.users default auth.uid(),
  uploaded_at timestamptz default now() not null,
  
  folder text default 'general', -- e.g., blueprints, permits, photos, contracts
  is_public boolean default false
);

create index idx_documents_project on documents(project_id);
create index idx_documents_folder on documents(folder);
create index idx_documents_task on documents(task_id);
