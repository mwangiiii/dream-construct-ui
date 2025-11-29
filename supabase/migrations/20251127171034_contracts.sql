-- 13_contacts.sql
-- Clients, subcontractors, architects, suppliers, etc.

create table contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  project_id uuid references projects(id) on delete set null,
  
  full_name text not null,
  email text,
  phone text,
  role text, -- e.g., Architect, Electrician, Owner Rep
  company text,
  
  created_at timestamptz default now() not null,
  created_by uuid references auth.users
);

create index idx_contacts_project on contacts(project_id);
create index idx_contacts_company on contacts(company_id);
