import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// The pages an admin can edit content for.
//
// Deliberately a code constant, not a table: content cannot create a route, so
// an admin-invented page would store rows that render nowhere. Each slug below
// corresponds to a route in App.tsx. Adding a page here is a two-line change
// plus wiring useSiteSections into that page's component.

export interface SitePage {
  slug: string;
  label: string;
  route: string;
  description: string;
}

export const SITE_PAGES: SitePage[] = [
  { slug: "media", label: "Media Centre", route: "/media",
    description: "Hero, introduction and closing call to action on the public media page." },
  { slug: "home", label: "Home", route: "/",
    description: "Landing page copy." },
  { slug: "services", label: "Services", route: "/services",
    description: "Services page headings and intro copy." },
  { slug: "team", label: "Team", route: "/team",
    description: "Team page copy." },
  { slug: "contact", label: "Contact", route: "/contact",
    description: "Contact page copy." },
];

export interface SiteSection {
  id: string;
  page_slug: string;
  section_key: string;
  heading: string | null;
  subheading: string | null;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  is_published: boolean;
  sort_order: number;
  updated_at: string;
}

export const SECTION_COLUMNS =
  "id, page_slug, section_key, heading, subheading, body, image_url, " +
  "cta_label, cta_href, is_published, sort_order, updated_at";

/**
 * Published sections for one page, keyed by section_key.
 *
 * RLS does the filtering — anon only ever receives published rows — so this is
 * safe to call from public pages. Returns an empty map until loaded, letting
 * callers fall back to their hardcoded copy rather than flashing blank.
 */
export function useSiteSections(pageSlug: string) {
  const [sections, setSections] = useState<Record<string, SiteSection>>({});
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("site_page_sections")
      .select(SECTION_COLUMNS)
      .eq("page_slug", pageSlug)
      .eq("is_published", true)
      .order("sort_order");

    if (!error && data) {
      const map: Record<string, SiteSection> = {};
      // SECTION_COLUMNS is a built string, so supabase-js cannot infer the row
      // shape from it; the cast is what the column list already guarantees.
      for (const row of data as unknown as SiteSection[]) map[row.section_key] = row;
      setSections(map);
    }
    setLoaded(true);
  }, [pageSlug]);

  useEffect(() => { load(); }, [load]);

  return { sections, loaded };
}
