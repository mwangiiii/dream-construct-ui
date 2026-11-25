-- Concatenated pending migrations, in apply order.
-- Run as ONE transaction in Dashboard -> SQL Editor.
BEGIN;

-- ===== 20261124100000_job_posting_payroll_links =====
-- =============================================================================
--  job_posting_payroll_links â€” attach payroll checklist entries to a job
--  costing record.
--
--  A manual job costing row can nominate one or more payroll entries ("who do I
--  want to include in this record's labour cost"). The job costing screen then
--  shows a CONSOLIDATED actual:
--
--      consolidated = job_postings.actual_amount_used
--                   + SUM(linked payroll_checklist.gross_pay)
--
--  â”€â”€ Why the payroll figure is NOT written into actual_amount_used â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  vw_project_cost_incurred computes
--
--      SUM(job_postings.actual_amount_used WHERE source='manual')
--    + SUM(payroll_checklist.gross_pay)
--    + ...
--
--  so folding linked gross_pay into actual_amount_used would count that labour
--  twice in WIP â€” precisely the double-count the source-tagged mirror design
--  was built to eliminate. Instead actual_amount_used stays purely manual, the
--  links live here, and the consolidation happens at read time. WIP continues
--  to count each wage exactly once, at payroll_checklist.
--
--  This table is additive: the existing payroll â†’ job_postings mirror rows
--  (source='payroll') are left untouched and still appear in the "Linked from
--  other modules" panel.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.job_posting_payroll_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id  uuid   NOT NULL REFERENCES public.job_postings(id)      ON DELETE CASCADE,
  payroll_id      bigint NOT NULL REFERENCES public.payroll_checklist(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- One link per (record, employee entry). Re-selecting is idempotent.
  CONSTRAINT job_posting_payroll_links_unique UNIQUE (job_posting_id, payroll_id)
);

CREATE INDEX IF NOT EXISTS job_posting_payroll_links_posting_idx
  ON public.job_posting_payroll_links(job_posting_id);
CREATE INDEX IF NOT EXISTS job_posting_payroll_links_payroll_idx
  ON public.job_posting_payroll_links(payroll_id);


-- â”€â”€ Guard: a link may only join rows on the SAME project â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Without this, one project's wages could be attributed to another project's
-- job costing record, which would silently corrupt per-project labour cost.
-- A trigger is used rather than a CHECK because the comparison spans tables.
CREATE OR REPLACE FUNCTION public.job_posting_payroll_link_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  posting_project uuid;
  payroll_project uuid;
BEGIN
  SELECT project_id INTO posting_project
    FROM public.job_postings WHERE id = NEW.job_posting_id;

  SELECT project_id INTO payroll_project
    FROM public.payroll_checklist WHERE id = NEW.payroll_id;

  IF posting_project IS DISTINCT FROM payroll_project THEN
    RAISE EXCEPTION
      'payroll entry % belongs to project % but job costing record % belongs to project %',
      NEW.payroll_id, payroll_project, NEW.job_posting_id, posting_project
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_posting_payroll_link_guard ON public.job_posting_payroll_links;
CREATE TRIGGER trg_job_posting_payroll_link_guard
  BEFORE INSERT OR UPDATE ON public.job_posting_payroll_links
  FOR EACH ROW EXECUTE FUNCTION public.job_posting_payroll_link_guard();


-- â”€â”€ RLS â€” mirrors job_postings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Read for anyone with access to the parent project; write for PM+ / finance,
-- matching job_postings_write. Access is resolved through the parent job
-- costing row so the two can never disagree.
ALTER TABLE public.job_posting_payroll_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_posting_payroll_links_select ON public.job_posting_payroll_links;
DROP POLICY IF EXISTS job_posting_payroll_links_write  ON public.job_posting_payroll_links;

CREATE POLICY job_posting_payroll_links_select ON public.job_posting_payroll_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = job_posting_id
        AND (
          security.is_finance_or_up()
          OR security.manages_project(jp.project_id)
          OR security.surveys_project(jp.project_id)
        )
    )
  );

CREATE POLICY job_posting_payroll_links_write ON public.job_posting_payroll_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = job_posting_id
        AND (security.is_finance_or_up() OR security.manages_project(jp.project_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = job_posting_id
        AND (security.is_finance_or_up() OR security.manages_project(jp.project_id))
    )
  );


COMMENT ON TABLE public.job_posting_payroll_links IS
  'Many-to-many: which payroll_checklist entries a manual job costing record '
  'includes in its labour cost. Read-time consolidation only â€” the linked '
  'gross_pay is deliberately NOT added to job_postings.actual_amount_used, '
  'because vw_project_cost_incurred already sums payroll_checklist directly '
  'and doing so would double-count labour in WIP.';

COMMENT ON FUNCTION public.job_posting_payroll_link_guard() IS
  'Rejects links whose payroll entry and job costing record belong to '
  'different projects (NULL-safe via IS DISTINCT FROM).';

-- ===== 20261124110000_linter_search_path_and_grants =====
-- =============================================================================
--  Linter 0011 (function_search_path_mutable) + 0028/0029 (SECURITY DEFINER
--  functions executable via the REST API).
--
--  â”€â”€ search_path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  A function without a pinned search_path resolves unqualified names using
--  the CALLER's search_path. For SECURITY DEFINER functions that is a
--  privilege-escalation vector: a caller prepends a schema they control, puts
--  a malicious `projects` table in it, and the function operates on that
--  instead. Even for SECURITY INVOKER functions it makes behaviour
--  non-deterministic.
--
--  Rather than list ~60 signatures by hand (and risk typos on overloads), the
--  loop below finds every function in public/security that has no search_path
--  and pins one. Extension-owned functions are skipped â€” they are maintained
--  by the extension, not us.
--
--  â”€â”€ REST exposure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  PostgREST exposes everything in the `public` schema as an RPC endpoint.
--  Trigger functions were never meant to be called that way, so EXECUTE is
--  revoked from anon and authenticated. This closes the mirror_* / validate_* /
--  auto_* / update_*_updated_at findings in one pass.
--
--  Destructive project RPCs and the internal role helpers additionally lose
--  anon access â€” `archive_project`, `permanent_delete_project` and
--  `restore_project` being callable without signing in is the most serious
--  item in the whole lint report.
--
--  Deliberately left public: increment_media_view/click/share_count and
--  search_media_posts. The public marketing site calls these unauthenticated.
-- =============================================================================


-- â”€â”€ 1. Pin search_path on every unpinned function in public / security â”€â”€â”€â”€â”€â”€
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


-- â”€â”€ 2. Trigger functions are not RPC endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- â”€â”€ 3. Destructive project RPCs: signed-in only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- These already gate on role internally, but there is no reason for them to be
-- reachable at all without a session.
REVOKE ALL ON FUNCTION public.archive_project(uuid)          FROM anon;
REVOKE ALL ON FUNCTION public.restore_project(uuid)          FROM anon;
REVOKE ALL ON FUNCTION public.permanent_delete_project(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.reorder_milestones_bulk(uuid, jsonb) FROM anon;


-- â”€â”€ 4. Internal role / permission helpers: not a public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- â”€â”€ 5. Admin-only maintenance tooling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Enumerates storage objects; nobody but an operator should run it.
REVOKE ALL ON FUNCTION public.find_orphaned_storage_files() FROM anon, authenticated;

-- ===== 20261124120000_drop_legacy_permissive_policies =====
-- =============================================================================
--  Linter 0024 (rls_policy_always_true) â€” remove legacy `USING (true)` write
--  policies that silently cancel the 20260930101* RLS work.
--
--  â”€â”€ Why this matters more than a WARN suggests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  Postgres RLS policies are PERMISSIVE by default, meaning they are OR'd
--  together. A table with both
--
--      CREATE POLICY tax_update ON tax_transactions FOR UPDATE USING (true);
--      CREATE POLICY tax_transactions_write ON tax_transactions
--        FOR ALL USING (security.is_finance_or_up());
--
--  grants UPDATE to anyone, because the first policy passes unconditionally.
--  The role checks added in 20260930101200_rls_finance.sql were therefore a
--  no-op on every table listed below â€” the old policies were never dropped.
--
--  Worst case was chart_of_accounts, which carried INSERT/UPDATE/DELETE
--  policies granted to `anon`: the entire Chart of Accounts was writable
--  without signing in.
--
--  â”€â”€ Scope â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  Part A drops legacy policies on tables that ALREADY have a correct
--  replacement, so access is unchanged for finance/manager/admin and merely
--  stops being available to everyone else.
--
--  Part B covers three tables that have NO modern policy at all. Dropping
--  alone would lock every user out, so each gets a finance+ policy in the same
--  statement block.
--
--  â”€â”€ Deliberately NOT touched â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  These are flagged by the linter but are correct by design:
--    * audit_logs_insert   â€” WITH CHECK (true). Append-only audit trail; any
--                            authenticated actor must be able to record its
--                            own action. Reads are already finance+.
--    * email_logs_insert   â€” same rationale, documented in 20260930101600.
--    * reviews_insert      â€” public review submission is a product feature.
-- =============================================================================


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  PART A â€” tables with a correct replacement policy already in place
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- chart_of_accounts â†’ chart_of_accounts_select / _write (20260930101200:337)
-- These three were granted to anon AND authenticated.
DROP POLICY IF EXISTS "anon and authenticated can insert" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "anon and authenticated can update" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "anon and authenticated can delete" ON public.chart_of_accounts;

-- tax_transactions â†’ tax_transactions_select / _write (20260930101200:130)
DROP POLICY IF EXISTS tax_insert ON public.tax_transactions;
DROP POLICY IF EXISTS tax_update ON public.tax_transactions;
DROP POLICY IF EXISTS tax_delete ON public.tax_transactions;

-- statement_of_account â†’ statement_of_account_select / _write (â€¦101200:213)
DROP POLICY IF EXISTS soa_insert ON public.statement_of_account;
DROP POLICY IF EXISTS soa_update ON public.statement_of_account;
DROP POLICY IF EXISTS soa_delete ON public.statement_of_account;

-- balance_sheet_entries â†’ balance_sheet_entries_select / _write (â€¦101200:374)
DROP POLICY IF EXISTS bse_insert ON public.balance_sheet_entries;
DROP POLICY IF EXISTS bse_update ON public.balance_sheet_entries;
DROP POLICY IF EXISTS bse_delete ON public.balance_sheet_entries;

-- inventory â†’ inventory_select / inventory_write (20260930101200:235)
DROP POLICY IF EXISTS "Authenticated users can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated users can update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated users can delete inventory" ON public.inventory;

-- job_posting (legacy singular table, superseded by job_postings) â€” its write
-- policies were fully open. Reads stay as they are; writes become finance+.
DROP POLICY IF EXISTS "Authenticated users can insert job_posting" ON public.job_posting;
DROP POLICY IF EXISTS "Authenticated users can update job_posting" ON public.job_posting;
DROP POLICY IF EXISTS "Authenticated users can delete job_posting" ON public.job_posting;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='job_posting') THEN
    DROP POLICY IF EXISTS job_posting_write ON public.job_posting;
    CREATE POLICY job_posting_write ON public.job_posting
      FOR ALL TO authenticated
      USING (security.is_finance_or_up())
      WITH CHECK (security.is_finance_or_up());
  END IF;
END $$;


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  PART B â€” tables with NO modern policy: drop + replace atomically
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- work_in_progress â€” project-scoped finance report. Read for anyone with
-- project access, write for finance+. Mirrors the accounts_payable pattern.
DROP POLICY IF EXISTS wip_insert_authenticated ON public.work_in_progress;
DROP POLICY IF EXISTS wip_update_authenticated ON public.work_in_progress;
DROP POLICY IF EXISTS wip_delete_authenticated ON public.work_in_progress;
DROP POLICY IF EXISTS wip_select ON public.work_in_progress;
DROP POLICY IF EXISTS wip_write  ON public.work_in_progress;

ALTER TABLE public.work_in_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY wip_select ON public.work_in_progress
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
    OR security.surveys_project(project_id)
  );

CREATE POLICY wip_write ON public.work_in_progress
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- end_month_close_checklist â€” firm-wide finance process, no project column.
DROP POLICY IF EXISTS "Authenticated users can insert end_month_close_checklist" ON public.end_month_close_checklist;
DROP POLICY IF EXISTS "Authenticated users can update end_month_close_checklist" ON public.end_month_close_checklist;
DROP POLICY IF EXISTS "Authenticated users can delete end_month_close_checklist" ON public.end_month_close_checklist;
DROP POLICY IF EXISTS emcc_select ON public.end_month_close_checklist;
DROP POLICY IF EXISTS emcc_write  ON public.end_month_close_checklist;

ALTER TABLE public.end_month_close_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY emcc_select ON public.end_month_close_checklist
  FOR SELECT TO authenticated
  USING (NOT security.is_client());

CREATE POLICY emcc_write ON public.end_month_close_checklist
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- fixed_asset_equipment_depreciation â€” firm-wide asset register.
DROP POLICY IF EXISTS "Authenticated users can insert fixed_asset_equipment_depreciati" ON public.fixed_asset_equipment_depreciation;
DROP POLICY IF EXISTS "Authenticated users can update fixed_asset_equipment_depreciati" ON public.fixed_asset_equipment_depreciation;
DROP POLICY IF EXISTS "Authenticated users can delete fixed_asset_equipment_depreciati" ON public.fixed_asset_equipment_depreciation;
DROP POLICY IF EXISTS faed_select ON public.fixed_asset_equipment_depreciation;
DROP POLICY IF EXISTS faed_write  ON public.fixed_asset_equipment_depreciation;

ALTER TABLE public.fixed_asset_equipment_depreciation ENABLE ROW LEVEL SECURITY;

CREATE POLICY faed_select ON public.fixed_asset_equipment_depreciation
  FOR SELECT TO authenticated
  USING (NOT security.is_client());

CREATE POLICY faed_write ON public.fixed_asset_equipment_depreciation
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());

-- ===== 20261124130000_linter_fk_indexes =====
-- =============================================================================
--  Linter 0001 (unindexed_foreign_keys) â€” add covering indexes.
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
--  All CREATE INDEX IF NOT EXISTS, so re-running is a no-op. Not CONCURRENTLY â€”
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

-- ===== 20261124140000_storage_bucket_listing =====
-- =============================================================================
--  Linter 0025 (public_bucket_allows_listing).
--
--  documents-and-images, media-posts and profile-pictures are public buckets
--  that each also carry a broad SELECT policy on storage.objects. For a PUBLIC
--  bucket, fetching an object by its URL does not consult RLS at all â€” so that
--  policy buys nothing for display, while allowing any caller to enumerate
--  every file in the bucket (including filenames of client documents).
--
--  Verified before dropping: the app never calls storage.list(). The only
--  storage calls in src/ are getPublicUrl (Team.tsx:115, UpdatesTab.tsx:366),
--  upload and remove (lib/api/projectApi.ts:652,666). INSERT/DELETE policies
--  are untouched, so upload and remove keep working.
--
--  If an image somewhere does go blank after this, the cause is a code path
--  using download()/list() on a public bucket rather than getPublicUrl â€” the
--  fix is to switch that call, not to restore blanket listing.
-- =============================================================================

DROP POLICY IF EXISTS "Allow public download from documents-and-images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view media files"                     ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile pictures"                ON storage.objects;

-- ===== 20261124150000_ap_relax_required_fields =====
-- =============================================================================
--  accounts_payable â€” make the descriptive fields optional.
--
--  The AP form previously required vendor, invoice number, eTIMS code,
--  receiving account and due date before Save would enable. Finance wants to
--  be able to post a payable with only the amount known and fill the rest in
--  later, so every one of those becomes optional.
--
--  Each needs the NOT NULL lifted rather than just relaxing the form:
--
--    vendor_name / invoice_number / etims_code
--        TEXT NOT NULL. An empty string would technically satisfy NOT NULL,
--        but storing '' makes every downstream report print blanks that look
--        like data. NULL is the honest representation of "not known yet".
--
--    receiving_account_code
--        TEXT NOT NULL *and* FK fk_ap_receiving_account_code â†’
--        chart_of_accounts. '' is not a valid account code, so an empty value
--        fails the FK outright. Only NULL works here.
--
--    due_date
--        DATE NOT NULL. Sending '' raises
--        `invalid input syntax for type date: ""` (22P02) â€” the same failure
--        that broke the global Taxes form before 20261124090000.
--
--  `date` stays NOT NULL: the form auto-populates it with today and renders it
--  read-only, so it can never arrive empty.
--
--  The ap_requires_pm_commodity CHECK is untouched â€” a project-linked invoice
--  still has to name its PM commodity. Relaxing these fields does not relax
--  the costing discipline.
-- =============================================================================

ALTER TABLE public.accounts_payable
  ALTER COLUMN vendor_name            DROP NOT NULL,
  ALTER COLUMN invoice_number         DROP NOT NULL,
  ALTER COLUMN etims_code             DROP NOT NULL,
  ALTER COLUMN receiving_account_code DROP NOT NULL,
  ALTER COLUMN due_date               DROP NOT NULL;


-- Existing rows may carry '' from before this change; normalise so "unknown"
-- has exactly one representation and the FK can be trusted.
UPDATE public.accounts_payable
   SET vendor_name            = NULLIF(vendor_name, ''),
       invoice_number         = NULLIF(invoice_number, ''),
       etims_code             = NULLIF(etims_code, ''),
       receiving_account_code = NULLIF(receiving_account_code, '')
 WHERE vendor_name            = ''
    OR invoice_number         = ''
    OR etims_code             = ''
    OR receiving_account_code = '';


COMMENT ON COLUMN public.accounts_payable.vendor_name IS
  'Nullable â€” AP invoices can be posted before the vendor is known.';
COMMENT ON COLUMN public.accounts_payable.receiving_account_code IS
  'Nullable FK to chart_of_accounts. NULL = not yet coded. Never '''' â€” the '
  'empty string is not a valid account code and fails the FK.';
COMMENT ON COLUMN public.accounts_payable.due_date IS
  'Nullable â€” set once payment terms are agreed. Aging/overdue reporting '
  'should treat NULL as "no due date" rather than overdue.';

-- ===== 20261124160000_ap_drop_commodity_requirement =====
-- =============================================================================
--  accounts_payable â€” vendor / PM commodity becomes fully optional.
--
--  ap_requires_pm_commodity (added 20260930101500, relaxed for standalone rows
--  in 20261123120000) forced every project-linked invoice to name a
--  project_financials row:
--
--      project_id IS NULL
--      OR project_financial_id IS NOT NULL
--      OR is_legacy_adhoc = true
--
--  The AP form now treats vendor as optional, so selecting a project without a
--  commodity hit "violates check constraint ap_requires_pm_commodity". Finance
--  wants to post a payable with only the amount known, project-linked or not.
--
--  â”€â”€ What this does NOT give up â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  The original bug this CHECK accompanied was AP invoices representing
--  VENDOR-LEVEL AGGREGATES instead of a single commodity. That guarantee does
--  not come from the CHECK â€” it comes from two things that are untouched:
--
--    * project_financial_id remains an FK to ONE project_financials row, so a
--      populated link can still only ever mean a single commodity.
--    * VendorSelect renders one option per (vendor + commodity) and never a
--      per-vendor sum, so the UI cannot offer a rollup in the first place.
--
--  The CHECK only guaranteed that a link EXISTS. Dropping it permits AP rows
--  with no PM counterpart at all.
--
--  â”€â”€ What is genuinely lost â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  A project-linked AP cost can now exist with no commodity, so it will not
--  reconcile back to the BoQ. is_legacy_adhoc and its partial index survive, so
--  `WHERE project_financial_id IS NULL AND project_id IS NOT NULL` remains the
--  query for finding project costs that still need backlinking to PM.
-- =============================================================================

ALTER TABLE public.accounts_payable
  DROP CONSTRAINT IF EXISTS ap_requires_pm_commodity;


COMMENT ON COLUMN public.accounts_payable.project_financial_id IS
  'Optional FK to ONE project_financials (PM commodity) row. When set, this '
  'invoice pays for that single commodity â€” never a vendor-level rollup. NULL '
  'means the cost has no PM counterpart yet; finance can backfill later. The '
  'former ap_requires_pm_commodity CHECK was dropped in 20261124160000 so '
  'vendor selection is optional on every AP row.';

-- ===== 20261124170000_vendor_bank_account =====
-- =============================================================================
--  Vendor bank details on tender_companies, and AP's receiving account becomes
--  the VENDOR's account number.
--
--  â”€â”€ Semantic change, read this before reusing the column â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  accounts_payable.receiving_account_code previously held one of OUR bank
--  accounts, validated against chart_of_accounts by fk_ap_receiving_account_code
--  ("Payment bank account must exist in chart_of_accounts"). It now holds the
--  VENDOR's bank account number â€” where the money is going, not where it came
--  from. A bank account number is not a COA code, so the FK has to go.
--
--  What this gives up: AP no longer records which of our accounts paid an
--  invoice. Bank reconciliation must infer that from bank_reconciliation /
--  cash_flow instead. This was an explicit trade â€” the field is wanted as the
--  payee account, auto-filled when a vendor is picked.
--
--  â”€â”€ Why tender_companies only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  AP vendors come from two places: tender_companies (PM commodities) and the
--  companies master list. Only tender_companies gets bank fields for now, so
--  auto-fill works for project-linked invoices; picking from the master list
--  leaves the field blank to type by hand.
-- =============================================================================


-- â”€â”€ 1. Vendor bank details â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.tender_companies
  ADD COLUMN IF NOT EXISTS bank_name       text,
  ADD COLUMN IF NOT EXISTS bank_account_no text,
  ADD COLUMN IF NOT EXISTS bank_branch     text;

COMMENT ON COLUMN public.tender_companies.bank_account_no IS
  'Vendor payee account number. Auto-fills accounts_payable.'
  'receiving_account_code when this vendor is selected on an AP invoice.';


-- â”€â”€ 2. AP receiving account is no longer a COA code â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.accounts_payable
  DROP CONSTRAINT IF EXISTS fk_ap_receiving_account_code;

COMMENT ON COLUMN public.accounts_payable.receiving_account_code IS
  'Receiving Account No â€” the VENDOR''s bank account number that this invoice '
  'is paid into. Auto-filled from tender_companies.bank_account_no when a PM '
  'vendor is selected, otherwise typed by hand. Nullable. NOT a '
  'chart_of_accounts code: the COA foreign key was dropped in 20261124170000 '
  'when the column changed meaning.';

-- ===== 20261125090000_public_legal_documents =====
-- =============================================================================
--  Public Terms of Service / Privacy Policy on the existing policies tables.
--
--  Login.tsx already links to /terms and /privacy, but no such routes existed
--  and policy content was readable only `TO authenticated` â€” so an anonymous
--  visitor could not have read them even if the pages existed. This opens a
--  narrow, explicitly-flagged public lane.
--
--  â”€â”€ Exposure model â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  Public legal docs share a table with internal staff policies, so the gate
--  is deliberately a DOUBLE opt-in and defaults to closed:
--
--      anon can read a policy  <=>  policies.is_public
--                                   AND policies.is_active
--                                   AND its category.is_public
--
--  Flagging one row public is therefore not enough; the category must be
--  public too. Both default to FALSE, so every existing staff policy stays
--  private with no migration of data.
--
--  â”€â”€ Fixing the write policies while we are here â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
--  The original policies from 20260306085619 gate writes on
--  `profiles.role IN ('admin','manager')`. public.profiles has no `role`
--  column (see 20251127170432_profiles.sql) â€” roles live in user_roles and are
--  read via the security.* helpers introduced in 20260930101000. Those policies
--  are therefore either dead or relying on an untracked column, which would
--  make an admin editor fail to save for reasons nobody could see.
--
--  All four are replaced with helper-based equivalents. security.is_manager_or_up()
--  is admin + manager, matching the original intent exactly.
-- =============================================================================


-- â”€â”€ 1. Public flags, closed by default â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.policy_categories
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.policy_categories.is_public IS
  'TRUE exposes this category to anonymous visitors (e.g. Terms of Service, '
  'Privacy Policy). Required in addition to policies.is_public â€” both gates '
  'must open before anon can read a section.';

COMMENT ON COLUMN public.policies.is_public IS
  'TRUE publishes this section to the public legal pages, but only when its '
  'category is also is_public and this row is is_active. Defaults FALSE so '
  'internal staff policies are never exposed by accident.';

CREATE INDEX IF NOT EXISTS policy_categories_public_idx
  ON public.policy_categories(slug) WHERE is_public;
CREATE INDEX IF NOT EXISTS policies_public_idx
  ON public.policies(category_id) WHERE is_public AND is_active;


-- â”€â”€ 2. Replace the stale profiles.role policies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DROP POLICY IF EXISTS "Authenticated users can read policy_categories" ON public.policy_categories;
DROP POLICY IF EXISTS "Admins can manage policy_categories"            ON public.policy_categories;
DROP POLICY IF EXISTS "Authenticated non-clients can read policies"    ON public.policies;
DROP POLICY IF EXISTS "Admins can read all policies"                   ON public.policies;
DROP POLICY IF EXISTS "Admins can manage policies"                     ON public.policies;

DROP POLICY IF EXISTS policy_categories_public_read ON public.policy_categories;
DROP POLICY IF EXISTS policy_categories_staff_read  ON public.policy_categories;
DROP POLICY IF EXISTS policy_categories_write       ON public.policy_categories;
DROP POLICY IF EXISTS policies_public_read          ON public.policies;
DROP POLICY IF EXISTS policies_staff_read           ON public.policies;
DROP POLICY IF EXISTS policies_write                ON public.policies;


-- â”€â”€ 3. policy_categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Anonymous visitors: public categories only. Granted to anon AND
-- authenticated so a logged-in client also reaches the legal pages.
CREATE POLICY policy_categories_public_read ON public.policy_categories
  FOR SELECT TO anon, authenticated
  USING (is_public);

-- Internal staff: everything. Clients are excluded â€” they have no business in
-- the internal policy library, which was the original intent of the
-- "NOT IN ('client')" check.
CREATE POLICY policy_categories_staff_read ON public.policy_categories
  FOR SELECT TO authenticated
  USING (NOT security.is_client());

CREATE POLICY policy_categories_write ON public.policy_categories
  FOR ALL TO authenticated
  USING (security.is_manager_or_up())
  WITH CHECK (security.is_manager_or_up());


-- â”€â”€ 4. policies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- The public lane: all three conditions, including the parent category's flag.
CREATE POLICY policies_public_read ON public.policies
  FOR SELECT TO anon, authenticated
  USING (
    is_public
    AND is_active
    AND EXISTS (
      SELECT 1 FROM public.policy_categories c
      WHERE c.id = category_id AND c.is_public
    )
  );

-- Staff read the internal library. manager+ additionally sees inactive drafts,
-- which the admin editor needs in order to list and publish them.
CREATE POLICY policies_staff_read ON public.policies
  FOR SELECT TO authenticated
  USING (
    security.is_manager_or_up()
    OR (is_active AND NOT security.is_client())
  );

CREATE POLICY policies_write ON public.policies
  FOR ALL TO authenticated
  USING (security.is_manager_or_up())
  WITH CHECK (security.is_manager_or_up());


-- â”€â”€ 5. Seed the two public documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Created already-public with placeholder bodies so the /terms and /privacy
-- routes resolve immediately and admin has something concrete to edit. The
-- placeholder text states plainly that it is not final, so it cannot be
-- mistaken for reviewed legal copy.
INSERT INTO public.policy_categories (title, slug, description, icon, sort_order, is_public)
VALUES
  ('Terms of Service', 'terms-of-service',
   'The terms governing use of Dream Construct System.', 'FileText', 100, true),
  ('Privacy Policy', 'privacy-policy',
   'How Dream Construct System collects, uses and protects your data.', 'ShieldCheck', 101, true)
ON CONFLICT (slug) DO UPDATE
  SET is_public = true,
      title     = EXCLUDED.title;

INSERT INTO public.policies (category_id, title, content, is_active, is_public, sort_order)
SELECT c.id, v.title, v.content, true, true, v.sort_order
FROM public.policy_categories c
JOIN (VALUES
  ('terms-of-service', 'Acceptance of Terms',
   E'**This is placeholder text and has not been reviewed. Replace it before relying on it.**\n\nBy accessing or using Dream Construct System you agree to be bound by these terms. If you do not agree, do not use the service.',
   1),
  ('terms-of-service', 'Use of the Service',
   E'**Placeholder â€” pending review.**\n\nYou agree to use the service only for lawful purposes and not to interfere with its operation or attempt to access data you are not authorised to see.',
   2),
  ('privacy-policy', 'Information We Collect',
   E'**This is placeholder text and has not been reviewed. Replace it before relying on it.**\n\nWe collect the information you provide when you create an account or use the service, including your name, email address and project records.',
   1),
  ('privacy-policy', 'How We Use Your Information',
   E'**Placeholder â€” pending review.**\n\nWe use your information to operate the service, authenticate you and communicate about your projects. We do not sell your personal data.',
   2)
) AS v(slug, title, content, sort_order)
  ON v.slug = c.slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.policies p
  WHERE p.category_id = c.id AND p.title = v.title
);

COMMIT;
