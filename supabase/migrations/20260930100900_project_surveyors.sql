-- =============================================================================
--  project_surveyors — junction table for QS ↔ project assignment (many-to-many)
--
--  A project can have multiple quantity surveyors, and one QS can be assigned
--  to multiple projects. Assignment is what drives QS access under RLS
--  (see security.surveys_project() and the RLS migrations that follow).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_surveyors (
  project_id   uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at  timestamptz NOT NULL DEFAULT NOW(),
  assigned_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_surveyors_user_idx    ON public.project_surveyors(user_id);
CREATE INDEX IF NOT EXISTS project_surveyors_project_idx ON public.project_surveyors(project_id);

ALTER TABLE public.project_surveyors ENABLE ROW LEVEL SECURITY;

-- Bootstrap policies — these are permissive-ish and get tightened once the
-- security helper schema exists (next migration). We keep them permissive
-- here so the helpers can be created without a chicken-and-egg problem.
DROP POLICY IF EXISTS project_surveyors_select ON public.project_surveyors;
DROP POLICY IF EXISTS project_surveyors_write  ON public.project_surveyors;

CREATE POLICY project_surveyors_select ON public.project_surveyors
  FOR SELECT TO authenticated USING (true);

CREATE POLICY project_surveyors_write ON public.project_surveyors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.project_surveyors IS
  'Many-to-many QS ↔ project assignment. Drives RLS access for the '
  'quantity_surveyor role via security.surveys_project().';
