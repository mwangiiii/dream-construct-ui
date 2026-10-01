-- =============================================================================
--  job_postings — cost_category hard guard
--
--  Purpose: prevent labour from being typed as a manual job costing row.
--  Payroll is the ONLY source-of-truth for labour cost; every other module
--  writes through its own dedicated table and mirrors to job_postings.
--
--  Rules (enforced at the DB):
--    source = 'manual'  → cost_category ∈ {materials, equipment, subcontractor, overhead, other}
--    source = 'payroll' → cost_category = 'labour'
--    source = 'ap'      → cost_category = 'vendor'
--    source = 'loan'    → cost_category = 'financing'
--    source = 'tax'     → cost_category = 'tax'
--
--  With these categories fixed per source, WIP can already be broken down by
--  category for reporting without additional joins.
-- =============================================================================

-- ── 1. Column + default ─────────────────────────────────────────────────────
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS cost_category text NOT NULL DEFAULT 'other';

-- ── 2. Backfill existing rows ───────────────────────────────────────────────
-- Manual rows: no way to know the true category retroactively — mark 'other'.
UPDATE public.job_postings SET cost_category = 'other'    WHERE source = 'manual'  AND cost_category = 'other';
UPDATE public.job_postings SET cost_category = 'labour'   WHERE source = 'payroll';
UPDATE public.job_postings SET cost_category = 'vendor'   WHERE source = 'ap';
UPDATE public.job_postings SET cost_category = 'financing'WHERE source = 'loan';
UPDATE public.job_postings SET cost_category = 'tax'      WHERE source = 'tax';

-- ── 3. Enforce category × source consistency ────────────────────────────────
ALTER TABLE public.job_postings
  DROP CONSTRAINT IF EXISTS job_postings_category_source_check;
ALTER TABLE public.job_postings
  ADD  CONSTRAINT job_postings_category_source_check CHECK (
    (source = 'manual'
       AND cost_category IN ('materials', 'equipment', 'subcontractor', 'overhead', 'other'))
    OR (source = 'payroll' AND cost_category = 'labour')
    OR (source = 'ap'      AND cost_category = 'vendor')
    OR (source = 'loan'    AND cost_category = 'financing')
    OR (source = 'tax'     AND cost_category = 'tax')
  );

CREATE INDEX IF NOT EXISTS job_postings_cost_category_idx
  ON public.job_postings(cost_category);

-- ── 4. Update payroll mirror trigger to set cost_category='labour' ──────────
CREATE OR REPLACE FUNCTION public.mirror_payroll_to_job_postings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.project_id IS NOT NULL THEN
      INSERT INTO public.job_postings (
        project_id, phase, stage, description,
        account_code, etims_code,
        budgeted_amount_paid, actual_amount_used, profit_loss, amount,
        source, cost_category, payroll_id
      ) VALUES (
        NEW.project_id, NULL, 'Payroll', 'Payroll: ' || NEW.employee_name,
        '', COALESCE(NEW.etims_code, ''),
        0, NEW.gross_pay, 0, NEW.gross_pay,
        'payroll', 'labour', NEW.id
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.project_id IS NULL AND OLD.project_id IS NOT NULL THEN
      DELETE FROM public.job_postings WHERE payroll_id = OLD.id;
      RETURN NEW;
    END IF;

    IF NEW.project_id IS NOT NULL THEN
      INSERT INTO public.job_postings (
        project_id, phase, stage, description,
        account_code, etims_code,
        budgeted_amount_paid, actual_amount_used, profit_loss, amount,
        source, cost_category, payroll_id
      ) VALUES (
        NEW.project_id, NULL, 'Payroll', 'Payroll: ' || NEW.employee_name,
        '', COALESCE(NEW.etims_code, ''),
        0, NEW.gross_pay, 0, NEW.gross_pay,
        'payroll', 'labour', NEW.id
      )
      ON CONFLICT (payroll_id) WHERE payroll_id IS NOT NULL
      DO UPDATE SET
        project_id         = EXCLUDED.project_id,
        description        = EXCLUDED.description,
        etims_code         = EXCLUDED.etims_code,
        actual_amount_used = EXCLUDED.actual_amount_used,
        amount             = EXCLUDED.amount,
        updated_at         = NOW();
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON COLUMN public.job_postings.cost_category IS
  'Cost classification used for reporting and for the manual-labour hard guard. '
  'Manual entries are restricted to {materials, equipment, subcontractor, '
  'overhead, other} — labour cannot be typed manually here; it must be '
  'entered in payroll_checklist, which mirrors as source=''payroll'' + '
  'cost_category=''labour''.';
