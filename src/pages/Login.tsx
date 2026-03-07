// src/pages/Login.tsx
import { motion } from "framer-motion";
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // Extract redirectTo from URL
  // const getRedirectPath = () => {
  //   const params = new URLSearchParams(location.search);
  //   const redirectTo = params.get("redirectTo");
  //   if (redirectTo && redirectTo.startsWith("/")) {
  //     return decodeURIComponent(redirectTo);
  //   }
  //   return "/admin"; // default fallback
  // };

  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({}); // Clear previous errors

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
      // Attempt login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      if (error) {
        // Determine which field is incorrect
        if (error.code === "invalid_credentials" || error.message?.includes("Invalid login credentials")) {
          // Check if email exists in auth.users by querying profiles table
          // The profiles table should have the same email as auth.users
          const { data: userExists, error: checkError } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", "(SELECT id FROM auth.users WHERE email = $1)")
            .limit(1);

          // Alternative: Try to check using RPC or direct auth table query
          // Let's use a simpler approach - check profiles by email
          const { count, error: countError } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .ilike("email", formData.email.trim());

          if (countError) {
            console.error("Error checking email:", countError);
          }

          // If count is 0 or null, email doesn't exist
          if (count === 0) {
            setFieldErrors({ email: "No account found with this email" });
            toast({
              title: "Email Not Found",
              description: "No account exists with this email address. Please check your email or create an account.",
              variant: "destructive",
            });
          } else {
            // Email exists, so password is wrong
            setFieldErrors({ password: "Incorrect password" });
            toast({
              title: "Incorrect Password",
              description: "The password you entered is incorrect. Please try again or use 'Forgot Password' to reset it.",
              variant: "destructive",
            });
          }
        } else if (error.code === "email_not_confirmed" || error.message?.includes("Email not confirmed")) {
          setFieldErrors({ email: "Email not confirmed" });
          toast({
            title: "Email Not Confirmed",
            description: "Please check your email and confirm your account first.",
            variant: "destructive",
          });
        } else if (error.code === "email_address_invalid" || error.message?.includes("invalid email") || error.code === "validation_failed") {
          setFieldErrors({ email: "Invalid email format" });
          toast({
            title: "Invalid Email",
            description: "Please enter a valid email address.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Login Failed",
            description: error.message || "An unexpected error occurred. Please try again.",
            variant: "destructive",
          });
        }
        setLoading(false);
        return;
      }

      if (!data.user) {
        throw new Error("No user data returned");
      }

      // Fetch profile to get full name
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
      // Fetch user roles and redirect based on role
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role_name")
        .eq("user_id", data.user.id);

      if (rolesError) {
        console.error("Error fetching user roles:", rolesError);
        navigate("/client/dashboard", { replace: true }); // fallback
        return;
      }

      // userRoles is an array of roles
      const roleNames = userRoles?.map((r: any) => r.role_name) || [];
      let redirectPath = "/client/dashboard"; // default
      if (roleNames.includes("finance")) {
        redirectPath = "/finance/dashboard";
      } else if (roleNames.includes("project_manager")) {
        redirectPath = "/pm/dashboard";
      } else if (roleNames.includes("manager")) {
        redirectPath = "/manager";
      } else if (roleNames.includes("admin")) {
        redirectPath = "/admin";
      } else if (roleNames.includes("client")) {
        redirectPath = "/client/dashboard";
      }
      navigate(redirectPath, { replace: true });

    } catch (error: any) {
      console.error("Login error:", error);

      let message = "An unexpected error occurred.";

      if (!navigator.onLine) {
        message = "No internet connection. Please check your network.";
      } else {
        message = error.message || "Login failed. Please try again later.";
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
        src="https://res.cloudinary.com/dema3kxng/video/upload/v1765620073/Residential-mastery_sqgdkv.mp4"
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
                <span className="text-background font-black text-2xl">RC</span>
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
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setFieldErrors({ ...fieldErrors, email: undefined });
                  }}
                  placeholder="you@company.com"
                  required
                  disabled={loading}
                  className={`glass border-border/80 focus:border-primary/50 h-12 text-base ${
                    fieldErrors.email ? "border-red-500 focus:border-red-500" : ""
                  }`}
                  autoComplete="email"
                  autoFocus
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-500 flex items-center mt-1">
                    <span className="mr-1">⚠</span> {fieldErrors.email}
                  </p>
                )}
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
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      setFieldErrors({ ...fieldErrors, password: undefined });
                    }}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    className={`glass border-border/80 focus:border-primary/50 h-12 text-base pr-10 ${
                      fieldErrors.password ? "border-red-500 focus:border-red-500" : ""
                    }`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-xs text-red-500 flex items-center mt-1">
                    <span className="mr-1">⚠</span> {fieldErrors.password}
                  </p>
                )}
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