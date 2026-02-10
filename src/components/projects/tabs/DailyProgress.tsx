import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, CheckCircle, Clock, XCircle, ListChecks, Plus, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ProgressEntry {
  id: string;
  date: string;
  project: string;
  tasks: { name: string; status: string }[];
  notes: string;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
}

const statusMap = {
  "Completed": {
    color: "text-green-600",
    icon: CheckCircle,
  },
  "In Progress": {
    color: "text-yellow-600",
    icon: TrendingUp,
  },
  "Pending": {
    color: "text-gray-500",
    icon: Clock,
  },
  "Issue": {
    color: "text-red-600",
    icon: XCircle,
  },
};

const getSummaryStats = (progress: ProgressEntry[]) => {
  // Projects Updated Today: count unique projects with entries today
  const today = new Date().toISOString().split("T")[0];
  const projectsUpdated = new Set(progress.filter(p => p.date === today).map(p => p.project)).size;

  // Tasks Completed: count tasks with status Completed
  const tasksCompleted = progress.reduce((acc, entry) => acc + entry.tasks.filter(t => t.status === "Completed").length, 0);

  // Tasks In Progress: count tasks with status In Progress
  const tasksInProgress = progress.reduce((acc, entry) => acc + entry.tasks.filter(t => t.status === "In Progress").length, 0);

  // Tasks Pending: count tasks with status Pending
  const tasksPending = progress.reduce((acc, entry) => acc + entry.tasks.filter(t => t.status === "Pending").length, 0);

  return [
    { icon: ListChecks, value: projectsUpdated, label: "Projects Updated Today" },
    { icon: CheckCircle, value: tasksCompleted, label: "Tasks Completed" },
    { icon: TrendingUp, value: tasksInProgress, label: "Tasks In Progress" },
    { icon: Clock, value: tasksPending, label: "Tasks Pending" },
  ];
};

const ToastNotification: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const config = {
    success: {
      icon: <CheckCircle className="w-5 h-5" />,
      bg: "bg-green-500/20",
      border: "border-green-500/50",
      text: "text-green-200"
    },
    error: {
      icon: <XCircle className="w-5 h-5" />,
      bg: "bg-red-500/20",
      border: "border-red-500/50",
      text: "text-red-200"
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5" />,
      bg: "bg-yellow-500/20",
      border: "border-yellow-500/50",
      text: "text-yellow-200"
    },
  };

  const { icon, bg, border, text } = config[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border-2 backdrop-blur-xl shadow-2xl pointer-events-auto min-w-[300px]",
        bg,
        border
      )}
      onClick={() => onDismiss(toast.id)}
    >
      {icon}
      <span className={cn("flex-1 font-medium", text)}>{toast.message}</span>
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
  <div className={cn("backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl", className)}>
    {children}
  </div>
);

const StatCard = ({ icon: Icon, title, value, subtitle, color }: any) => (
  <GlassCard>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-4xl font-bold text-foreground mb-2">{value}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground/60 mt-1">{subtitle}</p>}
      </div>
      <Icon className={cn("w-8 h-8", color || "text-primary")} />
    </div>
  </GlassCard>
);

const EmptyState = ({ icon: Icon, title, description, action, onAction }: any) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-16 px-4"
  >
    <Icon className="w-16 h-16 text-muted-foreground/40 mb-4" />
    <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-muted-foreground text-center mb-6 max-w-md">{description}</p>
    {action && (
      <Button onClick={onAction} size="lg">
        {action}
      </Button>
    )}
  </motion.div>
);

const DailyProgress: React.FC<{ projectId?: string }> = ({ projectId }) => {
  // Form state for adding progress
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newTasks, setNewTasks] = useState([{ name: "", status: "Pending" }]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch daily progress from Supabase
  const fetchProgress = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('daily_progress')
        .select('id, date, notes, project:projects(title), daily_progress_tasks(name, status)')
        .eq('project_id', projectId)
        .order('date', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform data - INCLUDE THE ID
      const formatted: ProgressEntry[] = (data || []).map((entry: any) => ({
        id: entry.id, // THIS WAS MISSING
        date: entry.date,
        project: entry.project?.title || '',
        tasks: (entry.daily_progress_tasks || []).map((t: any) => ({
          name: t.name,
          status: t.status
        })),
        notes: entry.notes,
      }));

      setProgress(formatted);
      setError(null);
    } catch (err: any) {
      setError('Failed to load daily progress.');
      setProgress([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchProgress();
  }, [projectId]);

  // Add daily progress
  const addProgress = async (date: string, notes: string, tasks: { name: string; status: string }[]) => {
    try {
      const { data, error: insertError } = await supabase
        .from('daily_progress')
        .insert([{ project_id: projectId, date, notes }])
        .select();

      if (insertError) throw insertError;

      const progressId = data[0]?.id;
      if (progressId && tasks.length > 0) {
        await supabase
          .from('daily_progress_tasks')
          .insert(tasks.map(t => ({
            daily_progress_id: progressId,
            name: t.name,
            status: t.status
          })));
      }

      showToast('Progress added!', 'success');
      fetchProgress();
    } catch (err: any) {
      showToast('Failed to add progress.', 'error');
    }
  };

  // Update daily progress
  const updateProgress = async (progressId: string, notes: string) => {
    try {
      const { error: updateError } = await supabase
        .from('daily_progress')
        .update({ notes })
        .eq('id', progressId);

      if (updateError) throw updateError;

      showToast('Progress updated!', 'success');
      setEditId(null);
      fetchProgress();
    } catch (err: any) {
      showToast('Failed to update progress.', 'error');
    }
  };

  // Delete daily progress
  const deleteProgress = async (progressId: string) => {
    try {
      // First delete related tasks
      const { error: tasksError } = await supabase
        .from('daily_progress_tasks')
        .delete()
        .eq('daily_progress_id', progressId);

      if (tasksError) throw tasksError;

      // Then delete the progress entry
      const { error: deleteError } = await supabase
        .from('daily_progress')
        .delete()
        .eq('id', progressId);

      if (deleteError) throw deleteError;

      showToast('Progress deleted!', 'success');
      fetchProgress();
    } catch (err: any) {
      showToast('Failed to delete progress.', 'error');
    }
  };

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading daily progress...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Error loading progress</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Daily Progress</h1>
              <p className="text-muted-foreground">View and log daily progress for all ongoing projects and tasks.</p>
            </div>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Daily Progress
            </Button>
          </div>

          {/* Add Modal */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-background border-2 border-white/20 rounded-2xl shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-foreground">Add Daily Progress</h2>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Date *</Label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                    />
                  </div>

                  <div>
                    <Label className="mb-2 block">Notes</Label>
                    <textarea
                      value={newNotes}
                      onChange={e => setNewNotes(e.target.value)}
                      placeholder="Notes about today's progress"
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 resize-none"
                      rows={4}
                    />
                  </div>
                </div>

                <div className="mb-3 mt-6">
                  <Label className="mb-2 block">Tasks</Label>
                  {newTasks.map((task, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        value={task.name}
                        onChange={e => {
                          const updated = [...newTasks];
                          updated[idx].name = e.target.value;
                          setNewTasks(updated);
                        }}
                        placeholder="Task name"
                        className="border-2 border-white/10 rounded-xl px-4 py-3 bg-white/5 flex-1 font-medium"
                      />
                      <select
                        value={task.status}
                        onChange={e => {
                          const updated = [...newTasks];
                          updated[idx].status = e.target.value;
                          setNewTasks(updated);
                        }}
                        className="px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl"
                      >
                        <option value="Completed" className="bg-background text-foreground">Completed</option>
                        <option value="In Progress" className="bg-background text-foreground">In Progress</option>
                        <option value="Pending" className="bg-background text-foreground">Pending</option>
                        <option value="Issue" className="bg-background text-foreground">Issue</option>
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setNewTasks(newTasks.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setNewTasks([...newTasks, { name: "", status: "Pending" }])}
                  >
                    Add Task
                  </Button>
                </div>

                <div className="flex gap-3 mt-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      await addProgress(newDate, newNotes, newTasks.filter(t => t.name));
                      setShowAddModal(false);
                      setNewDate("");
                      setNewNotes("");
                      setNewTasks([{ name: "", status: "Pending" }]);
                    }}
                    className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all"
                  >
                    Save
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="backdrop-blur-2xl bg-background/95 border border-white/20 rounded-2xl shadow-2xl p-4 sm:p-8"
          >
            {/* Stats Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
              {getSummaryStats(progress).map((stat, idx) => (
                <StatCard
                  key={stat.label}
                  icon={stat.icon}
                  title={stat.label}
                  value={stat.value}
                />
              ))}
            </div>

            {/* Progress Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <thead>
                  <tr className="bg-background/60">
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Project</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Date</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Tasks</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Notes</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors"
                    >
                      <td className="py-4 px-6 font-medium text-foreground">{entry.project}</td>
                      <td className="py-4 px-6 text-foreground">{entry.date}</td>
                      <td className="py-4 px-6">
                        <ul className="space-y-1">
                          {entry.tasks.map((task, tIdx) => {
                            const status = statusMap[task.status as keyof typeof statusMap] || statusMap["Pending"];
                            const StatusIcon = status.icon;
                            return (
                              <li key={tIdx} className="flex items-center gap-2">
                                <StatusIcon className={cn("w-4 h-4", status.color)} />
                                <span className="w-32 inline-block text-foreground">{task.name}</span>
                                <span className={cn("font-semibold", status.color)}>{task.status}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                      <td className="py-4 px-6 text-sm text-muted-foreground">
                        {editId === entry.id ? (
                          <input
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            className="border rounded-xl p-2 w-full bg-white/5 border-white/10"
                          />
                        ) : (
                          entry.notes
                        )}
                      </td>
                      <td className="py-4 px-6 flex gap-2">
                        {editId === entry.id ? (
                          <>
                            <Button
                              size="sm"
                              onClick={async () => {
                                await updateProgress(entry.id, editNotes);
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditId(null);
                                setEditNotes("");
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditId(entry.id);
                                setEditNotes(entry.notes);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => await deleteProgress(entry.id)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Floating Toasts */}
      <div className="fixed bottom-6 right-6 z-[9999] space-y-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastNotification key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DailyProgress;