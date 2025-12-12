// src/components/projects/tabs/TasksTab.tsx
import { useState, useEffect, useMemo } from "react";
import { format, isToday, isAfter, startOfDay } from "date-fns";
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
} from "lucide-react";
import { projectApi } from "@/lib/api/projectApi";
import { Task, Milestone } from "@/types/project";

interface TeamMember {
  id: string;
  full_name: string;
  role_name: "admin" | "manager" | "project_manager" | "client" | "finance" | "surveyor";
  status_name: string;
  is_active: boolean;
}

interface TasksTabProps {
  projectId: string;
  tasks: Task[];
  milestones: Milestone[];
  teamMembers: TeamMember[];
  canEdit: boolean;
  onUpdate: () => void;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
}

// Windows 11-style Floating Toast
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

const roleDisplayOrder = ["manager", "project_manager", "finance", "surveyor"] as const;

export default function TasksTab({ projectId, tasks, milestones, teamMembers, canEdit, onUpdate }: TasksTabProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(true);
  const [teamMembersError, setTeamMembersError] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);

  useEffect(() => {
    console.log('[TasksTab] Tasks received:', tasks);
    console.log('[TasksTab] Number of tasks:', tasks.length);
    console.log('[TasksTab] Project ID:', projectId);
    console.log('[TasksTab] Can Edit:', canEdit);
    
    if (tasks.length === 0) {
      console.warn('[TasksTab] No tasks found. This could mean:');
      console.warn('1. No tasks exist in the database');
      console.warn('2. The fetch query is failing');
      console.warn('3. The tasks are being filtered out');
      console.warn('Check the Network tab for the tasks API call');
    }
  }, [tasks, projectId, canEdit]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingTeamMembers(true);
        setTeamMembersError(false);
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        console.error("Failed to load team members:", err);
        setTeamMembersError(true);
      } finally {
        setLoadingTeamMembers(false);
      }
    };
    load();
  }, [projectId]);

  const assignableUsers = useMemo(() => {
    return teamMembers
      .filter(m => m.is_active && !["client", "admin"].includes(m.role_name))
      .sort((a, b) => {
        const orderA = roleDisplayOrder.indexOf(a.role_name as any);
        const orderB = roleDisplayOrder.indexOf(b.role_name as any);
        return orderA - orderB !== 0 ? orderA - orderB : a.full_name.localeCompare(b.full_name);
      });
  }, [teamMembers]);

  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    milestone_id: "",
    due_date: "",
    priority: "medium" as keyof typeof priorityConfig,
    status: "todo" as keyof typeof statusConfig,
  });

  const [editForm, setEditForm] = useState<Partial<Task & { due_date: string }>>({});

  const validateDueDate = (date: string) => {
    if (!date) return true;
    const selected = new Date(date);
    const today = startOfDay(new Date());
    return isAfter(selected, today) || isToday(selected);
  };

  const handleCreateTask = async () => {
    if (!createForm.title.trim()) return showToast("Task title is required", "warning");
    if (createForm.due_date && !validateDueDate(createForm.due_date)) {
      return showToast("Due date cannot be in the past", "warning");
    }

    setLoading(true);
    try {
      const result = await projectApi.createTask({
        project_id: projectId,
        title: createForm.title.trim(),
        description: createForm.description || null,
        assigned_to: createForm.assigned_to || null,
        milestone_id: createForm.milestone_id || null,
        due_date: createForm.due_date || null,
        priority: createForm.priority,
        status: createForm.status,
      });
      
      showToast("Task created successfully!", "success");
      setShowCreateModal(false);
      setCreateForm({ title: "", description: "", assigned_to: "", milestone_id: "", due_date: "", priority: "medium", status: "todo" });
      await onUpdate();
    } catch (err: any) {
      showToast(err.message || "Failed to create task", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTask = async (taskId: string) => {
    if (editForm.due_date && !validateDueDate(editForm.due_date)) {
      return showToast("Due date cannot be in the past", "warning");
    }

    setLoading(true);
    try {
      // Extract only database fields, excluding computed fields like assigned_user
      const { assigned_user, ...dbFields } = editForm as any;
      
      // Clean up the data - convert empty strings to null for date fields
      const cleanedData = {
        ...dbFields,
        due_date: dbFields.due_date || null, // Convert empty string to null
        assigned_to: dbFields.assigned_to || null, // Convert empty string to null
        milestone_id: dbFields.milestone_id || null, // Convert empty string to null
        description: dbFields.description || null, // Convert empty string to null
        completed_at: editForm.status === "done" ? new Date().toISOString() : null,
      };
      
      await projectApi.updateTask(taskId, cleanedData);
      showToast("Task updated successfully!", "success");
      setEditingTaskId(null);
      setEditForm({});
      onUpdate();
    } catch (err: any) {
      showToast(err.message || "Failed to update task", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    // Create custom confirmation dialog using toast system
    const confirmDelete = window.confirm("Delete this task permanently?");
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await projectApi.deleteTask(taskId);
      showToast("Task deleted", "success");
      onUpdate();
    } catch {
      showToast("Failed to delete task", "error");
    } finally {
      setLoading(false);
    }
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

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditForm({
      ...task,
      due_date: task.due_date ? task.due_date.split("T")[0] : "",
    });
  };

  return (
    <>
      <div className="space-y-4 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Tasks</h3>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              {tasks.length} total • {tasks.filter(t => t.status === "done").length} completed
            </p>
          </div>
          {canEdit && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl text-sm sm:text-base w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Add Task
            </motion.button>
          )}
        </div>

        {/* Task List */}
        {tasks.length === 0 ? (
          <GlassCard className="text-center py-12 sm:py-16">
            <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 text-primary/30 mx-auto mb-4 sm:mb-6" />
            <p className="text-base sm:text-xl text-muted-foreground mb-4 sm:mb-6">No tasks created yet</p>
            {canEdit && (
              <button onClick={() => setShowCreateModal(true)} className="text-primary hover:text-primary/80 font-semibold text-base sm:text-lg">
                Create your first task
              </button>
            )}
            {!canEdit && (
              <p className="text-sm text-muted-foreground">Tasks will appear here once they are created</p>
            )}
          </GlassCard>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {tasks.map((task, idx) => {
              const isEditing = editingTaskId === task.id;
              const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.medium;
              const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.todo;
              const PriorityIcon = priority.icon;

              return (
                <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}>
                  {isEditing ? (
                    <GlassCard>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Title</label>
                          <input
                            type="text"
                            value={editForm.title || ""}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Description</label>
                          <textarea
                            value={editForm.description || ""}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            rows={2}
                            className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Status</label>
                            <select
                              value={editForm.status || ""}
                              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                              className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              {Object.entries(statusConfig).map(([v, c]) => (
                                <option key={v} value={v} className="bg-background">{c.label}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Priority</label>
                            <select
                              value={editForm.priority || ""}
                              onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                              className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              {Object.entries(priorityConfig).map(([v, c]) => (
                                <option key={v} value={v} className="bg-background">{c.label}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Due Date</label>
                            <input
                              type="date"
                              min={todayISO}
                              value={editForm.due_date || ""}
                              onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                              className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Assign To</label>
                            <select
                              value={editForm.assigned_to || ""}
                              onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
                              disabled={loadingTeamMembers || teamMembersError || assignableUsers.length === 0}
                              className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="" className="bg-background">Unassigned</option>
                              {!loadingTeamMembers && !teamMembersError && assignableUsers.map(u => (
                                <option key={u.id} value={u.id} className="bg-background">{u.full_name}</option>
                              ))}
                              {loadingTeamMembers && <option disabled className="bg-background">Loading...</option>}
                              {teamMembersError && <option disabled className="bg-background">Error loading members</option>}
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleUpdateTask(task.id)} disabled={loading}
                            className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-xl transition-all">
                            {loading ? "Saving..." : "Save Changes"}
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setEditingTaskId(null)} disabled={loading}
                            className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all">
                            Cancel
                          </motion.button>
                        </div>
                      </div>
                    </GlassCard>
                  ) : (
                    <div className="backdrop-blur-xl bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 sm:p-5 transition-all">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <button 
                          onClick={() => handleQuickStatusToggle(task)} 
                          disabled={!canEdit} 
                          className={`mt-0.5 sm:mt-0 ${!canEdit ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        >
                          <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded border-2 flex items-center justify-center transition-all ${task.status === "done" ? "bg-primary border-primary" : "border-white/30 hover:border-primary"} ${!canEdit ? 'pointer-events-none' : ''}`}>
                            {task.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-background" />}
                          </div>
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <h4 className={`font-semibold text-sm sm:text-base md:text-lg break-words ${task.status === "done" ? "line-through opacity-60" : ""}`}>
                              {task.title}
                            </h4>
                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold backdrop-blur-xl border ${priority.color}`}>
                              <PriorityIcon className="w-3 h-3 inline mr-1" />
                              {priority.label}
                            </span>
                          </div>

                          {task.description && <p className="text-xs sm:text-sm text-muted-foreground mb-3">{task.description}</p>}

                          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                            {task.assigned_user && (
                              <div className="flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" />
                                <span>{task.assigned_user.full_name}</span>
                              </div>
                            )}
                            {task.due_date && (
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Due {format(new Date(task.due_date), "dd MMM yyyy")}</span>
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
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => startEdit(task)}
                              className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all">
                              <Edit2 className="w-4 h-4" />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleDeleteTask(task.id)}
                              className="p-2 backdrop-blur-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-all text-red-400">
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Create Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-2xl backdrop-blur-xl bg-background/95 border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold">Create New Task</h3>
                  <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Title *</label>
                    <input
                      type="text"
                      value={createForm.title}
                      onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                      placeholder="Enter task title"
                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder="Add task description"
                      rows={3}
                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Priority</label>
                      <select
                        value={createForm.priority}
                        onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as any })}
                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {Object.entries(priorityConfig).map(([v, c]) => (
                          <option key={v} value={v} className="bg-background">{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Milestone (Optional)</label>
                      <select
                        value={createForm.milestone_id}
                        onChange={(e) => setCreateForm({ ...createForm, milestone_id: e.target.value })}
                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="" className="bg-background">No Milestone</option>
                        {milestones.map(m => (
                          <option key={m.id} value={m.id} className="bg-background">{m.title}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Due Date</label>
                      <input
                        type="date"
                        min={todayISO}
                        value={createForm.due_date}
                        onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Assign To</label>
                      <select
                        value={createForm.assigned_to}
                        onChange={(e) => setCreateForm({ ...createForm, assigned_to: e.target.value })}
                        disabled={loadingTeamMembers || teamMembersError || assignableUsers.length === 0}
                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="" className="bg-background">Unassigned</option>
                        {!loadingTeamMembers && !teamMembersError && assignableUsers.map(u => (
                          <option key={u.id} value={u.id} className="bg-background">{u.full_name}</option>
                        ))}
                        {loadingTeamMembers && <option disabled className="bg-background">Loading...</option>}
                        {teamMembersError && <option disabled className="bg-background">Error loading members</option>}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleCreateTask} disabled={loading || !createForm.title.trim()}
                      className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-xl transition-all">
                      {loading ? "Creating..." : "Create Task"}
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowCreateModal(false)} disabled={loading}
                      className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all">
                      Cancel
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Toasts - Windows 11 Style */}
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