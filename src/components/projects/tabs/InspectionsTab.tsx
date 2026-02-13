// src/components/projects/tabs/InspectionsTab.tsx
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  Plus,
  Edit2,
  Trash2,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertCircle,
  Check,
  User,
  FileText,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";

interface Inspection {
  id: string;
  project_id: string;
  milestone_id: string | null;
  item_name: string;
  inspector_name: string;
  inspection_date: string;
  result: "pass" | "fail" | "pending";
  remarks: string | null;
  issue_description: string | null;
  issue_status: "resolved" | "unresolved" | null;
  created_at?: string;
  updated_at?: string;
}

interface Milestone {
  id: string;
  title: string;
  description?: string;
}

interface InspectionsTabProps {
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

const resultConfig = {
  pass: { label: "Pass", color: "text-green-400", bgColor: "bg-green-500/20", borderColor: "border-green-500/30", icon: CheckCircle },
  fail: { label: "Fail", color: "text-red-400", bgColor: "bg-red-500/20", borderColor: "border-red-500/30", icon: XCircle },
  pending: { label: "Pending", color: "text-yellow-400", bgColor: "bg-yellow-500/20", borderColor: "border-yellow-500/30", icon: AlertTriangle },
};

const InspectionsTab: React.FC<InspectionsTabProps> = ({ 
  projectId, 
  milestones, 
  canEdit,
  onUpdate 
}) => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [showFormForMilestone, setShowFormForMilestone] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ milestoneId: string; inspectionId: string } | null>(null);

  const [createForm, setCreateForm] = useState({
    item_name: "",
    inspector_name: "",
    inspection_date: "",
    result: "pending" as "pass" | "fail" | "pending",
    remarks: "",
    issue_description: "",
    issue_status: null as "resolved" | "unresolved" | null,
    milestone_id: "",
  });

  const [editForm, setEditForm] = useState<Partial<Inspection>>({});

  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchInspections = async () => {
    if (!projectId) return setError("No project selected");

    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("inspections")
        .select("*")
        .eq("project_id", projectId)
        .order("inspection_date", { ascending: false });

      if (err) throw err;
      setInspections(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load inspections");
      setInspections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchInspections();
  }, [projectId]);

  const inspectionsByMilestone = useMemo(() => {
    const grouped: Record<string, Inspection[]> = {};
    inspections.forEach((insp) => {
      const milestoneId = insp.milestone_id || "unassigned";
      if (!grouped[milestoneId]) grouped[milestoneId] = [];
      grouped[milestoneId].push(insp);
    });
    return grouped;
  }, [inspections]);

  const validateForm = () => {
    if (!createForm.item_name.trim() && !editForm.item_name?.trim()) 
      return "Item name is required";
    if (!createForm.inspector_name.trim() && !editForm.inspector_name?.trim())
      return "Inspector name is required";
    if (!createForm.inspection_date && !editForm.inspection_date)
      return "Inspection date is required";
    
    const result = editForm.id ? editForm.result : createForm.result;
    if (result === "fail") {
      const issueDesc = editForm.id ? editForm.issue_description : createForm.issue_description;
      if (!issueDesc?.trim()) return "Issue description is required when result is Fail";
    }
    
    return null;
  };

  const resetForm = () => {
    setCreateForm({
      item_name: "",
      inspector_name: "",
      inspection_date: "",
      result: "pending",
      remarks: "",
      issue_description: "",
      issue_status: null,
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
      item_name: "",
      inspector_name: "",
      inspection_date: "",
      result: "pending",
      remarks: "",
      issue_description: "",
      issue_status: null,
      milestone_id: milestoneId,
    });
    setShowFormForMilestone(milestoneId);
    setExpandedMilestones((prev) => new Set([...prev, milestoneId]));
  };

  const handleCreateInspection = async () => {
    const validationError = validateForm();
    if (validationError) return showToast(validationError, "warning");
    if (!createForm.milestone_id) return showToast("Please select a milestone", "warning");

    setLoading(true);

    try {
      const payload = {
        project_id: projectId,
        milestone_id: createForm.milestone_id === "unassigned" ? null : createForm.milestone_id,
        item_name: createForm.item_name.trim(),
        inspector_name: createForm.inspector_name.trim(),
        inspection_date: createForm.inspection_date,
        result: createForm.result,
        remarks: createForm.remarks.trim() || null,
        issue_description: createForm.result === "fail" ? (createForm.issue_description.trim() || null) : null,
        issue_status: createForm.result === "fail" ? "unresolved" : null,
      };

      const { error } = await supabase.from("inspections").insert([payload]);
      if (error) throw error;

      showToast("Inspection added successfully!", "success");
      resetForm();
      fetchInspections();
      onUpdate?.();
    } catch (err: any) {
      showToast(err.message || "Failed to create inspection", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInspection = async (inspectionId: string) => {
    const validationError = validateForm();
    if (validationError) return showToast(validationError, "warning");

    setLoading(true);

    try {
      const payload = {
        item_name: editForm.item_name?.trim(),
        inspector_name: editForm.inspector_name?.trim(),
        inspection_date: editForm.inspection_date,
        result: editForm.result,
        remarks: editForm.remarks?.trim() || null,
        issue_description: editForm.result === "fail" ? (editForm.issue_description?.trim() || null) : null,
        issue_status: editForm.result === "fail" ? editForm.issue_status : null,
        milestone_id: editForm.milestone_id === "unassigned" ? null : editForm.milestone_id,
      };

      const { error } = await supabase
        .from("inspections")
        .update(payload)
        .eq("id", inspectionId);

      if (error) throw error;

      showToast("Inspection updated successfully!", "success");
      resetForm();
      fetchInspections();
      onUpdate?.();
    } catch (err: any) {
      showToast(err.message || "Failed to update inspection", "error");
    } finally {
      setLoading(false);
    }
  };

  const deleteInspection = async (milestoneId: string, inspectionId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("inspections")
        .delete()
        .eq("id", inspectionId);

      if (error) throw error;

      showToast("Inspection deleted successfully!", "success");
      fetchInspections();
      onUpdate?.();
    } catch (err: any) {
      showToast(err.message || "Failed to delete inspection", "error");
    } finally {
      setLoading(false);
      setConfirmDelete(null);
    }
  };

  const toggleIssueStatus = async (inspection: Inspection) => {
    if (inspection.result !== "fail") return;

    const newStatus = inspection.issue_status === "resolved" ? "unresolved" : "resolved";
    
    try {
      const { error } = await supabase
        .from("inspections")
        .update({ issue_status: newStatus })
        .eq("id", inspection.id);

      if (error) throw error;

      showToast(`Issue marked as ${newStatus}!`, "success");
      fetchInspections();
    } catch (err: any) {
      showToast(err.message || "Failed to update issue status", "error");
    }
  };

  const startEdit = (inspection: Inspection, milestoneId: string) => {
    setShowFormForMilestone(milestoneId);
    setEditForm({
      ...inspection,
      inspection_date: inspection.inspection_date || "",
    });
    setExpandedMilestones((prev) => new Set([...prev, milestoneId]));
  };

  const allMilestones = useMemo(() => {
    const safeMilestones = Array.isArray(milestones) ? milestones : [];
    return [{ id: "unassigned", title: "Unassigned / Global Inspections", description: "" }, ...safeMilestones];
  }, [milestones]);

  const safeInspections = Array.isArray(inspections) ? inspections : [];
  const safeMilestones = Array.isArray(milestones) ? milestones : [];

  // Summary stats
  const totalInspections = safeInspections.length;
  const passedInspections = safeInspections.filter(i => i.result === "pass").length;
  const failedInspections = safeInspections.filter(i => i.result === "fail").length;
  const unresolvedIssues = safeInspections.filter(i => i.result === "fail" && i.issue_status === "unresolved").length;

  if (loading && safeInspections.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading inspections...</p>
        </div>
      </div>
    );
  }

  if (error && safeInspections.length === 0) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold mb-2">Error</h3>
        <p className="text-muted-foreground mb-6">{error}</p>
        <button
          onClick={fetchInspections}
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
            <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Quality Inspections</h3>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              {totalInspections} total inspections • {passedInspections} passed • {failedInspections} failed
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl sm:text-3xl font-bold">{totalInspections}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Total Inspections</p>
              </div>
              <ClipboardCheck className="w-8 h-8 sm:w-10 sm:h-10 opacity-80 text-primary" />
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl sm:text-3xl font-bold">{passedInspections}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Passed</p>
              </div>
              <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 opacity-80 text-green-400" />
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl sm:text-3xl font-bold">{failedInspections}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Failed</p>
              </div>
              <XCircle className="w-8 h-8 sm:w-10 sm:h-10 opacity-80 text-red-400" />
            </div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl sm:text-3xl font-bold">{unresolvedIssues}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Unresolved Issues</p>
              </div>
              <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 opacity-80 text-yellow-400" />
            </div>
          </GlassCard>
        </div>

        {/* Milestones with Inspections */}
        {safeMilestones.length === 0 ? (
          <GlassCard className="text-center py-12 sm:py-16">
            <ClipboardCheck className="w-16 h-16 sm:w-20 sm:h-20 text-primary/30 mx-auto mb-4 sm:mb-6" />
            <p className="text-base sm:text-xl text-muted-foreground mb-4 sm:mb-6">No milestones created yet</p>
            <p className="text-sm text-muted-foreground">Create milestones first to add inspections</p>
          </GlassCard>
        ) : (
          <div className="space-y-6">
            {allMilestones.map((milestone) => {
              const milestoneInspections = inspectionsByMilestone[milestone.id] || [];
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
                        {milestoneInspections.length} {milestoneInspections.length === 1 ? "inspection" : "inspections"} •{" "}
                        {milestoneInspections.filter(i => i.result === "pass").length} passed •{" "}
                        {milestoneInspections.filter(i => i.result === "fail").length} failed
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
                                {showingForm ? "Cancel" : "Add Inspection"}
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
                                    {editForm.id ? "Edit Inspection" : "Add New Inspection"}
                                  </h4>
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Item/Batch Name *
                                        </label>
                                        <input
                                          type="text"
                                          value={editForm.id ? (editForm.item_name || "") : createForm.item_name}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, item_name: e.target.value })
                                              : setCreateForm({ ...createForm, item_name: e.target.value })
                                          }
                                          placeholder="e.g., Cement Batch #13, Steel Rods Lot A"
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          required
                                          disabled={loading}
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Inspector Name *
                                        </label>
                                        <input
                                          type="text"
                                          value={editForm.id ? (editForm.inspector_name || "") : createForm.inspector_name}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, inspector_name: e.target.value })
                                              : setCreateForm({ ...createForm, inspector_name: e.target.value })
                                          }
                                          placeholder="e.g., Jane Doe"
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          required
                                          disabled={loading}
                                        />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Inspection Date *
                                        </label>
                                        <input
                                          type="date"
                                          max={todayISO}
                                          value={editForm.id ? (editForm.inspection_date || "") : createForm.inspection_date}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, inspection_date: e.target.value })
                                              : setCreateForm({ ...createForm, inspection_date: e.target.value })
                                          }
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          required
                                          disabled={loading}
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                          Result *
                                        </label>
                                        <select
                                          value={editForm.id ? (editForm.result || "pending") : createForm.result}
                                          onChange={(e) =>
                                            editForm.id
                                              ? setEditForm({ ...editForm, result: e.target.value as any })
                                              : setCreateForm({ ...createForm, result: e.target.value as any })
                                          }
                                          className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                          required
                                          disabled={loading}
                                        >
                                          {Object.entries(resultConfig).map(([value, config]) => (
                                            <option key={value} value={value} className="bg-background">
                                              {config.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                        Remarks
                                      </label>
                                      <textarea
                                        value={editForm.id ? (editForm.remarks || "") : createForm.remarks}
                                        onChange={(e) =>
                                          editForm.id
                                            ? setEditForm({ ...editForm, remarks: e.target.value })
                                            : setCreateForm({ ...createForm, remarks: e.target.value })
                                        }
                                        placeholder="Additional notes about the inspection..."
                                        rows={2}
                                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground resize-none"
                                        disabled={loading}
                                      />
                                    </div>

                                    {((editForm.id && editForm.result === "fail") || (!editForm.id && createForm.result === "fail")) && (
                                      <>
                                        <div>
                                          <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                            Issue Description * <span className="text-red-400">(Required for failed inspections)</span>
                                          </label>
                                          <textarea
                                            value={editForm.id ? (editForm.issue_description || "") : createForm.issue_description}
                                            onChange={(e) =>
                                              editForm.id
                                                ? setEditForm({ ...editForm, issue_description: e.target.value })
                                                : setCreateForm({ ...createForm, issue_description: e.target.value })
                                            }
                                            placeholder="Describe the issue found during inspection..."
                                            rows={3}
                                            className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground resize-none"
                                            required
                                            disabled={loading}
                                          />
                                        </div>

                                        {editForm.id && (
                                          <div>
                                            <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                              Issue Status
                                            </label>
                                            <select
                                              value={editForm.issue_status || "unresolved"}
                                              onChange={(e) =>
                                                setEditForm({ ...editForm, issue_status: e.target.value as any })
                                              }
                                              className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                              disabled={loading}
                                            >
                                              <option value="unresolved" className="bg-background">Unresolved</option>
                                              <option value="resolved" className="bg-background">Resolved</option>
                                            </select>
                                          </div>
                                        )}
                                      </>
                                    )}

                                    <div className="flex gap-3 pt-4">
                                      <button
                                        type="button"
                                        onClick={() => 
                                          editForm.id 
                                            ? handleUpdateInspection(editForm.id as string) 
                                            : handleCreateInspection()
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
                                            {editForm.id ? "Update Inspection" : "Create Inspection"}
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

                          {/* Inspections List */}
                          {milestoneInspections.length === 0 ? (
                            <div className="text-center py-8 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl">
                              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                              <p className="text-muted-foreground">No inspections for this milestone yet.</p>
                              {canEdit && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  Click "Add Inspection" above to get started.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {milestoneInspections.map((inspection, idx) => {
                                const isEditing = editForm.id === inspection.id;
                                if (isEditing && showingForm) return null;

                                const result = resultConfig[inspection.result];
                                const ResultIcon = result.icon;

                                return (
                                  <motion.div
                                    key={inspection.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="backdrop-blur-xl bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 sm:p-5 transition-all"
                                  >
                                    <div className="flex items-start gap-3 sm:gap-4">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                          <h4 className="font-semibold text-sm sm:text-base md:text-lg break-words">
                                            {inspection.item_name}
                                          </h4>
                                          <span className={`px-3 py-1 rounded-lg text-xs font-semibold backdrop-blur-xl border ${result.bgColor} ${result.borderColor} ${result.color} flex items-center gap-1 w-fit`}>
                                            <ResultIcon className="w-3 h-3" />
                                            {result.label}
                                          </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                                          <div className="flex items-center gap-1.5">
                                            <User className="w-3.5 h-3.5" />
                                            <span>Inspector: <span className="font-semibold">{inspection.inspector_name}</span></span>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span>Date: {format(new Date(inspection.inspection_date), "dd MMM yyyy")}</span>
                                          </div>
                                        </div>

                                        {inspection.remarks && (
                                          <div className="mt-2 text-xs sm:text-sm text-muted-foreground italic">
                                            <FileText className="w-3 h-3 inline mr-1" />
                                            {inspection.remarks}
                                          </div>
                                        )}

                                        {inspection.result === "fail" && inspection.issue_description && (
                                          <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                            <div className="flex items-center justify-between mb-2">
                                              <p className="text-xs font-semibold text-red-400">Issue Description:</p>
                                              {inspection.issue_status && (
                                                <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                                  inspection.issue_status === "resolved" 
                                                    ? "bg-green-500/20 text-green-400" 
                                                    : "bg-yellow-500/20 text-yellow-400"
                                                }`}>
                                                  {inspection.issue_status === "resolved" ? "Resolved" : "Unresolved"}
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-xs sm:text-sm text-red-300">{inspection.issue_description}</p>
                                            {canEdit && inspection.issue_status === "unresolved" && (
                                              <button
                                                onClick={() => toggleIssueStatus(inspection)}
                                                className="mt-2 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-400 px-3 py-1 rounded-lg font-semibold transition"
                                              >
                                                Mark as Resolved
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {canEdit && (
                                        <div className="flex gap-2 flex-shrink-0">
                                          <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => startEdit(inspection, milestone.id)}
                                            className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </motion.button>
                                          <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => setConfirmDelete({ milestoneId: milestone.id, inspectionId: inspection.id })}
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
                    <h2 className="text-xl font-bold text-foreground">Delete Inspection</h2>
                    <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                  </div>
                </div>

                <p className="mb-6 text-muted-foreground">
                  Are you sure you want to delete this inspection? This will permanently remove it from the project.
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
                    onClick={() => deleteInspection(confirmDelete.milestoneId, confirmDelete.inspectionId)}
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

export default InspectionsTab;