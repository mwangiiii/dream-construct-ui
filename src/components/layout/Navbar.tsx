import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
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

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Check authentication status on mount and listen for auth changes
  useEffect(() => {
    const checkUser = async () => {
      setIsLoading(true);
      const user = await getCurrentUser();
      setCurrentUser(user);
      setIsLoading(false);
    };

    checkUser();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          const user = await getCurrentUser();
          setCurrentUser(user);
        } else if (event === "SIGNED_OUT") {
          setCurrentUser(null);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setCurrentUser(null);
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleDashboardClick = () => {
    if (currentUser) {
      const dashboardRoute = getDashboardRoute(currentUser.roles);
      navigate(dashboardRoute);
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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled ? "glass py-4" : "bg-transparent py-6"
      }`}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center transform group-hover:rotate-6 transition-transform duration-300">
              <span className="text-background font-bold text-xl">DC</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight">Dream Construct Limited</span>
              <span className="text-xs text-muted-foreground">Building Your Dreams</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location.pathname === link.path
                    ? "text-primary"
                    : "text-foreground/80"
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {!isLoading && (
              <>
                {currentUser ? (
                  // Authenticated user - show Dashboard and Sign Out
                  <>
                    <Button
                      onClick={handleDashboardClick}
                      className="bg-primary hover:bg-primary/90 text-background font-medium"
                    >
                      Dashboard
                    </Button>
                    <Button
                      onClick={handleSignOut}
                      variant="ghost"
                      className="text-sm"
                    >
                      Sign Out
                    </Button>
                  </>
                ) : (
                  // Non-authenticated user - show Sign In and Sign Up
                  <>
                    <Link to="/login">
                      <Button variant="ghost" className="text-sm">
                        Sign In
                      </Button>
                    </Link>
                    <Link to="/register">
                      <Button className="bg-primary hover:bg-primary/90 text-background font-medium">
                        Sign Up
                      </Button>
                    </Link>
                  </>
                )}
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-foreground p-2"
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
              className="md:hidden mt-6 pb-6 space-y-4"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block py-2 text-sm font-medium transition-colors hover:text-primary ${
                    location.pathname === link.path
                      ? "text-primary"
                      : "text-foreground/80"
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              
              {!isLoading && (
                <div className="pt-4 space-y-2">
                  {currentUser ? (
                    // Authenticated user - mobile
                    <>
                      <Button
                        onClick={() => {
                          handleDashboardClick();
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full bg-primary hover:bg-primary/90 text-background"
                      >
                        Dashboard
                      </Button>
                      <Button
                        onClick={() => {
                          handleSignOut();
                          setIsMobileMenuOpen(false);
                        }}
                        variant="ghost"
                        className="w-full"
                      >
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    // Non-authenticated user - mobile
                    <>
                      <Link to="/login" className="block" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full">
                          Sign In
                        </Button>
                      </Link>
                      <Link to="/register" className="block" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button className="w-full bg-primary hover:bg-primary/90 text-background">
                          Sign Up
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
};

export default Navbar;