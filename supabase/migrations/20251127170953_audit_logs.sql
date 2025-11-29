-- 11_audit_logs.sql
-- Immutable audit trail

create table audit_logs (
  id bigserial primary key,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references auth.users,
  changed_at timestamptz default now() not null
);

create index idx_audit_table on audit_logs(table_name);
create index idx_audit_changed_by on audit_logs(changed_by);
create index idx_audit_changed_at on audit_logs(changed_at desc);
