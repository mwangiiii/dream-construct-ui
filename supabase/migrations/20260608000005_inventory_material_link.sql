-- =============================================================================
--  inventory_material_link — auto-sync inventory usage from project consumption
--
--  Requirement: "The quantity used should be derived directly from material
--  consumption recorded in Project Management. As materials are allocated or
--  consumed within a project, the inventory system should automatically update
--  usage quantities."
--
--  This migration:
--    1. Adds material_tracking.inventory_id (FK → inventory.id) — the real link
--       between a project's material consumption and a stock item.
--    2. Creates vw_inventory_consumption — raw consumption totals per stock item.
--    3. Adds a trigger that keeps inventory.quantity_used in sync with the sum of
--       linked material_tracking.used. It is CLAMPED to quantity_of_item so a
--       project-side consumption entry can never violate an inventory constraint
--       (matching the inventory form's own clamping behaviour).
--
--  Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE / DROP TRIGGER IF EXISTS).
-- =============================================================================


-- ── 1. Link column ────────────────────────────────────────────────────────────

ALTER TABLE public.material_tracking
  ADD COLUMN IF NOT EXISTS inventory_id BIGINT
    REFERENCES public.inventory(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_material_tracking_inventory_id
  ON public.material_tracking (inventory_id);

COMMENT ON COLUMN public.material_tracking.inventory_id IS
  'FK → inventory.id. Links this project material consumption to a stock item so '
  'inventory.quantity_used stays in sync automatically.';


-- ── 2. Consumption view (raw totals per stock item) ───────────────────────────

CREATE OR REPLACE VIEW public.vw_inventory_consumption AS
SELECT
  inventory_id,
  COALESCE(SUM(used),     0) AS total_used,
  COALESCE(SUM(wastage),  0) AS total_wastage,
  COUNT(DISTINCT project_id) AS project_count,
  COUNT(*)                   AS consumption_records
FROM public.material_tracking
WHERE inventory_id IS NOT NULL
GROUP BY inventory_id;

COMMENT ON VIEW public.vw_inventory_consumption IS
  'Per-stock-item consumption rolled up from project material_tracking. '
  'total_used is the raw (unclamped) quantity consumed across all linked projects.';


-- ── 3. Sync trigger ───────────────────────────────────────────────────────────
-- Recompute inventory.quantity_used for the affected stock item(s) whenever a
-- linked material_tracking row is inserted, updated, deleted, or re-linked.

CREATE OR REPLACE FUNCTION public.sync_inventory_used_from_material()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  new_iid BIGINT := NULL;
  old_iid BIGINT := NULL;
  ids     BIGINT[];
  iid     BIGINT;
  total   NUMERIC;
BEGIN
  IF TG_OP <> 'DELETE' THEN new_iid := NEW.inventory_id; END IF;
  IF TG_OP <> 'INSERT' THEN old_iid := OLD.inventory_id; END IF;

  -- Distinct, non-null inventory ids touched by this change
  ids := ARRAY(
    SELECT DISTINCT x FROM unnest(ARRAY[new_iid, old_iid]) AS x WHERE x IS NOT NULL
  );

  FOREACH iid IN ARRAY ids LOOP
    SELECT COALESCE(SUM(used), 0)
      INTO total
      FROM public.material_tracking
      WHERE inventory_id = iid;

    -- Clamp to available stock so we never violate an inventory check constraint.
    UPDATE public.inventory
      SET quantity_used = LEAST(total, quantity_of_item)
      WHERE id = iid;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_inventory_used ON public.material_tracking;
CREATE TRIGGER trg_sync_inventory_used
  AFTER INSERT OR UPDATE OF used, inventory_id OR DELETE
  ON public.material_tracking
  FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_used_from_material();

COMMENT ON FUNCTION public.sync_inventory_used_from_material() IS
  'Keeps inventory.quantity_used = LEAST(SUM(material_tracking.used), quantity_of_item) '
  'for the linked stock item. Clamped to stock to avoid constraint violations.';


-- ── 4. Backfill any existing links ────────────────────────────────────────────

UPDATE public.inventory inv
SET quantity_used = LEAST(c.total_used, inv.quantity_of_item)
FROM public.vw_inventory_consumption c
WHERE c.inventory_id = inv.id
  AND inv.quantity_used IS DISTINCT FROM LEAST(c.total_used, inv.quantity_of_item);
