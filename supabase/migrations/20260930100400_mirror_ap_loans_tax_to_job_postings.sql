-- =============================================================================
--  Mirror triggers: accounts_payable / loans / tax_transactions → job_postings
--
--  Same pattern as mirror_payroll_to_job_postings — each source-of-truth table
--  gets a display-only mirror row in job_postings so the Job Costing screen
--  presents a per-project ledger. WIP counts each cost exactly once at its
--  source table (see vw_project_cost_incurred) so the mirrors are excluded
--  from the totals.
--
--  Semantics per source:
--    accounts_payable  → amount = total_amount,                   category = 'vendor'
--    loans             → amount = interest_portion + fees_and_charges,
--                                                                 category = 'financing'
--    tax_transactions  → amount = cash_out,                       category = 'tax'
--
--  DELETE is handled by the ON DELETE CASCADE on each FK column.
-- =============================================================================


-- ── AP: accounts_payable → job_postings ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mirror_ap_to_job_postings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  desc_text text;
BEGIN
  desc_text := 'AP: ' || COALESCE(NEW.vendor_name, '')
             || CASE WHEN COALESCE(NEW.invoice_number, '') <> ''
                     THEN ' — Inv ' || NEW.invoice_number ELSE '' END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.job_postings (
      project_id, phase, stage, description,
      account_code, etims_code,
      budgeted_amount_paid, actual_amount_used, profit_loss, amount,
      source, cost_category, ap_invoice_id
    ) VALUES (
      NEW.project_id, NULL, 'Accounts Payable', desc_text,
      COALESCE(NEW.receiving_account_code, ''), COALESCE(NEW.etims_code, ''),
      0, NEW.total_amount, 0, NEW.total_amount,
      'ap', 'vendor', NEW.id
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.job_postings (
      project_id, phase, stage, description,
      account_code, etims_code,
      budgeted_amount_paid, actual_amount_used, profit_loss, amount,
      source, cost_category, ap_invoice_id
    ) VALUES (
      NEW.project_id, NULL, 'Accounts Payable', desc_text,
      COALESCE(NEW.receiving_account_code, ''), COALESCE(NEW.etims_code, ''),
      0, NEW.total_amount, 0, NEW.total_amount,
      'ap', 'vendor', NEW.id
    )
    ON CONFLICT (ap_invoice_id) WHERE ap_invoice_id IS NOT NULL
    DO UPDATE SET
      project_id         = EXCLUDED.project_id,
      description        = EXCLUDED.description,
      account_code       = EXCLUDED.account_code,
      etims_code         = EXCLUDED.etims_code,
      actual_amount_used = EXCLUDED.actual_amount_used,
      amount             = EXCLUDED.amount,
      updated_at         = NOW();
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_ap_to_job_postings ON public.accounts_payable;
CREATE TRIGGER trg_mirror_ap_to_job_postings
  AFTER INSERT OR UPDATE ON public.accounts_payable
  FOR EACH ROW EXECUTE FUNCTION public.mirror_ap_to_job_postings();


-- ── Loans → job_postings ────────────────────────────────────────────────────
-- WIP counts loan financing cost = interest_portion + fees_and_charges
-- (principal repayment is capital, not P&L). Mirror uses the same figure so
-- the Job Costing screen matches WIP.
CREATE OR REPLACE FUNCTION public.mirror_loan_to_job_postings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  cost_amt  numeric;
  desc_text text;
BEGIN
  cost_amt  := COALESCE(NEW.interest_portion, 0) + COALESCE(NEW.fees_and_charges, 0);
  desc_text := 'Loan: ' || COALESCE(NEW.lender_name, '')
             || CASE WHEN COALESCE(NEW.facility_ref, '') <> ''
                     THEN ' — ' || NEW.facility_ref ELSE '' END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.job_postings (
      project_id, phase, stage, description,
      account_code, etims_code,
      budgeted_amount_paid, actual_amount_used, profit_loss, amount,
      source, cost_category, loan_id
    ) VALUES (
      NEW.project_id, NULL, 'Loan Servicing', desc_text,
      NULL, '',
      0, cost_amt, 0, cost_amt,
      'loan', 'financing', NEW.id
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.job_postings (
      project_id, phase, stage, description,
      account_code, etims_code,
      budgeted_amount_paid, actual_amount_used, profit_loss, amount,
      source, cost_category, loan_id
    ) VALUES (
      NEW.project_id, NULL, 'Loan Servicing', desc_text,
      NULL, '',
      0, cost_amt, 0, cost_amt,
      'loan', 'financing', NEW.id
    )
    ON CONFLICT (loan_id) WHERE loan_id IS NOT NULL
    DO UPDATE SET
      project_id         = EXCLUDED.project_id,
      description        = EXCLUDED.description,
      actual_amount_used = EXCLUDED.actual_amount_used,
      amount             = EXCLUDED.amount,
      updated_at         = NOW();
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_loan_to_job_postings ON public.loans;
CREATE TRIGGER trg_mirror_loan_to_job_postings
  AFTER INSERT OR UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.mirror_loan_to_job_postings();


-- ── Taxes → job_postings ────────────────────────────────────────────────────
-- WIP counts tax cost = cash_out (cash actually disbursed for tax). Mirror
-- uses the same figure.
CREATE OR REPLACE FUNCTION public.mirror_tax_to_job_postings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  desc_text text;
BEGIN
  desc_text := 'Tax: ' || COALESCE(NEW.counter_party, '')
             || CASE WHEN COALESCE(NEW.ref_number, '') <> ''
                     THEN ' — Ref ' || NEW.ref_number ELSE '' END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.job_postings (
      project_id, phase, stage, description,
      account_code, etims_code,
      budgeted_amount_paid, actual_amount_used, profit_loss, amount,
      source, cost_category, tax_id
    ) VALUES (
      NEW.project_id, NULL, 'Tax', desc_text,
      NULL, '',
      0, COALESCE(NEW.cash_out, 0), 0, COALESCE(NEW.cash_out, 0),
      'tax', 'tax', NEW.id
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.job_postings (
      project_id, phase, stage, description,
      account_code, etims_code,
      budgeted_amount_paid, actual_amount_used, profit_loss, amount,
      source, cost_category, tax_id
    ) VALUES (
      NEW.project_id, NULL, 'Tax', desc_text,
      NULL, '',
      0, COALESCE(NEW.cash_out, 0), 0, COALESCE(NEW.cash_out, 0),
      'tax', 'tax', NEW.id
    )
    ON CONFLICT (tax_id) WHERE tax_id IS NOT NULL
    DO UPDATE SET
      project_id         = EXCLUDED.project_id,
      description        = EXCLUDED.description,
      actual_amount_used = EXCLUDED.actual_amount_used,
      amount             = EXCLUDED.amount,
      updated_at         = NOW();
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_tax_to_job_postings ON public.tax_transactions;
CREATE TRIGGER trg_mirror_tax_to_job_postings
  AFTER INSERT OR UPDATE ON public.tax_transactions
  FOR EACH ROW EXECUTE FUNCTION public.mirror_tax_to_job_postings();


-- ── Backfill: mirror every pre-existing AP / loan / tax row ─────────────────

-- AP backfill
INSERT INTO public.job_postings (
  project_id, phase, stage, description,
  account_code, etims_code,
  budgeted_amount_paid, actual_amount_used, profit_loss, amount,
  source, cost_category, ap_invoice_id
)
SELECT
  ap.project_id, NULL, 'Accounts Payable',
  'AP: ' || COALESCE(ap.vendor_name, '')
    || CASE WHEN COALESCE(ap.invoice_number, '') <> ''
            THEN ' — Inv ' || ap.invoice_number ELSE '' END,
  COALESCE(ap.receiving_account_code, ''), COALESCE(ap.etims_code, ''),
  0, ap.total_amount, 0, ap.total_amount,
  'ap', 'vendor', ap.id
FROM public.accounts_payable ap
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_postings jp WHERE jp.ap_invoice_id = ap.id
);

-- Loans backfill
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
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_postings jp WHERE jp.loan_id = ln.id
);

-- Tax backfill
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
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_postings jp WHERE jp.tax_id = tx.id
);

COMMENT ON FUNCTION public.mirror_ap_to_job_postings() IS
  'Keeps job_postings in sync with accounts_payable. Mirror rows carry '
  'source=''ap'', cost_category=''vendor'', ap_invoice_id FK. Excluded from '
  'WIP totals (WIP sums accounts_payable directly). DELETE cascades.';
COMMENT ON FUNCTION public.mirror_loan_to_job_postings() IS
  'Keeps job_postings in sync with loans. Mirrors the financing cost portion '
  '(interest_portion + fees_and_charges) since principal repayment is not a '
  'P&L expense. source=''loan'', cost_category=''financing''.';
COMMENT ON FUNCTION public.mirror_tax_to_job_postings() IS
  'Keeps job_postings in sync with tax_transactions. Mirrors cash_out. '
  'source=''tax'', cost_category=''tax''.';
