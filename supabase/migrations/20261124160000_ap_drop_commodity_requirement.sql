-- =============================================================================
--  accounts_payable — vendor / PM commodity becomes fully optional.
--
--  ap_requires_pm_commodity (added 20260930101500, relaxed for standalone rows
--  in 20261123120000) forced every project-linked invoice to name a
--  project_financials row:
--
--      project_id IS NULL
--      OR project_financial_id IS NOT NULL
--      OR is_legacy_adhoc = true
--
--  The AP form now treats vendor as optional, so selecting a project without a
--  commodity hit "violates check constraint ap_requires_pm_commodity". Finance
--  wants to post a payable with only the amount known, project-linked or not.
--
--  ── What this does NOT give up ─────────────────────────────────────────────
--  The original bug this CHECK accompanied was AP invoices representing
--  VENDOR-LEVEL AGGREGATES instead of a single commodity. That guarantee does
--  not come from the CHECK — it comes from two things that are untouched:
--
--    * project_financial_id remains an FK to ONE project_financials row, so a
--      populated link can still only ever mean a single commodity.
--    * VendorSelect renders one option per (vendor + commodity) and never a
--      per-vendor sum, so the UI cannot offer a rollup in the first place.
--
--  The CHECK only guaranteed that a link EXISTS. Dropping it permits AP rows
--  with no PM counterpart at all.
--
--  ── What is genuinely lost ─────────────────────────────────────────────────
--  A project-linked AP cost can now exist with no commodity, so it will not
--  reconcile back to the BoQ. is_legacy_adhoc and its partial index survive, so
--  `WHERE project_financial_id IS NULL AND project_id IS NOT NULL` remains the
--  query for finding project costs that still need backlinking to PM.
-- =============================================================================

ALTER TABLE public.accounts_payable
  DROP CONSTRAINT IF EXISTS ap_requires_pm_commodity;


COMMENT ON COLUMN public.accounts_payable.project_financial_id IS
  'Optional FK to ONE project_financials (PM commodity) row. When set, this '
  'invoice pays for that single commodity — never a vendor-level rollup. NULL '
  'means the cost has no PM counterpart yet; finance can backfill later. The '
  'former ap_requires_pm_commodity CHECK was dropped in 20261124160000 so '
  'vendor selection is optional on every AP row.';
