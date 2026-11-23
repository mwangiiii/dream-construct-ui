-- =============================================================================
--  Fix Supabase linter 0010_security_definer_view on 15 public views.
--
--  A Postgres view executes with the privileges of its OWNER unless
--  security_invoker is set. Because these views are owned by postgres, every
--  query through them bypasses the RLS of the calling user and returns rows the
--  caller could not read directly. All the per-project finance work in the
--  20260930101* migrations is therefore sidesteppable by selecting from a view
--  instead of the table.
--
--  Setting security_invoker = on makes each view enforce the querying user's
--  RLS against the underlying tables, which is what the policies already
--  express. No view body changes.
--
--  Five of these views (storage_health_monitor, project_financial_summary,
--  pending_orders, approved_orders_awaiting_funds, payroll_summary) exist in
--  the database but have no CREATE in supabase/migrations — they were made
--  directly in the SQL editor. The loop below skips anything absent rather than
--  aborting, so this migration is safe on any environment.
-- =============================================================================

DO $$
DECLARE
  v text;
  targets text[] := ARRAY[
    'storage_health_monitor',
    'vw_balance_sheet_summary',
    'project_financial_summary',
    'vw_chart_of_accounts_summary',
    'pending_orders',
    'approved_orders_awaiting_funds',
    'payroll_summary',
    'soa_project_summary',
    'tax_kra_summary',
    'tax_allowable_deductions',
    'vw_project_ar_summary',
    'vw_project_budget',
    'vw_project_cost_incurred',
    'vw_boq_progress',
    'vw_inventory_consumption'
  ];
BEGIN
  FOREACH v IN ARRAY targets LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = v
        AND c.relkind = 'v'
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v);
      RAISE NOTICE 'security_invoker enabled on public.%', v;
    ELSE
      RAISE NOTICE 'skipped (not a view in public): %', v;
    END IF;
  END LOOP;
END $$;
