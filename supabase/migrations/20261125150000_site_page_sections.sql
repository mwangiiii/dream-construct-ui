-- =============================================================================
--  Editable content blocks for the public marketing pages.
--
--  Admin → Content → Pages was a stub ("Page content editor coming soon"), so
--  every headline on the public site was hardcoded in TSX and only a developer
--  could change it. This gives the existing content service a third store
--  alongside media_posts and reviews.
--
--  ── Why sections and not whole pages ───────────────────────────────────────
--  page_slug is matched against routes that already exist in App.tsx. Content
--  cannot create a route, so letting an admin invent arbitrary pages would
--  produce rows that render nowhere. The page list therefore lives in code
--  (SITE_PAGES in src/lib/sitePages.ts) and this table holds the blocks within
--  those pages.
--
--  section_key is the stable handle the frontend reads ("hero", "intro"). It is
--  unique per page and is what a component looks up, so renaming a heading in
--  the admin UI can never break a page.
--
--  ── Exposure ────────────────────────────────────────────────────────────────
--  This is marketing copy and is meant to be world-readable, but only when
--  published. anon sees is_published rows; manager+ sees everything so the
--  editor can list and preview drafts.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.site_page_sections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug    text        NOT NULL,
  section_key  text        NOT NULL,
  heading      text,
  subheading   text,
  body         text,
  image_url    text,
  cta_label    text,
  cta_href     text,
  is_published boolean     NOT NULL DEFAULT false,
  sort_order   integer     NOT NULL DEFAULT 100,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT site_page_sections_page_section_key UNIQUE (page_slug, section_key),

  -- Keys are read by code, so keep them machine-safe rather than relying on
  -- the admin UI to be the only writer.
  CONSTRAINT site_page_sections_slug_format
    CHECK (page_slug ~ '^[a-z0-9][a-z0-9-]*$'),
  CONSTRAINT site_page_sections_key_format
    CHECK (section_key ~ '^[a-z0-9][a-z0-9_-]*$'),

  -- A call to action with a label but nowhere to go renders a dead button.
  CONSTRAINT site_page_sections_cta_complete
    CHECK ((cta_label IS NULL) = (cta_href IS NULL))
);

COMMENT ON TABLE public.site_page_sections IS
  'Editable content blocks for the public marketing pages. page_slug must match '
  'a route defined in App.tsx; see SITE_PAGES in src/lib/sitePages.ts.';

COMMENT ON COLUMN public.site_page_sections.section_key IS
  'Stable handle the frontend looks up (e.g. "hero"). Unique per page. Renaming '
  'the heading is safe; renaming this is a code change.';

COMMENT ON COLUMN public.site_page_sections.body IS
  'Markdown. Rendered through src/lib/markdown.ts, which escapes HTML first.';

CREATE INDEX IF NOT EXISTS site_page_sections_page_idx
  ON public.site_page_sections(page_slug, sort_order);

CREATE INDEX IF NOT EXISTS site_page_sections_published_idx
  ON public.site_page_sections(page_slug, sort_order) WHERE is_published;

CREATE INDEX IF NOT EXISTS site_page_sections_updated_by_idx
  ON public.site_page_sections(updated_by);


-- ── updated_at maintenance ──────────────────────────────────────────────────
-- SECURITY DEFINER with a pinned search_path, matching the convention from
-- 20261124110000_linter_search_path_and_grants.
CREATE OR REPLACE FUNCTION public.touch_site_page_section()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_site_page_section() FROM anon, authenticated;

DROP TRIGGER IF EXISTS site_page_sections_touch ON public.site_page_sections;
CREATE TRIGGER site_page_sections_touch
  BEFORE UPDATE ON public.site_page_sections
  FOR EACH ROW EXECUTE FUNCTION public.touch_site_page_section();


-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.site_page_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_page_sections_public_read ON public.site_page_sections;
DROP POLICY IF EXISTS site_page_sections_staff_read  ON public.site_page_sections;
DROP POLICY IF EXISTS site_page_sections_write       ON public.site_page_sections;

CREATE POLICY site_page_sections_public_read ON public.site_page_sections
  FOR SELECT TO anon, authenticated
  USING (is_published);

-- Drafts, for the editor's list and preview.
CREATE POLICY site_page_sections_staff_read ON public.site_page_sections
  FOR SELECT TO authenticated
  USING (security.is_manager_or_up());

CREATE POLICY site_page_sections_write ON public.site_page_sections
  FOR ALL TO authenticated
  USING (security.is_manager_or_up())
  WITH CHECK (security.is_manager_or_up());


-- ── Seed ────────────────────────────────────────────────────────────────────
-- Seeded published, because these replace copy that is already live and
-- visible; an unpublished seed would blank the sections that read from here.
INSERT INTO public.site_page_sections
  (page_slug, section_key, heading, subheading, body, sort_order, is_published)
VALUES
  ('media', 'hero',
   'Our Work in Focus',
   'Project photography, site films and company updates from across our portfolio.',
   NULL, 10, true),

  ('media', 'intro',
   'Built to last',
   NULL,
   E'Every project below was delivered by our own teams. Browse by category, or open any item for the full detail — location, programme and completion.',
   20, true),

  ('media', 'cta',
   'Have a project in mind?',
   'Talk to our team about what you are planning.',
   NULL, 90, true)
ON CONFLICT (page_slug, section_key) DO NOTHING;

UPDATE public.site_page_sections
   SET cta_label = 'Contact us', cta_href = '/contact'
 WHERE page_slug = 'media' AND section_key = 'cta' AND cta_label IS NULL;
