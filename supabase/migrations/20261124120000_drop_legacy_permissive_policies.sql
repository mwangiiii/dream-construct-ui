-- =============================================================================
--  Linter 0024 (rls_policy_always_true) — remove legacy `USING (true)` write
--  policies that silently cancel the 20260930101* RLS work.
--
--  ── Why this matters more than a WARN suggests ──────────────────────────────
--  Postgres RLS policies are PERMISSIVE by default, meaning they are OR'd
--  together. A table with both
--
--      CREATE POLICY tax_update ON tax_transactions FOR UPDATE USING (true);
--      CREATE POLICY tax_transactions_write ON tax_transactions
--        FOR ALL USING (security.is_finance_or_up());
--
--  grants UPDATE to anyone, because the first policy passes unconditionally.
--  The role checks added in 20260930101200_rls_finance.sql were therefore a
--  no-op on every table listed below — the old policies were never dropped.
--
--  Worst case was chart_of_accounts, which carried INSERT/UPDATE/DELETE
--  policies granted to `anon`: the entire Chart of Accounts was writable
--  without signing in.
--
--  ── Scope ──────────────────────────────────────────────────────────────────
--  Part A drops legacy policies on tables that ALREADY have a correct
--  replacement, so access is unchanged for finance/manager/admin and merely
--  stops being available to everyone else.
--
--  Part B covers three tables that have NO modern policy at all. Dropping
--  alone would lock every user out, so each gets a finance+ policy in the same
--  statement block.
--
--  ── Deliberately NOT touched ───────────────────────────────────────────────
--  These are flagged by the linter but are correct by design:
--    * audit_logs_insert   — WITH CHECK (true). Append-only audit trail; any
--                            authenticated actor must be able to record its
--                            own action. Reads are already finance+.
--    * email_logs_insert   — same rationale, documented in 20260930101600.
--    * reviews_insert      — public review submission is a product feature.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
--  PART A — tables with a correct replacement policy already in place
-- ─────────────────────────────────────────────────────────────────────────────

-- chart_of_accounts → chart_of_accounts_select / _write (20260930101200:337)
-- These three were granted to anon AND authenticated.
DROP POLICY IF EXISTS "anon and authenticated can insert" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "anon and authenticated can update" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "anon and authenticated can delete" ON public.chart_of_accounts;

-- tax_transactions → tax_transactions_select / _write (20260930101200:130)
DROP POLICY IF EXISTS tax_insert ON public.tax_transactions;
DROP POLICY IF EXISTS tax_update ON public.tax_transactions;
DROP POLICY IF EXISTS tax_delete ON public.tax_transactions;

-- statement_of_account → statement_of_account_select / _write (…101200:213)
DROP POLICY IF EXISTS soa_insert ON public.statement_of_account;
DROP POLICY IF EXISTS soa_update ON public.statement_of_account;
DROP POLICY IF EXISTS soa_delete ON public.statement_of_account;

-- balance_sheet_entries → balance_sheet_entries_select / _write (…101200:374)
DROP POLICY IF EXISTS bse_insert ON public.balance_sheet_entries;
DROP POLICY IF EXISTS bse_update ON public.balance_sheet_entries;
DROP POLICY IF EXISTS bse_delete ON public.balance_sheet_entries;

-- inventory → inventory_select / inventory_write (20260930101200:235)
DROP POLICY IF EXISTS "Authenticated users can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated users can update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated users can delete inventory" ON public.inventory;

-- job_posting (legacy singular table, superseded by job_postings) — its write
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


-- ─────────────────────────────────────────────────────────────────────────────
--  PART B — tables with NO modern policy: drop + replace atomically
-- ─────────────────────────────────────────────────────────────────────────────

-- work_in_progress — project-scoped finance report. Read for anyone with
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


-- end_month_close_checklist — firm-wide finance process, no project column.
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


-- fixed_asset_equipment_depreciation — firm-wide asset register.
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
