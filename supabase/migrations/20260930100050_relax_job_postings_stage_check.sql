-- =============================================================================
--  Drop an unknown `job_postings_stage_check` CHECK constraint that was added
--  to the production DB outside of migrations (likely via Studio). It
--  restricts `stage` to a closed enum of construction values and rejects
--  the mirror-row stage labels used by our triggers:
--      'Payroll' · 'Accounts Payable' · 'Loan Servicing' · 'Tax'
--
--  `stage` is a free-text column (NOT NULL DEFAULT '') per the original
--  schema (20260307121901_job_postings.sql). Keep it that way so mirror
--  triggers can tag the source module without having to extend an enum.
-- =============================================================================

ALTER TABLE public.job_postings
  DROP CONSTRAINT IF EXISTS job_postings_stage_check;
