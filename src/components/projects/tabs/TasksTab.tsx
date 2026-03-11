// src/components/projects/tabs/TasksTab.tsx
import { useState, useEffect, useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Flag,
  X,
  Clock,
  AlertCircle,
  Check,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Lock,
} from "lucide-react";
import { projectApi } from "@/lib/api/projectApi";
import { Task, Milestone } from "@/types/project";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Worker {
  id: string;
  full_name: string;
  role: string;
  status: string;
}

interface TasksTabProps {
  projectId: string;
  tasks: (Task & {
    assigned_worker?: { id: string; full_name: string; role: string } | null;
  })[];
  milestones: Milestone[];
  workers: Worker[];
  canEdit: boolean;
  onUpdate: () => void;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
}

// ─── Priority config (kept for display only — not in form) ────────────────────

const priorityConfig = {
  low:    { label: "Low",    color: "bg-blue-500/20 text-blue-300 border-blue-500/30",     icon: Flag },
  medium: { label: "Medium", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: Flag },
  high:   { label: "High",   color: "bg-orange-500/20 text-orange-300 border-orange-500/30", icon: Flag },
  urgent: { label: "Urgent", color: "bg-red-500/20 text-red-300 border-red-500/30",         icon: AlertCircle },
};

const statusConfig = {
  todo:        { label: "To Do",       color: "text-gray-400" },
  in_progress: { label: "In Progress", color: "text-yellow-400" },
  review:      { label: "Review",      color: "text-blue-400" },
  done:        { label: "Done",        color: "text-green-400" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Tomorrow's ISO date string (YYYY-MM-DD).
 * Start date must be at least tomorrow — never today.
 */
const getTomorrowISO = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

const calculateDaysRemaining = (dueDate: string | null): number | null => {
  if (!dueDate) return null;
  return differenceInDays(new Date(dueDate), new Date());
};

/**
 * Colour rules:
 *   ≥ 4 days → green
 *   2–3 days → orange
 *   ≤ 1 day, 0, or overdue → red
 *   null → muted
 */
const getDaysRemainingColor = (days: number | null): string => {
  if (days === null) return "text-muted-foreground";
  if (days >= 4) return "text-green-400";
  if (days >= 2) return "text-orange-400";
  return "text-red-400"; // covers 1, 0, and negative (overdue)
};

const getDaysRemainingLabel = (days: number | null): string => {
  if (days === null) return "";
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""}`;
  if (days === 0) return "Due today";
  return `${days} day${days !== 1 ? "s" : ""} left`;
};

// ─── Shared UI primitives ─────────────────────────────────────────────────────

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6
                hover:bg-white/15 transition-all duration-300 ${className}`}
  >
    {children}
  </div>
);

/** Visually communicates that a field is auto-filled and non-editable. */
const ReadOnlyField = ({
  label,
  value,
  hint = "Auto-filled — not editable",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ElementType;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </label>
    <div className="relative">
      <input
        type="text"
        value={value || "—"}
        readOnly
        tabIndex={-1}
        className="w-full px-4 py-3 rounded-xl text-sm font-normal
                   bg-white/[0.03] border border-white/[0.06]
                   text-muted-foreground cursor-not-allowed select-none"
      />
      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
    </div>
    <span className="text-[10px] text-muted-foreground/50 leading-tight">{hint}</span>
  </div>
);

// ─── Toast ────────────────────────────────────────────────────────────────────

const ToastNotification: React.FC<{
  toast: Toast;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const config = {
    success: {
      icon: <Check className="w-5 h-5" />,
      bg: "bg-green-500/20", border: "border-green-500/50", text: "text-green-200",
    },
    error: {
      icon: <XCircle className="w-5 h-5" />,
      bg: "bg-red-500/20", border: "border-red-500/50", text: "text-red-200",
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5" />,
      bg: "bg-yellow-500/20", border: "border-yellow-500/50", text: "text-yellow-200",
    },
  };

  const { icon, bg, border, text } = config[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`flex items-center gap-3 min-w-80 max-w-md backdrop-blur-xl
                  ${bg} ${border} ${text} border rounded-xl shadow-2xl p-4
                  cursor-pointer hover:opacity-90 transition-all pointer-events-auto`}
      onClick={() => onDismiss(toast.id)}
    >
      <div className="p-2 bg-white/20 rounded-lg">{icon}</div>
      <p className="font-medium text-sm">{toast.message}</p>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}
        className="ml-auto opacity-70 hover:opacity-100"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TasksTab({
  projectId,
  tasks = [],
  milestones = [],
  workers = [],       // kept in props for future use / parent compat
  canEdit,
  onUpdate,
}: TasksTabProps) {
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [showFormForMilestone, setShowFormForMilestone] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    milestoneId: string;
    taskId: string;
  } | null>(null);

  // ── Form state ──────────────────────────────────────────────────────────────
  // NOTE: assigned_to is always null (set by WorkersTab).
  //       status is always 'todo' on create (toggled via checkbox / WorkersTab).
  //       Neither field is exposed in the UI form.
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    milestone_id: "",
    start_date: "",
    due_date: "",
  });

  // editForm only carries fields the user can actually change.
  const [editForm, setEditForm] = useState<{
    id?: string;
    title?: string;
    description?: string;
    milestone_id?: string;
    start_date?: string;
    due_date?: string;
    // carried through for DB write but never shown in form:
    status?: string;
    assigned_to?: string | null;
    priority?: string;
  }>({});

  // ── Computed ─────────────────────────────────────────────────────────────────

  const tomorrowISO = useMemo(getTomorrowISO, []);

  // Group tasks by milestone
  const tasksByMilestone = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      const key = task.milestone_id || "unassigned";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });
    return grouped;
  }, [tasks]);

  // ── Toast helpers ─────────────────────────────────────────────────────────

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // ── Date validation ──────────────────────────────────────────────────────

  /**
   * Rules:
   * 1. Start date must be >= tomorrow (never today).
   * 2. Due date must be >= start date (or >= tomorrow if no start date set).
   */
  const validateDates = (startDate: string, dueDate: string): { valid: boolean; message: string } => {
    const tomorrow = new Date(tomorrowISO);

    if (startDate) {
      const start = new Date(startDate);
      if (start < tomorrow) {
        return {
          valid: false,
          message: "Start date must be at least tomorrow. Tasks cannot begin today or in the past.",
        };
      }
    }

    if (dueDate && startDate) {
      const start = new Date(startDate);
      const due = new Date(dueDate);
      if (due < start) {
        return {
          valid: false,
          message: "Due date must be on or after the start date.",
        };
      }
    }

    if (dueDate && !startDate) {
      const due = new Date(dueDate);
      if (due < tomorrow) {
        return {
          valid: false,
          message: "Due date must be on or after tomorrow.",
        };
      }
    }

    return { valid: true, message: "" };
  };

  // ── UI actions ──────────────────────────────────────────────────────────

  const toggleMilestone = (milestoneId: string) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(milestoneId)) next.delete(milestoneId);
      else next.add(milestoneId);
      return next;
    });
  };

  const openAddForm = (milestoneId: string) => {
    setCreateForm({ title: "", description: "", milestone_id: milestoneId, start_date: "", due_date: "" });
    setEditForm({});
    setShowFormForMilestone(milestoneId);
    setExpandedMilestones((prev) => new Set([...prev, milestoneId]));
  };

  const resetForm = () => {
    setShowFormForMilestone(null);
    setEditForm({});
    setCreateForm({ title: "", description: "", milestone_id: "", start_date: "", due_date: "" });
  };

  const startEdit = (task: Task, milestoneId: string) => {
    setEditForm({
      id: task.id,
      title: task.title,
      description: task.description || "",
      milestone_id: task.milestone_id || "",
      start_date: task.start_date ? task.start_date.split("T")[0] : "",
      due_date: task.due_date ? task.due_date.split("T")[0] : "",
      // Carry through silently — not shown in form
      status: task.status,
      assigned_to: (task as any).assigned_to ?? null,
      priority: task.priority || "medium",
    });
    setShowFormForMilestone(milestoneId);
    setExpandedMilestones((prev) => new Set([...prev, milestoneId]));
  };

  // ── CRUD ────────────────────────────────────────────────────────────────

  const handleCreateTask = async () => {
    if (!createForm.title.trim()) return showToast("Task title is required", "warning");
    if (!createForm.milestone_id) return showToast("Milestone is required", "warning");

    const validation = validateDates(createForm.start_date, createForm.due_date);
    if (!validation.valid) return showToast(validation.message, "warning");

    setLoading(true);
    try {
      await projectApi.createTask({
        project_id: projectId,
        title: createForm.title.trim(),
        description: createForm.description || null,
        // ── LOCKED — never set by this form ──
        assigned_to: null,
        status: "todo",
        priority: "medium",
        // ────────────────────────────────────
        milestone_id: createForm.milestone_id,
        start_date: createForm.start_date || null,
        due_date: createForm.due_date || null,
      });

      showToast("Task created successfully!", "success");
      resetForm();
      onUpdate();
    } catch (err: any) {
      showToast(err.message || "Failed to create task", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTask = async (taskId: string) => {
    const validation = validateDates(editForm.start_date || "", editForm.due_date || "");
    if (!validation.valid) return showToast(validation.message, "warning");

    setLoading(true);
    try {
      // Only update fields the user is allowed to change.
      // status and assigned_to are preserved from the existing DB record
      // (we carry them in editForm silently so they are not lost).
      await projectApi.updateTask(taskId, {
        title: editForm.title?.trim() || "",
        description: editForm.description || null,
        milestone_id: editForm.milestone_id || null,
        start_date: editForm.start_date || null,
        due_date: editForm.due_date || null,
        // Preserve — not changed by this form
        status: editForm.status || "todo",
        assigned_to: editForm.assigned_to ?? null,
        priority: editForm.priority || "medium",
        // completed_at: only set when status transitions to done (via toggle)
        completed_at: editForm.status === "done" ? new Date().toISOString() : null,
      });

      showToast("Task updated successfully!", "success");
      resetForm();
      onUpdate();
    } catch (err: any) {
      showToast(err.message || "Failed to update task", "error");
    } finally {
      setLoading(false);
    }
  };

  const deleteTask = async (milestoneId: string, taskId: string) => {
    setLoading(true);
    try {
      await projectApi.deleteTask(taskId);
      showToast("Task deleted successfully!", "success");
      onUpdate();
    } catch (err: any) {
      showToast(err.message || "Failed to delete task", "error");
    } finally {
      setLoading(false);
      setConfirmDelete(null);
    }
  };

  /**
   * The ONLY way status changes inside TasksTab.
   * Toggles between 'todo' and 'done'.
   */
  const handleQuickStatusToggle = async (task: Task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    try {
      await projectApi.updateTask(task.id, {
        status: newStatus,
        completed_at: newStatus === "done" ? new Date().toISOString() : null,
      });
      onUpdate();
    } catch {
      showToast("Failed to update status", "error");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-4 sm:space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Tasks</h3>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              {tasks.length} total •{" "}
              {tasks.filter((t) => t.status === "done").length} completed
            </p>
          </div>

          {/* Colour legend */}
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              4+ days
            </span>
            <span className="flex items-center gap-1.5 text-orange-400">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              2–3 days
            </span>
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              ≤1 day / overdue
            </span>
          </div>
        </div>

        {/* ── No milestones ── */}
        {milestones.length === 0 ? (
          <GlassCard className="text-center py-12 sm:py-16">
            <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 text-primary/30 mx-auto mb-4 sm:mb-6" />
            <p className="text-base sm:text-xl text-muted-foreground mb-4 sm:mb-6">
              No milestones created yet
            </p>
            <p className="text-sm text-muted-foreground">
              Create milestones first to add tasks
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-6">
            {milestones.map((milestone) => {
              const milestoneTasks = tasksByMilestone[milestone.id] || [];
              const showingForm = showFormForMilestone === milestone.id;
              const isExpanded = expandedMilestones.has(milestone.id);
              const isEditingInThisMilestone = Boolean(editForm.id) && showingForm;

              return (
                <div
                  key={milestone.id}
                  className="rounded-xl overflow-hidden border border-white/10"
                >
                  {/* ── Milestone header toggle ── */}
                  <button
                    onClick={() => toggleMilestone(milestone.id)}
                    className="w-full flex items-center justify-between p-5 bg-background/60 hover:bg-background/80 transition"
                  >
                    <div className="flex-1 text-left">
                      <h3 className="text-lg font-bold">{milestone.title}</h3>
                      {milestone.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {milestone.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {milestoneTasks.length}{" "}
                        {milestoneTasks.length === 1 ? "task" : "tasks"} •{" "}
                        {milestoneTasks.filter((t) => t.status === "done").length} completed
                      </p>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="w-6 h-6 flex-shrink-0" />
                      : <ChevronDown className="w-6 h-6 flex-shrink-0" />
                    }
                  </button>

                  {/* ── Milestone body ── */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 space-y-4">

                          {/* ── Add Task button ── */}
                          {canEdit && (
                            <div className="mb-6">
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  if (showingForm) resetForm();
                                  else openAddForm(milestone.id);
                                }}
                                className="bg-primary text-background font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition flex items-center gap-2"
                                disabled={loading}
                              >
                                {showingForm
                                  ? <><X className="w-5 h-5" />Cancel</>
                                  : <><Plus className="w-5 h-5" />Add Task</>
                                }
                              </motion.button>
                            </div>
                          )}

                          {/* ── Create / Edit Form ── */}
                          <AnimatePresence>
                            {showingForm && canEdit && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden mb-8"
                              >
                                <GlassCard>
                                  <h4 className="text-xl font-bold mb-2">
                                    {isEditingInThisMilestone ? "Edit Task" : "Add New Task"}
                                  </h4>

                                  {/* Locked fields notice */}
                                  <div className="flex items-start gap-2 mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                                    <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>
                                      <strong>Worker assignment</strong> and{" "}
                                      <strong>status</strong> are managed in the Workers tab
                                      (Task Assignments). They cannot be set here.
                                    </span>
                                  </div>

                                  <div className="space-y-4">

                                    {/* Title */}
                                    <div>
                                      <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                        Title <span className="text-red-400">*</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={isEditingInThisMilestone
                                          ? (editForm.title || "")
                                          : createForm.title
                                        }
                                        onChange={(e) =>
                                          isEditingInThisMilestone
                                            ? setEditForm({ ...editForm, title: e.target.value })
                                            : setCreateForm({ ...createForm, title: e.target.value })
                                        }
                                        placeholder="Enter task title"
                                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10
                                                   rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20
                                                   transition-all text-base font-medium text-foreground"
                                        required
                                        disabled={loading}
                                      />
                                    </div>

                                    {/* Description */}
                                    <div>
                                      <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                        Description
                                        <span className="ml-2 text-[10px] font-normal text-muted-foreground/60">
                                          (This becomes the canonical task description read by worker assignments)
                                        </span>
                                      </label>
                                      <textarea
                                        value={isEditingInThisMilestone
                                          ? (editForm.description || "")
                                          : createForm.description
                                        }
                                        onChange={(e) =>
                                          isEditingInThisMilestone
                                            ? setEditForm({ ...editForm, description: e.target.value })
                                            : setCreateForm({ ...createForm, description: e.target.value })
                                        }
                                        placeholder="Describe what needs to be done. This will be shown to workers when they are assigned this task."
                                        rows={3}
                                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10
                                                   rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20
                                                   transition-all text-base font-medium text-foreground resize-none"
                                        disabled={loading}
                                      />
                                    </div>

                                    {/* Dates */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                      {/* Start Date — min = tomorrow */}
                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Start Date
                                        </label>
                                        <input
                                          type="date"
                                          min={tomorrowISO}
                                          value={isEditingInThisMilestone
                                            ? (editForm.start_date || "")
                                            : createForm.start_date
                                          }
                                          onChange={(e) =>
                                            isEditingInThisMilestone
                                              ? setEditForm({ ...editForm, start_date: e.target.value })
                                              : setCreateForm({ ...createForm, start_date: e.target.value })
                                          }
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10
                                                     rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20
                                                     transition-all text-base font-medium text-foreground"
                                          disabled={loading}
                                        />
                                        <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                                          Earliest allowed: tomorrow ({tomorrowISO})
                                        </span>
                                      </div>

                                      {/* Due Date — min = start date or tomorrow */}
                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Due Date
                                        </label>
                                        <input
                                          type="date"
                                          min={
                                            isEditingInThisMilestone
                                              ? (editForm.start_date || tomorrowISO)
                                              : (createForm.start_date || tomorrowISO)
                                          }
                                          value={isEditingInThisMilestone
                                            ? (editForm.due_date || "")
                                            : createForm.due_date
                                          }
                                          onChange={(e) =>
                                            isEditingInThisMilestone
                                              ? setEditForm({ ...editForm, due_date: e.target.value })
                                              : setCreateForm({ ...createForm, due_date: e.target.value })
                                          }
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10
                                                     rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20
                                                     transition-all text-base font-medium text-foreground"
                                          disabled={loading}
                                        />
                                      </div>
                                    </div>

                                    {/* Locked fields display (informational only) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                      <ReadOnlyField
                                        label="Assigned To"
                                        value="Set via Workers → Task Assignments"
                                        hint="Worker assignment is managed in the Workers tab"
                                        icon={Lock}
                                      />
                                      <ReadOnlyField
                                        label="Status"
                                        value="Controlled by task checkbox & Workers tab"
                                        hint="Use the checkbox on each task to toggle done/todo"
                                        icon={Lock}
                                      />
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex gap-3 pt-4">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          isEditingInThisMilestone
                                            ? handleUpdateTask(editForm.id as string)
                                            : handleCreateTask()
                                        }
                                        className="flex-1 bg-primary text-background font-semibold px-8 py-3 rounded-xl
                                                   hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                        disabled={loading}
                                      >
                                        {loading ? (
                                          <>
                                            <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                                            {isEditingInThisMilestone ? "Updating..." : "Creating..."}
                                          </>
                                        ) : (
                                          <>
                                            <Check className="w-5 h-5" />
                                            {isEditingInThisMilestone ? "Update Task" : "Create Task"}
                                          </>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={resetForm}
                                        className="bg-muted text-foreground font-semibold px-8 py-3 rounded-xl
                                                   hover:bg-muted/80 transition flex items-center justify-center gap-2"
                                        disabled={loading}
                                      >
                                        <X className="w-5 h-5" />
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                </GlassCard>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* ── Tasks List ── */}
                          {milestoneTasks.length === 0 ? (
                            <div className="text-center py-8 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl">
                              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                              <p className="text-muted-foreground">
                                No tasks assigned to this milestone yet.
                              </p>
                              {canEdit && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  Click "Add Task" above to get started.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {milestoneTasks.map((task, idx) => {
                                // Hide the task row while it's being edited in the form above
                                const isBeingEdited = editForm.id === task.id && showingForm;
                                if (isBeingEdited) return null;

                                const priority =
                                  priorityConfig[task.priority as keyof typeof priorityConfig] ||
                                  priorityConfig.medium;
                                const status =
                                  statusConfig[task.status as keyof typeof statusConfig] ||
                                  statusConfig.todo;
                                const PriorityIcon = priority.icon;
                                const daysRemaining = calculateDaysRemaining(task.due_date);
                                const daysColor = getDaysRemainingColor(daysRemaining);
                                const daysLabel = getDaysRemainingLabel(daysRemaining);

                                return (
                                  <motion.div
                                    key={task.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="backdrop-blur-xl bg-white/5 hover:bg-white/10 border border-white/10
                                               rounded-xl p-4 sm:p-5 transition-all"
                                  >
                                    <div className="flex items-start gap-3 sm:gap-4">

                                      {/* Status toggle checkbox */}
                                      <button
                                        onClick={() => handleQuickStatusToggle(task)}
                                        disabled={!canEdit}
                                        title={canEdit ? "Toggle done/todo" : ""}
                                        className={`mt-0.5 sm:mt-0 flex-shrink-0 ${!canEdit ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                                      >
                                        <div
                                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded border-2 flex items-center justify-center transition-all ${
                                            task.status === "done"
                                              ? "bg-primary border-primary"
                                              : "border-white/30 hover:border-primary"
                                          } ${!canEdit ? "pointer-events-none" : ""}`}
                                        >
                                          {task.status === "done" && (
                                            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-background" />
                                          )}
                                        </div>
                                      </button>

                                      <div className="flex-1 min-w-0">
                                        {/* Title row */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                          <h4
                                            className={`font-semibold text-sm sm:text-base md:text-lg break-words ${
                                              task.status === "done" ? "line-through opacity-60" : ""
                                            }`}
                                          >
                                            {task.title}
                                          </h4>
                                          <span
                                            className={`px-2 py-1 rounded-lg text-xs font-semibold backdrop-blur-xl border ${priority.color} flex items-center gap-1 w-fit flex-shrink-0`}
                                          >
                                            <PriorityIcon className="w-3 h-3" />
                                            {priority.label}
                                          </span>
                                        </div>

                                        {/* Description */}
                                        {task.description && (
                                          <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                                            {task.description}
                                          </p>
                                        )}

                                        {/* Meta row */}
                                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">

                                          {/* Assigned worker (display only) */}
                                          {(task as any).assigned_worker && (
                                            <div className="flex items-center gap-1.5">
                                              <Lock className="w-3 h-3 opacity-50" />
                                              <span>
                                                {(task as any).assigned_worker.full_name}
                                              </span>
                                            </div>
                                          )}

                                          {/* Start date */}
                                          {task.start_date && (
                                            <div className="flex items-center gap-1.5">
                                              <CalendarDays className="w-3.5 h-3.5" />
                                              <span>
                                                Start:{" "}
                                                {format(new Date(task.start_date), "dd MMM yyyy")}
                                              </span>
                                            </div>
                                          )}

                                          {/* Due date */}
                                          {task.due_date && (
                                            <div className="flex items-center gap-1.5">
                                              <Calendar className="w-3.5 h-3.5" />
                                              <span>
                                                Due:{" "}
                                                {format(new Date(task.due_date), "dd MMM yyyy")}
                                              </span>
                                            </div>
                                          )}

                                          {/* Days remaining — colour-coded */}
                                          {daysLabel && (
                                            <div className={`flex items-center gap-1.5 font-semibold ${daysColor}`}>
                                              <Clock className="w-3.5 h-3.5" />
                                              <span>{daysLabel}</span>
                                            </div>
                                          )}

                                          {/* Status label */}
                                          <div className={`flex items-center gap-1.5 ${status.color}`}>
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>{status.label}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Edit / Delete buttons */}
                                      {canEdit && (
                                        <div className="flex gap-2 flex-shrink-0">
                                          <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => startEdit(task, milestone.id)}
                                            className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all"
                                            title="Edit task"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </motion.button>
                                          <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() =>
                                              setConfirmDelete({
                                                milestoneId: milestone.id,
                                                taskId: task.id,
                                              })
                                            }
                                            className="p-2 backdrop-blur-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-all text-red-400"
                                            title="Delete task"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </motion.button>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Delete Confirmation Modal ── */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setConfirmDelete(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-background border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Delete Task</h2>
                    <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                  </div>
                </div>

                <p className="mb-6 text-muted-foreground">
                  Are you sure you want to delete this task? This will permanently remove it from
                  the project and any worker assignments linked to it.
                </p>

                <div className="flex justify-end gap-3">
                  <button
                    className="px-6 py-3 rounded-xl bg-background/60 border border-white/10 text-foreground
                               font-semibold hover:bg-background/80 transition"
                    onClick={() => setConfirmDelete(null)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-6 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600
                               transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    onClick={() =>
                      deleteTask(confirmDelete.milestoneId, confirmDelete.taskId)
                    }
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete Task
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Floating Toasts ── */}
      <div className="fixed bottom-6 right-6 z-[9999] space-y-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastNotification key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}