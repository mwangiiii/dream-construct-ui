// app/completed-projects/page.tsx  (or pages/completed-projects.tsx)
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion } from "framer-motion";
// Removed icons for a more formal, Apple-inspired look
import { SectionHeading } from "@/components/ui/SectionHeading";
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

  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-6">

        <SectionHeading
          title="Completed Projects"
          subtitle={`${projects.length} projects successfully delivered`}
          className="mb-16"
        />

        {/* Dashboard Stats – Same style as your original */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            {[...Array(4)].map((_, i) => (
              <GlassCard key={i} className="p-8 animate-pulse">
                <div className="h-12 bg-white/20 rounded w-12 mb-4" />
                <div className="h-8 bg-white/10 rounded w-24" />
              </GlassCard>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">
            <p className="text-2xl font-bold mb-4">Error</p>
            <pre className="bg-red-50 p-4 rounded-lg inline-block">{error}</pre>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12"
          >
            {/* Apple-inspired minimalist stat cards */}
            <GlassCard className="p-8 text-center bg-white/80 shadow-xl rounded-3xl border border-zinc-200">
              <div className="text-5xl font-semibold text-zinc-900 mb-2 tracking-tight">{projects.length}</div>
              <div className="text-lg text-zinc-500">Delivered</div>
            </GlassCard>
            <GlassCard className="p-8 text-center bg-white/80 shadow-xl rounded-3xl border border-zinc-200">
              <div className="text-5xl font-semibold text-zinc-900 mb-2 tracking-tight">${(totalValue / 1_000_000).toFixed(1)}M</div>
              <div className="text-lg text-zinc-500">Total Value</div>
            </GlassCard>
            <GlassCard className="p-8 text-center bg-white/80 shadow-xl rounded-3xl border border-zinc-200">
              <div className="text-5xl font-semibold text-zinc-900 mb-2 tracking-tight">
                {projects.filter(p => {
                  if (!p.actual_completion_date) return false;
                  const d = new Date(p.actual_completion_date);
                  const now = new Date();
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length}
              </div>
              <div className="text-lg text-zinc-500">This Month</div>
            </GlassCard>
            <GlassCard className="p-8 text-center bg-white/80 shadow-xl rounded-3xl border border-zinc-200">
              <div className="text-5xl font-semibold text-zinc-900 mb-2 tracking-tight">100%</div>
              <div className="text-lg text-zinc-500">Completion Rate</div>
            </GlassCard>
          </motion.div>
        )}

        {/* Completed Projects Grid – Exactly your original glassmorphic style */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {loading
            ? [...Array(6)].map((_, i) => (
                <GlassCard key={i} className="p-8 animate-pulse">
                  <div className="h-8 bg-white/10 rounded mb-4" />
                  <div className="h-4 bg-white/5 rounded w-32" />
                </GlassCard>
              ))
            : projects.map((project, idx) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <GlassCard className="p-8 h-full flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-foreground">
                          {project.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {project.project_number}
                        </p>
                      </div>
                      <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200 font-medium tracking-wide px-3 py-1 rounded-full shadow-sm">
                        Completed
                      </Badge>
                    </div>

                    <div className="space-y-4 text-sm flex-grow">
                      <div>
                        <span className="text-muted-foreground">Client:</span>{" "}
                        <span className="font-medium">
                          {project.client_id?.company_name || "Private Client"}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground">Completed on:</span>{" "}
                        <span className="font-medium">
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
                          <span className="text-muted-foreground">Final Budget:</span>{" "}
                          <span className="text-xl font-bold text-primary">
                            {project.currency} {project.budget_numeric.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* NO PROGRESS BAR — intentionally hidden */}
                    <div className="mt-8 pt-6 border-t border-border/50 text-center">
                      <span className="text-lg text-zinc-700 font-semibold tracking-tight">Project Successfully Delivered</span>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
        </div>

        {/* Empty State */}
        {!loading && !error && projects.length === 0 && (
          <GlassCard className="p-20 text-center bg-white/80 shadow-xl rounded-3xl border border-zinc-200">
            <h3 className="text-2xl font-semibold mb-2 text-zinc-800">No completed projects yet</h3>
            <p className="text-zinc-500">
              Projects will appear here once they reach 100% completion.
            </p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}