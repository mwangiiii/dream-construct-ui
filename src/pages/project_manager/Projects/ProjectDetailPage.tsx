// src/pages/projects/ProjectDetailPage.tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, AuthUser } from "@/lib/auth";
import { projectApi } from "@/lib/api/projectApi";
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
  X,
  Check,
  XCircle,
  AlertTriangle,
  Trash2,
  Archive,
  Shield,
  BarChart3,
  Layers,
  ClipboardList,
  Package,
  Award,
} from "lucide-react";
import DailyProgress from "@/components/projects/tabs/DailyProgress";
import Inspections from "@/components/projects/tabs/inpections";
import MaterialTracking from "@/components/projects/tabs/MaterialTracking";
import ProblemsAndIssues from "@/components/projects/tabs/ProblemsandIssues";
import Financials from "@/components/projects/tabs/financials";
import Stages from "@/components/projects/tabs/Stages";
import OverviewTab from "@/components/projects/tabs/OverviewTab";
import MilestonesTab from "@/components/projects/tabs/MilestonesTab";
import TasksTab from "@/components/projects/tabs/TasksTab";
import UpdatesTab from "@/components/projects/tabs/UpdatesTab";
import PhotosTab from "@/components/projects/tabs/PhotosTab";
import DocumentsTab from "@/components/projects/tabs/DocumentsTab";
import WorkersTab from "@/components/projects/tabs/WorkersTab";

// Add this at the very top of the file, outside the component
console.log('[ProjectDetailPage] MODULE LOADED');

type Tab =
  | "overview"
  | "milestones"
  | "tasks"
  | "updates"
  | "approvals"
  | "documents"
  | "photos"
  | "workers"
  | "financials"
  | "daily-logs"
  | "stages"
  | "inspections"
  | "material-tracking"
  | "problems-issues";

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
  user_id: string;
  role_name: "admin" | "manager" | "project_manager" | "client" | "finance" | "surveyor";
  user: {
    id: string;
    full_name: string;
    user_statuses: {
      is_active: boolean;
      status_name: string;
    } | null;
  } | null;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
}

const ToastNotification: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
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
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

export default function ProjectDetailPage() {
  console.log('[ProjectDetailPage] COMPONENT FUNCTION CALLED');
  
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  console.log('[ProjectDetailPage] HOOKS INITIALIZED', { id, hasNavigate: !!navigate });
  
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeUpdates, setActiveUpdates] = useState<Update[]>([]);
  const [deletedUpdates, setDeletedUpdates] = useState<Update[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [photos, setPhotos] = useState<Document[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);

  console.log('[ProjectDetailPage] STATE INITIALIZED');

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Helper to enrich items with user full_names
  const enrichWithUsers = async (items: any[], userField: string, enrichField: string) => {
    if (!items || items.length === 0) return items;
    const userIds = [...new Set(items.map(item => item[userField]).filter(Boolean))];
    if (userIds.length === 0) return items;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (!profiles) return items;

    const profilesMap = profiles.reduce((acc: Record<string, { full_name: string }>, p: any) => {
      acc[p.id] = { full_name: p.full_name };
      return acc;
    }, {});

    return items.map((item: any) => ({
      ...item,
      [enrichField]: item[userField] ? profilesMap[item[userField]] : null,
    }));
  };

  const fetchProjectAndData = async () => {
    console.log('[ProjectDetailPage] fetchProjectAndData called', { id });
    if (!id) {
      console.log('[ProjectDetailPage] No ID provided to fetchProjectAndData');
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      console.log('[ProjectDetailPage] fetchProjectAndData: starting manual fetches');
      
      // Fallback: Manual fetches only
      let teamDataRaw: any[] = [];
      try {
        const { data: teamRaw } = await supabase
          .from("workers")
          .select("user_id")
          .eq("project_id", id);
        teamDataRaw = teamRaw || [];
      } catch (teamErr) {
        console.warn("[ProjectDetail] project_team table not found or empty - skipping team fetch:", teamErr);
        teamDataRaw = [];
      }

      const teamUserIds = teamDataRaw.map((row: any) => row.user_id);
      let teamData: any[] = [];
      if (teamUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, phone, user_roles(role_name), user_statuses(status_name)")
          .in("id", teamUserIds);
        teamData = profiles || [];
      }

      const [
        { data: proj },
        { data: tasksData },
        { data: m },
        { data: a },
        { data: docsRaw },
      ] = await Promise.all([
        supabase
          .from("projects")
          .select(`
            *,
            client:profiles!projects_client_id_fkey(id, full_name, company_id, companies(name)),
            manager:profiles!projects_manager_id_fkey(id, full_name)
          `)
          .eq("id", id)
          .single(),
        supabase
          .from("tasks")
          .select("*")
          .eq("project_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("project_milestones").select("*").eq("project_id", id).order("sort_order"),
        supabase.from("project_approvals").select("*").eq("project_id", id).order("requested_at", { ascending: false }),
        supabase
          .from("documents")
          .select("*")
          .eq("project_id", id)
          .neq("folder", "progress_photos")
          .order("uploaded_at", { ascending: false }),
      ]);

      if (!proj) throw new Error("Project not found");

      // Set core data
      setProject(proj);
      setMilestones(m || []);
      const tasksEnriched = await enrichWithUsers(tasksData || [], "assigned_to", "assigned_user");
      setTasks(tasksEnriched);
      const approvalsEnriched = await enrichWithUsers(
        a || [],
        "requested_by",
        "requested_by_user"
      ).then((enriched) =>
        enrichWithUsers(enriched as any[], "approved_by", "approved_by_user")
      );
      setApprovals(approvalsEnriched);
      const documentsEnriched = await enrichWithUsers(docsRaw || [], "uploaded_by", "uploaded_by_user");
      setDocuments(documentsEnriched);

      // Format team for prop compatibility
      const formattedTeam = (teamData || []).map((item: any) => ({
        id: item.id,
        full_name: item.full_name,
        status_name: item.user_statuses?.status_name || "",
        is_active: item.user_statuses?.is_active ?? true,
        role_name: item.user_roles?.[0]?.role_name || "member",
        user: {
          id: item.id,
          full_name: item.full_name,
          user_statuses: item.user_statuses || null,
        },
      }));
      setTeam(formattedTeam);

      console.log('[ProjectDetailPage] fetchProjectAndData: set state', {
        proj,
        milestones: m,
        tasks: tasksEnriched,
        approvals: approvalsEnriched,
        documents: documentsEnriched,
        team: formattedTeam,
      });

      // Photos: Try edge function, fallback to direct
      let allPhotos: Document[] = [];
      try {
        const photosData = await projectApi.getProjectDocuments(id);
        allPhotos = photosData || [];
      } catch (photosErr) {
        console.warn("Photos API failed, using direct query:", photosErr);
        const { data: fallback } = await supabase
          .from("documents")
          .select("*")
          .eq("project_id", id)
          .eq("folder", "photos");
        allPhotos = fallback || [];
      }
      const photosEnriched = await enrichWithUsers(allPhotos, "uploaded_by", "uploaded_by_user");
      setPhotos(photosEnriched);
      console.log('[ProjectDetailPage] fetchProjectAndData: set photos', { photos: photosEnriched });

      // Updates: Manual (not in API yet)
      const { data: activeUpdatesData } = await supabase
        .from("project_updates")
        .select("id, title, body, update_type, posted_at, posted_by, is_pinned, media_paths, is_deleted, deleted_at, deleted_by, updated_at")
        .eq("project_id", id)
        .eq("is_deleted", false)
        .order("posted_at", { ascending: false });

      const isAdmin = currentUser?.roles.some((r: any) => r.role_name === "admin");
      let deletedUpdatesData = null;

      if (isAdmin) {
        const { data: deleted } = await supabase
          .from("project_updates")
          .select("id, title, body, update_type, posted_at, posted_by, is_pinned, media_paths, is_deleted, deleted_at, deleted_by, updated_at")
          .eq("project_id", id)
          .eq("is_deleted", true)
          .order("deleted_at", { ascending: false });
        deletedUpdatesData = deleted;
      }

      const activeUpdatesEnriched = await enrichWithUsers(activeUpdatesData || [], "posted_by", "posted_by_user");
      setActiveUpdates(activeUpdatesEnriched);
      let deletedUpdatesEnriched: any[] = [];
      if (deletedUpdatesData) {
        deletedUpdatesEnriched = await enrichWithUsers(
          await enrichWithUsers(deletedUpdatesData, "posted_by", "posted_by_user"),
          "deleted_by",
          "deleted_by_user"
        );
      }
      setDeletedUpdates(deletedUpdatesEnriched);

      console.log('[ProjectDetailPage] fetchProjectAndData: set updates', {
        activeUpdates: activeUpdatesEnriched,
        deletedUpdates: deletedUpdatesEnriched,
      });

      console.log('[ProjectDetailPage] Data loaded successfully');

    } catch (error) {
      console.error('[ProjectDetailPage] Final error in fetch:', error);
      showToast('Error loading project data', 'error');
      setTimeout(() => navigate('/projects'), 2000);
    } finally {
      setLoading(false);
    }
  };

  console.log('[ProjectDetailPage] ABOUT TO REGISTER useEffect');

  // CONSOLIDATED INITIALIZATION - Single useEffect
  useEffect(() => {
    console.log('[ProjectDetailPage] ============ useEffect FIRED ============', { id });
    let mounted = true;

    const initializePage = async () => {
      console.log('[ProjectDetailPage] initializePage started', { id });
      
      if (!id) {
        console.log('[ProjectDetailPage] No ID, redirecting');
        navigate("/projects");
        return;
      }

      try {
        setLoading(true);
        
        // Step 1: Get current user
        console.log('[ProjectDetailPage] Step 1: Getting current user');
        const user = await getCurrentUser();
        
        if (!mounted) {
          console.log('[ProjectDetailPage] Component unmounted, aborting');
          return;
        }
        
        if (!user) {
          console.log('[ProjectDetailPage] No user, redirecting to login');
          navigate("/login");
          return;
        }

        if (!user.status.is_active) {
          console.log('[ProjectDetailPage] User inactive');
          showToast("Your account is not active. Contact admin.", "error");
          setTimeout(() => navigate("/"), 2000);
          return;
        }

        console.log('[ProjectDetailPage] User loaded:', user.email);
        setCurrentUser(user);

        // Step 2: Check role permissions
        console.log('[ProjectDetailPage] Step 2: Checking roles');
        const hasProjectManagerRole = user.roles.some(
          (r: any) => r.role_name === "project_manager" || r.role_name === "admin" || r.role_name === "manager"
        );

        if (!hasProjectManagerRole) {
          console.log('[ProjectDetailPage] User lacks required role');
          showToast("You do not have permission to access this project.", "error");
          setTimeout(() => navigate("/projects"), 2000);
          return;
        }

        // Step 3: Fetch project basic info for authorization
        console.log('[ProjectDetailPage] Step 3: Fetching project for auth check');
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("id, manager_id, client_id")
          .eq("id", id)
          .single();

        if (!mounted) {
          console.log('[ProjectDetailPage] Component unmounted after project fetch, aborting');
          return;
        }

        if (projectError || !projectData) {
          console.error("[ProjectDetailPage] Project not found:", projectError);
          showToast("Project not found.", "error");
          setTimeout(() => navigate("/projects"), 2000);
          return;
        }

        // Step 4: Verify user authorization for this specific project
        console.log('[ProjectDetailPage] Step 4: Verifying project access');
        const isAdmin = user.roles.some((r: any) => r.role_name === "admin");
        const isGeneralManager = user.roles.some((r: any) => r.role_name === "manager");
        const isAssignedProjectManager = projectData.manager_id === user.profile?.id;
        const isClient = user.roles.some((r: any) => r.role_name === "client");
        const isProjectClient = isClient && projectData.client_id === user.profile?.id;

        console.log('[ProjectDetailPage] Authorization check:', {
          isAdmin,
          isGeneralManager,
          isAssignedProjectManager,
          isClient,
          isProjectClient,
          projectManagerId: projectData.manager_id,
          userId: user.profile?.id,
        });

        if (!isAdmin && !isGeneralManager && !isAssignedProjectManager && !isProjectClient) {
          console.log('[ProjectDetailPage] User not authorized for this project');
          showToast("You are not authorized to view this project.", "error");
          setTimeout(() => navigate("/projects"), 2000);
          return;
        }

        // Step 5: Fetch all project data
        console.log('[ProjectDetailPage] Step 5: Fetching all project data');
        await fetchProjectAndData();

        console.log('[ProjectDetailPage] Initialization complete');

      } catch (error) {
        console.error("[ProjectDetailPage] Initialization error:", error);
        if (mounted) {
          showToast("Error loading project.", "error");
          setTimeout(() => navigate("/projects"), 2000);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializePage();

    return () => {
      console.log('[ProjectDetailPage] useEffect cleanup called');
      mounted = false;
    };
  }, [id]);

  console.log('[ProjectDetailPage] useEffect REGISTERED');

  const isClient = currentUser?.roles.some((r: any) => r.role_name === "client");
  const isAdmin = currentUser?.roles.some((r: any) => r.role_name === "admin");

  const canEdit =
    currentUser?.roles.some((r: any) => ["admin", "manager", "project_manager"].includes(r.role_name)) ||
    (currentUser?.roles.some((r: any) => r.role_name === "project_manager") &&
      project?.manager_id === currentUser?.profile?.id);

  const allTabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "milestones", label: "Milestones", icon: Calendar },
    { id: "tasks", label: "Tasks", icon: CheckCircle2 },
    { id: "workers", label: "Workers", icon: Users },
    { id: "updates", label: "Updates", icon: MessageSquare },
    { id: "photos", label: "Site Photos", icon: Camera },
    { id: "documents", label: "Documents", icon: FileText },
    
    { id: "financials", label: "Financials", icon: DollarSign },
    { id: "daily-logs", label: "Daily Progress", icon: BarChart3 },
    { id: "stages", label: "Stages", icon: Layers },
    { id: "inspections", label: "Inspections", icon: ClipboardList },
    { id: "material-tracking", label: "Material Tracking", icon: Package },
    { id: "problems-issues", label: "Problems & Issues", icon: AlertTriangle },
  ];

  const clientTabs: Tab[] = ["overview", "milestones", "tasks", "updates", "photos", "documents"];
  const tabs = isClient ? allTabs.filter((tab) => clientTabs.includes(tab.id)) : allTabs;

  console.log('[ProjectDetailPage] ABOUT TO RENDER', { loading, project: !!project });

  if (loading) {
    console.log('[ProjectDetailPage] RENDERING LOADING STATE');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4 sm:mb-6"></div>
          <div className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Loading project...
          </div>
        </motion.div>
      </div>
    );
  }

  if (!project) {
    console.log('[ProjectDetailPage] RENDERING NOT FOUND STATE');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <AlertCircle className="w-16 h-16 sm:w-20 sm:h-20 text-red-500 mx-auto mb-4 sm:mb-6" />
          <div className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Project Not Found</div>
        </motion.div>
      </div>
    );
  }

  console.log('[ProjectDetailPage] RENDERING MAIN CONTENT');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border-b border-white/10">
        <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-12">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-6 sm:mb-8">
              <div className="flex items-start gap-3 sm:gap-4 w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.05, x: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/projects")}
                  className="backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 p-2 sm:p-3 rounded-xl transition-all flex-shrink-0"
                >
                  <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </motion.button>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3 truncate">{project.name}</h1>
                  <div className="flex flex-col gap-2 text-sm sm:text-base text-muted-foreground">
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
                  onClick={() => showToast("Edit project functionality coming soon!", "warning")}
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
          <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            {activeTab === "overview" && (
              <OverviewTab
                project={project}
                milestones={milestones}
                tasks={tasks}
                updates={activeUpdates}
                documents={documents}
                canEdit={canEdit}
                isClient={isClient}
                onProjectUpdate={fetchProjectAndData}
              />
            )}

            {activeTab === "milestones" && (
              <MilestonesTab projectId={id!} milestones={milestones} canEdit={canEdit} onUpdate={fetchProjectAndData} />
            )}

            {activeTab === "tasks" && (
              <TasksTab
                projectId={id!}
                tasks={tasks}
                milestones={milestones}
                teamMembers={team}
                canEdit={canEdit}
                onUpdate={fetchProjectAndData}
              />
            )}

             {activeTab === "workers" && (
              <WorkersTab
                projectId={id!}
                canEdit={canEdit}
                onUpdate={fetchProjectAndData}
              />
            )}

            {activeTab === "updates" && (
              <UpdatesTab 
                projectId={id!} 
                updates={activeUpdates}
                deletedUpdates={deletedUpdates}
                canEdit={canEdit} 
                currentUserId={currentUser?.profile?.id}
                isAdmin={isAdmin}
                onUpdate={fetchProjectAndData} 
              />
            )}

            {activeTab === "photos" && (
              <PhotosTab
                projectId={project.id}
                photos={photos}
                milestones={milestones}
                canEdit={canEdit}
                onUpdate={fetchProjectAndData}
              />
            )}

            {activeTab === "documents" && (
              <DocumentsTab projectId={id!} documents={documents} canEdit={canEdit} onUpdate={fetchProjectAndData} />
            )}

            {/* {activeTab === "workers" && (
              <WorkersTab
                projectId={id!}
                canEdit={canEdit}
                onUpdate={fetchProjectAndData}
              />
            )} */}

            {activeTab === "daily-logs" && (
              <DailyProgress projectId={id!} />
            )}

            {activeTab === "stages" && (
              <Stages projectId={project?.id} />
            )}

            {activeTab === "inspections" && (
              <Inspections projectId={id!} />
            )}

            {activeTab === "material-tracking" && (
              <MaterialTracking projectId={id!} />
            )}

            {activeTab === "problems-issues" && (
              <ProblemsAndIssues projectId={id!} />
            )}

            {activeTab === "financials" && (
              <Financials projectId={id!} />
            )}

            {!isClient && ["team"].includes(activeTab) && (
              <GlassCard className="text-center py-16 sm:py-20">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 backdrop-blur-xl bg-primary/20 border border-primary/30 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                    <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3">Coming Soon</h3>
                  <p className="text-base sm:text-lg text-muted-foreground">This section is currently under development</p>
                </motion.div>
              </GlassCard>
            )} 
          </motion.div>
        </AnimatePresence>
      </div>

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

console.log('[ProjectDetailPage] MODULE END');