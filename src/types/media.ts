// types/media.ts
export type MediaType = 'image' | 'video' | 'audio' | 'gif';
export type MediaStatus = 'draft' | 'published' | 'archived';

export interface MediaMetadata {
  completion_time?: string;
  client_satisfaction?: string;
  area?: string;
  location?: string;
  project_cost?: string;
  [key: string]: any;
}

export interface MediaPost {
  id: string;
  created_at: string;
  updated_at: string;
  media_url: string;
  thumbnail_url: string | null;
  media_type: MediaType;
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
  status: MediaStatus;
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

export interface UploadMediaRequest {
  files: File[];
  caption: string;
  categories: string[];
  projectLink?: string;
  pinToTop: boolean;
  metadata?: MediaMetadata;
  altText?: string;
}

export interface MediaFilters {
  categories?: string[];
  searchQuery?: string;
  status?: MediaStatus;
  isPinned?: boolean;
}

export interface MediaPaginationParams {
  limit?: number;
  offset?: number;
}

// lib/api/media.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export class MediaAPI {
  /**
   * Upload media files to the edge function
   */
  static async uploadMedia(
    request: UploadMediaRequest,
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; data?: MediaPost[]; error?: string }> {
    try {
      const formData = new FormData();
      
      // Append all files
      request.files.forEach((file) => {
        formData.append('files', file);
      });

      // Append metadata as JSON
      formData.append('data', JSON.stringify({
        caption: request.caption,
        categories: request.categories,
        projectLink: request.projectLink,
        pinToTop: request.pinToTop,
        metadata: request.metadata,
        altText: request.altText,
      }));

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return { success: false, error: 'Authentication required' };
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/upload-media`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || 'Upload failed' };
      }

      return { success: true, data: result.data };
    } catch (error) {
      console.error('Upload error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      };
    }
  }

  /**
   * Fetch media posts with filters and pagination
   */
  static async getMediaPosts(
    filters?: MediaFilters,
    pagination?: MediaPaginationParams
  ): Promise<{ data: MediaPost[] | null; error: any }> {
    let query = supabase
      .from('media_posts')
      .select('*')
      .is('deleted_at', null)
      .eq('status', filters?.status || 'published');

    // Apply filters
    if (filters?.categories && filters.categories.length > 0) {
      query = query.overlaps('categories', filters.categories);
    }

    if (filters?.searchQuery) {
      query = query.or(
        `caption.ilike.%${filters.searchQuery}%,` +
        `metadata->>location.ilike.%${filters.searchQuery}%`
      );
    }

    if (filters?.isPinned !== undefined) {
      query = query.eq('is_pinned', filters.isPinned);
    }

    // Apply sorting
    query = query
      .order('is_pinned', { ascending: false })
      .order('pin_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    // Apply pagination
    if (pagination?.limit) {
      query = query.limit(pagination.limit);
    }
    if (pagination?.offset) {
      query = query.range(
        pagination.offset,
        pagination.offset + (pagination.limit || 20) - 1
      );
    }

    return await query;
  }

  /**
   * Get a single media post by ID
   */
  static async getMediaPost(id: string): Promise<{ data: MediaPost | null; error: any }> {
    return await supabase
      .from('media_posts')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
  }

  /**
   * Increment view count for a media post
   */
  static async incrementViewCount(id: string): Promise<void> {
    await supabase.rpc('increment_media_view_count', { media_id: id });
  }

  /**
   * Increment click count for a media post
   */
  static async incrementClickCount(id: string): Promise<void> {
    await supabase.rpc('increment_media_click_count', { media_id: id });
  }

  /**
   * Increment share count for a media post
   */
  static async incrementShareCount(id: string): Promise<void> {
    await supabase.rpc('increment_media_share_count', { media_id: id });
  }

  /**
   * Search media posts using the database function
   */
  static async searchMediaPosts(
    searchQuery?: string,
    filterCategories?: string[],
    limit: number = 20,
    offset: number = 0
  ): Promise<{ data: MediaPost[] | null; error: any }> {
    return await supabase.rpc('search_media_posts', {
      search_query: searchQuery || null,
      filter_categories: filterCategories || null,
      limit_count: limit,
      offset_count: offset,
    });
  }

  /**
   * Update a media post (admin only)
   */
  static async updateMediaPost(
    id: string,
    updates: Partial<MediaPost>
  ): Promise<{ data: MediaPost | null; error: any }> {
    return await supabase
      .from('media_posts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
  }

  /**
   * Soft delete a media post
   */
  static async deleteMediaPost(id: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('media_posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    return { error };
  }

  /**
   * Subscribe to realtime changes
   */
  static subscribeToMediaPosts(
    callback: (payload: any) => void
  ) {
    return supabase
      .channel('media_posts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'media_posts',
        },
        callback
      )
      .subscribe();
  }

  /**
   * Get analytics for admin dashboard
   */
  static async getMediaAnalytics(): Promise<{
    totalPosts: number;
    totalViews: number;
    totalClicks: number;
    totalShares: number;
    topPosts: MediaPost[];
  }> {
    const { data: posts } = await supabase
      .from('media_posts')
      .select('*')
      .is('deleted_at', null)
      .eq('status', 'published');

    if (!posts) {
      return {
        totalPosts: 0,
        totalViews: 0,
        totalClicks: 0,
        totalShares: 0,
        topPosts: [],
      };
    }

    const totalViews = posts.reduce((sum, post) => sum + (post.view_count || 0), 0);
    const totalClicks = posts.reduce((sum, post) => sum + (post.click_count || 0), 0);
    const totalShares = posts.reduce((sum, post) => sum + (post.share_count || 0), 0);

    const topPosts = [...posts]
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 10);

    return {
      totalPosts: posts.length,
      totalViews,
      totalClicks,
      totalShares,
      topPosts,
    };
  }

  /**
   * Get all available categories from existing posts
   */
  static async getCategories(): Promise<string[]> {
    const { data } = await supabase
      .from('media_posts')
      .select('categories')
      .is('deleted_at', null);

    if (!data) return [];

    const allCategories = new Set<string>();
    data.forEach((post) => {
      post.categories?.forEach((cat: string) => allCategories.add(cat));
    });

    return Array.from(allCategories).sort();
  }
}

// Export default instance
export default MediaAPI;