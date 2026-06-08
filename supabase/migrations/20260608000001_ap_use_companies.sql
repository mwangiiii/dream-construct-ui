-- =============================================================================
--  ap_use_companies — use the existing companies table as the vendor master
--
--  Supersedes the dedicated vendors table (20260605000001_vendors.sql).
--  accounts_payable.vendor_id is re-pointed from vendors(id) → companies(id).
--
--  Rationale: companies already holds vendor/supplier records (name, legal_name,
--  tax_id, contact info). Reusing it avoids a duplicate master list and a
--  separate management UI.
--
--  Safe to re-run (IF EXISTS / idempotent guards).
-- =============================================================================


-- ── 1. Drop the old FK from accounts_payable → vendors ────────────────────────
-- The constraint was auto-named by the inline REFERENCES in the prior migration.

ALTER TABLE public.accounts_payable
  DROP CONSTRAINT IF EXISTS accounts_payable_vendor_id_fkey;


-- ── 2. Drop the now-superseded vendors table ──────────────────────────────────
-- It was created this session and is empty. CASCADE also clears any remaining
-- dependent objects (e.g. its FK to chart_of_accounts).

DROP TABLE IF EXISTS public.vendors CASCADE;
DROP TYPE  IF EXISTS public.vendor_category_enum;


-- ── 3. Re-point vendor_id to companies(id) ────────────────────────────────────
-- vendor_id stays as the column name (semantically "the vendor company").
-- No data exists yet, so the FK is validated immediately.

DO $$ BEGIN
  ALTER TABLE public.accounts_payable
    ADD CONSTRAINT accounts_payable_vendor_company_fkey
    FOREIGN KEY (vendor_id)
    REFERENCES public.companies (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 4. Comment ────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.accounts_payable.vendor_id IS
  'FK → companies.id. The vendor/supplier company for this payable. '
  'vendor_name is retained as a denormalised display copy.';
