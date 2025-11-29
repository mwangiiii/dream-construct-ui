-- 03_user_statuses.sql
-- Reusable statuses (also used later for projects, milestones, etc.)

create table user_statuses (
  status_id   smallint primary key generated always as identity,
  status_name text not null unique,
  is_active   boolean default true not null,
  sort_order  smallint default 0,
  description text
);

insert into user_statuses (status_name, is_active, sort_order, description) values
  ('active',     true,  1, 'Normal active user'),
  ('inactive',   true,  2, 'Temporarily inactive'),
  ('suspended',  true,  3, 'Access suspended'),
  ('pending',    true,  4, 'Awaiting approval'),
  ('archived',   false, 5, 'No longer in use')
on conflict (status_name) do nothing;
