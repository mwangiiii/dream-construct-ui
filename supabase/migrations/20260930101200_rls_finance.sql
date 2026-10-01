-- =============================================================================
--  RLS — finance tables
--
--  Tables covered:
--    accounts_payable, accounts_receivable, invoices, loans, tax_transactions,
--    payroll_checklist, balance_sheet, bank_reconciliation, cash_flow,
--    statement_of_account, chart_of_accounts, inventory, job_postings,
--    project_financials.
--
--  Balance_sheet_entries and any per-project reports inherit their access
--  from the underlying tables through the views (vw_project_*).
--
--  Rules
--  ─────
--    Project-scoped finance tables (AP, AR, loans, tax, invoices, cash_flow,
--    bank_reconciliation, statement_of_account, inventory, job_postings):
--      Read
--        * admin / manager / finance : all rows
--        * project_manager           : rows on projects they manage
--        * quantity_surveyor         : rows on projects they survey
--        * client                    : denied (no finance visibility)
--      Write
--        * admin / manager / finance : all rows
--        * everyone else             : denied
--
--    project_financials (PM materials):
--      Read as above, but PM ALSO has R+W on their assigned projects (they
--      are the ones building the materials/BoQ costing).
--
--    Firm-wide tables (chart_of_accounts, balance_sheet):
--      Read  : any authenticated non-client
--      Write : finance / manager / admin
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- Reusable pattern for project-scoped finance tables.
-- Copy-pasted per table because Postgres RLS policies aren't parameterisable.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── accounts_payable ────────────────────────────────────────────────────────
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounts_payable_select ON public.accounts_payable;
DROP POLICY IF EXISTS accounts_payable_write  ON public.accounts_payable;

CREATE POLICY accounts_payable_select ON public.accounts_payable
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
    OR security.surveys_project(project_id)
  );

CREATE POLICY accounts_payable_write ON public.accounts_payable
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── accounts_receivable ─────────────────────────────────────────────────────
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounts_receivable_select ON public.accounts_receivable;
DROP POLICY IF EXISTS accounts_receivable_write  ON public.accounts_receivable;

CREATE POLICY accounts_receivable_select ON public.accounts_receivable
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
    OR security.surveys_project(project_id)
  );

CREATE POLICY accounts_receivable_write ON public.accounts_receivable
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── invoices ────────────────────────────────────────────────────────────────
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_select ON public.invoices;
DROP POLICY IF EXISTS invoices_write  ON public.invoices;

CREATE POLICY invoices_select ON public.invoices
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
    OR security.surveys_project(project_id)
  );

CREATE POLICY invoices_write ON public.invoices
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── loans ───────────────────────────────────────────────────────────────────
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loans_select ON public.loans;
DROP POLICY IF EXISTS loans_insert ON public.loans;
DROP POLICY IF EXISTS loans_update ON public.loans;
DROP POLICY IF EXISTS loans_delete ON public.loans;
DROP POLICY IF EXISTS loans_write  ON public.loans;

CREATE POLICY loans_select ON public.loans
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
    OR security.surveys_project(project_id)
  );

CREATE POLICY loans_write ON public.loans
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── tax_transactions ────────────────────────────────────────────────────────
ALTER TABLE public.tax_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tax_transactions_select ON public.tax_transactions;
DROP POLICY IF EXISTS tax_transactions_write  ON public.tax_transactions;

CREATE POLICY tax_transactions_select ON public.tax_transactions
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
    OR security.surveys_project(project_id)
  );

CREATE POLICY tax_transactions_write ON public.tax_transactions
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── payroll_checklist (project_id is nullable — firm-wide payroll allowed) ─
ALTER TABLE public.payroll_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_select ON public.payroll_checklist;
DROP POLICY IF EXISTS payroll_insert ON public.payroll_checklist;
DROP POLICY IF EXISTS payroll_update ON public.payroll_checklist;
DROP POLICY IF EXISTS payroll_delete ON public.payroll_checklist;
DROP POLICY IF EXISTS payroll_write  ON public.payroll_checklist;

CREATE POLICY payroll_select ON public.payroll_checklist
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR (project_id IS NOT NULL AND (
      security.manages_project(project_id)
      OR security.surveys_project(project_id)
    ))
  );

CREATE POLICY payroll_write ON public.payroll_checklist
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── cash_flow ───────────────────────────────────────────────────────────────
ALTER TABLE public.cash_flow ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_flow_select ON public.cash_flow;
DROP POLICY IF EXISTS cash_flow_write  ON public.cash_flow;

CREATE POLICY cash_flow_select ON public.cash_flow
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
    OR security.surveys_project(project_id)
  );

CREATE POLICY cash_flow_write ON public.cash_flow
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── bank_reconciliation ─────────────────────────────────────────────────────
ALTER TABLE public.bank_reconciliation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bank_reconciliation_select ON public.bank_reconciliation;
DROP POLICY IF EXISTS bank_reconciliation_write  ON public.bank_reconciliation;

-- Bank rec is finance-only (also a compliance concern) — no project-scoped
-- reads for PM/QS since bank data is enterprise-wide.
CREATE POLICY bank_reconciliation_select ON public.bank_reconciliation
  FOR SELECT TO authenticated
  USING (security.is_finance_or_up());

CREATE POLICY bank_reconciliation_write ON public.bank_reconciliation
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── statement_of_account ────────────────────────────────────────────────────
ALTER TABLE public.statement_of_account ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS statement_of_account_select ON public.statement_of_account;
DROP POLICY IF EXISTS statement_of_account_write  ON public.statement_of_account;

CREATE POLICY statement_of_account_select ON public.statement_of_account
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
    OR security.surveys_project(project_id)
  );

CREATE POLICY statement_of_account_write ON public.statement_of_account
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── inventory ───────────────────────────────────────────────────────────────
-- inventory.project_id was added later (see 20260615000001_inventory_per_project).
-- Rows without a project_id (legacy / catalogue-level stock) are finance-only.
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_select ON public.inventory;
DROP POLICY IF EXISTS inventory_write  ON public.inventory;

CREATE POLICY inventory_select ON public.inventory
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR (project_id IS NOT NULL AND (
      security.manages_project(project_id)
      OR security.surveys_project(project_id)
    ))
  );

CREATE POLICY inventory_write ON public.inventory
  FOR ALL TO authenticated
  USING (
    security.is_finance_or_up()
    OR (project_id IS NOT NULL AND security.manages_project(project_id))
  )
  WITH CHECK (
    security.is_finance_or_up()
    OR (project_id IS NOT NULL AND security.manages_project(project_id))
  );


-- ── job_postings — read for anyone with project access, write for PM+ ──────
-- Manual Job Costing entries are legitimately a PM tool ("labour is here,
-- materials are there") — but write access still requires PM+ / finance
-- because mirror rows carry FKs to source-of-truth tables the QS/client
-- must not be able to fake.
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read job_postings"    ON public.job_postings;
DROP POLICY IF EXISTS "Authenticated users can insert job_postings"  ON public.job_postings;
DROP POLICY IF EXISTS "Authenticated users can update job_postings"  ON public.job_postings;
DROP POLICY IF EXISTS "Authenticated users can delete job_postings"  ON public.job_postings;
DROP POLICY IF EXISTS job_postings_select ON public.job_postings;
DROP POLICY IF EXISTS job_postings_write  ON public.job_postings;

CREATE POLICY job_postings_select ON public.job_postings
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
    OR security.surveys_project(project_id)
  );

-- Only manual rows are directly writable through this policy. Mirror rows
-- (source != 'manual') are populated by triggers running as the row owner
-- of the source-of-truth table; those inserts pass because triggers run in
-- the transaction of the original insert on payroll/AP/loans/tax and those
-- gates already applied. This policy blocks any client attempt to directly
-- create a fake mirror row (they can't satisfy the FK anyway, but belt+braces).
CREATE POLICY job_postings_write ON public.job_postings
  FOR ALL TO authenticated
  USING (
    (source = 'manual') AND (
      security.is_finance_or_up()
      OR security.manages_project(project_id)
    )
  )
  WITH CHECK (
    (source = 'manual') AND (
      security.is_finance_or_up()
      OR security.manages_project(project_id)
    )
  );


-- ── project_financials (PM materials) ───────────────────────────────────────
-- PM has R+W on their assigned projects (they run the tendering / materials
-- workflow). Finance/manager/admin R+W. QS R only. Client denied.
ALTER TABLE public.project_financials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_financials_select ON public.project_financials;
DROP POLICY IF EXISTS project_financials_write  ON public.project_financials;

CREATE POLICY project_financials_select ON public.project_financials
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
    OR security.surveys_project(project_id)
  );

CREATE POLICY project_financials_write ON public.project_financials
  FOR ALL TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
  )
  WITH CHECK (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
  );


-- ── chart_of_accounts (firm-wide reference data) ────────────────────────────
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chart_of_accounts_select ON public.chart_of_accounts;
DROP POLICY IF EXISTS chart_of_accounts_write  ON public.chart_of_accounts;

-- Any authenticated non-client user can read the COA (needed for account
-- pickers in AP, invoices, payroll, etc.).
CREATE POLICY chart_of_accounts_select ON public.chart_of_accounts
  FOR SELECT TO authenticated
  USING (NOT security.is_client() OR security.is_manager_or_up());

CREATE POLICY chart_of_accounts_write ON public.chart_of_accounts
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── balance_sheet + balance_sheet_entries (firm-wide) ──────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relname = 'balance_sheet' AND n.nspname = 'public') THEN
    EXECUTE 'ALTER TABLE public.balance_sheet ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS balance_sheet_select ON public.balance_sheet';
    EXECUTE 'DROP POLICY IF EXISTS balance_sheet_write  ON public.balance_sheet';
    EXECUTE $sql$
      CREATE POLICY balance_sheet_select ON public.balance_sheet
        FOR SELECT TO authenticated
        USING (security.is_finance_or_up())
    $sql$;
    EXECUTE $sql$
      CREATE POLICY balance_sheet_write ON public.balance_sheet
        FOR ALL TO authenticated
        USING (security.is_finance_or_up())
        WITH CHECK (security.is_finance_or_up())
    $sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relname = 'balance_sheet_entries' AND n.nspname = 'public') THEN
    EXECUTE 'ALTER TABLE public.balance_sheet_entries ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS balance_sheet_entries_select ON public.balance_sheet_entries';
    EXECUTE 'DROP POLICY IF EXISTS balance_sheet_entries_write  ON public.balance_sheet_entries';
    EXECUTE $sql$
      CREATE POLICY balance_sheet_entries_select ON public.balance_sheet_entries
        FOR SELECT TO authenticated
        USING (security.is_finance_or_up())
    $sql$;
    EXECUTE $sql$
      CREATE POLICY balance_sheet_entries_write ON public.balance_sheet_entries
        FOR ALL TO authenticated
        USING (security.is_finance_or_up())
        WITH CHECK (security.is_finance_or_up())
    $sql$;
  END IF;
END $$;
