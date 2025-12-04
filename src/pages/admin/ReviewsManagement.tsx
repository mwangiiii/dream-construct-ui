import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const ReviewsManagement = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingOrder, setEditingOrder] = useState({});

  useEffect(() => {
    checkAuthorization();
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      fetchAllReviews();
    }
  }, [isAuthorized, filter]);

  async function checkAuthorization() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      setAuthError('You must be logged in to access this page.');
      setLoading(false);
      return;
    }

    setUser(authUser);

    // Check if user has admin role AND active status
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role_name')
      .eq('user_id', authUser.id)
      .eq('role_name', 'admin')
      .single();

    if (roleError || !userRole) {
      setAuthError('You do not have administrator privileges.');
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    // Check if user status is active
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('status')
      .eq('user_id', authUser.id)
      .single();

    if (profileError || !profile) {
      setAuthError('Unable to verify user status.');
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    if (profile.status !== 'active') {
      setAuthError(`Your account is ${profile.status}. Only active administrators can access this page.`);
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    // User is an active admin
    setIsAuthorized(true);
    setLoading(false);
  }

  async function fetchAllReviews() {
    setLoading(true);
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
      console.error('Error fetching reviews:', error);
      if (error.code === 'PGRST301' || error.message?.includes('policy')) {
        setAuthError('Authorization error: Unable to fetch reviews. Please verify your admin status.');
        setIsAuthorized(false);
      }
    } else if (data) {
      setReviews(data);
    }
    setLoading(false);
  }

  async function toggleDisplay(id, currentStatus) {
    const { error } = await supabase
      .from('reviews')
      .update({ display: !currentStatus })
      .eq('id', id);

    if (error) {
      console.error('Error updating review:', error);
      if (error.code === 'PGRST301' || error.message?.includes('policy')) {
        alert('Authorization error: You do not have permission to update reviews.');
        checkAuthorization();
      } else {
        alert('Error updating review status');
      }
    } else {
      fetchAllReviews();
    }
  }

  async function updateOrder(id, newOrder) {
    const orderValue = newOrder === '' ? null : parseInt(newOrder);
    
    const { error } = await supabase
      .from('reviews')
      .update({ display_order: orderValue })
      .eq('id', id);

    if (error) {
      console.error('Error updating order:', error);
      if (error.code === 'PGRST301' || error.message?.includes('policy')) {
        alert('Authorization error: You do not have permission to update reviews.');
        checkAuthorization();
      } else {
        alert('Error updating review order');
      }
    } else {
      setEditingOrder({ ...editingOrder, [id]: false });
      fetchAllReviews();
    }
  }

  async function deleteReview(id) {
    if (!window.confirm('Are you sure you want to permanently delete this review?')) return;

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting review:', error);
      if (error.code === 'PGRST301' || error.message?.includes('policy')) {
        alert('Authorization error: You do not have permission to delete reviews.');
        checkAuthorization();
      } else {
        alert('Error deleting review');
      }
    } else {
      fetchAllReviews();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-zinc-800 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl text-gray-400">Verifying permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-900/20 border border-red-900/50 rounded-2xl p-8 mb-6">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h1 className="text-3xl font-semibold mb-3">Access Denied</h1>
            <p className="text-gray-400 text-lg">{authError}</p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="bg-white text-black px-6 py-3 rounded-full font-medium hover:bg-gray-200 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const displayedCount = reviews.filter(r => r.display).length;
  const hiddenCount = reviews.filter(r => !r.display).length;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs sm:text-sm text-green-400 font-medium">ADMIN ACCESS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-2">
            Reviews Management
          </h1>
          <p className="text-gray-400 text-base sm:text-lg">
            Moderate and organize customer reviews
          </p>
        </div>

        {/* Stats & Filters */}
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row flex-wrap gap-4 items-stretch sm:items-center justify-between">
          <div className="flex gap-3 sm:gap-6 mb-2 sm:mb-0">
            <div className="bg-zinc-900 rounded-xl px-4 sm:px-6 py-2 sm:py-3 border border-zinc-800">
              <span className="text-gray-400 text-xs sm:text-sm">Total: </span>
              <span className="text-white font-semibold text-base sm:text-lg">{reviews.length}</span>
            </div>
            <div className="bg-zinc-900 rounded-xl px-4 sm:px-6 py-2 sm:py-3 border border-green-900/50">
              <span className="text-gray-400 text-xs sm:text-sm">Displayed: </span>
              <span className="text-green-400 font-semibold text-base sm:text-lg">{displayedCount}</span>
            </div>
            <div className="bg-zinc-900 rounded-xl px-4 sm:px-6 py-2 sm:py-3 border border-yellow-900/50">
              <span className="text-gray-400 text-xs sm:text-sm">Hidden: </span>
              <span className="text-yellow-400 font-semibold text-base sm:text-lg">{hiddenCount}</span>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-1 sm:gap-2 bg-zinc-900 rounded-xl p-1 border border-zinc-800 w-full sm:w-auto">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-base ${
                filter === 'all' 
                  ? 'bg-white text-black' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('displayed')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-base ${
                filter === 'displayed' 
                  ? 'bg-white text-black' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Displayed
            </button>
            <button
              onClick={() => setFilter('hidden')}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-base ${
                filter === 'hidden' 
                  ? 'bg-white text-black' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Hidden
            </button>
          </div>
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="text-center py-16 sm:py-20 bg-zinc-900 rounded-2xl border border-zinc-800">
              <p className="text-gray-400 text-base sm:text-lg">No reviews found</p>
            </div>
          ) : (
            reviews.map((review) => (
              <div
                key={review.id}
                className={`bg-zinc-900 rounded-2xl p-4 sm:p-6 border transition-all ${
                  review.display 
                    ? 'border-green-900/50 bg-green-950/10' 
                    : 'border-zinc-800'
                }`}
              >
                <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                  {/* Order Number */}
                  <div className="flex-shrink-0 flex flex-row md:flex-col items-center md:items-start gap-2 md:gap-0 mb-2 md:mb-0">
                    {editingOrder[review.id] ? (
                      <input
                        type="number"
                        defaultValue={review.display_order || ''}
                        placeholder="#"
                        className="w-14 sm:w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-center text-white focus:outline-none focus:border-zinc-600"
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
                        className="w-14 sm:w-16 h-10 bg-zinc-800 border border-zinc-700 rounded-lg text-gray-400 hover:text-white hover:border-zinc-600 transition-colors font-mono text-sm"
                      >
                        {review.display_order || '—'}
                      </button>
                    )}
                  </div>

                  {/* Review Content */}
                  <div className="flex-1">
                    <p className="text-white text-base sm:text-lg leading-relaxed mb-2 sm:mb-3">
                      {review.text}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400">
                      <span>ID: {review.id}</span>
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
                  <div className="flex-shrink-0 flex flex-row md:flex-col gap-2 items-center md:items-end mt-2 md:mt-0">
                    <button
                      onClick={() => toggleDisplay(review.id, review.display)}
                      className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-xs sm:text-base ${
                        review.display
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700 hover:text-white'
                      }`}
                    >
                      {review.display ? 'Displayed' : 'Hidden'}
                    </button>
                    <button
                      onClick={() => deleteReview(review.id)}
                      className="px-3 sm:px-4 py-2 rounded-lg font-medium bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors text-xs sm:text-base"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewsManagement;