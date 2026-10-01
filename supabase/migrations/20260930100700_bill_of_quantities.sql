-- =============================================================================
--  bill_of_quantities — per-project priced schedule of works.
--
--  The Quantity Surveyor produces a BoQ for each project: an itemised list
--  of measurable work items, each with a description, unit, estimated
--  quantity, and unit rate. amount = quantity × rate (stored generated).
--
--  Milestone linkage is optional so a BoQ can either be flat or grouped by
--  project_milestones (typical for phased contracts).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bill_of_quantities (
  id            bigint        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  project_id    uuid          NOT NULL REFERENCES public.projects(id)         ON DELETE CASCADE,
  milestone_id  uuid          REFERENCES public.project_milestones(id)         ON DELETE SET NULL,

  item_number   text          NOT NULL DEFAULT '',
  description   text          NOT NULL,
  unit          text          NOT NULL DEFAULT 'units',
  quantity      numeric(15,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  rate          numeric(15,2) NOT NULL DEFAULT 0 CHECK (rate     >= 0),

  amount        numeric(18,2) GENERATED ALWAYS AS (ROUND(quantity * rate, 2)) STORED,

  notes         text,

  created_by    uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz   NOT NULL DEFAULT NOW(),
  updated_at    timestamptz   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bill_of_quantities_project_id_idx    ON public.bill_of_quantities(project_id);
CREATE INDEX IF NOT EXISTS bill_of_quantities_milestone_id_idx  ON public.bill_of_quantities(milestone_id);

-- Reuse the shared set_updated_at() from earlier migrations.
DROP TRIGGER IF EXISTS trg_bill_of_quantities_updated_at ON public.bill_of_quantities;
CREATE TRIGGER trg_bill_of_quantities_updated_at
  BEFORE UPDATE ON public.bill_of_quantities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bill_of_quantities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boq_select ON public.bill_of_quantities;
DROP POLICY IF EXISTS boq_insert ON public.bill_of_quantities;
DROP POLICY IF EXISTS boq_update ON public.bill_of_quantities;
DROP POLICY IF EXISTS boq_delete ON public.bill_of_quantities;

CREATE POLICY boq_select ON public.bill_of_quantities FOR SELECT TO authenticated USING (true);
CREATE POLICY boq_insert ON public.bill_of_quantities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY boq_update ON public.bill_of_quantities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY boq_delete ON public.bill_of_quantities FOR DELETE TO authenticated USING (true);

COMMENT ON TABLE public.bill_of_quantities IS
  'Quantity-surveyor Bill of Quantities per project. One row = one priced '
  'work item. amount is generated (quantity × rate). Actual measured '
  'progress is tracked separately in bq_measurements.';
