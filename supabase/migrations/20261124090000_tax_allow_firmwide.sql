-- =============================================================================
--  tax_transactions — allow firm-wide (project-less) entries.
--
--  The Taxes UI already ships a "Firm-wide Only" tab that filters on
--  `!e.project_id`, but tax_transactions.project_id was UUID NOT NULL, so no
--  row could ever satisfy it. The global tax modal compensated by seeding the
--  form with an empty string, which Postgres rejected outright:
--
--      invalid input syntax for type uuid: ""   (SQLSTATE 22P02)
--
--  making the global "New Entry" button fail with a 400 every time.
--
--  This brings tax into line with accounts_receivable and accounts_payable:
--  project_id is optional, NULL meaning a firm-wide entry (corporation tax,
--  PAYE on head-office staff, etc.) that is not attributable to a project.
--
--  Existing rows are untouched — project_id was NOT NULL, so every current row
--  already carries a project and keeps it.
--
--  RLS is left as-is. tax_transactions_select resolves to finance/admin only
--  when project_id IS NULL, which matches standalone AR and AP.
-- =============================================================================


-- ── 1. project_id becomes optional ──────────────────────────────────────────
-- FK and ON DELETE CASCADE unchanged; this only lifts the NOT NULL.
ALTER TABLE public.tax_transactions
  ALTER COLUMN project_id DROP NOT NULL;


-- ── 2. Mirror trigger must skip project-less rows ───────────────────────────
-- job_postings.project_id is NOT NULL and job costing is a per-project ledger,
-- so a firm-wide tax entry has no ledger to appear in. Without this guard the
-- mirror INSERT would fail and take the tax insert down with it.
--
-- The DELETE branch handles re-scoping: moving an existing entry from a project
-- to firm-wide retracts the mirror row it already created.
--
-- SECURITY DEFINER and search_path are restated deliberately. CREATE OR REPLACE
-- resets both, and without them this function hits the job_postings_write
-- policy (source='manual') — the exact defect fixed in
-- 20261123130000_mirror_triggers_security_definer.sql.
CREATE OR REPLACE FUNCTION public.mirror_tax_to_job_postings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  desc_text text;
BEGIN
  IF NEW.project_id IS NULL THEN
    DELETE FROM public.job_postings WHERE tax_id = NEW.id;
    RETURN NEW;
  END IF;

  desc_text := 'Tax: ' || COALESCE(NEW.counter_party, '')
             || CASE WHEN COALESCE(NEW.ref_number, '') <> ''
                     THEN ' — Ref ' || NEW.ref_number ELSE '' END;

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
END;
$$;


COMMENT ON COLUMN public.tax_transactions.project_id IS
  'Nullable. NULL = firm-wide tax entry not attributable to a project — same '
  'model as accounts_receivable.project_id and accounts_payable.project_id. '
  'Firm-wide rows are excluded from job costing mirrors and from '
  'vw_project_cost_incurred.';

COMMENT ON FUNCTION public.mirror_tax_to_job_postings() IS
  'Keeps job_postings in sync with tax_transactions. Mirror rows carry '
  'source=''tax'', cost_category=''tax'', tax_id FK. Excluded from WIP totals '
  '(WIP sums tax_transactions directly). Firm-wide rows (project_id IS NULL) '
  'are not mirrored, and re-scoping a row to firm-wide deletes its existing '
  'mirror. SECURITY DEFINER so the insert is not blocked by job_postings_write.';
