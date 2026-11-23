-- =============================================================================
--  Linter 0001 (unindexed_foreign_keys) — add covering indexes.
--
--  An unindexed FK forces a sequential scan on the child table every time the
--  parent row is updated or deleted, because Postgres must prove no child rows
--  reference it. On ON DELETE CASCADE relationships (most of these) that cost
--  is paid on every parent delete.
--
--  accounts_payable_project_id_fkey is the one that actually hurts today: the
--  AP register filters by project_id constantly and project deletes cascade
--  through it.
--
--  All CREATE INDEX IF NOT EXISTS, so re-running is a no-op. Not CONCURRENTLY —
--  supabase CLI wraps each migration in a transaction and CONCURRENTLY cannot
--  run inside one. These tables are small enough that the brief lock is fine;
--  if any grows large, build that one by hand with CONCURRENTLY instead.
-- =============================================================================

-- Finance
CREATE INDEX IF NOT EXISTS accounts_payable_project_id_idx
  ON public.accounts_payable(project_id);
CREATE INDEX IF NOT EXISTS accounts_payable_receiving_account_code_idx
  ON public.accounts_payable(receiving_account_code);
CREATE INDEX IF NOT EXISTS accounts_receivable_account_received_idx
  ON public.accounts_receivable(account_received);
CREATE INDEX IF NOT EXISTS cash_flow_account_codes_idx
  ON public.cash_flow(account_codes);
CREATE INDEX IF NOT EXISTS job_postings_account_code_idx
  ON public.job_postings(account_code);
CREATE INDEX IF NOT EXISTS statement_of_account_account_code_idx
  ON public.statement_of_account(account_code);
CREATE INDEX IF NOT EXISTS work_in_progress_code_receivable_idx
  ON public.work_in_progress(code_receivable);
CREATE INDEX IF NOT EXISTS income_statement_project_id_idx
  ON public.income_statement(project_id);

-- Chart of accounts audit columns
CREATE INDEX IF NOT EXISTS chart_of_accounts_created_by_idx
  ON public.chart_of_accounts(created_by);
CREATE INDEX IF NOT EXISTS chart_of_accounts_updated_by_idx
  ON public.chart_of_accounts(updated_by);

-- Balance sheet audit columns
CREATE INDEX IF NOT EXISTS balance_sheet_entries_created_by_idx
  ON public.balance_sheet_entries(created_by);
CREATE INDEX IF NOT EXISTS balance_sheet_entries_updated_by_idx
  ON public.balance_sheet_entries(updated_by);

-- QS module
CREATE INDEX IF NOT EXISTS bill_of_quantities_created_by_idx
  ON public.bill_of_quantities(created_by);
CREATE INDEX IF NOT EXISTS bq_measurements_measured_by_idx
  ON public.bq_measurements(measured_by);
CREATE INDEX IF NOT EXISTS project_surveyors_assigned_by_idx
  ON public.project_surveyors(assigned_by);

-- Project tree
CREATE INDEX IF NOT EXISTS projects_created_by_idx
  ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS project_issues_project_id_idx
  ON public.project_issues(project_id);
CREATE INDEX IF NOT EXISTS project_milestones_created_by_idx
  ON public.project_milestones(created_by);
CREATE INDEX IF NOT EXISTS project_approvals_requested_by_idx
  ON public.project_approvals(requested_by);
CREATE INDEX IF NOT EXISTS project_approvals_approved_by_idx
  ON public.project_approvals(approved_by);
CREATE INDEX IF NOT EXISTS stages_project_id_idx
  ON public.stages(project_id);
CREATE INDEX IF NOT EXISTS daily_progress_project_id_idx
  ON public.daily_progress(project_id);
CREATE INDEX IF NOT EXISTS daily_progress_tasks_daily_progress_id_idx
  ON public.daily_progress_tasks(daily_progress_id);
CREATE INDEX IF NOT EXISTS material_tracking_project_id_idx
  ON public.material_tracking(project_id);

-- Documents
CREATE INDEX IF NOT EXISTS documents_milestone_id_idx
  ON public.documents(milestone_id);
CREATE INDEX IF NOT EXISTS documents_uploaded_by_idx
  ON public.documents(uploaded_by);

-- Tasks / workers
CREATE INDEX IF NOT EXISTS tasks_created_by_idx
  ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS worker_assignments_created_by_idx
  ON public.worker_assignments(created_by);
CREATE INDEX IF NOT EXISTS worker_attendance_created_by_idx
  ON public.worker_attendance(created_by);

-- Identity / meta
CREATE INDEX IF NOT EXISTS profiles_status_id_idx
  ON public.profiles(status_id);
CREATE INDEX IF NOT EXISTS user_roles_assigned_by_idx
  ON public.user_roles(assigned_by);
CREATE INDEX IF NOT EXISTS contacts_created_by_idx
  ON public.contacts(created_by);
CREATE INDEX IF NOT EXISTS reviews_user_id_idx
  ON public.reviews(user_id);
