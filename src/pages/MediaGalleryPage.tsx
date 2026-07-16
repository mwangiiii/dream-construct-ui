import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Loader2, Share2, ExternalLink, AlertCircle,
  Image as ImageIcon, PlayCircle, ChevronLeft, ChevronRight,
  Bookmark, Maximize2,
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

  // ── Pin card — the whole gallery is these ─────────────────────────────────
  const PinCard = ({ item }: { item: MediaPost }) => {
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
        className="relative mb-3 sm:mb-4 break-inside-avoid group cursor-pointer"
        onClick={() => openLightbox(item)}
      >
        {/* The card body — image dominates, corners rounded, chrome only on hover */}
        <div className="relative rounded-2xl overflow-hidden bg-zinc-900 shadow-sm">
          {item.media_type === "video" ? (
            <video
              src={item.thumbnail_url || item.media_url}
              className="w-full h-auto block"
              muted loop playsInline preload="metadata"
              onMouseEnter={e => e.currentTarget.play()}
              onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
            />
          ) : (
            <img
              src={item.thumbnail_url || item.media_url}
              alt={item.alt_text || item.caption}
              className="w-full h-auto block"
              loading="lazy"
            />
          )}

          {/* Featured pin — always visible when applicable */}
          {item.is_pinned && (
            <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur text-black text-[10px] font-semibold tracking-wide">
              <Bookmark className="w-3 h-3 fill-current" strokeWidth={0} />
              Featured
            </div>
          )}

          {/* Video badge */}
          {item.media_type === "video" && (
            <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
              <PlayCircle className="w-4 h-4 text-white" strokeWidth={1.5} />
            </div>
          )}

          {/* Hover overlay — Pinterest-y */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {/* Action buttons — top-right on hover */}
            <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200"
                 style={{ marginTop: item.media_type === "video" ? "44px" : "0" }}>
              <button
                onClick={(e) => handleShare(item, e)}
                className="w-9 h-9 rounded-full bg-white/95 hover:bg-white text-black flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
                aria-label="Share"
              >
                <Share2 className="w-4 h-4" strokeWidth={2} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openLightbox(item); }}
                className="w-9 h-9 rounded-full bg-white/95 hover:bg-white text-black flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
                aria-label="Expand"
              >
                <Maximize2 className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            {/* Caption over image on hover */}
            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
              <p className="text-white text-sm font-semibold line-clamp-2 leading-snug drop-shadow">
                {item.caption}
              </p>
              {item.metadata.location && (
                <p className="text-white/80 text-xs mt-1 flex items-center gap-1 drop-shadow">
                  {item.metadata.location}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tiny caption below card — always visible, keeps scanning easy */}
        <div className="px-1 pt-2 pb-1">
          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
            {item.caption}
          </p>
          {(item.metadata.location || item.categories[0]) && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {[item.categories[0], item.metadata.location].filter(Boolean).join(" · ")}
            </p>
          )}
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

  return (
    <div className="min-h-screen bg-background">

      {/* ── Compact sticky topbar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-5 py-3 sm:py-3.5 flex items-center gap-3 sm:gap-4">
          {/* Wordmark */}
          <div className="flex-shrink-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              Gallery
            </h1>
          </div>

          {/* Search — always visible, centered */}
          <div className="flex-1 max-w-2xl mx-auto relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" strokeWidth={2} />
            <input
              type="text"
              placeholder="Search projects, locations…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 sm:py-2.5 bg-muted/50 hover:bg-muted focus:bg-muted focus:ring-2 focus:ring-primary/40 border-0 rounded-full text-sm placeholder:text-muted-foreground/70 transition-all"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted-foreground/10 transition"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Result count */}
          <div className="hidden sm:block flex-shrink-0 text-xs text-muted-foreground tabular-nums">
            {isLoading ? "…" : `${totalItems} pin${totalItems !== 1 ? "s" : ""}`}
          </div>
        </div>

        {/* Category chips row */}
        <div className="max-w-[1800px] mx-auto px-3 sm:px-5 pb-2.5 sm:pb-3">
          <div
            className="flex gap-1.5 overflow-x-auto"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          >
            {["All", ...CATEGORIES].map(cat => {
              const active = activeFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    active
                      ? "bg-foreground text-background"
                      : "bg-muted/50 hover:bg-muted text-foreground/80"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
            {hasFilters && (
              <button
                onClick={() => { setFilter("All"); clearSearch(); }}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap text-muted-foreground hover:text-foreground flex items-center gap-1 transition"
              >
                <X className="w-3 h-3" strokeWidth={2.5} /> Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Masonry grid ──────────────────────────────────────────────────── */}
      <main className="max-w-[1800px] mx-auto px-3 sm:px-5 py-4 sm:py-6">

        {isLoading && !error && (
          <div className="flex items-center justify-center py-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/50" strokeWidth={2} />
          </div>
        )}

        {error && (
          <div className="max-w-sm mx-auto py-32 text-center space-y-5">
            <AlertCircle className="w-10 h-10 text-muted-foreground/50 mx-auto" strokeWidth={1.5} />
            <div>
              <p className="text-base font-semibold mb-1">Couldn't load pins</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <button
              onClick={() => { setError(null); setIsLoading(true); fetchMedia(0, false); }}
              className="px-5 py-2 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && totalItems === 0 && (
          <div className="max-w-sm mx-auto py-32 text-center space-y-4">
            <ImageIcon className="w-10 h-10 text-muted-foreground/30 mx-auto" strokeWidth={1.5} />
            <div>
              <p className="text-base font-semibold mb-1">No pins found</p>
              <p className="text-sm text-muted-foreground">Try a different filter or search.</p>
            </div>
            {hasFilters && (
              <button
                onClick={() => { setFilter("All"); clearSearch(); }}
                className="text-sm font-semibold text-foreground border-b-2 border-foreground/40 hover:border-foreground pb-0.5 transition"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && totalItems > 0 && (
          <>
            {/* True masonry via CSS columns — Pinterest layout. */}
            <motion.div
              key={activeFilter + debouncedSearch}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-3 sm:gap-4"
            >
              {allMedia.map(item => (
                <PinCard key={item.id} item={item} />
              ))}
            </motion.div>

            <div ref={loadMoreRef} className="py-10 sm:py-14 flex justify-center">
              {isLoadingMore && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                  Loading more…
                </div>
              )}
            </div>

            {!hasMore && totalItems > 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground/60 tracking-wide">
                You've reached the end · {totalItems} pins
              </div>
            )}
          </>
        )}
      </main>

      {lightbox && <LightboxModal />}
    </div>
  );
};

export default MediaGalleryPage;
