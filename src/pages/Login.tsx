// src/pages/Login.tsx
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/ui/GlassCard";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

const Login = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  // Extract redirectTo from URL
  const getRedirectPath = () => {
    const params = new URLSearchParams(location.search);
    const redirectTo = params.get("redirectTo");
    if (redirectTo && redirectTo.startsWith("/")) {
      return decodeURIComponent(redirectTo);
    }
    return "/admin"; // default fallback
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim() || !formData.password) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error("No user data returned");
      }

      // Optional: Fetch profile to get full name (if needed)
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.user.id)
        .single();

      const firstName = profile?.full_name?.split(" ")[0] || "there";

      toast({
        title: "Welcome back!",
        description: `Hello, ${firstName}!`,
      });

      // SUCCESS: Redirect to intended destination
      const redirectPath = getRedirectPath();
      navigate(redirectPath, { replace: true });

    } catch (error: any) {
      let message = "An unexpected error occurred.";

      if (error.message.includes("Invalid login credentials")) {
        message = "Incorrect email or password. Please try again.";
      } else if (error.message.includes("Email not confirmed")) {
        message = "Please check your email and confirm your account first.";
      } else if (error.message.includes("To signup, please provide your email")) {
        message = "Please enter a valid email address.";
      } else if (!navigator.onLine) {
        message = "No internet connection. Please check your network.";
      } else {
        console.error("Login error:", error);
        message = "Login failed. Please try again later.";
      }

      toast({
        title: "Login Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Video Background */}
      <video
        src="https://res.cloudinary.com/dvjm4wcfr/video/upload/v1763642187/Residential-mastery_jwxj8z.mp4"
        className="absolute inset-0 w-full h-full object-cover brightness-75 contrast-110 blur-[1px]"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/80 to-background/70 z-10" />

      {/* Subtle Pattern */}
      <div className="absolute inset-0 opacity-10 z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\\"60\\" height=\\"60\\" viewBox=\\"0 0 60 60\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cg fill=\\"none\\" fill-rule=\\"evenodd\\"%3E%3Cg fill=\\"%23ffffff\\" fill-opacity=\\"0.7\\"%3E%3Cpath d=\\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\\"/%3E%3C/g%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        />
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 z-20 relative flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Logo & Title */}
          <div className="text-center mb-10">
            <Link to="/" className="inline-flex items-center space-x-3 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-xl">
                <span className="text-background font-black text-2xl">DC</span>
              </div>
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
              Welcome Back
            </h1>
            <p className="text-muted-foreground text-lg">
              Sign in to continue building dreams
            </p>
          </div>

          {/* Login Form */}
          <GlassCard className="p-8 shadow-2xl backdrop-blur-xl border border-white/20">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-semibold flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-primary" />
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@company.com"
                  required
                  disabled={loading}
                  className="glass border-border/80 focus:border-primary/50 h-12 text-base"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center">
                    <Lock className="w-4 h-4 mr-2 text-primary" />
                    Password
                  </span>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot?
                  </Link>
                </label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="glass border-border/80 focus:border-primary/50 h-12 text-base"
                  autoComplete="current-password"
                />
              </div>

              {/* Remember Me */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="remember"
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  disabled={loading}
                />
                <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                  Keep me signed in
                </label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-background font-bold text-lg py-7 transition-all duration-200 shadow-lg hover:shadow-xl"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing you in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            </form>

            {/* Register Link */}
            <div className="mt-8 text-center">
              {/* <p className="text-muted-foreground">
                Don't have an account?{" "} */}
                {/* <Link
                  to="/register"
                  className="font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Create one free
                </Link> */}
              {/* </p> */}
            </div>
          </GlassCard>

          {/* Terms */}
          <p className="text-center text-xs text-muted-foreground mt-10 max-w-sm mx-auto leading-relaxed">
            By signing in, you agree to our{" "}
            <Link to="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Login;