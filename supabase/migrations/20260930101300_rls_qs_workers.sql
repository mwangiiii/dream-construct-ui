-- =============================================================================
--  RLS — QS + worker tables
--
--  QS tables (bill_of_quantities, bq_measurements):
--    Read  : admin/manager/finance all; PM read own; QS read+write own; client denied
--    Write : QS on own projects; manager/admin all
--
--  Worker tables (workers, worker_attendance, worker_assignments):
--    Read  : admin/manager/finance all; PM+QS on own projects; client denied
--    Write : PM on own projects; manager/admin all
-- =============================================================================


-- ── bill_of_quantities ──────────────────────────────────────────────────────
ALTER TABLE public.bill_of_quantities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boq_select ON public.bill_of_quantities;
DROP POLICY IF EXISTS boq_insert ON public.bill_of_quantities;
DROP POLICY IF EXISTS boq_update ON public.bill_of_quantities;
DROP POLICY IF EXISTS boq_delete ON public.bill_of_quantities;
DROP POLICY IF EXISTS boq_write  ON public.bill_of_quantities;

CREATE POLICY boq_select ON public.bill_of_quantities
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
    OR security.surveys_project(project_id)
  );

-- QS writes BoQ for their assigned projects; manager/admin unrestricted.
CREATE POLICY boq_write ON public.bill_of_quantities
  FOR ALL TO authenticated
  USING (
    security.is_manager_or_up()
    OR security.surveys_project(project_id)
  )
  WITH CHECK (
    security.is_manager_or_up()
    OR security.surveys_project(project_id)
  );


-- ── bq_measurements ─────────────────────────────────────────────────────────
-- Access is derived from the parent BoQ item's project.
ALTER TABLE public.bq_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bq_measurements_select ON public.bq_measurements;
DROP POLICY IF EXISTS bq_measurements_insert ON public.bq_measurements;
DROP POLICY IF EXISTS bq_measurements_update ON public.bq_measurements;
DROP POLICY IF EXISTS bq_measurements_delete ON public.bq_measurements;
DROP POLICY IF EXISTS bq_measurements_write  ON public.bq_measurements;

CREATE POLICY bq_measurements_select ON public.bq_measurements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bill_of_quantities bq
      WHERE bq.id = bq_measurements.bq_item_id
        AND (
          security.is_finance_or_up()
          OR security.manages_project(bq.project_id)
          OR security.surveys_project(bq.project_id)
        )
    )
  );

CREATE POLICY bq_measurements_write ON public.bq_measurements
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bill_of_quantities bq
      WHERE bq.id = bq_measurements.bq_item_id
        AND (
          security.is_manager_or_up()
          OR security.surveys_project(bq.project_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bill_of_quantities bq
      WHERE bq.id = bq_measurements.bq_item_id
        AND (
          security.is_manager_or_up()
          OR security.surveys_project(bq.project_id)
        )
    )
  );


-- ── workers ─────────────────────────────────────────────────────────────────
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workers_select ON public.workers;
DROP POLICY IF EXISTS workers_write  ON public.workers;

CREATE POLICY workers_select ON public.workers
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR (project_id IS NOT NULL AND (
      security.manages_project(project_id)
      OR security.surveys_project(project_id)
    ))
  );

CREATE POLICY workers_write ON public.workers
  FOR ALL TO authenticated
  USING (
    security.is_manager_or_up()
    OR (project_id IS NOT NULL AND security.manages_project(project_id))
  )
  WITH CHECK (
    security.is_manager_or_up()
    OR (project_id IS NOT NULL AND security.manages_project(project_id))
  );


-- ── worker_attendance ───────────────────────────────────────────────────────
-- Attendance access is derived from the worker's project.
ALTER TABLE public.worker_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS worker_attendance_select ON public.worker_attendance;
DROP POLICY IF EXISTS worker_attendance_write  ON public.worker_attendance;

CREATE POLICY worker_attendance_select ON public.worker_attendance
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.id = worker_attendance.worker_id
        AND w.project_id IS NOT NULL
        AND (
          security.manages_project(w.project_id)
          OR security.surveys_project(w.project_id)
        )
    )
  );

CREATE POLICY worker_attendance_write ON public.worker_attendance
  FOR ALL TO authenticated
  USING (
    security.is_manager_or_up()
    OR EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.id = worker_attendance.worker_id
        AND w.project_id IS NOT NULL
        AND security.manages_project(w.project_id)
    )
  )
  WITH CHECK (
    security.is_manager_or_up()
    OR EXISTS (
      SELECT 1 FROM public.workers w
      WHERE w.id = worker_attendance.worker_id
        AND w.project_id IS NOT NULL
        AND security.manages_project(w.project_id)
    )
  );


-- ── worker_assignments ──────────────────────────────────────────────────────
ALTER TABLE public.worker_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS worker_assignments_select ON public.worker_assignments;
DROP POLICY IF EXISTS worker_assignments_write  ON public.worker_assignments;

CREATE POLICY worker_assignments_select ON public.worker_assignments
  FOR SELECT TO authenticated
  USING (
    security.is_finance_or_up()
    OR security.manages_project(project_id)
    OR security.surveys_project(project_id)
  );

CREATE POLICY worker_assignments_write ON public.worker_assignments
  FOR ALL TO authenticated
  USING (
    security.is_manager_or_up()
    OR security.manages_project(project_id)
  )
  WITH CHECK (
    security.is_manager_or_up()
    OR security.manages_project(project_id)
  );
