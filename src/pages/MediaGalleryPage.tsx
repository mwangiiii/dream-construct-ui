import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { 
  Search, 
  Filter, 
  X, 
  Loader2, 
  Eye, 
  MousePointerClick,
  Share2,
  ExternalLink,
  ChevronDown,
  AlertCircle,
  Sparkles,
  TrendingUp,
  MapPin,
  Calendar,
  DollarSign,
  Home,
  Building2,
  Wrench,
  Camera,
  MessageSquare,
  Image as ImageIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  PlayCircle,
  Pause
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// Types
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
  media_type: 'image' | 'video' | 'audio' | 'gif';
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
  status: 'draft' | 'published' | 'archived';
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

// Available categories with icons
const CATEGORIES = [
  { value: "Luxury Villa", icon: Home, color: "from-amber-500 to-orange-600" },
  { value: "Apartments", icon: Building2, color: "from-blue-500 to-cyan-600" },
  { value: "Commercial", icon: Building2, color: "from-purple-500 to-pink-600" },
  { value: "Renovations", icon: Wrench, color: "from-green-500 to-emerald-600" },
  { value: "Before & After", icon: Camera, color: "from-orange-500 to-amber-600" },
  { value: "Client Testimonial", icon: MessageSquare, color: "from-indigo-500 to-blue-600" },
  { value: "Completed 2025", icon: Calendar, color: "from-teal-500 to-cyan-600" },
  { value: "Drone Shots", icon: Camera, color: "from-sky-500 to-blue-600" },
];

const MediaGalleryPage = () => {
  // State
  const [media, setMedia] = useState<MediaPost[]>([]);
  const [pinnedMedia, setPinnedMedia] = useState<MediaPost[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaPost | null>(null);
  
  // Refs
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const viewTrackedRef = useRef<Set<string>>(new Set());
  
  const ITEMS_PER_PAGE = 20;

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ============================================
  // ANALYTICS TRACKING FUNCTIONS
  // ============================================
  
  // Track view count (called when media card enters viewport)
  const trackView = useCallback(async (mediaId: string) => {
    // Prevent duplicate tracking
    if (viewTrackedRef.current.has(mediaId)) return;
    viewTrackedRef.current.add(mediaId);

    try {
      const { error } = await supabase.rpc('increment_media_view_count', {
        media_id: mediaId
      });

      if (error) throw error;

      // Update local state optimistically
      setMedia(prev => prev.map(item => 
        item.id === mediaId 
          ? { ...item, view_count: item.view_count + 1 }
          : item
      ));
      setPinnedMedia(prev => prev.map(item => 
        item.id === mediaId 
          ? { ...item, view_count: item.view_count + 1 }
          : item
      ));
    } catch (err) {
      console.error("Failed to track view:", err);
    }
  }, []);

  // Track click count (called when opening lightbox)
  const trackClick = useCallback(async (mediaId: string) => {
    try {
      const { error } = await supabase.rpc('increment_media_click_count', {
        media_id: mediaId
      });

      if (error) throw error;

      // Update local state optimistically
      setMedia(prev => prev.map(item => 
        item.id === mediaId 
          ? { ...item, click_count: item.click_count + 1 }
          : item
      ));
      setPinnedMedia(prev => prev.map(item => 
        item.id === mediaId 
          ? { ...item, click_count: item.click_count + 1 }
          : item
      ));
    } catch (err) {
      console.error("Failed to track click:", err);
    }
  }, []);

  // Track share count
  const trackShare = useCallback(async (mediaId: string) => {
    try {
      const { error } = await supabase.rpc('increment_media_share_count', {
        media_id: mediaId
      });

      if (error) throw error;

      // Update local state optimistically
      setMedia(prev => prev.map(item => 
        item.id === mediaId 
          ? { ...item, share_count: item.share_count + 1 }
          : item
      ));
      setPinnedMedia(prev => prev.map(item => 
        item.id === mediaId 
          ? { ...item, share_count: item.share_count + 1 }
          : item
      ));
    } catch (err) {
      console.error("Failed to track share:", err);
    }
  }, []);

  // ============================================
  // FETCH MEDIA FUNCTION
  // ============================================
  
  const fetchMedia = async (pageNum: number = 0, append: boolean = false) => {
    try {
      const offset = pageNum * ITEMS_PER_PAGE;
      
      let query = supabase
        .from('media_posts')
        .select('*')
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('is_pinned', { ascending: false })
        .order('pin_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + ITEMS_PER_PAGE - 1);

      // Apply category filter
      if (selectedCategories.length > 0) {
        query = query.contains('categories', selectedCategories);
      }

      // Apply search filter
      if (debouncedSearchQuery.trim()) {
        query = query.or(`caption.ilike.%${debouncedSearchQuery}%,metadata->>location.ilike.%${debouncedSearchQuery}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Separate pinned and regular media
      const pinned = data?.filter(item => item.is_pinned) || [];
      const regular = data?.filter(item => !item.is_pinned) || [];

      if (append) {
        setMedia(prev => [...prev, ...regular]);
      } else {
        setPinnedMedia(pinned);
        setMedia(regular);
      }

      setHasMore((data?.length || 0) === ITEMS_PER_PAGE);
      
    } catch (err) {
      console.error("Fetch failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load media");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // ============================================
  // EFFECTS
  // ============================================

  // Initial load
  useEffect(() => {
    fetchMedia(0, false);
  }, []);

  // Refetch when filters change
  useEffect(() => {
    setError(null);
    setIsLoading(true);
    setPage(0);
    viewTrackedRef.current.clear();
    fetchMedia(0, false);
  }, [selectedCategories, debouncedSearchQuery]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          setIsLoadingMore(true);
          const nextPage = page + 1;
          setPage(nextPage);
          fetchMedia(nextPage, true);
        }
      },
      { threshold: 0.5 }
    );
    
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }
    
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasMore, isLoading, isLoadingMore, page, selectedCategories, debouncedSearchQuery]);

  // ============================================
  // HANDLER FUNCTIONS
  // ============================================

  // Category toggle
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Clear filters
  const clearFilters = () => {
    setSelectedCategories([]);
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setPage(0);
    setIsLoading(true);
    viewTrackedRef.current.clear();
    fetchMedia(0, false);
  };

  // Share functionality
  const handleShare = async (item: MediaPost) => {
    // Track share count
    await trackShare(item.id);

    const shareUrl = `${window.location.origin}${window.location.pathname}?media=${item.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.caption,
          text: `Check out this project: ${item.caption}`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
        console.log("Share cancelled");
      }
    } else {
      // Fallback: copy link
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link copied to clipboard!");
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  // Open lightbox and track click
  const handleMediaClick = (item: MediaPost) => {
    setSelectedMedia(item);
    trackClick(item.id);
  };

  // ============================================
  // MEDIA CARD COMPONENT WITH INTERSECTION OBSERVER
  // ============================================
  
  const MediaCard = ({ item }: { item: MediaPost }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isInView, setIsInView] = useState(false);
    const categoryInfo = CATEGORIES.find(c => c.value === item.categories[0]);
    const Icon = categoryInfo?.icon || ImageIcon;

    // Track view when card enters viewport
    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !isInView) {
            setIsInView(true);
            trackView(item.id);
          }
        },
        { threshold: 0.5 }
      );

      if (cardRef.current) {
        observer.observe(cardRef.current);
      }

      return () => {
        if (cardRef.current) {
          observer.unobserve(cardRef.current);
        }
      };
    }, [item.id, isInView]);
    
    return (
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <GlassCard className="group mb-4 sm:mb-6 break-inside-avoid overflow-hidden hover:bg-white/10 transition-all duration-300 cursor-pointer border-white/20 backdrop-blur-sm relative" onClick={() => handleMediaClick(item)}>
          {/* Media Content - Make this the primary clickable area */}
          <div className="relative overflow-hidden bg-muted" onClick={(e) => {
            e.stopPropagation();
            handleMediaClick(item);
          }}>
            {item.media_type === "video" ? (
              <div className="relative">
                <video 
                  src={item.thumbnail_url || item.media_url} 
                  className="w-full h-auto object-cover"
                  muted
                  loop
                  playsInline
                  onMouseEnter={e => e.currentTarget.play()}
                  onMouseLeave={e => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <PlayCircle className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
                </div>
              </div>
            ) : item.media_type === "audio" ? (
              <div className="flex items-center justify-center h-48 sm:h-64 bg-gradient-to-br from-purple-500 to-pink-600 cursor-pointer">
                <MusicIcon className="w-16 h-16 sm:w-20 sm:h-20 text-white" />
              </div>
            ) : (
              <img 
                src={item.thumbnail_url || item.media_url} 
                alt={item.alt_text || item.caption}
                className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                loading="lazy"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMediaClick(item);
                }}
              />
            )}
            
            {/* Pinned Badge */}
            {item.is_pinned && (
              <div className="absolute top-2 sm:top-3 right-2 sm:right-3">
                <Badge className="bg-primary text-primary-foreground shadow-lg flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3 py-1">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                  Featured
                </Badge>
              </div>
            )}
            
            {/* Stats Overlay */}
            <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 right-2 sm:right-3 flex items-center gap-1.5 sm:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-black/70 backdrop-blur-sm text-white border-0">
                <Eye className="w-3 h-3" />
                {item.view_count}
              </Badge>
              <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-black/70 backdrop-blur-sm text-white border-0">
                <MousePointerClick className="w-3 h-3" />
                {item.click_count}
              </Badge>
            </div>
          </div>

          {/* Content - Non-clickable for better UX, or optional click */}
          <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
            {/* Categories */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {item.categories.slice(0, 3).map((cat, idx) => (
                <Badge 
                  key={idx}
                  className="text-xs px-2 py-0.5 sm:py-1 bg-primary/90 text-primary-foreground"
                >
                  {cat}
                </Badge>
              ))}
            </div>

            {/* Caption */}
            <p className="font-semibold text-sm sm:text-base line-clamp-2 leading-relaxed">
              {item.caption}
            </p>

            {/* Metadata */}
            {Object.keys(item.metadata).length > 0 && (
              <div className="flex flex-wrap gap-2 sm:gap-3 text-xs text-muted-foreground">
                {item.metadata.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {item.metadata.location}
                  </span>
                )}
                {item.metadata.area && (
                  <span className="flex items-center gap-1">
                    <Home className="w-3 h-3" />
                    {item.metadata.area}
                  </span>
                )}
                {item.metadata.completion_time && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {item.metadata.completion_time}
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-white/20">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 sm:h-8 px-2 glass"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(item);
                  }}
                >
                  <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              </div>
          </div>
        </GlassCard>
      </motion.div>
    );
  };

  // ============================================
  // LIGHTBOX MODAL COMPONENT
  // ============================================
  
  const Lightbox = () => {
    if (!selectedMedia) return null;
    
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
        onClick={() => setSelectedMedia(null)}
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="relative max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-auto glass-strong rounded-2xl sm:rounded-3xl shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 bg-black/70 hover:bg-black/90 text-white glass"
            onClick={() => setSelectedMedia(null)}
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </Button>
          
          {/* Media - Enhanced display */}
          <div className="relative p-4 sm:p-6">
            {selectedMedia.media_type === "video" ? (
              <video 
                src={selectedMedia.media_url}
                controls
                autoPlay
                className="w-full max-h-[60vh] sm:max-h-[80vh] object-contain bg-black rounded-xl"
              />
            ) : selectedMedia.media_type === "audio" ? (
              <div className="flex flex-col items-center justify-center p-8 sm:p-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                <MusicIcon className="w-16 h-16 sm:w-24 sm:h-24 text-white mb-4 sm:mb-6" />
                <audio src={selectedMedia.media_url} controls className="w-full max-w-md" />
              </div>
            ) : (
              <img 
                src={selectedMedia.media_url}
                alt={selectedMedia.alt_text || selectedMedia.caption}
                className="w-full max-h-[60vh] sm:max-h-[80vh] object-contain bg-black rounded-xl"
              />
            )}
          </div>
          
          {/* Details */}
          <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {selectedMedia.categories.map((cat, idx) => (
                <Badge key={idx} className="bg-primary text-primary-foreground text-xs sm:text-sm">
                  {cat}
                </Badge>
              ))}
            </div>
            
            <h2 className="text-xl sm:text-2xl font-bold">{selectedMedia.caption}</h2>
            
            {Object.keys(selectedMedia.metadata).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4 bg-muted rounded-lg">
                {selectedMedia.metadata.completion_time && (
                  <div>
                    <p className="text-xs text-muted-foreground">Completion Time</p>
                    <p className="font-semibold text-sm sm:text-base">{selectedMedia.metadata.completion_time}</p>
                  </div>
                )}
                {selectedMedia.metadata.client_satisfaction && (
                  <div>
                    <p className="text-xs text-muted-foreground">Satisfaction</p>
                    <p className="font-semibold text-sm sm:text-base">{selectedMedia.metadata.client_satisfaction}</p>
                  </div>
                )}
                {selectedMedia.metadata.area && (
                  <div>
                    <p className="text-xs text-muted-foreground">Area</p>
                    <p className="font-semibold text-sm sm:text-base">{selectedMedia.metadata.area}</p>
                  </div>
                )}
                {selectedMedia.metadata.project_cost && (
                  <div>
                    <p className="text-xs text-muted-foreground">Project Cost</p>
                    <p className="font-semibold text-sm sm:text-base">{selectedMedia.metadata.project_cost}</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 sm:pt-4 border-t">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {selectedMedia.view_count} views
                </span>
                <span className="flex items-center gap-1">
                  <MousePointerClick className="w-4 h-4" />
                  {selectedMedia.click_count} clicks
                </span>
                <span className="flex items-center gap-1">
                  <Share2 className="w-4 h-4" />
                  {selectedMedia.share_count} shares
                </span>
              </div>
              
              <Button onClick={() => handleShare(selectedMedia)} size="sm" className="w-full sm:w-auto glass">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="min-h-screen">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-5 z-0">
        <div className="absolute inset-0" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }} />
      </div>

      {/* Filters Section */}
      <section className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="container mx-auto px-4 py-4 sm:py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              <Input 
                placeholder="Search by location, project type, or caption..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="pl-10 sm:pl-11 pr-10 sm:pr-11 h-12 sm:h-14 text-base sm:text-lg rounded-xl glass border-0 focus:ring-2 focus:ring-primary/40 transition-all"
              />
              {searchQuery && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 sm:h-8 sm:w-8 glass" 
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              )}
            </div>

            {/* Filter Toggle */}
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)} 
              className="gap-2 h-12 sm:h-14 min-w-[140px] sm:min-w-[160px] text-base sm:text-lg rounded-xl glass border-0 hover:bg-white/10 transition-all"
            >
              <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
              Filters
              <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              {selectedCategories.length > 0 && (
                <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                  {selectedCategories.length}
                </Badge>
              )}
            </Button>
          </div>

          {/* Category Filters */}
          {showFilters && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2 justify-center">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategories.includes(cat.value);
                  return (
                    <Badge 
                      key={cat.value}
                      className={`cursor-pointer px-4 py-2 text-sm font-semibold rounded-xl transition-all hover:scale-105 flex items-center gap-2 shadow-xl ${
                        isSelected 
                          ? `bg-gradient-to-r from-primary via-accent to-primary text-white shadow-2xl` 
                          : "glass hover:bg-primary/10"
                      }`}
                      onClick={() => toggleCategory(cat.value)}
                    >
                      <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                      {cat.value}
                    </Badge>
                  );
                })}
              </div>

              {(selectedCategories.length > 0 || searchQuery) && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Showing {media.length + pinnedMedia.length} result{(media.length + pinnedMedia.length) !== 1 ? 's' : ''}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearFilters} 
                    className="gap-2 text-xs sm:text-sm h-8 glass"
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Clear all filters
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Main Content Section */}
      <section className="container mx-auto px-4 py-8 sm:py-8">
        <div className="container mx-auto px-4 sm:px-6">
          {/* Error State */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center max-w-2xl mx-auto"
            >
              <GlassCard className="p-6 sm:p-8">
                <AlertCircle className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-8 text-destructive" />
                <h3 className="text-2xl sm:text-3xl font-bold mb-6">Failed to Load Media</h3>
                <p className="text-lg sm:text-xl text-muted-foreground mb-8 font-light">{error}</p>
                <Button 
                  onClick={() => { 
                    setError(null); 
                    setIsLoading(true); 
                    fetchMedia(0, false); 
                  }}
                  className="bg-primary hover:bg-primary/90 text-background font-semibold px-8 py-6 text-lg rounded-xl"
                >
                  Try Again
                </Button>
              </GlassCard>
            </motion.div>
          )}

          {/* Loading State */}
          {isLoading && !error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-col items-center justify-center py-16 sm:py-24"
            >
              <Loader2 className="w-16 h-16 sm:w-20 sm:h-20 animate-spin text-primary mb-8" />
              <p className="text-xl sm:text-2xl text-muted-foreground font-light">Loading amazing projects...</p>
            </motion.div>
          )}

          {/* Pinned Media Section */}
          {!isLoading && !error && pinnedMedia.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-8 sm:mb-12"
            >
              <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                <h2 className="text-2xl sm:text-3xl font-bold">Featured Projects</h2>
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {pinnedMedia.map((item, idx) => (
                  <MediaCard key={item.id} item={item} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Regular Media Grid */}
          {!isLoading && !error && (
            <>
              {media.length === 0 && pinnedMedia.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-center max-w-xl mx-auto"
                >
                  <GlassCard className="p-8 sm:p-12">
                    <ImageIcon className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-2xl sm:text-3xl font-bold mb-2">No Media Found</h3>
                    <p className="text-base sm:text-lg text-muted-foreground mb-4">
                      Try adjusting your filters or search query
                    </p>
                    {(selectedCategories.length > 0 || searchQuery) && (
                      <Button onClick={clearFilters} variant="outline" className="glass">
                        Clear Filters
                      </Button>
                    )}
                  </GlassCard>
                </motion.div>
              ) : (
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 md:gap-8">
                  {media.map((item, idx) => (
                    <MediaCard key={item.id} item={item} />
                  ))}
                </div>
              )}

              {/* Load More Trigger */}
              {hasMore && (
                <motion.div 
                  ref={loadMoreRef} 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="py-8 sm:py-12 flex justify-center"
                >
                  {isLoadingMore && (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 animate-spin text-primary" />
                      <p className="text-lg sm:text-xl text-muted-foreground font-light">Loading more...</p>
                    </div>
                  )}
                </motion.div>
              )}

              {!hasMore && (media.length > 0 || pinnedMedia.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="py-8 sm:py-12 text-center text-base sm:text-lg text-muted-foreground"
                >
                  {/* <p>You've reached the end! 🎉</p> */}
                </motion.div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Lightbox Modal */}
      <Lightbox />
    </div>
  );
};

export default MediaGalleryPage;