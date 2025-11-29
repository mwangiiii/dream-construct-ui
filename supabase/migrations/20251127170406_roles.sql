-- Static reference table for roles
create table roles (
  role_id     smallint primary key generated always as identity,
  role_name   app_role not null unique,
  description text,
  created_at  timestamptz default now() not null
);

-- Seed initial roles (idempotent)
insert into roles (role_name, description) values
  ('admin',           'Full system administrator'),
  ('manager',         'Company manager – can manage users and projects'),
  ('project_manager', 'Project manager – manages specific projects'),
  ('client',          'Client – can only view their own projects')
on conflict (role_name) do nothing;

