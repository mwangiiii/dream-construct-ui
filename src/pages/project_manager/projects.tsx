// src/components/dashboard/ProjectManagementDashboard.tsx
import { useState, useEffect, useMemo } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, AuthUser } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Filter,
  Calendar,
  DollarSign,
  Users,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  Building2,
  HardHat,
  UserCheck,
  ChevronRight,
  Home,
  Wrench,
  Archive,
  Eye,
  Edit,
  Trash2,
  Download,
  Upload,
  MessageSquare,
  Gavel,
  Camera,
  MapPin,
  TrendingUp,
  Activity,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import NewProjectModal from "@/components/projects/NewProjectModal";

type Role = "admin" | "manager" | "project_manager" | "client";
type ProjectStatus =
  | "planning"
  | "pre_construction"
  | "in_construction"
  | "inspections"
  | "completed"
  | "on_hold"
  | "cancelled";

interface Project {
  id: string;
  project_number: string;
  title: string;
  status: ProjectStatus;
  progress_percent: number;
  start_date: string | null;
  expected_completion_date: string | null;
  actual_completion_date: string | null;
  budget_numeric: number;
  currency: string;
  site_address: string;
  client: { id: string; full_name: string; company_name: string };
  manager: { id: string; full_name: string } | null;
  created_at: string;
}

export default function ProjectManagementDashboard() {
    const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    initializeUser();
  }, []);

  useEffect(() => {
    if (currentUser && userRole) {
      fetchProjects();
    }
  }, [currentUser, userRole]);

  const initializeUser = async () => {
    try {
      console.log("[Dashboard] Fetching current user...");
      const user = await getCurrentUser();
      
      if (!user) {
        console.error("[Dashboard] No user found");
        setLoading(false);
        return;
      }

      console.log("[Dashboard] User loaded:", user.email);

      if (!user.status.is_active) {
        alert("Your account is not active. Contact admin.");
        setLoading(false);
        return;
      }

      setCurrentUser(user);
      const primaryRole = user.roles[0]?.role_name || "client";
      setUserRole(primaryRole);
      
      console.log("[Dashboard] User role:", primaryRole);
    } catch (error) {
      console.error("[Dashboard] Error initializing user:", error);
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    if (!currentUser || !userRole) return;
    
    setLoading(true);
    console.log("[Dashboard] Fetching projects for role:", userRole);

    try {
      let query = supabase
        .from("projects")
        .select(`
          *,
          client:profiles!client_id(id, full_name, company_id, companies(name)),
          manager:profiles!manager_id(id, full_name)
        `)
        .order("created_at", { ascending: false });

      if (userRole === "client") {
        query = query.eq("client_id", currentUser.profile.id);
      } else if (userRole === "project_manager") {
        query = query.eq("manager_id", currentUser.profile.id);
      }

      // Hide archived projects from every dashboard EXCEPT the admin/manager
      // view — admins need discoverability to restore or permanently delete.
      if (userRole !== "admin" && userRole !== "manager") {
        query = query.is("archived_at", null);
      }

      const { data, error } = await query;

      if (error) {
        console.error("[Dashboard] Error fetching projects:", error);
        setLoading(false);
        return;
      }

      if (data) {
        const formatted = data.map((p: any) => ({
          ...p,
          client: {
            id: p.client?.id || "",
            full_name: p.client?.full_name || "Unknown",
            company_name: p.client?.companies?.name || "Private Client",
          },
          manager: p.manager ? { id: p.manager.id, full_name: p.manager.full_name } : null,
        }));
        
        console.log("[Dashboard] Loaded projects:", formatted.length);
        setProjects(formatted);
      }
    } catch (error) {
      console.error("[Dashboard] Error in fetchProjects:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.project_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.site_address?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, searchTerm, statusFilter]);

  const canCreateProject = ["admin", "manager"].includes(userRole || "");
  const canEditProject = (project: Project) =>
    ["admin", "manager"].includes(userRole || "") ||
    (userRole === "project_manager" && project.manager?.id === currentUser?.profile?.id);

  const getStatusColor = (status: ProjectStatus) => {
    const colors: Record<ProjectStatus, string> = {
      planning: "from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-200",
      pre_construction: "from-indigo-500/20 to-indigo-600/20 border-indigo-500/30 text-indigo-200",
      in_construction: "from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 text-yellow-200",
      inspections: "from-orange-500/20 to-orange-600/20 border-orange-500/30 text-orange-200",
      completed: "from-green-500/20 to-green-600/20 border-green-500/30 text-green-200",
      on_hold: "from-red-500/20 to-red-600/20 border-red-500/30 text-red-200",
      cancelled: "from-gray-500/20 to-gray-600/20 border-gray-500/30 text-gray-300",
    };
    return colors[status] || "from-gray-500/20 to-gray-600/20 border-gray-500/30 text-gray-300";
  };

  const getStatusIcon = (status: ProjectStatus) => {
    const icons: Record<ProjectStatus, any> = {
      planning: FileText,
      pre_construction: Wrench,
      in_construction: HardHat,
      inspections: CheckCircle2,
      completed: Building2,
      on_hold: AlertCircle,
      cancelled: Archive,
    };
    const Icon = icons[status] || FileText;
    return <Icon className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-background/95 via-background/98 to-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xl text-muted-foreground">Loading projects...</div>
        </motion.div>
      </div>
    );
  }

  if (!currentUser || !userRole) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-background/95 via-background/98 to-background">
        <GlassCard className="p-12 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <div className="text-xl font-semibold mb-2">Authentication Required</div>
          <p className="text-muted-foreground">Please log in to access the dashboard.</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background/95 via-background/98 to-background">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong border-b border-white/10"
      >
        <div className="px-2 sm:px-4 lg:px-8 py-6 sm:py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Project Management
              </h1>
              {/* <p className="text-muted-foreground text-lg">
                Manage all Dream Construct projects from inception to handover
              </p> */}
            </div>
            {canCreateProject && (
              <Button
                onClick={() => setIsModalOpen(true)}
                className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background font-semibold shadow-lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Project
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Filters & Search */}
      <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <div className="flex-[2] min-w-0 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              placeholder="Search projects by name, number, or site..."
              className="w-full pl-10 pr-4 py-3 glass border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex-[1] min-w-[180px] max-w-[260px]">
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
              <SelectTrigger className="w-full px-4 py-3 glass border border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all bg-gradient-to-br from-background/90 via-background/95 to-background/80 text-foreground font-semibold shadow-lg">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="bg-gradient-to-br from-background/95 via-background/98 to-background/90 text-foreground font-semibold shadow-xl border border-white/10">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="pre_construction">Pre-Construction</SelectItem>
                <SelectItem value="in_construction">In Construction</SelectItem>
                <SelectItem value="inspections">Inspections & Snagging</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-3 rounded-xl border transition-all ${
                viewMode === "grid"
                  ? "glass-strong border-primary/50 text-primary"
                  : "glass border-white/10 hover:border-white/20"
              }`}
            >
              <Layers className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-3 rounded-xl border transition-all ${
                viewMode === "list"
                  ? "glass-strong border-primary/50 text-primary"
                  : "glass border-white/10 hover:border-white/20"
              }`}
            >
              <Activity className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Projects Grid / List */}
      <div className="px-2 sm:px-4 lg:px-8 pb-20 sm:pb-32">
        {filteredProjects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <GlassCard className="p-12 max-w-md mx-auto">
              <Home className="w-20 h-20 text-primary/50 mx-auto mb-4" />
              <p className="text-xl font-semibold mb-2">No projects found</p>
              <p className="text-muted-foreground mb-6">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by creating your first project"}
              </p>
              {canCreateProject && (
                <Button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </Button>
              )}
            </GlassCard>
          </motion.div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredProjects.map((project, idx) => {
              const StatusIcon = getStatusIcon(project.status);
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => navigate(`/project_manager/projects/${project.id}`)}
                  className="cursor-pointer group"
                >
                  <GlassCard className="h-full hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 border border-white/10 hover:border-primary/30">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-gradient-to-r ${getStatusColor(
                            project.status
                          )}`}
                        >
                          {StatusIcon}
                          {project.status.replace("_", " ")}
                        </span>
                        {canEditProject(project) && (
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded">
                            <MoreVertical className="w-5 h-5 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                      <h3 className="font-bold text-lg mb-1 text-foreground group-hover:text-primary transition-colors">
                        {project.project_number}
                      </h3>
                      <p className="font-semibold mb-4 text-muted-foreground">{project.title}</p>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="w-4 h-4 flex-shrink-0 text-primary/70" />
                          <span className="truncate">{project.site_address || "Site not set"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="w-4 h-4 flex-shrink-0 text-primary/70" />
                          <span className="truncate">{project.client.company_name || project.client.full_name}</span>
                        </div>
                        {project.manager && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <UserCheck className="w-4 h-4 flex-shrink-0 text-primary/70" />
                            <span className="truncate">{project.manager.full_name}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-3 border-t border-white/10">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary/70" />
                            <span className="text-xs">
                              {project.expected_completion_date
                                ? format(new Date(project.expected_completion_date), "MMM yyyy")
                                : "No deadline"}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Progress</div>
                            <div className="font-bold text-primary">{project.progress_percent}%</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="px-6 py-4 glass border-t border-white/10 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {format(new Date(project.created_at), "dd MMM yyyy")}
                      </span>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <GlassCard className="overflow-hidden border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-xs sm:text-sm">
              <thead className="glass-strong">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Manager
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Deadline
                  </th>
                  <th className="relative px-6 py-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredProjects.map((project) => (
                  <motion.tr
                    key={project.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/projects/${project.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-semibold">{project.project_number}</div>
                        <div className="text-sm text-muted-foreground">{project.title}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-gradient-to-r ${getStatusColor(
                          project.status
                        )}`}
                      >
                        {getStatusIcon(project.status)}
                        {project.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {project.client.company_name || project.client.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {project.manager?.full_name || "Not assigned"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-white/10 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all"
                            style={{ width: `${project.progress_percent}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold text-primary">{project.progress_percent}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {project.expected_completion_date
                        ? format(new Date(project.expected_completion_date), "dd MMM yyyy")
                        : "No deadline"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-primary hover:text-primary/80">View</button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        )}
      </div>

      {/* Quick Stats Bar */}
      {/* <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-0 left-0 right-0 glass-strong border-t border-white/10 px-2 sm:px-6 py-3 sm:py-4 backdrop-blur-xl"
      >
        <div className="flex flex-col sm:flex-row items-center justify-around max-w-2xl sm:max-w-5xl mx-auto text-center gap-2 sm:gap-0">
          <div>
            <div className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {projects.length}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">Total Projects</div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-bold text-yellow-400">
              {projects.filter((p) => p.status === "in_construction").length}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">Active Sites</div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-bold text-green-400">
              {projects.filter((p) => p.status === "completed").length}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">Completed</div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-bold text-red-400">
              {projects.filter((p) => p.status === "on_hold").length}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">On Hold</div>
          </div>
        </div>
      </motion.div> */}

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchProjects();
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}