
import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/ui/GlassCard";
import { useToast } from "@/hooks/use-toast";
import signUpVideo from "@/assets/sign-upp.mp4";
import { signUp } from "@/lib/auth";

const Register = () => {

  const { toast } = useToast();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    
    if (!video || !overlay) return;
    
    const handleTimeUpdate = () => {
      const timeRemaining = video.duration - video.currentTime;
      
      // Trigger fade transition 0.3 seconds before video ends
      if (timeRemaining <= 0.3 && timeRemaining > 0) {
        fadeTransition(overlay);
      }
    };
    
    const fadeTransition = (overlay: HTMLDivElement) => {
      overlay.style.background = 'black';
      overlay.style.transition = 'opacity 0.2s ease-in-out';
      overlay.style.opacity = '1';
      
      setTimeout(() => {
        overlay.style.opacity = '0';
      }, 200);
    };
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords don't match",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      await signUp({
        email: formData.email,
        password: formData.password,
        fullName: formData.name,
      });
      toast({
        title: "Account Created",
        description: "Check your email to confirm your account.",
      });
      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Signup Error",
        description: error.message || "Failed to create account.",
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
        ref={videoRef}
        src={signUpVideo}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
      />
      
      {/* Transition Overlay */}
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0,
          transition: 'opacity 0s',
          zIndex: 5
        }}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/85 to-background/80 z-10" />
      
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-5 z-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23ffffff\" fill-opacity=\"1\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }} />
      </div>
      
      {/* Content */}
      <div className="container mx-auto px-6 z-20 relative flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center space-x-2 mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
                <span className="text-background font-bold text-xl">DC</span>
              </div>
            </Link>
            <h1 className="text-4xl font-bold mb-2">Create Account</h1>
            <p className="text-muted-foreground">Join Dream Construct today</p>
          </div>
          <GlassCard className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Full Name
                </label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                  className="glass border-border"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@example.com"
                  required
                  className="glass border-border"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium flex items-center">
                  <Lock className="w-4 h-4 mr-2" />
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="glass border-border"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium flex items-center">
                  <Lock className="w-4 h-4 mr-2" />
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  placeholder="••••••••"
                  required
                  className="glass border-border"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-background font-semibold py-6"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Account"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link to="/login" className="text-primary hover:text-primary/80 font-medium">
                Sign in
              </Link>
            </div>
          </GlassCard>
          <p className="text-center text-sm text-muted-foreground mt-8">
            By creating an account, you agree to our Terms of Service and Privacy Policy
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Register;