-- =============================================================================
--  inventory_vendor_company — link inventory vendor to the companies master
--
--  Requirement: vendors should be selected from a centralised vendor master list
--  (the companies table), not re-typed per inventory item.
--
--  Adds inventory.vendor_id (FK → companies.id). The existing free-text
--  inventory.vendor column is kept as a denormalised display copy so old rows
--  keep showing their vendor name.
--
--  Safe to re-run (IF NOT EXISTS / idempotent guards).
-- =============================================================================

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS vendor_id UUID
    REFERENCES public.companies(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_vendor_id ON public.inventory (vendor_id);

COMMENT ON COLUMN public.inventory.vendor_id IS
  'FK → companies.id. The supplier company for this inventory item. '
  'inventory.vendor (text) is retained as a denormalised display copy.';
