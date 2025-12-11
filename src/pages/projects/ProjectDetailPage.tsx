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
import TasksTab from "@/components/projects/tabs/TasksTab";
import UpdatesTab from "@/components/projects/tabs/UpdatesTab";
import PhotosTab from "@/components/projects/tabs/PhotosTab";
import DocumentsTab from "@/components/projects/tabs/DocumentsTab";

type Tab =
  | "overview"
  | "milestones"
  | "tasks"
  | "updates"
  | "approvals"
  | "documents"
  | "photos"
  | "team"
  | "financials"
  | "daily-logs";

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
  assigned_user?: { full_name: string; email?: string } | null;
}

interface Update {
  id: string;
  title: string;
  body: string;
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

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [photos, setPhotos] = useState<Document[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);

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
        alert("Your account is not active. Contact admin.");
        navigate("/");
        return;
      }
      setCurrentUser(user);
    } catch (error) {
      console.error("[ProjectDetail] Error initializing user:", error);
      navigate("/login");
    }
  };

  const fetchProjectAndData = async () => {
    if (!id) return;
    setLoading(true);

    try {
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
        alert("Project not found");
        navigate("/projects");
        return;
      }
      setProject(proj);

      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });

      if (tasksError) {
        console.error("[ProjectDetail] Tasks fetch error:", tasksError);
      }

      let tasksWithUsers: Task[] = [];
      if (tasksData && tasksData.length > 0) {
        const assignedIds = [...new Set(tasksData
          .map((t: any) => t.assigned_to)
          .filter(Boolean))];

        if (assignedIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", assignedIds);

          if (profilesError) {
            console.error("[ProjectDetail] Profiles fetch error:", profilesError);
          }

          if (profiles) {
            const profilesMap = profiles.reduce((acc: any, p: any) => {
              acc[p.id] = { full_name: p.full_name, email: p.email };
              return acc;
            }, {});

            tasksWithUsers = tasksData.map((task: any) => ({
              ...task,
              assigned_user: task.assigned_to ? profilesMap[task.assigned_to] : null,
            }));
          } else {
            tasksWithUsers = tasksData;
          }
        } else {
          tasksWithUsers = tasksData;
        }
      }

      console.log("[ProjectDetail] Tasks loaded:", tasksWithUsers.length);

      const [
        { data: m },
        { data: u },
        { data: a },
        { data: d },
        { data: p },
        { data: teamData },
      ] = await Promise.all([
        supabase.from("project_milestones").select("*").eq("project_id", id).order("sort_order"),
        supabase.from("project_updates").select("*").eq("project_id", id).order("posted_at", { ascending: false }),
        supabase.from("project_approvals").select("*").eq("project_id", id).order("requested_at", { ascending: false }),
        supabase.from("documents").select("*").eq("project_id", id).neq("folder", "progress_photos").order("uploaded_at", { ascending: false }),
        supabase.from("documents").select("*").eq("project_id", id).eq("folder", "progress_photos").order("uploaded_at", { ascending: false }),
        supabase
          .from("user_roles")
          .select(`
            user_id,
            role_name,
            user:profiles!user_id (
              id,
              full_name,
              user_statuses!status_id (is_active, status_name)
            )
          `)
          .in("role_name", ["manager", "project_manager", "finance", "surveyor", "admin", "client"])
      ]);

      let updatesWithUsers: Update[] = [];
      if (u && u.length > 0) {
        const postedByIds = [...new Set(u.map((update: any) => update.posted_by).filter(Boolean))];
        if (postedByIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", postedByIds);

          if (profiles) {
            const profilesMap = profiles.reduce((acc: any, p: any) => {
              acc[p.id] = { full_name: p.full_name };
              return acc;
            }, {});

            updatesWithUsers = u.map((update: any) => ({
              ...update,
              posted_by_user: update.posted_by ? profilesMap[update.posted_by] : null,
            }));
          }
        } else {
          updatesWithUsers = u;
        }
      }

      let approvalsWithUsers: Approval[] = [];
      if (a && a.length > 0) {
        const userIds = [...new Set([
          ...a.map((approval: any) => approval.requested_by),
          ...a.map((approval: any) => approval.approved_by).filter(Boolean)
        ])].filter(Boolean);

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds);

          if (profiles) {
            const profilesMap = profiles.reduce((acc: any, p: any) => {
              acc[p.id] = { full_name: p.full_name };
              return acc;
            }, {});

            approvalsWithUsers = a.map((approval: any) => ({
              ...approval,
              requested_by_user: approval.requested_by ? profilesMap[approval.requested_by] : null,
              approved_by_user: approval.approved_by ? profilesMap[approval.approved_by] : null,
            }));
          }
        } else {
          approvalsWithUsers = a;
        }
      }

      let documentsWithUsers: Document[] = [];
      if (d && d.length > 0) {
        const uploadedByIds = [...new Set(d.map((doc: any) => doc.uploaded_by).filter(Boolean))];
        if (uploadedByIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", uploadedByIds);

          if (profiles) {
            const profilesMap = profiles.reduce((acc: any, p: any) => {
              acc[p.id] = { full_name: p.full_name };
              return acc;
            }, {});

            documentsWithUsers = d.map((doc: any) => ({
              ...doc,
              uploaded_by_user: doc.uploaded_by ? profilesMap[doc.uploaded_by] : null,
            }));
          }
        } else {
          documentsWithUsers = d;
        }
      }

      setMilestones(m || []);
      setTasks(tasksWithUsers);
      setUpdates(updatesWithUsers);
      setApprovals(approvalsWithUsers);
      setDocuments(documentsWithUsers);
      setPhotos(p || []);

      const formattedTeam = (teamData || []).map((item: any) => ({
        id: item.user_id,
        full_name: item.user?.full_name || "Unknown",
        role_name: item.role_name,
        is_active: item.user?.user_statuses?.is_active ?? false,
        status_name: item.user?.user_statuses?.status_name || "unknown"
      }));
      setTeam(formattedTeam);

    } catch (error) {
      console.error("[ProjectDetail] Error fetching data:", error);
      alert("Error loading project data");
    } finally {
      setLoading(false);
    }
  };

  const isClient = currentUser?.roles.some(r => r.role_name === "client");

  const canEdit =
    currentUser?.roles.some(r => ["admin", "manager"].includes(r.role_name)) ||
    (currentUser?.roles.some(r => r.role_name === "project_manager") &&
      project?.manager_id === currentUser?.profile?.id);

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

  // Fixed: Clients can now see Tasks tab
  const clientTabs: Tab[] = ["overview", "milestones", "tasks", "updates", "photos", "documents"];
  const tabs = isClient ? allTabs.filter(tab => clientTabs.includes(tab.id)) : allTabs;

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
                  onClick={() => alert("Edit project functionality coming soon!")}
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
                updates={updates}
                documents={documents}
                canEdit={canEdit}
                isClient={isClient}
                onProjectUpdate={fetchProjectAndData}
              />
            )}

            {activeTab === "milestones" && (
              <MilestonesTab projectId={id!} milestones={milestones} canEdit={canEdit} onUpdate={fetchProjectAndData} />
            )}

            {/* Fixed: Tasks tab now renders for everyone (including clients) */}
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

            {activeTab === "updates" && (
              <UpdatesTab projectId={id!} updates={updates} canEdit={canEdit} onUpdate={fetchProjectAndData} />
            )}

            {activeTab === "photos" && (
              <PhotosTab projectId={id!} photos={photos} canEdit={canEdit} onUpdate={fetchProjectAndData} />
            )}

            {activeTab === "documents" && (
              <DocumentsTab projectId={id!} documents={documents} canEdit={canEdit} onUpdate={fetchProjectAndData} />
            )}

            {activeTab === "approvals" && !isClient && (
              <div className="space-y-4 sm:space-y-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Change Orders & Approvals</h3>
                  {canEdit && (
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => alert("Create change order modal coming soon!")}
                      className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl text-sm sm:text-base w-full sm:w-auto justify-center">
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> New Change Order
                    </motion.button>
                  )}
                </div>
              </div>
            )}

            {!isClient && ["team", "financials", "daily-logs"].includes(activeTab) && (
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
    </div>
  );
}