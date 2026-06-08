-- =============================================================================
--  payroll_checklist — full idempotent migration
--  Safe to run multiple times (CREATE TABLE IF NOT EXISTS / idempotent guards).
-- =============================================================================

-- ── 1. ENUMs ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE payroll_payment_status AS ENUM ('Paid', 'Unpaid', 'Pending', 'Overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payroll_rate_type AS ENUM ('Per Hour', 'Per Week', 'Per Month');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 2. TABLE ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_checklist (
  id               BIGSERIAL                  PRIMARY KEY,

  -- Project link (nullable — firm-wide payroll entries have no project)
  project_id       UUID                       REFERENCES public.projects(id)
                                                ON DELETE SET NULL,

  -- Worker link (nullable — allows manual name entry when worker not in system)
  worker_id        UUID                       REFERENCES public.workers(id)
                                                ON DELETE SET NULL,

  -- Identity
  job_id           TEXT                       NOT NULL DEFAULT '',
  employee_name    TEXT                       NOT NULL,

  -- Pay rate
  rate             NUMERIC(15, 2)             NOT NULL DEFAULT 0 CHECK (rate >= 0),
  rate_type        payroll_rate_type          NOT NULL DEFAULT 'Per Month',
  time_worked      TEXT                       NOT NULL DEFAULT '1 month',

  -- Gross pay
  gross_pay        NUMERIC(15, 2)             NOT NULL DEFAULT 0,

  -- Kenya-specific statutory deductions
  nssf_tier1       NUMERIC(15, 2)             NOT NULL DEFAULT 0,   -- Tier I NSSF
  nssf_tier2       NUMERIC(15, 2)             NOT NULL DEFAULT 0,   -- Tier II NSSF
  nssf_total       NUMERIC(15, 2)             NOT NULL DEFAULT 0,   -- nssf_tier1 + nssf_tier2
  shif             NUMERIC(15, 2)             NOT NULL DEFAULT 0,   -- Social Health Insurance Fund
  housing_levy     NUMERIC(15, 2)             NOT NULL DEFAULT 0,   -- Affordable Housing Levy (1.5%)
  pension          NUMERIC(15, 2)             NOT NULL DEFAULT 0,   -- Occupational pension contribution

  -- PAYE calculation
  taxable_income   NUMERIC(15, 2)             NOT NULL DEFAULT 0,
  paye_gross_tax   NUMERIC(15, 2)             NOT NULL DEFAULT 0,
  personal_relief  NUMERIC(15, 2)             NOT NULL DEFAULT 2400, -- KES 2,400 p/m
  insurance_relief NUMERIC(15, 2)             NOT NULL DEFAULT 0,
  paye_net         NUMERIC(15, 2)             NOT NULL DEFAULT 0,   -- paye_gross_tax - reliefs

  -- Totals
  total_deductions NUMERIC(15, 2)             NOT NULL DEFAULT 0,
  net_pay          NUMERIC(15, 2)             NOT NULL DEFAULT 0,

  -- Payment scheduling
  due_date         DATE,
  paid_date        DATE,
  payment_status   payroll_payment_status     NOT NULL DEFAULT 'Unpaid',

  -- Bank & reference (bank_code references chart_of_accounts.account_code)
  bank_code        TEXT,
  serial_no        TEXT,
  etims_code       TEXT,
  notes            TEXT,

  -- Audit
  created_at       TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ                NOT NULL DEFAULT NOW()
);


-- ── 3. INDEXES ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_payroll_project_id      ON public.payroll_checklist (project_id);
CREATE INDEX IF NOT EXISTS idx_payroll_worker_id       ON public.payroll_checklist (worker_id);
CREATE INDEX IF NOT EXISTS idx_payroll_payment_status  ON public.payroll_checklist (payment_status);
CREATE INDEX IF NOT EXISTS idx_payroll_due_date        ON public.payroll_checklist (due_date);
CREATE INDEX IF NOT EXISTS idx_payroll_bank_code       ON public.payroll_checklist (bank_code);


-- ── 4. updated_at TRIGGER ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payroll_updated_at ON public.payroll_checklist;
CREATE TRIGGER trg_payroll_updated_at
  BEFORE UPDATE ON public.payroll_checklist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 5. ROW LEVEL SECURITY ─────────────────────────────────────────────────────

ALTER TABLE public.payroll_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_select" ON public.payroll_checklist;
DROP POLICY IF EXISTS "payroll_insert" ON public.payroll_checklist;
DROP POLICY IF EXISTS "payroll_update" ON public.payroll_checklist;
DROP POLICY IF EXISTS "payroll_delete" ON public.payroll_checklist;

CREATE POLICY "payroll_select" ON public.payroll_checklist
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "payroll_insert" ON public.payroll_checklist
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "payroll_update" ON public.payroll_checklist
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "payroll_delete" ON public.payroll_checklist
  FOR DELETE TO authenticated USING (true);


-- ── 6. COMMENTS ───────────────────────────────────────────────────────────────

COMMENT ON TABLE  public.payroll_checklist             IS 'Employee payroll records with Kenya statutory deductions (NSSF, SHIF, PAYE, Housing Levy)';
COMMENT ON COLUMN public.payroll_checklist.bank_code   IS 'FK → chart_of_accounts.account_code; the bank account used for this salary payment';
COMMENT ON COLUMN public.payroll_checklist.nssf_total  IS 'nssf_tier1 + nssf_tier2 combined';
COMMENT ON COLUMN public.payroll_checklist.paye_net    IS 'PAYE after personal relief and insurance relief';
COMMENT ON COLUMN public.payroll_checklist.shif        IS 'Social Health Insurance Fund (formerly NHIF)';
COMMENT ON COLUMN public.payroll_checklist.housing_levy IS 'Affordable Housing Levy — 1.5% of gross pay';
