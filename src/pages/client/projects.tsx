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
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong border-b border-white/10">
        <div className="px-2 sm:px-4 lg:px-8 py-6 sm:py-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            My Projects
          </h1>
        </div>
      </motion.div>
      <div className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6 flex flex-col sm:flex-row gap-4">
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
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-3 rounded-xl border transition-all ${viewMode === "grid" ? "glass-strong border-primary/50 text-primary" : "glass border-white/10 hover:border-white/20"}`}
          >
            <Layers className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-3 rounded-xl border transition-all ${viewMode === "list" ? "glass-strong border-primary/50 text-primary" : "glass border-white/10 hover:border-white/20"}`}
          >
            <Activity className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="px-2 sm:px-4 lg:px-8 pb-20 sm:pb-32">
        {filteredProjects.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20">
            <GlassCard className="p-12 max-w-md mx-auto">
              <Home className="w-20 h-20 text-primary/50 mx-auto mb-4" />
              <p className="text-xl font-semibold mb-2">No projects found</p>
              <p className="text-muted-foreground mb-6">You have no projects yet.</p>
            </GlassCard>
          </motion.div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredProjects.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => navigate(`/client/projects/${project.id}`)}
                className="cursor-pointer group"
              >
                <GlassCard className="h-full hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 border border-white/10 hover:border-primary/30">
                  <div className="p-6">
                    <h3 className="font-bold text-lg mb-1 text-foreground group-hover:text-primary transition-colors">
                      {project.project_number}
                    </h3>
                    <p className="font-semibold mb-4 text-muted-foreground">{project.title}</p>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 flex-shrink-0 text-primary/70" />
                        <span className="truncate">{project.site_address || "Site not set"}</span>
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
            ))}
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
                    onClick={() => navigate(`/client/projects/${project.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-semibold">{project.project_number}</div>
                        <div className="text-sm text-muted-foreground">{project.title}</div>
                      </div>
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
    </div>
  );
}
