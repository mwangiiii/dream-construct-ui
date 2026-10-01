-- =============================================================================
--  job_postings — source tagging for WIP cost de-duplication
--
--  Problem: today a labour cost entered in `payroll_checklist` can also be
--  entered manually in `job_postings`, and WIP `cost_incurred` sums both,
--  double-counting the same expense.
--
--  Solution: `job_postings` becomes a per-project ledger view. Rows sourced
--  from another table (payroll, AP, loans, taxes) are MIRRORED here with a
--  `source` tag + FK to the source-of-truth row. WIP sums only source-of-truth
--  tables, so mirror rows are display-only and never double-count.
--
--  Manual rows (source='manual') remain the free-form Job Costing entries
--  and ARE counted by WIP.
--
--  Cascade: mirror rows are deleted automatically when the source-of-truth
--  row is deleted (ON DELETE CASCADE on each FK).
-- =============================================================================

-- ── 1. Add source-tagging + FK columns ──────────────────────────────────────
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS payroll_id    bigint REFERENCES public.payroll_checklist(id)   ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ap_invoice_id uuid   REFERENCES public.accounts_payable(id)    ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS loan_id       bigint REFERENCES public.loans(id)               ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tax_id        bigint REFERENCES public.tax_transactions(id)    ON DELETE CASCADE;

-- ── 2. Enforce allowed source values ────────────────────────────────────────
ALTER TABLE public.job_postings
  DROP CONSTRAINT IF EXISTS job_postings_source_check;
ALTER TABLE public.job_postings
  ADD  CONSTRAINT job_postings_source_check
       CHECK (source IN ('manual', 'payroll', 'ap', 'loan', 'tax'));

-- ── 3. Enforce source ↔ FK consistency ──────────────────────────────────────
-- Manual rows: all mirror FKs must be NULL.
-- Mirror rows: exactly the matching FK is set; the other three are NULL.
ALTER TABLE public.job_postings
  DROP CONSTRAINT IF EXISTS job_postings_source_fk_consistency;
ALTER TABLE public.job_postings
  ADD  CONSTRAINT job_postings_source_fk_consistency CHECK (
    (source = 'manual'
       AND payroll_id    IS NULL
       AND ap_invoice_id IS NULL
       AND loan_id       IS NULL
       AND tax_id        IS NULL)
    OR (source = 'payroll'
       AND payroll_id    IS NOT NULL
       AND ap_invoice_id IS NULL
       AND loan_id       IS NULL
       AND tax_id        IS NULL)
    OR (source = 'ap'
       AND ap_invoice_id IS NOT NULL
       AND payroll_id    IS NULL
       AND loan_id       IS NULL
       AND tax_id        IS NULL)
    OR (source = 'loan'
       AND loan_id       IS NOT NULL
       AND payroll_id    IS NULL
       AND ap_invoice_id IS NULL
       AND tax_id        IS NULL)
    OR (source = 'tax'
       AND tax_id        IS NOT NULL
       AND payroll_id    IS NULL
       AND ap_invoice_id IS NULL
       AND loan_id       IS NULL)
  );

-- ── 4. One mirror per source-of-truth row ───────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS job_postings_payroll_mirror_uidx
  ON public.job_postings(payroll_id)    WHERE payroll_id    IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS job_postings_ap_mirror_uidx
  ON public.job_postings(ap_invoice_id) WHERE ap_invoice_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS job_postings_loan_mirror_uidx
  ON public.job_postings(loan_id)       WHERE loan_id       IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS job_postings_tax_mirror_uidx
  ON public.job_postings(tax_id)        WHERE tax_id        IS NOT NULL;

-- ── 5. Index for WIP dedup lookups ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS job_postings_source_idx
  ON public.job_postings(source);
CREATE INDEX IF NOT EXISTS job_postings_project_source_idx
  ON public.job_postings(project_id, source);

-- ── 6. Relax phase-NOT-NULL: only manual rows need a phase ──────────────────
-- Mirror rows (payroll/AP/loan/tax) don't have a natural phase — the source
-- module doesn't track construction phase. Allow NULL for mirrors, still
-- require it for manual entries.
ALTER TABLE public.job_postings ALTER COLUMN phase DROP NOT NULL;

ALTER TABLE public.job_postings
  DROP CONSTRAINT IF EXISTS job_postings_phase_check;
ALTER TABLE public.job_postings
  ADD  CONSTRAINT job_postings_phase_check CHECK (
    phase IS NULL OR phase IN (
      'Mobilization','Excavation','Foundation',
      'Superstructure','Roofing','Finishes','Handover'
    )
  );

ALTER TABLE public.job_postings
  DROP CONSTRAINT IF EXISTS job_postings_manual_needs_phase;
ALTER TABLE public.job_postings
  ADD  CONSTRAINT job_postings_manual_needs_phase CHECK (
    source <> 'manual' OR phase IS NOT NULL
  );

-- ── 7. Comments ──────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.job_postings.source IS
  'Origin of this row. ''manual'' = free-form Job Costing entry (counted by WIP). '
  '''payroll''/''ap''/''loan''/''tax'' = mirror row auto-populated from the '
  'source-of-truth table; display-only, NOT counted by WIP (which sums the '
  'source table directly). Editing a mirror row must be done at its source module.';

COMMENT ON COLUMN public.job_postings.payroll_id IS
  'FK → payroll_checklist.id. Set only when source=''payroll''. Deleting the '
  'payroll row cascades to this mirror. Unique — at most one mirror per payroll row.';
