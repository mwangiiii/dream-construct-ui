import React, { useState } from 'react';
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    try {
      // Call backend resetPassword function
      const { resetPassword } = await import("@/lib/auth");
      await resetPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background/90 via-background/85 to-background/80">
      <div className="container mx-auto px-4 sm:px-6 flex items-center justify-center">
        <GlassCard className="w-full max-w-md mx-auto p-8 sm:p-10 md:p-12 glass-strong rounded-2xl sm:rounded-3xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-center">Forgot Password</h2>
          {submitted ? (
            <div className="text-green-600 text-center text-base sm:text-lg md:text-xl">
              If an account with that email exists, a password reset link has been sent.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-2">Email Address</label>
                <input
                  type="email"
                  id="email"
                  className="mt-1 block w-full px-4 py-3 border border-border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-base bg-background/80"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                />
              </div>
              {error && <div className="text-red-500 text-sm text-center">{error}</div>}
              <Button
                type="submit"
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 text-background font-semibold px-8 py-4 text-lg rounded-xl"
              >
                Send Reset Link
              </Button>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default ForgotPassword;
