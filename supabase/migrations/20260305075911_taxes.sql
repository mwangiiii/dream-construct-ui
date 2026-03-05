-- ============================================================
-- Migration: create_tax_transactions
-- Full Kenya KRA-compliant tax ledger table.
-- Safe to run even if the table already exists (idempotent).
-- Replaces the old static taxesData structure with a fully
-- normalised, trigger-maintained, RLS-protected table.
-- ============================================================


-- ── 1. ENUMs ─────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE tax_transaction_type AS ENUM (
    'Invoice',
    'Payment',
    'Credit Note',
    'Debit Note',
    'Journal',
    'Receipt'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tax_deduction_category AS ENUM (
    'Statutory',
    'Contractual',
    'Voluntary',
    'Penalty'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tax_deduction_type AS ENUM (
    'PAYE',
    'WHT',
    'VAT',
    'NSSF',
    'SHIF',
    'AHL',
    'Other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── 2. Table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tax_transactions (
  id                   BIGSERIAL PRIMARY KEY,

  -- Project reference
  project_id           UUID                    NOT NULL
                       REFERENCES projects (id) ON DELETE CASCADE,

  -- ── Transaction Identity ───────────────────────────────────
  date                 DATE                    NOT NULL DEFAULT CURRENT_DATE,
  counter_party        TEXT                    NOT NULL,
    -- Name of the client, supplier or counterparty
  kra_pin              TEXT,
    -- KRA Personal Identification Number of counterparty (A123456789Z)
  transaction_type     tax_transaction_type    NOT NULL DEFAULT 'Invoice',
  ref_number           TEXT,
    -- Invoice / receipt / payment reference number
  description          TEXT                    NOT NULL,
  tax_period           TEXT                    NOT NULL DEFAULT '2026-Q1',
    -- Format: YYYY-QN e.g. 2026-Q1

  -- ── Gross Amount & VAT ─────────────────────────────────────
  gross_amount         NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- Tax-inclusive gross amount (KES)
  vat_rate             NUMERIC(5, 2)           NOT NULL DEFAULT 16,
    -- VAT rate applied (%) — standard 16%, reduced 8%, exempt 0%
  vat                  NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- VAT amount = gross - (gross / (1 + vat_rate/100))
  output_vat           NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- VAT charged on outgoing invoices (we are supplier)
  input_vat            NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- VAT paid on incoming invoices (we are buyer / claimable)
  net_amount           NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- gross_amount / (1 + vat_rate/100) — tax-exclusive amount

  -- ── Retention ──────────────────────────────────────────────
  retention_percentage NUMERIC(5, 2)           NOT NULL DEFAULT 0,
    -- Percentage of gross held as retention (usually 5–10%)
  retention_amount     NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- gross_amount * retention_percentage / 100

  -- ── Withholding Tax ────────────────────────────────────────
  wht_rate             NUMERIC(5, 2)           NOT NULL DEFAULT 0,
    -- WHT rate (%) per Income Tax Act s.35
    -- Professional services 5% · Management fees 5% · Rent 30%
    -- Royalties 5% · Interest 15% · Dividends 5%
  wht_amount           NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- net_amount * wht_rate / 100 — deducted at source by payer

  -- ── Statutory Deductions ───────────────────────────────────
  paye                 NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- Pay As You Earn income tax (KES) — from payroll module
  nssf                 NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- National Social Security Fund contribution (KES)
  shif                 NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- Social Health Insurance Fund (replaces NHIF, 2.75% of gross)
  housing_levy         NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- Affordable Housing Levy (1.5% of gross, Finance Act 2023)

  -- ── Deduction Metadata ─────────────────────────────────────
  deduction_category   tax_deduction_category  NOT NULL DEFAULT 'Statutory',
  allowable_deduction  BOOLEAN                 NOT NULL DEFAULT TRUE,
    -- Whether this deduction is allowable for income tax purposes
  deduction_type       tax_deduction_type      NOT NULL DEFAULT 'VAT',

  -- ── Capital / Asset ────────────────────────────────────────
  is_asset             BOOLEAN                 NOT NULL DEFAULT FALSE,
    -- True if this transaction relates to a capital asset
  capital_allowance    NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- Annual wear & tear / investment deduction (KES)
    -- Per Income Tax Act 2nd Schedule (e.g. plant 12.5%, computers 30%)

  -- ── Cash Flow ──────────────────────────────────────────────
  cash_in              NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- Net cash received: net_amount - wht_amount - retention_amount
  cash_out             NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- Cash disbursed (for payments / credit notes)
  running_balance      NUMERIC(16, 2)          NOT NULL DEFAULT 0,
    -- Cumulative cash_in - cash_out up to this row (date ordered)
    -- Maintained by trigger and edge function

  -- ── Metadata ───────────────────────────────────────────────
  notes                TEXT,
  created_at           TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

-- Column documentation
COMMENT ON COLUMN tax_transactions.vat_rate
  IS 'Kenya VAT rate: 16% standard (Finance Act), 8% (select supplies), 0% (exempt/zero-rated).';
COMMENT ON COLUMN tax_transactions.wht_rate
  IS 'WHT per Income Tax Act s.35: professional/management 5%, rent 30%, royalties 5%, interest 15%, dividends 5%.';
COMMENT ON COLUMN tax_transactions.shif
  IS 'Social Health Insurance Fund Act 2023 – 2.75% of gross, min KES 300. Replaces NHIF.';
COMMENT ON COLUMN tax_transactions.housing_levy
  IS 'Affordable Housing Levy – Finance Act 2023 – 1.5% of gross pay. No cap.';
COMMENT ON COLUMN tax_transactions.running_balance
  IS 'Cumulative (SUM cash_in - SUM cash_out) ordered by date ASC, id ASC. Recomputed by trigger.';
COMMENT ON COLUMN tax_transactions.capital_allowance
  IS 'Investment deduction / wear & tear per Income Tax Act 2nd Schedule. 0% if not an asset.';


-- ── 3. Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tax_project_id
  ON tax_transactions (project_id);

CREATE INDEX IF NOT EXISTS idx_tax_date
  ON tax_transactions (date);

CREATE INDEX IF NOT EXISTS idx_tax_period
  ON tax_transactions (tax_period);

CREATE INDEX IF NOT EXISTS idx_tax_transaction_type
  ON tax_transactions (transaction_type);

CREATE INDEX IF NOT EXISTS idx_tax_counter_party
  ON tax_transactions (counter_party);

CREATE INDEX IF NOT EXISTS idx_tax_kra_pin
  ON tax_transactions (kra_pin);

CREATE INDEX IF NOT EXISTS idx_tax_project_date
  ON tax_transactions (project_id, date, id);
  -- Composite for running_balance recompute scans


-- ── 4. updated_at trigger ─────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tax_updated_at ON tax_transactions;
CREATE TRIGGER trg_tax_updated_at
  BEFORE UPDATE ON tax_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 5. Running balance trigger ────────────────────────────────
-- Recomputes running_balance for all rows in the affected project
-- after any INSERT, UPDATE (of cash_in/cash_out/date), or DELETE.

CREATE OR REPLACE FUNCTION recompute_tax_running_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  affected_project_id UUID;
  running              NUMERIC(16, 2) := 0;
  rec                  RECORD;
BEGIN
  affected_project_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.project_id ELSE NEW.project_id END;

  FOR rec IN
    SELECT id, cash_in, cash_out
    FROM   tax_transactions
    WHERE  project_id = affected_project_id
    ORDER  BY date ASC, id ASC
  LOOP
    running := running + COALESCE(rec.cash_in, 0) - COALESCE(rec.cash_out, 0);
    UPDATE tax_transactions
    SET    running_balance = ROUND(running, 2)
    WHERE  id = rec.id;
  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_tax_running_balance ON tax_transactions;
CREATE TRIGGER trg_tax_running_balance
  AFTER INSERT OR UPDATE OF cash_in, cash_out, date OR DELETE
  ON tax_transactions
  FOR EACH ROW EXECUTE FUNCTION recompute_tax_running_balance();


-- ── 6. Auto-compute derived tax columns ──────────────────────
-- Before INSERT or UPDATE, automatically compute vat, net_amount,
-- wht_amount, retention_amount, cash_in, cash_out from the
-- gross_amount and rates, so the DB is always self-consistent
-- even if the application sends only the raw inputs.

CREATE OR REPLACE FUNCTION auto_compute_tax_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_net    NUMERIC(16, 2);
  v_vat    NUMERIC(16, 2);
BEGIN
  -- VAT (tax-inclusive breakdown)
  v_net  := ROUND(NEW.gross_amount / (1 + NEW.vat_rate / 100.0), 2);
  v_vat  := ROUND(NEW.gross_amount - v_net, 2);

  NEW.net_amount  := v_net;
  NEW.vat         := v_vat;

  -- Output VAT vs Input VAT by transaction direction
  IF NEW.transaction_type IN ('Invoice', 'Debit Note', 'Journal') THEN
    NEW.output_vat := v_vat;
    NEW.input_vat  := 0;
  ELSE
    NEW.output_vat := 0;
    NEW.input_vat  := v_vat;
  END IF;

  -- WHT on net amount
  NEW.wht_amount := ROUND(v_net * NEW.wht_rate / 100.0, 2);

  -- Retention on gross
  NEW.retention_amount := ROUND(NEW.gross_amount * NEW.retention_percentage / 100.0, 2);

  -- Cash flow
  IF NEW.transaction_type IN ('Invoice', 'Debit Note') THEN
    NEW.cash_in  := GREATEST(v_net - NEW.wht_amount - NEW.retention_amount, 0);
    NEW.cash_out := 0;
  ELSIF NEW.transaction_type IN ('Payment', 'Receipt', 'Credit Note') THEN
    NEW.cash_in  := 0;
    NEW.cash_out := v_net;
  ELSE -- Journal
    NEW.cash_in  := CASE WHEN v_net >= 0 THEN v_net ELSE 0 END;
    NEW.cash_out := CASE WHEN v_net < 0  THEN ABS(v_net) ELSE 0 END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tax_auto_compute ON tax_transactions;
CREATE TRIGGER trg_tax_auto_compute
  BEFORE INSERT OR UPDATE OF gross_amount, vat_rate, wht_rate, retention_percentage, transaction_type
  ON tax_transactions
  FOR EACH ROW EXECUTE FUNCTION auto_compute_tax_fields();


-- ── 7. Row Level Security ─────────────────────────────────────

ALTER TABLE tax_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tax_select" ON tax_transactions;
DROP POLICY IF EXISTS "tax_insert" ON tax_transactions;
DROP POLICY IF EXISTS "tax_update" ON tax_transactions;
DROP POLICY IF EXISTS "tax_delete" ON tax_transactions;

CREATE POLICY "tax_select" ON tax_transactions FOR SELECT USING (true);
CREATE POLICY "tax_insert" ON tax_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "tax_update" ON tax_transactions FOR UPDATE USING (true);
CREATE POLICY "tax_delete" ON tax_transactions FOR DELETE USING (true);


-- ── 8. KRA Summary View ───────────────────────────────────────
-- Aggregates per project and tax period — mirrors the KRA VAT3
-- and WHT return structure.

CREATE OR REPLACE VIEW tax_kra_summary AS
SELECT
  project_id,
  tax_period,
  COUNT(*)                                      AS total_entries,
  -- VAT position
  COALESCE(SUM(output_vat), 0)                  AS total_output_vat,
  COALESCE(SUM(input_vat), 0)                   AS total_input_vat,
  COALESCE(SUM(output_vat) - SUM(input_vat), 0) AS net_vat_payable,
  -- WHT
  COALESCE(SUM(wht_amount), 0)                  AS total_wht,
  -- Gross & Net
  COALESCE(SUM(gross_amount), 0)                AS total_gross,
  COALESCE(SUM(net_amount), 0)                  AS total_net,
  -- Statutory
  COALESCE(SUM(paye), 0)                        AS total_paye,
  COALESCE(SUM(nssf), 0)                        AS total_nssf,
  COALESCE(SUM(shif), 0)                        AS total_shif,
  COALESCE(SUM(housing_levy), 0)                AS total_housing_levy,
  -- Retention
  COALESCE(SUM(retention_amount), 0)            AS total_retention,
  -- Cash flow
  COALESCE(SUM(cash_in), 0)                     AS total_cash_in,
  COALESCE(SUM(cash_out), 0)                    AS total_cash_out,
  -- Capital
  COUNT(*) FILTER (WHERE is_asset = TRUE)       AS asset_count,
  COALESCE(SUM(capital_allowance), 0)           AS total_capital_allowance
FROM tax_transactions
GROUP BY project_id, tax_period
ORDER BY project_id, tax_period;


-- ── 9. Allowable Deductions View ─────────────────────────────
-- Lists only allowable deductions for income tax computation.

CREATE OR REPLACE VIEW tax_allowable_deductions AS
SELECT
  project_id,
  tax_period,
  deduction_category,
  deduction_type,
  COUNT(*)                                      AS entry_count,
  COALESCE(SUM(gross_amount), 0)                AS gross_total,
  COALESCE(SUM(net_amount), 0)                  AS net_total,
  COALESCE(SUM(capital_allowance), 0)           AS capital_allowance_total
FROM tax_transactions
WHERE allowable_deduction = TRUE
GROUP BY project_id, tax_period, deduction_category, deduction_type
ORDER BY project_id, tax_period, deduction_category;


-- ── 10. Verify schema ─────────────────────────────────────────
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tax_transactions'
ORDER BY ordinal_position;