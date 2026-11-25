-- =============================================================================
--  Public Terms of Service / Privacy Policy on the existing policies tables.
--
--  Login.tsx already links to /terms and /privacy, but no such routes existed
--  and policy content was readable only `TO authenticated` — so an anonymous
--  visitor could not have read them even if the pages existed. This opens a
--  narrow, explicitly-flagged public lane.
--
--  ── Exposure model ─────────────────────────────────────────────────────────
--  Public legal docs share a table with internal staff policies, so the gate
--  is deliberately a DOUBLE opt-in and defaults to closed:
--
--      anon can read a policy  <=>  policies.is_public
--                                   AND policies.is_active
--                                   AND its category.is_public
--
--  Flagging one row public is therefore not enough; the category must be
--  public too. Both default to FALSE, so every existing staff policy stays
--  private with no migration of data.
--
--  ── Fixing the write policies while we are here ────────────────────────────
--  The original policies from 20260306085619 gate writes on
--  `profiles.role IN ('admin','manager')`. public.profiles has no `role`
--  column (see 20251127170432_profiles.sql) — roles live in user_roles and are
--  read via the security.* helpers introduced in 20260930101000. Those policies
--  are therefore either dead or relying on an untracked column, which would
--  make an admin editor fail to save for reasons nobody could see.
--
--  All four are replaced with helper-based equivalents. security.is_manager_or_up()
--  is admin + manager, matching the original intent exactly.
-- =============================================================================


-- ── 1. Public flags, closed by default ──────────────────────────────────────
ALTER TABLE public.policy_categories
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.policy_categories.is_public IS
  'TRUE exposes this category to anonymous visitors (e.g. Terms of Service, '
  'Privacy Policy). Required in addition to policies.is_public — both gates '
  'must open before anon can read a section.';

COMMENT ON COLUMN public.policies.is_public IS
  'TRUE publishes this section to the public legal pages, but only when its '
  'category is also is_public and this row is is_active. Defaults FALSE so '
  'internal staff policies are never exposed by accident.';

CREATE INDEX IF NOT EXISTS policy_categories_public_idx
  ON public.policy_categories(slug) WHERE is_public;
CREATE INDEX IF NOT EXISTS policies_public_idx
  ON public.policies(category_id) WHERE is_public AND is_active;


-- ── 2. Replace the stale profiles.role policies ─────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read policy_categories" ON public.policy_categories;
DROP POLICY IF EXISTS "Admins can manage policy_categories"            ON public.policy_categories;
DROP POLICY IF EXISTS "Authenticated non-clients can read policies"    ON public.policies;
DROP POLICY IF EXISTS "Admins can read all policies"                   ON public.policies;
DROP POLICY IF EXISTS "Admins can manage policies"                     ON public.policies;

DROP POLICY IF EXISTS policy_categories_public_read ON public.policy_categories;
DROP POLICY IF EXISTS policy_categories_staff_read  ON public.policy_categories;
DROP POLICY IF EXISTS policy_categories_write       ON public.policy_categories;
DROP POLICY IF EXISTS policies_public_read          ON public.policies;
DROP POLICY IF EXISTS policies_staff_read           ON public.policies;
DROP POLICY IF EXISTS policies_write                ON public.policies;


-- ── 3. policy_categories ────────────────────────────────────────────────────
-- Anonymous visitors: public categories only. Granted to anon AND
-- authenticated so a logged-in client also reaches the legal pages.
CREATE POLICY policy_categories_public_read ON public.policy_categories
  FOR SELECT TO anon, authenticated
  USING (is_public);

-- Internal staff: everything. Clients are excluded — they have no business in
-- the internal policy library, which was the original intent of the
-- "NOT IN ('client')" check.
CREATE POLICY policy_categories_staff_read ON public.policy_categories
  FOR SELECT TO authenticated
  USING (NOT security.is_client());

CREATE POLICY policy_categories_write ON public.policy_categories
  FOR ALL TO authenticated
  USING (security.is_manager_or_up())
  WITH CHECK (security.is_manager_or_up());


-- ── 4. policies ─────────────────────────────────────────────────────────────
-- The public lane: all three conditions, including the parent category's flag.
CREATE POLICY policies_public_read ON public.policies
  FOR SELECT TO anon, authenticated
  USING (
    is_public
    AND is_active
    AND EXISTS (
      SELECT 1 FROM public.policy_categories c
      WHERE c.id = category_id AND c.is_public
    )
  );

-- Staff read the internal library. manager+ additionally sees inactive drafts,
-- which the admin editor needs in order to list and publish them.
CREATE POLICY policies_staff_read ON public.policies
  FOR SELECT TO authenticated
  USING (
    security.is_manager_or_up()
    OR (is_active AND NOT security.is_client())
  );

CREATE POLICY policies_write ON public.policies
  FOR ALL TO authenticated
  USING (security.is_manager_or_up())
  WITH CHECK (security.is_manager_or_up());


-- ── 5. Seed the two public documents ────────────────────────────────────────
-- Created already-public with placeholder bodies so the /terms and /privacy
-- routes resolve immediately and admin has something concrete to edit. The
-- placeholder text states plainly that it is not final, so it cannot be
-- mistaken for reviewed legal copy.
INSERT INTO public.policy_categories (title, slug, description, icon, sort_order, is_public)
VALUES
  ('Terms of Service', 'terms-of-service',
   'The terms governing use of Dream Construct System.', 'FileText', 100, true),
  ('Privacy Policy', 'privacy-policy',
   'How Dream Construct System collects, uses and protects your data.', 'ShieldCheck', 101, true)
ON CONFLICT (slug) DO UPDATE
  SET is_public = true,
      title     = EXCLUDED.title;

INSERT INTO public.policies (category_id, title, content, is_active, is_public, sort_order)
SELECT c.id, v.title, v.content, true, true, v.sort_order
FROM public.policy_categories c
JOIN (VALUES
  ('terms-of-service', 'Acceptance of Terms',
   E'**This is placeholder text and has not been reviewed. Replace it before relying on it.**\n\nBy accessing or using Dream Construct System you agree to be bound by these terms. If you do not agree, do not use the service.',
   1),
  ('terms-of-service', 'Use of the Service',
   E'**Placeholder — pending review.**\n\nYou agree to use the service only for lawful purposes and not to interfere with its operation or attempt to access data you are not authorised to see.',
   2),
  ('privacy-policy', 'Information We Collect',
   E'**This is placeholder text and has not been reviewed. Replace it before relying on it.**\n\nWe collect the information you provide when you create an account or use the service, including your name, email address and project records.',
   1),
  ('privacy-policy', 'How We Use Your Information',
   E'**Placeholder — pending review.**\n\nWe use your information to operate the service, authenticate you and communicate about your projects. We do not sell your personal data.',
   2)
) AS v(slug, title, content, sort_order)
  ON v.slug = c.slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.policies p
  WHERE p.category_id = c.id AND p.title = v.title
);
