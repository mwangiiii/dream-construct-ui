-- =============================================================================
--  vendors — centralised vendor master list
--  All modules that reference a vendor (AP, Inventory, etc.) pull from here.
--  Safe to run multiple times (idempotent guards throughout).
-- =============================================================================

-- ── 1. ENUM ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE vendor_category_enum AS ENUM (
    'Materials Supplier',
    'Subcontractor',
    'Professional Services',
    'Equipment & Plant',
    'Utility & Services',
    'Other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 2. TABLE ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendors (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name              TEXT          NOT NULL,
  kra_pin           TEXT,                        -- Kenya Revenue Authority PIN
  category          vendor_category_enum NOT NULL DEFAULT 'Other',

  -- Contact
  contact_name      TEXT,
  phone             TEXT,
  email             TEXT,
  address           TEXT,

  -- Default payment bank — FK to Chart of Accounts
  bank_account_code TEXT          REFERENCES public.chart_of_accounts(account_code)
                                    ON UPDATE CASCADE ON DELETE SET NULL,

  -- Status
  active            BOOLEAN       NOT NULL DEFAULT TRUE,
  notes             TEXT,

  -- Audit
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ── 3. CONSTRAINTS ────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.vendors ADD CONSTRAINT uq_vendor_name UNIQUE (name);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.vendors ADD CONSTRAINT uq_vendor_kra_pin UNIQUE (kra_pin);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 4. INDEXES ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_vendors_name              ON public.vendors (name);
CREATE INDEX IF NOT EXISTS idx_vendors_category          ON public.vendors (category);
CREATE INDEX IF NOT EXISTS idx_vendors_active            ON public.vendors (active);
CREATE INDEX IF NOT EXISTS idx_vendors_bank_account_code ON public.vendors (bank_account_code);

CREATE INDEX IF NOT EXISTS idx_vendors_fts ON public.vendors
  USING GIN (to_tsvector('english', name || ' ' || COALESCE(contact_name, '') || ' ' || COALESCE(kra_pin, '')));


-- ── 5. updated_at TRIGGER ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON public.vendors;
CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 6. ROW LEVEL SECURITY ─────────────────────────────────────────────────────

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendors_select" ON public.vendors;
DROP POLICY IF EXISTS "vendors_insert" ON public.vendors;
DROP POLICY IF EXISTS "vendors_update" ON public.vendors;
DROP POLICY IF EXISTS "vendors_delete" ON public.vendors;

CREATE POLICY "vendors_select" ON public.vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "vendors_insert" ON public.vendors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "vendors_update" ON public.vendors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "vendors_delete" ON public.vendors FOR DELETE TO authenticated USING (true);


-- ── 7. COMMENTS ───────────────────────────────────────────────────────────────

COMMENT ON TABLE  public.vendors                     IS 'Centralised vendor master list. All modules (AP, Inventory, etc.) reference vendors from here.';
COMMENT ON COLUMN public.vendors.kra_pin             IS 'Kenya Revenue Authority Personal Identification Number';
COMMENT ON COLUMN public.vendors.bank_account_code   IS 'Default payment bank account — FK to chart_of_accounts.account_code';
COMMENT ON COLUMN public.vendors.category            IS 'Vendor trade category: Materials Supplier | Subcontractor | Professional Services | Equipment & Plant | Utility & Services | Other';
