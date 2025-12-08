
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Optionally, you can check for the access token in the URL
  useEffect(() => {
    const type = searchParams.get("type");
    if (type !== "recovery") {
      setError("Invalid or expired password reset link.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background/90 via-background/85 to-background/80 px-4">
      <GlassCard className="w-full max-w-md p-8 md:p-10 rounded-2xl shadow-xl">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center leading-tight">Reset <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Password</span></h2>
        <p className="text-muted-foreground text-center mb-6 text-base md:text-lg">Enter your new password below to regain access to your account.</p>
        {error && <div className="mb-4 text-red-600 text-center font-medium">{error}</div>}
        {success ? (
          <div className="text-green-600 text-center font-semibold">Password reset! Redirecting to login...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block mb-1 font-semibold text-sm md:text-base">New Password</label>
              <input
                type="password"
                className="w-full border border-border bg-background px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold text-sm md:text-base">Confirm New Password</label>
              <input
                type="password"
                className="w-full border border-border bg-background px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full text-lg font-semibold py-2 rounded-xl"
              disabled={loading}
              size="lg"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        )}
      </GlassCard>
    </div>
  );
};

export default ResetPassword;
