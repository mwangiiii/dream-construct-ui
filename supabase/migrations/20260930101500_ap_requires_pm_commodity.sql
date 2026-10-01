-- =============================================================================
--  accounts_payable — enforce PM commodity link at the DB layer.
--
--  Rule from here on: every NEW AP invoice must link to a PM commodity row
--  via project_financial_id. The nullable column from
--  20260930100500_accounts_payable_pm_commodity_link.sql becomes a hard
--  requirement — the frontend form's commodity picker is now authoritative.
--
--  Pre-existing orphan rows (project_financial_id IS NULL) are grandfathered
--  via `is_legacy_adhoc`. Those rows remain readable/editable but are tagged
--  as not-conforming so the finance team can see what still needs cleanup.
--  Setting the FK on a legacy row automatically clears the flag.
-- =============================================================================


-- ── 1. Grandfather flag + backfill ──────────────────────────────────────────
ALTER TABLE public.accounts_payable
  ADD COLUMN IF NOT EXISTS is_legacy_adhoc boolean NOT NULL DEFAULT false;

UPDATE public.accounts_payable
  SET is_legacy_adhoc = true
  WHERE project_financial_id IS NULL
    AND is_legacy_adhoc = false;


-- ── 2. The hard CHECK ───────────────────────────────────────────────────────
ALTER TABLE public.accounts_payable
  DROP CONSTRAINT IF EXISTS ap_requires_pm_commodity;

ALTER TABLE public.accounts_payable
  ADD  CONSTRAINT ap_requires_pm_commodity CHECK (
    project_financial_id IS NOT NULL
    OR is_legacy_adhoc = true
  );


-- ── 3. Trigger: clearing the flag when a FK is set ──────────────────────────
-- A finance user retroactively linking a legacy row to its PM commodity
-- shouldn't have to also uncheck is_legacy_adhoc manually. The trigger
-- auto-flips the flag so the row joins the modern cohort.
CREATE OR REPLACE FUNCTION public.ap_sync_legacy_flag()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.project_financial_id IS NOT NULL AND NEW.is_legacy_adhoc = true THEN
    NEW.is_legacy_adhoc := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ap_sync_legacy_flag ON public.accounts_payable;
CREATE TRIGGER trg_ap_sync_legacy_flag
  BEFORE INSERT OR UPDATE OF project_financial_id ON public.accounts_payable
  FOR EACH ROW EXECUTE FUNCTION public.ap_sync_legacy_flag();


-- ── 4. Index for cleanup reporting ──────────────────────────────────────────
-- Finance can query WHERE is_legacy_adhoc = true to find orphans needing
-- backlinking to PM.
CREATE INDEX IF NOT EXISTS accounts_payable_legacy_adhoc_idx
  ON public.accounts_payable(is_legacy_adhoc)
  WHERE is_legacy_adhoc = true;


COMMENT ON COLUMN public.accounts_payable.is_legacy_adhoc IS
  'TRUE for pre-existing AP rows that were created before the PM commodity '
  'link became mandatory. Flipped to FALSE automatically when a '
  'project_financial_id is set. Finance should backfill these when possible.';

COMMENT ON CONSTRAINT ap_requires_pm_commodity ON public.accounts_payable IS
  'Every new AP invoice must link to a PM commodity row (project_financials). '
  'Legacy orphans are grandfathered via is_legacy_adhoc=true.';
