-- ============================================================
-- Migration: create_statement_of_account
-- Creates the statement_of_account table from scratch.
-- Safe to run even if the table already exists (idempotent).
-- ============================================================


-- ── 1. ENUMs ─────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE soa_entry_status AS ENUM (
    'Outstanding',
    'Paid',
    'Overdue',
    'Partial',
    'Void'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE soa_entry_type AS ENUM (
    'Invoice',
    'Payment',
    'Credit Note',
    'Debit Note',
    'Retainer',
    'Adjustment'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── 2. Table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS statement_of_account (
  id               BIGSERIAL PRIMARY KEY,

  -- Foreign key to projects
  project_id       UUID          NOT NULL
                   REFERENCES projects (id) ON DELETE CASCADE,

  -- Entry classification
  entry_date       DATE          NOT NULL DEFAULT CURRENT_DATE,
  due_date         DATE,
  description      TEXT          NOT NULL,
  entry_type       soa_entry_type NOT NULL DEFAULT 'Invoice',
  account_code     TEXT,
  reference_no     TEXT,

  -- Financial amounts (all in KES)
  charges          NUMERIC(16, 2) NOT NULL DEFAULT 0,
    -- Debit: amount billed / invoiced to client
  credits          NUMERIC(16, 2) NOT NULL DEFAULT 0,
    -- Credit: payment received / credit note applied
  running_balance  NUMERIC(16, 2) NOT NULL DEFAULT 0,
    -- Computed: cumulative (sum of charges − sum of credits) up to this row
    -- Positive = amount owed by client; Negative = credit in client's favour.
    -- Maintained by trigger on INSERT/UPDATE/DELETE and by the edge function.

  -- Status tracking
  status           soa_entry_status NOT NULL DEFAULT 'Outstanding',

  -- Optional metadata
  notes            TEXT,

  -- Audit
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Column comments for documentation / audit trail
COMMENT ON COLUMN statement_of_account.charges
  IS 'Debit side: amount charged / invoiced (KES). Increases balance owed.';

COMMENT ON COLUMN statement_of_account.credits
  IS 'Credit side: payment received or credit applied (KES). Decreases balance owed.';

COMMENT ON COLUMN statement_of_account.running_balance
  IS 'Cumulative balance: positive = client owes money; negative = credit in client favour. Recomputed by trigger and edge function.';

COMMENT ON COLUMN statement_of_account.entry_type
  IS 'Invoice | Payment | Credit Note | Debit Note | Retainer | Adjustment';


-- ── 3. Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_soa_project_id
  ON statement_of_account (project_id);

CREATE INDEX IF NOT EXISTS idx_soa_entry_date
  ON statement_of_account (entry_date);

CREATE INDEX IF NOT EXISTS idx_soa_due_date
  ON statement_of_account (due_date);

CREATE INDEX IF NOT EXISTS idx_soa_status
  ON statement_of_account (status);

CREATE INDEX IF NOT EXISTS idx_soa_project_date
  ON statement_of_account (project_id, entry_date, id);
  -- Composite index used by running_balance recompute queries


-- ── 4. updated_at trigger ─────────────────────────────────────

-- Reuse the function created by payroll_checklist migration if it exists,
-- otherwise create it here.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_soa_updated_at ON statement_of_account;
CREATE TRIGGER trg_soa_updated_at
  BEFORE UPDATE ON statement_of_account
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 5. Running balance trigger ────────────────────────────────
-- Recomputes running_balance for all rows in the affected project
-- whenever a row is inserted, updated, or deleted.
-- This ensures the ledger is always consistent server-side.
--
-- For large projects (1000+ entries), prefer relying on the
-- edge function instead and remove this trigger to avoid
-- full-table scans on every mutation.

CREATE OR REPLACE FUNCTION recompute_soa_running_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  affected_project_id UUID;
  running              NUMERIC(16,2) := 0;
  rec                  RECORD;
BEGIN
  -- Determine which project was affected
  IF TG_OP = 'DELETE' THEN
    affected_project_id := OLD.project_id;
  ELSE
    affected_project_id := NEW.project_id;
  END IF;

  -- Walk all entries for the project in date + id order and recompute
  FOR rec IN
    SELECT id, charges, credits
    FROM statement_of_account
    WHERE project_id = affected_project_id
    ORDER BY entry_date ASC, id ASC
  LOOP
    running := running + COALESCE(rec.charges, 0) - COALESCE(rec.credits, 0);

    UPDATE statement_of_account
    SET    running_balance = ROUND(running, 2)
    WHERE  id = rec.id;
  END LOOP;

  -- For DELETE, we don't have a NEW row to return
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_soa_running_balance ON statement_of_account;
CREATE TRIGGER trg_soa_running_balance
  AFTER INSERT OR UPDATE OF charges, credits, entry_date OR DELETE
  ON statement_of_account
  FOR EACH ROW EXECUTE FUNCTION recompute_soa_running_balance();


-- ── 6. Auto-Overdue trigger ───────────────────────────────────
-- Automatically marks entries as Overdue when due_date has passed
-- and status is still Outstanding or Partial.
-- Runs on INSERT and UPDATE.

CREATE OR REPLACE FUNCTION auto_mark_overdue()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.due_date IS NOT NULL
     AND NEW.due_date < CURRENT_DATE
     AND NEW.status IN ('Outstanding', 'Partial')
  THEN
    NEW.status := 'Overdue';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_soa_auto_overdue ON statement_of_account;
CREATE TRIGGER trg_soa_auto_overdue
  BEFORE INSERT OR UPDATE ON statement_of_account
  FOR EACH ROW EXECUTE FUNCTION auto_mark_overdue();


-- ── 7. Row Level Security ─────────────────────────────────────

ALTER TABLE statement_of_account ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "soa_select" ON statement_of_account;
DROP POLICY IF EXISTS "soa_insert" ON statement_of_account;
DROP POLICY IF EXISTS "soa_update" ON statement_of_account;
DROP POLICY IF EXISTS "soa_delete" ON statement_of_account;

CREATE POLICY "soa_select" ON statement_of_account FOR SELECT USING (true);
CREATE POLICY "soa_insert" ON statement_of_account FOR INSERT WITH CHECK (true);
CREATE POLICY "soa_update" ON statement_of_account FOR UPDATE USING (true);
CREATE POLICY "soa_delete" ON statement_of_account FOR DELETE USING (true);


-- ── 8. Helpful view: soa_project_summary ─────────────────────
-- Per-project aggregation used by the project picker card badges.

CREATE OR REPLACE VIEW soa_project_summary AS
SELECT
  project_id,
  COUNT(*)                                          AS total_entries,
  COALESCE(SUM(charges),  0)                        AS total_charges,
  COALESCE(SUM(credits),  0)                        AS total_credits,
  COALESCE(SUM(charges) - SUM(credits), 0)          AS net_movement,
  -- Closing balance = running_balance of the last entry by date+id
  COALESCE((
    SELECT running_balance
    FROM   statement_of_account s2
    WHERE  s2.project_id = s.project_id
    ORDER  BY entry_date DESC, id DESC
    LIMIT  1
  ), 0)                                             AS closing_balance,
  COUNT(*) FILTER (WHERE status = 'Outstanding')    AS outstanding_count,
  COUNT(*) FILTER (WHERE status = 'Paid')           AS paid_count,
  COUNT(*) FILTER (WHERE status = 'Overdue')        AS overdue_count,
  COUNT(*) FILTER (WHERE status = 'Partial')        AS partial_count,
  COUNT(*) FILTER (WHERE status = 'Void')           AS void_count,
  COUNT(*) FILTER (
    WHERE due_date IS NOT NULL
    AND   due_date < CURRENT_DATE
    AND   status NOT IN ('Paid', 'Void')
  )                                                 AS past_due_count,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'Paid')::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                 AS paid_pct
FROM statement_of_account s
GROUP BY project_id;


-- ── 9. Seed data (optional — remove before production) ────────
-- Replace the project_id with a real UUID from your projects table.

-- INSERT INTO statement_of_account (
--   project_id, entry_date, due_date, description,
--   entry_type, account_code, reference_no,
--   charges, credits, status, notes
-- ) VALUES
-- (
--   'your-project-uuid-here',
--   '2026-01-15', '2026-02-15',
--   'Invoice #001 – Site Works Phase 1',
--   'Invoice', '1002', 'INV-001',
--   250000, 0, 'Outstanding',
--   'Phase 1 site preparation and foundation works'
-- ),
-- (
--   'your-project-uuid-here',
--   '2026-02-01', NULL,
--   'Payment received – INV-001 partial',
--   'Payment', '1002', 'REC-001',
--   0, 150000, 'Paid',
--   'Bank transfer received 01/02/2026'
-- ),
-- (
--   'your-project-uuid-here',
--   '2026-02-20', '2026-03-20',
--   'Retainer – March 2026',
--   'Retainer', '1001', 'RET-003',
--   50000, 0, 'Outstanding',
--   NULL
-- );
-- Running balances will be set automatically by the trigger.


-- ── 10. Verify final schema ───────────────────────────────────
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'statement_of_account'
ORDER BY ordinal_position;