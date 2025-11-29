import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Send, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/GlassCard';

const Reviews = () => {
  const [review, setReview] = useState('');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    fetchReviews();
    getCurrentUser();
  }, []);

  async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
  }

  async function fetchReviews() {
    setLoading(true);
    // Only fetch reviews where display = true, ordered by display_order
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('display', true)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    
    if (!error && data) setReviews(data);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) {
      alert('You must be logged in to leave a review.');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('reviews')
      .insert([
        {
          text: review,
          user_id: user.id,
          display: false // Defaults to false, awaiting owner approval
        }
      ]);

    if (error) {
      alert('Error submitting review. Please try again.');
      console.error(error);
    } else {
      setReview('');
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 5000);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-32 flex items-center justify-center overflow-hidden">
        {/* Background with gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/90 to-background/85" />
        
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
        </div>

        {/* Content */}
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.8 }}
              className="mb-6"
            >
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-4 leading-tight">
                Share Your
                <br />
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-glow">
                  Experience
                </span>
              </h1>
            </motion.div>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto"
            >
              Your thoughts and feedback help us build better experiences for everyone
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Review Form Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <GlassCard className="p-8 md:p-12">
              <div className="flex items-center gap-3 mb-6">
                <Star className="w-8 h-8 text-primary" />
                <h2 className="text-3xl md:text-4xl font-bold">
                  Leave a <span className="text-primary">Review</span>
                </h2>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <textarea
                    className="w-full glass text-foreground p-6 rounded-xl border border-white/10 focus:border-primary/50 focus:outline-none transition-colors resize-none placeholder-muted-foreground text-lg"
                    rows={6}
                    placeholder={user ? "Tell us what you think..." : "Sign in to leave a review"}
                    value={review}
                    onChange={e => setReview(e.target.value)}
                    disabled={!user || loading}
                  />
                </div>
                
                <AnimatePresence>
                  {submitSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center gap-3 p-4 glass-strong rounded-xl border border-primary/30"
                    >
                      <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                      <p className="text-primary">
                        Thank you! Your review has been submitted and is awaiting approval.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="flex justify-end">
                  <Button
                    onClick={handleSubmit}
                    disabled={!user || !review.trim() || loading}
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-background font-semibold px-8 py-6 text-lg rounded-xl group"
                  >
                    {loading ? (
                      'Submitting...'
                    ) : user ? (
                      <>
                        Submit Review
                        <Send className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    ) : (
                      'Sign in to submit'
                    )}
                  </Button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* Reviews List Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              What <span className="text-primary">People Are Saying</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Real experiences from our valued clients and partners
            </p>
          </motion.div>

          <div className="max-w-5xl mx-auto">
            {loading && reviews.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-xl text-muted-foreground">Loading reviews...</p>
              </motion.div>
            ) : reviews.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
              >
                <GlassCard className="text-center py-20">
                  <Star className="w-16 h-16 text-primary/50 mx-auto mb-6" />
                  <h3 className="text-2xl font-bold mb-3">No reviews yet</h3>
                  <p className="text-muted-foreground text-lg">
                    Be the first to share your experience
                  </p>
                </GlassCard>
              </motion.div>
            ) : (
              <div className="grid gap-6">
                {reviews.map((r, idx) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ delay: idx * 0.1, duration: 0.6 }}
                  >
                    <GlassCard className="p-8 hover:border-primary/30 transition-all duration-300">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                          <Star className="w-6 h-6 text-background fill-current" />
                        </div>
                        <div className="flex-1">
                          <p className="text-lg md:text-xl leading-relaxed text-foreground mb-4">
                            "{r.text}"
                          </p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                            <span>
                              {new Date(r.created_at).toLocaleDateString('en-US', { 
                                month: 'long', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="glass-strong rounded-3xl p-12 md:p-20 text-center max-w-4xl mx-auto"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Ready to Work With Us?
            </h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Join our growing community of satisfied clients and experience excellence in every project.
            </p>
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-background font-semibold px-12 py-6 text-lg rounded-xl"
            >
              Get Started Today
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Reviews;