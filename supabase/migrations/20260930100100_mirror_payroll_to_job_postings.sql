-- =============================================================================
--  Trigger: mirror payroll_checklist rows into job_postings
--
--  Every payroll entry with a project_id gets a corresponding read-only row
--  in job_postings so the Job Costing screen shows all costs tied to the job.
--  Row is tagged source='payroll' and FK payroll_id, so WIP knows to skip it
--  (see vw_project_cost_incurred).
--
--  Behaviour:
--    INSERT payroll (project_id NOT NULL) → INSERT mirror
--    INSERT payroll (project_id NULL)     → skip (firm-wide payroll, not
--                                            attributable to any project)
--    UPDATE payroll                       → UPSERT mirror; DELETE mirror if
--                                            project_id was cleared
--    DELETE payroll                       → CASCADE handles it (payroll_id FK
--                                            has ON DELETE CASCADE)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mirror_payroll_to_job_postings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Payroll rows with no project_id are firm-wide (e.g. HQ salaries). They
  -- have nothing to mirror to since job_postings.project_id is NOT NULL.
  IF TG_OP = 'INSERT' THEN
    IF NEW.project_id IS NOT NULL THEN
      INSERT INTO public.job_postings (
        project_id, phase, stage, description,
        account_code, etims_code,
        budgeted_amount_paid, actual_amount_used, profit_loss, amount,
        source, payroll_id
      ) VALUES (
        NEW.project_id, NULL, 'Payroll', 'Payroll: ' || NEW.employee_name,
        NULL, COALESCE(NEW.etims_code, ''),
        0, NEW.gross_pay, 0, NEW.gross_pay,
        'payroll', NEW.id
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- If project_id was cleared, drop any existing mirror.
    IF NEW.project_id IS NULL AND OLD.project_id IS NOT NULL THEN
      DELETE FROM public.job_postings WHERE payroll_id = OLD.id;
      RETURN NEW;
    END IF;

    -- If project_id is set (either newly or still), upsert the mirror.
    IF NEW.project_id IS NOT NULL THEN
      INSERT INTO public.job_postings (
        project_id, phase, stage, description,
        account_code, etims_code,
        budgeted_amount_paid, actual_amount_used, profit_loss, amount,
        source, payroll_id
      ) VALUES (
        NEW.project_id, NULL, 'Payroll', 'Payroll: ' || NEW.employee_name,
        NULL, COALESCE(NEW.etims_code, ''),
        0, NEW.gross_pay, 0, NEW.gross_pay,
        'payroll', NEW.id
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

DROP TRIGGER IF EXISTS trg_mirror_payroll_to_job_postings ON public.payroll_checklist;
CREATE TRIGGER trg_mirror_payroll_to_job_postings
  AFTER INSERT OR UPDATE ON public.payroll_checklist
  FOR EACH ROW EXECUTE FUNCTION public.mirror_payroll_to_job_postings();

-- ── Backfill: mirror every existing payroll_checklist row that has a project ──
INSERT INTO public.job_postings (
  project_id, phase, stage, description,
  account_code, etims_code,
  budgeted_amount_paid, actual_amount_used, profit_loss, amount,
  source, payroll_id
)
SELECT
  p.project_id, NULL, 'Payroll', 'Payroll: ' || p.employee_name,
  NULL, COALESCE(p.etims_code, ''),
  0, p.gross_pay, 0, p.gross_pay,
  'payroll', p.id
FROM public.payroll_checklist p
WHERE p.project_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.job_postings jp WHERE jp.payroll_id = p.id
  );

COMMENT ON FUNCTION public.mirror_payroll_to_job_postings() IS
  'Keeps job_postings in sync with payroll_checklist. Mirror rows carry '
  'source=''payroll'' + payroll_id FK and are excluded from WIP cost totals '
  '(WIP sums payroll_checklist directly). Firm-wide payroll (project_id NULL) '
  'is skipped.';
