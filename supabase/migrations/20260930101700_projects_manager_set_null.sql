-- =============================================================================
--  projects.manager_id → ON DELETE SET NULL
--
--  Was NO ACTION, which blocks any attempt to delete a profile that is a
--  project's manager. Switching to SET NULL means: when the PM profile is
--  deleted, the project survives with manager_id = NULL (admin reassigns
--  afterwards). This matches how projects.client_id is already configured
--  and lets admin fully delete a PM without first clearing their projects.
--
--  No data impact — the constraint is only consulted on DELETE.
-- =============================================================================

-- The constraint name in the base schema is Postgres-generated. Look it up
-- and drop by name, then recreate.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.projects'::regclass
    AND contype  = 'f'
    AND conkey   = ARRAY[(SELECT attnum
                          FROM pg_attribute
                          WHERE attrelid = 'public.projects'::regclass
                            AND attname = 'manager_id')]
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.projects DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_manager_id_fkey
  FOREIGN KEY (manager_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT projects_manager_id_fkey ON public.projects IS
  'When a PM profile is deleted, the project survives with manager_id=NULL '
  '(admin reassigns via admin UI). Matches client_id SET NULL semantics.';
