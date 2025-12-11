// src/components/projects/tabs/PhotosTab.tsx
import { useState } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Upload,
  X,
  Trash2,
  Download,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
} from "lucide-react";
import { projectApi, uploadFileToStorage, deleteFileFromStorage } from "@/lib/api/projectApi";
import { Document } from "@/types/project";

interface PhotosTabProps {
  projectId: string;
  photos: Document[];
  milestones?: any[];
  canEdit: boolean;
  onUpdate: () => void;
}

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

export default function PhotosTab({ projectId, photos, milestones = [], canEdit, onUpdate }: PhotosTabProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Upload form state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectedMilestone, setSelectedMilestone] = useState("");

  // Edge Function #11: Bulk Upload Photos
  const handleBulkUpload = async () => {
    if (selectedFiles.length === 0 || !canEdit) return;
    setLoading(true);
    setUploadProgress(0);

    try {
      const totalFiles = selectedFiles.length;
      const uploadedPhotos: any[] = [];

      // Upload files one by one with progress
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Upload to storage
        const { path, error: uploadError } = await uploadFileToStorage(
          file,
          "documents",
          "progress_photos"
        );
        
        if (uploadError) throw uploadError;

        uploadedPhotos.push({
          name: file.name,
          file_path: path,
          file_size: file.size,
        });

        // Update progress
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      // Create document records in bulk
      await projectApi.bulkUploadPhotos({
        project_id: projectId,
        milestone_id: selectedMilestone || undefined,
        photos: uploadedPhotos,
      });

      alert(`Successfully uploaded ${uploadedPhotos.length} photo(s)!`);
      setShowUploadModal(false);
      setSelectedFiles([]);
      setPreviewUrls([]);
      setSelectedMilestone("");
      setUploadProgress(0);
      onUpdate();
    } catch (error: any) {
      console.error("Error uploading photos:", error);
      alert(error.message || "Failed to upload photos");
    } finally {
      setLoading(false);
    }
  };

  // Edge Function #12: Delete Document/Photo
  const handleDeletePhoto = async (photo: Document) => {
    if (!canEdit) return;
    if (!confirm(`Delete "${photo.name}"?`)) return;

    setLoading(true);
    try {
      await projectApi.deleteDocument(photo.id);
      alert("Photo deleted successfully!");
      onUpdate();
    } catch (error: any) {
      console.error("Error deleting photo:", error);
      alert(error.message || "Failed to delete photo");
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Filter for images only
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    
    if (imageFiles.length !== files.length) {
      alert("Only image files are allowed");
    }

    // Limit to 50 photos per upload
    if (selectedFiles.length + imageFiles.length > 50) {
      alert("Maximum 50 photos per upload");
      return;
    }

    setSelectedFiles([...selectedFiles, ...imageFiles]);

    // Create preview URLs
    const newPreviewUrls = imageFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls([...previewUrls, ...newPreviewUrls]);
  };

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    const newPreviews = [...previewUrls];
    
    URL.revokeObjectURL(newPreviews[index]);
    
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);
    
    setSelectedFiles(newFiles);
    setPreviewUrls(newPreviews);
  };

  // Lightbox navigation
  const openLightbox = (index: number) => {
    setCurrentPhotoIndex(index);
    setShowLightbox(true);
  };

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const downloadPhoto = (photo: Document) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${photo.file_path}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Site Progress Photos</h3>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            {photos.length} photo{photos.length !== 1 ? "s" : ""} uploaded
          </p>
        </div>
        {canEdit && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl text-sm sm:text-base w-full sm:w-auto justify-center"
          >
            <Upload className="w-4 h-4 sm:w-5 sm:h-5" /> Upload Photos
          </motion.button>
        )}
      </div>

      {/* Empty State */}
      {photos.length === 0 ? (
        <GlassCard className="text-center py-16 sm:py-20">
          <Camera className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 text-primary/30" />
          <p className="text-base sm:text-xl text-muted-foreground mb-4 sm:mb-6">No photos uploaded yet</p>
          {canEdit && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="text-primary hover:text-primary/80 font-semibold text-base sm:text-lg"
            >
              Upload your first photos
            </button>
          )}
        </GlassCard>
      ) : (
        /* Photo Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {photos.map((photo, idx) => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.03 }}
              className="group relative backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl overflow-hidden hover:border-primary/50 transition-all cursor-pointer"
              onClick={() => openLightbox(idx)}
            >
              {/* Image */}
              <img
                src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${photo.file_path}`}
                alt={photo.name}
                className="w-full h-32 sm:h-40 md:h-48 object-cover"
                loading="lazy"
              />

              {/* Overlay on Hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-end p-3">
                <div className="text-white mb-2">
                  <p className="font-semibold text-xs sm:text-sm truncate">{photo.name}</p>
                  <p className="text-[10px] sm:text-xs text-white/80">
                    {format(new Date(photo.uploaded_at), "dd MMM yyyy")}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openLightbox(idx);
                    }}
                    className="flex-1 p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-all"
                  >
                    <ZoomIn className="w-4 h-4 mx-auto" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadPhoto(photo);
                    }}
                    className="flex-1 p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-all"
                  >
                    <Download className="w-4 h-4 mx-auto" />
                  </motion.button>
                  {canEdit && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(photo);
                      }}
                      className="flex-1 p-2 bg-red-500/40 hover:bg-red-500/60 rounded-lg backdrop-blur-sm transition-all"
                    >
                      <Trash2 className="w-4 h-4 mx-auto" />
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-4xl backdrop-blur-xl bg-background/95 border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Upload Site Photos</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  disabled={loading}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Milestone Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Link to Milestone (Optional)</label>
                  <select
                    value={selectedMilestone}
                    onChange={(e) => setSelectedMilestone(e.target.value)}
                    disabled={loading}
                    className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="" className="bg-background">No Milestone</option>
                    {milestones.map((milestone) => (
                      <option key={milestone.id} value={milestone.id} className="bg-background">
                        {milestone.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* File Selection Area */}
                {previewUrls.length === 0 ? (
                  <label className="flex flex-col items-center justify-center gap-4 px-6 py-12 backdrop-blur-xl bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/20 hover:border-primary/50 rounded-xl cursor-pointer transition-all">
                    <Camera className="w-16 h-16 text-primary/50" />
                    <div className="text-center">
                      <p className="text-lg font-semibold mb-1">Click to select photos</p>
                      <p className="text-sm text-muted-foreground">or drag and drop (max 50 photos)</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      disabled={loading}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <>
                    {/* Preview Grid */}
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {previewUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-20 object-cover rounded-lg border border-white/20"
                          />
                          <button
                            onClick={() => removeFile(index)}
                            disabled={loading}
                            className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add More Button */}
                    {selectedFiles.length < 50 && !loading && (
                      <label className="flex items-center justify-center gap-2 px-4 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl cursor-pointer transition-all">
                        <Camera className="w-5 h-5" />
                        <span>Add More Photos</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>
                    )}
                  </>
                )}

                {/* Upload Progress */}
                {loading && uploadProgress > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Uploading...</span>
                      <span className="font-semibold text-primary">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden backdrop-blur-xl border border-white/20">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        className="bg-gradient-to-r from-primary to-accent h-full rounded-full"
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleBulkUpload}
                    disabled={loading || selectedFiles.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-xl transition-all"
                  >
                    {loading ? (
                      <>
                        <Upload className="w-4 h-4 animate-pulse" />
                        Uploading {uploadProgress}%...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload {selectedFiles.length} Photo{selectedFiles.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowUploadModal(false)}
                    disabled={loading}
                    className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
                  >
                    Cancel
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {showLightbox && photos.length > 0 && (
          <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="text-white">
                  <p className="font-semibold">{photos[currentPhotoIndex].name}</p>
                  <p className="text-sm text-white/60">
                    {format(new Date(photos[currentPhotoIndex].uploaded_at), "dd MMM yyyy")} •{" "}
                    {photos[currentPhotoIndex].uploaded_by_user?.full_name || "Unknown"}
                  </p>
                </div>
                <button
                  onClick={() => setShowLightbox(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Image */}
              <div className="flex-1 flex items-center justify-center relative">
                <img
                  src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${photos[currentPhotoIndex].file_path}`}
                  alt={photos[currentPhotoIndex].name}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />

                {/* Navigation Buttons */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={prevPhoto}
                      className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full transition-all"
                    >
                      <ChevronLeft className="w-6 h-6 text-white" />
                    </button>
                    <button
                      onClick={nextPhoto}
                      className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full transition-all"
                    >
                      <ChevronRight className="w-6 h-6 text-white" />
                    </button>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-center gap-4 mt-4 text-white/60 text-sm">
                <span>
                  {currentPhotoIndex + 1} of {photos.length}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
