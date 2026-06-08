-- =============================================================================
--  coa_fk_constraints — enforce Chart of Accounts as single source of truth
--
--  Every column in the system that stores a bank/account code now references
--  chart_of_accounts(account_code) via a foreign key.
--
--  Strategy used throughout:
--    • NOT VALID   — constraint is created without scanning existing rows, so
--                    legacy data (empty strings, stale codes) won't break the
--                    migration. New inserts/updates ARE validated immediately.
--    • ON UPDATE CASCADE  — if an account_code is ever renamed in COA, all
--                           linked rows update automatically.
--    • ON DELETE RESTRICT — prevents deleting a COA entry that is still
--                           referenced (used for NOT NULL columns).
--    • ON DELETE SET NULL — nullable columns fall back to NULL if the COA
--                           entry is removed.
--
--  Run once in Supabase SQL Editor → New query → Run.
--  Safe to re-run: all ALTER TABLE ... ADD CONSTRAINT blocks are wrapped in
--  DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL $$ guards.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 0. PRE-FLIGHT: column type fixes needed before adding FKs
-- ─────────────────────────────────────────────────────────────────────────────

-- 0a. cash_flow.account_codes was NOT NULL, but the UI now uses a COA dropdown
--     that can return NULL (no selection). Make it nullable.
ALTER TABLE public.cash_flow
  ALTER COLUMN account_codes DROP NOT NULL;

-- 0b. cash_flow.etims_codes was also NOT NULL, but is an optional free-text
--     reference. Make it nullable for consistency.
ALTER TABLE public.cash_flow
  ALTER COLUMN etims_codes DROP NOT NULL;

-- 0c. job_postings.account_code defaults to '' which is not a valid COA code.
--     Nullify any blank values, then drop NOT NULL so the FK can be nullable.
UPDATE public.job_postings
  SET account_code = NULL
  WHERE account_code = '';

ALTER TABLE public.job_postings
  ALTER COLUMN account_code DROP NOT NULL,
  ALTER COLUMN account_code SET DEFAULT NULL;

-- 0d. accounts_receivable.account_received may need to be nullable to match
--     the TypeScript interface (string | null). Drop NOT NULL if it exists.
ALTER TABLE public.accounts_receivable
  ALTER COLUMN account_received DROP NOT NULL;

-- 0e. Add bank_account_code to invoices — stores the COA account_code for the
--     payment bank. Keeps the existing bank_name column for email/display use.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS bank_account_code TEXT;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. accounts_payable.receiving_account_code → chart_of_accounts(account_code)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.accounts_payable
    ADD CONSTRAINT fk_ap_receiving_account_code
    FOREIGN KEY (receiving_account_code)
    REFERENCES public.chart_of_accounts (account_code)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. accounts_receivable.account_received → chart_of_accounts(account_code)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.accounts_receivable
    ADD CONSTRAINT fk_ar_account_received
    FOREIGN KEY (account_received)
    REFERENCES public.chart_of_accounts (account_code)
    ON UPDATE CASCADE
    ON DELETE SET NULL
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. bank_reconciliation.bank_code → chart_of_accounts(account_code)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.bank_reconciliation
    ADD CONSTRAINT fk_br_bank_code
    FOREIGN KEY (bank_code)
    REFERENCES public.chart_of_accounts (account_code)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. cash_flow.account_codes → chart_of_accounts(account_code)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.cash_flow
    ADD CONSTRAINT fk_cf_account_codes
    FOREIGN KEY (account_codes)
    REFERENCES public.chart_of_accounts (account_code)
    ON UPDATE CASCADE
    ON DELETE SET NULL
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. statement_of_account.account_code → chart_of_accounts(account_code)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.statement_of_account
    ADD CONSTRAINT fk_soa_account_code
    FOREIGN KEY (account_code)
    REFERENCES public.chart_of_accounts (account_code)
    ON UPDATE CASCADE
    ON DELETE SET NULL
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. job_postings.account_code → chart_of_accounts(account_code)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.job_postings
    ADD CONSTRAINT fk_jp_account_code
    FOREIGN KEY (account_code)
    REFERENCES public.chart_of_accounts (account_code)
    ON UPDATE CASCADE
    ON DELETE SET NULL
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. work_in_progress.code_receivable → chart_of_accounts(account_code)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.work_in_progress
    ADD CONSTRAINT fk_wip_code_receivable
    FOREIGN KEY (code_receivable)
    REFERENCES public.chart_of_accounts (account_code)
    ON UPDATE CASCADE
    ON DELETE SET NULL
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. payroll_checklist.bank_code → chart_of_accounts(account_code)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.payroll_checklist
    ADD CONSTRAINT fk_payroll_bank_code
    FOREIGN KEY (bank_code)
    REFERENCES public.chart_of_accounts (account_code)
    ON UPDATE CASCADE
    ON DELETE SET NULL
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. invoices.bank_account_code → chart_of_accounts(account_code)
--    (New column added in step 0e above)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.invoices
    ADD CONSTRAINT fk_invoices_bank_account_code
    FOREIGN KEY (bank_account_code)
    REFERENCES public.chart_of_accounts (account_code)
    ON UPDATE CASCADE
    ON DELETE SET NULL
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. INDEX: bank_account_code on invoices for fast lookups
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_invoices_bank_account_code
  ON public.invoices (bank_account_code);


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. COMMENTS
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON CONSTRAINT fk_ap_receiving_account_code  ON public.accounts_payable    IS 'Payment bank account must exist in chart_of_accounts';
COMMENT ON CONSTRAINT fk_ar_account_received        ON public.accounts_receivable  IS 'Receipt bank account must exist in chart_of_accounts';
COMMENT ON CONSTRAINT fk_br_bank_code               ON public.bank_reconciliation  IS 'Reconciliation bank account must exist in chart_of_accounts';
COMMENT ON CONSTRAINT fk_cf_account_codes           ON public.cash_flow            IS 'Cash flow account must exist in chart_of_accounts';
COMMENT ON CONSTRAINT fk_soa_account_code           ON public.statement_of_account IS 'Statement account code must exist in chart_of_accounts';
COMMENT ON CONSTRAINT fk_jp_account_code            ON public.job_postings         IS 'Job costing account must exist in chart_of_accounts';
COMMENT ON CONSTRAINT fk_wip_code_receivable        ON public.work_in_progress     IS 'WIP receivable code must exist in chart_of_accounts';
COMMENT ON CONSTRAINT fk_payroll_bank_code          ON public.payroll_checklist    IS 'Payroll payment bank account must exist in chart_of_accounts';
COMMENT ON CONSTRAINT fk_invoices_bank_account_code ON public.invoices             IS 'Invoice payment bank account must exist in chart_of_accounts';

COMMENT ON COLUMN public.invoices.bank_account_code IS
  'FK → chart_of_accounts.account_code. Stores the COA code of the payment receiving bank. '
  'bank_name column is retained for email/PDF display (human-readable bank name).';


-- ─────────────────────────────────────────────────────────────────────────────
-- NOTES FOR FUTURE VALIDATION
-- ─────────────────────────────────────────────────────────────────────────────
--
-- All constraints above were created with NOT VALID, meaning existing rows were
-- not checked. Once legacy data has been cleaned up, run the following to fully
-- enforce each constraint against existing rows:
--
--   ALTER TABLE public.accounts_payable    VALIDATE CONSTRAINT fk_ap_receiving_account_code;
--   ALTER TABLE public.accounts_receivable VALIDATE CONSTRAINT fk_ar_account_received;
--   ALTER TABLE public.bank_reconciliation VALIDATE CONSTRAINT fk_br_bank_code;
--   ALTER TABLE public.cash_flow           VALIDATE CONSTRAINT fk_cf_account_codes;
--   ALTER TABLE public.statement_of_account VALIDATE CONSTRAINT fk_soa_account_code;
--   ALTER TABLE public.job_postings        VALIDATE CONSTRAINT fk_jp_account_code;
--   ALTER TABLE public.work_in_progress    VALIDATE CONSTRAINT fk_wip_code_receivable;
--   ALTER TABLE public.payroll_checklist   VALIDATE CONSTRAINT fk_payroll_bank_code;
--   ALTER TABLE public.invoices            VALIDATE CONSTRAINT fk_invoices_bank_account_code;
--
-- =============================================================================
