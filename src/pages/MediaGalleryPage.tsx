import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  Search, 
  Filter, 
  X, 
  Loader2, 
  Terminal, 
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
  Music as MusicIcon
} from "lucide-react";

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

interface LogEntry {
  timestamp: string;
  level: "info" | "warning" | "error" | "success";
  message: string;
  data?: any;
}

// Available categories
const CATEGORIES = [
  { value: "Luxury Villa", icon: Home, color: "from-amber-500 to-orange-600" },
  { value: "Apartments", icon: Building2, color: "from-blue-500 to-cyan-600" },
  { value: "Commercial", icon: Building2, color: "from-purple-500 to-pink-600" },
  { value: "Renovations", icon: Wrench, color: "from-green-500 to-emerald-600" },
  { value: "Before & After", icon: Camera, color: "from-red-500 to-rose-600" },
  { value: "Client Testimonial", icon: MessageSquare, color: "from-indigo-500 to-blue-600" },
  { value: "Completed 2025", icon: Calendar, color: "from-teal-500 to-cyan-600" },
  { value: "Drone Shots", icon: Camera, color: "from-sky-500 to-blue-600" },
];

const MediaGalleryPage = () => {
  // State
  const [media, setMedia] = useState<MediaPost[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<MediaPost[]>([]);
  const [pinnedMedia, setPinnedMedia] = useState<MediaPost[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaPost | null>(null);
  
  // Debug logging
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  
  // Refs
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  const ITEMS_PER_PAGE = 20;

  // Logger utility
  const log = (level: LogEntry["level"], message: string, data?: any) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };
    
    setLogs(prev => [...prev, entry]);
    
    const consoleData = data ? [message, data] : [message];
    switch (level) {
      case "error":
        console.error(...consoleData);
        break;
      case "warning":
        console.warn(...consoleData);
        break;
      case "success":
        console.log("✅", ...consoleData);
        break;
      default:
        console.log(...consoleData);
    }
  };

  // Fetch media from Supabase
  const fetchMedia = async (pageNum: number = 0, append: boolean = false) => {
    log("info", `Fetching media - Page ${pageNum}`, { append });
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase configuration missing");
      }
      
      const offset = pageNum * ITEMS_PER_PAGE;
      
      // Build query parameters
      const params = new URLSearchParams({
        select: '*',
        order: 'is_pinned.desc,pin_order.asc,created_at.desc',
        limit: String(ITEMS_PER_PAGE),
        offset: String(offset),
      });
      
      // Add filters
      params.append('status', 'eq.published');
      params.append('deleted_at', 'is.null');
      
      if (selectedCategories.length > 0) {
        params.append('categories', `cs.{${selectedCategories.join(',')}}`);
      }
      
      if (searchQuery.trim()) {
        params.append('or', `caption.ilike.%${searchQuery}%,metadata->>location.ilike.%${searchQuery}%`);
      }
      
      log("info", "API Request", {
        url: `${supabaseUrl}/rest/v1/media_posts`,
        params: params.toString(),
      });
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/media_posts?${params.toString()}`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        log("error", "API Error", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Failed to fetch media: ${response.statusText}`);
      }
      
      const data: MediaPost[] = await response.json();
      log("success", `Fetched ${data.length} items`, { count: data.length });
      
      // Separate pinned and regular media
      const pinned = data.filter(item => item.is_pinned);
      const regular = data.filter(item => !item.is_pinned);
      
      if (append) {
        setMedia(prev => [...prev, ...regular]);
        setFilteredMedia(prev => [...prev, ...regular]);
      } else {
        setPinnedMedia(pinned);
        setMedia(regular);
        setFilteredMedia(regular);
      }
      
      setHasMore(data.length === ITEMS_PER_PAGE);
      log("info", "State updated", {
        pinnedCount: pinned.length,
        regularCount: regular.length,
        hasMore: data.length === ITEMS_PER_PAGE,
      });
      
    } catch (err) {
      log("error", "Fetch failed", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      setError(err instanceof Error ? err.message : "Failed to load media");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Initial load
  useEffect(() => {
    log("info", "Component mounted - Initial load");
    fetchMedia(0, false);
  }, []);

  // Refetch when filters change
  useEffect(() => {
    if (selectedCategories.length > 0 || searchQuery.trim()) {
      log("info", "Filters changed - Refetching", {
        categories: selectedCategories,
        searchQuery,
      });
      setIsLoading(true);
      setPage(0);
      fetchMedia(0, false);
    }
  }, [selectedCategories, searchQuery]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          log("info", "Load more triggered");
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
  }, [hasMore, isLoading, isLoadingMore, page]);

  // Category toggle
  const toggleCategory = (category: string) => {
    log("info", `Category toggled: ${category}`);
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Clear filters
  const clearFilters = () => {
    log("info", "Clearing all filters");
    setSelectedCategories([]);
    setSearchQuery("");
    setPage(0);
    setIsLoading(true);
    fetchMedia(0, false);
  };

  // Track view
  const trackView = async (mediaId: string) => {
    log("info", `Tracking view for media: ${mediaId}`);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      await fetch(`${supabaseUrl}/rest/v1/rpc/increment_media_view_count`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey!,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ media_id: mediaId }),
      });
      
      log("success", "View tracked");
    } catch (err) {
      log("error", "Failed to track view", { error: err });
    }
  };

  // Share functionality
  const handleShare = async (item: MediaPost) => {
    log("info", "Share initiated", { id: item.id });
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.caption,
          text: item.caption,
          url: window.location.href + `?media=${item.id}`,
        });
        log("success", "Shared via native share");
      } catch (err) {
        log("warning", "Share cancelled or failed", { error: err });
      }
    } else {
      // Fallback: copy link
      const link = window.location.href + `?media=${item.id}`;
      navigator.clipboard.writeText(link);
      log("success", "Link copied to clipboard");
      alert("Link copied to clipboard!");
    }
  };

  // Render media card
  const MediaCard = ({ item }: { item: MediaPost }) => {
    const categoryInfo = CATEGORIES.find(c => c.value === item.categories[0]);
    const Icon = categoryInfo?.icon || ImageIcon;
    
    return (
      <Card 
        className="group mb-6 break-inside-avoid overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border border-muted/40 bg-background"
        onClick={() => {
          setSelectedMedia(item);
          trackView(item.id);
        }}
      >
        {/* Media Content */}
        <div className="relative overflow-hidden bg-muted">
          {item.media_type === "video" ? (
            <div className="relative">
              <video 
                src={item.thumbnail_url || item.media_url} 
                className="w-full object-cover"
                muted
                loop
                onMouseEnter={e => e.currentTarget.play()}
                onMouseLeave={e => e.currentTarget.pause()}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                <VideoIcon className="w-12 h-12 text-white" />
              </div>
            </div>
          ) : item.media_type === "audio" ? (
            <div className="flex items-center justify-center h-48 bg-primary/80">
              <MusicIcon className="w-16 h-16 text-white" />
            </div>
          ) : (
            <img 
              src={item.thumbnail_url || item.media_url} 
              alt={item.alt_text || item.caption}
              className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          )}
          {/* Pinned Badge */}
          {item.is_pinned && (
            <div className="absolute top-3 right-3">
              <Badge className="bg-primary text-white shadow-lg flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Featured
              </Badge>
            </div>
          )}
          {/* Stats Overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-black/60 backdrop-blur-sm">
              <Eye className="w-3 h-3" />
              {item.view_count}
            </Badge>
            <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-black/60 backdrop-blur-sm">
              <MousePointerClick className="w-3 h-3" />
              {item.click_count}
            </Badge>
          </div>
        </div>
        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {item.categories.slice(0, 3).map((cat, idx) => (
              <Badge 
                key={idx}
                className="text-xs px-2 py-1 bg-primary/80 text-white"
              >
                {cat}
              </Badge>
            ))}
          </div>
          {/* Caption */}
          <p className="font-semibold text-sm line-clamp-2 leading-relaxed">
            {item.caption}
          </p>
          {/* Metadata */}
          {Object.keys(item.metadata).length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
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
          <div className="flex items-center justify-between pt-2 border-t border-muted/40">
            {item.project_link ? (
              <a 
                href={item.project_link}
                onClick={e => e.stopPropagation()}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                View Project
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <div />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={(e) => {
                e.stopPropagation();
                handleShare(item);
              }}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  // Lightbox Modal
  const Lightbox = () => {
    if (!selectedMedia) return null;
    
    return (
      <div 
        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => setSelectedMedia(null)}
      >
        <div 
          className="relative max-w-6xl w-full max-h-[90vh] overflow-auto bg-card rounded-xl shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70"
            onClick={() => setSelectedMedia(null)}
          >
            <X className="w-6 h-6 text-white" />
          </Button>
          
          {/* Media */}
          <div className="relative">
            {selectedMedia.media_type === "video" ? (
              <video 
                src={selectedMedia.media_url}
                controls
                autoPlay
                className="w-full max-h-[70vh] object-contain"
              />
            ) : selectedMedia.media_type === "audio" ? (
              <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-purple-500 to-pink-600">
                <MusicIcon className="w-24 h-24 text-white mb-6" />
                <audio src={selectedMedia.media_url} controls className="w-full max-w-md" />
              </div>
            ) : (
              <img 
                src={selectedMedia.media_url}
                alt={selectedMedia.alt_text || selectedMedia.caption}
                className="w-full max-h-[70vh] object-contain"
              />
            )}
          </div>
          
          {/* Details */}
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              {selectedMedia.categories.map((cat, idx) => (
                <Badge key={idx} className="bg-primary text-primary-foreground">
                  {cat}
                </Badge>
              ))}
            </div>
            
            <h2 className="text-2xl font-bold">{selectedMedia.caption}</h2>
            
            {Object.keys(selectedMedia.metadata).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                {selectedMedia.metadata.completion_time && (
                  <div>
                    <p className="text-xs text-muted-foreground">Completion Time</p>
                    <p className="font-semibold">{selectedMedia.metadata.completion_time}</p>
                  </div>
                )}
                {selectedMedia.metadata.client_satisfaction && (
                  <div>
                    <p className="text-xs text-muted-foreground">Satisfaction</p>
                    <p className="font-semibold">{selectedMedia.metadata.client_satisfaction}</p>
                  </div>
                )}
                {selectedMedia.metadata.area && (
                  <div>
                    <p className="text-xs text-muted-foreground">Area</p>
                    <p className="font-semibold">{selectedMedia.metadata.area}</p>
                  </div>
                )}
                {selectedMedia.metadata.project_cost && (
                  <div>
                    <p className="text-xs text-muted-foreground">Project Cost</p>
                    <p className="font-semibold">{selectedMedia.metadata.project_cost}</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
              
              <Button onClick={() => handleShare(selectedMedia)}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Hero/Header Section */}
      <section className="relative h-[40vh] md:h-[50vh] flex items-center justify-center overflow-hidden bg-gradient-to-r from-blue-600 to-primary">
        <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/85 to-background/80 z-10" />
        <div className="container mx-auto px-4 sm:px-6 z-20 relative text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-4 tracking-tight">Dream Construct Gallery</h1>
          <p className="text-lg sm:text-xl text-white/90 mb-8">Explore our stunning portfolio of luxury villas, modern apartments, and transformative renovations</p>
          {/* <Button variant="secondary" size="sm" onClick={() => setShowLogs(!showLogs)} className="gap-2">
            <Terminal className="w-4 h-4" />
            {showLogs ? "Hide" : "Show"} Debug Logs ({logs.length})
          </Button> */}
        </div>
      </section>

      {/* Debug Logs Section
      {showLogs && (
        <section className="container mx-auto px-4 mt-4">
          <Card className="p-4 bg-slate-950 text-slate-50 max-h-96 overflow-y-auto font-mono text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400">Debug Console</span>
              <Button variant="ghost" size="sm" onClick={() => setLogs([])}>
                Clear
              </Button>
            </div>
            <div className="space-y-2">
              {logs.map((log, idx) => (
                <div key={idx} className="border-b border-slate-800 pb-2">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={log.level === "error" ? "text-red-400" : log.level === "warning" ? "text-yellow-400" : log.level === "success" ? "text-green-400" : "text-blue-400"}>[{log.level.toUpperCase()}]</span>
                    <p className="text-slate-200 flex-1">{log.message}</p>
                  </div>
                  {log.data && (<pre className="text-slate-400 mt-1 text-[10px] overflow-x-auto ml-4">{JSON.stringify(log.data, null, 2)}</pre>)}
                </div>
              ))}
            </div>
          </Card>
        </section>
      )} */}

      {/* Filters Section */}
      <section className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input placeholder="Search by location, project type, or caption..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 pr-10 h-12 text-base" />
              {searchQuery && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setSearchQuery("")}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {/* Filter Toggle */}
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2 h-12 min-w-[140px]">
              <Filter className="w-5 h-5" />
              Filters
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              {selectedCategories.length > 0 && (<Badge variant="secondary" className="ml-2">{selectedCategories.length}</Badge>)}
            </Button>
          </div>
          {/* Category Filters */}
          {showFilters && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategories.includes(cat.value);
                  return (
                    <Badge key={cat.value} className={`cursor-pointer px-4 py-2 text-sm transition-all hover:scale-105 flex items-center gap-2 ${isSelected ? `bg-gradient-to-r ${cat.color} text-white shadow-lg` : "bg-muted hover:bg-muted/80"}`} onClick={() => toggleCategory(cat.value)}>
                      <Icon className="w-4 h-4" />
                      {cat.value}
                    </Badge>
                  );
                })}
              </div>
              {(selectedCategories.length > 0 || searchQuery) && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Showing {filteredMedia.length} result{filteredMedia.length !== 1 ? 's' : ''}</p>
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2"><X className="w-4 h-4" />Clear all filters</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Main Content Section */}
      <section className="container mx-auto px-4 py-8">
        {/* Error State */}
        {error && (
          <Card className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-xl font-semibold mb-2">Failed to Load Media</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => { setError(null); setIsLoading(true); fetchMedia(0, false); }}>Try Again</Button>
          </Card>
        )}
        {/* Loading State */}
        {isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading amazing projects...</p>
          </div>
        )}
        {/* Pinned Media Section */}
        {!isLoading && !error && pinnedMedia.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-6 h-6 text-amber-500" />
              <h2 className="text-3xl font-bold">Featured Projects</h2>
              <TrendingUp className="w-6 h-6 text-amber-500" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pinnedMedia.map(item => (<MediaCard key={item.id} item={item} />))}
            </div>
          </div>
        )}
        {/* Regular Media Grid */}
        {!isLoading && !error && (
          <>
            {filteredMedia.length === 0 ? (
              <Card className="p-12 text-center">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No Media Found</h3>
                <p className="text-muted-foreground mb-4">Try adjusting your filters or search query</p>
                {(selectedCategories.length > 0 || searchQuery) && (<Button onClick={clearFilters} variant="outline">Clear Filters</Button>)}
              </Card>
            ) : (
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6">
                {filteredMedia.map(item => (<MediaCard key={item.id} item={item} />))}
              </div>
            )}
            {/* Load More Trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="py-12 flex justify-center">
                {isLoadingMore && (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading more...</p>
                  </div>
                )}
              </div>
            )}
            {!hasMore && filteredMedia.length > 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <p>You've reached the end! 🎉</p>
              </div>
            )}
          </>
        )}
      </section>

      {/* Lightbox Modal */}
      <Lightbox />

      {/* CTA Section (matches Index.tsx)
      <section className="py-16 sm:py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-blue-600/10" />
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <Card className="glass-strong rounded-2xl sm:rounded-3xl p-6 sm:p-12 md:p-20 text-center max-w-xl sm:max-w-2xl md:max-w-4xl mx-auto bg-background border border-muted/40">
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 text-primary">Ready to Build Your Dream?</h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 md:mb-10 max-w-lg sm:max-w-xl md:max-w-2xl mx-auto">Let's transform your vision into reality with Dream Construct</p>
            <Button size="lg" variant="primary" asChild>
              <a href="/contact" className="gap-2">Contact Us Today<ExternalLink className="w-5 h-5" /></a>
            </Button>
          </Card>
        </div>
      </section> */}
    </div>
  );
};

export default MediaGalleryPage;