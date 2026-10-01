// src/components/projects/tabs/MilestonesTab.tsx
import { useState, useEffect, useCallback } from "react";
import { format, isAfter, isBefore, parseISO, startOfDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";
import {
  Calendar,
  Plus,
  Edit2,
  GripVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  ListTodo,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { projectApi } from "@/lib/api/projectApi";
import { Milestone, MilestoneStatus } from "@/types/project";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description: string | null;
  // 'done' is the completed state in your DB constraint
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  milestone_id: string | null;
  project_id: string;
  assigned_to: string | null;
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  // joined from workers table via tasks_assigned_to_fkey
  worker?: { id: string; full_name: string } | null;
}

interface MilestonesTabProps {
  projectId: string;
  milestones: Milestone[];
  canEdit: boolean;
  onUpdate: () => void;
  /**
   * Fires every time overall project progress recalculates.
   * Wire this to a useState setter in your project home page and client page
   * to drive the top-level project progress bar.
   *
   * Example:
   *   const [projectProgress, setProjectProgress] = useState(0);
   *   <MilestonesTab ... onProgressChange={setProjectProgress} />
   */
  onProgressChange?: (overallPercent: number) => void;
}

interface ProjectDates {
  start_date: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ███  PROGRESS CALCULATION — TASK COUNT ONLY, NO DATES  ███
//
// Formula:  progress = (tasks where status='done') / (total tasks) * 100
//
// Dates are NEVER used in this calculation. Dates only affect the milestone
// STATUS badge (not_started / in_progress / completed / delayed).
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true only when the task's status matches your DB enum value 'done' */
function isTaskDone(task: Task): boolean {
  return task.status === "done";
}

/**
 * Progress for a single milestone.
 * Returns 0 when the milestone has no tasks yet (bar stays empty).
 * Returns 100 only when every linked task has status='done'.
 */
function milestoneProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const doneCount = tasks.filter(isTaskDone).length;
  return Math.round((doneCount / tasks.length) * 100);
}

/**
 * Project-level progress = simple average of all milestone progresses.
 * This is what feeds the project home bar and the client view bar.
 */
function projectProgress(
  milestones: Milestone[],
  tasksByMilestone: Record<string, Task[]>
): number {
  if (milestones.length === 0) return 0;
  const sum = milestones.reduce(
    (acc, m) => acc + milestoneProgress(tasksByMilestone[m.id] ?? []),
    0
  );
  return Math.round(sum / milestones.length);
}

/**
 * Milestone STATUS badge — this is the only place dates are used.
 * Progress percentage is NOT changed here, only the label/colour.
 */
function milestoneBadgeStatus(
  progress: number,
  milestone: Milestone
): MilestoneStatus {
  if (progress === 100) return "completed";
  if (progress > 0) return "in_progress";
  // 0% and planned end has already passed → delayed
  if (
    milestone.planned_end_date &&
    isAfter(new Date(), parseISO(milestone.planned_end_date))
  ) {
    return "delayed";
  }
  return "not_started";
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started", color: "bg-gray-500/20 text-gray-300 border-gray-500/30",        icon: Clock         },
  { value: "in_progress", label: "In Progress",  color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: Clock         },
  { value: "completed",   label: "Completed",    color: "bg-green-500/20 text-green-300 border-green-500/30",    icon: CheckCircle2  },
  { value: "delayed",     label: "Delayed",      color: "bg-red-500/20 text-red-300 border-red-500/30",          icon: AlertCircle   },
];

const TASK_LABEL: Record<Task["status"], string> = {
  todo:        "To Do",
  in_progress: "In Progress",
  review:      "In Review",
  done:        "Done",
};

const TASK_COLOR: Record<Task["status"], string> = {
  todo:        "bg-gray-500/20 text-gray-300 border-gray-500/30",
  in_progress: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  review:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
  done:        "bg-green-500/20 text-green-300 border-green-500/30",
};

// ─────────────────────────────────────────────────────────────────────────────
// GlassCard
// ─────────────────────────────────────────────────────────────────────────────

const GlassCard = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}
  >
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function MilestonesTab({
  projectId,
  milestones,
  canEdit,
  onUpdate,
  onProgressChange,
}: MilestonesTabProps) {
  // ── state ──────────────────────────────────────────────────────────────────
  const [projectDates, setProjectDates] = useState<ProjectDates | null>(null);
  const [dynamicMilestones, setDynamicMilestones] = useState<Milestone[]>(milestones);

  /**
   * The single source of truth for progress.
   * Keys = milestone IDs. Values = Task[] for that milestone.
   * When this changes, all progress bars re-render automatically.
   */
  const [tasksByMilestone, setTasksByMilestone] = useState<Record<string, Task[]>>({});

  const [editingId, setEditingId]             = useState<string | null>(null);
  const [editForm, setEditForm]               = useState<Partial<Milestone>>({});
  const [loading, setLoading]                 = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [draggedItem, setDraggedItem]         = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks]     = useState<Record<string, boolean>>({});

  // ── fetch project dates ────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("start_date, created_at")
      .eq("id", projectId)
      .single()
      .then(({ data }) => setProjectDates(data ?? null));
  }, [projectId]);

  // ── keep local milestones in sync with prop ────────────────────────────────
  useEffect(() => {
    setDynamicMilestones(milestones);
  }, [milestones]);

  // ── fetch tasks from DB ────────────────────────────────────────────────────
  /**
   * Pulls every task for this project that has a milestone_id set,
   * joins the assigned worker name, then groups by milestone_id.
   *
   * This is the ONLY place that determines what progress each bar shows.
   */
  const fetchTasks = useCallback(async () => {
    if (!projectId) return;

    const { data, error } = await supabase
      .from("tasks")
      .select(
        `id,
         title,
         description,
         status,
         priority,
         milestone_id,
         project_id,
         assigned_to,
         due_date,
         start_date,
         completed_at,
         worker:workers!tasks_assigned_to_fkey ( id, full_name )`
      )
      .eq("project_id", projectId)
      .not("milestone_id", "is", null);   // only tasks linked to a milestone

    if (error) {
      return;
    }

    // Group by milestone_id
    const grouped: Record<string, Task[]> = {};
    for (const task of (data ?? []) as Task[]) {
      if (!task.milestone_id) continue;
      grouped[task.milestone_id] ??= [];
      grouped[task.milestone_id].push(task);
    }

    setTasksByMilestone(grouped);
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ── realtime: re-fetch whenever any task in this project changes ───────────
  /**
   * Covers all cases:
   *  - Task created with a milestone_id          → bar appears / updates
   *  - Task status changed to 'done'             → bar advances
   *  - Task status changed from 'done' to other  → bar retreats
   *  - Task deleted                              → bar recalculates
   *  - Task's milestone_id changed               → moves between milestones
   */
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`tasks-progress-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",            // INSERT, UPDATE, DELETE
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${projectId}`,
        },
        () => fetchTasks()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, fetchTasks]);

  // ── bubble overall project progress to parent ──────────────────────────────
  useEffect(() => {
    if (!onProgressChange) return;
    const overall = projectProgress(dynamicMilestones, tasksByMilestone);
    onProgressChange(overall);
  }, [dynamicMilestones, tasksByMilestone, onProgressChange]);

  // ── date helpers (only used for validation, never for progress) ────────────
  const getProjectStart = useCallback((): Date | null => {
    if (!projectDates) return null;
    return startOfDay(parseISO(projectDates.start_date ?? projectDates.created_at));
  }, [projectDates]);

  const minDateStr = (): string => {
    if (!projectDates) return "2020-01-01";
    return projectDates.start_date
      ? projectDates.start_date
      : format(new Date(projectDates.created_at), "yyyy-MM-dd");
  };

  const validateDates = useCallback(
    (form: Partial<Milestone>): string | null => {
      const start = getProjectStart();
      if (!start) return null; // skip validation if dates unavailable

      const ps  = form.planned_start_date ? parseISO(form.planned_start_date) : null;
      const pe  = form.planned_end_date   ? parseISO(form.planned_end_date)   : null;
      const as_ = form.actual_start_date  ? parseISO(form.actual_start_date)  : null;
      const ae  = form.actual_end_date    ? parseISO(form.actual_end_date)    : null;

      if ([ps, pe, as_, ae].filter(Boolean).some((d) => isBefore(d!, start)))
        return `Dates cannot be before project start (${format(start, "MMM dd, yyyy")}).`;
      if (ps && pe && isAfter(ps, pe))   return "Planned start cannot be after planned end.";
      if (as_ && ae && isAfter(as_, ae)) return "Actual start cannot be after actual end.";
      if (ae && isAfter(ae, new Date())) return "Actual end cannot be in the future.";
      return null;
    },
    [getProjectStart]
  );

  // ── save milestone ─────────────────────────────────────────────────────────
  const handleUpdateMilestone = async () => {
    if (!editingId || !canEdit) return;
    const err = validateDates(editForm);
    if (err) { toast({ title: err, variant: "destructive" }); return; }

    setLoading(true);
    try {
      await projectApi.updateMilestone(editingId, {
        title:              editForm.title,
        description:        editForm.description,
        planned_start_date: editForm.planned_start_date,
        planned_end_date:   editForm.planned_end_date,
        actual_start_date:  editForm.actual_start_date,
        actual_end_date:    editForm.actual_end_date,
        // progress_percent and status are NOT stored — they are always derived
        // from tasks at render time, so stored values are irrelevant.
      });
      setEditingId(null);
      setEditForm({});
      onUpdate();
    } catch (e: any) {
      toast({ title: e.message ?? "Failed to update milestone", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── reorder ────────────────────────────────────────────────────────────────
  const handleReorder = async (fromIdx: number, toIdx: number) => {
    if (!canEdit) return;
    const arr = [...dynamicMilestones];
    const [item] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, item);
    setLoading(true);
    try {
      await projectApi.reorderMilestones(
        arr.map((m, i) => ({ id: m.id, sort_order: i * 100 }))
      );
      onUpdate();
    } catch (e: any) {
      toast({ title: e.message ?? "Failed to reorder", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── edit helpers ───────────────────────────────────────────────────────────
  const startEdit = (m: Milestone) => {
    setEditingId(m.id);
    setEditForm({
      title:              m.title,
      description:        m.description,
      planned_start_date: m.planned_start_date,
      planned_end_date:   m.planned_end_date,
      actual_start_date:  m.actual_start_date,
      actual_end_date:    m.actual_end_date,
    });
  };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  // ── drag handlers ──────────────────────────────────────────────────────────
  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === dropId) return;
    const from = dynamicMilestones.findIndex((m) => m.id === draggedItem);
    const to   = dynamicMilestones.findIndex((m) => m.id === dropId);
    if (from !== -1 && to !== -1) handleReorder(from, to);
    setDraggedItem(null);
  };

  // ── overall project-level number (also shown in the summary card) ──────────
  const overallPercent = projectProgress(dynamicMilestones, tasksByMilestone);

  // ─────────────────────────────────────────────────────────────────────────
  // Render single milestone card
  // ─────────────────────────────────────────────────────────────────────────
  const renderMilestone = (milestone: Milestone, idx: number) => {
    const tasks      = tasksByMilestone[milestone.id] ?? [];
    const pct        = milestoneProgress(tasks);          // ← task count only
    const badge      = milestoneBadgeStatus(pct, milestone);
    const badgeCfg   = STATUS_OPTIONS.find((s) => s.value === badge) ?? STATUS_OPTIONS[0];
    const BadgeIcon  = badgeCfg.icon;
    const isEditing  = editingId === milestone.id;
    const doneCount  = tasks.filter(isTaskDone).length;
    const showTasks  = expandedTasks[milestone.id] ?? false;

    return (
      <motion.div
        key={milestone.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.05 }}
        draggable={canEdit && !isEditing}
        onDragStart={(e) => onDragStart(e, milestone.id)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, milestone.id)}
        className={draggedItem === milestone.id ? "opacity-50" : ""}
      >
        <GlassCard className="relative">
          {canEdit && !isEditing && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2 cursor-move opacity-30 hover:opacity-100 transition-opacity">
              <GripVertical className="w-5 h-5 text-muted-foreground" />
            </div>
          )}

          <div className={canEdit && !isEditing ? "pl-6" : ""}>
            {isEditing ? (
              /* ── EDIT MODE ────────────────────────────────── */
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={editForm.title ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={editForm.description ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(
                    [
                      { label: "Planned Start", key: "planned_start_date" as const, max: "" },
                      { label: "Planned End",   key: "planned_end_date"   as const, max: "" },
                      { label: "Actual Start",  key: "actual_start_date"  as const, max: "" },
                      { label: "Actual End",    key: "actual_end_date"    as const, max: format(new Date(), "yyyy-MM-dd") },
                    ]
                  ).map(({ label, key, max }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium mb-2">{label}</label>
                      <input
                        type="date"
                        min={minDateStr()}
                        {...(max ? { max } : {})}
                        value={(editForm[key] as string) ?? ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, [key]: e.target.value || null })
                        }
                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  ))}
                </div>

                {/* Progress preview — read-only, task-driven */}
                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium flex items-center gap-2">
                      <ListTodo className="w-4 h-4" />
                      Task progress
                    </span>
                    <span className="font-bold text-primary">{pct}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden border border-white/20">
                    <motion.div
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full rounded-full bg-gradient-to-r ${
                        pct === 100 ? "from-green-400 to-green-500" : "from-primary to-accent"
                      }`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {doneCount} of {tasks.length} tasks marked done
                    {tasks.length === 0 && " — link tasks to this milestone in the Tasks tab"}
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-1">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleUpdateMilestone}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-xl transition-all"
                  >
                    {loading ? "Saving…" : "Save Changes"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={cancelEdit}
                    disabled={loading}
                    className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
                  >
                    Cancel
                  </motion.button>
                </div>
              </div>
            ) : (
              /* ── VIEW MODE ───────────────────────────────────── */
              <div>
                {/* Header row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-base sm:text-lg md:text-xl font-bold break-words">
                        {milestone.title}
                      </h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        #{idx + 1}
                      </span>
                    </div>
                    {milestone.description && (
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {milestone.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Status badge — derived from task progress + dates */}
                    <span
                      className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold backdrop-blur-xl border whitespace-nowrap flex items-center gap-1.5 ${badgeCfg.color}`}
                    >
                      <BadgeIcon className="w-3.5 h-3.5" />
                      {badgeCfg.label}
                    </span>
                    {canEdit && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => startEdit(milestone)}
                        className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* ════════════════════════════════════════════
                    PROGRESS BAR — task count only, no date math
                    ════════════════════════════════════════════ */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs sm:text-sm mb-2">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <ListTodo className="w-3.5 h-3.5" />
                      {tasks.length === 0
                        ? "No tasks linked yet"
                        : `${doneCount} / ${tasks.length} tasks done`}
                    </span>
                    <span className="font-bold text-primary">{pct}%</span>
                  </div>

                  {/* The bar width = pct, which = doneCount/tasks.length*100 */}
                  <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden backdrop-blur-xl border border-white/20">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className={`h-full rounded-full bg-gradient-to-r ${
                        pct === 100
                          ? "from-green-400 to-green-500"
                          : pct > 0
                          ? "from-primary to-accent"
                          : "from-gray-600 to-gray-500"
                      }`}
                    />
                  </div>
                </div>

                {/* Dates display (informational only) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">Planned:&nbsp;</span>
                    <span className="font-medium">
                      {milestone.planned_start_date
                        ? format(new Date(milestone.planned_start_date), "dd MMM")
                        : "N/A"}
                      {" – "}
                      {milestone.planned_end_date
                        ? format(new Date(milestone.planned_end_date), "dd MMM yyyy")
                        : "N/A"}
                    </span>
                  </div>
                  {(milestone.actual_start_date || milestone.actual_end_date) && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                      <span className="text-muted-foreground">Actual:&nbsp;</span>
                      <span className="font-medium">
                        {milestone.actual_start_date
                          ? format(new Date(milestone.actual_start_date), "dd MMM")
                          : "N/A"}
                        {" – "}
                        {milestone.actual_end_date
                          ? format(new Date(milestone.actual_end_date), "dd MMM yyyy")
                          : "Ongoing"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tasks list (expandable — visible to client too) */}
                {tasks.length > 0 ? (
                  <div>
                    <button
                      onClick={() =>
                        setExpandedTasks((prev) => ({
                          ...prev,
                          [milestone.id]: !prev[milestone.id],
                        }))
                      }
                      className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                    >
                      <ListTodo className="w-3.5 h-3.5" />
                      {showTasks ? "Hide" : "Show"} tasks ({tasks.length})
                      {showTasks
                        ? <ChevronUp className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <AnimatePresence>
                      {showTasks && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2 overflow-hidden"
                        >
                          {tasks.map((task) => (
                            <div
                              key={task.id}
                              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3 flex items-start gap-3"
                            >
                              {isTaskDone(task) ? (
                                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                              ) : (
                                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 justify-between">
                                  <span
                                    className={`text-sm font-medium truncate ${
                                      isTaskDone(task)
                                        ? "line-through text-muted-foreground"
                                        : ""
                                    }`}
                                  >
                                    {task.title}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-lg text-xs border whitespace-nowrap flex-shrink-0 ${TASK_COLOR[task.status]}`}
                                  >
                                    {TASK_LABEL[task.status]}
                                  </span>
                                </div>

                                {task.worker && (
                                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                    <User className="w-3 h-3" />
                                    {task.worker.full_name}
                                  </div>
                                )}

                                {task.due_date && (
                                  <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                                    <Calendar className="w-3 h-3" />
                                    Due {format(new Date(task.due_date), "dd MMM yyyy")}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ListTodo className="w-3.5 h-3.5" />
                    No tasks linked — set a task's milestone in the Tasks tab to track progress here.
                  </p>
                )}
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Page
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">
            Project Milestones
          </h3>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            {dynamicMilestones.length} milestone
            {dynamicMilestones.length !== 1 ? "s" : ""} •{" "}
            {canEdit ? "Drag to reorder" : "View only"}
          </p>
        </div>
        {canEdit && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl text-sm sm:text-base w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Add Milestone
          </motion.button>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          OVERALL PROJECT PROGRESS SUMMARY CARD
          Shows on both editor view and client view.
          Feeds onProgressChange so the project home bar updates too.
          ════════════════════════════════════════════════════════ */}
      {dynamicMilestones.length > 0 && (
        <GlassCard className="!p-4 sm:!p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold">Overall Project Progress</span>
            <span className="font-bold text-primary">{overallPercent}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden backdrop-blur-xl border border-white/20">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full rounded-full bg-gradient-to-r ${
                overallPercent === 100
                  ? "from-green-400 to-green-500"
                  : "from-primary to-accent"
              }`}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Average across {dynamicMilestones.length} milestone
            {dynamicMilestones.length !== 1 ? "s" : ""} — updates live when tasks are marked done
          </p>
        </GlassCard>
      )}

      {/* Milestones list */}
      {dynamicMilestones.length === 0 ? (
        <GlassCard className="text-center py-12 sm:py-16">
          <Calendar className="w-16 h-16 sm:w-20 sm:h-20 text-primary/30 mx-auto mb-4 sm:mb-6" />
          <p className="text-base sm:text-xl text-muted-foreground mb-4 sm:mb-6">
            No milestones yet
          </p>
          {canEdit && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-primary hover:text-primary/80 font-semibold text-base sm:text-lg"
            >
              Create your first milestone
            </button>
          )}
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {dynamicMilestones.map((m, idx) => renderMilestone(m, idx))}
        </div>
      )}

      {/* Create modal placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl backdrop-blur-xl bg-background/95 border border-white/20 rounded-2xl p-6"
          >
            <h3 className="text-2xl font-bold mb-4">Create New Milestone</h3>
            <p className="text-muted-foreground mb-6">Milestone creation coming soon.</p>
            <button
              onClick={() => setShowCreateModal(false)}
              className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WIRING THE PROJECT HOME BAR  (ProjectHomePage + ClientPage)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const [projectProgress, setProjectProgress] = useState(0);

  <MilestonesTab
    projectId={projectId}
    milestones={milestones}
    canEdit={isEditor}                       // false = client (read-only)
    onUpdate={refetch}
    onProgressChange={setProjectProgress}    // ← drives home + client bar
  />

  // Your project-level bar anywhere on the home / client page:
  <div className="w-full bg-white/10 rounded-full h-3 border border-white/20 overflow-hidden">
    <div
      style={{ width: `${projectProgress}%` }}
      className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
    />
  </div>
  <span>{projectProgress}%</span>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRED: Enable Supabase Realtime on the tasks table
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dashboard → Database → Replication → toggle ON `tasks`
This makes bars update live when a worker marks a task done.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW PROGRESS IS CALCULATED (summary)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Milestone bar  = tasks where status='done'  ÷  total tasks  × 100
Project bar    = average of all milestone bars
Dates are NEVER used in the calculation — only in the status badge.
*/