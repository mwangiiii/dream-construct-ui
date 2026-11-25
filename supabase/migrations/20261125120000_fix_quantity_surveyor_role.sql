-- =============================================================================
--  Align the roles lookup with the application: 'surveyor' -> 'quantity_surveyor'
--
--  The role_name enum already contains BOTH 'surveyor' and 'quantity_surveyor',
--  but public.roles only has a row for 'surveyor'. Because
--  user_roles.role_name carries an FK to roles(role_name), the value the entire
--  application uses cannot be assigned:
--
--    * UserCreate.tsx offers "Quantity Surveyor" with value 'quantity_surveyor'
--    * RoleName and ROLE_PRIORITY in lib/auth.ts use 'quantity_surveyor'
--    * security.is_quantity_surveyor() = has_role('quantity_surveyor')
--    * the /qs/* route guards expect 'quantity_surveyor'
--
--  28 usages across 11 files, so the database is what should move.
--
--  ── Why the two existing 'surveyor' users are a live problem ────────────────
--  getPrimaryRole() walks ROLE_PRIORITY, which has no 'surveyor' entry, so it
--  falls through and returns 'client' — those users get the client dashboard.
--  But security.is_client() is also FALSE for them, because they do not hold
--  the 'client' role. The net effect is a session with no recognised role,
--  which passes every policy phrased as `NOT security.is_client()` — including
--  chart_of_accounts_select and policy_categories_staff_read. They are
--  unscoped rather than restricted, which is the wrong direction.
--
--  ── Ordering is load-bearing ───────────────────────────────────────────────
--  user_roles.role_name REFERENCES roles(role_name) ON DELETE CASCADE.
--  Deleting the 'surveyor' row BEFORE re-pointing its assignments would
--  cascade-delete those user_roles rows and silently strip both users of all
--  access. Steps must run in this order: add the new row, migrate
--  assignments, then delete the old row only once nothing references it.
--
--  The 'surveyor' ENUM LABEL is left in place — PostgreSQL cannot remove enum
--  values. Deleting the lookup row is what prevents it being assigned again.
-- =============================================================================


-- ── 1. Add the quantity_surveyor lookup row ─────────────────────────────────
-- role_id's definition is unknown (rows 5 and 6 were added out-of-band), so
-- try the default-driven insert first and fall back to an explicit id. This
-- works whether role_id is serial, identity-by-default, or plain.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE role_name = 'quantity_surveyor') THEN
    BEGIN
      INSERT INTO public.roles (role_name, description)
      VALUES ('quantity_surveyor',
              'Quantity surveyor — measures works and prices bills of quantities');
    EXCEPTION WHEN not_null_violation THEN
      INSERT INTO public.roles (role_id, role_name, description)
      VALUES ((SELECT COALESCE(MAX(role_id), 0) + 1 FROM public.roles),
              'quantity_surveyor',
              'Quantity surveyor — measures works and prices bills of quantities');
    END;
  END IF;
END $$;


-- ── 2. Re-point existing assignments ────────────────────────────────────────
-- PK is (user_id, role_name), so skip anyone who somehow holds both already;
-- a blind UPDATE would raise a duplicate key for them.
UPDATE public.user_roles ur
   SET role_name = 'quantity_surveyor'
 WHERE ur.role_name = 'surveyor'
   AND NOT EXISTS (
     SELECT 1 FROM public.user_roles dup
     WHERE dup.user_id = ur.user_id
       AND dup.role_name = 'quantity_surveyor'
   );

-- Anyone holding both is now redundant on the old value.
DELETE FROM public.user_roles WHERE role_name = 'surveyor';


-- ── 3. Retire the old lookup row ────────────────────────────────────────────
-- Guarded: only once step 2 left nothing pointing at it. If this is a no-op,
-- step 2 did not fully migrate and the cascade would have destroyed access.
DELETE FROM public.roles r
 WHERE r.role_name = 'surveyor'
   AND NOT EXISTS (
     SELECT 1 FROM public.user_roles ur WHERE ur.role_name = 'surveyor'
   );


-- ── 4. Verify ───────────────────────────────────────────────────────────────
-- Fail the migration rather than leave the roles table half-aligned.
DO $$
DECLARE
  stragglers int;
  has_qs     boolean;
BEGIN
  SELECT count(*) INTO stragglers FROM public.user_roles WHERE role_name = 'surveyor';
  SELECT EXISTS (SELECT 1 FROM public.roles WHERE role_name = 'quantity_surveyor') INTO has_qs;

  IF NOT has_qs THEN
    RAISE EXCEPTION 'roles.quantity_surveyor was not created — aborting';
  END IF;
  IF stragglers > 0 THEN
    RAISE EXCEPTION '% user_roles rows still reference surveyor — aborting', stragglers;
  END IF;

  RAISE NOTICE 'quantity_surveyor aligned; surveyor retired.';
END $$;


COMMENT ON TABLE public.roles IS
  'Role lookup. role_name must match the RoleName union and ROLE_PRIORITY in '
  'src/lib/auth.ts — a row here that the app does not know about produces a '
  'user with no recognised role, who then passes any policy written as '
  'NOT security.is_client(). Keep the two in step.';
