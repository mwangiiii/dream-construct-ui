-- ============================================================
-- Migration: inventory
-- Description: Creates the inventory table with a generated
--              total_value column, constraints, indexes,
--              RLS policies, and audit trigger.
-- ============================================================

-- ── 1. Table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inventory (
  id                BIGSERIAL       PRIMARY KEY,

  -- Item identity
  factorial_code    TEXT            NOT NULL,
  description       TEXT            NOT NULL,
  serial_number     TEXT            NOT NULL DEFAULT '',

  -- Vendor & supply
  vendor            TEXT            NOT NULL DEFAULT '',

  -- Quantities & financials
  quantity_of_item  NUMERIC(18, 4)  NOT NULL DEFAULT 0 CHECK (quantity_of_item >= 0),
  cost_per_quantity NUMERIC(18, 4)  NOT NULL DEFAULT 0 CHECK (cost_per_quantity >= 0),

  -- GENERATED: total_value = quantity * cost  (never send in INSERT/UPDATE)
  total_value       NUMERIC(18, 2)
    GENERATED ALWAYS AS (ROUND(quantity_of_item * cost_per_quantity, 2)) STORED,

  -- Usage & metadata
  usage             TEXT            NOT NULL DEFAULT '',
  date              DATE            NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT            NOT NULL DEFAULT '',

  -- Audit
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  -- Factorial code must be unique across the register
  CONSTRAINT uq_inventory_factorial_code UNIQUE (factorial_code)
);

-- ── 2. Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_inv_factorial_code  ON inventory (factorial_code);
CREATE INDEX IF NOT EXISTS idx_inv_serial_number   ON inventory (serial_number);
CREATE INDEX IF NOT EXISTS idx_inv_vendor          ON inventory (vendor);
CREATE INDEX IF NOT EXISTS idx_inv_date            ON inventory (date);
CREATE INDEX IF NOT EXISTS idx_inv_usage           ON inventory (usage);

-- ── 3. updated_at auto-trigger ────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON inventory;
CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 4. Row-Level Security ─────────────────────────────────────

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inventory"
  ON inventory FOR SELECT
  TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can insert inventory"
  ON inventory FOR INSERT
  TO authenticated WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can update inventory"
  ON inventory FOR UPDATE
  TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can delete inventory"
  ON inventory FOR DELETE
  TO authenticated USING (TRUE);

-- ── 5. Seed data ──────────────────────────────────────────────

INSERT INTO inventory
  (factorial_code, description, serial_number, vendor, quantity_of_item, cost_per_quantity, usage, date, notes)
VALUES
  ('F-001', 'Cement Bags',           'SN-1001', 'ABC Supplies',  100,  500, 'Foundation',    '2026-02-20', 'Used for phase 1.'),
  ('F-002', 'Steel Rods',            'SN-1002', 'XYZ Metals',     50, 1200, 'Superstructure','2026-02-22', 'Delivered on time.'),
  ('F-003', 'Paint Buckets',         'SN-1003', 'LMN Hardware',   30,  800, 'Finishing',     '2026-02-25', 'Awaiting usage.'),
  ('F-004', 'Timber Planks',         'SN-1004', 'ABC Supplies',  200,  350, 'Formwork',      '2026-03-01', 'Stored in warehouse A.'),
  ('F-005', 'Aggregate Stone (m³)',  'SN-1005', 'RockStar Qtry', 500,  120, 'Foundation',    '2026-03-02', 'Mixed with cement.'),
  ('F-006', 'Copper Wire (m)',       'SN-1006', 'ElectroPro',   1000,   45, 'Electrical',    '2026-03-05', 'For main supply line.'),
  ('F-007', 'PVC Pipes',             'SN-1007', 'PipeMaster',    150,  220, 'Plumbing',      '2026-03-06', 'Installed in basement.'),
  ('F-008', 'Glass Panels',          'SN-1008', 'ClearView Ltd', 80,  950, 'Glazing',       '2026-03-08', 'Custom-cut panels.'),
  ('F-009', 'Roofing Tiles',         'SN-1009', 'RoofKing',      600,  180, 'Roofing',       '2026-03-10', 'Delivery split in 2 batches.'),
  ('F-010', 'Floor Tiles (m²)',      'SN-1010', 'TileWorld',     400,  320, 'Finishing',     '2026-03-12', 'Premium grade.')
ON CONFLICT (factorial_code) DO NOTHING;