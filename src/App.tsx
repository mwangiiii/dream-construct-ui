// src/App.tsx
import { useEffect, useState, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Volume2, VolumeX, Volume1, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

import { supabase } from "@/lib/supabaseClient";

import MainLayout from "./components/layout/MainLayout";
import AdminLayout from "./components/layout/AdminLayout";

// Public Pages
import Index from "./pages/Index";
import Services from "./pages/Services";
import Projects from "./pages/Projects";
import Team from "./pages/Team";
import Contact from "./pages/contact";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Reviews from "./pages/Reviews";

// Admin Pages
import Dashboard from "./pages/admin/Dashboard";
import AdminUserCreate from "./pages/admin/UserCreate";
import UserManagement from "./pages/admin/UserManagement";  // ← Added
import ReviewsManagement from "./pages/admin/ReviewsManagement";

// 404
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Reusable Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    const redirectTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }

  return <>{children}</>;
};

const App = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.2);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;

    const playAudio = async () => {
      try {
        await audio.play();
      } catch (err) {
        console.log("Autoplay prevented");
      }
    };

    const handleInteraction = () => {
      playAudio();
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };

    document.addEventListener("click", handleInteraction, { once: true });
    document.addEventListener("touchstart", handleInteraction, { once: true });
    document.addEventListener("keydown", handleInteraction, { once: true });

    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const toggleMute = () => setIsMuted(!isMuted);

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="w-5 h-5" />;
    if (volume < 0.5) return <Volume1 className="w-5 h-5" />;
    return <Volume2 className="w-5 h-5" />;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />

        {/* Background Music */}
        <audio ref={audioRef} loop preload="auto" style={{ display: "none" }}>
          <source src="/Ravz.mp3" type="audio/mpeg" />
        </audio>

        {/* Floating Volume Control */}
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={toggleMute}
            className="bg-black/80 hover:bg-black text-white p-4 rounded-full shadow-lg backdrop-blur-sm transition-all hover:scale-110"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {getVolumeIcon()}
          </button>
        </div>

        <BrowserRouter>
          <Routes>
            {/* === Public Routes === */}
            <Route path="/" element={<MainLayout><Index /></MainLayout>} />
            <Route path="/services" element={<MainLayout><Services /></MainLayout>} />
            <Route path="/projects" element={<MainLayout><Projects /></MainLayout>} />
            <Route path="/team" element={<MainLayout><Team /></MainLayout>} />
            <Route path="/contact" element={<MainLayout><Contact /></MainLayout>} />
            <Route path="/reviews" element={<MainLayout><Reviews /></MainLayout>} />

            {/* === Auth Routes === */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* === ADMIN ROUTES - FULLY PROTECTED === */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout><Dashboard /></AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* USER MANAGEMENT — Full List + Edit + Delete */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <div className="p-8">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h1 className="text-4xl font-bold">Users Management</h1>
                          <p className="text-muted-foreground mt-2">Manage users, roles, and permissions</p>
                        </div>
                        <Link to="/admin/users/create">
                          <Button className="bg-primary hover:bg-primary/90">
                            <UserPlus className="w-4 h-4 mr-2" />
                            Create New User
                          </Button>
                        </Link>
                      </div>
                      <UserManagement /> {/* ← Your beautiful dashboard here */}
                    </div>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* USER CREATION — Dedicated create form */}
            <Route
              path="/admin/users/create"
              element={
                <ProtectedRoute>
                  <AdminLayout><AdminUserCreate /></AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/projects"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <div className="p-8">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h1 className="text-4xl font-bold">Projects Management</h1>
                          <p className="text-muted-foreground mt-2">Oversee all construction projects</p>
                        </div>
                      </div>
                    </div>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/content"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <div className="p-8">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h1 className="text-4xl font-bold">Content Management</h1>
                          <p className="text-muted-foreground mt-2">Update website content and media</p>
                        </div>
                      </div>
                    </div>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/reviews"
              element={
                <ProtectedRoute>
                  <AdminLayout><ReviewsManagement /></AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <div className="p-8">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h1 className="text-4xl font-bold">Settings</h1>
                          <p className="text-muted-foreground mt-2">Configure system settings</p>
                        </div>
                      </div>
                    </div>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* === 404 === */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;