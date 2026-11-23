-- =============================================================================
--  accounts_payable — allow standalone (firm-wide) invoices, mirroring AR.
--
--  accounts_receivable.project_id has always been nullable so finance can post
--  firm-wide billings with no project counterpart. AP had no equivalent: office
--  rent, software subscriptions and other overhead payables had to be forced
--  onto an arbitrary project. This migration brings AP in line.
--
--  The commodity discipline from 20260930101500_ap_requires_pm_commodity.sql is
--  preserved for PROJECT-linked invoices: if project_id is set, the row still
--  needs a project_financials link (or the legacy grandfather flag). Only
--  project-less rows are exempt — a PM commodity belongs to a project, so a
--  standalone invoice has nothing to point at.
--
--  Existing rows are untouched: project_id was NOT NULL, so every current row
--  already carries a project and keeps it. Dropping NOT NULL orphans nothing.
--
--  RLS is deliberately left alone. security.manages_project(NULL) is not true,
--  so standalone rows resolve to finance/admin visibility only — the same
--  behaviour standalone AR already has, and what we want here.
-- =============================================================================


-- ── 1. project_id becomes optional ──────────────────────────────────────────
-- FK and ON DELETE CASCADE are unchanged; this only lifts the NOT NULL.
ALTER TABLE public.accounts_payable
  ALTER COLUMN project_id DROP NOT NULL;


-- ── 2. Commodity CHECK applies only to project-linked rows ──────────────────
ALTER TABLE public.accounts_payable
  DROP CONSTRAINT IF EXISTS ap_requires_pm_commodity;

ALTER TABLE public.accounts_payable
  ADD  CONSTRAINT ap_requires_pm_commodity CHECK (
    project_id IS NULL
    OR project_financial_id IS NOT NULL
    OR is_legacy_adhoc = true
  );


-- ── 3. Mirror trigger must skip project-less rows ───────────────────────────
-- job_postings.project_id is NOT NULL and job costing is a per-project ledger,
-- so a standalone invoice has no ledger to appear in. Without this guard the
-- mirror INSERT would fail and take the AP insert down with it.
--
-- The DELETE branch matters for re-scoping: moving an existing invoice from a
-- project to firm-wide has to retract the mirror row it already created,
-- otherwise job costing keeps showing a cost the invoice no longer claims.
--
-- The commodity-name lookup from 20260930100600_ap_mirror_commodity_description
-- is preserved verbatim — only the project_id guard is new.
CREATE OR REPLACE FUNCTION public.mirror_ap_to_job_postings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  desc_text      text;
  commodity_name text;
BEGIN
  IF NEW.project_id IS NULL THEN
    DELETE FROM public.job_postings WHERE ap_invoice_id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.project_financial_id IS NOT NULL THEN
    SELECT material_name INTO commodity_name
      FROM public.project_financials
      WHERE id = NEW.project_financial_id;
  END IF;

  desc_text := 'AP: ' || COALESCE(NEW.vendor_name, '')
             || CASE WHEN commodity_name IS NOT NULL AND commodity_name <> ''
                     THEN ' → ' || commodity_name ELSE '' END
             || CASE WHEN COALESCE(NEW.invoice_number, '') <> ''
                     THEN ' — Inv ' || NEW.invoice_number ELSE '' END;

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
END;
$$;


COMMENT ON CONSTRAINT ap_requires_pm_commodity ON public.accounts_payable IS
  'Project-linked AP invoices must link to a PM commodity row '
  '(project_financials); legacy orphans are grandfathered via '
  'is_legacy_adhoc=true. Standalone invoices (project_id IS NULL) are exempt '
  'because a commodity belongs to a project.';

COMMENT ON COLUMN public.accounts_payable.project_id IS
  'Nullable. NULL = standalone firm-wide payable (overhead, subscriptions) '
  'that is not attributable to a project — same model as '
  'accounts_receivable.project_id. Standalone rows are excluded from job '
  'costing mirrors and from vw_project_cost_incurred.';

COMMENT ON FUNCTION public.mirror_ap_to_job_postings() IS
  'Keeps job_postings in sync with accounts_payable. Mirror rows carry '
  'source=''ap'', cost_category=''vendor'', ap_invoice_id FK. Excluded from '
  'WIP totals (WIP sums accounts_payable directly). Standalone AP rows '
  '(project_id IS NULL) are not mirrored, and re-scoping a row to standalone '
  'deletes its existing mirror. DELETE cascades via the FK.';
