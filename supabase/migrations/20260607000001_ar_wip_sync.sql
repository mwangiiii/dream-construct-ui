-- =============================================================================
--  ar_wip_sync — link Accounts Receivable to Work in Progress
--
--  Requirement: "the amount billed should be linked to the WIP calculations …
--  the amount billed to date should be automatically obtained from AR."
--
--  This migration:
--    1. Creates vw_project_ar_summary — per-project AR aggregation, reusable by
--       both the AR module and the upcoming WIP automation.
--    2. Adds a trigger on accounts_receivable that keeps
--       work_in_progress.billed_to_date in sync with SUM(amount_billed) for the
--       project. The existing wip_derive_billing() trigger then recomputes
--       billed_status + amount automatically.
--
--  Safe to re-run (CREATE OR REPLACE / DROP TRIGGER IF EXISTS).
-- =============================================================================


-- ── 1. PER-PROJECT AR SUMMARY VIEW ────────────────────────────────────────────

CREATE OR REPLACE VIEW public.vw_project_ar_summary AS
SELECT
  project_id,
  COUNT(*)                                              AS billing_count,
  COALESCE(SUM(amount_billed),   0)                     AS total_billed,
  COALESCE(SUM(amount_received), 0)                     AS total_received,
  COALESCE(SUM(amount_billed) - SUM(amount_received), 0) AS total_outstanding,
  COALESCE(SUM(retaining_amount), 0)                    AS total_retaining,
  COUNT(*) FILTER (WHERE status = 'overdue')           AS overdue_count
FROM public.accounts_receivable
WHERE project_id IS NOT NULL
GROUP BY project_id;

COMMENT ON VIEW public.vw_project_ar_summary IS
  'Per-project Accounts Receivable aggregation. Source of truth for amount billed-to-date '
  'consumed by Work in Progress. Excludes standalone (project_id IS NULL) billings.';


-- ── 2. AR → WIP billed_to_date SYNC ───────────────────────────────────────────
-- Whenever AR rows change, recompute billed_to_date for every WIP row of the
-- affected project. (Typically one WIP row per project.) The WIP BEFORE-UPDATE
-- trigger wip_derive_billing() then re-derives billed_status and amount.

CREATE OR REPLACE FUNCTION public.sync_wip_billed_from_ar()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  pid          UUID;
  total_billed NUMERIC(18,2);
BEGIN
  -- The affected project (INSERT/UPDATE use NEW, DELETE uses OLD)
  pid := COALESCE(NEW.project_id, OLD.project_id);

  -- Standalone billings (no project) never affect WIP
  IF pid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(amount_billed), 0)
    INTO total_billed
    FROM public.accounts_receivable
    WHERE project_id = pid;

  -- Only updates rows that exist; if the project has no WIP entry yet, nothing
  -- happens (WIP will pull the correct figure when its row is created).
  UPDATE public.work_in_progress
    SET billed_to_date = total_billed
    WHERE project_id = pid
      AND billed_to_date IS DISTINCT FROM total_billed;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_sync_wip ON public.accounts_receivable;
CREATE TRIGGER trg_ar_sync_wip
  AFTER INSERT OR UPDATE OF amount_billed, project_id OR DELETE
  ON public.accounts_receivable
  FOR EACH ROW EXECUTE FUNCTION public.sync_wip_billed_from_ar();

COMMENT ON FUNCTION public.sync_wip_billed_from_ar() IS
  'Keeps work_in_progress.billed_to_date = SUM(accounts_receivable.amount_billed) per project.';


-- ── 3. BACKFILL existing WIP rows from current AR data ────────────────────────
-- One-time alignment so existing WIP entries reflect AR immediately.

UPDATE public.work_in_progress w
SET billed_to_date = s.total_billed
FROM public.vw_project_ar_summary s
WHERE w.project_id = s.project_id
  AND w.billed_to_date IS DISTINCT FROM s.total_billed;
