import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Plus, X, XCircle, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";

const units = ["bags", "pieces", "pcs", "tons", "liters", "kg", "m³", "m²"];

interface Material {
  id: string;
  project_id: string;
  name: string;
  used: number;
  wastage: number;
  inventory: number;
  unit: string;
  created_at?: string;
  updated_at?: string;
}

interface MaterialTrackingProps {
  projectId?: string;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
}

const getSummaryStats = (materials: Material[]) => {
  const totalMaterials = materials.length;
  const totalUsed = materials.reduce((acc, mat) => acc + mat.used, 0);
  const totalWastage = materials.reduce((acc, mat) => acc + mat.wastage, 0);
  const totalInventory = materials.reduce((acc, mat) => acc + mat.inventory, 0);
  const wastagePercentage = totalUsed > 0 ? ((totalWastage / totalUsed) * 100).toFixed(1) : "0";

  return [
    { icon: Package, value: totalMaterials, label: "Total Materials", color: "text-primary" },
    { icon: TrendingUp, value: totalUsed, label: "Total Used", color: "text-blue-600" },
    { icon: AlertTriangle, value: `${wastagePercentage}%`, label: "Wastage Rate", color: "text-yellow-600" },
    { icon: CheckCircle, value: totalInventory, label: "In Inventory", color: "text-green-600" },
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

const MaterialTracking: React.FC<MaterialTrackingProps> = ({ projectId }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [form, setForm] = useState({ 
    name: "", 
    used: "", 
    wastage: "", 
    inventory: "", 
    unit: units[0] 
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchMaterials = async () => {
    if (!projectId) {
      setLoading(false);
      setError("No project ID provided");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("material_tracking")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Fetch error:", fetchError);
        throw fetchError;
      }

      setMaterials(data || []);
      setError(null);
    } catch (err: any) {
      console.error("Error in fetchMaterials:", err);
      setError(err.message || "Failed to load materials.");
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchMaterials();
    } else {
      setLoading(false);
      setError("No project selected");
    }
  }, [projectId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !projectId) return;

    try {
      const { data, error: insertError } = await supabase
        .from("material_tracking")
        .insert([
          {
            project_id: projectId,
            name: form.name,
            used: Number(form.used) || 0,
            wastage: Number(form.wastage) || 0,
            inventory: Number(form.inventory) || 0,
            unit: form.unit,
          },
        ])
        .select();

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }

      setForm({ name: "", used: "", wastage: "", inventory: "", unit: units[0] });
      setShowAddModal(false);
      showToast("Material added successfully!", "success");
      await fetchMaterials();
    } catch (err: any) {
      console.error("Error in handleAdd:", err);
      showToast(err.message || "Failed to add material.", "error");
    }
  };

  const handleEdit = (material: Material) => {
    setEditId(material.id);
    setForm({
      name: material.name,
      used: material.used.toString(),
      wastage: material.wastage.toString(),
      inventory: material.inventory.toString(),
      unit: material.unit,
    });
    setShowAddModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;

    try {
      const { error: updateError } = await supabase
        .from("material_tracking")
        .update({
          name: form.name,
          used: Number(form.used) || 0,
          wastage: Number(form.wastage) || 0,
          inventory: Number(form.inventory) || 0,
          unit: form.unit,
        })
        .eq("id", editId);

      if (updateError) {
        console.error("Update error:", updateError);
        throw updateError;
      }

      setEditId(null);
      setForm({ name: "", used: "", wastage: "", inventory: "", unit: units[0] });
      setShowAddModal(false);
      showToast("Material updated successfully!", "success");
      await fetchMaterials();
    } catch (err: any) {
      console.error("Error in handleUpdate:", err);
      showToast(err.message || "Failed to update material.", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this material?")) return;

    try {
      const { error: deleteError } = await supabase
        .from("material_tracking")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        throw deleteError;
      }

      showToast("Material deleted successfully!", "success");
      await fetchMaterials();
    } catch (err: any) {
      console.error("Error in handleDelete:", err);
      showToast(err.message || "Failed to delete material.", "error");
    }

    if (editId === id) {
      setEditId(null);
      setForm({ name: "", used: "", wastage: "", inventory: "", unit: units[0] });
    }
  };

  const handleCancel = () => {
    setEditId(null);
    setForm({ name: "", used: "", wastage: "", inventory: "", unit: units[0] });
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
          <p className="text-muted-foreground">Loading materials...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Error loading materials</h3>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => fetchMaterials()} className="mt-4">
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
                Material <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Tracking</span>
              </h1>
              <p className="text-muted-foreground">Track material usage, wastage, and inventory for each project stage.</p>
            </div>
            <Button 
              onClick={() => {
                setShowAddModal(true);
                setEditId(null);
                setForm({ name: "", used: "", wastage: "", inventory: "", unit: units[0] });
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Material
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
                    {editId ? "Edit Material" : "Add Material"}
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
                    <Label className="mb-2 block">Material Name *</Label>
                    <input
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="e.g. Cement, Sand, Bricks"
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="mb-2 block">Used *</Label>
                      <input
                        name="used"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.used}
                        onChange={handleChange}
                        placeholder="0"
                        className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                        required
                      />
                    </div>

                    <div>
                      <Label className="mb-2 block">Wastage *</Label>
                      <input
                        name="wastage"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.wastage}
                        onChange={handleChange}
                        placeholder="0"
                        className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                        required
                      />
                    </div>

                    <div>
                      <Label className="mb-2 block">Inventory *</Label>
                      <input
                        name="inventory"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.inventory}
                        onChange={handleChange}
                        placeholder="0"
                        className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block">Unit *</Label>
                    <select
                      name="unit"
                      value={form.unit}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                      required
                    >
                      {units.map((u) => (
                        <option key={u} value={u} className="bg-background text-foreground">
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all"
                    >
                      {editId ? "Update Material" : "Add Material"}
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
              {getSummaryStats(materials).map((stat) => (
                <StatCard
                  key={stat.label}
                  icon={stat.icon}
                  title={stat.label}
                  value={stat.value}
                  color={stat.color}
                />
              ))}
            </div>

            {/* Materials Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <thead>
                  <tr className="bg-background/60">
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Material</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Used</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Wastage</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Inventory</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Unit</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Wastage %</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <Package className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-foreground mb-2">No materials yet</h3>
                        <p className="text-muted-foreground mb-6">Get started by tracking your first material.</p>
                        <Button
                          onClick={() => {
                            setShowAddModal(true);
                            setEditId(null);
                            setForm({ name: "", used: "", wastage: "", inventory: "", unit: units[0] });
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add First Material
                        </Button>
                      </td>
                    </tr>
                  ) : (
                    materials.map((material) => {
                      const wastagePercent = material.used > 0 
                        ? ((material.wastage / material.used) * 100).toFixed(1) 
                        : "0";
                      const wastageColor = parseFloat(wastagePercent) > 10 
                        ? "text-red-600" 
                        : parseFloat(wastagePercent) > 5 
                        ? "text-yellow-600" 
                        : "text-green-600";

                      return (
                        <tr
                          key={material.id}
                          className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors"
                        >
                          <td className="py-4 px-6 text-foreground font-medium">{material.name}</td>
                          <td className="py-4 px-6 text-foreground">{material.used}</td>
                          <td className="py-4 px-6 text-foreground">{material.wastage}</td>
                          <td className="py-4 px-6 text-foreground">{material.inventory}</td>
                          <td className="py-4 px-6 text-foreground">{material.unit}</td>
                          <td className={cn("py-4 px-6 font-semibold", wastageColor)}>
                            {wastagePercent}%
                          </td>
                          <td className="py-4 px-6 flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(material)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(material.id)}>
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

export default MaterialTracking;