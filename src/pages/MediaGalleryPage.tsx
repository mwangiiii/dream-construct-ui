import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Loader2, Share2, ExternalLink, AlertCircle,
  Image as ImageIcon, PlayCircle, ChevronLeft, ChevronRight,
  Maximize2, ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useSiteSections } from "@/lib/sitePages";
import { renderMarkdown } from "@/lib/markdown";

interface MediaMetadata {
  completion_time?: string;
  client_satisfaction?: string;
  area?: string;
  location?: string;
  project_cost?: string;
  [key: string]: any;
}

interface MediaPost {
  id: string;
  created_at: string;
  updated_at: string;
  media_url: string;
  thumbnail_url: string | null;
  media_type: "image" | "video" | "audio" | "gif";
  file_size: number | null;
  mime_type: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  caption: string;
  alt_text: string | null;
  categories: string[];
  project_id: string | null;
  project_link: string | null;
  status: "draft" | "published" | "archived";
  is_pinned: boolean;
  pin_order: number | null;
  display_order: number | null;
  metadata: MediaMetadata;
  view_count: number;
  click_count: number;
  share_count: number;
  uploaded_by: string | null;
  deleted_at: string | null;
}

const CATEGORIES = [
  "Luxury Villa",
  "Apartments",
  "Commercial",
  "Renovations",
  "Before & After",
  "Client Testimonial",
  "Completed 2025",
  "Drone Shots",
];

// The other public pages, so the media centre is a route into the rest of the
// company rather than a dead end.
const COMPANY_LINKS = [
  { to: "/projects", label: "Projects", blurb: "Live and completed developments across our portfolio." },
  { to: "/services", label: "Services", blurb: "What we build, and how we deliver it." },
  { to: "/team",     label: "Our Team", blurb: "The people responsible for the work above." },
  { to: "/reviews",  label: "Reviews",  blurb: "What our clients say once we hand over." },
];

const EASE = [0.22, 1, 0.36, 1] as const;

const formatNumber = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const two = (n: number) => String(n).padStart(2, "0");

const MediaGalleryPage = () => {
  const [media, setMedia]                     = useState<MediaPost[]>([]);
  const [pinnedMedia, setPinnedMedia]         = useState<MediaPost[]>([]);
  const [searchQuery, setSearchQuery]         = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCats, setSelectedCats]       = useState<string[]>([]);
  const [activeFilter, setActiveFilter]       = useState("All");
  const [isLoading, setIsLoading]             = useState(true);
  const [isLoadingMore, setIsLoadingMore]     = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [hasMore, setHasMore]                 = useState(true);
  const [page, setPage]                       = useState(0);
  const [lightbox, setLightbox]               = useState<MediaPost | null>(null);
  const [lightboxIndex, setLightboxIndex]     = useState(0);
  const [initialMediaId, setInitialMediaId]   = useState<string | null>(null);

  // Hero / intro / closing copy, editable in Admin → Content → Pages. Falls
  // back to hardcoded strings so the page is never blank if a section is
  // unpublished or the table is empty.
  const { sections } = useSiteSections("media");

  const observerRef    = useRef<IntersectionObserver | null>(null);
  const loadMoreRef    = useRef<HTMLDivElement | null>(null);
  const viewTrackedRef = useRef<Set<string>>(new Set());
  const ITEMS_PER_PAGE = 24;

  // Featured first, then rest — masonry flows them all together.
  const allMedia = [...pinnedMedia, ...media];

  // ── Debounce ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Analytics ─────────────────────────────────────────────────────────────
  const trackView = useCallback(async (id: string) => {
    if (viewTrackedRef.current.has(id)) return;
    viewTrackedRef.current.add(id);
    try {
      await supabase.rpc("increment_media_view_count", { media_id: id });
      const bump = (arr: MediaPost[]) =>
        arr.map(i => i.id === id ? { ...i, view_count: i.view_count + 1 } : i);
      setMedia(bump); setPinnedMedia(bump);
    } catch {}
  }, []);

  const trackClick = useCallback(async (id: string) => {
    try {
      await supabase.rpc("increment_media_click_count", { media_id: id });
      const bump = (arr: MediaPost[]) =>
        arr.map(i => i.id === id ? { ...i, click_count: i.click_count + 1 } : i);
      setMedia(bump); setPinnedMedia(bump);
    } catch {}
  }, []);

  const trackShare = useCallback(async (id: string) => {
    try {
      await supabase.rpc("increment_media_share_count", { media_id: id });
      const bump = (arr: MediaPost[]) =>
        arr.map(i => i.id === id ? { ...i, share_count: i.share_count + 1 } : i);
      setMedia(bump); setPinnedMedia(bump);
    } catch {}
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchMedia = async (pageNum = 0, append = false) => {
    try {
      const offset = pageNum * ITEMS_PER_PAGE;
      let query = supabase
        .from("media_posts")
        .select("*")
        .eq("status", "published")
        .is("deleted_at", null)
        .order("is_pinned", { ascending: false })
        .order("pin_order",  { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + ITEMS_PER_PAGE - 1);

      if (selectedCats.length > 0) query = query.contains("categories", selectedCats);
      if (debouncedSearch.trim())
        query = query.or(`caption.ilike.%${debouncedSearch}%,metadata->>location.ilike.%${debouncedSearch}%`);

      const { data, error: e } = await query;
      if (e) throw e;

      const pinned  = data?.filter(i => i.is_pinned) || [];
      const regular = data?.filter(i => !i.is_pinned) || [];

      if (append) setMedia(prev => [...prev, ...regular]);
      else {
        setPinnedMedia(pinned);
        setMedia(regular);
      }
      setHasMore((data?.length || 0) === ITEMS_PER_PAGE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("media");
    if (id) setInitialMediaId(id);
    fetchMedia(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialMediaId) return;
    const found = allMedia.find(m => m.id === initialMediaId);
    if (found) { openLightbox(found); setInitialMediaId(null); return; }
    if (!isLoading && !error) {
      (async () => {
        const { data } = await supabase.from("media_posts").select("*")
          .eq("id", initialMediaId).eq("status", "published").is("deleted_at", null).single();
        if (data) openLightbox(data);
        setInitialMediaId(null);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMediaId, media, pinnedMedia, isLoading, error]);

  useEffect(() => {
    setError(null); setIsLoading(true); setPage(0);
    viewTrackedRef.current.clear();
    fetchMedia(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCats, debouncedSearch]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          setIsLoadingMore(true);
          const next = page + 1;
          setPage(next);
          fetchMedia(next, true);
        }
      },
      { threshold: 0.5 }
    );
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isLoading, isLoadingMore, page, selectedCats, debouncedSearch]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")     closeLightbox();
      if (e.key === "ArrowRight") navigateLightbox(1);
      if (e.key === "ArrowLeft")  navigateLightbox(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, lightboxIndex]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openLightbox = (item: MediaPost) => {
    const idx = allMedia.findIndex(m => m.id === item.id);
    setLightbox(item);
    setLightboxIndex(idx >= 0 ? idx : 0);
    trackClick(item.id);
  };
  const closeLightbox = () => setLightbox(null);
  const navigateLightbox = (dir: 1 | -1) => {
    const next = lightboxIndex + dir;
    if (next < 0 || next >= allMedia.length) return;
    setLightbox(allMedia[next]);
    setLightboxIndex(next);
  };
  const handleShare = async (item: MediaPost, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await trackShare(item.id);
    const url = `${window.location.origin}${window.location.pathname}?media=${item.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: item.caption, url }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(url); } catch {}
    }
  };
  const setFilter = (cat: string) => {
    setActiveFilter(cat);
    setSelectedCats(cat === "All" ? [] : [cat]);
  };
  const clearSearch = () => { setSearchQuery(""); setDebouncedSearch(""); };

  // ── Media card ────────────────────────────────────────────────────────────
  // Uniform aspect ratio rather than the previous masonry. A ragged Pinterest
  // column reads as a social feed; a catalogue grid reads as a company
  // portfolio, which is what this page is for.
  const MediaCard = ({ item, featured = false }: { item: MediaPost; featured?: boolean }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (!ref.current) return;
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) trackView(item.id); },
        { threshold: 0.4 }
      );
      obs.observe(ref.current);
      return () => obs.disconnect();
    }, [item.id]);

    return (
      <div
        ref={ref}
        className="group cursor-pointer"
        onClick={() => openLightbox(item)}
      >
        <div
          className={`relative overflow-hidden rounded-xl bg-card border border-white/10 group-hover:border-primary/40 transition-colors duration-300 ${
            featured ? "aspect-[16/10]" : "aspect-[4/3]"
          }`}
        >
          {item.media_type === "video" ? (
            <video
              src={item.thumbnail_url || item.media_url}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              muted loop playsInline preload="metadata"
              onMouseEnter={e => e.currentTarget.play()}
              onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
            />
          ) : (
            <img
              src={item.thumbnail_url || item.media_url}
              alt={item.alt_text || item.caption}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-transparent opacity-80 group-hover:opacity-95 transition-opacity duration-300" />

          {item.categories[0] && (
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-background/80 backdrop-blur-sm border border-white/10 text-[10px] font-semibold uppercase tracking-wider text-primary">
              {item.categories[0]}
            </span>
          )}

          {item.media_type === "video" && (
            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-white/10 flex items-center justify-center pointer-events-none">
              <PlayCircle className="w-4 h-4 text-primary" strokeWidth={1.75} />
            </div>
          )}

          <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
               style={{ marginTop: item.media_type === "video" ? "40px" : "0" }}>
            <button
              onClick={(e) => handleShare(item, e)}
              className="w-8 h-8 rounded-full bg-background/85 backdrop-blur-sm border border-white/10 hover:border-primary/50 text-foreground flex items-center justify-center transition"
              aria-label="Share"
            >
              <Share2 className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); openLightbox(item); }}
              className="w-8 h-8 rounded-full bg-background/85 backdrop-blur-sm border border-white/10 hover:border-primary/50 text-foreground flex items-center justify-center transition"
              aria-label="Expand"
            >
              <Maximize2 className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
            <h3 className={`font-semibold text-foreground leading-snug line-clamp-2 ${
              featured ? "text-lg sm:text-xl" : "text-sm sm:text-base"
            }`}>
              {item.caption}
            </h3>
            {(item.metadata.location || item.metadata.area) && (
              <p className="text-xs text-muted-foreground mt-1.5 truncate">
                {[item.metadata.location, item.metadata.area].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Lightbox — same solid one, slight polish ──────────────────────────────
  const LightboxModal = () => {
    if (!lightbox) return null;
    const hasPrev = lightboxIndex > 0;
    const hasNext = lightboxIndex < allMedia.length - 1;

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex flex-col lg:items-center lg:justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
          <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-20 text-xs tabular-nums text-white/50 pointer-events-none">
            {two(lightboxIndex + 1)} / {two(allMedia.length)}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="w-full h-full lg:h-auto lg:max-h-[92vh] lg:max-w-6xl flex flex-col lg:flex-row lg:rounded-2xl overflow-hidden lg:shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative bg-black flex items-center justify-center flex-shrink-0
                            h-[46vh] sm:h-[52vh] lg:h-auto lg:flex-1 min-h-0">
              {lightbox.media_type === "video" ? (
                <video
                  key={lightbox.id}
                  src={lightbox.media_url}
                  controls autoPlay
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  key={lightbox.id}
                  src={lightbox.media_url}
                  alt={lightbox.alt_text || lightbox.caption}
                  className="w-full h-full object-contain"
                />
              )}

              {hasPrev && (
                <button
                  onClick={e => { e.stopPropagation(); navigateLightbox(-1); }}
                  className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                </button>
              )}
              {hasNext && (
                <button
                  onClick={e => { e.stopPropagation(); navigateLightbox(1); }}
                  className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition"
                >
                  <ChevronRight className="w-4 h-4" strokeWidth={2} />
                </button>
              )}
            </div>

            <div className="flex-1 lg:flex-none lg:w-[360px] xl:w-[400px] bg-zinc-950 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 sm:py-6 space-y-5">
                <div className="flex flex-wrap gap-1.5">
                  {lightbox.categories.slice(0, 3).map(cat => (
                    <span key={cat} className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/85 text-xs font-medium">
                      {cat}
                    </span>
                  ))}
                </div>

                <h2 className="text-xl sm:text-2xl font-semibold text-white leading-snug tracking-tight">
                  {lightbox.caption}
                </h2>

                {Object.values(lightbox.metadata).some(Boolean) && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {lightbox.metadata.location && <StatCell label="Location" value={lightbox.metadata.location} />}
                    {lightbox.metadata.area && <StatCell label="Area" value={lightbox.metadata.area} />}
                    {lightbox.metadata.project_cost && <StatCell label="Value" value={lightbox.metadata.project_cost} />}
                    {lightbox.metadata.completion_time && <StatCell label="Timeline" value={lightbox.metadata.completion_time} />}
                    {lightbox.metadata.client_satisfaction && (
                      <div className="col-span-2 bg-white/5 rounded-xl p-3 border border-white/8">
                        <p className="text-[10px] text-white/45 uppercase tracking-wider mb-0.5">Client</p>
                        <p className="text-sm font-medium text-white">{lightbox.metadata.client_satisfaction}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-5 text-xs text-white/45 tabular-nums pt-2 border-t border-white/8">
                  <span>{formatNumber(lightbox.view_count)} views</span>
                  <span>{lightbox.share_count} shares</span>
                </div>
              </div>

              <div className="px-5 sm:px-6 py-4 border-t border-white/10 flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleShare(lightbox)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition"
                >
                  <Share2 className="w-4 h-4" strokeWidth={2} /> Share
                </button>
                {lightbox.project_link && (
                  <button
                    onClick={() => window.open(lightbox.project_link!, "_blank")}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition"
                  >
                    <ExternalLink className="w-4 h-4" strokeWidth={2} /> View
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  const StatCell = ({ label, value }: { label: string; value: string }) => (
    <div className="bg-white/5 rounded-xl p-3 border border-white/8">
      <p className="text-[10px] text-white/45 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-white truncate">{value}</p>
    </div>
  );

  const totalItems = allMedia.length;
  const hasFilters = activeFilter !== "All" || !!searchQuery;

  // Featured work gets its own band, but only on the unfiltered view — a
  // "Featured" heading above category results would be misleading. Once
  // filtering, pinned items fall back into the main grid.
  //
  // The band shows at most FEATURED_LIMIT; any pinned item beyond that is
  // appended to the grid, so nothing is ever rendered nowhere.
  const FEATURED_LIMIT = 4;
  const featured = hasFilters ? [] : pinnedMedia.slice(0, FEATURED_LIMIT);
  const gridItems = hasFilters
    ? allMedia
    : [...pinnedMedia.slice(FEATURED_LIMIT), ...media];

  const hero = sections.hero;
  const intro = sections.intro;
  const cta = sections.cta;

  const filmCount = allMedia.filter(m => m.media_type === "video").length;
  const locationCount = new Set(
    allMedia.map(m => m.metadata?.location).filter(Boolean)
  ).size;

  return (
    <div className="min-h-screen bg-background">

      {/* ── Editorial hero ────────────────────────────────────────────────── */}
      {/* pt-32 clears the fixed Navbar from MainLayout, which the old sticky
          topbar sat underneath. */}
      <section className="relative pt-32 pb-14 sm:pt-40 sm:pb-20 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 0%, hsl(var(--primary) / 0.10), transparent 70%)",
          }}
        />
        <div className="relative container mx-auto px-4 sm:px-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="h-px w-8 bg-primary/60" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                Media Centre
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              {hero?.heading ?? "Our Work in Focus"}
            </h1>

            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
              {hero?.subheading ??
                "Project photography, site films and company updates from across our portfolio."}
            </p>

            {hero?.cta_label && hero.cta_href && (
              <Link
                to={hero.cta_href}
                className="inline-flex items-center gap-2 mt-7 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition"
              >
                {hero.cta_label}
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {/* Portfolio figures. Derived from what is loaded, so they never
              overstate — no hardcoded marketing numbers. */}
          {!isLoading && totalItems > 0 && (
            <dl className="mt-12 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl border-t border-border pt-8">
              {[
                { label: "Pieces published", value: totalItems },
                { label: "Site films", value: filmCount },
                { label: "Locations", value: locationCount },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
                  <dd className="text-2xl sm:text-3xl font-bold text-foreground mt-1.5 tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* ── Editable intro copy ───────────────────────────────────────────── */}
      {(intro?.heading || intro?.body) && (
        <section className="border-y border-border bg-card/30">
          <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {intro.heading && (
                <h2 className="lg:col-span-4 text-2xl sm:text-3xl font-bold tracking-tight">
                  {intro.heading}
                </h2>
              )}
              {intro.body && (
                <div
                  className="lg:col-span-8 text-muted-foreground leading-relaxed space-y-4 [&_strong]:text-foreground [&_a]:text-primary"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(intro.body) }}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Featured work ─────────────────────────────────────────────────── */}
      {!isLoading && !error && featured.length > 0 && (
        <section className="container mx-auto px-4 sm:px-6 pt-14 sm:pt-20">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Featured Work</h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Selected projects from across the portfolio.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {featured.map(item => (
              <MediaCard key={item.id} item={item} featured />
            ))}
          </div>
        </section>
      )}

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      {/* top-[72px] sits it directly beneath the scrolled Navbar. */}
      <div className="sticky top-[72px] z-30 bg-background/90 backdrop-blur-xl border-b border-border mt-14 sm:mt-20">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={2} />
              <input
                type="text"
                placeholder="Search projects, locations…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-muted/40 border border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 rounded-xl text-sm placeholder:text-muted-foreground/70 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </div>

            <div
              className="flex-1 flex gap-1.5 overflow-x-auto lg:justify-end"
              style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
            >
              {["All", ...CATEGORIES].map(cat => {
                const active = activeFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition ${
                      active
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-transparent border-white/10 text-muted-foreground hover:text-foreground hover:border-white/25"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      <main className="container mx-auto px-4 sm:px-6 py-10 sm:py-14">

        {isLoading && !error && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-6 h-6 animate-spin text-primary" strokeWidth={2} />
          </div>
        )}

        {error && (
          <div className="max-w-sm mx-auto py-28 text-center space-y-5">
            <AlertCircle className="w-10 h-10 text-destructive/70 mx-auto" strokeWidth={1.5} />
            <div>
              <p className="text-base font-semibold mb-1">Couldn't load the media library</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <button
              onClick={() => { setError(null); setIsLoading(true); fetchMedia(0, false); }}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && totalItems === 0 && (
          <div className="max-w-sm mx-auto py-28 text-center space-y-4">
            <ImageIcon className="w-10 h-10 text-muted-foreground/40 mx-auto" strokeWidth={1.5} />
            <div>
              <p className="text-base font-semibold mb-1">Nothing to show here yet</p>
              <p className="text-sm text-muted-foreground">
                {hasFilters
                  ? "No media matches that filter."
                  : "Published media will appear here."}
              </p>
            </div>
            {hasFilters && (
              <button
                onClick={() => { setFilter("All"); clearSearch(); }}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && gridItems.length > 0 && (
          <>
            <div className="flex items-end justify-between gap-4 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                {activeFilter === "All" ? "All Media" : activeFilter}
              </h2>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {gridItems.length} item{gridItems.length !== 1 ? "s" : ""}
              </span>
            </div>

            <motion.div
              key={activeFilter + debouncedSearch}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            >
              {gridItems.map(item => (
                <MediaCard key={item.id} item={item} />
              ))}
            </motion.div>

            <div ref={loadMoreRef} className="py-12 flex justify-center">
              {isLoadingMore && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" strokeWidth={2} />
                  Loading more…
                </div>
              )}
            </div>

            {!hasMore && (
              <div className="text-center text-xs text-muted-foreground/60 tracking-wide">
                End of library · {totalItems} item{totalItems !== 1 ? "s" : ""}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Company-wide content ──────────────────────────────────────────── */}
      <section className="border-t border-border bg-card/30">
        <div className="container mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Explore more</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Other parts of the company you may be looking for.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {COMPANY_LINKS.map(({ to, label, blurb }) => (
              <Link key={to} to={to} className="group block">
                <div className="h-full p-5 rounded-xl glass border border-white/10 hover:border-primary/40 transition-all duration-300">
                  <h3 className="font-semibold group-hover:text-primary transition-colors">
                    {label}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{blurb}</p>
                  <ArrowRight className="w-4 h-4 text-primary mt-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing call to action ────────────────────────────────────────── */}
      {cta?.heading && (
        <section className="border-t border-border">
          <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl mx-auto">
              {cta.heading}
            </h2>
            {cta.subheading && (
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
                {cta.subheading}
              </p>
            )}
            {cta.cta_label && cta.cta_href && (
              <Link
                to={cta.cta_href}
                className="inline-flex items-center gap-2 mt-8 px-7 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition"
              >
                {cta.cta_label}
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </section>
      )}

      {lightbox && <LightboxModal />}
    </div>
  );
};

export default MediaGalleryPage;
