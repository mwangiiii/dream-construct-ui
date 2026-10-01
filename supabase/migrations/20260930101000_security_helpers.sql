-- =============================================================================
--  security schema — reusable helpers for every RLS policy in this codebase.
--
--  Design notes
--  ────────────
--  * All functions are SECURITY DEFINER so they can read user_roles /
--    projects / project_surveyors without themselves being blocked by RLS.
--    Otherwise a policy that calls has_role() would recurse into user_roles'
--    own policies.
--  * `SET search_path = pg_catalog, public, pg_temp` prevents search-path
--    hijacking (a definer function must never resolve unqualified names
--    against a caller-controlled schema).
--  * STABLE, not IMMUTABLE — auth.uid() and user_roles rows change per call.
--  * All grants target the `authenticated` role. Anonymous callers hit RLS
--    directly and get nothing.
--  * Supabase's service_role bypasses RLS entirely by design — Edge Functions
--    and admin scripts running with that key remain unaffected by these
--    policies. Use it deliberately and keep it server-side.
--
--  Pre-flight safeguard
--  ────────────────────
--  This migration RAISES EXCEPTION if there is no active user with the
--  `admin` role. If we tightened policies without an admin in place, no one
--  could re-open access.
-- =============================================================================


-- ── 0. Pre-flight: at least one active admin must exist ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles  p  ON p.id = ur.user_id
    LEFT JOIN public.user_statuses us ON us.status_id = p.status_id
    WHERE ur.role_name = 'admin'
      AND COALESCE(us.is_active, TRUE) = TRUE
  ) THEN
    RAISE EXCEPTION
      'RLS safeguard: no active admin user found. Refusing to apply strict '
      'policies — you would lock yourself out. Assign the admin role to at '
      'least one active user before running this migration set.';
  END IF;
END $$;


-- ── 1. Schema + grants ──────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS security;
GRANT USAGE ON SCHEMA security TO authenticated;


-- ── 2. Identity + role checks ───────────────────────────────────────────────

-- Fast: does the current auth user hold a given role name?
CREATE OR REPLACE FUNCTION security.has_role(role_check text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role_name = role_check
  );
$$;

-- Any of the given roles.
CREATE OR REPLACE FUNCTION security.has_any_role(roles_check text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id  = auth.uid()
      AND role_name = ANY (roles_check)
  );
$$;

-- Convenience wrappers for readability inside policies.
CREATE OR REPLACE FUNCTION security.is_admin()             RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT security.has_role('admin')             $$;
CREATE OR REPLACE FUNCTION security.is_manager()           RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT security.has_role('manager')           $$;
CREATE OR REPLACE FUNCTION security.is_finance()           RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT security.has_role('finance')           $$;
CREATE OR REPLACE FUNCTION security.is_project_manager()   RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT security.has_role('project_manager')   $$;
CREATE OR REPLACE FUNCTION security.is_quantity_surveyor() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT security.has_role('quantity_surveyor') $$;
CREATE OR REPLACE FUNCTION security.is_client()            RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT security.has_role('client')            $$;

-- "Finance or up" — finance, manager, admin. Common bucket for R+W on finance.
CREATE OR REPLACE FUNCTION security.is_finance_or_up()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT security.has_any_role(ARRAY['finance', 'manager', 'admin']);
$$;

-- "Manager or up" — manager, admin. Common bucket for full-access override.
CREATE OR REPLACE FUNCTION security.is_manager_or_up()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT security.has_any_role(ARRAY['manager', 'admin']);
$$;


-- ── 3. Project-scoped access checks ─────────────────────────────────────────

-- Client of the project (projects.client_id).
CREATE OR REPLACE FUNCTION security.owns_project(pid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = pid
      AND client_id = auth.uid()
  );
$$;

-- Assigned project manager (projects.manager_id).
CREATE OR REPLACE FUNCTION security.manages_project(pid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = pid
      AND manager_id = auth.uid()
  );
$$;

-- Assigned quantity surveyor (project_surveyors junction).
CREATE OR REPLACE FUNCTION security.surveys_project(pid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_surveyors
    WHERE project_id = pid
      AND user_id    = auth.uid()
  );
$$;

-- Broad "can this user see this project at all" gate.
-- Admin & manager see everything. Finance sees everything (read-only in
-- their policies for project sub-tree, R+W on finance tables). PM sees
-- assigned. QS sees assigned. Client sees owned.
CREATE OR REPLACE FUNCTION security.has_project_access(pid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    security.is_manager_or_up()
    OR security.is_finance()
    OR security.owns_project(pid)
    OR security.manages_project(pid)
    OR security.surveys_project(pid);
$$;

-- Write access at the project level: manager/admin, or the assigned PM.
-- Used for project sub-tree writes (milestones, tasks, updates, etc.).
CREATE OR REPLACE FUNCTION security.can_write_project(pid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    security.is_manager_or_up()
    OR security.manages_project(pid);
$$;


-- ── 4. Grants ───────────────────────────────────────────────────────────────
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA security TO authenticated;


-- ── 5. Diagnostic helper — safe to call from psql/Studio to debug access ───
-- Returns a row summarising what the given user can do on the given project.
-- SECURITY DEFINER so an admin can call it about another user without needing
-- read access to user_roles under the caller's identity.
CREATE OR REPLACE FUNCTION security.diagnose_access(target_project uuid, target_user uuid DEFAULT auth.uid())
RETURNS TABLE (
  roles              text[],
  is_admin           boolean,
  is_manager         boolean,
  is_finance         boolean,
  is_pm              boolean,
  is_qs              boolean,
  is_client          boolean,
  owns_project       boolean,
  manages_project    boolean,
  surveys_project    boolean,
  has_read_access    boolean,
  has_write_access   boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
STABLE
AS $$
  WITH r AS (
    SELECT ARRAY_AGG(role_name ORDER BY role_name) AS role_names
    FROM public.user_roles WHERE user_id = target_user
  ),
  p AS (
    SELECT
      (SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = target_project AND client_id  = target_user)) AS owns,
      (SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = target_project AND manager_id = target_user)) AS manages,
      (SELECT EXISTS (SELECT 1 FROM public.project_surveyors WHERE project_id = target_project AND user_id = target_user)) AS surveys
  )
  SELECT
    COALESCE(r.role_names, ARRAY[]::text[])                                       AS roles,
    'admin'             = ANY(COALESCE(r.role_names, ARRAY[]::text[]))            AS is_admin,
    'manager'           = ANY(COALESCE(r.role_names, ARRAY[]::text[]))            AS is_manager,
    'finance'           = ANY(COALESCE(r.role_names, ARRAY[]::text[]))            AS is_finance,
    'project_manager'   = ANY(COALESCE(r.role_names, ARRAY[]::text[]))            AS is_pm,
    'quantity_surveyor' = ANY(COALESCE(r.role_names, ARRAY[]::text[]))            AS is_qs,
    'client'            = ANY(COALESCE(r.role_names, ARRAY[]::text[]))            AS is_client,
    p.owns                                                                        AS owns_project,
    p.manages                                                                     AS manages_project,
    p.surveys                                                                     AS surveys_project,
    -- read access = any role that lets you see the project
    ('admin'   = ANY(COALESCE(r.role_names, ARRAY[]::text[])))
    OR ('manager' = ANY(COALESCE(r.role_names, ARRAY[]::text[])))
    OR ('finance' = ANY(COALESCE(r.role_names, ARRAY[]::text[])))
    OR p.owns OR p.manages OR p.surveys                                            AS has_read_access,
    -- write access = manager/admin OR assigned PM
    ('admin'   = ANY(COALESCE(r.role_names, ARRAY[]::text[])))
    OR ('manager' = ANY(COALESCE(r.role_names, ARRAY[]::text[])))
    OR p.manages                                                                   AS has_write_access
  FROM r, p;
$$;

GRANT EXECUTE ON FUNCTION security.diagnose_access(uuid, uuid) TO authenticated;

COMMENT ON SCHEMA security IS
  'RLS helper functions. All SECURITY DEFINER, all read-only, all pinned '
  'search_path. Do not add mutating functions here.';
