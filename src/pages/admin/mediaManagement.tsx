// app/admin/media/page.tsx  (or wherever you keep admin pages )
"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassCard } from "@/components/ui/GlassCard";
import { toast } from "@/components/ui/use-toast";
import {
  Eye, MousePointerClick, Share2, Loader2, Image as ImageIcon,
  Calendar, Home, MapPin, Music as MusicIcon, Sparkles,
  Trash2, RotateCcw, Edit3, CheckCircle2, Clock, Archive, XCircle
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Status = "published" | "draft" | "archived";
type TabType = "all" | "published" | "draft" | "archived" | "trash";

interface MediaPost {
  id: string;
  created_at: string;
  media_url: string;
  thumbnail_url: string | null;
  media_type: "image" | "video" | "audio" | "gif";
  caption: string;
  categories: string[];
  status: Status;
  is_pinned: boolean;
  metadata: Record<string, any>;
  view_count: number;
  click_count: number;
  share_count: number;
  deleted: boolean;
  deleted_at: string | null;
}

const CATEGORIES = [
  "Luxury Villa", "Apartments", "Commercial", "Renovations",
  "Before & After", "Client Testimonial", "Completed 2025", "Drone Shots"
];

const STATUS_CONFIG: Record<Status | "trash", { label: string; icon: any; color: string }> = {
  published: { label: "Published", icon: CheckCircle2, color: "text-green-400" },
  draft: { label: "Draft", icon: Clock, color: "text-amber-400" },
  archived: { label: "Archived", icon: Archive, color: "text-purple-400" },
  trash: { label: "Trash", icon: Trash2, color: "text-red-400" },
};

export default function MediaManagement() {
  const [media, setMedia] = useState<MediaPost[]>([]);
  const [filteredMedia, setFilteredMedia] = useState<MediaPost[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Load all media (admin sees everything)
  useEffect(() => {
    const fetchMedia = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("media_posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setMedia(data || []);
      }
      setIsLoading(false);
    };

    fetchMedia();
  }, []);

  // Filter logic
  useEffect(() => {
    let filtered = media;

    // Tab filter
    if (activeTab !== "all") {
      if (activeTab === "trash") {
        filtered = filtered.filter(m => m.deleted);
      } else {
        filtered = filtered.filter(m => m.status === activeTab && !m.deleted);
      }
    } else {
      filtered = filtered.filter(m => !m.deleted);
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.caption.toLowerCase().includes(q) ||
        item.categories.some(c => c.toLowerCase().includes(q)) ||
        item.metadata?.location?.toLowerCase().includes(q)
      );
    }

    // Category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(item => item.categories.includes(selectedCategory));
    }

    setFilteredMedia(filtered);
  }, [media, activeTab, searchQuery, selectedCategory]);

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase
      .from("media_posts")
      .update({ status })
      .eq("id", id);

    if (!error) {
      setMedia(prev => prev.map(m => m.id === id ? { ...m, status } : m));
      toast({ title: "Updated", description: "Status changed" });
    }
  };

  const togglePin = async (id: string, current: boolean) => {
    const nextPinOrder = current ? null : (media.filter(m => m.is_pinned).length + 1);
    const { error } = await supabase
      .from("media_posts")
      .update({
        is_pinned: !current,
        pin_order: !current ? nextPinOrder : null
      })
      .eq("id", id);

    if (!error) {
      setMedia(prev => prev.map(m =>
        m.id === id
          ? { ...m, is_pinned: !current, pin_order: !current ? nextPinOrder : null }
          : m
      ));
    }
  };

  const softDelete = async (id: string) => {
    const { error } = await supabase
      .from("media_posts")
      .update({
        deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq("id", id);

    if (!error) {
      setMedia(prev => prev.map(m => m.id === id ? { ...m, deleted: true, deleted_at: new Date().toISOString() } : m));
      toast({ title: "Moved to Trash", description: "Media can be restored later" });
    }
  };

  const restore = async (id: string) => {
    const { error } = await supabase
      .from("media_posts")
      .update({
        deleted: false,
        deleted_at: null
      })
      .eq("id", id);

    if (!error) {
      setMedia(prev => prev.map(m => m.id === id ? { ...m, deleted: false, deleted_at: null } : m));
      toast({ title: "Restored", description: "Media restored successfully" });
    }
  };

  const permanentDelete = async (id: string) => {
    if (!confirm("Permanently delete this media? This cannot be undone.")) return;
    const { error } = await supabase
      .from("media_posts")
      .delete()
      .eq("id", id);

    if (!error) {
      setMedia(prev => prev.filter(m => m.id !== id));
      toast({ title: "Deleted Forever", variant: "destructive" });
    }
  };

  const bulkAction = async (action: "publish" | "archive" | "delete" | "restore") => {
    const items = media.filter(m => selectedItems.has(m.id));
    if (items.length === 0) return;

    if (action === "delete") {
      if (!confirm(`Move ${items.length} items to trash?`)) return;
    }

    const updates = items.map(item => {
      if (action === "publish") return supabase.from("media_posts").update({ status: "published" }).eq("id", item.id);
      if (action === "archive") return supabase.from("media_posts").update({ status: "archived" }).eq("id", item.id);
      if (action === "delete") return supabase.from("media_posts").update({ deleted: true, deleted_at: new Date().toISOString() }).eq("id", item.id);
      if (action === "restore") return supabase.from("media_posts").update({ deleted: false, deleted_at: null }).eq("id", item.id);
    });

    await Promise.all(updates);
    toast({ title: "Success", description: `Bulk ${action} completed` });
    setSelectedItems(new Set());
  };

  const MediaCard = ({ item }: { item: MediaPost }) => {
    const StatusIcon = STATUS_CONFIG[item.deleted ? "trash" : item.status].icon;
    const statusColor = STATUS_CONFIG[item.deleted ? "trash" : item.status].color;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="break-inside-avoid mb-6"
      >
        <GlassCard className={`overflow-hidden border ${item.deleted ? 'opacity-60' : ''} hover:border-primary/50 transition-all`}>
          <div className="relative group">
            {item.media_type === "video" ? (
              <video
                src={item.thumbnail_url || item.media_url}
                className="w-full h-64 object-cover"
                muted loop playsInline
                onMouseEnter={e => e.currentTarget.play()}
                onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
              />
            ) : item.media_type === "audio" ? (
              <div className="h-64 bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <MusicIcon className="w-20 h-20 text-white" />
              </div>
            ) : (
              <img
                src={item.thumbnail_url || item.media_url}
                alt={item.caption}
                className="w-full h-64 object-cover"
                loading="lazy"
              />
            )}

            {/* Overlay Controls */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <Button size="sm" onClick={() => updateStatus(item.id, "published")} disabled={item.status === "published"}>
                <CheckCircle2 className="w-4 h-4" /> Publish
              </Button>
              <Button size="sm" variant="secondary" onClick={() => updateStatus(item.id, "draft")}>
                <Clock className="w-4 h-4" /> Draft
              </Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus(item.id, "archived")}>
                <Archive className="w-4 h-4" /> Archive
              </Button>
              {item.deleted ? (
                <>
                  <Button size="sm" onClick={() => restore(item.id)}><RotateCcw className="w-4 h-4" /> Restore</Button>
                  <Button size="sm" variant="destructive" onClick={() => permanentDelete(item.id)}><Trash2 className="w-4 h-4" /> Delete Forever</Button>
                </>
              ) : (
                <Button size="sm" variant="destructive" onClick={() => softDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
              )}
            </div>

            {/* Status Badge */}
            <div className="absolute top-3 left-3">
              <Badge variant="secondary" className="bg-black/70 backdrop-blur">
                <StatusIcon className={`w-3 h-3 mr-1 ${statusColor}`} />
                {STATUS_CONFIG[item.deleted ? "trash" : item.status].label}
              </Badge>
            </div>

            {item.is_pinned && !item.deleted && (
              <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground shadow-lg">
                <Sparkles className="w-3 h-3 mr-1" /> Featured
              </Badge>
            )}
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedItems.has(item.id)}
                onChange={(e) => {
                  const newSet = new Set(selectedItems);
                  if (e.target.checked) newSet.add(item.id); else newSet.delete(item.id);
                  setSelectedItems(newSet);
                }}
                className="rounded border-gray-600"
              />
              <p className="font-medium text-sm line-clamp-2 flex-1">{item.caption}</p>
            </div>

            <div className="flex flex-wrap gap-1">
              {item.categories.slice(0, 3).map(cat => (
                <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex gap-4">
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{item.view_count}</span>
                <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{item.click_count}</span>
              </div>
              <Button
                size="sm"
                variant={item.is_pinned ? "default" : "outline"}
                onClick={() => togglePin(item.id, item.is_pinned)}
                className="h-7 px-2 text-xs"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                {item.is_pinned ? "Pinned" : "Pin to Top"}
              </Button>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background/95">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Media Management
        </h1>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TabType); setSelectedItems(new Set()); }}>
          <TabsList className="grid grid-cols-5 w-full mb-8">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="trash">Trash ({media.filter(m => m.deleted).length})</TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <Input
              placeholder="Search caption, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedItems.size > 0 && (
              <div className="flex gap-2">
                {activeTab !== "trash" ? (
                  <>
                    <Button size="sm" onClick={() => bulkAction("publish")}>Publish Selected</Button>
                    <Button size="sm" variant="secondary" onClick={() => bulkAction("archive")}>Archive Selected</Button>
                    <Button size="sm" variant="destructive" onClick={() => bulkAction("delete")}>Move to Trash</Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => bulkAction("restore")}>Restore Selected</Button>
                )}
                <Badge>{selectedItems.size} selected</Badge>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <ImageIcon className="w-20 h-20 mx-auto mb-4 opacity-30" />
              <p className="text-xl">No media found in this section</p>
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6">
              {filteredMedia.map(item => (
                <MediaCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </Tabs>
      </div>
    </div>
  );
}