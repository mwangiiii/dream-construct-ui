import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { Eye, MousePointerClick, Share2, X, Loader2, Image as ImageIcon, Calendar, Home, MapPin, Music as MusicIcon, Sparkles, TrendingUp, Trash2 } from "lucide-react";
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

const MediaManagement = () => {
  const [media, setMedia] = useState<MediaPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 20;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Fetch media items
  const fetchMedia = async (pageNum: number = 0, append: boolean = false) => {
    try {
      const offset = pageNum * ITEMS_PER_PAGE;
      let query = supabase
        .from('media_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + ITEMS_PER_PAGE - 1);
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      if (append) {
        setMedia(prev => [...prev, ...(data || [])]);
      } else {
        setMedia(data || []);
      }
      setHasMore((data?.length || 0) === ITEMS_PER_PAGE);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchMedia(0, false);
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
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
  }, [hasMore, isLoading, page]);

  // Soft delete handler
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this media? This can be undone by restoring in the database.")) return;
    try {
      const { error } = await supabase
        .from('media_posts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setMedia(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      alert("Failed to delete media.");
    }
  };

  // Media Card
  const MediaCard = ({ item }: { item: MediaPost }) => (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <GlassCard className="mb-4 break-inside-avoid overflow-hidden border-white/20 backdrop-blur-sm relative">
        <div className="relative overflow-hidden bg-muted">
          {item.media_type === "video" ? (
            <video src={item.thumbnail_url || item.media_url} className="w-full h-auto object-cover" muted loop playsInline />
          ) : item.media_type === "audio" ? (
            <div className="flex items-center justify-center h-48 bg-gradient-to-br from-purple-500 to-pink-600">
              <MusicIcon className="w-16 h-16 text-white" />
            </div>
          ) : (
            <img src={item.thumbnail_url || item.media_url} alt={item.alt_text || item.caption} className="w-full h-auto object-cover" loading="lazy" />
          )}
          <div className="absolute top-2 right-2 flex gap-2">
            {item.is_pinned && (
              <Badge className="bg-primary text-primary-foreground shadow-lg flex items-center gap-1 text-xs px-2 py-1">
                <Sparkles className="w-3 h-3" /> Featured
              </Badge>
            )}
            {/* Delete Button */}
            <Button
              variant="ghost"
              size="icon"
              className="bg-destructive/80 hover:bg-destructive text-white ml-1 shadow-lg"
              title="Delete Media"
              onClick={e => {
                e.stopPropagation();
                handleDelete(item.id);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-black/70 backdrop-blur-sm text-white border-0">
              <Eye className="w-3 h-3" />{item.view_count}
            </Badge>
            <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-black/70 backdrop-blur-sm text-white border-0">
              <MousePointerClick className="w-3 h-3" />{item.click_count}
            </Badge>
          </div>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {item.categories.slice(0, 3).map((cat, idx) => (
              <Badge key={idx} className="text-xs px-2 py-0.5 bg-primary/90 text-primary-foreground">{cat}</Badge>
            ))}
          </div>
          <p className="font-semibold text-sm line-clamp-2 leading-relaxed">{item.caption}</p>
          {Object.keys(item.metadata).length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {item.metadata.location && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.metadata.location}</span>
              )}
              {item.metadata.area && (
                <span className="flex items-center gap-1"><Home className="w-3 h-3" />{item.metadata.area}</span>
              )}
              {item.metadata.completion_time && (
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{item.metadata.completion_time}</span>
              )}
            </div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );

  return (
    <div className="min-h-screen">
      <section className="container mx-auto px-4 py-8">
        <div className="container mx-auto px-4">
          {error && (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center max-w-2xl mx-auto">
              <GlassCard className="p-6">
                <X className="w-16 h-16 mx-auto mb-8 text-destructive" />
                <h3 className="text-2xl font-bold mb-6">Failed to Load Media</h3>
                <p className="text-lg text-muted-foreground mb-8 font-light">{error}</p>
                <Button onClick={() => { setError(null); setIsLoading(true); fetchMedia(0, false); }} className="bg-primary hover:bg-primary/90 text-background font-semibold px-8 py-6 text-lg rounded-xl">Try Again</Button>
              </GlassCard>
            </motion.div>
          )}
          {isLoading && !error && (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-16 h-16 animate-spin text-primary mb-8" />
              <p className="text-xl text-muted-foreground font-light">Loading media...</p>
            </motion.div>
          )}
          {!isLoading && !error && (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6">
              {media.map((item) => (
                <MediaCard key={item.id} item={item} />
              ))}
            </div>
          )}
          {hasMore && (
            <motion.div ref={loadMoreRef} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="py-8 flex justify-center">
              {isLoading && (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-lg text-muted-foreground font-light">Loading more...</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
};

export default MediaManagement;
