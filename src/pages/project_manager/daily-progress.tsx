// Top-level Daily Progress page for the project manager (and admin/manager).
// Lists daily-progress entries across every project the caller has access to
// via RLS: PMs see only their own projects, admin/manager see all. The
// per-project DailyProgress tab writes to the same `daily_progress` /
// `daily_progress_tasks` tables, so entries created there appear here
// automatically.
//
// "View Log" opens a modal with the full entry (tasks, statuses, notes).
// Previously this page was mock data and the button had no handler.

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  ListChecks,
  Loader2,
  ArrowRight,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate } from "react-router-dom";

interface TaskRow {
  name: string;
  status: string;
}

interface ProgressEntry {
  id: string;
  project_id: string;
  project_title: string;
  project_number: string | null;
  date: string;
  notes: string | null;
  tasks: TaskRow[];
}

const statusMap: Record<string, { color: string; icon: any }> = {
  Completed:    { color: "text-green-500",  icon: CheckCircle },
  "In Progress":{ color: "text-yellow-500", icon: TrendingUp },
  Pending:      { color: "text-gray-400",   icon: Clock },
  Issue:        { color: "text-red-500",    icon: XCircle },
};

const resolveStatus = (status: string) =>
  statusMap[status] ?? statusMap.Pending;

const PMDailyProgress = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ProgressEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      // RLS filters to projects the caller can access. We only need the last
      // 90 days for the top-of-page view; the per-project tab is where older
      // history lives.
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const { data, error } = await supabase
        .from("daily_progress")
        .select(
          "id, date, notes, project:projects!inner(id, title, project_number), daily_progress_tasks(name, status)",
        )
        .gte("date", cutoff.toISOString().slice(0, 10))
        .order("date", { ascending: false })
        .limit(200);

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setEntries([]);
      } else {
        const mapped: ProgressEntry[] = (data ?? []).map((row: any) => ({
          id: row.id,
          project_id: row.project?.id ?? "",
          project_title: row.project?.title ?? "Untitled project",
          project_number: row.project?.project_number ?? null,
          date: row.date,
          notes: row.notes ?? null,
          tasks: (row.daily_progress_tasks ?? []).map((t: any) => ({
            name: t.name,
            status: t.status,
          })),
        }));
        setEntries(mapped);
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const summaryStats = useMemo(() => {
    const todays = entries.filter((e) => e.date === today);
    const projectsUpdatedToday = new Set(todays.map((e) => e.project_id)).size;
    const todaysTasks = todays.flatMap((e) => e.tasks);
    const completed  = todaysTasks.filter((t) => t.status === "Completed").length;
    const inProgress = todaysTasks.filter((t) => t.status === "In Progress").length;
    const pending    = todaysTasks.filter((t) => t.status === "Pending").length;
    return [
      { icon: ListChecks,  value: projectsUpdatedToday, label: "Projects Updated Today" },
      { icon: CheckCircle, value: completed,            label: "Tasks Completed" },
      { icon: TrendingUp,  value: inProgress,           label: "Tasks In Progress" },
      { icon: Clock,       value: pending,              label: "Tasks Pending" },
    ];
  }, [entries, today]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const openProject = (projectId: string) => {
    if (!projectId) return;
    navigate(`/project_manager/projects/${projectId}`);
  };

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background/90"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/70 to-background/60 z-10" />
        <div className="absolute inset-0 opacity-10 z-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg width=\\"60\\" height=\\"60\\" viewBox=\\"0 0 60 60\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cg fill=\\"none\\" fill-rule=\\"evenodd\\"%3E%3Cg fill=\\"%23ffffff\\" fill-opacity=\\"0.7\\"%3E%3Cpath d=\\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            }}
          />
        </div>

        <div className="container mx-auto px-2 sm:px-6 z-20 relative flex items-center justify-center h-full py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-5xl"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-2 leading-tight">
                Daily{" "}
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Progress
                </span>
              </h1>
              <p className="text-base sm:text-lg md:text-2xl text-muted-foreground max-w-xl mx-auto">
                View daily progress across every project you have access to.
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="backdrop-blur-2xl bg-background/95 border border-white/20 rounded-2xl shadow-2xl p-4 sm:p-8"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
                {summaryStats.map((stat, idx) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * idx }}
                    className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl shadow-lg text-center px-6 py-6"
                  >
                    <stat.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                    <div className="text-2xl font-bold mb-1 text-primary font-display">
                      {stat.value}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                      {stat.label}
                    </div>
                  </motion.div>
                ))}
              </div>

              {error && (
                <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Could not load daily progress: {error}</span>
                </div>
              )}

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-sm">Loading progress…</span>
                </div>
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground text-center">
                  <Calendar className="w-10 h-10 text-primary/60" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      No daily progress logged yet
                    </p>
                    <p className="text-xs mt-1 max-w-md">
                      Open a project and use its Daily Logs tab to record a
                      day's tasks. New entries show up here automatically.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                    <thead>
                      <tr className="bg-background/60">
                        <th className="py-4 px-6 text-left font-semibold text-muted-foreground">
                          Project
                        </th>
                        <th className="py-4 px-6 text-left font-semibold text-muted-foreground">
                          Date
                        </th>
                        <th className="py-4 px-6 text-left font-semibold text-muted-foreground">
                          Tasks
                        </th>
                        <th className="py-4 px-6 text-left font-semibold text-muted-foreground">
                          Notes
                        </th>
                        <th className="py-4 px-6 text-left font-semibold text-muted-foreground">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors"
                        >
                          <td className="py-4 px-6 font-medium text-foreground">
                            <div className="flex flex-col">
                              <span>{entry.project_title}</span>
                              {entry.project_number && (
                                <span className="text-xs text-muted-foreground">
                                  {entry.project_number}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-foreground whitespace-nowrap">
                            {formatDate(entry.date)}
                          </td>
                          <td className="py-4 px-6">
                            {entry.tasks.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <ul className="space-y-1">
                                {entry.tasks.slice(0, 3).map((task, tIdx) => {
                                  const status = resolveStatus(task.status);
                                  const StatusIcon = status.icon;
                                  return (
                                    <li key={tIdx} className="flex items-center gap-2">
                                      <StatusIcon className={cn("w-4 h-4", status.color)} />
                                      <span className="w-32 inline-block text-foreground truncate">
                                        {task.name}
                                      </span>
                                      <span className={cn("font-semibold text-xs", status.color)}>
                                        {task.status}
                                      </span>
                                    </li>
                                  );
                                })}
                                {entry.tasks.length > 3 && (
                                  <li className="text-xs text-muted-foreground">
                                    +{entry.tasks.length - 3} more
                                  </li>
                                )}
                              </ul>
                            )}
                          </td>
                          <td className="py-4 px-6 text-sm text-muted-foreground max-w-xs truncate">
                            {entry.notes || "—"}
                          </td>
                          <td className="py-4 px-6">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl"
                              onClick={() => setViewing(entry)}
                            >
                              View Log
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* ──────────── View Log modal ──────────── */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Daily log</DialogTitle>
            <DialogDescription>
              {viewing && (
                <>
                  {viewing.project_title}
                  {viewing.project_number ? ` · ${viewing.project_number}` : ""}
                  {" · "}
                  {formatDate(viewing.date)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {viewing && (
            <div className="space-y-5 pt-2">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Tasks
                </h4>
                {viewing.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No tasks recorded for this log.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {viewing.tasks.map((task, idx) => {
                      const status = resolveStatus(task.status);
                      const StatusIcon = status.icon;
                      return (
                        <li
                          key={idx}
                          className="flex items-center gap-3 rounded-lg border border-white/10 bg-background/40 px-3 py-2"
                        >
                          <StatusIcon className={cn("w-4 h-4 flex-shrink-0", status.color)} />
                          <span className="text-sm text-foreground flex-1">{task.name}</span>
                          <span className={cn("text-xs font-semibold", status.color)}>
                            {task.status}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Notes
                </h4>
                {viewing.notes ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap rounded-lg border border-white/10 bg-background/40 px-3 py-2">
                    {viewing.notes}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No notes recorded for this log.
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-white/10">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    openProject(viewing.project_id);
                    setViewing(null);
                  }}
                >
                  Open project
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AnimatePresence>
  );
};

export default PMDailyProgress;
