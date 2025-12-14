import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, 
  CheckCircle, 
  X, 
  Calendar, 
  DollarSign, 
  MapPin, 
  Building2, 
  Clock, 
  TrendingUp,
  Image as ImageIcon,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  Target,
  Users,
  Briefcase
} from "lucide-react";

// Safe Supabase init
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Types
type Project = {
  id: string;
  project_number: string;
  title: string;
  description: string | null;
  site_address: string | null;
  start_date: string | null;
  expected_completion_date: string | null;
  actual_completion_date: string | null;
  budget_numeric: number | null;
  currency: string;
  progress_percent: number;
  status: string;
  created_at: string;
  client?: {
    company_name?: string;
    full_name?: string;
  };
  manager?: {
    full_name: string;
  };
  milestones?: number;
  tasks?: number;
  documents?: number;
  photos?: number;
};

type ProjectDetails = Project & {
  milestone_list: Array<{ title: string; status: string }>;
  photo_gallery: Array<{ id: string; file_path: string; name: string; uploaded_at: string }>;
  document_list: Array<{ name: string; folder: string; file_size: number }>;
  timeline: {
    planned_duration: number;
    actual_duration: number;
    variance: number;
  };
};

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${className}`}>
    {children}
  </span>
);

export default function CompletedProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchCompletedProjects();
  }, []);

  async function fetchCompletedProjects() {
    if (!supabase) {
      setError("System configuration error. Please contact support.");
      setLoading(false);
      return;
    }

    try {
      // Simplified query - fetch only essential data first
      const { data, error: fetchError } = await supabase
        .from("projects")
        .select(`
          id,
          project_number,
          title,
          description,
          site_address,
          start_date,
          expected_completion_date,
          actual_completion_date,
          budget_numeric,
          currency,
          progress_percent,
          status,
          created_at
        `)
        .or("status.eq.completed,progress_percent.eq.100")
        .order("actual_completion_date", { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      // Format projects with placeholder counts
      const formattedProjects = (data || []).map(project => ({
        ...project,
        milestones: 0,
        tasks: 0,
        documents: 0,
        photos: 0,
        client: { company_name: null, full_name: null },
        manager: { full_name: "Project Manager" }
      }));

      setProjects(formattedProjects);
      setLoading(false);

      // Fetch additional data in background (non-blocking)
      if (data && data.length > 0) {
        enrichProjectsInBackground(data);
      }
    } catch (err: any) {
      console.error("Error fetching completed projects:", err);
      setError(err.message || "Failed to load completed projects");
      setLoading(false);
    }
  }

  async function enrichProjectsInBackground(projectsData: any[]) {
    if (!supabase) return;

    try {
      // Fetch all client and manager data in one go
      const clientIds = [...new Set(projectsData.map(p => p.client_id).filter(Boolean))];
      const managerIds = [...new Set(projectsData.map(p => p.manager_id).filter(Boolean))];

      const [clientsResult, managersResult] = await Promise.all([
        clientIds.length > 0 
          ? supabase.from("profiles").select("id, companies(name)").in("id", clientIds)
          : Promise.resolve({ data: [] }),
        managerIds.length > 0
          ? supabase.from("profiles").select("id, full_name").in("id", managerIds)
          : Promise.resolve({ data: [] })
      ]);

      const clientsMap = (clientsResult.data || []).reduce((acc: any, profile: any) => {
        acc[profile.id] = profile.companies?.name || "Client";
        return acc;
      }, {});

      const managersMap = (managersResult.data || []).reduce((acc: any, profile: any) => {
        acc[profile.id] = profile.full_name || "Project Manager";
        return acc;
      }, {});

      // Update projects with enriched data
      setProjects(prev => prev.map(project => ({
        ...project,
        client: {
          company_name: clientsMap[project.client_id] || null,
          full_name: null
        },
        manager: {
          full_name: managersMap[project.manager_id] || "Project Manager"
        }
      })));
    } catch (err) {
      console.error("Error enriching projects:", err);
    }
  }

  async function fetchProjectDetails(projectId: string) {
    if (!supabase) {
      alert("Database not configured");
      return;
    }

    console.log("=== FETCH PROJECT DETAILS START ===");
    console.log("Project ID:", projectId);
    
    setLoadingDetails(true);
    setShowModal(true); // Show modal immediately
    setSelectedProject(null); // Clear previous data
    
    try {
      const project = projects.find((p) => p.id === projectId);
      if (!project) {
        console.error("Project not found in projects array");
        alert("Project not found");
        setShowModal(false);
        setLoadingDetails(false);
        return;
      }

      console.log("Found project:", project.title);

      // Fetch all data in parallel with error handling
      console.log("Fetching milestones, photos, documents...");
      
      const [milestonesResult, photosResult, documentsResult] = await Promise.all([
        supabase
          .from("project_milestones")
          .select("title, status")
          .eq("project_id", projectId)
          .order("sort_order")
          .then(res => {
            console.log("Milestones response:", res);
            return res.data || [];
          }),
        
        supabase
          .from("documents")
          .select("id, file_path, name, uploaded_at")
          .eq("project_id", projectId)
          .eq("folder", "photos")
          .order("uploaded_at", { ascending: false })
          .limit(20)
          .then(res => {
            console.log("Photos response:", res);
            return res.data || [];
          }),
        
        supabase
          .from("documents")
          .select("name, folder, file_size")
          .eq("project_id", projectId)
          .neq("folder", "photos")
          .then(res => {
            console.log("Documents response:", res);
            return res.data || [];
          })
      ]);

      console.log("Fetched data counts:", {
        milestones: milestonesResult.length,
        photos: photosResult.length,
        documents: documentsResult.length
      });

      // Calculate timeline
      const timeline = calculateTimeline(project);
      console.log("Timeline calculated:", timeline);

      // Update counts if we fetched them
      const updatedProject = {
        ...project,
        milestones: milestonesResult.length,
        photos: photosResult.length,
        documents: documentsResult.length,
      };

      const finalProject = {
        ...updatedProject,
        milestone_list: milestonesResult,
        photo_gallery: photosResult,
        document_list: documentsResult,
        timeline,
      };

      console.log("Setting selected project:", finalProject);
      setSelectedProject(finalProject);
      setCurrentPhotoIndex(0);
      console.log("=== FETCH PROJECT DETAILS SUCCESS ===");
    } catch (err: any) {
      console.error("=== FETCH PROJECT DETAILS ERROR ===");
      console.error("Error:", err);
      alert(`Failed to load project details: ${err.message}`);
      setShowModal(false);
    } finally {
      setLoadingDetails(false);
    }
  }

  function calculateTimeline(project: Project) {
    if (!project.start_date || !project.actual_completion_date) {
      return { planned_duration: 0, actual_duration: 0, variance: 0 };
    }

    const start = new Date(project.start_date);
    const expected = project.expected_completion_date ? new Date(project.expected_completion_date) : new Date();
    const actual = new Date(project.actual_completion_date);

    const planned_duration = Math.ceil((expected.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const actual_duration = Math.ceil((actual.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const variance = actual_duration - planned_duration;

    return { planned_duration, actual_duration, variance };
  }

  const totalValue = projects.reduce((sum, p) => sum + (p.budget_numeric || 0), 0);
  const thisMonthCount = projects.filter((p) => {
    if (!p.actual_completion_date) return false;
    const d = new Date(p.actual_completion_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case "not_started":
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
      case "in_progress":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "delayed":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      default:
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    }
  };

  const handleStartProject = () => {
    window.location.href = "/contact#contact-form";
  };

  const getPhotoUrl = (path: string) => {
    if (!supabaseUrl || !path) return "";
    // Match PhotosTab pattern exactly
    return `${supabaseUrl}/storage/v1/object/public/documents-and-images/${path}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <section className="relative py-32 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/90 to-background/85" />
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            }}
          />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-5xl mx-auto"
          >
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ duration: 0.8 }} className="mb-6">
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-4 leading-tight">
                Completed
                <br />
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Projects
                </span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto"
            >
              {projects.length > 0
                ? `${projects.length} projects successfully delivered with excellence and precision`
                : "Showcasing our commitment to quality and timely delivery"}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-6">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <GlassCard key={i} className="p-8 animate-pulse">
                  <div className="h-12 bg-white/20 rounded w-12 mb-4 mx-auto" />
                  <div className="h-8 bg-white/10 rounded w-24 mx-auto" />
                </GlassCard>
              ))}
            </div>
          ) : error ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <GlassCard className="p-12 max-w-2xl mx-auto">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-center">Error Loading Projects</h3>
                <p className="text-muted-foreground text-center">{error}</p>
              </GlassCard>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { value: projects.length, label: "Delivered", icon: CheckCircle },
                { value: `${totalValue >= 1000000 ? (totalValue / 1000000).toFixed(1) + "M" : (totalValue / 1000).toFixed(0) + "K"}`, label: "Total Value", icon: DollarSign },
                { value: thisMonthCount, label: "This year", icon: Calendar },
                { value: "100%", label: "Success Rate", icon: TrendingUp },
              ].map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1, duration: 0.6 }}
                  >
                    <GlassCard className="text-center p-8">
                      <Icon className="w-8 h-8 text-primary mx-auto mb-3" />
                      <div className="text-4xl font-bold mb-2 text-primary">{stat.value}</div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </GlassCard>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Projects Grid */}
      <section className="py-20 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Our <span className="text-primary">Portfolio</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Every project represents our commitment to excellence and client satisfaction
            </p>
          </motion.div>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <GlassCard key={i} className="p-8 animate-pulse h-80">
                  <div className="h-8 bg-white/10 rounded mb-4" />
                  <div className="h-4 bg-white/5 rounded w-32 mb-8" />
                  <div className="space-y-3">
                    <div className="h-4 bg-white/5 rounded" />
                    <div className="h-4 bg-white/5 rounded" />
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
              <GlassCard className="p-20 text-center">
                <CheckCircle className="w-16 h-16 text-primary/50 mx-auto mb-6" />
                <h3 className="text-3xl font-bold mb-3">No completed projects yet</h3>
                <p className="text-xl text-muted-foreground">Projects will appear here once completed</p>
              </GlassCard>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {projects.map((project, idx) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: idx * 0.1, duration: 0.6 }}
                >
                  <GlassCard className="p-8 h-full flex flex-col group hover:border-primary/30 transition-all duration-300 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      console.log("Card clicked, fetching details for:", project.id);
                      fetchProjectDetails(project.id);
                    }}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors truncate">
                          {project.title}
                        </h3>
                        <p className="text-sm text-muted-foreground font-mono">{project.project_number}</p>
                      </div>
                      <Badge className="bg-green-500/20 text-green-300 border border-green-500/30 ml-3 flex-shrink-0">
                        <CheckCircle className="w-3 h-3 inline mr-1" />
                        Completed
                      </Badge>
                    </div>

                    <div className="space-y-4 text-sm flex-grow">
                      {project.site_address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground line-clamp-2">{project.site_address}</span>
                        </div>
                      )}

                      {project.client?.company_name && (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-foreground font-medium truncate">{project.client.company_name}</span>
                        </div>
                      )}

                      {project.actual_completion_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">
                            Completed {new Date(project.actual_completion_date).toLocaleDateString("en-US", {
                              month: "short",
                              year: "numeric",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      )}

                      {project.budget_numeric && (
                        <div className="pt-4 border-t border-border/50">
                          <div className="flex items-baseline gap-2 mb-1">
                            <DollarSign className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs text-muted-foreground">Project Value</span>
                          </div>
                          <div className="text-2xl font-bold text-primary">
                            {project.currency} {project.budget_numeric.toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 pt-6 border-t border-border/50">
                      {/* <div className="flex items-center justify-between"> */}
                        {/* <span className="text-sm font-medium text-primary flex items-center gap-2">
                          View Details
                        </span> */}
                        {/* <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" /> */}
                      {/* </div> */}
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <GlassCard className="p-12 md:p-20 text-center max-w-4xl mx-auto">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">Ready for Your Next Project?</h2>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Join our growing list of satisfied clients and let's create something extraordinary together
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-primary hover:bg-primary/90 text-background font-semibold px-12 py-6 text-lg rounded-xl transition-colors inline-flex items-center gap-2 group"
                onClick={handleStartProject}
              >
                Start Your Project
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* Project Details Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => {
              console.log("Modal backdrop clicked - closing");
              setShowModal(false);
              setSelectedProject(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-background border border-white/20 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto my-8"
              onClick={(e) => {
                console.log("Modal content clicked - stopping propagation");
                e.stopPropagation();
              }}
            >
              {loadingDetails ? (
                <div className="p-20 flex flex-col items-center justify-center">
                  <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                  <p className="text-muted-foreground">Loading project details...</p>
                </div>
              ) : selectedProject ? (
                <>
                  {/* Modal Header */}
                  <div className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-white/20 p-6 z-10">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-3xl font-bold mb-2 text-primary">{selectedProject.title}</h2>
                        <p className="text-sm text-muted-foreground font-mono">{selectedProject.project_number}</p>
                      </div>
                      <button
                        onClick={() => {
                          console.log("Close button clicked");
                          setShowModal(false);
                          setSelectedProject(null);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg transition-all flex-shrink-0"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-6">
                    {/* Key Project Info - Streamlined */}
                    <section>
                      <GlassCard>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Location */}
                          {selectedProject.site_address && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Location</p>
                              <p className="font-medium flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                                <span className="text-sm">{selectedProject.site_address}</span>
                              </p>
                            </div>
                          )}
                          
                          {/* Client */}
                          {selectedProject.client?.company_name && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Client</p>
                              <p className="font-medium flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-primary" />
                                <span className="text-sm">{selectedProject.client.company_name}</span>
                              </p>
                            </div>
                          )}

                          {/* Completion Date */}
                          {selectedProject.actual_completion_date && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Completed</p>
                              <p className="font-medium flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-green-400" />
                                <span className="text-sm text-green-400">
                                  {new Date(selectedProject.actual_completion_date).toLocaleDateString("en-US", {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                              </p>
                            </div>
                          )}

                          {/* Budget */}
                          {selectedProject.budget_numeric && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Project Value</p>
                              <p className="font-bold flex items-center gap-2 text-primary text-xl">
                                {selectedProject.currency} {selectedProject.budget_numeric.toLocaleString()}
                              </p>
                            </div>
                          )}

                          {/* Duration */}
                          {selectedProject.timeline.actual_duration > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Duration</p>
                              <p className="font-medium text-sm">
                                {selectedProject.timeline.actual_duration} days
                                {selectedProject.timeline.variance !== 0 && (
                                  <span className={`ml-2 text-xs ${selectedProject.timeline.variance > 0 ? "text-orange-400" : "text-green-400"}`}>
                                    ({selectedProject.timeline.variance > 0 ? "+" : ""}{selectedProject.timeline.variance} days)
                                  </span>
                                )}
                              </p>
                            </div>
                          )}

                          {/* Project Stats */}
                          <div>
                            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Project Stats</p>
                            <div className="flex gap-4 text-sm">
                              <span className="text-muted-foreground">
                                <strong className="text-primary">{selectedProject.milestones}</strong> Milestones
                              </span>
                              <span className="text-muted-foreground">
                                <strong className="text-primary">{selectedProject.photos}</strong> Photos
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Description - Only if exists */}
                        {selectedProject.description && (
                          <div className="mt-6 pt-6 border-t border-border/50">
                            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Description</p>
                            <p className="text-sm text-foreground leading-relaxed">{selectedProject.description}</p>
                          </div>
                        )}
                      </GlassCard>
                    </section>

                    {/* Photo Gallery - Only if photos exist */}
                    {selectedProject.photo_gallery.length > 0 && (
                      <section>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                          <ImageIcon className="w-5 h-5 text-primary" />
                          Project Gallery ({selectedProject.photo_gallery.length})
                        </h3>
                        <GlassCard>
                          {/* Main Photo Display */}
                          <div className="relative aspect-video bg-black/20 rounded-xl overflow-hidden mb-4">
                            <img
                              src={getPhotoUrl(selectedProject.photo_gallery[currentPhotoIndex].file_path)}
                              alt={selectedProject.photo_gallery[currentPhotoIndex].name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23333' width='400' height='300'/%3E%3Ctext fill='%23666' x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-size='16'%3EImage not available%3C/text%3E%3C/svg%3E";
                              }}
                            />
                            
                            {/* Navigation Arrows */}
                            {selectedProject.photo_gallery.length > 1 && (
                              <>
                                <button
                                  onClick={() =>
                                    setCurrentPhotoIndex((prev) =>
                                      prev === 0 ? selectedProject.photo_gallery.length - 1 : prev - 1
                                    )
                                  }
                                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-black/80 rounded-full transition-all"
                                >
                                  <ChevronLeft className="w-6 h-6" />
                                </button>
                                <button
                                  onClick={() =>
                                    setCurrentPhotoIndex((prev) =>
                                      prev === selectedProject.photo_gallery.length - 1 ? 0 : prev + 1
                                    )
                                  }
                                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-black/80 rounded-full transition-all"
                                >
                                  <ChevronRight className="w-6 h-6" />
                                </button>
                              </>
                            )}

                            {/* Photo Counter */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 rounded-full text-sm">
                              {currentPhotoIndex + 1} / {selectedProject.photo_gallery.length}
                            </div>
                          </div>

                          {/* Photo Caption */}
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-muted-foreground truncate">
                              {selectedProject.photo_gallery[currentPhotoIndex].name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(selectedProject.photo_gallery[currentPhotoIndex].uploaded_at).toLocaleDateString()}
                            </p>
                          </div>

                          {/* Thumbnail Grid */}
                          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-32 overflow-y-auto">
                            {selectedProject.photo_gallery.map((photo, idx) => (
                              <button
                                key={photo.id}
                                onClick={() => setCurrentPhotoIndex(idx)}
                                className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                  idx === currentPhotoIndex
                                    ? "border-primary ring-2 ring-primary/50"
                                    : "border-white/20 hover:border-white/40"
                                }`}
                              >
                                <img
                                  src={getPhotoUrl(photo.file_path)}
                                  alt={`Thumbnail ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3C/svg%3E";
                                  }}
                                />
                              </button>
                            ))}
                          </div>
                        </GlassCard>
                      </section>
                    )}

                    {/* Milestones - Compact View - Only if exist */}
                    {selectedProject.milestone_list.length > 0 && (
                      <section>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                          <Target className="w-5 h-5 text-primary" />
                          Milestones ({selectedProject.milestone_list.length})
                        </h3>
                        <GlassCard>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                            {selectedProject.milestone_list.map((milestone, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10"
                              >
                                <CheckCircle className={`w-4 h-4 flex-shrink-0 ${
                                  milestone.status === 'completed' ? 'text-green-400' : 'text-muted-foreground'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{milestone.title}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </GlassCard>
                      </section>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-20 text-center">
                  <p className="text-muted-foreground">No project data available</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}