-- =============================================================================
--  Mirror triggers must run as owner — fixes silently-blocked job_postings writes
--
--  20260930101200_rls_finance.sql added:
--
--    CREATE POLICY job_postings_write ON public.job_postings
--      FOR ALL TO authenticated
--      WITH CHECK ( (source = 'manual') AND (...) );
--
--  with a comment asserting that trigger inserts "pass because triggers run in
--  the transaction of the original insert". That is not how RLS works. A
--  plpgsql function declared SECURITY INVOKER (the default) executes as the
--  CALLING role, and RLS is re-evaluated against its own INSERT. A mirror row
--  carries source='payroll' / 'ap' / 'loan' / 'tax', so the WITH CHECK
--  evaluates false and the insert is rejected.
--
--  Because a trigger error aborts the whole statement, the symptom is that the
--  SOURCE write fails too: saving a payroll entry with a project_id set, or
--  assigning a project to an existing entry, errors out with
--  "new row violates row-level security policy for table job_postings".
--  Only writes made by service_role (edge functions, which bypass RLS) and the
--  historical backfills — which ran as the migration owner before the policy
--  existed — got through.
--
--  Fix: the four mirror functions become SECURITY DEFINER. They then execute as
--  the function owner, which owns job_postings and therefore bypasses RLS
--  (the table uses ENABLE, not FORCE, ROW LEVEL SECURITY). The
--  job_postings_write policy is deliberately left untouched, so a client still
--  cannot forge a mirror row by inserting into job_postings directly — the
--  belt-and-braces guard the original comment wanted is now actually true.
--
--  search_path is pinned on each function: a SECURITY DEFINER function with a
--  caller-controlled search_path is a privilege-escalation vector.
--
--  ALTER FUNCTION is used rather than CREATE OR REPLACE so that each body stays
--  exactly as its latest migration left it — in particular the commodity-name
--  lookup in mirror_ap_to_job_postings (20260930100600) and its standalone
--  project guard (20261123120000), neither of which should be restated here.
--
--  !! MAINTENANCE WARNING !!
--  CREATE OR REPLACE FUNCTION preserves ownership and grants but RESETS every
--  other property, including SECURITY DEFINER and search_path, to the values
--  implied by the new command. Any later migration that replaces one of these
--  four functions MUST restate:
--
--      SECURITY DEFINER
--      SET search_path = public, pg_temp
--
--  inside the CREATE OR REPLACE, or the mirror will start failing RLS again —
--  and it will fail loudly, taking the source module's write down with it.
-- =============================================================================


ALTER FUNCTION public.mirror_payroll_to_job_postings() SECURITY DEFINER;
ALTER FUNCTION public.mirror_payroll_to_job_postings() SET search_path = public, pg_temp;

ALTER FUNCTION public.mirror_ap_to_job_postings()      SECURITY DEFINER;
ALTER FUNCTION public.mirror_ap_to_job_postings()      SET search_path = public, pg_temp;

ALTER FUNCTION public.mirror_loan_to_job_postings()    SECURITY DEFINER;
ALTER FUNCTION public.mirror_loan_to_job_postings()    SET search_path = public, pg_temp;

ALTER FUNCTION public.mirror_tax_to_job_postings()     SECURITY DEFINER;
ALTER FUNCTION public.mirror_tax_to_job_postings()     SET search_path = public, pg_temp;


-- ── Safety-net backfill ─────────────────────────────────────────────────────
-- Expected to be a no-op in most cases: a blocked mirror insert rolled back its
-- source write too, so there should be no un-mirrored source row. It still
-- covers rows written by service_role (which bypasses RLS, so the source row
-- persisted) during the window the policy was broken. NOT EXISTS keeps it
-- idempotent and safe to re-run.

INSERT INTO public.job_postings (
  project_id, phase, stage, description,
  account_code, etims_code,
  budgeted_amount_paid, actual_amount_used, profit_loss, amount,
  source, cost_category, payroll_id
)
SELECT
  p.project_id, NULL, 'Payroll', 'Payroll: ' || p.employee_name,
  NULL, COALESCE(p.etims_code, ''),
  0, p.gross_pay, 0, p.gross_pay,
  'payroll', 'labour', p.id
FROM public.payroll_checklist p
WHERE p.project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.job_postings jp WHERE jp.payroll_id = p.id
  );

INSERT INTO public.job_postings (
  project_id, phase, stage, description,
  account_code, etims_code,
  budgeted_amount_paid, actual_amount_used, profit_loss, amount,
  source, cost_category, ap_invoice_id
)
SELECT
  ap.project_id, NULL, 'Accounts Payable',
  'AP: ' || COALESCE(ap.vendor_name, '')
    || CASE WHEN pf.material_name IS NOT NULL AND pf.material_name <> ''
            THEN ' → ' || pf.material_name ELSE '' END
    || CASE WHEN COALESCE(ap.invoice_number, '') <> ''
            THEN ' — Inv ' || ap.invoice_number ELSE '' END,
  COALESCE(ap.receiving_account_code, ''), COALESCE(ap.etims_code, ''),
  0, ap.total_amount, 0, ap.total_amount,
  'ap', 'vendor', ap.id
FROM public.accounts_payable ap
LEFT JOIN public.project_financials pf ON pf.id = ap.project_financial_id
WHERE ap.project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.job_postings jp WHERE jp.ap_invoice_id = ap.id
  );

INSERT INTO public.job_postings (
  project_id, phase, stage, description,
  account_code, etims_code,
  budgeted_amount_paid, actual_amount_used, profit_loss, amount,
  source, cost_category, loan_id
)
SELECT
  ln.project_id, NULL, 'Loan Servicing',
  'Loan: ' || COALESCE(ln.lender_name, '')
    || CASE WHEN COALESCE(ln.facility_ref, '') <> ''
            THEN ' — ' || ln.facility_ref ELSE '' END,
  NULL, '',
  0,
  COALESCE(ln.interest_portion, 0) + COALESCE(ln.fees_and_charges, 0),
  0,
  COALESCE(ln.interest_portion, 0) + COALESCE(ln.fees_and_charges, 0),
  'loan', 'financing', ln.id
FROM public.loans ln
WHERE ln.project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.job_postings jp WHERE jp.loan_id = ln.id
  );

INSERT INTO public.job_postings (
  project_id, phase, stage, description,
  account_code, etims_code,
  budgeted_amount_paid, actual_amount_used, profit_loss, amount,
  source, cost_category, tax_id
)
SELECT
  tx.project_id, NULL, 'Tax',
  'Tax: ' || COALESCE(tx.counter_party, '')
    || CASE WHEN COALESCE(tx.ref_number, '') <> ''
            THEN ' — Ref ' || tx.ref_number ELSE '' END,
  '', '',
  0, COALESCE(tx.cash_out, 0), 0, COALESCE(tx.cash_out, 0),
  'tax', 'tax', tx.id
FROM public.tax_transactions tx
WHERE tx.project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.job_postings jp WHERE jp.tax_id = tx.id
  );
