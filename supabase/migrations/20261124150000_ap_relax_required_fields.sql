-- =============================================================================
--  accounts_payable — make the descriptive fields optional.
--
--  The AP form previously required vendor, invoice number, eTIMS code,
--  receiving account and due date before Save would enable. Finance wants to
--  be able to post a payable with only the amount known and fill the rest in
--  later, so every one of those becomes optional.
--
--  Each needs the NOT NULL lifted rather than just relaxing the form:
--
--    vendor_name / invoice_number / etims_code
--        TEXT NOT NULL. An empty string would technically satisfy NOT NULL,
--        but storing '' makes every downstream report print blanks that look
--        like data. NULL is the honest representation of "not known yet".
--
--    receiving_account_code
--        TEXT NOT NULL *and* FK fk_ap_receiving_account_code →
--        chart_of_accounts. '' is not a valid account code, so an empty value
--        fails the FK outright. Only NULL works here.
--
--    due_date
--        DATE NOT NULL. Sending '' raises
--        `invalid input syntax for type date: ""` (22P02) — the same failure
--        that broke the global Taxes form before 20261124090000.
--
--  `date` stays NOT NULL: the form auto-populates it with today and renders it
--  read-only, so it can never arrive empty.
--
--  The ap_requires_pm_commodity CHECK is untouched — a project-linked invoice
--  still has to name its PM commodity. Relaxing these fields does not relax
--  the costing discipline.
-- =============================================================================

ALTER TABLE public.accounts_payable
  ALTER COLUMN vendor_name            DROP NOT NULL,
  ALTER COLUMN invoice_number         DROP NOT NULL,
  ALTER COLUMN etims_code             DROP NOT NULL,
  ALTER COLUMN receiving_account_code DROP NOT NULL,
  ALTER COLUMN due_date               DROP NOT NULL;


-- Existing rows may carry '' from before this change; normalise so "unknown"
-- has exactly one representation and the FK can be trusted.
UPDATE public.accounts_payable
   SET vendor_name            = NULLIF(vendor_name, ''),
       invoice_number         = NULLIF(invoice_number, ''),
       etims_code             = NULLIF(etims_code, ''),
       receiving_account_code = NULLIF(receiving_account_code, '')
 WHERE vendor_name            = ''
    OR invoice_number         = ''
    OR etims_code             = ''
    OR receiving_account_code = '';


COMMENT ON COLUMN public.accounts_payable.vendor_name IS
  'Nullable — AP invoices can be posted before the vendor is known.';
COMMENT ON COLUMN public.accounts_payable.receiving_account_code IS
  'Nullable FK to chart_of_accounts. NULL = not yet coded. Never '''' — the '
  'empty string is not a valid account code and fails the FK.';
COMMENT ON COLUMN public.accounts_payable.due_date IS
  'Nullable — set once payment terms are agreed. Aging/overdue reporting '
  'should treat NULL as "no due date" rather than overdue.';
