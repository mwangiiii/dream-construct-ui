// src/components/projects/tabs/UpdatesTab.tsx
import { useState } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Plus,
  Pin,
  X,
  Image as ImageIcon,
  Upload,
  Calendar,
  User,
  TrendingUp,
  CloudRain,
  AlertTriangle,
  Shield,
  ClipboardCheck,
  FileEdit,
  AlertCircle,
} from "lucide-react";
import { projectApi, uploadFileToStorage } from "@/lib/api/projectApi";
import { ProjectUpdate } from "@/types/project";

interface UpdatesTabProps {
  projectId: string;
  updates: ProjectUpdate[];
  canEdit: boolean;
  onUpdate: () => void;
}

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

const updateTypeConfig = {
  general: { label: "General", icon: MessageSquare, color: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
  progress: { label: "Progress", icon: TrendingUp, color: "bg-green-500/20 text-green-300 border-green-500/30" },
  delay: { label: "Delay", icon: AlertTriangle, color: "bg-red-500/20 text-red-300 border-red-500/30" },
  safety: { label: "Safety", icon: Shield, color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  weather: { label: "Weather", icon: CloudRain, color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  inspection: { label: "Inspection", icon: ClipboardCheck, color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  change_order: { label: "Change Order", icon: FileEdit, color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  issue: { label: "Issue", icon: AlertCircle, color: "bg-red-500/20 text-red-300 border-red-500/30" },
};

export default function UpdatesTab({ projectId, updates, canEdit, onUpdate }: UpdatesTabProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    title: "",
    body: "",
    update_type: "general",
  });

  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);

  // Edge Function #8: Create Daily Update
  const handleCreateUpdate = async () => {
    if (!createForm.title.trim() || !createForm.body.trim() || !canEdit) return;
    setLoading(true);

    try {
      // Step 1: Upload photos if any
      let photoIds: string[] = [];
      
      if (selectedPhotos.length > 0) {
        setUploadingPhotos(true);
        const uploadPromises = selectedPhotos.map(async (file) => {
          // Upload to storage
          const { path, error } = await uploadFileToStorage(file, "documents", "update_photos");
          if (error) throw error;

          // Create document record
          const result = await projectApi.uploadDocument({
            project_id: projectId,
            name: file.name,
            file_path: path,
            file_size: file.size,
            mime_type: file.type,
            folder: "update_photos",
          });

          return result.data?.id;
        });

        photoIds = (await Promise.all(uploadPromises)).filter(Boolean) as string[];
        setUploadingPhotos(false);
      }

      // Step 2: Create update
      await projectApi.createDailyUpdate({
        project_id: projectId,
        title: createForm.title,
        body: createForm.body,
        update_type: createForm.update_type,
        photo_ids: photoIds,
      });

      alert("Update posted successfully!");
      setShowCreateModal(false);
      setCreateForm({
        title: "",
        body: "",
        update_type: "general",
      });
      setSelectedPhotos([]);
      setPhotoPreviewUrls([]);
      onUpdate();
    } catch (error: any) {
      console.error("Error creating update:", error);
      alert(error.message || "Failed to create update");
    } finally {
      setLoading(false);
      setUploadingPhotos(false);
    }
  };

  // Edge Function #9: Pin/Unpin Update
  const handleTogglePin = async (updateId: string, currentPinStatus: boolean) => {
    if (!canEdit) return;
    setLoading(true);

    try {
      await projectApi.pinUpdate(updateId, !currentPinStatus);
      onUpdate();
    } catch (error: any) {
      console.error("Error toggling pin:", error);
      alert(error.message || "Failed to update pin status");
    } finally {
      setLoading(false);
    }
  };

  // Handle photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 10 photos
    if (selectedPhotos.length + files.length > 10) {
      alert("Maximum 10 photos per update");
      return;
    }

    setSelectedPhotos([...selectedPhotos, ...files]);

    // Create preview URLs
    const newPreviewUrls = files.map((file) => URL.createObjectURL(file));
    setPhotoPreviewUrls([...photoPreviewUrls, ...newPreviewUrls]);
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...selectedPhotos];
    const newPreviews = [...photoPreviewUrls];
    
    // Revoke object URL to free memory
    URL.revokeObjectURL(newPreviews[index]);
    
    newPhotos.splice(index, 1);
    newPreviews.splice(index, 1);
    
    setSelectedPhotos(newPhotos);
    setPhotoPreviewUrls(newPreviews);
  };

  // Separate pinned and regular updates
  const pinnedUpdates = updates.filter((u) => u.is_pinned);
  const regularUpdates = updates.filter((u) => !u.is_pinned);

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Project Updates</h3>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            {updates.length} update{updates.length !== 1 ? "s" : ""} • {pinnedUpdates.length} pinned
          </p>
        </div>
        {canEdit && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl text-sm sm:text-base w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Post Update
          </motion.button>
        )}
      </div>

      {/* Empty State */}
      {updates.length === 0 ? (
        <GlassCard className="text-center py-12 sm:py-16">
          <MessageSquare className="w-16 h-16 sm:w-20 sm:h-20 text-primary/30 mx-auto mb-4 sm:mb-6" />
          <p className="text-base sm:text-xl text-muted-foreground mb-4 sm:mb-6">No updates posted yet</p>
          {canEdit && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-primary hover:text-primary/80 font-semibold text-base sm:text-lg"
            >
              Post your first update
            </button>
          )}
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {/* Pinned Updates Section */}
          {pinnedUpdates.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Pin className="w-5 h-5 text-accent" />
                <h4 className="text-lg font-bold">Pinned Updates</h4>
              </div>
              <div className="space-y-4">
                {pinnedUpdates.map((update, idx) => (
                  <UpdateCard
                    key={update.id}
                    update={update}
                    canEdit={canEdit}
                    loading={loading}
                    onTogglePin={handleTogglePin}
                    index={idx}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Regular Updates Section */}
          {regularUpdates.length > 0 && (
            <div>
              {pinnedUpdates.length > 0 && (
                <h4 className="text-lg font-bold mb-4">Recent Updates</h4>
              )}
              <div className="space-y-4">
                {regularUpdates.map((update, idx) => (
                  <UpdateCard
                    key={update.id}
                    update={update}
                    canEdit={canEdit}
                    loading={loading}
                    onTogglePin={handleTogglePin}
                    index={idx}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Update Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-3xl backdrop-blur-xl bg-background/95 border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Post Project Update</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Update Type */}
                <div>
                  <label className="block text-sm font-medium mb-2">Update Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(updateTypeConfig).map(([value, config]) => {
                      const Icon = config.icon;
                      return (
                        <button
                          key={value}
                          onClick={() => setCreateForm({ ...createForm, update_type: value })}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold backdrop-blur-xl border transition-all ${
                            createForm.update_type === value
                              ? config.color
                              : "bg-white/5 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">Title *</label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder="e.g., Foundation work completed ahead of schedule"
                    className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-medium mb-2">Details *</label>
                  <textarea
                    value={createForm.body}
                    onChange={(e) => setCreateForm({ ...createForm, body: e.target.value })}
                    placeholder="Provide detailed information about this update..."
                    rows={6}
                    className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Attach Photos (Optional, max 10)
                  </label>
                  
                  {/* Photo Preview Grid */}
                  {photoPreviewUrls.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-3">
                      {photoPreviewUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-white/20"
                          />
                          <button
                            onClick={() => removePhoto(index)}
                            className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Button */}
                  {selectedPhotos.length < 10 && (
                    <label className="flex items-center justify-center gap-2 px-4 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl cursor-pointer transition-all">
                      <ImageIcon className="w-5 h-5" />
                      <span>Add Photos</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateUpdate}
                    disabled={loading || uploadingPhotos || !createForm.title.trim() || !createForm.body.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-xl transition-all"
                  >
                    {uploadingPhotos ? (
                      <>
                        <Upload className="w-4 h-4 animate-pulse" />
                        Uploading Photos...
                      </>
                    ) : loading ? (
                      "Posting..."
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4" />
                        Post Update
                      </>
                    )}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCreateModal(false)}
                    disabled={loading || uploadingPhotos}
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
    </div>
  );
}

// Separate Update Card Component
function UpdateCard({
  update,
  canEdit,
  loading,
  onTogglePin,
  index,
}: {
  update: ProjectUpdate;
  canEdit: boolean;
  loading: boolean;
  onTogglePin: (updateId: string, currentPinStatus: boolean) => void;
  index: number;
}) {
  const typeConfig = updateTypeConfig[update.update_type as keyof typeof updateTypeConfig] || updateTypeConfig.general;
  const TypeIcon = typeConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <GlassCard>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`px-3 py-1 rounded-lg text-xs font-semibold backdrop-blur-xl border inline-flex items-center gap-1.5 ${typeConfig.color}`}>
                <TypeIcon className="w-3.5 h-3.5" />
                {typeConfig.label}
              </span>
              {update.is_pinned && (
                <span className="px-2 py-1 bg-accent/20 text-accent border border-accent/30 rounded-lg text-xs font-semibold inline-flex items-center gap-1">
                  <Pin className="w-3 h-3" />
                  Pinned
                </span>
              )}
            </div>

            {/* Title */}
            <h4 className="text-lg sm:text-xl font-bold mb-2 break-words">{update.title}</h4>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground mb-3">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>{update.posted_by_user?.full_name || "Unknown"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{format(new Date(update.posted_at), "dd MMM yyyy, HH:mm")}</span>
              </div>
            </div>
          </div>

          {/* Pin Button */}
          {canEdit && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onTogglePin(update.id, update.is_pinned)}
              disabled={loading}
              className={`p-2 backdrop-blur-xl border rounded-lg transition-all ${
                update.is_pinned
                  ? "bg-accent/20 border-accent/30 text-accent"
                  : "bg-white/10 hover:bg-white/20 border-white/20"
              }`}
            >
              <Pin className="w-4 h-4" />
            </motion.button>
          )}
        </div>

        {/* Body */}
        <p className="text-sm sm:text-base leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
          {update.body}
        </p>

        {/* TODO: Display attached photos if any */}
      </GlassCard>
    </motion.div>
  );
}