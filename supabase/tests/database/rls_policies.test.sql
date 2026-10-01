-- =============================================================================
--  pgTAP tests for RLS policies
--
--  Run via: supabase test db
--
--  The tests seed five fake users (one per role), one project owned by the
--  fake client with the fake PM as manager_id and the fake QS in
--  project_surveyors. They then simulate each user's auth.uid() by setting
--  the `request.jwt.claims` GUC (same mechanism Supabase uses) and assert
--  what rows each role can see.
--
--  Everything runs inside a single transaction that ROLLBACKs at the end,
--  so the production database is untouched.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- 36 assertions planned — bump if you add more.
SELECT plan(36);


-- ────────────────────────────────────────────────────────────────────────────
-- 0. SEED  — five users, one project, finance rows
-- ────────────────────────────────────────────────────────────────────────────
-- Deterministic UUIDs so JWT-sim strings don't need variables.
DO $$
DECLARE
  u_admin  CONSTANT uuid := '00000000-0000-0000-0000-00000000a001';
  u_mgr    CONSTANT uuid := '00000000-0000-0000-0000-00000000a002';
  u_fin    CONSTANT uuid := '00000000-0000-0000-0000-00000000a003';
  u_pm     CONSTANT uuid := '00000000-0000-0000-0000-00000000a004';
  u_qs     CONSTANT uuid := '00000000-0000-0000-0000-00000000a005';
  u_cli    CONSTANT uuid := '00000000-0000-0000-0000-00000000a006';
  p1       CONSTANT uuid := '00000000-0000-0000-0000-0000000000b1';
  p2       CONSTANT uuid := '00000000-0000-0000-0000-0000000000b2';
BEGIN
  -- Ensure the active status exists (ID 1 is the default used in auth.ts).
  INSERT INTO public.user_statuses (status_id, status_name, is_active, description)
    VALUES (1, 'active', true, 'Active user')
    ON CONFLICT (status_id) DO NOTHING;

  -- Profiles for the six fake users.
  INSERT INTO public.profiles (id, full_name, status_id)
    VALUES
      (u_admin, 'pgTAP admin',   1),
      (u_mgr,   'pgTAP manager', 1),
      (u_fin,   'pgTAP finance', 1),
      (u_pm,    'pgTAP PM',      1),
      (u_qs,    'pgTAP QS',      1),
      (u_cli,   'pgTAP client',  1)
    ON CONFLICT (id) DO NOTHING;

  -- Role assignments.
  INSERT INTO public.user_roles (user_id, role_name)
    VALUES
      (u_admin, 'admin'),
      (u_mgr,   'manager'),
      (u_fin,   'finance'),
      (u_pm,    'project_manager'),
      (u_qs,    'quantity_surveyor'),
      (u_cli,   'client')
    ON CONFLICT DO NOTHING;

  -- Projects: p1 is the PM/QS/client's project; p2 is a decoy they must not see.
  INSERT INTO public.projects (id, project_number, title, client_id, manager_id, status)
    VALUES
      (p1, 'TEST-RLS-P1', 'RLS seed project',   u_cli,   u_pm,  'planning'),
      (p2, 'TEST-RLS-P2', 'RLS decoy project',  u_admin, u_mgr, 'planning')
    ON CONFLICT (id) DO NOTHING;

  -- Make the fake QS a surveyor on p1 only.
  INSERT INTO public.project_surveyors (project_id, user_id, assigned_by)
    VALUES (p1, u_qs, u_admin)
    ON CONFLICT DO NOTHING;

  -- Seed one finance row per table under test, on p1 only. Service_role
  -- bypasses RLS, which is why these inserts succeed from the test runner.
  INSERT INTO public.accounts_payable
    (project_id, vendor_name, invoice_number, etims_code, date, due_date,
     total_amount, receiving_account_code, is_legacy_adhoc)
    VALUES (p1, 'Vendor X', 'INV-001', 'ETIMS-1',
            CURRENT_DATE, CURRENT_DATE + 30, 100, '1000', true)
    ON CONFLICT DO NOTHING;

  INSERT INTO public.project_milestones (id, project_id, title, status, sort_order)
    VALUES ('00000000-0000-0000-0000-0000000000c1', p1, 'RLS test milestone',  'planned', 1)
    ON CONFLICT (id) DO NOTHING;
END $$;


-- ────────────────────────────────────────────────────────────────────────────
-- Helper: switch effective auth.uid() for the rest of the current transaction
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.auth_as(user_uuid uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', user_uuid::text)::text,
    true  -- local to this transaction
  );
  -- Also switch to the authenticated role so RLS actually applies (the
  -- test runner starts as superuser-equivalent which bypasses RLS).
  SET LOCAL ROLE authenticated;
END;
$$;

-- Helper to drop back to the test runner role.
CREATE OR REPLACE FUNCTION pg_temp.auth_reset()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 1. security.has_role / is_admin convenience fns return the right values
-- ────────────────────────────────────────────────────────────────────────────
SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a001');
SELECT ok(security.is_admin(),                   'admin: is_admin() true');
SELECT ok(NOT security.is_client(),              'admin: is_client() false');
SELECT ok(security.is_finance_or_up(),           'admin: is_finance_or_up() true');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a006');
SELECT ok(security.is_client(),                  'client: is_client() true');
SELECT ok(NOT security.is_admin(),               'client: is_admin() false');
SELECT ok(NOT security.is_finance_or_up(),       'client: is_finance_or_up() false');


-- ────────────────────────────────────────────────────────────────────────────
-- 2. projects — admin / manager / finance see all; others scoped
-- ────────────────────────────────────────────────────────────────────────────
SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a001'); -- admin
SELECT ok(
  (SELECT COUNT(*) FROM public.projects
   WHERE id IN ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2')) = 2,
  'admin sees both seeded projects');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a004'); -- PM
SELECT ok(
  (SELECT COUNT(*) FROM public.projects WHERE id = '00000000-0000-0000-0000-0000000000b1') = 1,
  'PM sees p1 (manager_id = me)');
SELECT ok(
  (SELECT COUNT(*) FROM public.projects WHERE id = '00000000-0000-0000-0000-0000000000b2') = 0,
  'PM does NOT see p2 (not assigned)');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a005'); -- QS
SELECT ok(
  (SELECT COUNT(*) FROM public.projects WHERE id = '00000000-0000-0000-0000-0000000000b1') = 1,
  'QS sees p1 (project_surveyors membership)');
SELECT ok(
  (SELECT COUNT(*) FROM public.projects WHERE id = '00000000-0000-0000-0000-0000000000b2') = 0,
  'QS does NOT see p2');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a006'); -- client
SELECT ok(
  (SELECT COUNT(*) FROM public.projects WHERE id = '00000000-0000-0000-0000-0000000000b1') = 1,
  'client sees own project (client_id = me)');
SELECT ok(
  (SELECT COUNT(*) FROM public.projects WHERE id = '00000000-0000-0000-0000-0000000000b2') = 0,
  'client does NOT see other projects');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a003'); -- finance
SELECT ok(
  (SELECT COUNT(*) FROM public.projects
   WHERE id IN ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2')) = 2,
  'finance sees both projects (read access to all)');


-- ────────────────────────────────────────────────────────────────────────────
-- 3. project_milestones inherit project access
-- ────────────────────────────────────────────────────────────────────────────
SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a006'); -- client
SELECT ok(
  (SELECT COUNT(*) FROM public.project_milestones
   WHERE id = '00000000-0000-0000-0000-0000000000c1') = 1,
  'client sees milestone on own project');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a005'); -- QS
SELECT ok(
  (SELECT COUNT(*) FROM public.project_milestones
   WHERE id = '00000000-0000-0000-0000-0000000000c1') = 1,
  'QS sees milestone on surveyed project');


-- ────────────────────────────────────────────────────────────────────────────
-- 4. accounts_payable — client denied entirely; QS/PM see only their project
-- ────────────────────────────────────────────────────────────────────────────
SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a006'); -- client
SELECT is(
  (SELECT COUNT(*) FROM public.accounts_payable WHERE invoice_number = 'INV-001')::int,
  0,
  'client cannot see any AP row');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a004'); -- PM
SELECT is(
  (SELECT COUNT(*) FROM public.accounts_payable WHERE invoice_number = 'INV-001')::int,
  1,
  'PM sees AP on their project');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a005'); -- QS
SELECT is(
  (SELECT COUNT(*) FROM public.accounts_payable WHERE invoice_number = 'INV-001')::int,
  1,
  'QS sees AP on surveyed project');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a003'); -- finance
SELECT is(
  (SELECT COUNT(*) FROM public.accounts_payable WHERE invoice_number = 'INV-001')::int,
  1,
  'finance sees AP');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a001'); -- admin
SELECT is(
  (SELECT COUNT(*) FROM public.accounts_payable WHERE invoice_number = 'INV-001')::int,
  1,
  'admin sees AP');


-- ────────────────────────────────────────────────────────────────────────────
-- 5. accounts_payable WRITES — client/PM/QS blocked; finance+/manager allowed
-- ────────────────────────────────────────────────────────────────────────────
SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a006'); -- client
SELECT throws_ok($$
  INSERT INTO public.accounts_payable
    (project_id, vendor_name, invoice_number, etims_code, date, due_date,
     total_amount, receiving_account_code, is_legacy_adhoc)
  VALUES ('00000000-0000-0000-0000-0000000000b1', 'X', 'EVIL-001', 'E', CURRENT_DATE, CURRENT_DATE,
          1, '1000', true)
$$, '42501', 'new row violates row-level security policy for table "accounts_payable"',
   'client cannot INSERT into accounts_payable');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a005'); -- QS
SELECT throws_ok($$
  INSERT INTO public.accounts_payable
    (project_id, vendor_name, invoice_number, etims_code, date, due_date,
     total_amount, receiving_account_code, is_legacy_adhoc)
  VALUES ('00000000-0000-0000-0000-0000000000b1', 'X', 'EVIL-002', 'E', CURRENT_DATE, CURRENT_DATE,
          1, '1000', true)
$$, '42501', 'new row violates row-level security policy for table "accounts_payable"',
   'QS cannot INSERT into accounts_payable');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a004'); -- PM
SELECT throws_ok($$
  INSERT INTO public.accounts_payable
    (project_id, vendor_name, invoice_number, etims_code, date, due_date,
     total_amount, receiving_account_code, is_legacy_adhoc)
  VALUES ('00000000-0000-0000-0000-0000000000b1', 'X', 'EVIL-003', 'E', CURRENT_DATE, CURRENT_DATE,
          1, '1000', true)
$$, '42501', 'new row violates row-level security policy for table "accounts_payable"',
   'PM cannot INSERT into accounts_payable (finance territory)');


-- ────────────────────────────────────────────────────────────────────────────
-- 6. bill_of_quantities — QS can write on surveyed; PM only reads
-- ────────────────────────────────────────────────────────────────────────────
SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a005'); -- QS
SELECT lives_ok($$
  INSERT INTO public.bill_of_quantities
    (project_id, description, unit, quantity, rate)
  VALUES ('00000000-0000-0000-0000-0000000000b1', 'Test item', 'no', 1, 100)
$$, 'QS can INSERT BoQ on surveyed project');

-- Decoy project — QS not assigned → should fail
SELECT throws_ok($$
  INSERT INTO public.bill_of_quantities
    (project_id, description, unit, quantity, rate)
  VALUES ('00000000-0000-0000-0000-0000000000b2', 'Decoy item', 'no', 1, 100)
$$, '42501', 'new row violates row-level security policy for table "bill_of_quantities"',
   'QS cannot INSERT BoQ on project they do not survey');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a004'); -- PM
SELECT is(
  (SELECT COUNT(*) FROM public.bill_of_quantities WHERE description = 'Test item')::int,
  1,
  'PM can read BoQ on managed project');
SELECT throws_ok($$
  INSERT INTO public.bill_of_quantities
    (project_id, description, unit, quantity, rate)
  VALUES ('00000000-0000-0000-0000-0000000000b1', 'PM BoQ item', 'no', 1, 100)
$$, '42501', 'new row violates row-level security policy for table "bill_of_quantities"',
   'PM cannot INSERT BoQ (QS/manager+ only)');


-- ────────────────────────────────────────────────────────────────────────────
-- 7. user_roles — users can see their own; others require admin
-- ────────────────────────────────────────────────────────────────────────────
SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a006'); -- client
SELECT is(
  (SELECT COUNT(*) FROM public.user_roles
   WHERE user_id = '00000000-0000-0000-0000-00000000a006')::int,
  1,
  'client reads own role row');
SELECT is(
  (SELECT COUNT(*) FROM public.user_roles
   WHERE user_id = '00000000-0000-0000-0000-00000000a001')::int,
  0,
  'client cannot read admin role row');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a001'); -- admin
SELECT ok(
  (SELECT COUNT(*) FROM public.user_roles) >= 6,
  'admin reads all role rows');


-- ────────────────────────────────────────────────────────────────────────────
-- 8. project_surveyors — anyone with project access reads; writes PM+
-- ────────────────────────────────────────────────────────────────────────────
SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a005'); -- QS
SELECT is(
  (SELECT COUNT(*) FROM public.project_surveyors
   WHERE project_id = '00000000-0000-0000-0000-0000000000b1')::int,
  1,
  'QS sees own surveyor assignment');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a006'); -- client (p1 owner)
SELECT is(
  (SELECT COUNT(*) FROM public.project_surveyors
   WHERE project_id = '00000000-0000-0000-0000-0000000000b1')::int,
  1,
  'client sees who the QS is on their project');

-- But client cannot ASSIGN a QS
SELECT throws_ok($$
  INSERT INTO public.project_surveyors (project_id, user_id)
  VALUES ('00000000-0000-0000-0000-0000000000b1',
          '00000000-0000-0000-0000-00000000a006')
$$, '42501', 'new row violates row-level security policy for table "project_surveyors"',
   'client cannot assign a QS');


-- ────────────────────────────────────────────────────────────────────────────
-- 9. security.has_project_access composition
-- ────────────────────────────────────────────────────────────────────────────
SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a005');
SELECT ok(security.has_project_access('00000000-0000-0000-0000-0000000000b1'),
          'QS has_project_access on surveyed project');
SELECT ok(NOT security.has_project_access('00000000-0000-0000-0000-0000000000b2'),
          'QS does NOT have_project_access on unassigned project');

SELECT pg_temp.auth_as('00000000-0000-0000-0000-00000000a006');
SELECT ok(security.has_project_access('00000000-0000-0000-0000-0000000000b1'),
          'client has_project_access on own project');
SELECT ok(NOT security.has_project_access('00000000-0000-0000-0000-0000000000b2'),
          'client does NOT have_project_access on another project');


-- ────────────────────────────────────────────────────────────────────────────
-- 10. AP hard CHECK — new rows without project_financial_id are rejected
-- ────────────────────────────────────────────────────────────────────────────
SELECT pg_temp.auth_reset();  -- back to superuser so RLS doesn't shadow the CHECK

SELECT throws_ok($$
  INSERT INTO public.accounts_payable
    (project_id, vendor_name, invoice_number, etims_code, date, due_date,
     total_amount, receiving_account_code)
  VALUES ('00000000-0000-0000-0000-0000000000b1', 'X', 'ADHOC-999', 'E',
          CURRENT_DATE, CURRENT_DATE, 1, '1000')
$$, '23514',
   NULL,
   'new AP without project_financial_id or legacy flag is rejected');

-- But WITH is_legacy_adhoc=true the row is accepted
SELECT lives_ok($$
  INSERT INTO public.accounts_payable
    (project_id, vendor_name, invoice_number, etims_code, date, due_date,
     total_amount, receiving_account_code, is_legacy_adhoc)
  VALUES ('00000000-0000-0000-0000-0000000000b1', 'X', 'LEGACY-999', 'E',
          CURRENT_DATE, CURRENT_DATE, 1, '1000', true)
$$, 'legacy-flagged AP without PM link is accepted');


-- ────────────────────────────────────────────────────────────────────────────
-- Done — rollback discards everything we seeded
-- ────────────────────────────────────────────────────────────────────────────
SELECT * FROM finish();

ROLLBACK;
