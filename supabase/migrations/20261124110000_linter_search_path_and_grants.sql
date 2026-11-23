-- =============================================================================
--  Linter 0011 (function_search_path_mutable) + 0028/0029 (SECURITY DEFINER
--  functions executable via the REST API).
--
--  ── search_path ────────────────────────────────────────────────────────────
--  A function without a pinned search_path resolves unqualified names using
--  the CALLER's search_path. For SECURITY DEFINER functions that is a
--  privilege-escalation vector: a caller prepends a schema they control, puts
--  a malicious `projects` table in it, and the function operates on that
--  instead. Even for SECURITY INVOKER functions it makes behaviour
--  non-deterministic.
--
--  Rather than list ~60 signatures by hand (and risk typos on overloads), the
--  loop below finds every function in public/security that has no search_path
--  and pins one. Extension-owned functions are skipped — they are maintained
--  by the extension, not us.
--
--  ── REST exposure ──────────────────────────────────────────────────────────
--  PostgREST exposes everything in the `public` schema as an RPC endpoint.
--  Trigger functions were never meant to be called that way, so EXECUTE is
--  revoked from anon and authenticated. This closes the mirror_* / validate_* /
--  auto_* / update_*_updated_at findings in one pass.
--
--  Destructive project RPCs and the internal role helpers additionally lose
--  anon access — `archive_project`, `permanent_delete_project` and
--  `restore_project` being callable without signing in is the most serious
--  item in the whole lint report.
--
--  Deliberately left public: increment_media_view/click/share_count and
--  search_media_posts. The public marketing site calls these unauthenticated.
-- =============================================================================


-- ── 1. Pin search_path on every unpinned function in public / security ──────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      p.oid::regprocedure AS sig,
      n.nspname           AS schema_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'security')
      -- Skip anything owned by an installed extension.
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
      -- Only functions that do not already pin search_path.
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}'::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    -- Include the function's own schema first so unqualified references to
    -- sibling objects keep resolving, then public, then pg_temp last.
    IF r.schema_name = 'public' THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
    ELSE
      EXECUTE format('ALTER FUNCTION %s SET search_path = %I, public, pg_temp',
                     r.sig, r.schema_name);
    END IF;
  END LOOP;
END $$;


-- ── 2. Trigger functions are not RPC endpoints ──────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prorettype = 'pg_catalog.trigger'::regtype
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', r.sig);
  END LOOP;
END $$;


-- ── 3. Destructive project RPCs: signed-in only ─────────────────────────────
-- These already gate on role internally, but there is no reason for them to be
-- reachable at all without a session.
REVOKE ALL ON FUNCTION public.archive_project(uuid)          FROM anon;
REVOKE ALL ON FUNCTION public.restore_project(uuid)          FROM anon;
REVOKE ALL ON FUNCTION public.permanent_delete_project(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.reorder_milestones_bulk(uuid, jsonb) FROM anon;


-- ── 4. Internal role / permission helpers: not a public API ─────────────────
-- These exist to be called from inside RLS policies. Exposing them as RPC lets
-- an unauthenticated caller probe the permission model.
REVOKE ALL ON FUNCTION public.is_current_user_admin()                FROM anon;
REVOKE ALL ON FUNCTION public.user_has_role(text[])                  FROM anon;
REVOKE ALL ON FUNCTION public.user_has_any_role(uuid, text[])        FROM anon;
REVOKE ALL ON FUNCTION public.user_is_admin(uuid)                    FROM anon;
REVOKE ALL ON FUNCTION public.user_is_manager(uuid)                  FROM anon;
REVOKE ALL ON FUNCTION public.user_is_finance(uuid)                  FROM anon;
REVOKE ALL ON FUNCTION public.user_is_project_manager(uuid)          FROM anon;
REVOKE ALL ON FUNCTION public.user_is_surveyor(uuid)                 FROM anon;
REVOKE ALL ON FUNCTION public.user_is_client(uuid)                   FROM anon;
REVOKE ALL ON FUNCTION public.user_can_access_project(uuid)          FROM anon;
REVOKE ALL ON FUNCTION public.user_can_view_project(uuid, uuid)      FROM anon;
REVOKE ALL ON FUNCTION public.user_can_edit_project(uuid, uuid)      FROM anon;
REVOKE ALL ON FUNCTION public.user_can_upload_media(uuid)            FROM anon;
REVOKE ALL ON FUNCTION public.user_can_modify_media(uuid, uuid)      FROM anon;


-- ── 5. Admin-only maintenance tooling ───────────────────────────────────────
-- Enumerates storage objects; nobody but an operator should run it.
REVOKE ALL ON FUNCTION public.find_orphaned_storage_files() FROM anon, authenticated;
