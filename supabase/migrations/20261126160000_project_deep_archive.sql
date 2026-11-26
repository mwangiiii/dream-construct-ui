-- =============================================================================
--  Project deep archive — second archive tier
--
--  Existing archive model (20260709000001_project_archive_and_delete.sql):
--    projects.archived_at IS NOT NULL  →  hidden from client dashboards,
--    and the assigned project_manager still sees the project in their list
--    (change made 2026-11-26).
--
--  Deep archive adds a stricter tier on top:
--    projects.deep_archived_at IS NOT NULL
--      → hidden from the project_manager too, even one it is assigned to.
--      Only admin/manager can see it. Used when a project should be removed
--      from active circulation without being permanently deleted.
--
--  State machine (all transitions admin-only, via RPC):
--    active        (A=NULL, D=NULL)
--      └─ archive_project(pid)        → archived
--      └─ deep_archive_project(pid)   → deep_archived (sets both)
--    archived      (A=SET,  D=NULL)
--      └─ restore_project(pid)        → active
--      └─ deep_archive_project(pid)   → deep_archived
--    deep_archived (A=SET,  D=SET)
--      └─ undeep_archive_project(pid) → archived (D cleared, A preserved)
--      └─ restore_project(pid)        → active   (both cleared)
--
--  restore_project is patched to clear BOTH columns so a restored project
--  is never left with D=SET and A=NULL, which would be an inconsistent
--  "deep-archived but not archived" state.
--
--  Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Column + index
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deep_archived_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_projects_deep_archived_at
  ON public.projects (deep_archived_at);

COMMENT ON COLUMN public.projects.deep_archived_at IS
  'When non-NULL, the project is deep-archived: hidden even from the '
  'project_manager assigned to it. Implies archived_at is also set. '
  'Only admin/manager see deep-archived projects.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. deep_archive_project — admin-only promotion to deep archive
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.deep_archive_project(pid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admins may deep-archive projects' USING ERRCODE = '42501';
  END IF;

  UPDATE public.projects
     SET archived_at      = COALESCE(archived_at, now()),
         deep_archived_at = COALESCE(deep_archived_at, now()),
         updated_at       = now()
   WHERE id = pid;
END;
$$;

REVOKE ALL ON FUNCTION public.deep_archive_project(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deep_archive_project(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.deep_archive_project(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. undeep_archive_project — admin-only demotion back to regular archive
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.undeep_archive_project(pid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Only admins may move projects out of deep archive' USING ERRCODE = '42501';
  END IF;

  UPDATE public.projects
     SET deep_archived_at = NULL,
         updated_at       = now()
   WHERE id = pid;
END;
$$;

REVOKE ALL ON FUNCTION public.undeep_archive_project(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undeep_archive_project(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.undeep_archive_project(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Patch restore_project to clear BOTH columns
--
--  Without this, a restore of a deep-archived project would leave
--  deep_archived_at SET while archived_at became NULL — a nonsense state
--  (deep-archived implies archived).
-- ─────────────────────────────────────────────────────────────────────────────

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
     SET archived_at      = NULL,
         deep_archived_at = NULL,
         updated_at       = now()
   WHERE id = pid;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_project(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_project(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_project(uuid) TO authenticated;
