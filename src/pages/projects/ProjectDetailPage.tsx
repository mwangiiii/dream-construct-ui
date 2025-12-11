// src/pages/projects/ProjectDetailPage.tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, AuthUser } from "@/lib/auth";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  MapPin,
  User,
  Building2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Edit,
  Upload,
  MessageSquare,
  Gavel,
  Camera,
  Users,
  FileText,
  Wrench,
  Home,
  Download,
  Plus,
} from "lucide-react";
import OverviewTab from "@/components/projects/tabs/OverviewTab";
import MilestonesTab from "@/components/projects/tabs/MilestonesTab";

type Tab =
  | "overview"
  | "milestones"
  | "tasks"
  | "updates"
  | "approvals"
  | "documents"
  | "team"
  | "financials"
  | "daily-logs"
  | "photos";

interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  progress_percent: number;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  milestone_id: string | null;
  completed_at: string | null;
  assigned_user?: { full_name: string } | null;
}

interface Update {
  id: string;
  title: string;
  body: string; // Fixed: was 'content', now matches DB
  update_type: string;
  posted_at: string;
  posted_by: string;
  is_pinned: boolean;
  posted_by_user?: { full_name: string } | null;
}

interface Approval {
  id: string;
  approval_type: string;
  status: string;
  title: string;
  description: string | null;
  requested_by: string;
  approved_by: string | null;
  requested_at: string;
  approved_at: string | null;
  amount: number | null;
  days_requested: number | null;
  rejection_reason: string | null;
  requested_by_user?: { full_name: string } | null;
  approved_by_user?: { full_name: string } | null;
}

interface Document {
  id: string;
  name: string;
  file_path: string;
  folder: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
  uploaded_by: string;
  project_id: string | null;
  milestone_id: string | null;
  task_id: string | null;
  uploaded_by_user?: { full_name: string } | null;
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  user?: {
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
}

// Glass Card Component
const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // Sub-data
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [photos, setPhotos] = useState<Document[]>([]);

  useEffect(() => {
    initializeUser();
  }, []);

  useEffect(() => {
    if (currentUser && id) {
      fetchProjectAndData();
    }
  }, [id, currentUser]);

  const initializeUser = async () => {
    try {
      console.log("[ProjectDetail] Fetching current user...");
      const user = await getCurrentUser();
      
      if (!user) {
        console.error("[ProjectDetail] No user found, redirecting to login");
        navigate("/login");
        return;
      }

      if (!user.status.is_active) {
        alert("Your account is not active. Contact admin.");
        navigate("/");
        return;
      }

      console.log("[ProjectDetail] User loaded:", user.email);
      setCurrentUser(user);
    } catch (error) {
      console.error("[ProjectDetail] Error initializing user:", error);
      navigate("/login");
    }
  };

  const fetchProjectAndData = async () => {
    if (!id) return;
    
    setLoading(true);
    console.log("[ProjectDetail] Fetching project:", id);

    try {
      // Fetch project
      const { data: proj, error: projError } = await supabase
        .from("projects")
        .select(`
          *,
          client:profiles!projects_client_id_fkey(id, full_name, company_id, companies(name)),
          manager:profiles!projects_manager_id_fkey(id, full_name)
        `)
        .eq("id", id)
        .single();

      if (projError || !proj) {
        console.error("[ProjectDetail] Project not found:", projError);
        alert("Project not found");
        navigate("/projects");
        return;
      }

      console.log("[ProjectDetail] Project loaded:", proj.project_number);
      setProject(proj);

      // Parallel fetch all related data
      const [
        { data: m },
        { data: t },
        { data: u },
        { data: a },
        { data: d },
        { data: p },
      ] = await Promise.all([
        supabase
          .from("project_milestones")
          .select("*")
          .eq("project_id", id)
          .order("sort_order"),
        supabase
          .from("tasks")
          .select("*, assigned_user:profiles!tasks_assigned_to_fkey(full_name)")
          .eq("project_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("project_updates")
          .select("*, posted_by_user:profiles!project_updates_posted_by_fkey(full_name)")
          .eq("project_id", id)
          .order("posted_at", { ascending: false }),
        supabase
          .from("project_approvals")
          .select(`
            *,
            requested_by_user:profiles!project_approvals_requested_by_fkey(full_name),
            approved_by_user:profiles!project_approvals_approved_by_fkey(full_name)
          `)
          .eq("project_id", id)
          .order("requested_at", { ascending: false }),
        supabase
          .from("documents")
          .select("*, uploaded_by_user:profiles!documents_uploaded_by_fkey(full_name)")
          .eq("project_id", id)
          .neq("folder", "progress_photos")
          .order("uploaded_at", { ascending: false }),
        supabase
          .from("documents")
          .select("*")
          .eq("project_id", id)
          .eq("folder", "progress_photos")
          .order("uploaded_at", { ascending: false }),
      ]);

      setMilestones(m || []);
      setTasks(t || []);
      setUpdates(u || []);
      setApprovals(a || []);
      setDocuments(d || []);
      setPhotos(p || []);

      console.log("[ProjectDetail] All data loaded successfully");
    } catch (error) {
      console.error("[ProjectDetail] Error fetching data:", error);
      alert("Error loading project data");
    } finally {
      setLoading(false);
    }
  };

  // Check if user is a client
  const isClient = currentUser?.roles.some(r => r.role_name === "client");

  // Check if user can edit (admin, manager, or assigned project manager)
  const canEdit =
    currentUser?.roles.some(r => ["admin", "manager"].includes(r.role_name)) ||
    (currentUser?.roles.some(r => r.role_name === "project_manager") &&
      project?.manager_id === currentUser?.profile?.id);

  // Define tabs based on user role
  const allTabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "milestones", label: "Milestones", icon: Calendar },
    { id: "tasks", label: "Tasks", icon: CheckCircle2 },
    { id: "updates", label: "Updates", icon: MessageSquare },
    { id: "photos", label: "Site Photos", icon: Camera },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "approvals", label: "Approvals", icon: Gavel },
    { id: "team", label: "Team", icon: Users },
    { id: "financials", label: "Financials", icon: DollarSign },
    { id: "daily-logs", label: "Daily Logs", icon: Wrench },
  ];

  // Client sees limited tabs
  const clientTabs: Tab[] = ["overview", "milestones", "updates", "photos", "documents"];
  
  // Filter tabs based on role
  const tabs = isClient 
    ? allTabs.filter(tab => clientTabs.includes(tab.id))
    : allTabs;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4 sm:mb-6"></div>
          <div className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Loading project...
          </div>
        </motion.div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <AlertCircle className="w-16 h-16 sm:w-20 sm:h-20 text-red-500 mx-auto mb-4 sm:mb-6" />
          <div className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Project Not Found</div>
          <button
            onClick={() => navigate(isClient ? "/client/projects" : "/admin/projects")}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all text-sm sm:text-base"
          >
            Return to Projects
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5" />
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
        </div>
        
        <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-6 sm:mb-8">
              <div className="flex items-start gap-3 sm:gap-4 w-full sm:w-auto">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 sm:p-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all flex-shrink-0"
                >
                  <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mb-2 sm:mb-3">
                    <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold truncate">{project.title}</h1>
                    <span className="px-3 py-1 sm:px-4 sm:py-2 backdrop-blur-xl bg-primary/20 border border-primary/30 text-primary text-xs sm:text-sm font-semibold rounded-xl whitespace-nowrap flex-shrink-0">
                      {project.project_number}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-6 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                      <span className="text-xs sm:text-base truncate">{project.site_address || "Site address not set"}</span>
                    </div>
                    {!isClient && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                        <span className="text-xs sm:text-base truncate">Client: {project.client?.companies?.name || project.client?.full_name || "Unknown"}</span>
                      </div>
                    )}
                    {project.manager && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                        <span className="text-xs sm:text-base truncate">PM: {project.manager.full_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {canEdit && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    // TODO: Navigate to project edit page
                    alert("Edit project functionality coming soon!");
                  }}
                  className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all text-sm sm:text-base w-full sm:w-auto justify-center"
                >
                  <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                  Edit Project
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* Tab Navigation */}
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-1.5 sm:p-2">
            <div className="flex overflow-x-auto gap-1 scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab.id
                        ? "bg-primary text-background shadow-lg"
                        : "hover:bg-white/10"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">{tab.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Overview Tab - Now using separate component */}
            {activeTab === "overview" && (
              <OverviewTab
                project={project}
                milestones={milestones}
                tasks={tasks}
                updates={updates}
                documents={documents}
                canEdit={canEdit}
                isClient={isClient}
                onProjectUpdate={fetchProjectAndData}
              />
            )}

            {/* Milestones Tab */}
            {activeTab === "milestones" && (
              <MilestonesTab
                projectId={id!}
                milestones={milestones}
                canEdit={canEdit}
                onUpdate={fetchProjectAndData}
              />
            )}

            {/* Tasks Tab - Admin only, inline for now */}
            {activeTab === "tasks" && !isClient && (
              <GlassCard>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg md:text-2xl font-bold">Tasks ({tasks.length})</h3>
                  {canEdit && (
                    <button 
                      onClick={() => alert("Create task modal coming soon!")}
                      className="text-primary hover:text-primary/80 flex items-center gap-2 font-semibold text-sm sm:text-base"
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Add Task
                    </button>
                  )}
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {tasks.length === 0 ? (
                    <div className="py-12 sm:py-16 text-center text-muted-foreground">
                      <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 text-primary/30 mx-auto mb-4 sm:mb-6" />
                      <p className="text-base sm:text-xl">No tasks assigned yet</p>
                    </div>
                  ) : (
                    tasks.map((task, idx) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="backdrop-blur-xl bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 sm:p-5 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                          <div className="flex items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                            <input
                              type="checkbox"
                              checked={task.status === "done"}
                              readOnly
                              className="w-5 h-5 sm:w-6 sm:h-6 rounded accent-primary mt-0.5 sm:mt-0 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm sm:text-base md:text-lg break-words">{task.title}</h4>
                              {task.assigned_user && (
                                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                  Assigned to {task.assigned_user.full_name}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground pl-8 sm:pl-0">
                            {task.due_date && `Due ${format(new Date(task.due_date), "dd MMM yyyy")}`}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </GlassCard>
            )}

            {/* Updates Tab - Inline for now */}
            {activeTab === "updates" && (
              <div className="space-y-4 sm:space-y-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Project Updates</h3>
                  {canEdit && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => alert("Post update modal coming soon!")}
                      className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl text-sm sm:text-base w-full sm:w-auto justify-center"
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Post Update
                    </motion.button>
                  )}
                </div>
                {updates.length === 0 ? (
                  <GlassCard className="text-center py-12 sm:py-16">
                    <MessageSquare className="w-16 h-16 sm:w-20 sm:h-20 text-primary/30 mx-auto mb-4 sm:mb-6" />
                    <p className="text-base sm:text-xl text-muted-foreground">No updates posted yet</p>
                  </GlassCard>
                ) : (
                  updates.map((update, idx) => (
                    <motion.div
                      key={update.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <GlassCard>
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-base sm:text-lg md:text-2xl font-bold mb-1 sm:mb-2 break-words">{update.title}</h4>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              Posted by {update.posted_by_user?.full_name || "Unknown"} •{" "}
                              {format(new Date(update.posted_at), "dd MMM yyyy, HH:mm")}
                            </p>
                          </div>
                          {update.is_pinned && (
                            <span className="px-3 py-1 bg-accent/20 text-accent border border-accent/30 rounded-lg text-xs font-semibold">
                              Pinned
                            </span>
                          )}
                        </div>
                        <p className="text-sm sm:text-base leading-relaxed text-muted-foreground break-words">{update.body}</p>
                      </GlassCard>
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {/* Photos Tab - Inline for now */}
            {activeTab === "photos" && (
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
                  <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Site Progress Photos</h3>
                  {canEdit && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => alert("Bulk photo upload modal coming soon!")}
                      className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl text-sm sm:text-base w-full sm:w-auto justify-center"
                    >
                      <Upload className="w-4 h-4 sm:w-5 sm:h-5" /> Upload Photos
                    </motion.button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                  {photos.length === 0 ? (
                    <div className="col-span-full">
                      <GlassCard className="text-center py-16 sm:py-20">
                        <Camera className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 text-primary/30" />
                        <p className="text-base sm:text-xl text-muted-foreground">No photos uploaded yet</p>
                      </GlassCard>
                    </div>
                  ) : (
                    photos.map((photo, idx) => (
                      <motion.div
                        key={photo.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group relative backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl sm:rounded-2xl overflow-hidden hover:border-primary/50 transition-all"
                      >
                        <img
                          src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${photo.file_path}`}
                          alt={photo.name}
                          className="w-full h-32 sm:h-40 md:h-64 object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all flex items-end p-3 sm:p-5">
                          <div className="text-white w-full">
                            <p className="font-semibold text-xs sm:text-base mb-0 sm:mb-1 truncate">{photo.name}</p>
                            <p className="text-[10px] sm:text-xs text-white/80">{format(new Date(photo.uploaded_at), "dd MMM yyyy")}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Documents Tab - Inline for now */}
            {activeTab === "documents" && (
              <GlassCard>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg md:text-2xl font-bold">Documents ({documents.length})</h3>
                  {canEdit && (
                    <button 
                      onClick={() => alert("Upload document modal coming soon!")}
                      className="text-primary hover:text-primary/80 flex items-center gap-2 font-semibold text-sm sm:text-base"
                    >
                      <Upload className="w-4 h-4 sm:w-5 sm:h-5" /> Upload Document
                    </button>
                  )}
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {documents.length === 0 ? (
                    <div className="py-12 sm:py-16 text-center text-muted-foreground">
                      <FileText className="w-16 h-16 sm:w-20 sm:h-20 text-primary/30 mx-auto mb-4 sm:mb-6" />
                      <p className="text-base sm:text-xl">No documents uploaded yet</p>
                    </div>
                  ) : (
                    documents.map((doc, idx) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="backdrop-blur-xl bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 sm:p-5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0"
                      >
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                          <div className="p-2 sm:p-3 backdrop-blur-xl bg-primary/20 border border-primary/30 rounded-xl flex-shrink-0">
                            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm sm:text-base md:text-lg break-words">{doc.name}</h4>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                              Uploaded by {doc.uploaded_by_user?.full_name || "Unknown"} •{" "}
                              {format(new Date(doc.uploaded_at), "dd MMM yyyy")}
                            </p>
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/documents/${doc.file_path}`;
                            window.open(url, '_blank');
                          }}
                          className="text-primary hover:text-primary/80 p-2 self-end sm:self-auto"
                        >
                          <Download className="w-5 h-5 sm:w-6 sm:h-6" />
                        </motion.button>
                      </motion.div>
                    ))
                  )}
                </div>
              </GlassCard>
            )}

            {/* Approvals Tab - Admin only, placeholder */}
            {activeTab === "approvals" && !isClient && (
              <div className="space-y-4 sm:space-y-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Change Orders & Approvals</h3>
                  {canEdit && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => alert("Create change order modal coming soon!")}
                      className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl text-sm sm:text-base w-full sm:w-auto justify-center"
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> New Change Order
                    </motion.button>
                  )}
                </div>
                {approvals.length === 0 ? (
                  <GlassCard className="text-center py-12 sm:py-16">
                    <Gavel className="w-16 h-16 sm:w-20 sm:h-20 text-primary/30 mx-auto mb-4 sm:mb-6" />
                    <p className="text-base sm:text-xl text-muted-foreground">No approvals requested yet</p>
                  </GlassCard>
                ) : (
                  approvals.map((approval, idx) => (
                    <motion.div
                      key={approval.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <GlassCard>
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-4">
                          <div className="flex-1">
                            <h4 className="text-base sm:text-lg md:text-xl font-bold mb-2">{approval.title}</h4>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              {approval.approval_type.replace(/_/g, " ").toUpperCase()}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold backdrop-blur-xl border whitespace-nowrap ${
                              approval.status === "approved"
                                ? "bg-green-500/20 text-green-300 border-green-500/30"
                                : approval.status === "rejected"
                                ? "bg-red-500/20 text-red-300 border-red-500/30"
                                : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                            }`}
                          >
                            {approval.status}
                          </span>
                        </div>
                        {approval.description && (
                          <p className="text-sm text-muted-foreground mb-3">{approval.description}</p>
                        )}
                        <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-muted-foreground">
                          {approval.amount && (
                            <div>
                              <span className="font-semibold">Amount:</span> {approval.amount.toLocaleString()} {project.currency}
                            </div>
                          )}
                          {approval.days_requested && (
                            <div>
                              <span className="font-semibold">Days:</span> {approval.days_requested}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold">Requested by:</span> {approval.requested_by_user?.full_name || "Unknown"}
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {/* Placeholder for other admin-only tabs */}
            {!isClient && ["team", "financials", "daily-logs"].includes(activeTab) && (
              <GlassCard className="text-center py-16 sm:py-20">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 backdrop-blur-xl bg-primary/20 border border-primary/30 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                    <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3">Coming Soon</h3>
                  <p className="text-base sm:text-lg text-muted-foreground">
                    This section is currently under development
                  </p>
                </motion.div>
              </GlassCard>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}