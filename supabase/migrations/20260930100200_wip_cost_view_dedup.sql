-- =============================================================================
--  vw_project_cost_incurred — rewrite for de-duplication + payroll inclusion
--
--  Corrects two problems in the previous view:
--    1. It summed ALL job_postings rows, so once mirror rows (source != 'manual')
--       exist they would double-count against their source-of-truth table.
--    2. It omitted payroll_checklist entirely, so labour cost was silently
--       missing from WIP / Invoice / Statement of Account.
--
--  New rule: each cost is counted exactly once, at its source-of-truth table.
--    ap_cost      = SUM(accounts_payable.total_amount)
--    job_cost     = SUM(job_postings.actual_amount_used)  WHERE source='manual'
--    tax_cost     = SUM(tax_transactions.cash_out)
--    loan_cost    = SUM(loans.interest_portion + fees_and_charges)
--    payroll_cost = SUM(payroll_checklist.gross_pay)      (NEW)
--    total_cost   = ap + manual_jc + tax + loan + payroll
-- =============================================================================

CREATE OR REPLACE VIEW public.vw_project_cost_incurred AS
WITH ap AS (
  SELECT project_id, COALESCE(SUM(total_amount), 0) AS ap_cost
  FROM public.accounts_payable
  GROUP BY project_id
),
jc AS (
  -- Only manual entries. Mirror rows (source in payroll/ap/loan/tax) are
  -- display-only; the underlying source table contributes them below.
  SELECT project_id, COALESCE(SUM(actual_amount_used), 0) AS job_cost
  FROM public.job_postings
  WHERE source = 'manual'
  GROUP BY project_id
),
tx AS (
  SELECT project_id, COALESCE(SUM(cash_out), 0) AS tax_cost
  FROM public.tax_transactions
  GROUP BY project_id
),
ln AS (
  SELECT project_id, COALESCE(SUM(interest_portion + fees_and_charges), 0) AS loan_cost
  FROM public.loans
  GROUP BY project_id
),
pr AS (
  SELECT project_id, COALESCE(SUM(gross_pay), 0) AS payroll_cost
  FROM public.payroll_checklist
  WHERE project_id IS NOT NULL
  GROUP BY project_id
)
SELECT
  p.id                                AS project_id,
  COALESCE(ap.ap_cost,      0)        AS ap_cost,
  COALESCE(jc.job_cost,     0)        AS job_cost,
  0::numeric                          AS petty_cash,
  COALESCE(tx.tax_cost,     0)        AS tax_cost,
  COALESCE(ln.loan_cost,    0)        AS loan_cost,
  COALESCE(pr.payroll_cost, 0)        AS payroll_cost,
  COALESCE(ap.ap_cost,      0)
    + COALESCE(jc.job_cost,     0)
    + COALESCE(tx.tax_cost,     0)
    + COALESCE(ln.loan_cost,    0)
    + COALESCE(pr.payroll_cost, 0)    AS total_cost
FROM public.projects p
LEFT JOIN ap ON ap.project_id = p.id
LEFT JOIN jc ON jc.project_id = p.id
LEFT JOIN tx ON tx.project_id = p.id
LEFT JOIN ln ON ln.project_id = p.id
LEFT JOIN pr ON pr.project_id = p.id;

COMMENT ON VIEW public.vw_project_cost_incurred IS
  'Per-project cost incurred, de-duplicated. Sums each cost exactly once at '
  'its source-of-truth table: AP + manual Job Costing + Tax + Loans + Payroll. '
  'Mirror rows in job_postings (source != ''manual'') are excluded because '
  'their underlying source table is already summed.';
