-- =============================================================================
--  inventory_per_project — scope inventory items to a project + sync columns
--
--  The frontend (src/pages/finance/Inventory.tsx) and the material_tracking
--  sync trigger (20260608000005_inventory_material_link.sql) both treat the
--  inventory table as a per-project register, but the original table is
--  missing:
--    - project_id          (FK → projects.id) — required by the per-project
--                          query .eq("project_id", projectId)
--    - quantity_used       — written by sync_inventory_used_from_material()
--    - quantity_remaining  — read by the UI for "Qty Rem." column
--    - total_value_used    — read by the UI for "Value Used" column
--
--  The original uq_inventory_factorial_code constraint is also relaxed so a
--  factorial code only needs to be unique WITHIN a single project.
--
--  Safe to re-run (IF NOT EXISTS / idempotent guards).
-- =============================================================================


-- ── 1. project_id ─────────────────────────────────────────────────────────────

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS project_id UUID
    REFERENCES public.projects(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_inventory_project_id
  ON public.inventory (project_id);

COMMENT ON COLUMN public.inventory.project_id IS
  'FK → projects.id. The project this stock item belongs to.';


-- ── 2. quantity_used (kept in sync by trg_sync_inventory_used) ────────────────

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS quantity_used NUMERIC(18, 4)
    NOT NULL DEFAULT 0
    CHECK (quantity_used >= 0);


-- ── 3. Generated convenience columns ──────────────────────────────────────────

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS quantity_remaining NUMERIC(18, 4)
    GENERATED ALWAYS AS (GREATEST(quantity_of_item - quantity_used, 0)) STORED;

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS total_value_used NUMERIC(18, 2)
    GENERATED ALWAYS AS (ROUND(quantity_used * cost_per_quantity, 2)) STORED;


-- ── 4. factorial_code unique PER project ─────────────────────────────────────

ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS uq_inventory_factorial_code;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_project_factorial_code
  ON public.inventory (project_id, factorial_code);
