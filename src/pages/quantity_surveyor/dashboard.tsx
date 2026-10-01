import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Ruler, ClipboardList, Calculator, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Stats {
  boqItemCount:      number;
  projectCount:      number;
  contractValue:     number;
  earnedValue:       number;
  itemsInProgress:   number;
  itemsCompleted:    number;
  measurementCount:  number;
}

interface RecentProject {
  project_id:        string;
  project_number:    string;
  title:             string;
  item_count:        number;
  earned:            number;
  contract:          number;
  overall_percent:   number;
}

const fmt = (n: number) =>
  `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function QuantitySurveyorDashboard() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: progress } = await supabase
        .from("vw_boq_progress")
        .select("project_id,boq_amount,value_earned,progress_percent,measurement_count");

      if (progress) {
        const rows = progress as Array<{
          project_id: string;
          boq_amount: number;
          value_earned: number;
          progress_percent: number;
          measurement_count: number;
        }>;

        const uniqueProjects = new Set(rows.map(r => r.project_id));
        const contract = rows.reduce((s, r) => s + Number(r.boq_amount), 0);
        const earned   = rows.reduce((s, r) => s + Number(r.value_earned), 0);
        const measurements = rows.reduce((s, r) => s + Number(r.measurement_count), 0);
        const inProgress = rows.filter(r => Number(r.progress_percent) > 0 && Number(r.progress_percent) < 100).length;
        const completed  = rows.filter(r => Number(r.progress_percent) >= 100).length;

        setStats({
          boqItemCount:     rows.length,
          projectCount:     uniqueProjects.size,
          contractValue:    contract,
          earnedValue:      earned,
          itemsInProgress:  inProgress,
          itemsCompleted:   completed,
          measurementCount: measurements,
        });

        // Roll up per project for the recent list
        const byProject = new Map<string, { contract: number; earned: number; item_count: number }>();
        rows.forEach(r => {
          const cur = byProject.get(r.project_id) ?? { contract: 0, earned: 0, item_count: 0 };
          cur.contract   += Number(r.boq_amount);
          cur.earned     += Number(r.value_earned);
          cur.item_count += 1;
          byProject.set(r.project_id, cur);
        });

        const projectIds = Array.from(byProject.keys()).slice(0, 20);
        if (projectIds.length) {
          const { data: projects } = await supabase
            .from("projects")
            .select("id,project_number,title,updated_at")
            .in("id", projectIds)
            .order("updated_at", { ascending: false })
            .limit(5);

          setRecent(((projects ?? []) as Array<{ id: string; project_number: string; title: string }>).map(p => {
            const agg = byProject.get(p.id)!;
            return {
              project_id:      p.id,
              project_number:  p.project_number,
              title:           p.title,
              item_count:      agg.item_count,
              earned:          agg.earned,
              contract:        agg.contract,
              overall_percent: agg.contract > 0 ? Math.min(100, Math.round((agg.earned / agg.contract) * 100)) : 0,
            };
          }));
        }
      } else {
        setStats({
          boqItemCount: 0, projectCount: 0, contractValue: 0, earnedValue: 0,
          itemsInProgress: 0, itemsCompleted: 0, measurementCount: 0,
        });
      }

      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-full">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-3 text-foreground">
          Quantity Surveyor Dashboard
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
          Measure works, price bills of quantities, and track cost variance across active projects.
        </p>
      </motion.div>

      {loading || !stats ? (
        <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading QS metrics…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <StatCard
              icon={ClipboardList}
              label="Active BoQ items"
              value={stats.boqItemCount.toLocaleString("en-KE")}
              hint={`${stats.projectCount} project${stats.projectCount !== 1 ? "s" : ""}`}
            />
            <StatCard
              icon={Ruler}
              label="Measurements recorded"
              value={stats.measurementCount.toLocaleString("en-KE")}
              hint={`${stats.itemsInProgress} in progress`}
            />
            <StatCard
              icon={Calculator}
              label="Contract value"
              value={fmt(stats.contractValue)}
            />
            <StatCard
              icon={TrendingUp}
              label="Earned to date"
              value={fmt(stats.earnedValue)}
              accent="text-primary"
              hint={
                stats.contractValue > 0
                  ? `${Math.round((stats.earnedValue / stats.contractValue) * 100)}% of contract`
                  : undefined
              }
            />
          </div>

          {/* Recent projects */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent projects with BoQ</span>
              <Link to="/qs/measurements" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                Open measurements <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No BoQ items yet. Start by creating one in{" "}
                <Link to="/qs/bill-of-quantities" className="text-primary hover:underline">
                  Bill of Quantities
                </Link>.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {recent.map(p => (
                  <div key={p.project_id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="font-mono text-xs text-muted-foreground">{p.project_number}</span>
                        <span className="font-medium text-foreground truncate">{p.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.item_count} BoQ item{p.item_count !== 1 ? "s" : ""} · {fmt(p.earned)} earned of {fmt(p.contract)}
                      </div>
                      <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden max-w-md">
                        <div
                          className={`h-full transition-all duration-500 ${p.overall_percent >= 100 ? "bg-emerald-400/70" : "bg-primary/70"}`}
                          style={{ width: `${p.overall_percent}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-lg font-bold font-mono tabular-nums shrink-0 ${p.overall_percent >= 100 ? "text-emerald-400" : "text-primary"}`}>
                      {p.overall_percent}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, accent = "text-foreground" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className={`text-2xl font-bold font-mono tabular-nums ${accent}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground/70 mt-1">{hint}</div>}
    </div>
  );
}
