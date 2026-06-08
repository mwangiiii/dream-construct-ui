-- =============================================================================
--  ap_vendor_id — link accounts_payable to the vendors master table
--  Depends on: vendors table (20260605000001_vendors.sql)
--  Safe to run multiple times (idempotent guards).
-- =============================================================================

-- ── 1. Add vendor_id column ───────────────────────────────────────────────────

ALTER TABLE public.accounts_payable
  ADD COLUMN IF NOT EXISTS vendor_id UUID
    REFERENCES public.vendors(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;


-- ── 2. Index ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ap_vendor_id ON public.accounts_payable (vendor_id);


-- ── 3. Comment ────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.accounts_payable.vendor_id IS
  'FK → vendors.id. Links this AP record to the vendor master list. '
  'vendor_name is retained for display and backward compatibility.';
