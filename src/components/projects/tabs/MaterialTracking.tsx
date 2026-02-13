// src/components/projects/tabs/MaterialTrackingTab.tsx
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertCircle,
  Check,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";

const units = ["bags", "pieces", "pcs", "tons", "liters", "kg", "m³", "m²"];

interface Material {
  id: string;
  project_id: string;
  milestone_id: string | null;
  name: string;
  used: number;
  wastage: number;
  inventory: number;
  unit: string;
  date_used: string | null;
  date_wasted: string | null;
  wastage_reason: string | null;
  created_at?: string;
  updated_at?: string;
}

interface Milestone {
  id: string;
  title: string;
  description?: string;
}

interface MaterialTrackingTabProps {
  projectId: string;
  milestones: Milestone[];
  canEdit: boolean;
  onUpdate?: () => void;
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

const getSummaryStats = (materials: Material[]) => {
  const totalMaterials = materials.length;
  const totalUsed = materials.reduce((acc, m) => acc + Number(m.used), 0);
  const totalWastage = materials.reduce((acc, m) => acc + Number(m.wastage), 0);
  const totalInventory = materials.reduce((acc, m) => acc + Number(m.inventory), 0);
  const wastagePercentage = totalUsed > 0 ? ((totalWastage / totalUsed) * 100).toFixed(1) : "0";

  return [
    { icon: Package, value: totalMaterials, label: "Total Materials", color: "text-primary" },
    { icon: TrendingUp, value: totalUsed.toFixed(2), label: "Total Used", color: "text-blue-400" },
    { icon: AlertTriangle, value: `${wastagePercentage}%`, label: "Wastage Rate", color: "text-yellow-400" },
    { icon: CheckCircle, value: totalInventory.toFixed(2), label: "In Inventory", color: "text-green-400" },
  ];
};

const MaterialTrackingTab: React.FC<MaterialTrackingTabProps> = ({ 
  projectId, 
  milestones, 
  canEdit,
  onUpdate 
}) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [showFormForMilestone, setShowFormForMilestone] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ milestoneId: string; materialId: string } | null>(null);

  const [createForm, setCreateForm] = useState({
    name: "",
    unit: units[0],
    used: "",
    wastage: "",
    inventory: "",
    date_used: "",
    date_wasted: "",
    wastage_reason: "",
    milestone_id: "",
  });

  const [editForm, setEditForm] = useState<Partial<Material>>({});

  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchMaterials = async () => {
    if (!projectId) return setError("No project selected");

    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("material_tracking")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (err) throw err;
      setMaterials(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load materials");
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchMaterials();
  }, [projectId]);

  const materialsByMilestone = useMemo(() => {
    const grouped: Record<string, Material[]> = {};
    materials.forEach((m) => {
      const milestoneId = m.milestone_id || "unassigned";
      if (!grouped[milestoneId]) grouped[milestoneId] = [];
      grouped[milestoneId].push(m);
    });
    return grouped;
  }, [materials]);

  const validateForm = () => {
    if (!createForm.name.trim() && !editForm.name?.trim()) 
      return "Material name is required";
    
    const wastageNum = Number(editForm.id ? editForm.wastage : createForm.wastage) || 0;
    
    if (wastageNum > 0) {
      const reason = editForm.id ? editForm.wastage_reason : createForm.wastage_reason;
      const dateWasted = editForm.id ? editForm.date_wasted : createForm.date_wasted;
      
      if (!reason?.trim()) return "Wastage reason is required when wastage > 0";
      if (!dateWasted) return "Wastage date is required when wastage > 0";
    }
    
    return null;
  };

  const resetForm = () => {
    setCreateForm({
      name: "",
      unit: units[0],
      used: "",
      wastage: "",
      inventory: "",
      date_used: "",
      date_wasted: "",
      wastage_reason: "",
      milestone_id: "",
    });
    setEditForm({});
    setShowFormForMilestone(null);
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
      name: "",
      unit: units[0],
      used: "",
      wastage: "",
      inventory: "",
      date_used: "",
      date_wasted: "",
      wastage_reason: "",
      milestone_id: milestoneId,
    });
    setShowFormForMilestone(milestoneId);
    setExpandedMilestones((prev) => new Set([...prev, milestoneId]));
  };

  const handleCreateMaterial = async () => {
    const validationError = validateForm();
    if (validationError) return showToast(validationError, "warning");
    if (!createForm.milestone_id) return showToast("Please select a milestone", "warning");

    setLoading(true);
    const wastageNum = Number(createForm.wastage) || 0;

    try {
      const payload = {
        project_id: projectId,
        milestone_id: createForm.milestone_id === "unassigned" ? null : createForm.milestone_id,
        name: createForm.name.trim(),
        unit: createForm.unit,
        used: Number(createForm.used) || 0,
        wastage: wastageNum,
        inventory: Number(createForm.inventory) || 0,
        date_used: createForm.date_used || null,
        date_wasted: wastageNum > 0 ? (createForm.date_wasted || null) : null,
        wastage_reason: wastageNum > 0 ? (createForm.wastage_reason.trim() || null) : null,
      };

      const { error } = await supabase.from("material_tracking").insert([payload]);
      if (error) throw error;

      showToast("Material added successfully!", "success");
      resetForm();
      fetchMaterials();
      onUpdate?.();
    } catch (err: any) {
      showToast(err.message || "Failed to create material", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMaterial = async (materialId: string) => {
    const validationError = validateForm();
    if (validationError) return showToast(validationError, "warning");

    setLoading(true);
    const wastageNum = Number(editForm.wastage) || 0;

    try {
      const payload = {
        name: editForm.name?.trim(),
        unit: editForm.unit,
        used: Number(editForm.used) || 0,
        wastage: wastageNum,
        inventory: Number(editForm.inventory) || 0,
        date_used: editForm.date_used || null,
        date_wasted: wastageNum > 0 ? (editForm.date_wasted || null) : null,
        wastage_reason: wastageNum > 0 ? (editForm.wastage_reason?.trim() || null) : null,
        milestone_id: editForm.milestone_id === "unassigned" ? null : editForm.milestone_id,
      };

      const { error } = await supabase
        .from("material_tracking")
        .update(payload)
        .eq("id", materialId);

      if (error) throw error;

      showToast("Material updated successfully!", "success");
      resetForm();
      fetchMaterials();
      onUpdate?.();
    } catch (err: any) {
      showToast(err.message || "Failed to update material", "error");
    } finally {
      setLoading(false);
    }
  };

  const deleteMaterial = async (milestoneId: string, materialId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("material_tracking")
        .delete()
        .eq("id", materialId);

      if (error) throw error;

      showToast("Material deleted successfully!", "success");
      fetchMaterials();
      onUpdate?.();
    } catch (err: any) {
      showToast(err.message || "Failed to delete material", "error");
    } finally {
      setLoading(false);
      setConfirmDelete(null);
    }
  };

  const startEdit = (material: Material, milestoneId: string) => {
    setShowFormForMilestone(milestoneId);
    setEditForm({
      ...material,
      date_used: material.date_used || "",
      date_wasted: material.date_wasted || "",
    });
    setExpandedMilestones((prev) => new Set([...prev, milestoneId]));
  };

  const allMilestones = useMemo(() => {
    const safeMilestones = Array.isArray(milestones) ? milestones : [];
    return [{ id: "unassigned", title: "Unassigned / Global Materials", description: "" }, ...safeMilestones];
  }, [milestones]);

  const safeMaterials = Array.isArray(materials) ? materials : [];
  const safeMilestones = Array.isArray(milestones) ? milestones : [];

  if (loading && safeMaterials.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading materials...</p>
        </div>
      </div>
    );
  }

  if (error && safeMaterials.length === 0) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2">Error</h3>
        <p className="text-muted-foreground mb-6">{error}</p>
        <button
          onClick={fetchMaterials}
          className="bg-primary text-background font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Material Tracking</h3>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              {safeMaterials.length} total materials • Track usage, wastage, and inventory
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {getSummaryStats(safeMaterials).map((stat) => (
            <GlassCard key={stat.label}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl sm:text-3xl font-bold">{stat.value}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
                <stat.icon className={`w-8 h-8 sm:w-10 sm:h-10 opacity-80 ${stat.color}`} />
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Milestones with Materials */}
        {safeMilestones.length === 0 ? (
          <GlassCard className="text-center py-12 sm:py-16">
            <Package className="w-16 h-16 sm:w-20 sm:h-20 text-primary/30 mx-auto mb-4 sm:mb-6" />
            <p className="text-base sm:text-xl text-muted-foreground mb-4 sm:mb-6">No milestones created yet</p>
            <p className="text-sm text-muted-foreground">Create milestones first to add materials</p>
          </GlassCard>
        ) : (
          <div className="space-y-6">
            {allMilestones.map((milestone) => {
              const milestoneMaterials = materialsByMilestone[milestone.id] || [];
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
                        {milestoneMaterials.length} {milestoneMaterials.length === 1 ? "material" : "materials"} •{" "}
                        {milestoneMaterials.reduce((sum, m) => sum + Number(m.used), 0).toFixed(2)} total used
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
                                    resetForm();
                                  } else {
                                    openAddForm(milestone.id);
                                  }
                                }}
                                className="bg-primary text-background font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition flex items-center gap-2"
                                disabled={loading}
                              >
                                {showingForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                {showingForm ? "Cancel" : "Add Material"}
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
                                    {editForm.id ? "Edit Material" : "Add New Material"}
                                  </h4>
                                  <div className="space-y-4">
                                    <div>
                                      <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                        Material Name *
                                      </label>
                                      <input
                                        type="text"
                                        value={editForm.id ? (editForm.name || "") : createForm.name}
                                        onChange={(e) =>
                                          editForm.id
                                            ? setEditForm({ ...editForm, name: e.target.value })
                                            : setCreateForm({ ...createForm, name: e.target.value })
                                        }
                                        placeholder="e.g., Cement, Steel bars, Sand"
                                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                        required
                                        disabled={loading}
                                      />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Unit *
                                        </label>
                                        <select
                                          value={editForm.id ? (editForm.unit || units[0]) : createForm.unit}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, unit: e.target.value })
                                              : setCreateForm({ ...createForm, unit: e.target.value })
                                          }
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          required
                                          disabled={loading}
                                        >
                                          {units.map((u) => (
                                            <option key={u} value={u} className="bg-background">
                                              {u}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Used
                                        </label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={editForm.id ? (editForm.used || "") : createForm.used}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, used: Number(e.target.value) })
                                              : setCreateForm({ ...createForm, used: e.target.value })
                                          }
                                          placeholder="0.00"
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          disabled={loading}
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Inventory
                                        </label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={editForm.id ? (editForm.inventory || "") : createForm.inventory}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, inventory: Number(e.target.value) })
                                              : setCreateForm({ ...createForm, inventory: e.target.value })
                                          }
                                          placeholder="0.00"
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          disabled={loading}
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Wastage
                                        </label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={editForm.id ? (editForm.wastage || "") : createForm.wastage}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, wastage: Number(e.target.value) })
                                              : setCreateForm({ ...createForm, wastage: e.target.value })
                                          }
                                          placeholder="0.00"
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          disabled={loading}
                                        />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Date Used
                                        </label>
                                        <input
                                          type="date"
                                          max={todayISO}
                                          value={editForm.id ? (editForm.date_used || "") : createForm.date_used}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, date_used: e.target.value })
                                              : setCreateForm({ ...createForm, date_used: e.target.value })
                                          }
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          disabled={loading}
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Date Wasted {Number(editForm.id ? editForm.wastage : createForm.wastage) > 0 && <span className="text-red-400">*</span>}
                                        </label>
                                        <input
                                          type="date"
                                          max={todayISO}
                                          value={editForm.id ? (editForm.date_wasted || "") : createForm.date_wasted}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, date_wasted: e.target.value })
                                              : setCreateForm({ ...createForm, date_wasted: e.target.value })
                                          }
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          disabled={loading || Number(editForm.id ? editForm.wastage : createForm.wastage) <= 0}
                                          required={Number(editForm.id ? editForm.wastage : createForm.wastage) > 0}
                                        />
                                      </div>
                                    </div>

                                    {Number(editForm.id ? editForm.wastage : createForm.wastage) > 0 && (
                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Wastage Reason *
                                        </label>
                                        <textarea
                                          value={editForm.id ? (editForm.wastage_reason || "") : createForm.wastage_reason}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, wastage_reason: e.target.value })
                                              : setCreateForm({ ...createForm, wastage_reason: e.target.value })
                                          }
                                          placeholder="e.g., Material damaged during transport, spillage, overestimation, theft..."
                                          rows={3}
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground resize-none"
                                          required
                                          disabled={loading}
                                        />
                                      </div>
                                    )}

                                    <div className="flex gap-3 pt-4">
                                      <button
                                        type="button"
                                        onClick={() => 
                                          editForm.id 
                                            ? handleUpdateMaterial(editForm.id as string) 
                                            : handleCreateMaterial()
                                        }
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
                                            {editForm.id ? "Update Material" : "Create Material"}
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

                          {/* Materials List */}
                          {milestoneMaterials.length === 0 ? (
                            <div className="text-center py-8 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl">
                              <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                              <p className="text-muted-foreground">No materials assigned to this milestone yet.</p>
                              {canEdit && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  Click "Add Material" above to get started.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {milestoneMaterials.map((material, idx) => {
                                const isEditing = editForm.id === material.id;
                                if (isEditing && showingForm) return null;

                                return (
                                  <motion.div
                                    key={material.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="backdrop-blur-xl bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 sm:p-5 transition-all"
                                  >
                                    <div className="flex items-start gap-3 sm:gap-4">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                          <h4 className="font-semibold text-sm sm:text-base md:text-lg break-words">
                                            {material.name}
                                          </h4>
                                          <span className="px-3 py-1 rounded-lg text-xs font-semibold backdrop-blur-xl border border-primary/30 bg-primary/10 text-primary flex items-center gap-1 w-fit">
                                            {material.unit}
                                          </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                                          <div className="flex items-center gap-1.5">
                                            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                                            <span>Used: <span className="font-semibold text-blue-400">{material.used}</span></span>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                                            <span>Wasted: <span className="font-semibold text-yellow-400">{material.wastage}</span></span>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <Package className="w-3.5 h-3.5 text-green-400" />
                                            <span>Stock: <span className="font-semibold text-green-400">{material.inventory}</span></span>
                                          </div>
                                          {material.date_used && (
                                            <div className="flex items-center gap-1.5">
                                              <Calendar className="w-3.5 h-3.5" />
                                              <span>Used: {format(new Date(material.date_used), "dd MMM yyyy")}</span>
                                            </div>
                                          )}
                                          {material.date_wasted && (
                                            <div className="flex items-center gap-1.5">
                                              <Calendar className="w-3.5 h-3.5 text-yellow-400" />
                                              <span>Wasted: {format(new Date(material.date_wasted), "dd MMM yyyy")}</span>
                                            </div>
                                          )}
                                        </div>

                                        {material.wastage > 0 && material.wastage_reason && (
                                          <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                                            <p className="text-xs sm:text-sm text-yellow-300 italic">
                                              <span className="font-semibold">Wastage Reason:</span> {material.wastage_reason}
                                            </p>
                                          </div>
                                        )}
                                      </div>

                                      {canEdit && (
                                        <div className="flex gap-2 flex-shrink-0">
                                          <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => startEdit(material, milestone.id)}
                                            className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </motion.button>
                                          <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => setConfirmDelete({ milestoneId: milestone.id, materialId: material.id })}
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
                    <h2 className="text-xl font-bold text-foreground">Delete Material</h2>
                    <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                  </div>
                </div>

                <p className="mb-6 text-muted-foreground">
                  Are you sure you want to delete this material? This will permanently remove it from the project.
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
                    onClick={() => deleteMaterial(confirmDelete.milestoneId, confirmDelete.materialId)}
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
};

export default MaterialTrackingTab;