// src/components/SubServicePopup.tsx
// Complete SubServicePopup with dynamic media support (image/video) and elegant flow
// This is the FINAL, PRODUCTION-READY version

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { 
  X, 
  Calendar, 
  ArrowRight, 
  Image as ImageIcon, 
  Video as VideoIcon,
  Sparkles 
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SubService {
  title: string;
  serviceCategory: string;
  description: string;
  mediaSrc?: string;
  mediaType?: "image" | "video";
}

interface SubServicePopupProps {
  isOpen: boolean;
  onClose: () => void;
  subService: SubService;
  stages: string[];
}

const SubServicePopup: React.FC<SubServicePopupProps> = ({
  isOpen,
  onClose,
  subService,
  stages,
}) => {
  const [selectedStage, setSelectedStage] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  if (!isOpen) return null;

  const handleProceed = () => {
    if (!selectedStage) return;
    
    setIsRedirecting(true);
    
    // Create query parameters
    const params = new URLSearchParams({
      subService: subService.title,
      category: subService.serviceCategory,
      stage: selectedStage,
    });

    // Smooth transition before redirect
    setTimeout(() => {
      window.location.href = `/contact?${params.toString()}`;
    }, 600);
  };

  const hasMedia = subService.mediaSrc && subService.mediaSrc.trim() !== "";

  const handleMediaLoad = () => {
    setMediaLoaded(true);
    setMediaError(false);
  };

  const handleMediaError = () => {
    setMediaError(true);
    setMediaLoaded(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative max-w-3xl w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <GlassCard className="p-8 rounded-2xl shadow-2xl">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2 hover:bg-primary/10 rounded-full transition-all duration-300 hover:rotate-90 z-10 group"
                aria-label="Close popup"
              >
                <X className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>

              {/* Header */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-6 pr-12"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="text-sm text-primary font-semibold uppercase tracking-wider">
                    {subService.serviceCategory}
                  </p>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient">
                  {subService.title}
                </h2>
              </motion.div>

              {/* Description */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-8"
              >
                <p className="text-muted-foreground leading-relaxed text-base">
                  {subService.description}
                </p>
              </motion.div>

              {/* Dynamic Media Section - Adaptive Sizing */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="mb-8"
              >
                {hasMedia && !mediaError ? (
                  <div className="rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5 relative group">
                    {/* Loading Skeleton */}
                    {!mediaLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full"
                        />
                      </div>
                    )}

                    {subService.mediaType === "video" ? (
                      <div className="relative w-full">
                        <video
                          src={subService.mediaSrc}
                          controls
                          className={`w-full h-auto max-h-[500px] object-cover rounded-xl transition-opacity duration-300 ${
                            mediaLoaded ? "opacity-100" : "opacity-0"
                          }`}
                          onLoadedData={handleMediaLoad}
                          onError={handleMediaError}
                          poster="" // Optional: add a poster image URL
                        >
                          Your browser does not support the video tag.
                        </video>
                        
                        {/* Video Badge */}
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 }}
                          className="absolute top-4 right-4 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 shadow-lg"
                        >
                          <VideoIcon className="w-4 h-4 text-white" />
                          <span className="text-xs text-white font-semibold">Video Showcase</span>
                        </motion.div>
                      </div>
                    ) : (
                      <div className="relative w-full">
                        <img
                          src={subService.mediaSrc}
                          alt={subService.title}
                          className={`w-full h-auto max-h-[500px] object-cover rounded-xl transition-opacity duration-300 ${
                            mediaLoaded ? "opacity-100" : "opacity-0"
                          }`}
                          onLoad={handleMediaLoad}
                          onError={handleMediaError}
                        />
                        
                        {/* Image Badge */}
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 }}
                          className="absolute top-4 right-4 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 shadow-lg"
                        >
                          <ImageIcon className="w-4 h-4 text-white" />
                          <span className="text-xs text-white font-semibold">Project Gallery</span>
                        </motion.div>

                        {/* Hover Overlay Effect */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                      </div>
                    )}
                  </div>
                ) : !hasMedia ? (
                  // Placeholder for when no media is provided - Adaptive sizing
                  <div className="p-12 md:p-16 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl text-center border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="space-y-4"
                    >
                      <div className="flex justify-center gap-4">
                        <motion.div
                          animate={{ y: [0, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <ImageIcon className="w-12 h-12 text-primary/40" />
                        </motion.div>
                        <motion.div
                          animate={{ y: [0, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                        >
                          <VideoIcon className="w-12 h-12 text-accent/40" />
                        </motion.div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">
                          Visual showcase coming soon
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-2">
                          Media gallery will be displayed here
                        </p>
                      </div>
                    </motion.div>
                  </div>
                ) : (
                  // Error state - Adaptive sizing
                  <div className="p-12 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-xl text-center border-2 border-dashed border-red-500/20">
                    <div className="space-y-3">
                      <div className="text-4xl">⚠️</div>
                      <p className="text-sm text-muted-foreground">
                        Unable to load media content
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        Please check the media URL or try again later
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Stage Selection */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-4 mb-8"
              >
                {/* <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold block">
                      Select Your Current Project Stage
                    </label>
                    <p className="text-xs text-muted-foreground/70">
                      This helps us provide tailored assistance
                    </p>
                  </div>
                </div> */}
                
                <Select value={selectedStage} onValueChange={setSelectedStage}>
                  <SelectTrigger className="glass border-border h-14 text-base hover:border-primary/50 transition-all duration-300 focus:ring-2 focus:ring-primary/20">
                    <SelectValue placeholder="Choose current phase of project" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage, index) => (
                      <SelectItem 
                        key={stage} 
                        value={stage}
                        className="cursor-pointer hover:bg-primary/5 transition-colors py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-6 h-6 text-xs font-bold text-primary/80 bg-primary/10 rounded-full">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="font-medium">{stage}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Helper text with animation */}
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ 
                    opacity: selectedStage ? 1 : 0.5, 
                    height: "auto" 
                  }}
                  className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10"
                >
                  <span className="text-primary text-lg mt-0.5">ℹ️</span>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                    {selectedStage 
                      ? `Perfect! We'll prepare relevant information for the ${selectedStage} stage.`
                      : "Select your current stage to help us understand your project timeline and needs."
                    }
                  </p>
                </motion.div>
              </motion.div>

              {/* Proceed Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-3"
              >
                <Button
                  onClick={handleProceed}
                  disabled={!selectedStage || isRedirecting}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold py-6 text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 group relative overflow-hidden shadow-lg hover:shadow-xl disabled:shadow-none"
                >
                  {isRedirecting ? (
                    <span className="flex items-center justify-center gap-3">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                      <span>Redirecting to Contact Form...</span>
                    </span>
                  ) : (
                    <>
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        Proceed to Contact Form
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </span>
                      {/* Shimmer effect on hover */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        initial={{ x: "-100%" }}
                        whileHover={{ x: "100%" }}
                        transition={{ duration: 0.6 }}
                      />
                    </>
                  )}
                </Button>

                {/* Conditional feedback message */}
                <AnimatePresence>
                  {!selectedStage && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-xs text-center text-muted-foreground/70 flex items-center justify-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Please select a project stage to continue
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Optional: Progress indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-6 pt-6 border-t border-border/50"
              >
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
                  <span>Step 1 of 2:</span>
                  <span className="font-medium text-primary">Service Selection</span>
                  <span>→</span>
                  <span className="font-medium">Contact Form</span>
                </div>
              </motion.div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SubServicePopup;