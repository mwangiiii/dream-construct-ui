import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Loader2, Eye, Share2, ExternalLink,
  AlertCircle, MapPin, Calendar, Home, Building2,
  Wrench, Camera, MessageSquare, Image as ImageIcon,
  Video as VideoIcon, PlayCircle, ChevronLeft, ChevronRight,
  DollarSign, Maximize2, Award,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "Luxury Villa",       icon: Home,          label: "Luxury Villa"       },
  { value: "Apartments",         icon: Building2,     label: "Apartments"         },
  { value: "Commercial",         icon: Building2,     label: "Commercial"         },
  { value: "Renovations",        icon: Wrench,        label: "Renovations"        },
  { value: "Before & After",     icon: Camera,        label: "Before & After"     },
  { value: "Client Testimonial", icon: MessageSquare, label: "Client Testimonial" },
  { value: "Completed 2025",     icon: Calendar,      label: "Completed 2025"     },
  { value: "Drone Shots",        icon: Camera,        label: "Drone Shots"        },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatNumber = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

// ─── Main Component ───────────────────────────────────────────────────────────

const MediaGalleryPage = () => {
  const [media, setMedia]               = useState<MediaPost[]>([]);
  const [pinnedMedia, setPinnedMedia]   = useState<MediaPost[]>([]);
  const [searchQuery, setSearchQuery]   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [isLoading, setIsLoading]       = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [hasMore, setHasMore]           = useState(true);
  const [page, setPage]                 = useState(0);
  const [lightbox, setLightbox]         = useState<MediaPost | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [initialMediaId, setInitialMediaId] = useState<string | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const observerRef    = useRef<IntersectionObserver | null>(null);
  const loadMoreRef    = useRef<HTMLDivElement | null>(null);
  const viewTrackedRef = useRef<Set<string>>(new Set());
  const ITEMS_PER_PAGE = 18;

  // All media combined for lightbox navigation
  const allMedia = [...pinnedMedia, ...media];

  // ── Debounce search ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Analytics ────────────────────────────────────────────────────────────────
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

  // ── Fetch ─────────────────────────────────────────────────────────────────────
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

      if (append) {
        setMedia(prev => [...prev, ...regular]);
      } else {
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

  // ── Effects ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("media");
    if (id) setInitialMediaId(id);
    fetchMedia(0, false);
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
  }, [initialMediaId, media, pinnedMedia, isLoading, error]);

  useEffect(() => {
    setError(null); setIsLoading(true); setPage(0);
    viewTrackedRef.current.clear();
    fetchMedia(0, false);
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
  }, [hasMore, isLoading, isLoadingMore, page, selectedCats, debouncedSearch]);

  // Close lightbox on Escape; arrow navigation
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")      closeLightbox();
      if (e.key === "ArrowRight")  navigateLightbox(1);
      if (e.key === "ArrowLeft")   navigateLightbox(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, lightboxIndex]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
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

  // ── Media thumbnail ───────────────────────────────────────────────────────────
  const MediaThumb = ({
    item, className = "", showPlay = true
  }: { item: MediaPost; className?: string; showPlay?: boolean }) => (
    <div className={`relative overflow-hidden bg-zinc-900 ${className}`}>
      {item.media_type === "video" ? (
        <>
          <video
            src={item.thumbnail_url || item.media_url}
            className="w-full h-full object-cover"
            muted loop playsInline
            onMouseEnter={e => e.currentTarget.play()}
            onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
          />
          {showPlay && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <PlayCircle className="w-7 h-7 text-white" />
              </div>
            </div>
          )}
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

  // ─── Spotlight card (first pinned item) ───────────────────────────────────────
  const SpotlightCard = ({ item }: { item: MediaPost }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) trackView(item.id); }, { threshold: 0.4 }
      );
      if (cardRef.current) obs.observe(cardRef.current);
      return () => obs.disconnect();
    }, [item.id]);

    return (
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="relative rounded-2xl overflow-hidden cursor-pointer group h-[260px] sm:h-[380px] md:h-[460px] lg:h-[520px]"
        onClick={() => openLightbox(item)}
      >
        <MediaThumb item={item} className="w-full h-full group-hover:scale-105 transition-transform duration-700" showPlay={item.media_type === "video"} />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

        {/* Featured badge */}
        <div className="absolute top-3 sm:top-5 left-3 sm:left-5 flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-primary text-background text-[10px] sm:text-xs font-bold tracking-wider uppercase">
          <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Featured Project</span>
          <span className="sm:hidden">Featured</span>
        </div>

        {/* Expand icon — desktop hover only */}
        <div className="absolute top-3 sm:top-5 right-3 sm:right-5 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5 lg:p-6">
          <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-2 sm:mb-3">
            {item.categories.slice(0, 2).map(cat => (
              <span key={cat} className="px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-white/15 backdrop-blur-sm text-white border border-white/20">
                {cat}
              </span>
            ))}
          </div>
          <h3 className="text-base sm:text-xl lg:text-2xl font-bold text-white mb-2 sm:mb-3 leading-snug">{item.caption}</h3>
          <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-white/70">
            {item.metadata.location && (
              <span className="flex items-center gap-1 sm:gap-1.5"><MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" /><span className="truncate max-w-[120px] sm:max-w-none">{item.metadata.location}</span></span>
            )}
            {item.metadata.area && (
              <span className="flex items-center gap-1 sm:gap-1.5 hidden sm:flex"><Home className="w-3 h-3 sm:w-3.5 sm:h-3.5" />{item.metadata.area}</span>
            )}
            {item.metadata.project_cost && (
              <span className="flex items-center gap-1 sm:gap-1.5"><DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5" />{item.metadata.project_cost}</span>
            )}
            {item.metadata.completion_time && (
              <span className="flex items-center gap-1 sm:gap-1.5 hidden sm:flex"><Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />{item.metadata.completion_time}</span>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // ─── Secondary pinned card ────────────────────────────────────────────────────
  const PinnedCard = ({ item, delay = 0 }: { item: MediaPost; delay?: number }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) trackView(item.id); }, { threshold: 0.4 }
      );
      if (cardRef.current) obs.observe(cardRef.current);
      return () => obs.disconnect();
    }, [item.id]);

    return (
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, delay }}
        className="relative rounded-xl overflow-hidden cursor-pointer group h-[180px] sm:h-[210px] md:h-[220px] lg:h-[248px]"
        onClick={() => openLightbox(item)}
      >
        <MediaThumb item={item} className="w-full h-full group-hover:scale-105 transition-transform duration-700" showPlay={item.media_type === "video"} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 px-2 sm:px-2.5 py-0.5 rounded-full bg-primary/90 text-background text-[10px] sm:text-xs font-bold">Featured</div>
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
          {item.categories[0] && (
            <span className="text-[10px] sm:text-[11px] font-semibold text-white/60 uppercase tracking-wider">{item.categories[0]}</span>
          )}
          <p className="text-xs sm:text-sm font-semibold text-white mt-0.5 line-clamp-2 leading-snug">{item.caption}</p>
          {item.metadata.location && (
            <p className="flex items-center gap-1 text-[10px] sm:text-xs text-white/55 mt-1 sm:mt-1.5">
              <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" /><span className="truncate">{item.metadata.location}</span>
            </p>
          )}
        </div>
        <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/70" />
        </div>
      </motion.div>
    );
  };

  // ─── Regular grid card ────────────────────────────────────────────────────────
  const GridCard = ({ item, delay = 0 }: { item: MediaPost; delay?: number }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) trackView(item.id); }, { threshold: 0.4 }
      );
      if (cardRef.current) obs.observe(cardRef.current);
      return () => obs.disconnect();
    }, [item.id]);

    return (
      <motion.article
        ref={cardRef}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay }}
        className="group cursor-pointer bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
        onClick={() => openLightbox(item)}
      >
        {/* Image — fixed 16:9 */}
        <div className="relative overflow-hidden aspect-video bg-zinc-900">
          <MediaThumb item={item} className="w-full h-full group-hover:scale-105 transition-transform duration-500" showPlay={item.media_type === "video"} />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-300 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
              <Maximize2 className="w-4.5 h-4.5 text-white" style={{ width: "18px", height: "18px" }} />
            </div>
          </div>
          {/* View count badge */}
          {item.view_count > 0 && (
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs">
              <Eye className="w-3 h-3" />
              {formatNumber(item.view_count)}
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-4">
          {/* Category */}
          {item.categories[0] && (
            <span className="inline-block text-[11px] font-semibold text-primary uppercase tracking-wider mb-2">
              {item.categories[0]}
            </span>
          )}
          {/* Title */}
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug mb-3">
            {item.caption}
          </h3>
          {/* Meta row */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground border-t border-border/50 pt-3">
            {item.metadata.location && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.metadata.location}</span>
            )}
            {item.metadata.area && (
              <span className="flex items-center gap-1"><Home className="w-3 h-3" />{item.metadata.area}</span>
            )}
            {item.metadata.project_cost && (
              <span className="flex items-center gap-1 ml-auto font-medium text-foreground/80">
                <DollarSign className="w-3 h-3" />{item.metadata.project_cost}
              </span>
            )}
          </div>
        </div>
      </motion.article>
    );
  };

  // ─── Lightbox ─────────────────────────────────────────────────────────────────
  const LightboxModal = () => {
    if (!lightbox) return null;
    const hasPrev = lightboxIndex > 0;
    const hasNext = lightboxIndex < allMedia.length - 1;

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex flex-col lg:items-center lg:justify-center"
          onClick={closeLightbox}
        >
          {/* ── Close button — always visible top-right of overlay ── */}
          <button
            onClick={closeLightbox}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white transition-all"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* ── Counter — top-centre ── */}
          <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-black/60 text-white/60 text-xs pointer-events-none">
            {lightboxIndex + 1} / {allMedia.length}
          </div>

          {/* ── Inner container ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.22 }}
            className="w-full h-full lg:h-auto lg:max-h-[92vh] lg:max-w-6xl flex flex-col lg:flex-row lg:rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* ── Media panel ── */}
            <div className="relative bg-black flex items-center justify-center flex-shrink-0
                            h-[44vh] sm:h-[50vh] lg:h-auto lg:flex-1 min-h-0">
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

              {/* Nav arrows */}
              {hasPrev && (
                <button
                  onClick={e => { e.stopPropagation(); navigateLightbox(-1); }}
                  className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/25 active:bg-white/30 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white transition-all"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
              {hasNext && (
                <button
                  onClick={e => { e.stopPropagation(); navigateLightbox(1); }}
                  className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/25 active:bg-white/30 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white transition-all"
                >
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}
            </div>

            {/* ── Details panel ── */}
            <div className="flex-1 lg:flex-none lg:w-[320px] xl:w-[360px] bg-zinc-950 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col min-h-0 overflow-hidden">

              {/* Categories row */}
              <div className="flex items-center gap-2 flex-wrap px-4 sm:px-5 py-3 sm:py-4 border-b border-white/10 flex-shrink-0">
                {lightbox.categories.slice(0, 3).map(cat => (
                  <span key={cat} className="px-2 sm:px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] sm:text-xs font-semibold border border-primary/30 whitespace-nowrap">
                    {cat}
                  </span>
                ))}
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-3 sm:py-4 space-y-4" style={{ WebkitOverflowScrolling: "touch" }}>
                <h2 className="text-sm sm:text-base font-bold text-white leading-snug">{lightbox.caption}</h2>

                {/* Project stats grid */}
                {Object.values(lightbox.metadata).some(Boolean) && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {lightbox.metadata.location && (
                      <div className="bg-white/5 rounded-lg p-2.5 sm:p-3 border border-white/8">
                        <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wider mb-1">Location</p>
                        <p className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1 sm:gap-1.5">
                          <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary flex-shrink-0" />
                          <span className="truncate">{lightbox.metadata.location}</span>
                        </p>
                      </div>
                    )}
                    {lightbox.metadata.area && (
                      <div className="bg-white/5 rounded-lg p-2.5 sm:p-3 border border-white/8">
                        <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wider mb-1">Area</p>
                        <p className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1 sm:gap-1.5">
                          <Home className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary flex-shrink-0" />{lightbox.metadata.area}
                        </p>
                      </div>
                    )}
                    {lightbox.metadata.project_cost && (
                      <div className="bg-white/5 rounded-lg p-2.5 sm:p-3 border border-white/8">
                        <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wider mb-1">Project Value</p>
                        <p className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1 sm:gap-1.5">
                          <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary flex-shrink-0" />{lightbox.metadata.project_cost}
                        </p>
                      </div>
                    )}
                    {lightbox.metadata.completion_time && (
                      <div className="bg-white/5 rounded-lg p-2.5 sm:p-3 border border-white/8">
                        <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wider mb-1">Timeline</p>
                        <p className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1 sm:gap-1.5">
                          <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary flex-shrink-0" />{lightbox.metadata.completion_time}
                        </p>
                      </div>
                    )}
                    {lightbox.metadata.client_satisfaction && (
                      <div className="col-span-2 bg-white/5 rounded-lg p-2.5 sm:p-3 border border-white/8">
                        <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wider mb-1">Client Satisfaction</p>
                        <p className="text-xs sm:text-sm font-semibold text-white">{lightbox.metadata.client_satisfaction}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Engagement */}
                <div className="flex items-center gap-3 sm:gap-4 text-xs text-white/40 border-t border-white/8 pt-3">
                  <span className="flex items-center gap-1 sm:gap-1.5"><Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />{formatNumber(lightbox.view_count)} views</span>
                  <span className="flex items-center gap-1 sm:gap-1.5"><Share2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />{lightbox.share_count} shares</span>
                </div>
              </div>

              {/* Action footer */}
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-white/10 flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleShare(lightbox)}
                  className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 rounded-lg bg-white/8 hover:bg-white/12 active:bg-white/15 text-white text-xs sm:text-sm font-medium border border-white/10 transition-all"
                >
                  <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Share
                </button>
                {lightbox.project_link && (
                  <button
                    onClick={() => window.open(lightbox.project_link!, "_blank")}
                    className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 rounded-lg bg-primary text-background text-xs sm:text-sm font-semibold hover:bg-primary/90 active:bg-primary/80 transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> View Project
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  // ── Derived state ─────────────────────────────────────────────────────────────
  const totalItems = media.length + pinnedMedia.length;
  const hasFilters = activeFilter !== "All" || searchQuery;

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero header ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm pt-20 sm:pt-24 lg:pt-28 pb-8 sm:pb-10 lg:pb-12">
        <div className="container mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <p className="text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-[0.2em] mb-2 sm:mb-3">Project Portfolio</p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-3 sm:mb-4 leading-tight">
              Our Work in<br className="hidden sm:block" /> Every Detail
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
              A curated showcase of completed projects — residential builds, commercial spaces,
              and precision renovations across Kenya.
            </p>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 mt-6 sm:mt-10 pt-6 sm:pt-8 border-t border-border"
          >
            {[
              { value: "150+", label: "Projects Completed" },
              { value: "12+",  label: "Years of Excellence" },
              { value: "98%",  label: "Client Satisfaction" },
              { value: "40+",  label: "Expert Team Members" },
            ].map(s => (
              <div key={s.label}>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Filter bar (sticky) ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="container mx-auto px-4 sm:px-6">
          {/* Row 1: tabs + desktop search + mobile search toggle */}
          <div className="flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3">
            {/* Category tabs */}
            <div
              className="flex gap-1 sm:gap-1.5 flex-1 min-w-0 overflow-x-auto"
              style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
            >
              {["All", ...CATEGORIES.map(c => c.value)].map(cat => {
                const isActive = activeFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={`flex-shrink-0 px-3 sm:px-3.5 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap border ${
                      isActive
                        ? "bg-primary text-background border-primary shadow-sm"
                        : "text-muted-foreground border-transparent hover:border-border hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Desktop search — always visible sm+ */}
            <div className="relative flex-shrink-0 w-44 sm:w-52 hidden sm:block">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-7 sm:pl-8 pr-6 sm:pr-7 py-1.5 text-xs sm:text-sm bg-muted/50 border border-border rounded-lg focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition"
              />
              {searchQuery && (
                <button onClick={clearSearch} className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              )}
            </div>

            {/* Mobile search toggle button */}
            <button
              onClick={() => setMobileSearchOpen(v => !v)}
              className={`sm:hidden flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                mobileSearchOpen || searchQuery
                  ? "bg-primary text-background border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              aria-label="Toggle search"
            >
              {mobileSearchOpen ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Mobile search row — expands below filter bar */}
          <AnimatePresence>
            {mobileSearchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="sm:hidden overflow-hidden"
              >
                <div className="pb-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search projects by name or location..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      autoFocus
                      className="w-full pl-9 pr-8 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition"
                    />
                    {searchQuery && (
                      <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active filter / result count strip */}
          {hasFilters && !isLoading && (
            <div className="flex items-center justify-between py-1.5 sm:py-2 border-t border-border/50">
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate mr-2">
                {totalItems} result{totalItems !== 1 ? "s" : ""}
                {activeFilter !== "All" && <> in <span className="font-semibold text-foreground">{activeFilter}</span></>}
                {searchQuery && <> for "<span className="font-semibold text-foreground">{searchQuery}</span>"</>}
              </p>
              <button
                onClick={() => { setFilter("All"); clearSearch(); setMobileSearchOpen(false); }}
                className="text-[11px] sm:text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 flex-shrink-0 transition-colors"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 lg:py-12">

        {/* Loading */}
        {isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
            <p className="text-sm text-muted-foreground">Loading portfolio...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center justify-center py-24 max-w-sm mx-auto text-center gap-4">
            <AlertCircle className="w-10 h-10 text-destructive/60" />
            <div>
              <p className="font-semibold">Failed to load media</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <button
              onClick={() => { setError(null); setIsLoading(true); fetchMedia(0, false); }}
              className="px-5 py-2 rounded-lg bg-primary text-background text-sm font-semibold hover:bg-primary/90 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && totalItems === 0 && (
          <div className="flex flex-col items-center justify-center py-24 max-w-sm mx-auto text-center gap-3">
            <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
            <p className="font-semibold">No projects found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters or search.</p>
            {hasFilters && (
              <button
                onClick={() => { setFilter("All"); clearSearch(); }}
                className="mt-1 px-4 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 transition"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && totalItems > 0 && (
          <>
            {/* ── Featured / Pinned section ───────────────────────────────────── */}
            {pinnedMedia.length > 0 && (
              <section className="mb-10 sm:mb-14">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold">Featured Projects</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">Handpicked highlights from our portfolio</p>
                  </div>
                  <div className="h-px flex-1 bg-border mx-4 sm:mx-6 hidden sm:block" />
                  <span className="text-xs text-muted-foreground flex-shrink-0">{pinnedMedia.length} featured</span>
                </div>

                {pinnedMedia.length === 1 ? (
                  <SpotlightCard item={pinnedMedia[0]} />
                ) : (
                  /* Mobile: stack all. md: spotlight + side column. */
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] lg:grid-cols-[1fr_300px] gap-3 sm:gap-4">
                    <SpotlightCard item={pinnedMedia[0]} />
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-3 sm:gap-4">
                      {pinnedMedia.slice(1, 3).map((item, i) => (
                        <PinnedCard key={item.id} item={item} delay={i * 0.06} />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── Regular grid ────────────────────────────────────────────────── */}
            {media.length > 0 && (
              <section>
                {pinnedMedia.length > 0 && (
                  <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <h2 className="text-base sm:text-lg font-bold flex-shrink-0">All Projects</h2>
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground flex-shrink-0">{media.length} items</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {media.map((item, idx) => (
                    <GridCard key={item.id} item={item} delay={Math.min(idx % 6, 5) * 0.05} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Load more trigger ────────────────────────────────────────────── */}
            <div ref={loadMoreRef} className="py-8 sm:py-12 flex justify-center">
              {isLoadingMore && (
                <div className="flex items-center gap-2 sm:gap-3 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading more projects...
                </div>
              )}
            </div>

            {/* End of list */}
            {!hasMore && totalItems > 0 && (
              <div className="text-center py-6 sm:py-8 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">End of Portfolio</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Lightbox ────────────────────────────────────────────────────────────── */}
      {lightbox && <LightboxModal />}
    </div>
  );
};

export default MediaGalleryPage;
