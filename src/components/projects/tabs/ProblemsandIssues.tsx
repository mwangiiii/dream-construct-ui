import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Plus, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";

interface ProblemsAndIssuesProps {
  projectId?: string;
}

type Issue = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  reported_by: string;
  date: string;
  created_at?: string;
  updated_at?: string;
};

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
}

const statusOptions = ["Open", "In Progress", "Resolved"];

const statusMap = {
  "Open": {
    color: "text-yellow-600",
    icon: AlertTriangle,
  },
  "In Progress": {
    color: "text-blue-600",
    icon: TrendingUp,
  },
  "Resolved": {
    color: "text-green-600",
    icon: CheckCircle,
  },
};

const getSummaryStats = (issues: Issue[]) => {
  const openIssues = issues.filter(i => i.status === "Open").length;
  const inProgressIssues = issues.filter(i => i.status === "In Progress").length;
  const resolvedIssues = issues.filter(i => i.status === "Resolved").length;
  const totalIssues = issues.length;

  return [
    { icon: AlertTriangle, value: openIssues, label: "Open Issues", color: "text-yellow-600" },
    { icon: TrendingUp, value: inProgressIssues, label: "In Progress", color: "text-blue-600" },
    { icon: CheckCircle, value: resolvedIssues, label: "Resolved", color: "text-green-600" },
    { icon: Clock, value: totalIssues, label: "Total Issues", color: "text-primary" },
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

const StatCard = ({ icon: Icon, title, value, color }: any) => (
  <GlassCard>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-4xl font-bold text-foreground mb-2">{value}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>
      <Icon className={cn("w-8 h-8", color || "text-primary")} />
    </div>
  </GlassCard>
);

const ProblemsAndIssues: React.FC<ProblemsAndIssuesProps> = ({ projectId }) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [form, setForm] = useState({ 
    title: "", 
    description: "", 
    status: statusOptions[0], 
    reported_by: "", 
    date: "" 
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchIssues = async () => {
    if (!projectId) {
      setLoading(false);
      setError("No project ID provided");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("project_issues")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Fetch error:", fetchError);
        throw fetchError;
      }

      setIssues(data || []);
      setError(null);
    } catch (err: any) {
      console.error("Error in fetchIssues:", err);
      setError(err.message || "Failed to load issues.");
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchIssues();
    } else {
      setLoading(false);
      setError("No project selected");
    }
  }, [projectId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !projectId) return;

    try {
      const { data, error: insertError } = await supabase
        .from("project_issues")
        .insert([
          {
            project_id: projectId,
            title: form.title,
            description: form.description,
            status: form.status,
            reported_by: form.reported_by,
            date: form.date,
          },
        ])
        .select();

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }

      setForm({ title: "", description: "", status: statusOptions[0], reported_by: "", date: "" });
      setShowAddModal(false);
      showToast("Issue added successfully!", "success");
      await fetchIssues();
    } catch (err: any) {
      console.error("Error in handleAdd:", err);
      showToast(err.message || "Failed to add issue.", "error");
    }
  };

  const handleEdit = (issue: Issue) => {
    setEditId(issue.id);
    setForm({
      title: issue.title,
      description: issue.description,
      status: issue.status,
      reported_by: issue.reported_by,
      date: issue.date,
    });
    setShowAddModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;

    try {
      const { error: updateError } = await supabase
        .from("project_issues")
        .update({
          title: form.title,
          description: form.description,
          status: form.status,
          reported_by: form.reported_by,
          date: form.date,
        })
        .eq("id", editId);

      if (updateError) {
        console.error("Update error:", updateError);
        throw updateError;
      }

      setEditId(null);
      setForm({ title: "", description: "", status: statusOptions[0], reported_by: "", date: "" });
      setShowAddModal(false);
      showToast("Issue updated successfully!", "success");
      await fetchIssues();
    } catch (err: any) {
      console.error("Error in handleUpdate:", err);
      showToast(err.message || "Failed to update issue.", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this issue?")) return;

    try {
      const { error: deleteError } = await supabase
        .from("project_issues")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        throw deleteError;
      }

      showToast("Issue deleted successfully!", "success");
      await fetchIssues();
    } catch (err: any) {
      console.error("Error in handleDelete:", err);
      showToast(err.message || "Failed to delete issue.", "error");
    }

    if (editId === id) {
      setEditId(null);
      setForm({ title: "", description: "", status: statusOptions[0], reported_by: "", date: "" });
    }
  };

  const handleCancel = () => {
    setEditId(null);
    setForm({ title: "", description: "", status: statusOptions[0], reported_by: "", date: "" });
    setShowAddModal(false);
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
          <p className="text-muted-foreground">Loading issues...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Error loading issues</h3>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => fetchIssues()} className="mt-4">
            Retry
          </Button>
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
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Problems <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">& Issues</span>
              </h1>
              <p className="text-muted-foreground">Record, track, and resolve project problems and issues.</p>
            </div>
            <Button 
              onClick={() => {
                setShowAddModal(true);
                setEditId(null);
                setForm({ title: "", description: "", status: statusOptions[0], reported_by: "", date: "" });
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Issue
            </Button>
          </div>

          {/* Add/Edit Modal */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-background border-2 border-white/20 rounded-2xl shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-foreground">
                    {editId ? "Edit Issue" : "Add Issue"}
                  </h2>
                  <button
                    onClick={handleCancel}
                    className="p-2 hover:bg-white/10 rounded-lg transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={editId ? handleUpdate : handleAdd} className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Title *</Label>
                    <input
                      name="title"
                      type="text"
                      value={form.title}
                      onChange={handleChange}
                      placeholder="e.g. Water leakage in basement"
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 block">Status *</Label>
                      <select
                        name="status"
                        value={form.status}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                        required
                      >
                        {statusOptions.map((s) => (
                          <option key={s} value={s} className="bg-background text-foreground">
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="mb-2 block">Reported By *</Label>
                      <input
                        name="reported_by"
                        type="text"
                        value={form.reported_by}
                        onChange={handleChange}
                        placeholder="e.g. Alice"
                        className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block">Date *</Label>
                    <input
                      name="date"
                      type="date"
                      value={form.date}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <Label className="mb-2 block">Description *</Label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      placeholder="Describe the issue..."
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 resize-none"
                      rows={4}
                      required
                    />
                  </div>

                  <div className="flex gap-3 mt-6">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all"
                    >
                      {editId ? "Update Issue" : "Add Issue"}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={handleCancel}
                      className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </form>
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
              {getSummaryStats(issues).map((stat) => (
                <StatCard
                  key={stat.label}
                  icon={stat.icon}
                  title={stat.label}
                  value={stat.value}
                  color={stat.color}
                />
              ))}
            </div>

            {/* Issues Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <thead>
                  <tr className="bg-background/60">
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Date</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Title</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Reported By</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Status</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Description</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <AlertTriangle className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-foreground mb-2">No issues yet</h3>
                        <p className="text-muted-foreground mb-6">Get started by adding your first issue.</p>
                        <Button
                          onClick={() => {
                            setShowAddModal(true);
                            setEditId(null);
                            setForm({ title: "", description: "", status: statusOptions[0], reported_by: "", date: "" });
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add First Issue
                        </Button>
                      </td>
                    </tr>
                  ) : (
                    issues.map((issue) => {
                      const status = statusMap[issue.status as keyof typeof statusMap] || statusMap["Open"];
                      const StatusIcon = status.icon;
                      return (
                        <tr
                          key={issue.id}
                          className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors"
                        >
                          <td className="py-4 px-6 text-foreground">{issue.date}</td>
                          <td className="py-4 px-6 text-foreground font-medium">{issue.title}</td>
                          <td className="py-4 px-6 text-foreground">{issue.reported_by}</td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <StatusIcon className={cn("w-4 h-4", status.color)} />
                              <span className={cn("font-semibold", status.color)}>{issue.status}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-sm text-muted-foreground max-w-xs truncate">
                            {issue.description}
                          </td>
                          <td className="py-4 px-6 flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(issue)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(issue.id)}>
                              Delete
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
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

export default ProblemsAndIssues;