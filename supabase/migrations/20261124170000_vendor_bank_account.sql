-- =============================================================================
--  Vendor bank details on tender_companies, and AP's receiving account becomes
--  the VENDOR's account number.
--
--  ── Semantic change, read this before reusing the column ───────────────────
--  accounts_payable.receiving_account_code previously held one of OUR bank
--  accounts, validated against chart_of_accounts by fk_ap_receiving_account_code
--  ("Payment bank account must exist in chart_of_accounts"). It now holds the
--  VENDOR's bank account number — where the money is going, not where it came
--  from. A bank account number is not a COA code, so the FK has to go.
--
--  What this gives up: AP no longer records which of our accounts paid an
--  invoice. Bank reconciliation must infer that from bank_reconciliation /
--  cash_flow instead. This was an explicit trade — the field is wanted as the
--  payee account, auto-filled when a vendor is picked.
--
--  ── Why tender_companies only ──────────────────────────────────────────────
--  AP vendors come from two places: tender_companies (PM commodities) and the
--  companies master list. Only tender_companies gets bank fields for now, so
--  auto-fill works for project-linked invoices; picking from the master list
--  leaves the field blank to type by hand.
-- =============================================================================


-- ── 1. Vendor bank details ──────────────────────────────────────────────────
ALTER TABLE public.tender_companies
  ADD COLUMN IF NOT EXISTS bank_name       text,
  ADD COLUMN IF NOT EXISTS bank_account_no text,
  ADD COLUMN IF NOT EXISTS bank_branch     text;

COMMENT ON COLUMN public.tender_companies.bank_account_no IS
  'Vendor payee account number. Auto-fills accounts_payable.'
  'receiving_account_code when this vendor is selected on an AP invoice.';


-- ── 2. AP receiving account is no longer a COA code ─────────────────────────
ALTER TABLE public.accounts_payable
  DROP CONSTRAINT IF EXISTS fk_ap_receiving_account_code;

COMMENT ON COLUMN public.accounts_payable.receiving_account_code IS
  'Receiving Account No — the VENDOR''s bank account number that this invoice '
  'is paid into. Auto-filled from tender_companies.bank_account_no when a PM '
  'vendor is selected, otherwise typed by hand. Nullable. NOT a '
  'chart_of_accounts code: the COA foreign key was dropped in 20261124170000 '
  'when the column changed meaning.';
