-- =============================================================================
--  job_posting_payroll_links — attach payroll checklist entries to a job
--  costing record.
--
--  A manual job costing row can nominate one or more payroll entries ("who do I
--  want to include in this record's labour cost"). The job costing screen then
--  shows a CONSOLIDATED actual:
--
--      consolidated = job_postings.actual_amount_used
--                   + SUM(linked payroll_checklist.gross_pay)
--
--  ── Why the payroll figure is NOT written into actual_amount_used ───────────
--  vw_project_cost_incurred computes
--
--      SUM(job_postings.actual_amount_used WHERE source='manual')
--    + SUM(payroll_checklist.gross_pay)
--    + ...
--
--  so folding linked gross_pay into actual_amount_used would count that labour
--  twice in WIP — precisely the double-count the source-tagged mirror design
--  was built to eliminate. Instead actual_amount_used stays purely manual, the
--  links live here, and the consolidation happens at read time. WIP continues
--  to count each wage exactly once, at payroll_checklist.
--
--  This table is additive: the existing payroll → job_postings mirror rows
--  (source='payroll') are left untouched and still appear in the "Linked from
--  other modules" panel.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.job_posting_payroll_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id  uuid   NOT NULL REFERENCES public.job_postings(id)      ON DELETE CASCADE,
  payroll_id      bigint NOT NULL REFERENCES public.payroll_checklist(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- One link per (record, employee entry). Re-selecting is idempotent.
  CONSTRAINT job_posting_payroll_links_unique UNIQUE (job_posting_id, payroll_id)
);

CREATE INDEX IF NOT EXISTS job_posting_payroll_links_posting_idx
  ON public.job_posting_payroll_links(job_posting_id);
CREATE INDEX IF NOT EXISTS job_posting_payroll_links_payroll_idx
  ON public.job_posting_payroll_links(payroll_id);


-- ── Guard: a link may only join rows on the SAME project ────────────────────
-- Without this, one project's wages could be attributed to another project's
-- job costing record, which would silently corrupt per-project labour cost.
-- A trigger is used rather than a CHECK because the comparison spans tables.
CREATE OR REPLACE FUNCTION public.job_posting_payroll_link_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  posting_project uuid;
  payroll_project uuid;
BEGIN
  SELECT project_id INTO posting_project
    FROM public.job_postings WHERE id = NEW.job_posting_id;

  SELECT project_id INTO payroll_project
    FROM public.payroll_checklist WHERE id = NEW.payroll_id;

  IF posting_project IS DISTINCT FROM payroll_project THEN
    RAISE EXCEPTION
      'payroll entry % belongs to project % but job costing record % belongs to project %',
      NEW.payroll_id, payroll_project, NEW.job_posting_id, posting_project
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_posting_payroll_link_guard ON public.job_posting_payroll_links;
CREATE TRIGGER trg_job_posting_payroll_link_guard
  BEFORE INSERT OR UPDATE ON public.job_posting_payroll_links
  FOR EACH ROW EXECUTE FUNCTION public.job_posting_payroll_link_guard();


-- ── RLS — mirrors job_postings ──────────────────────────────────────────────
-- Read for anyone with access to the parent project; write for PM+ / finance,
-- matching job_postings_write. Access is resolved through the parent job
-- costing row so the two can never disagree.
ALTER TABLE public.job_posting_payroll_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_posting_payroll_links_select ON public.job_posting_payroll_links;
DROP POLICY IF EXISTS job_posting_payroll_links_write  ON public.job_posting_payroll_links;

CREATE POLICY job_posting_payroll_links_select ON public.job_posting_payroll_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = job_posting_id
        AND (
          security.is_finance_or_up()
          OR security.manages_project(jp.project_id)
          OR security.surveys_project(jp.project_id)
        )
    )
  );

CREATE POLICY job_posting_payroll_links_write ON public.job_posting_payroll_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = job_posting_id
        AND (security.is_finance_or_up() OR security.manages_project(jp.project_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = job_posting_id
        AND (security.is_finance_or_up() OR security.manages_project(jp.project_id))
    )
  );


COMMENT ON TABLE public.job_posting_payroll_links IS
  'Many-to-many: which payroll_checklist entries a manual job costing record '
  'includes in its labour cost. Read-time consolidation only — the linked '
  'gross_pay is deliberately NOT added to job_postings.actual_amount_used, '
  'because vw_project_cost_incurred already sums payroll_checklist directly '
  'and doing so would double-count labour in WIP.';

COMMENT ON FUNCTION public.job_posting_payroll_link_guard() IS
  'Rejects links whose payroll entry and job costing record belong to '
  'different projects (NULL-safe via IS DISTINCT FROM).';
