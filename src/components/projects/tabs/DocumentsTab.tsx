  // src/components/projects/tabs/DocumentsTab.tsx
  import { useState, useEffect } from "react";
  import { format } from "date-fns";
  import { motion, AnimatePresence } from "framer-motion";
  import { toast } from "@/hooks/use-toast";
  import {
    FileText,
    Upload,
    Download,
    Trash2,
    X,
    Folder,
    File,
    FolderOpen,
    Calendar,
    User,
    Search,
    Filter,
    Move,
    FileImage,
    FileSpreadsheet,
    FileType,
    Archive,
  } from "lucide-react";
  import { projectApi } from "@/lib/api/projectApi";
  import { uploadFileToStorage } from "@/types/project";
  import { supabase } from "@/lib/supabaseClient";
  import { Document } from "@/types/project";

  interface DocumentsTabProps {
    projectId: string;
    documents: Document[];
    milestones?: any[];
    tasks?: any[];
    canEdit: boolean;
    onUpdate: () => void;
  }

  const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}>
      {children}
    </div>
  );

  // Folder structure
  const folders = [
    { id: "general", name: "General", icon: Folder },
    { id: "contracts", name: "Contracts", icon: FileText },
    { id: "permits", name: "Permits & Approvals", icon: FileText },
    { id: "drawings", name: "Shop Drawings", icon: FileImage },
    { id: "rfis", name: "RFIs & Submittals", icon: FileType },
    { id: "as_builts", name: "As-Built Documents", icon: FileSpreadsheet },
    { id: "change_orders", name: "Change Orders", icon: FileText },
    { id: "reports", name: "Reports", icon: FileSpreadsheet },
    { id: "invoices", name: "Invoices & Payments", icon: FileText },
    { id: "other", name: "Other", icon: Archive },
  ];

  // File type icons
  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return File;
    if (mimeType.startsWith("image/")) return FileImage;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
    if (mimeType.includes("pdf") || mimeType.includes("document")) return FileText;
    return File;
  };

  // Format file size
  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };


  export default function DocumentsTab({ projectId, documents, milestones = [], tasks = [], canEdit, onUpdate }: DocumentsTabProps) {
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [documentToMove, setDocumentToMove] = useState<Document | null>(null);


    // Milestones and Tasks state (fetch from API)
    const [milestoneList, setMilestoneList] = useState<any[]>(milestones);
    const [taskList, setTaskList] = useState<any[]>(tasks);

    // Upload form state
    const [uploadForm, setUploadForm] = useState({
      folder: "general",
      milestone_id: "",
      task_id: "",
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Move form state
    const [moveForm, setMoveForm] = useState({
      folder: "",
      milestone_id: "",
      task_id: "",
    });


    // Fetch milestones and tasks on mount or when projectId changes
    useEffect(() => {
      const fetchMilestonesAndTasks = async () => {
        if (!projectId) return;
        try {
          // Fetch milestones
          const { data: milestonesData, error: milestonesError } = await supabase
            .from('project_milestones')
            .select('id, title')
            .eq('project_id', projectId)
            .order('sort_order', { ascending: true });
          setMilestoneList(milestonesError ? [] : milestonesData || []);

          // Fetch tasks
          const { data: tasksData, error: tasksError } = await supabase
            .from('tasks')
            .select('id, title')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });
          setTaskList(tasksError ? [] : tasksData || []);
        } catch (err) {
          setMilestoneList([]);
          setTaskList([]);
        }
      };
      fetchMilestonesAndTasks();
    }, [projectId]);

    // Edge Function #10: Upload Document
    const handleUploadDocument = async () => {
      if (!selectedFile || !canEdit) return;
      setLoading(true);

      try {
        // Upload to storage

        // Store document in documents-and-images/{projectId}/documents/
        const { path, error: uploadError } = await uploadFileToStorage(
          selectedFile,
          projectId,
          "documents"
        );
        if (uploadError) throw uploadError;

        // Create document record
        await projectApi.uploadDocument({
          project_id: projectId,
          milestone_id: uploadForm.milestone_id || null,
          task_id: uploadForm.task_id || null,
          name: selectedFile.name,
          file_path: path,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          folder: uploadForm.folder,
        });

        toast({ title: "Document uploaded successfully!" });
        setShowUploadModal(false);
        setSelectedFile(null);
        setUploadForm({
          folder: "general",
          milestone_id: "",
          task_id: "",
        });
        onUpdate();
      } catch (error: any) {
        toast({ title: error.message || "Failed to upload document", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    // Edge Function #13: Move Document
    const handleMoveDocument = async () => {
      if (!documentToMove || !canEdit) return;
      setLoading(true);

      try {
        await projectApi.moveDocument(documentToMove.id, {
          folder: moveForm.folder || undefined,
          milestone_id: moveForm.milestone_id || null,
          task_id: moveForm.task_id || null,
        });

        toast({ title: "Document moved successfully!" });
        setShowMoveModal(false);
        setDocumentToMove(null);
        setMoveForm({
          folder: "",
          milestone_id: "",
          task_id: "",
        });
        onUpdate();
      } catch (error: any) {
        toast({ title: error.message || "Failed to move document", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    // Edge Function #12: Delete Document
    const handleDeleteDocument = async (doc: Document) => {
      if (!canEdit) return;
      if (!confirm(`Delete "${doc.name}"?`)) return;

      setLoading(true);
      try {
        await projectApi.deleteDocument(doc.id);
        toast({ title: "Document deleted successfully!" });
        onUpdate();
      } catch (error: any) {
        toast({ title: error.message || "Failed to delete document", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    const downloadDocument = (doc: Document) => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents-and-images/${doc.file_path}`;
      window.open(url, "_blank");
    };

    const openMoveModal = (doc: Document) => {
      setDocumentToMove(doc);
      setMoveForm({
        folder: doc.folder,
        milestone_id: doc.milestone_id || "",
        task_id: doc.task_id || "",
      });
      setShowMoveModal(true);
    };

    // Filter documents
    const filteredDocuments = documents.filter((doc) => {
      // Folder filter
      if (selectedFolder !== "all" && doc.folder !== selectedFolder) return false;
      
      // Search filter
      if (searchQuery && !doc.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      return true;
    });

    // Group by folder
    const documentsByFolder = folders.reduce((acc, folder) => {
      acc[folder.id] = filteredDocuments.filter((doc) => doc.folder === folder.id);
      return acc;
    }, {} as Record<string, Document[]>);

    return (
      <div className="space-y-4 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Project Documents</h3>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              {documents.length} document{documents.length !== 1 ? "s" : ""} • 
              {filteredDocuments.length} shown
            </p>
          </div>
          {canEdit && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl text-sm sm:text-base w-full sm:w-auto justify-center"
            >
              <Upload className="w-4 h-4 sm:w-5 sm:h-5" /> Upload Document
            </motion.button>
          )}
        </div>

        {/* Search & Filter Bar */}
        <GlassCard>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-10 pr-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Folder Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full sm:w-48 pl-10 pr-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
              >
                <option value="all" className="bg-background">All Folders</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id} className="bg-background">
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </GlassCard>

        {/* Empty State */}
        {documents.length === 0 ? (
          <GlassCard className="text-center py-16 sm:py-20">
            <FileText className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 text-primary/30" />
            <p className="text-base sm:text-xl text-muted-foreground mb-4 sm:mb-6">No documents uploaded yet</p>
            {canEdit && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="text-primary hover:text-primary/80 font-semibold text-base sm:text-lg"
              >
                Upload your first document
              </button>
            )}
          </GlassCard>
        ) : filteredDocuments.length === 0 ? (
          <GlassCard className="text-center py-12">
            <p className="text-base text-muted-foreground">No documents match your search</p>
          </GlassCard>
        ) : (
          /* Documents by Folder */
          <div className="space-y-6">
            {folders.map((folder) => {
              const folderDocs = documentsByFolder[folder.id];
              if (folderDocs.length === 0) return null;

              const FolderIcon = folder.icon;

              return (
                <div key={folder.id}>
                  {/* Folder Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 backdrop-blur-xl bg-primary/20 border border-primary/30 rounded-lg">
                      <FolderIcon className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="text-lg font-bold">{folder.name}</h4>
                    <span className="text-sm text-muted-foreground">({folderDocs.length})</span>
                  </div>

                  {/* Documents List */}
                  <div className="space-y-2">
                    {folderDocs.map((doc, idx) => {
                      const FileIcon = getFileIcon(doc.mime_type);

                      return (
                        <motion.div
                          key={doc.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          className="backdrop-blur-xl bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-all"
                        >
                          <div className="flex items-start gap-3 sm:gap-4">
                            {/* File Icon */}
                            <div className="p-2 sm:p-3 backdrop-blur-xl bg-primary/20 border border-primary/30 rounded-xl flex-shrink-0">
                              <FileIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                            </div>

                            {/* File Info */}
                            <div className="flex-1 min-w-0">
                              <h5 className="font-semibold text-sm sm:text-base break-words mb-1">{doc.name}</h5>
                              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  <span>{doc.uploaded_by_user?.full_name || "Unknown"}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{format(new Date(doc.uploaded_at), "dd MMM yyyy")}</span>
                                </div>
                                <span>{formatFileSize(doc.file_size)}</span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 flex-shrink-0">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => downloadDocument(doc)}
                                className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </motion.button>
                              {canEdit && (
                                <>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => openMoveModal(doc)}
                                    className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all"
                                    title="Move"
                                  >
                                    <Move className="w-4 h-4" />
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleDeleteDocument(doc)}
                                    disabled={loading}
                                    className="p-2 backdrop-blur-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-all text-red-400"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </motion.button>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
                className="w-full max-w-2xl backdrop-blur-xl bg-background/95 border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold">Upload Document</h3>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    disabled={loading}
                    className="p-2 hover:bg-white/10 rounded-lg transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* File Selection */}
                  {!selectedFile ? (
                    <label className="flex flex-col items-center justify-center gap-4 px-6 py-12 backdrop-blur-xl bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/20 hover:border-primary/50 rounded-xl cursor-pointer transition-all">
                      <FileText className="w-16 h-16 text-primary/50" />
                      <div className="text-center">
                        <p className="text-lg font-semibold mb-1">Click to select file</p>
                        <p className="text-sm text-muted-foreground">or drag and drop</p>
                      </div>
                      <input
                        type="file"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        disabled={loading}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{selectedFile.name}</p>
                            <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedFile(null)}
                          disabled={loading}
                          className="p-2 hover:bg-white/10 rounded-lg transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Folder Selection */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Folder *</label>
                    <select
                      value={uploadForm.folder}
                      onChange={(e) => setUploadForm({ ...uploadForm, folder: e.target.value })}
                      disabled={loading}
                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id} className="bg-background">
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Optional Links */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Link to Milestone (Optional)</label>
                      <select
                        value={uploadForm.milestone_id}
                        onChange={(e) => setUploadForm({ ...uploadForm, milestone_id: e.target.value })}
                        disabled={loading}
                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="" className="bg-background">None</option>
                        {milestoneList.map((milestone) => (
                          <option key={milestone.id} value={milestone.id} className="bg-background">
                            {milestone.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Link to Task (Optional)</label>
                      <select
                        value={uploadForm.task_id}
                        onChange={(e) => setUploadForm({ ...uploadForm, task_id: e.target.value })}
                        disabled={loading}
                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="" className="bg-background">None</option>
                        {taskList.map((task) => (
                          <option key={task.id} value={task.id} className="bg-background">
                            {task.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleUploadDocument}
                      disabled={loading || !selectedFile}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-xl transition-all"
                    >
                      {loading ? (
                        <>
                          <Upload className="w-4 h-4 animate-pulse" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload Document
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

        {/* Move Modal */}
        <AnimatePresence>
          {showMoveModal && documentToMove && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-2xl backdrop-blur-xl bg-background/95 border border-white/20 rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold">Move Document</h3>
                  <button
                    onClick={() => setShowMoveModal(false)}
                    disabled={loading}
                    className="p-2 hover:bg-white/10 rounded-lg transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl p-4 mb-4">
                    <p className="text-sm text-muted-foreground mb-1">Moving:</p>
                    <p className="font-semibold">{documentToMove.name}</p>
                  </div>

                  {/* Folder Selection */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Move to Folder</label>
                    <select
                      value={moveForm.folder}
                      onChange={(e) => setMoveForm({ ...moveForm, folder: e.target.value })}
                      disabled={loading}
                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id} className="bg-background">
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Optional Links */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Link to Milestone</label>
                      <select
                        value={moveForm.milestone_id}
                        onChange={(e) => setMoveForm({ ...moveForm, milestone_id: e.target.value })}
                        disabled={loading}
                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="" className="bg-background">None</option>
                        {milestoneList.map((milestone) => (
                          <option key={milestone.id} value={milestone.id} className="bg-background">
                            {milestone.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Link to Task</label>
                      <select
                        value={moveForm.task_id}
                        onChange={(e) => setMoveForm({ ...moveForm, task_id: e.target.value })}
                        disabled={loading}
                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="" className="bg-background">None</option>
                        {taskList.map((task) => (
                          <option key={task.id} value={task.id} className="bg-background">
                            {task.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleMoveDocument}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-xl transition-all"
                    >
                      {loading ? "Moving..." : (
                        <>
                          <Move className="w-4 h-4" />
                          Move Document
                        </>
                      )}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowMoveModal(false)}
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
      </div>
    );
  }