-- 07_project_approvals.sql
-- Approval workflow (e.g., change orders, final completion, payment releases)

create table project_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  
  title text not null,
  description text,
  requested_by uuid not null references auth.users,
  requested_at timestamptz default now() not null,
  
  approval_type text not null check (approval_type in (
    'change_order', 'extension', 'budget_increase', 'final_completion', 'payment_release'
  )),
  
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by uuid references auth.users,
  approved_at timestamptz,
  rejection_reason text,
  
  amount numeric(14,2), -- if financial impact
  days_requested int     -- if time extension
);

create index idx_approvals_project on project_approvals(project_id);
create index idx_approvals_status on project_approvals(status);
create index idx_approvals_type on project_approvals(approval_type);
