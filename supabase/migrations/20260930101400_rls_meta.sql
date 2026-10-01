-- =============================================================================
--  RLS — meta tables (profiles, roles, notifications, audit_logs, reviews,
--                     contracts, companies, tender_companies, user_statuses)
-- =============================================================================


-- ── profiles ────────────────────────────────────────────────────────────────
-- Everyone authenticated can SELECT any profile (needed for team display,
-- assigned_by lookups, etc.). Writes:
--   * user updates their OWN profile
--   * admin updates any profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS profiles_delete ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: the auth.ts auto-provisioning path inserts a profile row for the
-- current user; also admin can create profiles.
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR security.is_admin());

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR security.is_admin())
  WITH CHECK (id = auth.uid() OR security.is_admin());

CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (security.is_admin());


-- ── user_roles ──────────────────────────────────────────────────────────────
-- Every authenticated user can read their OWN roles (frontend needs this for
-- routing). Admin can read all roles + assign/revoke.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
DROP POLICY IF EXISTS user_roles_write  ON public.user_roles;

CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR security.is_admin());

CREATE POLICY user_roles_write ON public.user_roles
  FOR ALL TO authenticated
  USING (security.is_admin())
  WITH CHECK (security.is_admin());


-- ── user_statuses (reference / lookup table) ────────────────────────────────
ALTER TABLE public.user_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_statuses_select ON public.user_statuses;
DROP POLICY IF EXISTS user_statuses_write  ON public.user_statuses;

CREATE POLICY user_statuses_select ON public.user_statuses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY user_statuses_write ON public.user_statuses
  FOR ALL TO authenticated
  USING (security.is_admin())
  WITH CHECK (security.is_admin());


-- ── roles (role catalogue) ──────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relname = 'roles' AND n.nspname = 'public') THEN
    EXECUTE 'ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS roles_select ON public.roles';
    EXECUTE 'DROP POLICY IF EXISTS roles_write  ON public.roles';
    EXECUTE $sql$
      CREATE POLICY roles_select ON public.roles
        FOR SELECT TO authenticated USING (true)
    $sql$;
    EXECUTE $sql$
      CREATE POLICY roles_write ON public.roles
        FOR ALL TO authenticated
        USING (security.is_admin())
        WITH CHECK (security.is_admin())
    $sql$;
  END IF;
END $$;


-- ── notifications ───────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON public.notifications;
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
DROP POLICY IF EXISTS notifications_update ON public.notifications;
DROP POLICY IF EXISTS notifications_delete ON public.notifications;

-- Everyone reads their own; admin reads all.
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR security.is_admin());

-- Users can mark their own as read; only admin can INSERT notifications
-- addressed to another user (Edge Functions use service_role and bypass).
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR security.is_admin());

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR security.is_admin())
  WITH CHECK (user_id = auth.uid() OR security.is_admin());

CREATE POLICY notifications_delete ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR security.is_admin());


-- ── audit_logs ──────────────────────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_write  ON public.audit_logs;

-- Read: manager / admin / finance (finance often audits their own writes).
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (security.is_finance_or_up());

-- Insert: anyone authenticated can write an audit entry (the audit helper
-- functions in AP/FA pages insert during normal ops). No UPDATE/DELETE — an
-- audit trail should be append-only.
CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);


-- ── reviews (public homepage testimonials) ──────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_select ON public.reviews;
DROP POLICY IF EXISTS reviews_insert ON public.reviews;
DROP POLICY IF EXISTS reviews_update ON public.reviews;
DROP POLICY IF EXISTS reviews_delete ON public.reviews;

-- Public read of displayed reviews (anon), full read for admin.
CREATE POLICY reviews_select ON public.reviews
  FOR SELECT
  USING (display = TRUE OR security.is_admin());

-- Any authenticated user can submit; admin moderates.
CREATE POLICY reviews_insert ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY reviews_update ON public.reviews
  FOR UPDATE TO authenticated
  USING (security.is_admin())
  WITH CHECK (security.is_admin());

CREATE POLICY reviews_delete ON public.reviews
  FOR DELETE TO authenticated
  USING (security.is_admin());


-- ── contracts ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relname = 'contracts' AND n.nspname = 'public') THEN
    EXECUTE 'ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS contracts_select ON public.contracts';
    EXECUTE 'DROP POLICY IF EXISTS contracts_write  ON public.contracts';
    -- Contracts have a project_id column in the standard schema.
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'contracts' AND column_name = 'project_id') THEN
      EXECUTE $sql$
        CREATE POLICY contracts_select ON public.contracts
          FOR SELECT TO authenticated
          USING (security.has_project_access(project_id))
      $sql$;
      EXECUTE $sql$
        CREATE POLICY contracts_write ON public.contracts
          FOR ALL TO authenticated
          USING (security.can_write_project(project_id) OR security.is_finance_or_up())
          WITH CHECK (security.can_write_project(project_id) OR security.is_finance_or_up())
      $sql$;
    ELSE
      -- Firm-wide contracts (rare) — finance+ only.
      EXECUTE $sql$
        CREATE POLICY contracts_select ON public.contracts
          FOR SELECT TO authenticated
          USING (security.is_finance_or_up())
      $sql$;
      EXECUTE $sql$
        CREATE POLICY contracts_write ON public.contracts
          FOR ALL TO authenticated
          USING (security.is_finance_or_up())
          WITH CHECK (security.is_finance_or_up())
      $sql$;
    END IF;
  END IF;
END $$;


-- ── companies + tender_companies (vendor / client company master data) ─────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relname = 'companies' AND n.nspname = 'public') THEN
    EXECUTE 'ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS companies_select ON public.companies';
    EXECUTE 'DROP POLICY IF EXISTS companies_write  ON public.companies';
    -- Any authenticated user can read the companies list (pickers rely on it).
    EXECUTE $sql$
      CREATE POLICY companies_select ON public.companies
        FOR SELECT TO authenticated USING (true)
    $sql$;
    -- Only manager+/finance can add or edit companies.
    EXECUTE $sql$
      CREATE POLICY companies_write ON public.companies
        FOR ALL TO authenticated
        USING (security.is_finance_or_up())
        WITH CHECK (security.is_finance_or_up())
    $sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relname = 'tender_companies' AND n.nspname = 'public') THEN
    EXECUTE 'ALTER TABLE public.tender_companies ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS tender_companies_select ON public.tender_companies';
    EXECUTE 'DROP POLICY IF EXISTS tender_companies_write  ON public.tender_companies';
    -- Tender vendors are visible to anyone with project access (used in AP
    -- + PM materials pickers). Any authenticated user can read.
    EXECUTE $sql$
      CREATE POLICY tender_companies_select ON public.tender_companies
        FOR SELECT TO authenticated USING (true)
    $sql$;
    -- Writes: PM (curating their vendor list) + finance/manager/admin.
    EXECUTE $sql$
      CREATE POLICY tender_companies_write ON public.tender_companies
        FOR ALL TO authenticated
        USING (
          security.is_finance_or_up()
          OR security.is_project_manager()
        )
        WITH CHECK (
          security.is_finance_or_up()
          OR security.is_project_manager()
        )
    $sql$;
  END IF;
END $$;
