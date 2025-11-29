-- Create the app_role enum (must be first)
create type app_role as enum (
  'admin',
  'manager',
  'project_manager',
  'client'
);