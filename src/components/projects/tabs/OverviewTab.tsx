// src/components/projects/tabs/OverviewTab.tsx
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  Calendar,
  DollarSign,
  MessageSquare,
  FileText,
  CheckCircle2,
  Edit2,
  Save,
  X,
  Clock,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface OverviewTabProps {
  project: any;
  milestones: any[];
  tasks: any[];
  updates: any[];
  documents: any[];
  canEdit: boolean;
  isClient: boolean;
  onProjectUpdate: () => void;

  /**
   * Auto-computed project progress — task-driven, read-only.
   * Formula: average of (done_tasks / total_tasks * 100) per milestone.
   * Source: MilestonesTab → onProgressChange → ProjectDetailPage state.
   * No user — including admin — can manually change this value.
   */
  projectProgress: number;

  /**
   * Auto-counted from the documents array in ProjectDetailPage.
   * Replaces documents.length used in Quick Stats so the count is
   * always in sync with the real fetched data.
   */
  documentsCount: number;

  /**
   * Auto-counted from the active updates array in ProjectDetailPage.
   * Replaces updates.length used in Quick Stats.
   */
  updatesCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

const statusOptions = [
  { value: "planning",          label: "Planning",          color: "bg-gray-500/20 text-gray-300 border-gray-500/30"     },
  { value: "pre_construction",  label: "Pre-Construction",  color: "bg-blue-500/20 text-blue-300 border-blue-500/30"     },
  { value: "in_construction",   label: "In Construction",   color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  { value: "inspections",       label: "Inspections",       color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { value: "completed",         label: "Completed",         color: "bg-green-500/20 text-green-300 border-green-500/30"  },
  { value: "on_hold",           label: "On Hold",           color: "bg-red-500/20 text-red-300 border-red-500/30"        },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function OverviewTab({
  project,
  milestones,
  tasks,
  updates,
  documents,
  canEdit,
  isClient,
  onProjectUpdate,
  projectProgress,
  documentsCount,
  updatesCount,
}: OverviewTabProps) {

  // ── Edit state — progress editing intentionally removed ───────────────────
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [isEditingDates,  setIsEditingDates]  = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Revised budget from approved change orders ────────────────────────────
  const [budgetData, setBudgetData] = useState<{
    original_budget: number;
    approved_changes: number;
    revised_budget: number;
  } | null>(null);

  useEffect(() => {
    if (!project?.id || isClient) return;
    supabase
      .from("vw_project_budget")
      .select("original_budget,approved_changes,revised_budget")
      .eq("project_id", project.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setBudgetData({
          original_budget:  Number(data.original_budget)  || 0,
          approved_changes: Number(data.approved_changes) || 0,
          revised_budget:   Number(data.revised_budget)   || 0,
        });
      });
  }, [project?.id, isClient]);

  const [statusValue,   setStatusValue]   = useState(project.status);
  const [startDate,     setStartDate]     = useState(project.start_date || "");
  const [expectedDate,  setExpectedDate]  = useState(project.expected_completion_date || "");
  const [actualDate,    setActualDate]    = useState(project.actual_completion_date || "");
  const [dateError,     setDateError]     = useState("");

  const projectCreatedDate = project.created_at
    ? new Date(project.created_at).toISOString().split("T")[0]
    : null;

  // ── Date validation ────────────────────────────────────────────────────────
  // Start date is intentionally unconstrained relative to created_at — projects
  // can be logged retroactively, so a start date earlier than the DB row's
  // creation timestamp is a valid, real-world case.
  const validateDates = (start: string, expected: string, actual: string): string | null => {
    const s = start    ? new Date(start)    : null;
    const e = expected ? new Date(expected) : null;
    const a = actual   ? new Date(actual)   : null;
    const c = projectCreatedDate ? new Date(projectCreatedDate) : null;

    if (s && e && e < s) return "Expected completion date cannot be before start date";
    if (a && c && a < c) return "Actual completion date cannot be before the project was created";
    if (s && a && a < s) return "Actual completion date cannot be before start date";
    return null;
  };

  const handleStartDateChange = (v: string) => {
    setStartDate(v);
    setDateError(validateDates(v, expectedDate, actualDate) ?? "");
  };
  const handleExpectedDateChange = (v: string) => {
    setExpectedDate(v);
    setDateError(validateDates(startDate, v, actualDate) ?? "");
  };
  const handleActualDateChange = (v: string) => {
    setActualDate(v);
    setDateError(validateDates(startDate, expectedDate, v) ?? "");
  };

  // ── Edge Function: Update Project Status (no progress_percent) ─────────────
  const handleUpdateStatus = async () => {
    if (!canEdit) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-project-status", {
        body: { projectId: project.id, status: statusValue },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Failed to update status");
      alert("Project status updated successfully!");
      setIsEditingStatus(false);
      onProjectUpdate();
    } catch (err: any) {
      console.error("Error updating status:", err);
      alert(err.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  // ── Edge Function: Update Project Dates ────────────────────────────────────
  const handleUpdateDates = async () => {
    if (!canEdit) return;
    const validationError = validateDates(startDate, expectedDate, actualDate);
    if (validationError) { setDateError(validationError); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-project-dates", {
        body: {
          projectId: project.id,
          start_date:                startDate   || null,
          expected_completion_date:  expectedDate || null,
          actual_completion_date:    actualDate   || null,
        },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Failed to update dates");
      alert("Project dates updated successfully!");
      setIsEditingDates(false);
      setDateError("");
      onProjectUpdate();
    } catch (err: any) {
      console.error("Error updating dates:", err);
      alert(err.message || "Failed to update dates");
    } finally {
      setLoading(false);
    }
  };

  const currentStatus = statusOptions.find((s) => s.value === project.status) ?? statusOptions[0];

  // ── Progress bar colour ────────────────────────────────────────────────────
  const progressGradient =
    projectProgress === 100
      ? "from-green-400 to-green-500"
      : "from-primary to-accent";

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">

      {/* ── LEFT COLUMN ── */}
      <div className="lg:col-span-2 space-y-4 sm:space-y-8">

        {/* Project Status Card */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold">Project Status</h3>
            {canEdit && !isEditingStatus && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditingStatus(true)}
                className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
              >
                <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.button>
            )}
          </div>

          {isEditingStatus ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={statusValue}
                  onChange={(e) => setStatusValue(e.target.value)}
                  className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value} className="bg-background text-foreground">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleUpdateStatus} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-xl transition-all"
                >
                  <Save className="w-4 h-4" />
                  {loading ? "Saving..." : "Save"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setStatusValue(project.status); setIsEditingStatus(false); }}
                  className="px-4 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-xl text-sm font-semibold backdrop-blur-xl border ${currentStatus.color}`}>
                {currentStatus.label}
              </span>
            </div>
          )}
        </GlassCard>

        {/* ════════════════════════════════════════════════════════
            PROJECT PROGRESS CARD
            ── Read-only for ALL users. No edit button. No input. ──
            Value = projectProgress prop (task-driven from MilestonesTab).
            Changes only when tasks are marked done in the Tasks tab.
            ════════════════════════════════════════════════════════ */}
        <GlassCard>
          <div className="mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold">Project Progress</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Automatically calculated from completed tasks across all milestones
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium text-sm sm:text-base">Overall Progress</span>
              <span className="font-bold text-primary text-lg sm:text-xl tabular-nums">
                {projectProgress}%
              </span>
            </div>

            {/* Bar — purely display, no interactive elements */}
            <div className="w-full bg-white/10 rounded-full h-3 sm:h-4 overflow-hidden backdrop-blur-xl border border-white/20">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${projectProgress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`bg-gradient-to-r ${progressGradient} h-full rounded-full`}
              />
            </div>

            {/* Summary line */}
            <p className="text-xs text-muted-foreground">
              {tasks.filter((t) => t.status === "done").length} of {tasks.length} tasks marked done
              {milestones.length > 0 && ` · ${milestones.length} milestone${milestones.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </GlassCard>

        {/* Key Dates Card — unchanged from original */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold">Key Dates</h3>
            {canEdit && !isEditingDates && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setIsEditingDates(true); setDateError(""); }}
                className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
              >
                <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.button>
            )}
          </div>

          {isEditingDates ? (
            <div className="space-y-4">
              {dateError && (
                <div className="flex items-start gap-2 p-3 backdrop-blur-xl bg-red-500/20 border border-red-500/30 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{dateError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground
                    [&::-webkit-calendar-picker-indicator]:cursor-pointer
                    [&::-webkit-calendar-picker-indicator]:opacity-70
                    [&::-webkit-calendar-picker-indicator]:hover:opacity-100
                    [&::-webkit-calendar-picker-indicator]:transition-opacity
                    [&::-webkit-datetime-edit]:text-foreground
                    [&::-webkit-datetime-edit-fields-wrapper]:text-foreground
                    [&::-webkit-datetime-edit-text]:text-muted-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Expected Completion</label>
                <input
                  type="date"
                  value={expectedDate}
                  min={startDate || projectCreatedDate || undefined}
                  onChange={(e) => handleExpectedDateChange(e.target.value)}
                  className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground
                    [&::-webkit-calendar-picker-indicator]:cursor-pointer 
                    [&::-webkit-calendar-picker-indicator]:opacity-70
                    [&::-webkit-calendar-picker-indicator]:hover:opacity-100
                    [&::-webkit-calendar-picker-indicator]:transition-opacity
                    [&::-webkit-datetime-edit]:text-foreground
                    [&::-webkit-datetime-edit-fields-wrapper]:text-foreground
                    [&::-webkit-datetime-edit-text]:text-muted-foreground"
                />
                {startDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Cannot be before start date ({format(new Date(startDate), "dd MMM yyyy")})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Actual Completion (if completed)</label>
                <input
                  type="date"
                  value={actualDate}
                  min={projectCreatedDate || undefined}
                  onChange={(e) => handleActualDateChange(e.target.value)}
                  className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground
                    [&::-webkit-calendar-picker-indicator]:cursor-pointer 
                    [&::-webkit-calendar-picker-indicator]:opacity-70
                    [&::-webkit-calendar-picker-indicator]:hover:opacity-100
                    [&::-webkit-calendar-picker-indicator]:transition-opacity
                    [&::-webkit-datetime-edit]:text-foreground
                    [&::-webkit-datetime-edit-fields-wrapper]:text-foreground
                    [&::-webkit-datetime-edit-text]:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">Cannot be before project creation</p>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleUpdateDates}
                  disabled={loading || !!dateError}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed text-background font-semibold rounded-xl transition-all"
                >
                  <Save className="w-4 h-4" />
                  {loading ? "Saving..." : "Save"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setStartDate(project.start_date || "");
                    setExpectedDate(project.expected_completion_date || "");
                    setActualDate(project.actual_completion_date || "");
                    setDateError("");
                    setIsEditingDates(false);
                  }}
                  className="px-4 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">Start Date</p>
                <p className="text-base sm:text-lg font-semibold">
                  {project.start_date ? format(new Date(project.start_date), "dd MMM yyyy") : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">Expected Completion</p>
                <p className="text-base sm:text-lg font-semibold">
                  {project.expected_completion_date
                    ? format(new Date(project.expected_completion_date), "dd MMM yyyy")
                    : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">Actual Completion</p>
                <p className="text-base sm:text-lg font-semibold">
                  {project.actual_completion_date
                    ? format(new Date(project.actual_completion_date), "dd MMM yyyy")
                    : "Ongoing"}
                </p>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Project Description — unchanged */}
        <GlassCard>
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 sm:mb-6">Project Description</h3>
          <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
            {project.description || "No description provided"}
          </p>
        </GlassCard>
      </div>

      {/* ── RIGHT COLUMN ── */}
      <div className="space-y-4 sm:space-y-8">

        {/* Budget Summary — shows revised budget when approved COs exist */}
        {!isClient && (
          <GlassCard>
            <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4">Budget Summary</h3>
            <div className="text-xl sm:text-2xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-1 break-all">
              {(budgetData?.revised_budget ?? project.budget_numeric ?? 0).toLocaleString()}{" "}
              {project.currency || "KES"}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3">
              {budgetData?.approved_changes && budgetData.approved_changes > 0
                ? "Revised Contract Value"
                : "Total Project Budget"}
            </p>

            {/* Breakdown — only when approved change orders exist */}
            {budgetData && budgetData.approved_changes > 0 && (
              <div className="border-t border-white/10 pt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Original Budget</span>
                  <span className="font-mono text-foreground/80">
                    {budgetData.original_budget.toLocaleString()} {project.currency || "KES"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-400/80 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Approved Change Orders
                  </span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    +{budgetData.approved_changes.toLocaleString()} {project.currency || "KES"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
                  <span className="font-semibold text-foreground">Revised Total</span>
                  <span className="font-mono font-bold text-primary">
                    {budgetData.revised_budget.toLocaleString()} {project.currency || "KES"}
                  </span>
                </div>
              </div>
            )}
          </GlassCard>
        )}

        {/* ════════════════════════════════════════════════════
            QUICK STATS
            - documents count → documentsCount prop (auto from DB)
            - updates count   → updatesCount prop (auto from DB)
            - tasks / milestones → from their arrays as before
            ════════════════════════════════════════════════════ */}
        <GlassCard>
          <h3 className="text-base sm:text-lg md:text-xl font-bold mb-4 sm:mb-6">Quick Stats</h3>
          <div className="space-y-4 sm:space-y-5">
            {[
              { label: "Milestones", value: milestones.length,  icon: Calendar      },
              ...(isClient ? [] : [{ label: "Tasks", value: tasks.length, icon: CheckCircle2 }]),
              { label: "Updates",   value: updatesCount,        icon: MessageSquare },
              { label: "Documents", value: documentsCount,      icon: FileText      },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    <span className="text-xs sm:text-sm md:text-base">{stat.label}</span>
                  </div>
                  <span className="text-base sm:text-lg md:text-xl font-bold text-primary">{stat.value}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Timeline — unchanged */}
        <GlassCard>
          <h3 className="text-base sm:text-lg md:text-xl font-bold mb-4 sm:mb-6">Timeline</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 backdrop-blur-xl bg-primary/20 border border-primary/30 rounded-lg">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-sm font-semibold">
                  {project.start_date && project.expected_completion_date
                    ? `${Math.ceil(
                        (new Date(project.expected_completion_date).getTime() -
                          new Date(project.start_date).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )} days`
                    : "Not calculated"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 backdrop-blur-xl bg-accent/20 border border-accent/30 rounded-lg">
                <TrendingUp className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm font-semibold">{currentStatus.label}</p>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}