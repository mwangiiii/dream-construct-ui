// src/components/projects/tabs/TasksTab.tsx
import { useState } from "react";
import { format } from "date-fns";
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
} from "lucide-react";
import { projectApi } from "@/lib/api/projectApi";
import { Task, Milestone } from "@/types/project";

interface TasksTabProps {
  projectId: string;
  tasks: Task[];
  milestones: Milestone[];
  teamMembers?: any[]; // Array of users who can be assigned
  canEdit: boolean;
  onUpdate: () => void;
}

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

export default function TasksTab({ projectId, tasks, milestones, teamMembers = [], canEdit, onUpdate }: TasksTabProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    milestone_id: "",
    due_date: "",
    priority: "medium",
    status: "todo",
  });

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<Task>>({});

  // Edge Function #5: Create Task
  const handleCreateTask = async () => {
    if (!createForm.title.trim() || !canEdit) return;
    setLoading(true);

    try {
      await projectApi.createTask({
        project_id: projectId,
        title: createForm.title,
        description: createForm.description || undefined,
        assigned_to: createForm.assigned_to || null,
        milestone_id: createForm.milestone_id || null,
        due_date: createForm.due_date || null,
        priority: createForm.priority,
        status: createForm.status,
      });

      alert("Task created successfully!");
      setShowCreateModal(false);
      setCreateForm({
        title: "",
        description: "",
        assigned_to: "",
        milestone_id: "",
        due_date: "",
        priority: "medium",
        status: "todo",
      });
      onUpdate();
    } catch (error: any) {
      console.error("Error creating task:", error);
      alert(error.message || "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  // Edge Function #6: Update Task
  const handleUpdateTask = async (taskId: string) => {
    if (!canEdit) return;
    setLoading(true);

    try {
      await projectApi.updateTask(taskId, {
        title: editForm.title,
        description: editForm.description,
        assigned_to: editForm.assigned_to,
        due_date: editForm.due_date,
        priority: editForm.priority,
        status: editForm.status,
        completed_at: editForm.status === "done" ? new Date().toISOString() : null,
      });

      alert("Task updated successfully!");
      setEditingTaskId(null);
      setEditForm({});
      onUpdate();
    } catch (error: any) {
      console.error("Error updating task:", error);
      alert(error.message || "Failed to update task");
    } finally {
      setLoading(false);
    }
  };

  // Edge Function #7: Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!canEdit) return;
    if (!confirm("Are you sure you want to delete this task?")) return;

    setLoading(true);
    try {
      await projectApi.deleteTask(taskId);
      alert("Task deleted successfully!");
      setDeletingTaskId(null);
      onUpdate();
    } catch (error: any) {
      console.error("Error deleting task:", error);
      alert(error.message || "Failed to delete task");
    } finally {
      setLoading(false);
    }
  };

  // Quick status toggle
  const handleQuickStatusToggle = async (task: Task) => {
    if (!canEdit) return;
    const newStatus = task.status === "done" ? "todo" : "done";
    
    setLoading(true);
    try {
      await projectApi.updateTask(task.id, {
        status: newStatus,
        completed_at: newStatus === "done" ? new Date().toISOString() : null,
      });
      onUpdate();
    } catch (error: any) {
      console.error("Error toggling task status:", error);
      alert(error.message || "Failed to update task");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditForm(task);
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setEditForm({});
  };

  // Group tasks by status
  const groupedTasks = {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    review: tasks.filter((t) => t.status === "review"),
    done: tasks.filter((t) => t.status === "done"),
  };

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Tasks</h3>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            {tasks.length} total • {groupedTasks.done.length} completed
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

      {/* Empty State */}
      {tasks.length === 0 ? (
        <GlassCard className="text-center py-12 sm:py-16">
          <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 text-primary/30 mx-auto mb-4 sm:mb-6" />
          <p className="text-base sm:text-xl text-muted-foreground mb-4 sm:mb-6">No tasks assigned yet</p>
          {canEdit && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-primary hover:text-primary/80 font-semibold text-base sm:text-lg"
            >
              Create your first task
            </button>
          )}
        </GlassCard>
      ) : (
        /* Task List */
        <div className="space-y-3 sm:space-y-4">
          {tasks.map((task, idx) => {
            const isEditing = editingTaskId === task.id;
            const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.medium;
            const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.todo;
            const PriorityIcon = priority.icon;

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                {isEditing ? (
                  /* Edit Mode */
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
                            {Object.entries(statusConfig).map(([value, config]) => (
                              <option key={value} value={value} className="bg-background">
                                {config.label}
                              </option>
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
                            {Object.entries(priorityConfig).map(([value, config]) => (
                              <option key={value} value={value} className="bg-background">
                                {config.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Due Date</label>
                          <input
                            type="date"
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
                            className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="" className="bg-background">Unassigned</option>
                            {teamMembers.map((member) => (
                              <option key={member.id} value={member.id} className="bg-background">
                                {member.full_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleUpdateTask(task.id)}
                          disabled={loading}
                          className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-xl transition-all"
                        >
                          {loading ? "Saving..." : "Save Changes"}
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
                  </GlassCard>
                ) : (
                  /* View Mode */
                  <div className="backdrop-blur-xl bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 sm:p-5 transition-all">
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* Checkbox */}
                      <button
                        onClick={() => handleQuickStatusToggle(task)}
                        disabled={!canEdit || loading}
                        className="mt-0.5 sm:mt-0"
                      >
                        <div
                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded border-2 flex items-center justify-center transition-all ${
                            task.status === "done"
                              ? "bg-primary border-primary"
                              : "border-white/30 hover:border-primary"
                          }`}
                        >
                          {task.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-background" />}
                        </div>
                      </button>

                      {/* Task Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <h4
                            className={`font-semibold text-sm sm:text-base md:text-lg break-words ${
                              task.status === "done" ? "line-through opacity-60" : ""
                            }`}
                          >
                            {task.title}
                          </h4>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold backdrop-blur-xl border ${priority.color}`}>
                              <PriorityIcon className="w-3 h-3 inline mr-1" />
                              {priority.label}
                            </span>
                          </div>
                        </div>

                        {task.description && (
                          <p className="text-xs sm:text-sm text-muted-foreground mb-3">{task.description}</p>
                        )}

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

                      {/* Actions */}
                      {canEdit && (
                        <div className="flex gap-2 flex-shrink-0">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => startEdit(task)}
                            className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-2 backdrop-blur-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-all text-red-400"
                          >
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

      {/* Create Task Modal */}
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
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                >
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
                      onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {Object.entries(priorityConfig).map(([value, config]) => (
                        <option key={value} value={value} className="bg-background">
                          {config.label}
                        </option>
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
                      {milestones.map((milestone) => (
                        <option key={milestone.id} value={milestone.id} className="bg-background">
                          {milestone.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Due Date</label>
                    <input
                      type="date"
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
                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="" className="bg-background">Unassigned</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id} className="bg-background">
                          {member.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateTask}
                    disabled={loading || !createForm.title.trim()}
                    className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-xl transition-all"
                  >
                    {loading ? "Creating..." : "Create Task"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCreateModal(false)}
                    disabled={loading}
                    className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
                  >
                    Cancel
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}