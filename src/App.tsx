import { useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { Slider } from "@/components/ui/slider";

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
import ReviewsManagement from "./pages/admin/ReviewsManagement";
import Reviews from "./pages/Reviews";

// Admin Pages
import Dashboard from "./pages/admin/Dashboard";
import AdminUserCreate from "./pages/admin/UserCreate";

// 404
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.2); // Default to 20% (soft ambient volume)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Set initial volume
    audio.volume = volume;

    // Attempt to play audio on mount
    const playAudio = async () => {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        console.log("Autoplay prevented. User interaction needed.");
      }
    };

    playAudio();

    // Handle user interaction for autoplay policy
    const handleUserInteraction = async () => {
      if (!isPlaying && audio.paused) {
        try {
          await audio.play();
          setIsPlaying(true);
        } catch (error) {
          console.error("Failed to play audio:", error);
        }
      }
    };

    // Add listeners for first user interaction
    document.addEventListener("click", handleUserInteraction, { once: true });
    document.addEventListener("touchstart", handleUserInteraction, { once: true });
    document.addEventListener("keydown", handleUserInteraction, { once: true });

    return () => {
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("touchstart", handleUserInteraction);
      document.removeEventListener("keydown", handleUserInteraction);
    };
  }, [isPlaying, volume]);

  // Update audio volume when volume state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    const volumeValue = newVolume[0];
    setVolume(volumeValue);
    
    // Auto-unmute if user increases volume while muted
    if (isMuted && volumeValue > 0) {
      setIsMuted(false);
      if (audioRef.current) {
        audioRef.current.muted = false;
      }
    }
  };

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="w-5 h-5" />;
    if (volume < 0.5) return <Volume1 className="w-5 h-5" />;
    return <Volume2 className="w-5 h-5" />;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        {/* Global Background Music */}
        <audio
          ref={audioRef}
          loop
          preload="auto"
          style={{ display: "none" }}
        >
          <source src="/Ravz.mp3" type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>

        {/* Floating Music Control */}
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
          {/* Volume Slider - Shows on hover or when toggled */}
          <div
            className={`
              transition-all duration-300 ease-in-out
              ${showVolumeSlider ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}
            `}
          >
            <div className="bg-black/90 backdrop-blur-sm rounded-full px-4 py-3 shadow-lg flex items-center gap-3 min-w-[180px]">
              <span className="text-white text-xs font-medium whitespace-nowrap">
                {Math.round(volume * 100)}%
              </span>
              <Slider
                value={[volume]}
                onValueChange={handleVolumeChange}
                max={1}
                step={0.01}
                className="w-24 cursor-pointer"
              />
            </div>
          </div>

          {/* Volume Control Button */}
          <button
            onClick={toggleMute}
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
            onTouchStart={() => setShowVolumeSlider(!showVolumeSlider)}
            className="bg-black/80 hover:bg-black text-white p-4 rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-110"
            aria-label={isMuted ? "Unmute background music" : "Mute background music"}
          >
            {getVolumeIcon()}
          </button>
        </div>

        <BrowserRouter>
          <Routes>
            {/* === Public Routes (Main Layout) === */}
            <Route path="/" element={<MainLayout><Index /></MainLayout>} />
            <Route path="/services" element={<MainLayout><Services /></MainLayout>} />
            <Route path="/projects" element={<MainLayout><Projects /></MainLayout>} />
            <Route path="/team" element={<MainLayout><Team /></MainLayout>} />
            <Route path="/contact" element={<MainLayout><Contact /></MainLayout>} />
            <Route path="/reviews" element={<MainLayout><Reviews /></MainLayout>} />

            {/* === Auth Routes (No Layout) === */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* === Admin Routes (Admin Layout) === */}
            <Route path="/admin" element={<AdminLayout><Dashboard /></AdminLayout>} />
            <Route path="/admin/users" element={
              <AdminLayout>
                <div className="p-8">
                  <h1 className="text-4xl font-bold">Users Management</h1>
                  <p className="text-muted-foreground mt-2">Manage users, roles, and permissions</p>
                </div>
              </AdminLayout>
            } />
            <Route path="/admin/users/create" element={<AdminLayout><AdminUserCreate /></AdminLayout>} />
            <Route path="/admin/projects" element={
              <AdminLayout>
                <div className="p-8">
                  <h1 className="text-4xl font-bold">Projects Management</h1>
                  <p className="text-muted-foreground mt-2">Oversee all construction projects</p>
                </div>
              </AdminLayout>
            } />
            <Route path="/admin/content" element={
              <AdminLayout>
                <div className="p-8">
                  <h1 className="text-4xl font-bold">Content Management</h1>
                  <p className="text-muted-foreground mt-2">Update website content and media</p>
                </div>
              </AdminLayout>
            } />
            <Route path="/admin/settings" element={
              <AdminLayout>
                <div className="p-8">
                  <h1 className="text-4xl font-bold">Settings</h1>
                  <p className="text-muted-foreground mt-2">Configure system settings</p>
                </div>
              </AdminLayout>
            } />
            <Route path="/admin/reviews" element={<AdminLayout><ReviewsManagement /></AdminLayout>} />

            {/* === 404 Catch-All === */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;