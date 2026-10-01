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

  // Scroll to top whenever location changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  // Single source of truth: onAuthStateChange handles INITIAL_SESSION + all subsequent events
  useEffect(() => {
    let mounted = true;
    let resolving = false;

    const resolveUser = async (session: { user: { id: string } } | null) => {
      if (resolving) return;
      resolving = true;
      try {
        if (session?.user) {
          const user = await getCurrentUser();
          if (mounted) setCurrentUser(user);
        } else {
          if (mounted) setCurrentUser(null);
        }
      } catch {
        if (mounted) setCurrentUser(null);
      } finally {
        if (mounted) setIsLoading(false);
        resolving = false;
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        resolveUser(session);
      } else if (event === "SIGNED_OUT") {
        if (mounted) {
          setCurrentUser(null);
          setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleStartProject = () => {
    // Navigate to contact page with hash to trigger scroll to form
    window.location.href = '/contact#contact-form';
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setCurrentUser(null);
      setIsMobileMenuOpen(false);
      navigate("/");
    } catch {
      /* sign-out best-effort */
    }
  };

  const handleDashboardClick = () => {
    if (currentUser) {
      const dashboardRoute = getDashboardRoute(currentUser.roles);
      navigate(dashboardRoute);
      setIsMobileMenuOpen(false);
    }
  };

  // Handle navigation link clicks - scroll to top
  const handleNavLinkClick = () => {
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Services", path: "/services" },
    { name: "Projects", path: "/projects" },
    { name: "Team", path: "/team" },
    { name: "Contact", path: "/contact" },
    { name: "Reviews", path: "/reviews" },
    {name: "Media", path: "/media" },
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
      <div className="container mx-auto px-2 sm:px-4 md:px-6">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo */}
          <Link 
            to="/" 
            className="flex items-center gap-2 sm:gap-3 group"
            onClick={handleNavLinkClick}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300 shadow-md">
              <span className="text-background font-bold text-base sm:text-xl">RC</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg leading-tight text-foreground">
                Reve Construct Limited
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Building Your Dreams</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-4 lg:gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={handleNavLinkClick}
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
          <div className="hidden md:flex items-center gap-2 sm:gap-4">
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
                <Link to="/login" onClick={handleNavLinkClick}>
                  <Button variant="ghost" className="text-sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/contact" onClick={handleStartProject}>
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
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
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
              className="md:hidden mt-4 sm:mt-6 pb-4 sm:pb-6 border-t border-border/50 pt-4 sm:pt-6 space-y-3 sm:space-y-5"
            >
              {/* Mobile Nav Links */}
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={handleNavLinkClick}
                  className={`block py-2 sm:py-3 text-base sm:text-lg font-medium transition-colors hover:text-primary ${
                    location.pathname === link.path ? "text-primary" : "text-foreground"
                  }`}
                >
                  {link.name}
                </Link>
              ))}

              {/* Mobile Auth Buttons */}
              <div className="pt-4 sm:pt-6 space-y-2 sm:space-y-3 border-t border-border/50">
                {isLoading ? (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="h-10 sm:h-12 bg-muted rounded-lg animate-pulse" />
                    <div className="h-10 sm:h-12 bg-muted rounded-lg animate-pulse" />
                  </div>
                ) : currentUser ? (
                  <>
                    <Button
                      onClick={handleDashboardClick}
                      className="w-full bg-primary hover:bg-primary/90 text-background font-medium text-base sm:text-lg py-4 sm:py-6"
                    >
                      Go to Dashboard
                    </Button>
                    <Button
                      onClick={handleSignOut}
                      variant="outline"
                      className="w-full text-base sm:text-lg py-4 sm:py-6"
                    >
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={handleNavLinkClick}>
                      <Button variant="outline" className="w-full text-base sm:text-lg py-4 sm:py-6">
                        Sign In
                      </Button>
                    </Link>
                    <Link to="/contact" onClick={handleStartProject}> 
                      <Button className="w-full bg-primary hover:bg-primary/90 text-background font-medium text-base sm:text-lg py-4 sm:py-6" >
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