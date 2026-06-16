-- =============================================================================
--  bse_align_with_coa — let balance_sheet_entries accept COA-style sub-types
--
--  The Balance Sheet entry form now lets the user pick an account from the
--  Chart of Accounts. COA uses the canonical names "Non-Current Asset",
--  "Non-Current Liability", and "Owner's Equity"; the original
--  balance_sheet_entries CHECK constraints used the older "Fixed Asset",
--  "Long-term Liability", and "Owner's Capital" wording.
--
--  This migration relaxes the constraints to accept BOTH spellings so
--  existing rows stay valid AND new COA-aligned entries can be saved.
--
--  Idempotent.
-- =============================================================================

-- The original constraints were declared inline in the CREATE TABLE so they
-- received auto-generated names. Drop whichever is present, then add the new
-- wider constraints under predictable names.

ALTER TABLE public.balance_sheet_entries
  DROP CONSTRAINT IF EXISTS balance_sheet_entries_asset_type_check;
ALTER TABLE public.balance_sheet_entries
  DROP CONSTRAINT IF EXISTS bse_asset_type_check;

ALTER TABLE public.balance_sheet_entries
  ADD CONSTRAINT bse_asset_type_check
  CHECK (asset_type IS NULL OR asset_type IN (
    'Current Asset',
    'Fixed Asset',
    'Non-Current Asset',
    'Other Asset'
  ));


ALTER TABLE public.balance_sheet_entries
  DROP CONSTRAINT IF EXISTS balance_sheet_entries_liability_type_check;
ALTER TABLE public.balance_sheet_entries
  DROP CONSTRAINT IF EXISTS bse_liability_type_check;

ALTER TABLE public.balance_sheet_entries
  ADD CONSTRAINT bse_liability_type_check
  CHECK (liability_type IS NULL OR liability_type IN (
    'Current Liability',
    'Long-term Liability',
    'Non-Current Liability'
  ));


ALTER TABLE public.balance_sheet_entries
  DROP CONSTRAINT IF EXISTS balance_sheet_entries_equity_type_check;
ALTER TABLE public.balance_sheet_entries
  DROP CONSTRAINT IF EXISTS bse_equity_type_check;

ALTER TABLE public.balance_sheet_entries
  ADD CONSTRAINT bse_equity_type_check
  CHECK (equity_type IS NULL OR equity_type IN (
    'Owner''s Capital',
    'Owner''s Equity',
    'Retained Earnings',
    'Shareholder Equity'
  ));
