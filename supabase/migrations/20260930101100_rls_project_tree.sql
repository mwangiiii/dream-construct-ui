-- =============================================================================
--  RLS — project tree
--
--  Tables covered:
--    projects, project_milestones, tasks, project_updates, project_approvals,
--    documents, project_surveyors (tighten the bootstrap policies from earlier).
--
--  Rules
--  ─────
--    Read
--      * admin / manager / finance : all rows
--      * project_manager           : rows on projects.manager_id = me
--      * quantity_surveyor         : rows on project_surveyors membership
--      * client                    : rows on projects.client_id = me
--    Write (INSERT/UPDATE/DELETE)
--      * admin / manager           : all rows
--      * project_manager           : rows on assigned projects
--      * everyone else             : denied
--
--  All sub-tables inherit the access check via security.has_project_access
--  (read) and security.can_write_project (write) on the row's project_id.
-- =============================================================================


-- ── projects ────────────────────────────────────────────────────────────────
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_select ON public.projects;
DROP POLICY IF EXISTS projects_insert ON public.projects;
DROP POLICY IF EXISTS projects_update ON public.projects;
DROP POLICY IF EXISTS projects_delete ON public.projects;
-- Legacy policy names sometimes seen in older setups.
DROP POLICY IF EXISTS "projects_select_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_update_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_policy" ON public.projects;

CREATE POLICY projects_select ON public.projects
  FOR SELECT TO authenticated
  USING (security.has_project_access(id));

CREATE POLICY projects_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (security.is_manager_or_up());

CREATE POLICY projects_update ON public.projects
  FOR UPDATE TO authenticated
  USING (security.can_write_project(id))
  WITH CHECK (security.can_write_project(id));

CREATE POLICY projects_delete ON public.projects
  FOR DELETE TO authenticated
  USING (security.is_manager_or_up());


-- ── project_milestones ──────────────────────────────────────────────────────
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_milestones_select ON public.project_milestones;
DROP POLICY IF EXISTS project_milestones_write  ON public.project_milestones;

CREATE POLICY project_milestones_select ON public.project_milestones
  FOR SELECT TO authenticated
  USING (security.has_project_access(project_id));

CREATE POLICY project_milestones_write ON public.project_milestones
  FOR ALL TO authenticated
  USING (security.can_write_project(project_id))
  WITH CHECK (security.can_write_project(project_id));


-- ── tasks ───────────────────────────────────────────────────────────────────
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_select ON public.tasks;
DROP POLICY IF EXISTS tasks_write  ON public.tasks;

CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated
  USING (security.has_project_access(project_id));

CREATE POLICY tasks_write ON public.tasks
  FOR ALL TO authenticated
  USING (security.can_write_project(project_id))
  WITH CHECK (security.can_write_project(project_id));


-- ── project_updates ─────────────────────────────────────────────────────────
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_updates_select ON public.project_updates;
DROP POLICY IF EXISTS project_updates_write  ON public.project_updates;

CREATE POLICY project_updates_select ON public.project_updates
  FOR SELECT TO authenticated
  USING (security.has_project_access(project_id));

CREATE POLICY project_updates_write ON public.project_updates
  FOR ALL TO authenticated
  USING (security.can_write_project(project_id))
  WITH CHECK (security.can_write_project(project_id));


-- ── project_approvals ───────────────────────────────────────────────────────
ALTER TABLE public.project_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_approvals_select ON public.project_approvals;
DROP POLICY IF EXISTS project_approvals_write  ON public.project_approvals;

CREATE POLICY project_approvals_select ON public.project_approvals
  FOR SELECT TO authenticated
  USING (security.has_project_access(project_id));

CREATE POLICY project_approvals_write ON public.project_approvals
  FOR ALL TO authenticated
  USING (security.can_write_project(project_id))
  WITH CHECK (security.can_write_project(project_id));


-- ── documents (includes photos, since documents.folder='photos') ────────────
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_select ON public.documents;
DROP POLICY IF EXISTS documents_write  ON public.documents;

CREATE POLICY documents_select ON public.documents
  FOR SELECT TO authenticated
  USING (
    -- Documents without a project_id (rare, legacy) fall back to admin-only.
    (project_id IS NOT NULL AND security.has_project_access(project_id))
    OR security.is_admin()
  );

CREATE POLICY documents_write ON public.documents
  FOR ALL TO authenticated
  USING (
    (project_id IS NOT NULL AND (security.can_write_project(project_id) OR security.surveys_project(project_id)))
    OR security.is_admin()
  )
  WITH CHECK (
    (project_id IS NOT NULL AND (security.can_write_project(project_id) OR security.surveys_project(project_id)))
    OR security.is_admin()
  );


-- ── project_surveyors — tighten the permissive bootstrap policies ───────────
DROP POLICY IF EXISTS project_surveyors_select ON public.project_surveyors;
DROP POLICY IF EXISTS project_surveyors_write  ON public.project_surveyors;

-- Everyone with project access can see who the assigned QSs are.
CREATE POLICY project_surveyors_select ON public.project_surveyors
  FOR SELECT TO authenticated
  USING (security.has_project_access(project_id));

-- Only manager/admin/assigned PM can assign or revoke a QS on a project.
CREATE POLICY project_surveyors_write ON public.project_surveyors
  FOR ALL TO authenticated
  USING (security.can_write_project(project_id))
  WITH CHECK (security.can_write_project(project_id));


-- ── project_team (only if the table exists — it isn't in migrations, so we
-- feature-detect and skip if absent) ────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'project_team' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'ALTER TABLE public.project_team ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS project_team_select ON public.project_team';
    EXECUTE 'DROP POLICY IF EXISTS project_team_write  ON public.project_team';
    EXECUTE $sql$
      CREATE POLICY project_team_select ON public.project_team
        FOR SELECT TO authenticated
        USING (security.has_project_access(project_id))
    $sql$;
    EXECUTE $sql$
      CREATE POLICY project_team_write ON public.project_team
        FOR ALL TO authenticated
        USING (security.can_write_project(project_id))
        WITH CHECK (security.can_write_project(project_id))
    $sql$;
  END IF;
END $$;


COMMENT ON POLICY projects_select ON public.projects IS
  'A project is visible to: admin/manager/finance (all), assigned PM '
  '(manager_id), assigned QS (via project_surveyors), and the client '
  '(client_id). All sub-tables reuse this via security.has_project_access.';
