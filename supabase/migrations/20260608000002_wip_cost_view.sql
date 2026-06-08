-- =============================================================================
--  wip_cost_view — per-project cost-incurred aggregation for Work in Progress
--
--  Requirement: WIP cost_incurred = sum of all project-related costs, including
--  Accounts Payable (AP), Job Costs (JC), Petty Cash (PC), Taxes, and Loans.
--
--  Column choices (documented so an accountant can adjust):
--    ap_cost   = SUM(accounts_payable.total_amount)            — vendor invoices
--    job_cost  = SUM(job_postings.actual_amount_used)          — actual job costs
--    tax_cost  = SUM(tax_transactions.cash_out)                — tax cash disbursed
--    loan_cost = SUM(loans.interest_portion + fees_and_charges)— financing cost
--                 (principal repayment is excluded — it is not a P&L cost)
--    petty_cash= 0                                             — no petty_cash table
--                 exists yet (Petty Cash is only COA account 1020). Add here when
--                 a petty_cash table is introduced.
--
--  total_cost = ap_cost + job_cost + tax_cost + loan_cost
--
--  Consumed by the WIP module to auto-fill cost_incurred when a project is
--  selected. Safe to re-run (CREATE OR REPLACE).
-- =============================================================================

CREATE OR REPLACE VIEW public.vw_project_cost_incurred AS
WITH ap AS (
  SELECT project_id, COALESCE(SUM(total_amount), 0) AS ap_cost
  FROM public.accounts_payable
  GROUP BY project_id
),
jc AS (
  SELECT project_id, COALESCE(SUM(actual_amount_used), 0) AS job_cost
  FROM public.job_postings
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
)
SELECT
  p.id                                AS project_id,
  COALESCE(ap.ap_cost,   0)           AS ap_cost,
  COALESCE(jc.job_cost,  0)           AS job_cost,
  0::numeric                          AS petty_cash,
  COALESCE(tx.tax_cost,  0)           AS tax_cost,
  COALESCE(ln.loan_cost, 0)           AS loan_cost,
  COALESCE(ap.ap_cost,   0)
    + COALESCE(jc.job_cost,  0)
    + COALESCE(tx.tax_cost,  0)
    + COALESCE(ln.loan_cost, 0)       AS total_cost
FROM public.projects p
LEFT JOIN ap ON ap.project_id = p.id
LEFT JOIN jc ON jc.project_id = p.id
LEFT JOIN tx ON tx.project_id = p.id
LEFT JOIN ln ON ln.project_id = p.id;

COMMENT ON VIEW public.vw_project_cost_incurred IS
  'Per-project cost incurred for WIP: AP invoices + job costs + tax cash-out + loan '
  'financing cost. Petty cash is 0 until a petty_cash table exists. Consumed by the '
  'Work in Progress module to auto-fill cost_incurred.';
