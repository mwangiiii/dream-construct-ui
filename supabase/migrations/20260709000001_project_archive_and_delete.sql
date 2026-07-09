-- =============================================================================
--  Project archive + admin-only permanent deletion
--
--  Two-tier deletion model:
--    1) Archive  (soft) — sets projects.archived_at = now(). All records
--       preserved. Dashboards filter these out so pre-allocated users no
--       longer see them.
--    2) Permanent delete (hard) — admin-only. Deletes every project-scoped
--       record. Nothing is left behind:
--         * Rows whose FK to projects was ON DELETE SET NULL (invoices,
--           payroll_checklist, contacts) are explicitly deleted first,
--           BEFORE the project row itself, so they don't survive as
--           "standalone / firm-wide" entries.
--         * Rows whose FK to projects was ON DELETE CASCADE are removed
--           automatically when the project row is deleted (milestones,
--           tasks, updates, approvals, documents, worker_assignments,
--           issues, AP, AR, balance_sheet, bank_reconciliation, cash_flow,
--           balance_sheet_entries, loans, statement_of_account,
--           tax_transactions, work_in_progress, job_postings, inventory).
--         * Workers who, after the cascade, have zero remaining assignments
--           are also removed. Workers still assigned to other projects
--           survive.
--
--    NOT touched by permanent delete (by design):
--       * profiles / auth users — cross-project identity, deleting them
--         would orphan every other project and break their login.
--       * companies (vendor master) — shared across projects.
--
--  Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Soft-delete marker on projects
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_projects_archived_at
  ON public.projects (archived_at);

COMMENT ON COLUMN public.projects.archived_at IS
  'When non-NULL, the project is soft-archived: hidden from dashboards for '
  'users pre-allocated to it, but every record it produced is preserved. '
  'Setting this to NULL restores the project.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helper: is the current caller an admin?
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id  = auth.uid()
      AND ur.role_name = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Archive / restore (admin-only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.archive_project(pid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admins may archive projects' USING ERRCODE = '42501';
  END IF;

  UPDATE public.projects
     SET archived_at = COALESCE(archived_at, now()),
         updated_at  = now()
   WHERE id = pid;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_project(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.restore_project(pid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admins may restore projects' USING ERRCODE = '42501';
  END IF;

  UPDATE public.projects
     SET archived_at = NULL,
         updated_at  = now()
   WHERE id = pid;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_project(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Permanent delete (admin-only)
--
--  Runs in a single transaction. Steps:
--    a) Snapshot worker_ids currently assigned to the project — we'll use
--       this list to garbage-collect workers who end up unassigned.
--    b) Explicit-delete the SET NULL rows so they don't survive as
--       standalone (invoices, contacts, payroll_checklist).
--    c) Delete the project itself. The remaining CASCADE FKs remove
--       everything else.
--    d) Delete workers from the snapshot whose remaining assignment
--       count is now zero. Workers with other assignments are kept.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.permanent_delete_project(pid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_worker_ids uuid[];
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admins may permanently delete projects' USING ERRCODE = '42501';
  END IF;

  -- a) Snapshot workers assigned to this project.
  SELECT COALESCE(array_agg(DISTINCT worker_id), ARRAY[]::uuid[])
    INTO affected_worker_ids
    FROM public.worker_assignments
   WHERE project_id = pid;

  -- b) Explicit deletes for rows whose FK is ON DELETE SET NULL. Without
  --    this they would survive with project_id = NULL as standalone rows.
  DELETE FROM public.invoices           WHERE project_id = pid;
  DELETE FROM public.contacts           WHERE project_id = pid;
  DELETE FROM public.payroll_checklist  WHERE project_id = pid;

  -- c) Delete the project. All CASCADE FKs fire here.
  DELETE FROM public.projects WHERE id = pid;

  -- d) Garbage-collect workers with no remaining assignments.
  IF array_length(affected_worker_ids, 1) IS NOT NULL THEN
    DELETE FROM public.workers w
     WHERE w.id = ANY(affected_worker_ids)
       AND NOT EXISTS (
         SELECT 1
           FROM public.worker_assignments wa
          WHERE wa.worker_id = w.id
       );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.permanent_delete_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.permanent_delete_project(uuid) TO authenticated;


COMMENT ON FUNCTION public.permanent_delete_project(uuid) IS
  'Admin-only hard delete of a project. Removes every project-scoped record '
  '(including invoices, contracts and payroll that would otherwise be left '
  'behind as standalone rows), and garbage-collects workers who end up with '
  'zero assignments. Does NOT delete profiles/users or the shared vendor '
  'master (companies) — those are cross-project.';
