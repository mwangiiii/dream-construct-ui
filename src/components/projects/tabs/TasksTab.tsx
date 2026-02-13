// src/components/projects/tabs/TasksTab.tsx
import { useState, useEffect, useMemo } from "react";
import { format, isToday, isAfter, startOfDay, differenceInDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  User,
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
} from "lucide-react";
import { projectApi } from "@/lib/api/projectApi";
import { Task, Milestone } from "@/types/project";

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
  })[];  // ← Updated to reflect enriched worker data
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

const ToastNotification: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const config = {
    success: { icon: <Check className="w-5 h-5" />, bg: "bg-green-500/20", border: "border-green-500/50", text: "text-green-200" },
    error: { icon: <XCircle className="w-5 h-5" />, bg: "bg-red-500/20", border: "border-red-500/50", text: "text-red-200" },
    warning: { icon: <AlertTriangle className="w-5 h-5" />, bg: "bg-yellow-500/20", border: "border-yellow-500/50", text: "text-yellow-200" },
  };

  const { icon, bg, border, text } = config[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`flex items-center gap-3 min-w-80 max-w-md backdrop-blur-xl ${bg} ${border} ${text} border rounded-xl shadow-2xl p-4 cursor-pointer hover:opacity-90 transition-all pointer-events-auto`}
      onClick={() => onDismiss(toast.id)}
    >
      <div className="p-2 bg-white/20 rounded-lg">{icon}</div>
      <p className="font-medium text-sm">{toast.message}</p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        className="ml-auto opacity-70 hover:opacity-100"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

const priorityConfig = {
  low: { label: "Low", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: Flag },
  medium: { label: "Medium", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: Flag },
  high: { label: "High", color: "bg-orange-500/20 text-orange-300 border-orange-500/30", icon: Flag },
  urgent: { label: "Urgent", color: "bg-red-500/20 text-red-300 border-red-500/30", icon: AlertCircle },
};

const statusConfig = {
  todo: { label: "To Do", color: "text-gray-400" },
  in_progress: { label: "In Progress", color: "text-yellow-400" },
  review: { label: "Review", color: "text-blue-400" },
  done: { label: "Done", color: "text-green-400" },
};

const calculateDaysRemaining = (startDate: string | null, dueDate: string | null): number | null => {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  return differenceInDays(due, now);
};

const getDaysRemainingColor = (days: number | null): string => {
  if (days === null) return "text-muted-foreground";
  if (days < 0) return "text-red-400";
  if (days === 0) return "text-orange-400";
  if (days <= 3) return "text-yellow-400";
  return "text-green-400";
};

export default function TasksTab({ projectId, tasks, milestones, workers, canEdit, onUpdate }: TasksTabProps) {
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [showFormForMilestone, setShowFormForMilestone] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ milestoneId: string; taskId: string } | null>(null);

  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    milestone_id: "",
    start_date: "",
    due_date: "",
    priority: "medium" as keyof typeof priorityConfig,
    status: "todo" as keyof typeof statusConfig,
  });

  const [editForm, setEditForm] = useState<Partial<Task & { start_date: string; due_date: string }>>({});

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Filter only active workers for assignment
  const assignableWorkers = useMemo(() => {
    return workers
      .filter((w) => w.status === "active")
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [workers]);

  // Group tasks by milestone
  const tasksByMilestone = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      const milestoneId = task.milestone_id || "unassigned";
      if (!grouped[milestoneId]) grouped[milestoneId] = [];
      grouped[milestoneId].push(task);
    });
    return grouped;
  }, [tasks]);

  const validateDates = (startDate: string, dueDate: string) => {
    const today = startOfDay(new Date());

    if (startDate) {
      const start = new Date(startDate);
      if (!isToday(start) && !isAfter(start, today)) {
        return { valid: false, message: "Start date cannot be in the past" };
      }
    }

    if (dueDate) {
      const due = new Date(dueDate);
      if (!isToday(due) && !isAfter(due, today)) {
        return { valid: false, message: "Due date cannot be in the past" };
      }
    }

    if (startDate && dueDate) {
      const start = new Date(startDate);
      const due = new Date(dueDate);
      if (due < start) {
        return { valid: false, message: "Due date must be on or after start date" };
      }
    }

    return { valid: true, message: "" };
  };

  const toggleMilestone = (milestoneId: string) => {
    setExpandedMilestones((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(milestoneId)) {
        newSet.delete(milestoneId);
      } else {
        newSet.add(milestoneId);
      }
      return newSet;
    });
  };

  const openAddForm = (milestoneId: string) => {
    setCreateForm({
      title: "",
      description: "",
      assigned_to: "",
      milestone_id: milestoneId,
      start_date: "",
      due_date: "",
      priority: "medium",
      status: "todo",
    });
    setShowFormForMilestone(milestoneId);
    setExpandedMilestones((prev) => new Set([...prev, milestoneId]));
  };

  const resetForm = () => {
    setShowFormForMilestone(null);
    setEditForm({});
  };

  const handleCreateTask = async () => {
  console.log("Form state right before send:", createForm);
  console.log("Assigned_to raw value:", createForm.assigned_to);
  console.log("Assigned_to after || null:", createForm.assigned_to || null);
    if (!createForm.title.trim()) return showToast("Task title is required", "warning");
    if (!createForm.milestone_id) return showToast("Please select a milestone", "warning");

    const validation = validateDates(createForm.start_date, createForm.due_date);
    if (!validation.valid) return showToast(validation.message, "warning");

    setLoading(true);
    try {
      await projectApi.createTask({
        project_id: projectId,
        title: createForm.title.trim(),
        description: createForm.description || null,
        assigned_to: createForm.assigned_to || null,
        milestone_id: createForm.milestone_id,
        start_date: createForm.start_date || null,
        due_date: createForm.due_date || null,
        priority: createForm.priority,
        status: createForm.status,
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
      const { assigned_worker, ...dbFields } = editForm as any; // ← updated from assigned_user

      const cleanedData = {
        ...dbFields,
        start_date: dbFields.start_date || null,
        due_date: dbFields.due_date || null,
        assigned_to: dbFields.assigned_to || null,
        milestone_id: dbFields.milestone_id || null,
        description: dbFields.description || null,
        completed_at: editForm.status === "done" ? new Date().toISOString() : null,
      };

      await projectApi.updateTask(taskId, cleanedData);
      showToast("Task updated successfully!", "success");
      setShowFormForMilestone(null);
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

  const startEdit = (task: Task, milestoneId: string) => {
    setShowFormForMilestone(milestoneId);
    setEditForm({
      ...task,
      start_date: task.start_date ? task.start_date.split("T")[0] : "",
      due_date: task.due_date ? task.due_date.split("T")[0] : "",
    });
    setExpandedMilestones((prev) => new Set([...prev, milestoneId]));
  };

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

  return (
    <>
      <div className="space-y-4 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Tasks</h3>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              {tasks.length} total • {tasks.filter((t) => t.status === "done").length} completed
            </p>
          </div>
        </div>

        {/* Milestones with Tasks */}
        {milestones.length === 0 ? (
          <GlassCard className="text-center py-12 sm:py-16">
            <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 text-primary/30 mx-auto mb-4 sm:mb-6" />
            <p className="text-base sm:text-xl text-muted-foreground mb-4 sm:mb-6">No milestones created yet</p>
            <p className="text-sm text-muted-foreground">Create milestones first to add tasks</p>
          </GlassCard>
        ) : (
          <div className="space-y-6">
            {milestones.map((milestone) => {
              const milestoneTasks = tasksByMilestone[milestone.id] || [];
              const showingForm = showFormForMilestone === milestone.id;
              const isExpanded = expandedMilestones.has(milestone.id);

              return (
                <div key={milestone.id} className="rounded-xl overflow-hidden border border-white/10">
                  <button
                    onClick={() => toggleMilestone(milestone.id)}
                    className="w-full flex items-center justify-between p-5 bg-background/60 hover:bg-background/80 transition"
                  >
                    <div className="flex-1 text-left">
                      <h3 className="text-lg font-bold">{milestone.title}</h3>
                      {milestone.description && (
                        <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {milestoneTasks.length} {milestoneTasks.length === 1 ? "task" : "tasks"} •{" "}
                        {milestoneTasks.filter((t) => t.status === "done").length} completed
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                  </button>

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
                          {canEdit && (
                            <div className="mb-6">
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  if (showingForm) {
                                    setShowFormForMilestone(null);
                                  } else {
                                    openAddForm(milestone.id);
                                  }
                                }}
                                className="bg-primary text-background font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition flex items-center gap-2"
                                disabled={loading}
                              >
                                {showingForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                {showingForm ? "Cancel" : "Add Task"}
                              </motion.button>
                            </div>
                          )}

                          {/* Create/Edit Form */}
                          <AnimatePresence>
                            {showingForm && canEdit && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden mb-8"
                              >
                                <GlassCard>
                                  <h4 className="text-xl font-bold mb-6">
                                    {editForm.id ? "Edit Task" : "Add New Task"}
                                  </h4>
                                  <div className="space-y-4">
                                    <div>
                                      <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                        Title *
                                      </label>
                                      <input
                                        type="text"
                                        value={editForm.id ? (editForm.title || "") : createForm.title}
                                        onChange={(e) =>
                                          editForm.id
                                            ? setEditForm({ ...editForm, title: e.target.value })
                                            : setCreateForm({ ...createForm, title: e.target.value })
                                        }
                                        placeholder="Enter task title"
                                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                        required
                                        disabled={loading}
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                        Description
                                      </label>
                                      <textarea
                                        value={editForm.id ? (editForm.description || "") : createForm.description}
                                        onChange={(e) =>
                                          editForm.id
                                            ? setEditForm({ ...editForm, description: e.target.value })
                                            : setCreateForm({ ...createForm, description: e.target.value })
                                        }
                                        placeholder="Add task description"
                                        rows={3}
                                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground resize-none"
                                        disabled={loading}
                                      />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Status
                                        </label>
                                        <select
                                          value={editForm.id ? (editForm.status || "todo") : createForm.status}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, status: e.target.value as any })
                                              : setCreateForm({ ...createForm, status: e.target.value as any })
                                          }
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          disabled={loading}
                                        >
                                          {Object.entries(statusConfig).map(([v, c]) => (
                                            <option key={v} value={v} className="bg-background">
                                              {c.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Priority
                                        </label>
                                        <select
                                          value={editForm.id ? (editForm.priority || "medium") : createForm.priority}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, priority: e.target.value as any })
                                              : setCreateForm({ ...createForm, priority: e.target.value as any })
                                          }
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          disabled={loading}
                                        >
                                          {Object.entries(priorityConfig).map(([v, c]) => (
                                            <option key={v} value={v} className="bg-background">
                                              {c.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Assign To
                                        </label>
                                        <select
                                          value={editForm.id ? (editForm.assigned_to || "") : createForm.assigned_to}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, assigned_to: e.target.value })
                                              : setCreateForm({ ...createForm, assigned_to: e.target.value })
                                          }
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          disabled={loading}
                                        >
                                          <option value="">Unassigned</option>
                                          {assignableWorkers.map((w) => (
                                            <option key={w.id} value={w.id} className="bg-background">
                                              {w.full_name} • {w.role.replace("_", " ")}
                                            </option>
                                          ))}
                                          {assignableWorkers.length === 0 && (
                                            <option disabled className="bg-background">
                                              No active workers available
                                            </option>
                                          )}
                                        </select>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Start Date
                                        </label>
                                        <input
                                          type="date"
                                          min={todayISO}
                                          value={editForm.id ? (editForm.start_date || "") : createForm.start_date}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, start_date: e.target.value })
                                              : setCreateForm({ ...createForm, start_date: e.target.value })
                                          }
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          disabled={loading}
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Due Date
                                        </label>
                                        <input
                                          type="date"
                                          min={
                                            editForm.id
                                              ? editForm.start_date || todayISO
                                              : createForm.start_date || todayISO
                                          }
                                          value={editForm.id ? (editForm.due_date || "") : createForm.due_date}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, due_date: e.target.value })
                                              : setCreateForm({ ...createForm, due_date: e.target.value })
                                          }
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          disabled={loading}
                                        />
                                      </div>
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                      <button
                                        type="button"
                                        onClick={() => (editForm.id ? handleUpdateTask(editForm.id as string) : handleCreateTask())}
                                        className="flex-1 bg-primary text-background font-semibold px-8 py-3 rounded-xl hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                        disabled={loading}
                                      >
                                        {loading ? (
                                          <>
                                            <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"></div>
                                            {editForm.id ? "Updating..." : "Creating..."}
                                          </>
                                        ) : (
                                          <>
                                            <Check className="w-5 h-5" />
                                            {editForm.id ? "Update Task" : "Create Task"}
                                          </>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={resetForm}
                                        className="bg-muted text-foreground font-semibold px-8 py-3 rounded-xl hover:bg-muted/80 transition flex items-center justify-center gap-2"
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

                          {/* Tasks List */}
                          {milestoneTasks.length === 0 ? (
                            <div className="text-center py-8 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl">
                              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                              <p className="text-muted-foreground">No tasks assigned to this milestone yet.</p>
                              {canEdit && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  Click "Add Task" above to get started.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {milestoneTasks.map((task, idx) => {
                                const isEditing = editForm.id === task.id;
                                if (isEditing && showingForm) return null;

                                const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.medium;
                                const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.todo;
                                const PriorityIcon = priority.icon;
                                const daysRemaining = calculateDaysRemaining(task.start_date, task.due_date);
                                const daysColor = getDaysRemainingColor(daysRemaining);

                                return (
                                  <motion.div
                                    key={task.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="backdrop-blur-xl bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 sm:p-5 transition-all"
                                  >
                                    <div className="flex items-start gap-3 sm:gap-4">
                                      <button
                                        onClick={() => handleQuickStatusToggle(task)}
                                        disabled={!canEdit}
                                        className={`mt-0.5 sm:mt-0 ${!canEdit ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                                      >
                                        <div
                                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded border-2 flex items-center justify-center transition-all ${
                                            task.status === "done" ? "bg-primary border-primary" : "border-white/30 hover:border-primary"
                                          } ${!canEdit ? "pointer-events-none" : ""}`}
                                        >
                                          {task.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-background" />}
                                        </div>
                                      </button>

                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                          <h4
                                            className={`font-semibold text-sm sm:text-base md:text-lg break-words ${
                                              task.status === "done" ? "line-through opacity-60" : ""
                                            }`}
                                          >
                                            {task.title}
                                          </h4>
                                          <span
                                            className={`px-2 py-1 rounded-lg text-xs font-semibold backdrop-blur-xl border ${priority.color} flex items-center gap-1 w-fit`}
                                          >
                                            <PriorityIcon className="w-3 h-3" />
                                            {priority.label}
                                          </span>
                                        </div>

                                        {task.description && (
                                          <p className="text-xs sm:text-sm text-muted-foreground mb-3">{task.description}</p>
                                        )}

                                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                                          {task.assigned_worker && (
                                            <div className="flex items-center gap-1.5">
                                              <User className="w-3.5 h-3.5" />
                                              <span>{task.assigned_worker.full_name}</span>
                                            </div>
                                          )}
                                          {task.start_date && (
                                            <div className="flex items-center gap-1.5">
                                              <CalendarDays className="w-3.5 h-3.5" />
                                              <span>Start: {format(new Date(task.start_date), "dd MMM yyyy")}</span>
                                            </div>
                                          )}
                                          {task.due_date && (
                                            <div className="flex items-center gap-1.5">
                                              <Calendar className="w-3.5 h-3.5" />
                                              <span>Due: {format(new Date(task.due_date), "dd MMM yyyy")}</span>
                                            </div>
                                          )}
                                          {daysRemaining !== null && (
                                            <div className={`flex items-center gap-1.5 font-semibold ${daysColor}`}>
                                              <Clock className="w-3.5 h-3.5" />
                                              <span>
                                                {daysRemaining < 0
                                                  ? `Overdue by ${Math.abs(daysRemaining)} days`
                                                  : daysRemaining === 0
                                                  ? "Due today"
                                                  : `${daysRemaining} days left`}
                                              </span>
                                            </div>
                                          )}
                                          <div className={`flex items-center gap-1.5 ${status.color}`}>
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>{status.label}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {canEdit && (
                                        <div className="flex gap-2 flex-shrink-0">
                                          <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => startEdit(task, milestone.id)}
                                            className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </motion.button>
                                          <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => setConfirmDelete({ milestoneId: milestone.id, taskId: task.id })}
                                            className="p-2 backdrop-blur-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-all text-red-400"
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

        {/* Delete Confirmation Modal */}
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
                  Are you sure you want to delete this task? This will permanently remove it from the project.
                </p>

                <div className="flex justify-end gap-3">
                  <button
                    className="px-6 py-3 rounded-xl bg-background/60 border border-white/10 text-foreground font-semibold hover:bg-background/80 transition"
                    onClick={() => setConfirmDelete(null)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-6 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    onClick={() => deleteTask(confirmDelete.milestoneId, confirmDelete.taskId)}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Toasts */}
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