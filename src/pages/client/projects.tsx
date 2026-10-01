// src/pages/client/projects.tsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, AuthUser } from "@/lib/auth";
import { motion } from "framer-motion";
import {
  Search,
  Layers,
  Activity,
  MapPin,
  Users,
  UserCheck,
  Calendar,
  ChevronRight,
  Home,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";

// Project type (customize as needed)
type Project = {
  id: string;
  project_number: string;
  title: string;
  status: string;
  progress_percent: number;
  start_date: string | null;
  expected_completion_date: string | null;
  actual_completion_date: string | null;
  budget_numeric: number;
  currency: string;
  site_address: string;
  manager: { id: string; full_name: string } | null;
  created_at: string;
};

export default function ClientProjects() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    getCurrentUser().then(user => {
      setCurrentUser(user);
      if (user) fetchProjects(user.profile.id);
      else setLoading(false);
    });
  }, []);

  const fetchProjects = async (clientId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select(`*, manager:profiles!manager_id(id, full_name)`)
      .eq("client_id", clientId)
      // Clients never see archived projects.
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      setLoading(false);
      return;
    }
    setProjects(data || []);
    setLoading(false);
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.project_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.site_address?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [projects, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-background/95 via-background/98 to-background">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xl text-muted-foreground">Loading your projects...</div>
        </motion.div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-background/95 via-background/98 to-background">
        <GlassCard className="p-12 text-center max-w-md">
          <Home className="w-16 h-16 text-primary/50 mx-auto mb-4" />
          <div className="text-xl font-semibold mb-2">Sign in required</div>
          <p className="text-muted-foreground">Please log in to view your projects.</p>
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
        className="border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent"
      >
        <div className="px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <h1 className="text-5xl sm:text-6xl font-bold mb-3 text-foreground">
            My Projects
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
            Track the progress of your construction projects and stay updated with your team
          </p>
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 border-b border-white/5"
      >
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, number, or location..."
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-foreground placeholder-muted-foreground"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center justify-center w-12 h-12 rounded-lg border transition-all ${
                viewMode === "grid"
                  ? "bg-primary/10 border-primary/50 text-primary"
                  : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:border-white/20"
              }`}
              title="Grid view"
            >
              <Layers className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center justify-center w-12 h-12 rounded-lg border transition-all ${
                viewMode === "list"
                  ? "bg-primary/10 border-primary/50 text-primary"
                  : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:border-white/20"
              }`}
              title="List view"
            >
              <Activity className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {filteredProjects.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20">
            <GlassCard className="p-12 max-w-md mx-auto">
              <Home className="w-20 h-20 text-primary/50 mx-auto mb-4" />
              <p className="text-xl font-semibold mb-2">No projects found</p>
              <p className="text-muted-foreground mb-6">
                {searchTerm ? "Try adjusting your search" : "You have no projects yet"}
              </p>
            </GlassCard>
          </motion.div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => navigate(`/client/projects/${project.id}`)}
                className="cursor-pointer group h-full"
              >
                <div className="relative h-full bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 flex flex-col">
                  {/* Status Accent */}
                  <div className="absolute top-0 left-0 h-1 w-12 bg-gradient-to-r from-primary to-accent rounded-full"></div>

                  {/* Card Content */}
                  <div className="p-7 flex-1 flex flex-col">
                    {/* Title Section */}
                    <div className="mb-6">
                      <p className="text-sm font-medium text-primary/70 mb-2 uppercase tracking-wider">
                        {project.project_number}
                      </p>
                      <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors leading-tight">
                        {project.title}
                      </h3>
                    </div>

                    {/* Details Section */}
                    <div className="space-y-4 text-sm flex-1">
                      {project.site_address && (
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-primary/60 flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{project.site_address}</span>
                        </div>
                      )}
                      {project.manager && (
                        <div className="flex items-start gap-3">
                          <UserCheck className="w-4 h-4 text-primary/60 flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{project.manager.full_name}</span>
                        </div>
                      )}
                      {project.expected_completion_date && (
                        <div className="flex items-start gap-3">
                          <Calendar className="w-4 h-4 text-primary/60 flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">
                            Due {format(new Date(project.expected_completion_date), "MMM d, yyyy")}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Progress Section */}
                    <div className="mt-8 pt-6 border-t border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Progress</span>
                        <span className="text-lg font-semibold text-primary">{project.progress_percent}%</span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${project.progress_percent}%` }}
                          transition={{ delay: idx * 0.05 + 0.3, duration: 0.8 }}
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                        ></motion.div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-7 py-4 bg-white/3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Added {format(new Date(project.created_at), "MMM d, yyyy")}
                    </span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <GlassCard className="overflow-hidden border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-8 py-5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-8 py-5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Manager
                  </th>
                  <th className="px-8 py-5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-8 py-5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Deadline
                  </th>
                  <th className="relative px-8 py-5">
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
                    onClick={() => navigate(`/client/projects/${project.id}`)}
                  >
                    <td className="px-8 py-5">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{project.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">{project.project_number}</div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm text-muted-foreground">
                      {project.manager?.full_name || "Not assigned"}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-primary to-accent h-full rounded-full transition-all"
                            style={{ width: `${project.progress_percent}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold text-primary min-w-fit">{project.progress_percent}%</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm text-muted-foreground">
                      {project.expected_completion_date
                        ? format(new Date(project.expected_completion_date), "MMM d, yyyy")
                        : "No deadline"}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <ChevronRight className="w-5 h-5 text-muted-foreground inline-block" />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        )}
      </div>

      {/* Summary Footer */}
      {filteredProjects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="px-4 sm:px-6 lg:px-8 py-8 border-t border-white/10 bg-gradient-to-b from-transparent to-white/3"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {filteredProjects.length}
              </div>
              <div className="text-sm text-muted-foreground mt-2">Total Projects</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-yellow-400">
                {filteredProjects.filter(p => p.progress_percent < 100).length}
              </div>
              <div className="text-sm text-muted-foreground mt-2">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-green-400">
                {filteredProjects.filter(p => p.progress_percent === 100).length}
              </div>
              <div className="text-sm text-muted-foreground mt-2">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-blue-400">
                {filteredProjects.reduce((sum, p) => sum + p.progress_percent, 0) / filteredProjects.length | 0}%
              </div>
              <div className="text-sm text-muted-foreground mt-2">Avg Progress</div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
