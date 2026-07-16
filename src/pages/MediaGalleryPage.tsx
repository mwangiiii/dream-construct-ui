import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Loader2, Share2, ExternalLink, AlertCircle,
  Image as ImageIcon, PlayCircle, ChevronLeft, ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

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

// Restrained motion. Long, easeOut cubic-bezier — the same shape Apple uses.
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const observerRef    = useRef<IntersectionObserver | null>(null);
  const loadMoreRef    = useRef<HTMLDivElement | null>(null);
  const viewTrackedRef = useRef<Set<string>>(new Set());
  const ITEMS_PER_PAGE = 18;

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
  const handleShare = async (item: MediaPost) => {
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

  // ── View tracking hook — attach once per card ─────────────────────────────
  const useViewTracker = (id: string) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (!ref.current) return;
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) trackView(id); },
        { threshold: 0.4 }
      );
      obs.observe(ref.current);
      return () => obs.disconnect();
    }, [id]);
    return ref;
  };

  // ── Media thumb — clean, no overlays, no badges ───────────────────────────
  const MediaThumb = ({
    item, className = ""
  }: { item: MediaPost; className?: string }) => (
    <div className={`relative overflow-hidden bg-zinc-950 ${className}`}>
      {item.media_type === "video" ? (
        <>
          <video
            src={item.thumbnail_url || item.media_url}
            className="w-full h-full object-cover"
            muted loop playsInline
            onMouseEnter={e => e.currentTarget.play()}
            onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
              <PlayCircle className="w-7 h-7 text-white" strokeWidth={1} />
            </div>
          </div>
        </>
      ) : (
        <img
          src={item.thumbnail_url || item.media_url}
          alt={item.alt_text || item.caption}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}
    </div>
  );

  // ── Editorial featured hero — image on top, caption below ─────────────────
  const FeaturedHero = ({ item }: { item: MediaPost }) => {
    const ref = useViewTracker(item.id);
    return (
      <motion.article
        ref={ref}
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 0.9, ease: EASE }}
        className="cursor-pointer group"
        onClick={() => openLightbox(item)}
      >
        <div className="relative overflow-hidden rounded-[2px] mb-6 lg:mb-10">
          <MediaThumb
            item={item}
            className="aspect-[16/9] w-full transition-[filter] duration-[900ms] ease-out group-hover:brightness-[1.03]"
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-16">
          <div className="lg:col-span-8">
            {item.categories[0] && (
              <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-3">
                {item.categories[0]}
              </p>
            )}
            <h3 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-medium tracking-[-0.02em] leading-[1.05] text-foreground">
              {item.caption}
            </h3>
          </div>
          <div className="lg:col-span-4 lg:pt-2 flex flex-col justify-end">
            <dl className="space-y-3 text-sm">
              {item.metadata.location && <MetaLine label="Location" value={item.metadata.location} />}
              {item.metadata.area && <MetaLine label="Area" value={item.metadata.area} />}
              {item.metadata.project_cost && <MetaLine label="Value" value={item.metadata.project_cost} />}
              {item.metadata.completion_time && <MetaLine label="Timeline" value={item.metadata.completion_time} />}
            </dl>
            <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              View project <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
          </div>
        </div>
      </motion.article>
    );
  };

  // ── Featured secondary — magazine spread pair ─────────────────────────────
  const FeaturedSecondary = ({ item }: { item: MediaPost }) => {
    const ref = useViewTracker(item.id);
    return (
      <motion.article
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 0.7, ease: EASE }}
        className="cursor-pointer group"
        onClick={() => openLightbox(item)}
      >
        <div className="relative overflow-hidden mb-5 lg:mb-6">
          <MediaThumb
            item={item}
            className="aspect-[4/5] w-full transition-[filter] duration-[900ms] ease-out group-hover:brightness-[1.03]"
          />
        </div>
        <div>
          {item.categories[0] && (
            <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-2">
              {item.categories[0]}
            </p>
          )}
          <h3 className="text-lg lg:text-xl font-medium tracking-[-0.01em] leading-snug text-foreground mb-3 line-clamp-2">
            {item.caption}
          </h3>
          {item.metadata.location && (
            <p className="text-sm text-muted-foreground">{item.metadata.location}</p>
          )}
        </div>
      </motion.article>
    );
  };

  // ── Grid card — quiet, typography-led ─────────────────────────────────────
  const GridCard = ({ item }: { item: MediaPost }) => {
    const ref = useViewTracker(item.id);
    return (
      <motion.article
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 0.6, ease: EASE }}
        className="cursor-pointer group"
        onClick={() => openLightbox(item)}
      >
        <div className="relative overflow-hidden mb-4">
          <MediaThumb
            item={item}
            className="aspect-[4/5] w-full transition-[filter] duration-[700ms] ease-out group-hover:brightness-[1.04]"
          />
        </div>
        {item.categories[0] && (
          <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-2">
            {item.categories[0]}
          </p>
        )}
        <h3 className="text-base font-medium tracking-[-0.005em] leading-snug text-foreground line-clamp-2 mb-1">
          {item.caption}
        </h3>
        {item.metadata.location && (
          <p className="text-sm text-muted-foreground">{item.metadata.location}</p>
        )}
      </motion.article>
    );
  };

  // ── Meta line: label / value with hairline ─────────────────────────────────
  const MetaLine = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline justify-between gap-4 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
      <dt className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/70">{label}</dt>
      <dd className="text-sm text-foreground text-right truncate max-w-[65%]">{value}</dd>
    </div>
  );

  // ── Lightbox — refined ─────────────────────────────────────────────────────
  const LightboxModal = () => {
    if (!lightbox) return null;
    const hasPrev = lightboxIndex > 0;
    const hasNext = lightboxIndex < allMedia.length - 1;

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex flex-col lg:items-center lg:justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 w-10 h-10 rounded-full bg-white/8 hover:bg-white/15 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-20 text-[11px] tracking-[0.2em] uppercase text-white/40 tabular-nums pointer-events-none">
            {two(lightboxIndex + 1)} / {two(allMedia.length)}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="w-full h-full lg:h-auto lg:max-h-[92vh] lg:max-w-6xl flex flex-col lg:flex-row lg:rounded-sm overflow-hidden"
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
                  className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/8 hover:bg-white/15 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
              {hasNext && (
                <button
                  onClick={e => { e.stopPropagation(); navigateLightbox(1); }}
                  className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/8 hover:bg-white/15 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition"
                >
                  <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
            </div>

            <div className="flex-1 lg:flex-none lg:w-[380px] xl:w-[420px] bg-zinc-950 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain px-6 sm:px-8 py-6 sm:py-10 space-y-8" style={{ WebkitOverflowScrolling: "touch" }}>
                {lightbox.categories[0] && (
                  <p className="text-[10px] tracking-[0.3em] uppercase text-white/45">
                    {lightbox.categories.slice(0, 2).join(" · ")}
                  </p>
                )}
                <h2 className="text-xl sm:text-2xl font-medium tracking-[-0.01em] leading-snug text-white">
                  {lightbox.caption}
                </h2>

                {Object.values(lightbox.metadata).some(Boolean) && (
                  <dl className="space-y-4">
                    {lightbox.metadata.location && <LightboxMeta label="Location" value={lightbox.metadata.location} />}
                    {lightbox.metadata.area && <LightboxMeta label="Area" value={lightbox.metadata.area} />}
                    {lightbox.metadata.project_cost && <LightboxMeta label="Value" value={lightbox.metadata.project_cost} />}
                    {lightbox.metadata.completion_time && <LightboxMeta label="Timeline" value={lightbox.metadata.completion_time} />}
                    {lightbox.metadata.client_satisfaction && <LightboxMeta label="Client" value={lightbox.metadata.client_satisfaction} />}
                  </dl>
                )}

                <div className="flex items-center gap-6 text-[11px] tracking-[0.15em] uppercase text-white/40 tabular-nums">
                  <span>{formatNumber(lightbox.view_count)} views</span>
                  <span>{lightbox.share_count} shares</span>
                </div>
              </div>

              <div className="px-6 sm:px-8 py-5 border-t border-white/10 flex gap-3 flex-shrink-0">
                <button
                  onClick={() => handleShare(lightbox)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-sm bg-white/8 hover:bg-white/12 text-white text-sm font-medium border border-white/10 transition"
                >
                  <Share2 className="w-4 h-4" strokeWidth={1.5} /> Share
                </button>
                {lightbox.project_link && (
                  <button
                    onClick={() => window.open(lightbox.project_link!, "_blank")}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-sm bg-white text-black text-sm font-medium hover:bg-white/90 transition"
                  >
                    <ExternalLink className="w-4 h-4" strokeWidth={1.5} /> View project
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  const LightboxMeta = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/8 pb-3">
      <dt className="text-[10px] tracking-[0.25em] uppercase text-white/40">{label}</dt>
      <dd className="text-sm text-white text-right truncate max-w-[60%]">{value}</dd>
    </div>
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalItems = media.length + pinnedMedia.length;
  const hasFilters = activeFilter !== "All" || !!searchQuery;

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Editorial hero ────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 lg:pt-44 lg:pb-32">
        <div className="container mx-auto px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            <div className="flex items-center gap-3 mb-6 sm:mb-8">
              <span className="h-px w-8 bg-foreground/30" />
              <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground">
                Portfolio
              </p>
            </div>
            <h1 className="text-5xl sm:text-7xl lg:text-8xl xl:text-9xl font-medium tracking-[-0.04em] leading-[0.92] text-foreground max-w-5xl">
              The work,<br className="hidden sm:block" />{" "}
              <span className="text-muted-foreground">not the words.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mt-8 sm:mt-10 leading-relaxed">
              Selected projects in residential, commercial and renovation.
              Every image below is a real build we've delivered.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Sticky filter — hairline underlines, no chrome ────────────────── */}
      <div className="sticky top-0 z-40 border-y border-border bg-background/85 backdrop-blur-xl">
        <div className="container mx-auto px-6 lg:px-12">
          <div className="flex items-center gap-4 sm:gap-8 py-3 sm:py-4">
            <div
              className="flex-1 flex gap-5 sm:gap-7 overflow-x-auto"
              style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
            >
              {["All", ...CATEGORIES].map(cat => {
                const active = activeFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={`flex-shrink-0 text-xs sm:text-sm tracking-tight whitespace-nowrap transition-colors py-2 border-b border-transparent ${
                      active
                        ? "text-foreground border-foreground"
                        : "text-muted-foreground/70 hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Desktop search */}
            <div className="relative w-40 sm:w-48 hidden sm:block flex-shrink-0">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-6 pr-5 py-2 bg-transparent border-0 border-b border-border/60 focus:border-foreground/70 focus:outline-none text-sm placeholder:text-muted-foreground/50 transition-colors"
              />
              {searchQuery && (
                <button onClick={clearSearch} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              )}
            </div>

            {/* Mobile search toggle */}
            <button
              onClick={() => setMobileSearchOpen(v => !v)}
              className={`sm:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center transition-colors ${
                mobileSearchOpen || searchQuery ? "text-foreground" : "text-muted-foreground/60 hover:text-foreground"
              }`}
              aria-label="Toggle search"
            >
              {mobileSearchOpen ? <X className="w-4 h-4" strokeWidth={1.5} /> : <Search className="w-4 h-4" strokeWidth={1.5} />}
            </button>
          </div>

          {/* Mobile search row */}
          <AnimatePresence>
            {mobileSearchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="sm:hidden overflow-hidden"
              >
                <div className="pb-3">
                  <div className="relative">
                    <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" strokeWidth={1.5} />
                    <input
                      type="text"
                      placeholder="Search projects by name or location"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      autoFocus
                      className="w-full pl-6 pr-6 py-2 bg-transparent border-0 border-b border-border/60 focus:border-foreground/70 focus:outline-none text-sm placeholder:text-muted-foreground/50"
                    />
                    {searchQuery && (
                      <button onClick={clearSearch} className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground">
                        <X className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result summary — hairline row */}
          {hasFilters && !isLoading && (
            <div className="flex items-center justify-between py-2 border-t border-border/50 text-[11px] text-muted-foreground">
              <p className="truncate mr-3">
                <span className="tabular-nums">{two(totalItems)}</span> result{totalItems !== 1 ? "s" : ""}
                {activeFilter !== "All" && <> · <span className="text-foreground">{activeFilter}</span></>}
                {searchQuery && <> · <span className="text-foreground">"{searchQuery}"</span></>}
              </p>
              <button
                onClick={() => { setFilter("All"); clearSearch(); setMobileSearchOpen(false); }}
                className="flex items-center gap-1 hover:text-foreground transition-colors flex-shrink-0"
              >
                Clear <X className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="container mx-auto px-6 lg:px-12 py-16 sm:py-24 lg:py-32">

        {isLoading && !error && (
          <div className="flex items-center justify-center py-40">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" strokeWidth={1.5} />
          </div>
        )}

        {error && (
          <div className="max-w-sm mx-auto py-32 text-center space-y-6">
            <AlertCircle className="w-8 h-8 text-muted-foreground/50 mx-auto" strokeWidth={1.5} />
            <div>
              <p className="text-base font-medium mb-2">Something didn't load</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <button
              onClick={() => { setError(null); setIsLoading(true); fetchMedia(0, false); }}
              className="text-sm text-foreground border-b border-foreground/40 hover:border-foreground pb-0.5 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && totalItems === 0 && (
          <div className="max-w-sm mx-auto py-32 text-center space-y-5">
            <ImageIcon className="w-8 h-8 text-muted-foreground/30 mx-auto" strokeWidth={1} />
            <div>
              <p className="text-base font-medium mb-1.5">Nothing here yet</p>
              <p className="text-sm text-muted-foreground">Try adjusting the filter or search.</p>
            </div>
            {hasFilters && (
              <button
                onClick={() => { setFilter("All"); clearSearch(); }}
                className="text-sm text-foreground border-b border-foreground/40 hover:border-foreground pb-0.5 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && totalItems > 0 && (
          <>
            {/* ── Featured ────────────────────────────────────────────────── */}
            {pinnedMedia.length > 0 && (
              <section className="mb-24 sm:mb-32 lg:mb-40">
                <div className="flex items-baseline justify-between mb-10 sm:mb-14 lg:mb-16">
                  <div className="flex items-center gap-3">
                    <span className="h-px w-8 bg-foreground/30" />
                    <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground">Featured</p>
                  </div>
                  <p className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground/60 tabular-nums">
                    {two(pinnedMedia.length)}
                  </p>
                </div>

                {pinnedMedia.length === 1 ? (
                  <FeaturedHero item={pinnedMedia[0]} />
                ) : (
                  <div className="space-y-24 sm:space-y-32">
                    <FeaturedHero item={pinnedMedia[0]} />
                    {pinnedMedia.length > 1 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-14 lg:gap-20">
                        {pinnedMedia.slice(1, 3).map(item => (
                          <FeaturedSecondary key={item.id} item={item} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ── Portfolio grid ─────────────────────────────────────────── */}
            {media.length > 0 && (
              <section>
                <div className="flex items-baseline justify-between mb-10 sm:mb-14 lg:mb-16">
                  <div className="flex items-center gap-3">
                    <span className="h-px w-8 bg-foreground/30" />
                    <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-muted-foreground">
                      {pinnedMedia.length > 0 ? "Portfolio" : "Work"}
                    </p>
                  </div>
                  <p className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground/60 tabular-nums">
                    {two(media.length)}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 sm:gap-12 lg:gap-16">
                  {media.map(item => <GridCard key={item.id} item={item} />)}
                </div>
              </section>
            )}

            <div ref={loadMoreRef} className="py-16 sm:py-24 flex justify-center">
              {isLoadingMore && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" strokeWidth={1.5} />
              )}
            </div>

            {!hasMore && totalItems > 0 && (
              <div className="text-center py-16 border-t border-border">
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground/50">End</p>
              </div>
            )}
          </>
        )}
      </div>

      {lightbox && <LightboxModal />}
    </div>
  );
};

export default MediaGalleryPage;
