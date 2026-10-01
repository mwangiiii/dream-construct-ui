-- =============================================================================
--  bq_measurements — actual quantities measured on site against BoQ items.
--
--  A Quantity Surveyor records what has actually been executed per BoQ item
--  over time. Progress % = SUM(measured_quantity) / bill_of_quantities.quantity.
--  Value earned = progress % × bill_of_quantities.amount.
--
--  vw_boq_progress is the read model consumed by the Measurements and
--  Valuations screens — one row per BoQ item with running totals.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bq_measurements (
  id                 bigint        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  bq_item_id         bigint        NOT NULL
                                    REFERENCES public.bill_of_quantities(id) ON DELETE CASCADE,

  measurement_date   date          NOT NULL DEFAULT CURRENT_DATE,
  measured_quantity  numeric(15,3) NOT NULL CHECK (measured_quantity > 0),
  location           text          NOT NULL DEFAULT '',
  notes              text,

  measured_by        uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz   NOT NULL DEFAULT NOW(),
  updated_at         timestamptz   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bq_measurements_bq_item_idx  ON public.bq_measurements(bq_item_id);
CREATE INDEX IF NOT EXISTS bq_measurements_date_idx     ON public.bq_measurements(measurement_date);

DROP TRIGGER IF EXISTS trg_bq_measurements_updated_at ON public.bq_measurements;
CREATE TRIGGER trg_bq_measurements_updated_at
  BEFORE UPDATE ON public.bq_measurements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bq_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bq_measurements_select ON public.bq_measurements;
DROP POLICY IF EXISTS bq_measurements_insert ON public.bq_measurements;
DROP POLICY IF EXISTS bq_measurements_update ON public.bq_measurements;
DROP POLICY IF EXISTS bq_measurements_delete ON public.bq_measurements;

CREATE POLICY bq_measurements_select ON public.bq_measurements FOR SELECT TO authenticated USING (true);
CREATE POLICY bq_measurements_insert ON public.bq_measurements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY bq_measurements_update ON public.bq_measurements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY bq_measurements_delete ON public.bq_measurements FOR DELETE TO authenticated USING (true);


-- ── Progress read-model ──────────────────────────────────────────────────────
--  One row per BoQ item with the running totals the UI needs. Percent is
--  capped at 100 for display but the underlying sum is preserved so the QS
--  can spot over-measurement.
CREATE OR REPLACE VIEW public.vw_boq_progress AS
SELECT
  bq.id                              AS bq_item_id,
  bq.project_id,
  bq.milestone_id,
  bq.item_number,
  bq.description,
  bq.unit,
  bq.quantity                        AS boq_quantity,
  bq.rate                            AS boq_rate,
  bq.amount                          AS boq_amount,
  COALESCE(SUM(m.measured_quantity), 0)                       AS measured_quantity,
  CASE
    WHEN bq.quantity > 0
      THEN LEAST(100, ROUND((COALESCE(SUM(m.measured_quantity), 0) / bq.quantity) * 100, 2))
    ELSE 0
  END                                                         AS progress_percent,
  CASE
    WHEN bq.quantity > 0
      THEN ROUND(
        LEAST(1, COALESCE(SUM(m.measured_quantity), 0) / bq.quantity) * bq.amount,
        2
      )
    ELSE 0
  END                                                         AS value_earned,
  COUNT(m.id)                        AS measurement_count,
  MAX(m.measurement_date)            AS last_measurement_date
FROM public.bill_of_quantities bq
LEFT JOIN public.bq_measurements m ON m.bq_item_id = bq.id
GROUP BY bq.id;

COMMENT ON VIEW public.vw_boq_progress IS
  'One row per BoQ item with the running measured quantity, percent complete '
  '(capped at 100 for display), and value earned. Consumed by the QS '
  'Measurements and Valuations pages.';
