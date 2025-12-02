// components/Navbar.tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser, getDashboardRoute, signOut, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Handle scroll effect for glass background
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // FIXED: Properly detect auth state on mount + all events
  useEffect(() => {
    let mounted = true;
    let isAuthenticating = false; // Prevent concurrent auth calls

    // Initial load: check for existing session immediately
    const initAuth = async () => {
      console.log("[Navbar] Starting auth initialization...");
      isAuthenticating = true;
      
      try {
        // First check if there's a session at all
        const { data: { session } } = await supabase.auth.getSession();
        console.log("[Navbar] Session check:", !!session);
        
        if (!mounted) return;

        if (session?.user) {
          // User is logged in, fetch full profile
          console.log("[Navbar] Fetching user profile...");
          const user = await getCurrentUser();
          console.log("[Navbar] User fetched:", !!user);
          if (mounted) {
            setCurrentUser(user);
          }
        } else {
          // No session, user is logged out
          console.log("[Navbar] No session found");
          if (mounted) {
            setCurrentUser(null);
          }
        }
      } catch (error) {
        console.error("[Navbar] Auth init error:", error);
        if (mounted) {
          setCurrentUser(null);
        }
      } finally {
        if (mounted) {
          console.log("[Navbar] Setting isLoading to false");
          setIsLoading(false);
          isAuthenticating = false;
        }
      }
    };

    // Start initialization
    initAuth();

    // Listen to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Navbar] Auth event:", event, "Has session:", !!session);

      if (!mounted) return;

      // Ignore INITIAL_SESSION - we handle it in initAuth
      if (event === "INITIAL_SESSION") {
        console.log("[Navbar] Ignoring INITIAL_SESSION - already handled");
        return;
      }

      // Prevent concurrent authentication calls
      if (isAuthenticating) {
        console.log("[Navbar] Already authenticating, skipping this event");
        return;
      }

      // Handle sign in / token refresh
      if (session?.user && (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      )) {
        isAuthenticating = true;
        try {
          console.log("[Navbar] Fetching user on auth event:", event);
          const user = await getCurrentUser();
          console.log("[Navbar] User fetched on auth event:", !!user);
          
          if (mounted && user) {
            setCurrentUser(user);
            setIsLoading(false);
          }
        } catch (error) {
          console.error("[Navbar] Error fetching user on auth change:", error);
          if (mounted) {
            setCurrentUser(null);
            setIsLoading(false);
          }
        } finally {
          isAuthenticating = false;
        }
      } 
      // Handle sign out
      else if (event === "SIGNED_OUT") {
        console.log("[Navbar] Signing out");
        if (mounted) {
          setCurrentUser(null);
          setIsLoading(false);
        }
      }
    });

    // Cleanup
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setCurrentUser(null);
      setIsMobileMenuOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleDashboardClick = () => {
    if (currentUser) {
      const dashboardRoute = getDashboardRoute(currentUser.roles);
      navigate(dashboardRoute);
      setIsMobileMenuOpen(false);
    }
  };

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Services", path: "/services" },
    { name: "Projects", path: "/projects" },
    { name: "Team", path: "/team" },
    { name: "Contact", path: "/contact" },
    { name: "Reviews", path: "/reviews" },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled ? "glass py-4 shadow-lg" : "bg-transparent py-6"
      } backdrop-blur-lg`}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300 shadow-md">
              <span className="text-background font-bold text-xl">DC</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight text-foreground">
                Dream Construct Limited
              </span>
              <span className="text-xs text-muted-foreground">Building Your Dreams</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-medium transition-all duration-200 hover:text-primary ${
                  location.pathname === link.path
                    ? "text-primary font-semibold"
                    : "text-foreground/80"
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Desktop CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {isLoading ? (
              <div className="flex items-center space-x-4">
                <div className="w-20 h-10 animate-pulse bg-muted/50 rounded-lg" />
                <div className="w-28 h-10 animate-pulse bg-muted/50 rounded-lg" />
              </div>
            ) : currentUser ? (
              <>
                <Button
                  onClick={handleDashboardClick}
                  className="bg-primary hover:bg-primary/90 text-background font-medium shadow-md"
                >
                  Dashboard
                </Button>
                <Button onClick={handleSignOut} variant="ghost" className="text-sm">
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button className="bg-primary hover:bg-primary/90 text-background font-medium shadow-md">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-foreground p-2 rounded-lg hover:bg-muted/50 transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="md:hidden mt-6 pb-6 border-t border-border/50 pt-6 space-y-5"
            >
              {/* Mobile Nav Links */}
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block py-3 text-lg font-medium transition-colors hover:text-primary ${
                    location.pathname === link.path ? "text-primary" : "text-foreground"
                  }`}
                >
                  {link.name}
                </Link>
              ))}

              {/* Mobile Auth Buttons */}
              <div className="pt-6 space-y-3 border-t border-border/50">
                {isLoading ? (
                  <div className="space-y-3">
                    <div className="h-12 bg-muted rounded-lg animate-pulse" />
                    <div className="h-12 bg-muted rounded-lg animate-pulse" />
                  </div>
                ) : currentUser ? (
                  <>
                    <Button
                      onClick={handleDashboardClick}
                      className="w-full bg-primary hover:bg-primary/90 text-background font-medium text-base py-6"
                    >
                      Go to Dashboard
                    </Button>
                    <Button
                      onClick={handleSignOut}
                      variant="outline"
                      className="w-full text-base py-6"
                    >
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full text-base py-6">
                        Sign In
                      </Button>
                    </Link>
                    <Link to="/register" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button className="w-full bg-primary hover:bg-primary/90 text-background font-medium text-base py-6">
                        Get Started
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
};

export default Navbar;