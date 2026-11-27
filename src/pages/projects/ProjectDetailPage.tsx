// src/pages/projects/ProjectDetailPage.tsx
import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, AuthUser } from "@/lib/auth";
import { useDerivedProgress } from "@/lib/projectProgress";
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
  HardHat,
  Layers,
  ClipboardCheck,
  Package,
  MailQuestion,
  Eye,
} from "lucide-react";

import OverviewTab from "@/components/projects/tabs/OverviewTab";
import EnquiryTab from "@/components/projects/tabs/EnquiryTab";
import MilestonesTab from "@/components/projects/tabs/MilestonesTab";
// Inherited from the project_manager detail page — these tabs were already
// built and working there, and were showing "Coming Soon" (or missing
// entirely) for admin.
import WorkersTab from "@/components/projects/tabs/WorkersTab";
import DailyProgress from "@/components/projects/tabs/DailyProgress";
import Stages from "@/components/projects/tabs/Stages";
import InspectionsTab from "@/components/projects/tabs/InspectionsTab";
import MaterialTrackingTab from "@/components/projects/tabs/MaterialTracking";
import ProblemsAndIssues from "@/components/projects/tabs/ProblemsandIssues";
import TasksTab from "@/components/projects/tabs/TasksTab";
import UpdatesTab from "@/components/projects/tabs/UpdatesTab";
import PhotosTab from "@/components/projects/tabs/PhotosTab";
import DocumentsTab from "@/components/projects/tabs/DocumentsTab";
import Financials from "@/components/projects/tabs/financials";

// Kept in step with the project_manager detail page so admin sees the same
// project tooling a PM does. Project staffing lives in the Workers tab
// (workers + worker_assignments); there is no separate team concept.
type Tab =
  | "overview"
  | "milestones"
  | "tasks"
  | "workers"
  | "updates"
  | "approvals"
  | "documents"
  | "photos"
  | "daily-logs"
  | "stages"
  | "inspections"
  | "material-tracking"
  | "problems-issues"
  | "financials"
  | "enquiry";

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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Project progress. OverviewTab previously received no projectProgress prop
  // at all here, so the bar never populated. Tabs are conditionally rendered,
  // so MilestonesTab — which computes it — is only mounted while that tab is
  // open; deriving it here means Overview is correct on first load, and
  // onProgressChange still wins once the user edits tasks.
  const [liveProgress, setLiveProgress] = useState<number | null>(null);
  const derivedProgress = useDerivedProgress(id, null);
  const projectProgress = liveProgress ?? derivedProgress;

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

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

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
      const user = await getCurrentUser();
      if (!user) {
        navigate("/login");
        return;
      }
      if (!user.status.is_active) {
        showToast("Your account is not active. Contact admin.", "error");
        setTimeout(() => navigate("/"), 2000);
        return;
      }
      setCurrentUser(user);
    } catch {
      navigate("/login");
    }
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
    if (!id) return;
    setLoading(true);

    try {
      // Try centralized API first
      let details: any = null;
      try {
        details = await projectApi.fetchProjectDetails(id);
      } catch {
        // Fallback: Original manual fetches
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

        details = {
          project: proj,
          milestones: m || [],
          tasks: await enrichWithUsers(tasksData || [], "assigned_to", "assigned_user"),
          approvals: await enrichWithUsers(
            a || [],
            "requested_by",
            "requested_by_user"
          ).then((enriched) =>
            enrichWithUsers(enriched as any[], "approved_by", "approved_by_user")
          ),
          documents: await enrichWithUsers(docsRaw || [], "uploaded_by", "uploaded_by_user"),
        };
      }

      // Set core data from details (API or fallback)
      setProject(details.project);
      setMilestones(details.milestones);
      setTasks(details.tasks);
      setApprovals(details.approvals);
      setDocuments(details.documents);

      // Photos: Try edge function, fallback to direct
      let allPhotos: Document[] = [];
      try {
        const photosData = await projectApi.getProjectDocuments(id);
        allPhotos = photosData || [];
      } catch {
        const { data: fallback } = await supabase
          .from("documents")
          .select("*")
          .eq("project_id", id)
          .eq("folder", "photos");
        allPhotos = fallback || [];
      }
      setPhotos(await enrichWithUsers(allPhotos, "uploaded_by", "uploaded_by_user"));

      // Updates: Manual (not in API yet)

      // Always include media_paths explicitly in the select
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

      setActiveUpdates(await enrichWithUsers(activeUpdatesData || [], "posted_by", "posted_by_user"));
      setDeletedUpdates(
        deletedUpdatesData
          ? await enrichWithUsers(
              await enrichWithUsers(deletedUpdatesData, "posted_by", "posted_by_user"),
              "deleted_by",
              "deleted_by_user"
            )
          : []
      );

    } catch {
      showToast("Error loading project data", "error");
      // Ultra-fallback: Redirect
      setTimeout(() => navigate("/projects"), 2000);
    } finally {
      setLoading(false);
    }
  };

  const isClient = currentUser?.roles.some((r: any) => r.role_name === "client");
  const isAdmin = currentUser?.roles.some((r: any) => r.role_name === "admin");
  const isManager = currentUser?.roles.some((r: any) => r.role_name === "manager");
  const isProjectPM =
    currentUser?.roles.some((r: any) => r.role_name === "project_manager") &&
    project?.manager_id === currentUser?.profile?.id;

  // Admin viewing their own project console: the per-project tabs are read-only
  // (data is linked to what the PM fills in) and admin interacts via the
  // Enquiry tab. Managers and the project's own PM keep full edit rights.
  // Admin keeps `isAdmin` so the Overview Danger Zone (archive / deep archive
  // / permanent delete) stays available — those are lifecycle actions, not
  // day-to-day edits.
  const adminViewing = Boolean(isAdmin && !isManager && !isProjectPM);

  const canEdit =
    !adminViewing && (
      currentUser?.roles.some((r: any) => ["admin", "manager", "project_manager"].includes(r.role_name)) ||
      isProjectPM
    );

  const allTabs: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "milestones", label: "Milestones", icon: Calendar },
    { id: "tasks", label: "Tasks", icon: CheckCircle2 },
    { id: "updates", label: "Updates", icon: MessageSquare },
    { id: "photos", label: "Site Photos", icon: Camera },
    { id: "documents", label: "Documents", icon: FileText },
    // { id: "approvals", label: "Approvals", icon: Gavel },
    { id: "workers", label: "Workers", icon: HardHat },
    { id: "daily-logs", label: "Daily Logs", icon: Wrench },
    { id: "stages", label: "Stages", icon: Layers },
    { id: "inspections", label: "Inspections", icon: ClipboardCheck },
    { id: "material-tracking", label: "Materials", icon: Package },
    { id: "problems-issues", label: "Issues", icon: AlertTriangle },
    { id: "financials", label: "Financials", icon: DollarSign },
    // Admin-only — composes an email to the project's PM. Hidden from
    // clients and from non-admin internal roles.
    { id: "enquiry", label: "Enquiry", icon: MailQuestion },
  ];

  // Clients deliberately keep the narrower set — the tabs added above are
  // internal tooling (workers, materials, inspections, financials).
  const clientTabs: Tab[] = ["overview", "milestones", "tasks", "updates", "photos", "documents"];
  const tabs = isClient
    ? allTabs.filter((tab) => clientTabs.includes(tab.id))
    : allTabs.filter((tab) => (tab.id === "enquiry" ? adminViewing : true));

  if (loading) {
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 mb-6 sm:mb-8">
              <div className="flex items-start gap-3 sm:gap-4 w-full sm:w-auto">
                <button onClick={() => navigate(-1)} className="p-2 sm:p-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all flex-shrink-0">
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
                    {isAdmin ? (
                      <div className="flex w-full min-w-0 flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground">
                          <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                          <label htmlFor="project-manager">Project Manager</label>
                        </div>
                        {/* Read-only. Allocation happens in one place:
                            /admin/assignments. */}
                        <div className="flex items-center gap-2 text-xs sm:text-base">
                          <span className="truncate">
                            {project.manager?.full_name ?? (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </span>
                          <Link
                            to="/admin/assignments"
                            className="shrink-0 text-xs font-medium text-primary hover:underline"
                          >
                            Change
                          </Link>
                        </div>
                      </div>
                    ) : project.manager && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                        <span className="text-xs sm:text-base truncate">PM: {project.manager.full_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* {canEdit && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => showToast("Edit project functionality coming soon!", "warning")}
                  className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all text-sm sm:text-base w-full sm:w-auto justify-center"
                >
                  <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                  Edit Project
                </motion.button>
              )} */}
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
        {/* Admin read-only banner. Overview, Financials and Enquiry stay
            interactive — Overview exposes the Danger Zone, Financials isn't
            PM-operational, Enquiry is admin's own action. Everything else
            is for viewing only. */}
        {adminViewing && activeTab !== "overview" && activeTab !== "financials" && activeTab !== "enquiry" && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-xs text-primary">
            <Eye className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Admin view — this table is linked to the project manager's data and
              is read-only here. Use the <strong>Enquiry</strong> tab to send
              the PM a note.
            </span>
          </div>
        )}
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
                isAdmin={isAdmin}
                onProjectUpdate={fetchProjectAndData}
                projectProgress={projectProgress}
              />
            )}

            {activeTab === "milestones" && (
              <MilestonesTab projectId={id!} milestones={milestones} canEdit={canEdit}
                onUpdate={fetchProjectAndData} onProgressChange={setLiveProgress} />
            )}

            {activeTab === "tasks" && (
              <TasksTab
                projectId={id!}
                tasks={tasks}
                milestones={milestones}
                /* No `workers` prop: TasksTab does not use it, and assignment
                   is owned by the Workers tab. This previously passed
                   `teamMembers={team}` — a prop TasksTab has never had. */
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

            {activeTab === "workers" && (
              <WorkersTab projectId={id!} canEdit={canEdit} onUpdate={fetchProjectAndData} />
            )}

            {activeTab === "daily-logs" && (
              // DailyProgress doesn't accept a canEdit prop. Shield it when
              // admin is viewing so its internal edit controls are inert.
              // pointer-events-none keeps scrolling but blocks clicks.
              <div style={adminViewing ? { pointerEvents: "none", opacity: 0.92 } : undefined}>
                <DailyProgress projectId={id!} />
              </div>
            )}

            {activeTab === "stages" && (
              <div style={adminViewing ? { pointerEvents: "none", opacity: 0.92 } : undefined}>
                <Stages projectId={project?.id} />
              </div>
            )}

            {activeTab === "inspections" && (
              <InspectionsTab projectId={id!} milestones={milestones}
                canEdit={canEdit} onUpdate={fetchProjectAndData} />
            )}

            {activeTab === "material-tracking" && (
              <MaterialTrackingTab projectId={id!} milestones={milestones}
                canEdit={canEdit} onUpdate={fetchProjectAndData} />
            )}

            {activeTab === "problems-issues" && (
              <div style={adminViewing ? { pointerEvents: "none", opacity: 0.92 } : undefined}>
                <ProblemsAndIssues projectId={id!} />
              </div>
            )}

            {activeTab === "financials" && (
              <Financials projectId={id!} />
            )}

            {activeTab === "enquiry" && adminViewing && (
              <EnquiryTab
                projectId={id!}
                projectTitle={project?.title ?? "Untitled project"}
                projectNumber={project?.project_number ?? null}
                manager={project?.manager ?? null}
              />
            )}

            {activeTab === "approvals" && !isClient && (
              <div className="space-y-4 sm:space-y-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Change Orders & Approvals</h3>
                  {canEdit && (
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => showToast("Create change order modal coming soon!", "warning")}
                      className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl text-sm sm:text-base w-full sm:w-auto justify-center">
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> New Change Order
                    </motion.button>
                  )}
                </div>
              </div>
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