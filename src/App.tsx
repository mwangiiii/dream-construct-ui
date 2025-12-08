import MediaGalleryPage from "./pages/MediaGalleryPage";
// src/App.tsx
import { useEffect, useState, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { Volume2, VolumeX, Volume1, UserPlus, Plus, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/auth";

import MainLayout from "./components/layout/MainLayout";
import AdminLayout from "./components/layout/AdminLayout";
import ClientLayout from "./components/layout/ClientLayout";
import AdminSettingsPage from "./pages/admin/settings";
import ClientSettingsPage from "./pages/client/settings";
import MediaManagement from "./pages/admin/mediaManagement";


import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

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
import UserManagement from "./pages/admin/UserManagement";
import ReviewsManagement from "./pages/admin/ReviewsManagement";

// Project Management Pages
import ProjectManagementDashboard from "./components/dashboard/ProjectManagementDashboard";
import ProjectDetailPage from "./pages/projects/ProjectDetailPage";
import ClientDashboard from "./pages/client/Dashboard";
import ClientProjects from "./pages/client/projects";
import ClientNotifications from "./pages/client/clientNotifications";

// Media Management
import MediaCreate from "./pages/admin/multimedia/mediaCreate";

// 404
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Content Management Layout Component with Tabs
const ContentManagement = () => {
  const location = useLocation();
  
  const tabs = [
    { name: "Overview", path: "/admin/content" },
    { name: "Reviews", path: "/admin/content/reviews" },
    { name: "Media", path: "/admin/content/media" },
    { name: "Pages", path: "/admin/content/pages" },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-4xl font-bold">Content Management</h1>
        <p className="text-muted-foreground mt-2">Update website content and media</p>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-border mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Content Area - renders child routes */}
      <Outlet />
    </div>
  );
};

// Content Overview Component
const ContentOverview = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Link to="/admin/content/reviews">
        <div className="p-6 border rounded-lg hover:border-primary transition-colors cursor-pointer">
          <h3 className="text-xl font-semibold mb-2">Reviews Management</h3>
          <p className="text-muted-foreground">Manage customer reviews and testimonials</p>
        </div>
      </Link>

      <Link to="/admin/content/media" className="block">
        <div className="p-6 border rounded-xl hover:border-primary/50 hover:bg-accent/5 transition-all duration-300 cursor-pointer group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
              Media Library
            </h3>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <ImageIcon className="w-6 h-6 text-primary" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            Upload and organize images, videos, and more • Manage drafts, published & archived content
          </p>
          <div className="mt-4 flex items-center text-primary text-sm font-medium">
            Open Library
            <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>

      <Link to="/admin/content/pages">
        <div className="p-6 border rounded-lg hover:border-primary transition-colors cursor-pointer">
          <h3 className="text-xl font-semibold mb-2">Pages Content</h3>
          <p className="text-muted-foreground">Edit homepage, services, and other pages</p>
        </div>
      </Link>
    </div>
  </div>
);

// Media Library Tabs: Library & Create Media
import { useNavigate } from "react-router-dom";

// Media Library Tabs: Library & Create Media
const MediaLibraryTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const tabs = [
    { name: "Library", path: "/admin/content/media" },
    { name: "Create Media", path: "/admin/content/media/create" },
  ];
  
  const isCreatePage = location.pathname === "/admin/content/media/create";
  
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold">Media Library</h2>
        <p className="text-muted-foreground mt-2">Manage and upload advertisements, images, and videos</p>
      </div>
      
      <div className="border-b border-border mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>
      
      {/* Fixed: comment moved above the JSX */}
      {isCreatePage ? (
        <MediaCreate />
      ) : (
        <MediaManagement />
      )}
    </div>
  );
};

const MediaLibrary = MediaLibraryTabs;

const PagesContent = () => (
  <div className="text-center py-12">
    <h2 className="text-2xl font-semibold mb-4">Pages Content</h2>
    <p className="text-muted-foreground">Page content editor coming soon...</p>
  </div>
);

// ... (ProtectedRoute and rest of your code unchanged)

const ProtectedRoute: React.FC<{ 
  children: React.ReactNode;
  requiredRoles?: string[];
}> = ({ children, requiredRoles }) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    checkAuthorization();
  }, []);

  const checkAuthorization = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      if (!requiredRoles || requiredRoles.length === 0) {
        setIsAuthorized(true);
        setLoading(false);
        return;
      }

      const user = await getCurrentUser();
      
      if (!user) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      const hasRequiredRole = user.roles.some(role => 
        requiredRoles.includes(role.role_name)
      );

      setIsAuthorized(hasRequiredRole);
      setLoading(false);
    } catch (error) {
      console.error("Authorization check failed:", error);
      setIsAuthorized(false);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (isAuthorized === false) {
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
            {/* === PUBLIC ROUTES === */}
            <Route path="/" element={<MainLayout><Index /></MainLayout>} />
            <Route path="/services" element={<MainLayout><Services /></MainLayout>} />
            <Route path="/projects" element={<MainLayout><Projects /></MainLayout>} />
            <Route path="/team" element={<MainLayout><Team /></MainLayout>} />
            <Route path="/contact" element={<MainLayout><Contact /></MainLayout>} />
            <Route path="/reviews" element={<MainLayout><Reviews /></MainLayout>} />
            <Route path="/media" element={<MainLayout><MediaGalleryPage /></MainLayout>} />

            {/* === PASSWORD RESET ROUTE === */}
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* === AUTH ROUTES === */}
            <Route path="/login" element={<Login />} />
            {/* <Route path="/register" element={<Register />} /> */}

            {/* === ADMIN ROUTES === */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminLayout><Dashboard /></AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* USER MANAGEMENT — Full List + Edit + Delete */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminLayout>
                    <div className="p-8">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          {/* <h1 className="text-4xl font-bold">Users Management</h1> */}
                          {/* <p className="text-muted-foreground mt-2">Manage users, roles, and permissions</p> */}
                        </div>
                        <Link to="/admin/users/create">
                          <Button className="bg-primary hover:bg-primary/90">
                            <UserPlus className="w-4 h-4 mr-2" />
                            Create New User
                          </Button>
                        </Link>
                      </div>
                      <UserManagement />
                    </div>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* USER CREATION — Dedicated create form */}
            <Route
              path="/admin/users/create"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminLayout><AdminUserCreate /></AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* === PROJECT MANAGEMENT ROUTES === */}
            
            <Route
              path="/admin/projects"
              element={
                <ProtectedRoute requiredRoles={["admin", "manager", "project_manager"]}>
                  <AdminLayout>
                    <ProjectManagementDashboard />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/projects/:id"
              element={
                <ProtectedRoute requiredRoles={["admin", "manager", "project_manager"]}>
                  <AdminLayout>
                    <ProjectDetailPage />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* === CLIENT ROUTES === */}
            
            <Route
              path="/client/dashboard"
              element={
                <ProtectedRoute requiredRoles={["client"]}>
                  <ClientLayout>
                    <ClientDashboard />
                  </ClientLayout>
                </ProtectedRoute>
              }
            />

            <Route 
              path="/client/projects"
              element={
                <ProtectedRoute requiredRoles={["client"]}>
                  <ClientLayout>
                    <ClientProjects />
                  </ClientLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/client/projects/:id"
              element={
                <ProtectedRoute requiredRoles={["client"]}>
                  <ClientLayout>
                    <ProjectDetailPage />
                  </ClientLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/client/notifications"
              element={
                <ProtectedRoute requiredRoles={["client"]}>
                  <ClientLayout>
                    <ClientNotifications />
                  </ClientLayout>
                </ProtectedRoute>
              }
            />

            {/* === CONTENT MANAGEMENT — Nested Routes with Tabs === */}
            <Route
              path="/admin/content"
              element={
                <ProtectedRoute requiredRoles={["admin", "manager"]}>
                  <AdminLayout>
                    <ContentManagement />
                  </AdminLayout>
                </ProtectedRoute>
              }
            >
              <Route index element={<ContentOverview />} />
              <Route path="reviews" element={<ReviewsManagement />} />
              <Route path="pages" element={<PagesContent />} />
            </Route>

            {/* MEDIA LIBRARY ROUTES - Separate from nested content routes */}
            <Route
              path="/admin/content/media"
              element={
                <ProtectedRoute requiredRoles={["admin", "manager"]}>
                  <AdminLayout>
                    <div className="p-8">
                      <MediaLibrary />
                    </div>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/content/media/create"
              element={
                <ProtectedRoute requiredRoles={["admin", "manager"]}>
                  <AdminLayout>
                    <div className="p-8">
                      <MediaLibrary />
                    </div>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* ADMIN SETTINGS */}
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <AdminSettingsPage />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* CLIENT SETTINGS */}
            <Route
              path="/client/settings"
              element={
                <ProtectedRoute>
                  <ClientLayout>
                    <ClientSettingsPage />
                  </ClientLayout>
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