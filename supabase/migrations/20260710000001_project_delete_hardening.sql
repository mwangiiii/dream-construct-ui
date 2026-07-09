-- =============================================================================
--  Hardening for permanent_delete_project — follow-up to
--  20260709000001_project_archive_and_delete.sql
--
--  Adds three things:
--    1) Notifications cleanup — the notifications table has no FK to
--       projects (project_id lives inside a JSONB `data` blob), so a
--       DELETE FROM projects does not touch it. We now delete any
--       notification whose data->>'project_id' matches the target.
--    2) Storage cleanup — files uploaded under `<projectId>/…` in the
--       `documents-and-images` bucket are removed from storage.objects.
--       (The physical S3 objects are garbage-collected by Supabase.)
--    3) verify_project_fks() — a diagnostic function that lists every FK
--       targeting projects(id) with its ON DELETE action, so you can
--       confirm every project-scoped table is either CASCADE (auto-cleaned
--       when the project row is deleted) or SET NULL (must be handled
--       explicitly in permanent_delete_project). Anything else is flagged
--       so you can fix it before running a real delete.
--
--  Safe to re-run.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend permanent_delete_project with notifications + storage cleanup
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

  -- Snapshot workers assigned to this project (used at the end).
  SELECT COALESCE(array_agg(DISTINCT worker_id), ARRAY[]::uuid[])
    INTO affected_worker_ids
    FROM public.worker_assignments
   WHERE project_id = pid;

  -- Notifications reference project_id inside a JSONB blob — no FK, so we
  -- purge them explicitly BEFORE deleting the project.
  DELETE FROM public.notifications
   WHERE data->>'project_id' = pid::text;

  -- Storage objects — physical files under `<pid>/...` in the
  -- documents-and-images bucket. Deleting the row here removes the
  -- reference; Supabase's storage backend GCs the underlying file.
  BEGIN
    DELETE FROM storage.objects
     WHERE bucket_id = 'documents-and-images'
       AND name LIKE pid::text || '/%';
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    -- Storage schema not visible or extension missing — non-fatal.
    RAISE NOTICE 'Storage cleanup skipped (no access to storage.objects).';
  END;

  -- Explicit deletes for rows whose FK is ON DELETE SET NULL. Without
  -- this they would survive with project_id = NULL as standalone rows.
  DELETE FROM public.invoices           WHERE project_id = pid;
  DELETE FROM public.contacts           WHERE project_id = pid;
  DELETE FROM public.payroll_checklist  WHERE project_id = pid;

  -- Delete the project. All CASCADE FKs fire here.
  DELETE FROM public.projects WHERE id = pid;

  -- Garbage-collect workers with no remaining assignments.
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


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FK sanity check — verify every project_id FK is CASCADE or SET NULL
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.verify_project_fks()
RETURNS TABLE (
  child_table  text,
  child_column text,
  delete_rule  text,
  status       text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (kcu.table_schema || '.' || kcu.table_name)::text  AS child_table,
    kcu.column_name::text                              AS child_column,
    rc.delete_rule::text                               AS delete_rule,
    CASE
      WHEN rc.delete_rule IN ('CASCADE', 'SET NULL') THEN 'ok'
      ELSE 'REVIEW — unexpected delete rule'
    END::text                                          AS status
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON rc.constraint_name   = kcu.constraint_name
   AND rc.constraint_schema = kcu.constraint_schema
  JOIN information_schema.constraint_column_usage ccu
    ON rc.constraint_name   = ccu.constraint_name
   AND rc.constraint_schema = ccu.constraint_schema
  WHERE ccu.table_schema = 'public'
    AND ccu.table_name   = 'projects'
    AND ccu.column_name  = 'id'
  ORDER BY child_table;
$$;

REVOKE ALL ON FUNCTION public.verify_project_fks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_project_fks() TO authenticated;

COMMENT ON FUNCTION public.verify_project_fks() IS
  'Lists every FK that references projects(id) with its ON DELETE action. '
  'Rows with status = REVIEW indicate a table whose FK is neither CASCADE '
  'nor SET NULL — those should either be re-declared with an explicit rule, '
  'or have an explicit DELETE added inside permanent_delete_project.';
