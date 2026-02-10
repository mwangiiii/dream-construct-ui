import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, Plus, X, XCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";

interface Inspection {
  id: string;
  name: string;
  description: string;
  project_id: string;
  created_at?: string;
  updated_at?: string;
}

interface InspectionsProps {
  projectId?: string;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
}

const getSummaryStats = (inspections: Inspection[]) => {
  const totalInspections = inspections.length;
  const withDescription = inspections.filter(i => i.description && i.description.trim()).length;
  const withoutDescription = totalInspections - withDescription;

  return [
    { icon: ClipboardList, value: totalInspections, label: "Total Inspections", color: "text-primary" },
    { icon: CheckCircle, value: withDescription, label: "With Details", color: "text-green-600" },
    { icon: AlertTriangle, value: withoutDescription, label: "Without Details", color: "text-yellow-600" },
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

const Inspections: React.FC<InspectionsProps> = ({ projectId }) => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [form, setForm] = useState({ name: "", description: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchInspections = async () => {
    if (!projectId) {
      setLoading(false);
      setError("No project ID provided");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("inspections")
        .select("id, name, description, project_id, created_at, updated_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Fetch error:", fetchError);
        throw fetchError;
      }

      setInspections(data || []);
      setError(null);
    } catch (err: any) {
      console.error("Error in fetchInspections:", err);
      setError(err.message || "Failed to load inspections.");
      setInspections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchInspections();
    } else {
      setLoading(false);
      setError("No project selected");
    }
  }, [projectId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !projectId) return;

    try {
      const { data, error: insertError } = await supabase
        .from("inspections")
        .insert([{ name: form.name, description: form.description, project_id: projectId }])
        .select();

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }

      setForm({ name: "", description: "" });
      setShowAddModal(false);
      showToast("Inspection added successfully!", "success");
      await fetchInspections();
    } catch (err: any) {
      console.error("Error in handleAdd:", err);
      showToast(err.message || "Failed to add inspection.", "error");
    }
  };

  const handleEdit = (inspection: Inspection) => {
    setEditId(inspection.id);
    setForm({ name: inspection.name, description: inspection.description });
    setShowAddModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;

    try {
      const { error: updateError } = await supabase
        .from("inspections")
        .update({ name: form.name, description: form.description })
        .eq("id", editId);

      if (updateError) {
        console.error("Update error:", updateError);
        throw updateError;
      }

      setEditId(null);
      setForm({ name: "", description: "" });
      setShowAddModal(false);
      showToast("Inspection updated successfully!", "success");
      await fetchInspections();
    } catch (err: any) {
      console.error("Error in handleUpdate:", err);
      showToast(err.message || "Failed to update inspection.", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this inspection?")) return;

    try {
      const { error: deleteError } = await supabase
        .from("inspections")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        throw deleteError;
      }

      showToast("Inspection deleted successfully!", "success");
      await fetchInspections();
    } catch (err: any) {
      console.error("Error in handleDelete:", err);
      showToast(err.message || "Failed to delete inspection.", "error");
    }

    if (editId === id) {
      setEditId(null);
      setForm({ name: "", description: "" });
    }
  };

  const handleCancel = () => {
    setEditId(null);
    setForm({ name: "", description: "" });
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
          <p className="text-muted-foreground">Loading inspections...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Error loading inspections</h3>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => fetchInspections()} className="mt-4">
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
                Project <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Inspections</span>
              </h1>
              <p className="text-muted-foreground">Define, view, and manage the inspections for your construction projects.</p>
            </div>
            <Button 
              onClick={() => {
                setShowAddModal(true);
                setEditId(null);
                setForm({ name: "", description: "" });
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Inspection
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
                    {editId ? "Edit Inspection" : "Add Inspection"}
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
                    <Label className="mb-2 block">Inspection Name *</Label>
                    <input
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Safety Inspection, Quality Check, Final Walkthrough"
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <Label className="mb-2 block">Description</Label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder="Describe the purpose and scope of this inspection..."
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 resize-none"
                      rows={4}
                    />
                  </div>

                  <div className="flex gap-3 mt-6">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all"
                    >
                      {editId ? "Update Inspection" : "Add Inspection"}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10">
              {getSummaryStats(inspections).map((stat) => (
                <StatCard
                  key={stat.label}
                  icon={stat.icon}
                  title={stat.label}
                  value={stat.value}
                  color={stat.color}
                />
              ))}
            </div>

            {/* Inspections Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <thead>
                  <tr className="bg-background/60">
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Name</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Description</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-12 text-center">
                        <ClipboardList className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-foreground mb-2">No inspections yet</h3>
                        <p className="text-muted-foreground mb-6">Get started by adding your first inspection.</p>
                        <Button
                          onClick={() => {
                            setShowAddModal(true);
                            setEditId(null);
                            setForm({ name: "", description: "" });
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add First Inspection
                        </Button>
                      </td>
                    </tr>
                  ) : (
                    inspections.map((inspection) => (
                      <tr
                        key={inspection.id}
                        className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors"
                      >
                        <td className="py-4 px-6 text-foreground font-medium">{inspection.name}</td>
                        <td className="py-4 px-6 text-foreground">
                          {inspection.description ? (
                            <span className="text-sm">{inspection.description}</span>
                          ) : (
                            <span className="text-muted-foreground italic">No description</span>
                          )}
                        </td>
                        <td className="py-4 px-6 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(inspection)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(inspection.id)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))
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

export default Inspections;