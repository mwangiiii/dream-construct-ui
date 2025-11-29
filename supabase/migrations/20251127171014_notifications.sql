-- 12_notifications.sql

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  
  title text not null,
  body text,
  type text default 'info',
  is_read boolean default false,
  data jsonb, -- flexible: { project_id: "...", task_id: "...", url: "..." }
  
  created_at timestamptz default now() not null
);

create index idx_notifications_user on notifications(user_id);
create index idx_notifications_read on notifications(is_read);
create index idx_notifications_created on notifications(created_at desc);

alter table notifications enable row level security;
create policy "Users see only their notifications" on notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);