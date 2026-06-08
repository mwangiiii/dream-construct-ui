-- Junction table: which user has which role
create table user_roles (
  user_id     uuid references auth.users not null,
  role_id     smallint not null references roles(role_id) on delete cascade,
  assigned_at timestamptz default now() not null,
  assigned_by uuid references auth.users, -- who granted the role (nullable)
  primary key (user_id, role_id)
);

-- Useful indexes
create index idx_user_roles_user   on user_roles(user_id);
create index idx_user_roles_role   on user_roles(role_id);

-- RLS
alter table user_roles enable row level security;

-- Users can always see their own roles
create policy "Users can view own roles" 
  on user_roles for select 
  using (auth.uid() = user_id);