-- =============================================================================
--  RLS — the 14 tables that fell through the first pass.
--
--  Audit at the end of the DB-level-policies push flagged these as having
--  RLS disabled. This migration enables RLS + adds policies to each.
--  Models chosen per table based on column shape:
--
--    bank_reconciliation_entries, cash_flow_entries   → finance+ (parent is)
--    income_statement, income_statement_line_items    → finance+
--    inventory_items                                  → finance+ (firm-wide,
--                                                      no project_id)
--    email_logs                                       → finance+ read; insert
--                                                      permitted so audit
--                                                      writes from any auth
--                                                      session work
--    change_orders, daily_progress, inspections,
--    material_tracking, project_issues, stages        → project-scoped (read
--                                                      via has_project_access,
--                                                      write via
--                                                      can_write_project)
--    daily_progress_tasks                             → inherits via parent
--                                                      daily_progress
--    company_price_catalog                            → PM/finance+ write,
--                                                      any non-client read
-- =============================================================================


-- ── bank_reconciliation_entries (finance+) ──────────────────────────────────
ALTER TABLE public.bank_reconciliation_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bank_reconciliation_entries_select ON public.bank_reconciliation_entries;
DROP POLICY IF EXISTS bank_reconciliation_entries_write  ON public.bank_reconciliation_entries;

CREATE POLICY bank_reconciliation_entries_select ON public.bank_reconciliation_entries
  FOR SELECT TO authenticated
  USING (security.is_finance_or_up());

CREATE POLICY bank_reconciliation_entries_write ON public.bank_reconciliation_entries
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── cash_flow_entries (project-scoped read for PM/QS; finance+ write) ──────
ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_flow_entries_select ON public.cash_flow_entries;
DROP POLICY IF EXISTS cash_flow_entries_write  ON public.cash_flow_entries;

CREATE POLICY cash_flow_entries_select ON public.cash_flow_entries
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
    OR security.surveys_project(project_id)
  );

CREATE POLICY cash_flow_entries_write ON public.cash_flow_entries
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── change_orders (project-scoped) ─────────────────────────────────────────
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS change_orders_select ON public.change_orders;
DROP POLICY IF EXISTS change_orders_write  ON public.change_orders;

CREATE POLICY change_orders_select ON public.change_orders
  FOR SELECT TO authenticated
  USING (security.has_project_access(project_id));

-- Both finance+ and the assigned PM can propose/approve change orders.
CREATE POLICY change_orders_write ON public.change_orders
  FOR ALL TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
  )
  WITH CHECK (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
  );


-- ── company_price_catalog (vendor pricing — PM maintains, non-client read) ─
ALTER TABLE public.company_price_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_price_catalog_select ON public.company_price_catalog;
DROP POLICY IF EXISTS company_price_catalog_write  ON public.company_price_catalog;

-- Any authenticated non-client can read the catalog (needed by the PM
-- materials picker and finance tooling).
CREATE POLICY company_price_catalog_select ON public.company_price_catalog
  FOR SELECT TO authenticated
  USING (NOT security.is_client() OR security.is_manager_or_up());

CREATE POLICY company_price_catalog_write ON public.company_price_catalog
  FOR ALL TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.is_project_manager()
  )
  WITH CHECK (
    security.is_finance_or_up()
    OR security.is_project_manager()
  );


-- ── daily_progress (project-scoped) ────────────────────────────────────────
ALTER TABLE public.daily_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_progress_select ON public.daily_progress;
DROP POLICY IF EXISTS daily_progress_write  ON public.daily_progress;

CREATE POLICY daily_progress_select ON public.daily_progress
  FOR SELECT TO authenticated
  USING (security.has_project_access(project_id));

CREATE POLICY daily_progress_write ON public.daily_progress
  FOR ALL TO authenticated
  USING (security.can_write_project(project_id))
  WITH CHECK (security.can_write_project(project_id));


-- ── daily_progress_tasks (inherits from parent daily_progress) ─────────────
ALTER TABLE public.daily_progress_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_progress_tasks_select ON public.daily_progress_tasks;
DROP POLICY IF EXISTS daily_progress_tasks_write  ON public.daily_progress_tasks;

CREATE POLICY daily_progress_tasks_select ON public.daily_progress_tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_progress dp
      WHERE dp.id = daily_progress_tasks.daily_progress_id
        AND security.has_project_access(dp.project_id)
    )
  );

CREATE POLICY daily_progress_tasks_write ON public.daily_progress_tasks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_progress dp
      WHERE dp.id = daily_progress_tasks.daily_progress_id
        AND security.can_write_project(dp.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.daily_progress dp
      WHERE dp.id = daily_progress_tasks.daily_progress_id
        AND security.can_write_project(dp.project_id)
    )
  );


-- ── email_logs (finance+ read; audit inserts allowed from any auth) ────────
-- email_logs is an append-only audit trail. Read is finance+; inserts are
-- permitted from any authenticated session so backend audit helpers can
-- record outgoing emails without needing to run as service_role. No UPDATE
-- or DELETE — logs should be immutable.
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_logs_select ON public.email_logs;
DROP POLICY IF EXISTS email_logs_insert ON public.email_logs;

CREATE POLICY email_logs_select ON public.email_logs
  FOR SELECT TO authenticated
  USING (security.is_finance_or_up());

CREATE POLICY email_logs_insert ON public.email_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);


-- ── income_statement (finance+) ────────────────────────────────────────────
ALTER TABLE public.income_statement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS income_statement_select ON public.income_statement;
DROP POLICY IF EXISTS income_statement_write  ON public.income_statement;

CREATE POLICY income_statement_select ON public.income_statement
  FOR SELECT TO authenticated
  USING (security.is_finance_or_up());

CREATE POLICY income_statement_write ON public.income_statement
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── income_statement_line_items (finance+; inherit from parent) ────────────
ALTER TABLE public.income_statement_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS income_statement_line_items_select ON public.income_statement_line_items;
DROP POLICY IF EXISTS income_statement_line_items_write  ON public.income_statement_line_items;

CREATE POLICY income_statement_line_items_select ON public.income_statement_line_items
  FOR SELECT TO authenticated
  USING (security.is_finance_or_up());

CREATE POLICY income_statement_line_items_write ON public.income_statement_line_items
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── inspections (project-scoped) ───────────────────────────────────────────
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inspections_select ON public.inspections;
DROP POLICY IF EXISTS inspections_write  ON public.inspections;

CREATE POLICY inspections_select ON public.inspections
  FOR SELECT TO authenticated
  USING (security.has_project_access(project_id));

CREATE POLICY inspections_write ON public.inspections
  FOR ALL TO authenticated
  USING (security.can_write_project(project_id))
  WITH CHECK (security.can_write_project(project_id));


-- ── inventory_items (firm-wide — no project_id — finance+) ─────────────────
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_items_select ON public.inventory_items;
DROP POLICY IF EXISTS inventory_items_write  ON public.inventory_items;

CREATE POLICY inventory_items_select ON public.inventory_items
  FOR SELECT TO authenticated
  USING (security.is_finance_or_up());

CREATE POLICY inventory_items_write ON public.inventory_items
  FOR ALL TO authenticated
  USING (security.is_finance_or_up())
  WITH CHECK (security.is_finance_or_up());


-- ── material_tracking (project-scoped; PM writes) ──────────────────────────
ALTER TABLE public.material_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS material_tracking_select ON public.material_tracking;
DROP POLICY IF EXISTS material_tracking_write  ON public.material_tracking;

CREATE POLICY material_tracking_select ON public.material_tracking
  FOR SELECT TO authenticated
  USING (security.has_project_access(project_id));

CREATE POLICY material_tracking_write ON public.material_tracking
  FOR ALL TO authenticated
  USING (security.can_write_project(project_id))
  WITH CHECK (security.can_write_project(project_id));


-- ── project_issues (project-scoped) ────────────────────────────────────────
ALTER TABLE public.project_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_issues_select ON public.project_issues;
DROP POLICY IF EXISTS project_issues_write  ON public.project_issues;

CREATE POLICY project_issues_select ON public.project_issues
  FOR SELECT TO authenticated
  USING (security.has_project_access(project_id));

CREATE POLICY project_issues_write ON public.project_issues
  FOR ALL TO authenticated
  USING (security.can_write_project(project_id))
  WITH CHECK (security.can_write_project(project_id));


-- ── stages (project-scoped) ────────────────────────────────────────────────
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stages_select ON public.stages;
DROP POLICY IF EXISTS stages_write  ON public.stages;

CREATE POLICY stages_select ON public.stages
  FOR SELECT TO authenticated
  USING (security.has_project_access(project_id));

CREATE POLICY stages_write ON public.stages
  FOR ALL TO authenticated
  USING (security.can_write_project(project_id))
  WITH CHECK (security.can_write_project(project_id));
