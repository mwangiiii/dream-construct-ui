-- =============================================================================
--  project_budget_view — revised project budget from approved change orders
--
--  Requirement: When a change order is approved, the project's budget summary
--  must reflect it. New Budget = Initial Budget + Approved Change Orders.
--  The adjustment counts ONLY change orders with approval = 'Approved'.
--
--  Design: the original projects.budget_numeric is NEVER mutated (it remains the
--  contract baseline). The revised budget is computed live by this view, so the
--  original is preserved and the revision is always consistent with the change
--  order records. Consumed by the Change Orders module and available to WIP /
--  Invoicing for revised-contract reporting.
--
--  Safe to re-run (CREATE OR REPLACE).
-- =============================================================================

CREATE OR REPLACE VIEW public.vw_project_budget AS
WITH co AS (
  SELECT
    project_id,
    COALESCE(SUM(added_cost) FILTER (WHERE approval = 'Approved'), 0) AS approved_changes,
    COALESCE(SUM(added_cost) FILTER (WHERE approval <> 'Approved'), 0) AS pending_changes,
    COUNT(*)                FILTER (WHERE approval = 'Approved')       AS approved_count,
    COUNT(*)                                                          AS change_order_count
  FROM public.change_orders
  GROUP BY project_id
)
SELECT
  p.id                                                              AS project_id,
  COALESCE(p.budget_numeric, 0)                                     AS original_budget,
  COALESCE(co.approved_changes, 0)                                  AS approved_changes,
  COALESCE(co.pending_changes, 0)                                   AS pending_changes,
  COALESCE(p.budget_numeric, 0) + COALESCE(co.approved_changes, 0)  AS revised_budget,
  COALESCE(co.approved_count, 0)                                    AS approved_count,
  COALESCE(co.change_order_count, 0)                                AS change_order_count
FROM public.projects p
LEFT JOIN co ON co.project_id = p.id;

COMMENT ON VIEW public.vw_project_budget IS
  'Per-project budget: original_budget (projects.budget_numeric, never mutated) + '
  'approved_changes (SUM of approved change_orders.added_cost) = revised_budget. '
  'pending_changes are not yet applied. Source of truth for revised contract value.';
