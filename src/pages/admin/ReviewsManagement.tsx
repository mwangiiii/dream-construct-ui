import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Trash2, GripVertical, CheckCircle, XCircle } from 'lucide-react';

const ReviewsManagement = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingOrder, setEditingOrder] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    checkAuthorization();
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      fetchAllReviews();
    }
  }, [isAuthorized, filter]);

  async function checkAuthorization() {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        setAuthError('You must be logged in to access this page.');
        setLoading(false);
        return;
      }

      setUser(authUser);

      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('role_name')
        .eq('user_id', authUser.id)
        .eq('role_name', 'admin')
        .maybeSingle();

      if (roleError) {
        setAuthError('Unable to verify administrator privileges.');
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      if (!userRole) {
        setAuthError('You do not have administrator privileges.');
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      setIsAuthorized(true);
      setLoading(false);
    } catch {
      setAuthError('An error occurred while verifying permissions.');
      setIsAuthorized(false);
      setLoading(false);
    }
  }

  async function fetchAllReviews() {
    setLoading(true);
    try {
      let query = supabase
        .from('reviews')
        .select('*')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (filter === 'displayed') {
        query = query.eq('display', true);
      } else if (filter === 'hidden') {
        query = query.eq('display', false);
      }

      const { data, error } = await query;
      
      if (error) {
        if (error.code === 'PGRST301' || error.message?.includes('policy')) {
          setAuthError('Authorization error: Unable to fetch reviews. Please verify your admin status.');
          setIsAuthorized(false);
        }
      } else if (data) {
        setReviews(data);
      }
    } catch {
      /* fetch is best-effort */
    } finally {
      setLoading(false);
    }
  }

  async function toggleDisplay(id, currentStatus) {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ display: !currentStatus })
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST301' || error.message?.includes('policy')) {
          toast({ title: 'Authorization error: You do not have permission to update reviews.', variant: 'destructive' });
          checkAuthorization();
        } else {
          toast({ title: 'Error updating review status', variant: 'destructive' });
        }
      } else {
        fetchAllReviews();
      }
    } catch {
      toast({ title: 'An error occurred while updating the review', variant: 'destructive' });
    }
  }

  async function updateOrder(id, newOrder) {
    try {
      const orderValue = newOrder === '' ? null : parseInt(newOrder);
      
      const { error } = await supabase
        .from('reviews')
        .update({ display_order: orderValue })
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST301' || error.message?.includes('policy')) {
          toast({ title: 'Authorization error: You do not have permission to update reviews.', variant: 'destructive' });
          checkAuthorization();
        } else {
          toast({ title: 'Error updating review order', variant: 'destructive' });
        }
      } else {
        setEditingOrder({ ...editingOrder, [id]: false });
        fetchAllReviews();
      }
    } catch {
      toast({ title: 'An error occurred while updating the order', variant: 'destructive' });
    }
  }

  async function deleteReview(id) {
    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST301' || error.message?.includes('policy')) {
          toast({ title: 'Authorization error: You do not have permission to delete reviews.', variant: 'destructive' });
          checkAuthorization();
        } else {
          toast({ title: 'Error deleting review', variant: 'destructive' });
        }
      } else {
        setDeleteConfirm(null);
        fetchAllReviews();
      }
    } catch {
      toast({ title: 'An error occurred while deleting the review', variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background/95 via-background/98 to-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl text-muted-foreground tracking-tight">Verifying permissions...</p>
        </motion.div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background/95 via-background/98 to-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-8 mb-6 backdrop-blur-sm">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-3 tracking-tight">Access Denied</h1>
            <p className="text-muted-foreground text-lg">{authError}</p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-full font-semibold hover:bg-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            Go Back
          </button>
        </motion.div>
      </div>
    );
  }

  const displayedCount = reviews.filter(r => r.display).length;
  const hiddenCount = reviews.filter(r => !r.display).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background/95 via-background/98 to-background">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-8 py-6 md:py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 sm:mb-10 md:mb-12"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs sm:text-sm text-green-400 font-semibold tracking-wide uppercase">Admin Access</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent tracking-tight">
            Reviews Management
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg md:text-xl">
            Moderate and organize customer reviews
          </p>
        </motion.div>

        {/* Stats & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 md:mb-8 flex flex-col sm:flex-row flex-wrap gap-4 items-stretch sm:items-center justify-between"
        >
          <div className="flex gap-3 sm:gap-4 mb-2 sm:mb-0 flex-wrap">
            <div className="bg-card border border-white/10 rounded-xl px-4 sm:px-6 py-3 backdrop-blur-sm">
              <span className="text-muted-foreground text-xs sm:text-sm">Total </span>
              <span className="text-foreground font-bold text-lg sm:text-xl">{reviews.length}</span>
            </div>
            <div className="bg-card border border-green-500/20 rounded-xl px-4 sm:px-6 py-3 backdrop-blur-sm">
              <span className="text-muted-foreground text-xs sm:text-sm">Displayed </span>
              <span className="text-green-400 font-bold text-lg sm:text-xl">{displayedCount}</span>
            </div>
            <div className="bg-card border border-yellow-500/20 rounded-xl px-4 sm:px-6 py-3 backdrop-blur-sm">
              <span className="text-muted-foreground text-xs sm:text-sm">Hidden </span>
              <span className="text-yellow-400 font-bold text-lg sm:text-xl">{hiddenCount}</span>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-1 bg-card/50 backdrop-blur-sm rounded-xl p-1 border border-white/10 w-full sm:w-auto">
            {['all', 'displayed', 'hidden'].map((filterType) => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType)}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-lg transition-all duration-300 text-sm sm:text-base font-semibold capitalize ${
                  filter === filterType
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                {filterType}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 bg-card/50 backdrop-blur-sm rounded-2xl border border-white/10"
            >
              <p className="text-muted-foreground text-lg">No reviews found</p>
            </motion.div>
          ) : (
            reviews.map((review, idx) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`bg-card/50 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border transition-all duration-300 hover:shadow-xl hover:border-primary/40 ${
                  review.display
                    ? 'border-green-500/30 bg-green-950/10'
                    : 'border-white/10'
                }`}
              >
                <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                  {/* Order Number */}
                  <div className="flex-shrink-0 flex flex-row md:flex-col items-center md:items-start gap-2 md:gap-2">
                    <GripVertical className="w-5 h-5 text-muted-foreground" />
                    {editingOrder[review.id] ? (
                      <input
                        type="number"
                        defaultValue={review.display_order || ''}
                        placeholder="#"
                        className="w-16 bg-background/50 border border-primary/30 rounded-lg px-2 py-1.5 text-center text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        onBlur={(e) => updateOrder(review.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateOrder(review.id, e.target.value);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => setEditingOrder({ ...editingOrder, [review.id]: true })}
                        className="w-16 h-10 bg-background/50 border border-white/10 rounded-lg text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all duration-300 font-mono text-sm font-semibold"
                      >
                        {review.display_order || '—'}
                      </button>
                    )}
                  </div>

                  {/* Review Content */}
                  <div className="flex-1">
                    <p className="text-foreground text-base sm:text-lg leading-relaxed mb-3 tracking-tight">
                      "{review.text}"
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                      <span className="font-mono">ID: {review.id}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>
                        {new Date(review.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex flex-row md:flex-col gap-2 items-center md:items-end">
                    <button
                      onClick={() => toggleDisplay(review.id, review.display)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-300 text-sm ${
                        review.display
                          ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
                          : 'bg-card border border-white/10 text-muted-foreground hover:text-foreground hover:border-primary/50'
                      }`}
                    >
                      {review.display ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      {review.display ? 'Visible' : 'Hidden'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(review.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 hover:border-destructive/40 transition-all duration-300 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-card border border-destructive/30 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Delete Review?</h2>
              </div>
              <p className="text-muted-foreground mb-6 text-base">
                This action cannot be undone. The review will be permanently removed from the database.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 rounded-lg font-semibold bg-card border border-white/10 text-foreground hover:bg-white/5 transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteReview(deleteConfirm)}
                  className="flex-1 px-4 py-3 rounded-lg font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReviewsManagement;