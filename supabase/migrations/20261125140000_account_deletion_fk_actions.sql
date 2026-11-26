-- =============================================================================
--  Make a user account deletable without destroying the company's records.
--
--  Every authorship column (created_by / uploaded_by / posted_by / ...) was
--  declared as a plain `references auth.users`, i.e. ON DELETE NO ACTION. That
--  makes deleting a user impossible once they have touched anything: Postgres
--  refuses the delete rather than orphaning the row.
--
--  Deleting a person must NOT delete the project history they happened to
--  author — removing a quantity surveyor cannot take six months of site
--  attendance with it. So authorship becomes ON DELETE SET NULL (the record
--  survives, attribution is dropped), while rows that are purely *about* the
--  person — role grants, team membership — become ON DELETE CASCADE.
--
--  Deliberately NOT changed:
--    projects.client_id — NOT NULL, and a project without a client is
--    meaningless. Deletion is refused instead, by the edge function, with the
--    blocking projects named so an admin can reassign them first.
--
--  Only the constraint's delete action changes; the referenced table is read
--  from the existing constraint and preserved. No row data is touched.
-- =============================================================================

DO $$
DECLARE
  r          record;
  cname      text;
  ref_target text;
  colnum     smallint;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- Grants: the row exists only to describe this person.
      ('user_roles',         'user_id',     'CASCADE'),

      -- Authorship and assignment: keep the record, drop the attribution.
      ('user_roles',         'assigned_by', 'SET NULL'),
      ('projects',           'created_by',  'SET NULL'),
      ('project_updates',    'posted_by',   'SET NULL'),
      ('project_milestones', 'created_by',  'SET NULL'),
      ('project_approvals',  'requested_by','SET NULL'),
      ('project_approvals',  'approved_by', 'SET NULL'),
      ('tasks',              'assigned_to', 'SET NULL'),
      ('tasks',              'created_by',  'SET NULL'),
      ('documents',          'uploaded_by', 'SET NULL'),
      ('audit_logs',         'changed_by',  'SET NULL'),
      ('contracts',          'created_by',  'SET NULL'),
      ('workers',            'created_by',  'SET NULL'),
      ('worker_attendance',  'created_by',  'SET NULL'),
      ('worker_assignments', 'created_by',  'SET NULL'),
      ('media_posts',        'uploaded_by', 'SET NULL')
    ) AS t(tbl, col, act)
  LOOP
    -- Several of these tables were created outside the migration history, so
    -- every one is feature-detected rather than assumed.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.col
    ) THEN
      CONTINUE;
    END IF;

    SELECT attnum INTO colnum
    FROM pg_attribute
    WHERE attrelid = format('public.%I', r.tbl)::regclass AND attname = r.col;

    -- Find the single-column FK on this column and remember what it points at,
    -- so we rebuild against the same target (some reference auth.users, some
    -- public.profiles) and only the delete action changes.
    SELECT conname, confrelid::regclass::text
      INTO cname, ref_target
    FROM pg_constraint
    WHERE conrelid = format('public.%I', r.tbl)::regclass
      AND contype  = 'f'
      AND conkey   = ARRAY[colnum]
    LIMIT 1;

    IF cname IS NULL THEN
      CONTINUE;  -- no FK to re-point
    END IF;

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tbl, cname);

    -- SET NULL requires the column to accept NULL. Many of these are NOT NULL
    -- with `default auth.uid()`; the default keeps working for new rows.
    IF r.act = 'SET NULL' THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', r.tbl, r.col);
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(id) ON DELETE %s',
      r.tbl, cname, r.col, ref_target, r.act
    );
  END LOOP;
END $$;

-- Storage objects are owned by the uploader. Without this, deleting a user who
-- ever uploaded an avatar or site photo fails on storage.objects_owner_fkey.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'storage.objects'::regclass
    AND contype  = 'f'
    AND confrelid = 'auth.users'::regclass
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE storage.objects DROP CONSTRAINT %I', cname);
    EXECUTE format(
      'ALTER TABLE storage.objects ADD CONSTRAINT %I FOREIGN KEY (owner) '
      'REFERENCES auth.users(id) ON DELETE SET NULL', cname);
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipped storage.objects owner FK (insufficient privilege)';
END $$;
