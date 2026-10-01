// src/components/projects/tabs/UpdatesTab.tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { projectApi } from "@/lib/api/projectApi";
import {
  Plus,
  Pin,
  Edit,
  Trash2,
  RotateCcw,
  X,
  Check,
  Upload,
  Image as ImageIcon,
  Video,
  FileText,
  Calendar,
  User,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Archive,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

interface Update {
  id: string;
  title: string;
  body: string;
  update_type: string;
  posted_at: string;
  posted_by: string;
  is_pinned: boolean;
  media_paths: string[] | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  updated_at: string | null;
  posted_by_user?: { full_name: string } | null;
  deleted_by_user?: { full_name: string } | null;
}

interface UpdatesTabProps {
  projectId: string;
  updates: Update[];
  deletedUpdates: Update[];
  canEdit: boolean;
  currentUserId?: string;
  isAdmin: boolean;
  onUpdate: () => void;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
}

const UPDATE_TYPES = [
  { value: "general", label: "General", color: "bg-blue-500" },
  { value: "progress", label: "Progress", color: "bg-green-500" },
  { value: "delay", label: "Delay", color: "bg-orange-500" },
  { value: "safety", label: "Safety", color: "bg-red-500" },
  { value: "weather", label: "Weather", color: "bg-sky-500" },
  { value: "inspection", label: "Inspection", color: "bg-purple-500" },
  { value: "change_order", label: "Change Order", color: "bg-yellow-500" },
  { value: "issue", label: "Issue", color: "bg-pink-500" },
];

const ToastNotification: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const config = {
    success: { icon: <Check className="w-5 h-5" />, bg: "bg-green-500/20", border: "border-green-500/50", text: "text-green-200" },
    error: { icon: <XCircle className="w-5 h-5" />, bg: "bg-red-500/20", border: "border-red-500/50", text: "text-red-200" },
    warning: { icon: <AlertTriangle className="w-5 h-5" />, bg: "bg-yellow-500/20", border: "border-yellow-500/50", text: "text-yellow-200" },
  };

  const { icon, bg, border, text } = config[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`flex items-center gap-3 min-w-80 max-w-md backdrop-blur-xl ${bg} ${border} ${text} border rounded-xl shadow-2xl p-4 cursor-pointer hover:opacity-90 transition-all pointer-events-auto`}
      onClick={() => onDismiss(toast.id)}
    >
      <div className="p-2 bg-white/20 rounded-lg">{icon}</div>
      <p className="font-medium text-sm">{toast.message}</p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        className="ml-auto opacity-70 hover:opacity-100"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}
  >
    {children}
  </div>
);

export default function UpdatesTab({
  projectId,
  updates,
  deletedUpdates,
  canEdit,
  currentUserId,
  isAdmin,
  onUpdate,
}: UpdatesTabProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<Update | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [showDeletedUpdates, setShowDeletedUpdates] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formType, setFormType] = useState("general");
  const [formMediaFiles, setFormMediaFiles] = useState<File[]>([]);
  const [existingMediaPaths, setExistingMediaPaths] = useState<string[]>([]);
  const [mediaToRemove, setMediaToRemove] = useState<string[]>([]);

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const resetForm = () => {
    setFormTitle("");
    setFormBody("");
    setFormType("general");
    setFormMediaFiles([]);
    setExistingMediaPaths([]);
    setMediaToRemove([]);
    setEditingUpdate(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (update: Update) => {
    setFormTitle(update.title);
    setFormBody(update.body);
    setFormType(update.update_type);
    setExistingMediaPaths(update.media_paths || []);
    setMediaToRemove([]);
    setFormMediaFiles([]);
    setEditingUpdate(update);
    setShowCreateModal(true);
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalMedia = existingMediaPaths.length - mediaToRemove.length + formMediaFiles.length + files.length;

    if (totalMedia > 10) {
      showToast("Cannot exceed 10 media files per update", "error");
      return;
    }

    setFormMediaFiles((prev) => [...prev, ...files]);
  };

  const removeNewMedia = (index: number) => {
    setFormMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleExistingMediaRemoval = (path: string) => {
    setMediaToRemove((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  // SECURE: Upload media using the REAL update ID
  const uploadMediaFiles = async (files: File[], updateId: string): Promise<string[]> => {
    const uploadedPaths: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split(".").pop() || "";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${projectId}/${updateId}/${fileName}`;

      const { error } = await supabase.storage
        .from("project_updates_media")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw new Error(`Upload failed: ${file.name} — ${error.message}`);
      uploadedPaths.push(filePath);
    }

    return uploadedPaths;
  };

  // CREATE: 100% secure via your create-daily-update edge function
  const handleCreateUpdate = async () => {
    if (!formTitle.trim() || !formBody.trim()) {
      showToast("Title and body are required", "error");
      return;
    }

    setLoading("create");

    try {
      // Step 1: Create update (no media) via secure edge function
      const result = await projectApi.createDailyUpdate({
        project_id: projectId,
        title: formTitle.trim(),
        body: formBody.trim(),
        update_type: formType,
      });

      const newUpdateId = result.data.id;

      // Step 2: Upload media if any
      if (formMediaFiles.length > 0) {
        const uploadedPaths = await uploadMediaFiles(formMediaFiles, newUpdateId);
        await projectApi.addMediaToUpdate(newUpdateId, uploadedPaths);
      }

      showToast("Update created successfully!", "success");
      resetForm();
      setShowCreateModal(false);
      onUpdate();
    } catch (error: any) {
      showToast(error.message || "Failed to create update", "error");
    } finally {
      setLoading(null);
    }
  };

  // EDIT: 100% secure via manage-project-update edge function
  const handleUpdateUpdate = async () => {
    if (!editingUpdate || !formTitle.trim() || !formBody.trim()) {
      showToast("Title and body are required", "error");
      return;
    }

    setLoading("update");

    try {
      const contentChanged =
        formTitle !== editingUpdate.title ||
        formBody !== editingUpdate.body ||
        formType !== editingUpdate.update_type;

      if (contentChanged) {
        await projectApi.updateUpdateContent(editingUpdate.id, {
          title: formTitle.trim(),
          body: formBody.trim(),
          update_type: formType,
        });
      }

      if (mediaToRemove.length > 0) {
        await projectApi.removeMediaFromUpdate(editingUpdate.id, mediaToRemove);
      }

      if (formMediaFiles.length > 0) {
        const uploadedPaths = await uploadMediaFiles(formMediaFiles, editingUpdate.id);
        await projectApi.addMediaToUpdate(editingUpdate.id, uploadedPaths);
      }

      showToast("Update modified successfully!", "success");
      resetForm();
      setShowCreateModal(false);
      onUpdate();
    } catch (error: any) {
      showToast(error.message || "Failed to update", "error");
    } finally {
      setLoading(null);
    }
  };

  const handleTogglePin = async (update: Update) => {
    setLoading(`pin-${update.id}`);
    try {
      await projectApi.toggleUpdatePin(update.id, !update.is_pinned);
      showToast(update.is_pinned ? "Update unpinned" : "Update pinned", "success");
      onUpdate();
    } catch (error: any) {
      showToast(error.message || "Failed to toggle pin", "error");
    } finally {
      setLoading(null);
    }
  };

  const handleSoftDelete = async (updateId: string) => {
    if (!confirm("Are you sure you want to delete this update? It can be restored later.")) return;
    setLoading(`delete-${updateId}`);
    try {
      await projectApi.softDeleteUpdate(updateId);
      showToast("Update deleted successfully", "success");
      onUpdate();
    } catch (error: any) {
      showToast(error.message || "Failed to delete update", "error");
    } finally {
      setLoading(null);
    }
  };

  const handleRestore = async (updateId: string) => {
    setLoading(`restore-${updateId}`);
    try {
      await projectApi.restoreUpdate(updateId);
      showToast("Update restored successfully", "success");
      onUpdate();
    } catch (error: any) {
      showToast(error.message || "Failed to restore update", "error");
    } finally {
      setLoading(null);
    }
  };

  const handlePermanentDelete = async (updateId: string) => {
    if (!confirm("PERMANENT DELETE - This action CANNOT be undone!\n\nThis will permanently delete the update and all its media files from storage.\n\nAre you absolutely sure?")) return;
    setLoading(`permanent-${updateId}`);
    try {
      await projectApi.permanentDeleteUpdate(updateId);
      showToast("Update permanently deleted", "success");
      onUpdate();
    } catch (error: any) {
      showToast(error.message || "Failed to permanently delete", "error");
    } finally {
      setLoading(null);
    }
  };

  const getMediaUrl = (path: string) => {
    if (!path) return "";
    const bucket = "project_updates_media";
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const getFileIcon = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext || "")) {
      return <ImageIcon className="w-4 h-4" />;
    }
    if (["mp4", "mov", "avi", "webm", "mkv", "flv"].includes(ext || "")) {
      return <Video className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  const isImageFile = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext || "");
  };

  const isVideoFile = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    return ["mp4", "mov", "avi", "webm", "mkv", "flv"].includes(ext || "");
  };

  const canEditUpdate = (update: Update) => {
    if (!canEdit) return false;
    if (isAdmin) return true;
    return update.posted_by === currentUserId;
  };

  const renderUpdateCard = (update: Update, isDeleted: boolean = false) => {
    const typeConfig = UPDATE_TYPES.find((t) => t.value === update.update_type) || UPDATE_TYPES[0];
    const isLoading = loading?.includes(update.id);
    const canEditThis = canEditUpdate(update);

    return (
      <motion.div
        key={update.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`backdrop-blur-xl border rounded-2xl p-6 transition-all ${
          isDeleted
            ? "bg-red-500/5 border-red-500/30"
            : update.is_pinned
            ? "bg-yellow-500/10 border-yellow-500/40"
            : "bg-white/10 border-white/20 hover:bg-white/15"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {update.is_pinned && !isDeleted && (
                <div className="p-1.5 bg-yellow-500/20 rounded-lg">
                  <Pin className="w-4 h-4 text-yellow-500" />
                </div>
              )}
              <span className={`px-3 py-1 ${typeConfig.color} text-white text-xs font-semibold rounded-lg`}>
                {typeConfig.label}
              </span>
              {isDeleted && (
                <span className="px-3 py-1 bg-red-500/20 border border-red-500/50 text-red-300 text-xs font-semibold rounded-lg">
                  Deleted
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold mb-2">{update.title}</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">{update.body}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!isDeleted && canEditThis && (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleTogglePin(update)}
                  disabled={isLoading}
                  className={`p-2 rounded-lg transition-all ${
                    update.is_pinned
                      ? "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30"
                      : "bg-white/10 hover:bg-white/20"
                  }`}
                  title={update.is_pinned ? "Unpin" : "Pin"}
                >
                  {loading === `pin-${update.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Pin className="w-4 h-4" />
                  )}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => openEditModal(update)}
                  disabled={isLoading}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSoftDelete(update.id)}
                  disabled={isLoading}
                  className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
                  title="Delete"
                >
                  {loading === `delete-${update.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </motion.button>
              </>
            )}

            {isDeleted && isAdmin && (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleRestore(update.id)}
                  disabled={isLoading}
                  className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-all"
                  title="Restore"
                >
                  {loading === `restore-${update.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handlePermanentDelete(update.id)}
                  disabled={isLoading}
                  className="p-2 bg-red-500/40 hover:bg-red-500/50 text-red-200 rounded-lg transition-all"
                  title="Permanent Delete"
                >
                  {loading === `permanent-${update.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                </motion.button>
              </>
            )}
          </div>
        </div>

        {/* Media Grid */}
        {update.media_paths && update.media_paths.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
            {update.media_paths.map((path, idx) => {
              const mediaUrl = getMediaUrl(path);
              const isImage = isImageFile(path);
              const isVideo = isVideoFile(path);

              return (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.05 }}
                  className="relative aspect-square rounded-lg overflow-hidden cursor-pointer bg-white/5 border border-white/10"
                  onClick={() => setSelectedMedia(path)}
                >
                  {isImage && (
                    <img
                      src={mediaUrl}
                      alt={`Media ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const parent = target.parentElement;
                        if (parent) {
                          const fallback = document.createElement("div");
                          fallback.className = "w-full h-full flex items-center justify-center bg-white/5";
                          fallback.innerHTML = `<svg class="w-12 h-12 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`;
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  )}
                  {isVideo && (
                    <video
                      src={mediaUrl}
                      className="w-full h-full object-cover"
                      preload="metadata"
                    />
                  )}
                  {!isImage && !isVideo && (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="w-12 h-12 text-white/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                    <div className="flex items-center gap-1 text-white text-xs">
                      {getFileIcon(path)}
                      {isVideo && <span className="ml-1">Video</span>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-t border-white/10 pt-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>{update.posted_by_user?.full_name || "Unknown"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(update.posted_at), "PPp")}</span>
          </div>
          {update.updated_at && update.updated_at !== update.posted_at && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Edited {format(new Date(update.updated_at), "PPp")}</span>
            </div>
          )}
          {isDeleted && update.deleted_at && (
            <div className="flex items-center gap-2 text-red-300">
              <Trash2 className="w-4 h-4" />
              <span>
                Deleted by {update.deleted_by_user?.full_name || "Unknown"} on{" "}
                {format(new Date(update.deleted_at), "PPp")}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const activeUpdatesList = updates.filter((u) => !u.is_deleted);
  const pinnedUpdates = activeUpdatesList.filter((u) => u.is_pinned);
  const regularUpdates = activeUpdatesList.filter((u) => !u.is_pinned);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">Project Updates</h3>
          <p className="text-muted-foreground">
            {activeUpdatesList.length} active update{activeUpdatesList.length !== 1 ? "s" : ""}
            {isAdmin && deletedUpdates.length > 0 && ` • ${deletedUpdates.length} deleted`}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isAdmin && deletedUpdates.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDeletedUpdates(!showDeletedUpdates)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 font-semibold rounded-xl transition-all text-sm"
            >
              {showDeletedUpdates ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showDeletedUpdates ? "Hide" : "Show"} Deleted ({deletedUpdates.length})
            </motion.button>
          )}

          {canEdit && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={openCreateModal}
              className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all text-sm w-full sm:w-auto justify-center"
            >
              <Plus className="w-5 h-5" />
              New Update
            </motion.button>
          )}
        </div>
      </div>

      {/* Deleted Updates Section (Admin Only) */}
      {isAdmin && showDeletedUpdates && deletedUpdates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <Archive className="w-5 h-5 text-red-300" />
            <div>
              <h4 className="font-semibold text-red-300">Deleted Updates Archive</h4>
              <p className="text-sm text-red-300/70">These updates can be restored or permanently deleted</p>
            </div>
          </div>
          <AnimatePresence mode="popLayout">
            {deletedUpdates.map((update) => renderUpdateCard(update, true))}
          </AnimatePresence>
        </div>
      )}

      {/* Pinned Updates */}
      {pinnedUpdates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Pin className="w-5 h-5 text-yellow-500" />
            <h4 className="text-lg font-semibold">Pinned Updates</h4>
          </div>
          <AnimatePresence mode="popLayout">
            {pinnedUpdates.map((update) => renderUpdateCard(update))}
          </AnimatePresence>
        </div>
      )}

      {/* Regular Updates */}
      {regularUpdates.length > 0 && (
        <div className="space-y-4">
          {pinnedUpdates.length > 0 && <h4 className="text-lg font-semibold">All Updates</h4>}
          <AnimatePresence mode="popLayout">
            {regularUpdates.map((update) => renderUpdateCard(update))}
          </AnimatePresence>
        </div>
      )}

      {/* Empty State */}
      {activeUpdatesList.length === 0 && (
        <GlassCard className="text-center py-20">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="w-20 h-20 backdrop-blur-xl bg-primary/20 border border-primary/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-3">No Updates Yet</h3>
            <p className="text-lg text-muted-foreground mb-6">
              Start documenting project progress by creating your first update
            </p>
            {canEdit && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all"
              >
                <Plus className="w-5 h-5" />
                Create First Update
              </motion.button>
            )}
          </motion.div>
        </GlassCard>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !loading && setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-background border border-white/20 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">
                  {editingUpdate ? "Edit Update" : "Create New Update"}
                </h3>
                <button
                  onClick={() => !loading && setShowCreateModal(false)}
                  disabled={!!loading}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Title *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Enter update title..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    disabled={!!loading}
                  />
                </div>

                {/* Update Type */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Update Type *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {UPDATE_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormType(type.value)}
                        disabled={!!loading}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                          formType === type.value
                            ? `${type.color} text-white`
                            : "bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Description *</label>
                  <textarea
                    value={formBody}
                    onChange={(e) => setFormBody(e.target.value)}
                    placeholder="Describe what happened today..."
                    rows={6}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                    disabled={!!loading}
                  />
                </div>

                {/* Existing Media (Edit Mode) */}
                {editingUpdate && existingMediaPaths.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">Current Media</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {existingMediaPaths.map((path, idx) => {
                        const mediaUrl = getMediaUrl(path);
                        const isImage = isImageFile(path);
                        const isVideo = isVideoFile(path);

                        return (
                          <div
                            key={idx}
                            className={`relative aspect-square rounded-lg overflow-hidden ${
                              mediaToRemove.includes(path) ? "opacity-50 ring-2 ring-red-500" : ""
                            }`}
                          >
                            {isImage && (
                              <img
                                src={mediaUrl}
                                alt={`Media ${idx + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.style.display = "none";
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const fallback = document.createElement("div");
                                    fallback.className = "w-full h-full flex items-center justify-center bg-white/5";
                                    fallback.innerHTML = `<svg class="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`;
                                    parent.appendChild(fallback);
                                  }
                                }}
                              />
                            )}
                            {isVideo && (
                              <video
                                src={mediaUrl}
                                className="w-full h-full object-cover"
                                preload="metadata"
                              />
                            )}
                            {!isImage && !isVideo && (
                              <div className="w-full h-full flex items-center justify-center bg-white/5">
                                <FileText className="w-8 h-8 text-white/30" />
                              </div>
                            )}
                            <button
                              onClick={() => toggleExistingMediaRemoval(path)}
                              disabled={!!loading}
                              className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all ${
                                mediaToRemove.includes(path)
                                  ? "bg-green-500 text-white"
                                  : "bg-red-500/80 text-white hover:bg-red-500"
                              }`}
                            >
                              {mediaToRemove.includes(path) ? (
                                <RotateCcw className="w-4 h-4" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* New Media */}
                {formMediaFiles.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      New Media ({formMediaFiles.length})
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {formMediaFiles.map((file, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-white/5">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => removeNewMedia(idx)}
                            disabled={!!loading}
                            className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Media Upload */}
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Add Media (max 10 total)
                  </label>
                  <label
                    className={`flex items-center justify-center gap-3 px-6 py-4 border-2 border-dashed border-white/20 rounded-xl hover:border-primary hover:bg-primary/5 transition-all cursor-pointer ${
                      loading ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <Upload className="w-6 h-6 text-primary" />
                    <span className="font-medium">Click to upload images/videos</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleMediaSelect}
                      disabled={!!loading}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">
                    Current total: {existingMediaPaths.length - mediaToRemove.length + formMediaFiles.length} / 10
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={editingUpdate ? handleUpdateUpdate : handleCreateUpdate}
                    disabled={!!loading || !formTitle.trim() || !formBody.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold rounded-xl transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {editingUpdate ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        {editingUpdate ? "Save Changes" : "Create Update"}
                      </>
                    )}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => !loading && setShowCreateModal(false)}
                    disabled={!!loading}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl transition-all"
                  >
                    Cancel
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Lightbox */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedMedia(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-6xl w-full max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedMedia(null)}
                className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              {isImageFile(selectedMedia) && (
                <img
                  src={getMediaUrl(selectedMedia)}
                  alt="Preview"
                  className="w-full h-full object-contain rounded-2xl"
                  onError={(e) => {
                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpath d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'/%3E%3C/svg%3E";
                  }}
                />
              )}
              {isVideoFile(selectedMedia) && (
                <video
                  src={getMediaUrl(selectedMedia)}
                  controls
                  className="w-full h-full object-contain rounded-2xl"
                  autoPlay
                >
                  Your browser does not support the video tag.
                </video>
              )}
              {!isImageFile(selectedMedia) && !isVideoFile(selectedMedia) && (
                <div className="w-full h-96 flex flex-col items-center justify-center bg-white/5 rounded-2xl">
                  <FileText className="w-20 h-20 text-white/30 mb-4" />
                  <p className="text-white/70">Cannot preview this file type</p>
                  <a
                    href={getMediaUrl(selectedMedia)}
                    download
                    className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-background rounded-lg transition-all"
                  >
                    Download File
                  </a>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toasts */}
      <div className="fixed bottom-6 right-6 z-[9999] space-y-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastNotification key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}