import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";

// Safe Supabase init — never crashes
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

type Project = {
  id: string;
  project_number: string;
  title: string;
  actual_completion_date: string | null;
  budget_numeric: number | null;
  currency: string;
  progress_percent: number;
  client_id: any;
};

export default function CompletedProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCompleted() {
      if (!supabase) {
        setError("Supabase not configured — check .env.local");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("projects")
          .select(`
            id,
            project_number,
            title,
            actual_completion_date,
            budget_numeric,
            currency,
            progress_percent,
            client_id:profiles!client_id (company_name)
          `)
          .eq("progress_percent", 100)
          .order("actual_completion_date", { ascending: false });

        if (error) throw error;
        setProjects(data || []);
      } catch (err: any) {
        setError(err.message || "Failed to load completed projects");
      } finally {
        setLoading(false);
      }
    }

    fetchCompleted();
  }, []);

  const totalValue = projects.reduce((sum, p) => sum + (p.budget_numeric || 0), 0);
  const thisMonthCount = projects.filter(p => {
    if (!p.actual_completion_date) return false;
    const d = new Date(p.actual_completion_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-32 flex items-center justify-center overflow-hidden">
        {/* Background with gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/90 to-background/85" />
        
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
        </div>

        {/* Content */}
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-5xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.8 }}
              className="mb-6"
            >
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-4 leading-tight">
                Completed
                <br />
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-glow">
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
                : 'Showcasing our commitment to quality and timely delivery'}
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
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20"
            >
              <GlassCard className="p-12 max-w-2xl mx-auto">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl">⚠️</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">Error Loading Projects</h3>
                <p className="text-muted-foreground mb-6">{error}</p>
              </GlassCard>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { value: projects.length, label: "Delivered" },
                { value: `$${(totalValue / 1_000_000).toFixed(1)}M`, label: "Total Value" },
                { value: thisMonthCount, label: "This Month" },
                { value: "100%", label: "Completion Rate" }
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.6 }}
                >
                  <GlassCard className="text-center p-8">
                    <div className="text-4xl font-bold mb-2 text-primary">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Projects Grid Section */}
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
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
            >
              <GlassCard className="p-20 text-center">
                <CheckCircle className="w-16 h-16 text-primary/50 mx-auto mb-6" />
                <h3 className="text-3xl font-bold mb-3">No completed projects yet</h3>
                <p className="text-xl text-muted-foreground">
                  Projects will appear here once they reach 100% completion
                </p>
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
                  <GlassCard className="p-8 h-full flex flex-col group hover:border-primary/30 transition-all duration-300">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                          {project.title}
                        </h3>
                        <p className="text-sm text-muted-foreground font-mono">
                          {project.project_number}
                        </p>
                      </div>
                      <Badge className="bg-primary/10 text-primary border-primary/30 font-medium tracking-wide px-3 py-1 rounded-full">
                        Completed
                      </Badge>
                    </div>

                    <div className="space-y-4 text-sm flex-grow">
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground min-w-[100px]">Client:</span>
                        <span className="font-medium text-foreground">
                          {project.client_id?.company_name || "Private Client"}
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground min-w-[100px]">Completed:</span>
                        <span className="font-medium text-foreground">
                          {project.actual_completion_date
                            ? new Date(project.actual_completion_date).toLocaleDateString("en-US", {
                                month: "long",
                                year: "numeric",
                                day: "numeric",
                              })
                            : "Recently"}
                        </span>
                      </div>

                      {project.budget_numeric && (
                        <div className="pt-4 border-t border-border/50">
                          <div className="flex items-baseline gap-2">
                            <span className="text-muted-foreground text-xs">Final Budget</span>
                          </div>
                          <div className="mt-2">
                            <span className="text-2xl font-bold text-primary">
                              {project.currency} {project.budget_numeric.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 pt-6 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-primary flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Successfully Delivered
                        </span>
                        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
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
            className="glass-strong rounded-3xl p-12 md:p-20 text-center max-w-4xl mx-auto"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Ready for Your Next Project?
            </h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Join our growing list of satisfied clients and let's create something extraordinary together
            </p>
            <button className="bg-primary hover:bg-primary/90 text-background font-semibold px-12 py-6 text-lg rounded-xl transition-colors inline-flex items-center gap-2 group">
              Start Your Project
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}