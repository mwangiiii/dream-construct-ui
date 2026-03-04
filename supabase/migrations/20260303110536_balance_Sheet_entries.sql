-- =============================================================================
--  balance_sheet_entries — full idempotent migration
--  Paste entire file into: Supabase Dashboard → SQL Editor → Run
-- =============================================================================

-- ── 1. TABLE ──────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.balance_sheet_entries CASCADE;

CREATE TABLE public.balance_sheet_entries (
  id               BIGSERIAL     PRIMARY KEY,

  -- Project link
  project_id       UUID          NOT NULL
                   REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Classification
  entry_type       TEXT          NOT NULL
                   CHECK (entry_type IN ('Asset', 'Liability', 'Equity')),

  asset_type       TEXT          CHECK (asset_type IN (
                     'Current Asset', 'Fixed Asset', 'Other Asset'
                   )),
  liability_type   TEXT          CHECK (liability_type IN (
                     'Current Liability', 'Long-term Liability'
                   )),
  equity_type      TEXT          CHECK (equity_type IN (
                     'Owner''s Capital', 'Retained Earnings', 'Shareholder Equity'
                   )),

  -- Entry data
  account_name     VARCHAR(255)  NOT NULL,
  description      TEXT,
  amount           NUMERIC(18,2) NOT NULL DEFAULT 0
                   CHECK (amount >= 0),
  entry_date       DATE          NOT NULL DEFAULT CURRENT_DATE,
  reference_code   VARCHAR(50),
  notes            TEXT,

  -- Audit
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by       UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by       UUID          REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Ensure sub-type aligns with entry_type
  CONSTRAINT chk_asset_subtype
    CHECK (entry_type != 'Asset'     OR asset_type     IS NOT NULL),
  CONSTRAINT chk_liability_subtype
    CHECK (entry_type != 'Liability' OR liability_type IS NOT NULL),
  CONSTRAINT chk_equity_subtype
    CHECK (entry_type != 'Equity'    OR equity_type    IS NOT NULL)
);


-- ── 2. INDEXES ────────────────────────────────────────────────────────────────

CREATE INDEX idx_bse_project_id  ON public.balance_sheet_entries (project_id);
CREATE INDEX idx_bse_entry_type  ON public.balance_sheet_entries (entry_type);
CREATE INDEX idx_bse_entry_date  ON public.balance_sheet_entries (entry_date DESC);


-- ── 3. updated_at TRIGGER ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bse_updated_at ON public.balance_sheet_entries;
CREATE TRIGGER trg_bse_updated_at
  BEFORE UPDATE ON public.balance_sheet_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 4. ROW LEVEL SECURITY ─────────────────────────────────────────────────────

ALTER TABLE public.balance_sheet_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bse_select" ON public.balance_sheet_entries;
DROP POLICY IF EXISTS "bse_insert" ON public.balance_sheet_entries;
DROP POLICY IF EXISTS "bse_update" ON public.balance_sheet_entries;
DROP POLICY IF EXISTS "bse_delete" ON public.balance_sheet_entries;

CREATE POLICY "bse_select" ON public.balance_sheet_entries FOR SELECT USING (true);
CREATE POLICY "bse_insert" ON public.balance_sheet_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "bse_update" ON public.balance_sheet_entries FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "bse_delete" ON public.balance_sheet_entries FOR DELETE USING (true);


-- ── 5. SUMMARY VIEW ───────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.vw_balance_sheet_summary AS
SELECT
  project_id,
  entry_type,
  COUNT(*)           AS entry_count,
  SUM(amount)        AS total_amount,
  MIN(entry_date)    AS earliest_date,
  MAX(entry_date)    AS latest_date
FROM public.balance_sheet_entries
GROUP BY project_id, entry_type;


-- ── 6. GRANTS ─────────────────────────────────────────────────────────────────

GRANT ALL ON public.balance_sheet_entries           TO anon, authenticated, service_role;
GRANT ALL ON public.balance_sheet_entries_id_seq    TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_balance_sheet_summary     TO anon, authenticated, service_role;


-- ── 7. COMMENTS ───────────────────────────────────────────────────────────────

COMMENT ON TABLE  public.balance_sheet_entries            IS 'Balance sheet entries per project: Assets, Liabilities, Equity';
COMMENT ON COLUMN public.balance_sheet_entries.entry_type IS 'Asset | Liability | Equity';
COMMENT ON COLUMN public.balance_sheet_entries.amount     IS 'Non-negative monetary value in USD';
COMMENT ON COLUMN public.balance_sheet_entries.entry_date IS 'The date this entry is effective (accounting date)';