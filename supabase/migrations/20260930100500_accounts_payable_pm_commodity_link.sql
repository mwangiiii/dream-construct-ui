-- =============================================================================
--  accounts_payable — link each AP invoice to a specific PM commodity row
--
--  Problem: the AP form used to prefill "total_amount" by SUMMING every
--  project_financials row for a chosen vendor. If Vendor A had supplied
--  Potatoes (50k) AND Tomatoes (30k) on the same project, the AP entry was
--  pre-filled at 80k — combining the two commodities into one invoice, which
--  does not reflect how real AP invoices arrive (one delivery / one PO / one
--  commodity per invoice, typically).
--
--  Fix: AP invoices are now scoped to (vendor + commodity) by linking to a
--  specific project_financials row. Ad-hoc AP entries with no PM counterpart
--  leave this column NULL.
-- =============================================================================

ALTER TABLE public.accounts_payable
  ADD COLUMN IF NOT EXISTS project_financial_id bigint
    REFERENCES public.project_financials(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS accounts_payable_project_financial_id_idx
  ON public.accounts_payable(project_financial_id);

COMMENT ON COLUMN public.accounts_payable.project_financial_id IS
  'FK → project_financials.id. Links this AP invoice to a specific PM '
  'commodity/material row (vendor + commodity + amount). NULL for ad-hoc AP '
  'entries with no corresponding PM line item. When set, the AP → job_postings '
  'mirror includes the commodity name in its description so Job Costing shows '
  '"Vendor → Commodity" rather than just the vendor.';
