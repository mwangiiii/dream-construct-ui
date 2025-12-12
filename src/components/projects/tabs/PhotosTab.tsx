// src/components/projects/tabs/PhotosTab.tsx
import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { projectApi } from "@/lib/api/projectApi";
import { uploadFileToStorage } from "@/types/project";
import { 
  Camera, 
  Image, 
  UploadCloud, 
  X, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Download,
  Trash2,
  Calendar,
  Plus,
} from "lucide-react";
import type { Document } from "@/types/project";

interface PhotoUpload {
  file: File;
  preview: string;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  uploadedPath?: string;
  error?: string;
}

interface Milestone {
  id: string;
  title: string;
  planned_start_date: string | null;
  planned_end_date: string | null;
}

interface Props {
  projectId: string;
  photos: Document[];
  milestones: Milestone[];
  canEdit: boolean;
  onUpdate: () => void;
}

const PhotosTab: React.FC<Props> = ({ projectId, photos, milestones, canEdit, onUpdate }) => {
  // Debug log for diagnosis
  console.log('[PhotosTab] photos prop:', photos);
  const [uploads, setUploads] = useState<PhotoUpload[]>([]);
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState<string[]>([]);
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<Document | null>(null);

  // Bulletproof photo upload wrapper (uses correct bucket)
  const uploadProjectPhoto = useCallback(async (file: File) => {
  console.log('Wrapper called with projectId:', projectId);
  // Only pass file, projectId, and folder; let uploadFileToStorage use its default bucket
  const result = await uploadFileToStorage(
    file,
    projectId,
    "photos"
  );
  console.log('Wrapper result:', result);
  return result;
}, [projectId]);

  const handleBulkUpload = async (files: File[]) => {
    const newUploads: PhotoUpload[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: "pending",
    }));

    setUploads(prev => [...prev, ...newUploads]);

    const uploadPromises = newUploads.map(async (upload, index) => {
      try {
        setUploads(prev => prev.map(u => 
          u.preview === upload.preview ? { ...u, status: "uploading" } : u
        ));

        // Check user session before uploading
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData?.session?.access_token) {
          setUploads(prev => prev.map(u =>
            u.preview === upload.preview
              ? { ...u, status: "error", error: "You must be logged in to upload photos." }
              : u
          ));
          throw new Error("No active session. Please log in again.");
        }

        const { path: uploadedPath, error } = await uploadProjectPhoto(upload.file);
        if (error || !uploadedPath) {
          console.error(`Upload failed for ${upload.file.name}:`, error);
          throw new Error(`Failed to upload ${upload.file.name}: ${error?.message || "Unknown error"}`);
        }

        // Call edge function to add to DB
        const uploadResult = await projectApi.bulkUploadPhotos({
          project_id: projectId,
          milestone_id: selectedMilestone || null,
          photos: [{
            name: upload.file.name,
            file_path: uploadedPath,
            file_size: upload.file.size,
          }],
        });
        console.log('PhotosTab bulkUploadPhotos result:', uploadResult);
        if (!uploadResult?.success) throw new Error(uploadResult?.error || "Unknown upload error");

        setUploads(prev => prev.map(u =>
          u.preview === upload.preview
            ? { ...u, status: "success", uploadedPath }
            : u
        ));

        onUpdate();  // Refresh photos list

      } catch (err: any) {
        console.error("Bulk photo upload failed:", err);
        setUploads(prev => prev.map(u => 
          u.preview === upload.preview 
            ? { ...u, status: "error", error: err.message } 
            : u
        ));
      }
    });

    await Promise.all(uploadPromises);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith("image/")
    );
    if (files.length > 0) {
      handleBulkUpload(files);
    }
  }, [handleBulkUpload]);

  const handleFileSelect = useCallback(() => {
    const files = Array.from(fileInputRef.current?.files || []).filter(file => 
      file.type.startsWith("image/")
    );
    if (files.length > 0) {
      handleBulkUpload(files);
    }
  }, [handleBulkUpload]);

  const removeUpload = useCallback((preview: string) => {
    setUploads(prev => prev.filter(u => u.preview !== preview));
    URL.revokeObjectURL(preview);
  }, []);

  const handleDeletePhoto = async (photoId: string) => {
    setDeleting(prev => [...prev, photoId]);
    try {
      // First, delete from storage
      const { data: photoDoc } = await supabase
        .from("documents")
        .select("file_path")
        .eq("id", photoId)
        .single();

      if (photoDoc?.file_path) {
        const { error: storageError } = await supabase.storage
          .from("documents-and-images")
          .remove([photoDoc.file_path]);
        if (storageError) throw storageError;
      }

      // Delete from DB via edge function (bypasses RLS)
      await projectApi.deletePhoto(photoId);

      onUpdate();
      showToast("Photo deleted successfully", "success");
    } catch (err: any) {
      console.error("Delete failed:", err);
      showToast(`Delete failed: ${err.message}`, "error");
    } finally {
      setDeleting(prev => prev.filter(id => id !== photoId));
    }
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    // Implement your toast logic here, or use a global one
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  const groupedPhotos = photos.reduce((acc, photo) => {
    const dateKey = photo.uploaded_at ? new Date(photo.uploaded_at).toLocaleDateString() : "Uncategorized";
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(photo);
    return acc;
  }, {} as Record<string, Document[]>);
  console.log('[PhotosTab] groupedPhotos:', groupedPhotos);

  // Edit Photo Modal
  const handleEditPhoto = (photo: Document) => {
    setEditingPhotoId(photo.id);
    setEditName(photo.name);
    setEditModalOpen(true);
  };

  // View Photo Modal
  const handleViewPhoto = (photo: Document) => {
    setViewPhoto(photo);
    setViewModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      {canEdit && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3">
            <Camera className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold">Upload Progress Photos</h3>
          </div>

          {/* Milestone Selector */}
          {milestones.length > 0 && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <select
                value={selectedMilestone || ""}
                onChange={(e) => setSelectedMilestone(e.target.value || null)}
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">No milestone</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.planned_start_date} - {m.planned_end_date})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/30"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <UploadCloud className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag & drop images here, or click to select
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 border border-primary text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Select Photos
            </button>
          </div>

          {/* Upload Progress */}
          <AnimatePresence>
            {uploads.length > 0 && (
              <div className="space-y-3">
                {uploads.map((upload) => (
                  <motion.div
                    key={upload.preview}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border"
                  >
                    <img
                      src={upload.preview}
                      alt={upload.file.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{upload.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {upload.file.size / 1024 / 1024 > 1
                          ? `${(upload.file.size / 1024 / 1024).toFixed(1)} MB`
                          : `${(upload.file.size / 1024).toFixed(0)} KB`}
                      </p>
                    </div>
                    <div className="w-20">
                      {upload.status === "uploading" && (
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                      )}
                      {upload.status === "success" && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                      {upload.status === "error" && (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    {(upload.status === "error" || upload.status === "success") && (
                      <button
                        onClick={() => removeUpload(upload.preview)}
                        className="ml-2 p-1 hover:bg-muted rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {upload.status === "error" && (
                      <p className="text-xs text-red-500 ml-2">{upload.error}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Photos Grid */}
      <div className="space-y-6">
        {Object.entries(groupedPhotos).map(([dateKey, groupPhotos]) => (
          <div key={dateKey} className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {dateKey}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {groupPhotos.map((photo) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group bg-background rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <button
                    type="button"
                    className="w-full h-32 p-0 border-none bg-transparent cursor-pointer"
                    style={{ display: 'block' }}
                    onClick={() => handleViewPhoto(photo)}
                    tabIndex={0}
                    aria-label={`View photo: ${photo.name}`}
                  >
                    <img
                      src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents-and-images/${photo.file_path}`}
                      alt={photo.name}
                      className="w-full h-32 object-cover rounded-t-lg"
                    />
                  </button>
                  {canEdit && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleDeletePhoto(photo.id);
                      }}
                      disabled={deleting.includes(photo.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/80 hover:bg-red-500 text-white p-1 rounded-full disabled:opacity-50"
                    >
                      {deleting.includes(photo.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 truncate flex items-center">
                    {photo.name}
                    {canEdit && (
                      <button
                        onClick={() => handleEditPhoto(photo)}
                        className="ml-2 text-xs text-blue-300 underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Edit Photo Name Modal - Responsive and Styled */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent
          className="w-full max-w-md sm:max-w-lg p-0 rounded-2xl bg-background shadow-2xl border border-border flex flex-col items-center"
        >
          <div className="w-full px-6 py-5 flex flex-col gap-4">
            <DialogTitle className="text-xl font-bold mb-2 text-primary tracking-tight">Edit Photo Name</DialogTitle>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (editingPhotoId) {
                  await projectApi.updateDocument(editingPhotoId, { name: editName });
                  setEditingPhotoId(null);
                  setEditModalOpen(false);
                  onUpdate();
                }
              }}
              className="flex flex-col gap-4"
            >
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="px-4 py-2 text-base rounded-lg border border-border focus:border-primary focus:ring-2 focus:ring-primary/30 bg-background text-foreground placeholder:text-muted-foreground transition-all outline-none shadow-sm min-w-0"
                autoFocus
                placeholder="Enter new photo name..."
                style={{ letterSpacing: '0.01em' }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setEditModalOpen(false); setEditingPhotoId(null); }}
                  className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-semibold text-sm shadow transition-all border border-border"
                >Cancel</button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm shadow transition-all"
                >Save</button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Photo Modal - Responsive, Scrollable, Styled */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent
          className="w-full max-w-3xl sm:max-w-4xl p-0 bg-background rounded-2xl shadow-2xl border border-border flex flex-col items-center overflow-hidden"
        >
          {viewPhoto && (
            <div className="w-full flex flex-col items-center justify-center max-h-[80vh] overflow-y-auto">
              <div className="w-full flex justify-end p-3">
                <button
                  onClick={() => setViewModalOpen(false)}
                  className="p-2 rounded-full hover:bg-muted transition-colors focus:outline-none"
                  aria-label="Close"
                >
                  <X className="w-6 h-6 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 flex items-center justify-center w-full px-2 pb-2">
                <img
                  src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents-and-images/${viewPhoto.file_path}`}
                  alt={viewPhoto.name}
                  className="max-w-full max-h-[65vh] object-contain rounded-xl border border-border bg-background"
                  style={{ margin: '0 auto' }}
                />
              </div>
              <div className="w-full px-4 py-3 bg-muted text-foreground text-center text-base font-medium truncate border-t border-border">
                {viewPhoto.name}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {photos.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <Image className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No photos yet</h3>
          <p className="text-muted-foreground">Upload your first progress photo to get started</p>
        </motion.div>
      )}
    </div>
  );
};

export default PhotosTab;