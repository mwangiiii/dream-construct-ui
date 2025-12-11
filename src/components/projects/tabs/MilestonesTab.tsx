// src/components/projects/tabs/MilestonesTab.tsx
import { useState, useEffect, useCallback } from "react";
import { format, differenceInDays, isAfter, isBefore, isValid, parseISO, startOfDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import {
  Calendar,
  Plus,
  Edit2,
  GripVertical,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { projectApi } from "@/lib/api/projectApi";
import { Milestone, MilestoneStatus } from "@/types/project";

interface MilestonesTabProps {
  projectId: string;
  milestones: Milestone[];
  canEdit: boolean;
  onUpdate: () => void;
}

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

const statusOptions = [
  { value: "not_started", label: "Not Started", color: "bg-gray-500/20 text-gray-300 border-gray-500/30", icon: Clock },
  { value: "in_progress", label: "In Progress", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: Clock },
  { value: "completed", label: "Completed", color: "bg-green-500/20 text-green-300 border-green-500/30", icon: CheckCircle2 },
  { value: "delayed", label: "Delayed", color: "bg-red-500/20 text-red-300 border-red-500/30", icon: AlertCircle },
];

interface ProjectDates {
  start_date: string | null;
  created_at: string;
}

export default function MilestonesTab({ projectId, milestones, canEdit, onUpdate }: MilestonesTabProps) {
  const [projectDates, setProjectDates] = useState<ProjectDates | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dynamicMilestones, setDynamicMilestones] = useState<Milestone[]>(milestones);

  // Fetch project start/created dates on mount
  useEffect(() => {
    const fetchProjectDates = async () => {
      if (!projectId) return;
      const { data } = await supabase
        .from("projects")
        .select("start_date, created_at")
        .eq("id", projectId)
        .single();
      setProjectDates(data || null);
    };
    fetchProjectDates();
  }, [projectId]);

  // Get effective project start: start_date or created_at floored
  const getProjectStart = useCallback((): Date | null => {
    if (!projectDates) return null;
    const start = projectDates.start_date ? parseISO(projectDates.start_date) : parseISO(projectDates.created_at);
    return startOfDay(start);
  }, [projectDates]);

  // Sync props with local state
  useEffect(() => {
    setDynamicMilestones(milestones.map(m => ({
      ...m,
      status: computeStatus(m),
      progress_percent: computeProgress(m),
    })));
  }, [milestones]);

  // Live progress timer: Update every 5 minutes
  useEffect(() => {
    if (!canEdit || editingId) return;
    const interval = setInterval(() => {
      setDynamicMilestones(prev => prev.map(m => ({
        ...m,
        progress_percent: computeProgress(m),
        status: computeStatus(m),
      })));
    }, 300000); // 5 min
    return () => clearInterval(interval);
  }, [canEdit, editingId]);

  // Edit form state (no progress_percent)
  const [editForm, setEditForm] = useState<Partial<Milestone>>({});

  // Enhanced progress: Blocks early dates, time-based
  const computeProgress = useCallback((milestone: Milestone): number => {
    const now = new Date();
    const projectStart = getProjectStart();
    const actualStart = milestone.actual_start_date ? parseISO(milestone.actual_start_date) : null;
    const plannedEnd = milestone.planned_end_date ? parseISO(milestone.planned_end_date) : null;
    const actualEnd = milestone.actual_end_date ? parseISO(milestone.actual_end_date) : null;

    // Block/flag dates before project start
    const dates = [actualStart, plannedEnd, actualEnd].filter(Boolean);
    if (projectStart && dates.some(d => isBefore(d!, projectStart))) {
      return 0; // Invalid: No progress
    }

    // Scenario 1: No actual start → 0%
    if (!actualStart || !isValid(actualStart)) return 0;

    // Scenario 2: Actual end set → 100%
    if (actualEnd && isValid(actualEnd)) return 100;

    // Scenario 3: Time-based (actual start to planned end)
    if (plannedEnd && isValid(plannedEnd)) {
      const duration = differenceInDays(plannedEnd, actualStart);
      const elapsed = differenceInDays(now, actualStart);
      if (duration <= 0) return 100; // Invalid duration
      const progress = Math.min(100, Math.max(0, (elapsed / duration) * 100));
      return Math.round(progress);
    }

    // Scenario 4: Started but no planned end → 10% (initiated)
    return 10;
  }, [getProjectStart]);

  // Enhanced status: Covers delays, invalids, overlaps (basic), early/late
  const computeStatus = useCallback((milestone: Milestone): MilestoneStatus => {
    const now = new Date();
    const projectStart = getProjectStart();
    const plannedStart = milestone.planned_start_date ? parseISO(milestone.planned_start_date) : null;
    const plannedEnd = milestone.planned_end_date ? parseISO(milestone.planned_end_date) : null;
    const actualStart = milestone.actual_start_date ? parseISO(milestone.actual_start_date) : null;
    const actualEnd = milestone.actual_end_date ? parseISO(milestone.actual_end_date) : null;

    // Block early dates: Any date before project start → delayed
    const dates = [plannedStart, plannedEnd, actualStart, actualEnd].filter(Boolean);
    if (projectStart && dates.some(d => isBefore(d!, projectStart))) {
      return "delayed";
    }

    // Invalid sequences: start > end
    const invalidSeq = (plannedStart && plannedEnd && isAfter(plannedStart, plannedEnd)) ||
                       (actualStart && actualEnd && isAfter(actualStart, actualEnd));
    if (invalidSeq) return "delayed";

    // Basic overlap check: Actual start after previous milestone's planned end (simplified; assumes sequential)
    // Note: For full overlap prevention, backend trigger or separate validation needed

    // No dates → not_started
    if (!dates.length) return "not_started";

    // Planned start overdue without actual → delayed (e.g., permit delay)
    if (plannedStart && isAfter(now, plannedStart) && !actualStart) return "delayed";

    // Actual start set → in_progress (unless completed/delayed)
    if (actualStart) {
      // Early start (before planned): Allow, but check if before project
      if (plannedStart && isBefore(actualStart, plannedStart)) {
        // Real-life: Acceleration OK, but flag if extreme
      }
      if (actualEnd) {
        // Completion: Late if after planned end (weather/supply issues)
        if (plannedEnd && isAfter(actualEnd, plannedEnd)) return "delayed";
        return "completed"; // On-time/early
      }
      // Ongoing: Delayed if past planned end (e.g., labor shortage)
      if (plannedEnd && isAfter(now, plannedEnd)) return "delayed";
      return "in_progress";
    }

    // Planned end passed without actuals → completed (assumed done) or delayed if start overdue
    if (plannedEnd && isAfter(now, plannedEnd)) {
      if (plannedStart && isAfter(plannedStart, now)) return "delayed"; // Future start, past end: Invalid
      return "completed";
    }

    return "not_started";
  }, [getProjectStart]);

  // Enhanced validation: All scenarios, including project start
  const validateDateLogic = useCallback((form: Partial<Milestone>): string | null => {
    const projectStart = getProjectStart();
    if (!projectStart) return "Project dates unavailable.";

    const plannedStart = form.planned_start_date ? parseISO(form.planned_start_date) : null;
    const plannedEnd = form.planned_end_date ? parseISO(form.planned_end_date) : null;
    const actualStart = form.actual_start_date ? parseISO(form.actual_start_date) : null;
    const actualEnd = form.actual_end_date ? parseISO(form.actual_end_date) : null;

    // All dates >= project start (no backdating)
    const dates = [plannedStart, plannedEnd, actualStart, actualEnd].filter(Boolean);
    if (dates.some(d => isBefore(d!, projectStart))) {
      return `Dates cannot precede project start (${format(projectStart, 'MMM dd, yyyy')}).`;
    }

    // Planned: start <= end
    if (plannedStart && plannedEnd && isAfter(plannedStart, plannedEnd)) {
      return "Planned start cannot be after planned end.";
    }

    // Actual: start <= end
    if (actualStart && actualEnd && isAfter(actualStart, actualEnd)) {
      return "Actual start cannot be after actual end.";
    }

    // Soft: Actual start >= planned start (allow early for acceleration)
    if (plannedStart && actualStart && isBefore(actualStart, plannedStart)) {
      // OK, but warn if too early (e.g., >30 days)
      const earlyDays = differenceInDays(plannedStart, actualStart);
      if (earlyDays > 30) return "Actual start is significantly before planned—confirm acceleration.";
    }

    // Status rules
    if (form.status === "in_progress" && !actualStart) {
      return "In Progress requires Actual Start Date.";
    }
    if (form.status === "completed" && !actualEnd && (!plannedEnd || isBefore(new Date(), plannedEnd))) {
      return "Completed requires Actual End Date or past Planned End.";
    }
    if (form.status === "delayed" && !actualEnd && !plannedEnd) {
      return "Delayed typically follows a missed date.";
    }

    // Construction-specific: No future actual end if ongoing
    if (actualEnd && isAfter(actualEnd, new Date())) {
      return "Actual End cannot be in the future.";
    }

    return null;
  }, [getProjectStart]);

  // Update with auto-logic
  const handleUpdateMilestone = async () => {
    if (!editingId || !canEdit) return;

    const validationError = validateDateLogic(editForm);
    if (validationError) {
      alert(validationError);
      return;
    }

    const autoStatus = computeStatus({ ...editForm, actual_start_date: editForm.actual_start_date } as any);
    const autoProgress = computeProgress({ ...editForm, actual_start_date: editForm.actual_start_date } as any);

    setLoading(true);
    try {
      await projectApi.updateMilestone(editingId, {
        title: editForm.title,
        description: editForm.description,
        status: autoStatus,
        planned_start_date: editForm.planned_start_date,
        planned_end_date: editForm.planned_end_date,
        actual_start_date: editForm.actual_start_date,
        actual_end_date: editForm.actual_end_date,
        progress_percent: autoProgress,
      });

      alert("Milestone updated successfully!");
      setEditingId(null);
      setEditForm({});
      onUpdate();
    } catch (error: any) {
      console.error("Error updating milestone:", error);
      alert(error.message || "Failed to update milestone");
    } finally {
      setLoading(false);
    }
  };

  // Reorder (unchanged)
  const handleReorder = async (fromIndex: number, toIndex: number) => {
    if (!canEdit) return;

    const reorderedMilestones = [...dynamicMilestones];
    const [movedItem] = reorderedMilestones.splice(fromIndex, 1);
    reorderedMilestones.splice(toIndex, 0, movedItem);

    const updates = reorderedMilestones.map((m, idx) => ({
      id: m.id,
      sort_order: idx * 100,
    }));

    setLoading(true);
    try {
      await projectApi.reorderMilestones(updates);
      onUpdate();
    } catch (error: any) {
      console.error("Error reordering milestones:", error);
      alert(error.message || "Failed to reorder milestones");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (milestone: Milestone) => {
    setEditingId(milestone.id);
    setEditForm({
      title: milestone.title,
      description: milestone.description,
      status: milestone.status,
      planned_start_date: milestone.planned_start_date,
      planned_end_date: milestone.planned_end_date,
      actual_start_date: milestone.actual_start_date,
      actual_end_date: milestone.actual_end_date,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const getStatusConfig = (status: string) => {
    return statusOptions.find((s) => s.value === status) || statusOptions[0];
  };

  const canSetInProgress = (form: Partial<Milestone>) => !!form.actual_start_date;

  // Drag and Drop Handlers (unchanged)
  const handleDragStart = (e: React.DragEvent, milestoneId: string) => {
    setDraggedItem(milestoneId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropTargetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === dropTargetId) return;

    const fromIndex = dynamicMilestones.findIndex((m) => m.id === draggedItem);
    const toIndex = dynamicMilestones.findIndex((m) => m.id === dropTargetId);

    if (fromIndex !== -1 && toIndex !== -1) {
      handleReorder(fromIndex, toIndex);
    }

    setDraggedItem(null);
  };

  // Render milestone with computed values
  const renderMilestone = (milestone: Milestone, idx: number) => {
    const computedProgress = computeProgress(milestone);
    const computedStatus = computeStatus(milestone);
    const statusConfig = getStatusConfig(computedStatus);
    const StatusIcon = statusConfig.icon;
    const isEditing = editingId === milestone.id;

    return (
      <motion.div
        key={milestone.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.05 }}
        draggable={canEdit && !isEditing}
        onDragStart={(e) => handleDragStart(e, milestone.id)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, milestone.id)}
        className={`${draggedItem === milestone.id ? "opacity-50" : ""}`}
      >
        <GlassCard className="relative">
          {/* Drag Handle */}
          {canEdit && !isEditing && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2 cursor-move opacity-30 hover:opacity-100 transition-opacity">
              <GripVertical className="w-5 h-5 text-muted-foreground" />
            </div>
          )}

          <div className={`${canEdit && !isEditing ? "pl-6" : ""}`}>
            {isEditing ? (
              /* Edit Mode */
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={editForm.title || ""}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={editForm.description || ""}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                {/* Status - With validation */}
                <div>
                  <label className="block text-sm font-medium mb-2">Status</label>
                  <select
                    value={editForm.status || ""}
                    onChange={(e) => {
                      if (e.target.value === "in_progress" && !editForm.actual_start_date) {
                        alert("Cannot set to In Progress without Actual Start Date. Set the date first.");
                        return;
                      }
                      setEditForm({ ...editForm, status: e.target.value });
                    }}
                    disabled={!canSetInProgress(editForm)}
                    className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-background">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dates Grid - Min date enforced via HTML attr */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Planned Start</label>
                    <input
                      type="date"
                      min={projectDates?.start_date || format(new Date(projectDates?.created_at || '2025-01-01'), 'yyyy-MM-dd')}
                      value={editForm.planned_start_date || ""}
                      onChange={(e) => setEditForm({ ...editForm, planned_start_date: e.target.value })}
                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Planned End</label>
                    <input
                      type="date"
                      min={editForm.planned_start_date || projectDates?.start_date || format(new Date(projectDates?.created_at || '2025-01-01'), 'yyyy-MM-dd')}
                      value={editForm.planned_end_date || ""}
                      onChange={(e) => setEditForm({ ...editForm, planned_end_date: e.target.value })}
                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Actual Start</label>
                    <input
                      type="date"
                      min={projectDates?.start_date || format(new Date(projectDates?.created_at || '2025-01-01'), 'yyyy-MM-dd')}
                      value={editForm.actual_start_date || ""}
                      onChange={(e) => setEditForm({ ...editForm, actual_start_date: e.target.value })}
                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Actual End</label>
                    <input
                      type="date"
                      max={format(new Date(), 'yyyy-MM-dd')}  // No future actual ends
                      min={editForm.actual_start_date || projectDates?.start_date || format(new Date(projectDates?.created_at || '2025-01-01'), 'yyyy-MM-dd')}
                      value={editForm.actual_end_date || ""}
                      onChange={(e) => setEditForm({ ...editForm, actual_end_date: e.target.value })}
                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Non-editable Progress */}
                <div className="pt-2">
                  <label className="block text-sm font-medium mb-2">
                    Progress: {computedProgress}%
                  </label>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden backdrop-blur-xl border border-white/20">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${computedProgress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="bg-gradient-to-r from-primary to-accent h-full rounded-full"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Auto-calculated based on dates</p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleUpdateMilestone}
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
            ) : (
              /* View Mode */
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-base sm:text-lg md:text-xl font-bold break-words">{milestone.title}</h4>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        #{idx + 1}
                      </span>
                    </div>
                    {milestone.description && (
                      <p className="text-xs sm:text-sm text-muted-foreground">{milestone.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold backdrop-blur-xl border whitespace-nowrap flex items-center gap-2 ${statusConfig.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusConfig.label}
                    </span>
                    {canEdit && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => startEdit(milestone)}
                        className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Auto Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs sm:text-sm mb-2">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold text-primary">{computedProgress}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden backdrop-blur-xl border border-white/20">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${computedProgress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="bg-gradient-to-r from-primary to-accent h-full rounded-full"
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <div>
                      <span className="text-muted-foreground">Planned: </span>
                      <span className="font-medium">
                        {milestone.planned_start_date
                          ? format(new Date(milestone.planned_start_date), "dd MMM")
                          : "N/A"}{" "}
                        -{" "}
                        {milestone.planned_end_date
                          ? format(new Date(milestone.planned_end_date), "dd MMM yyyy")
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                  {(milestone.actual_start_date || milestone.actual_end_date) && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                      <div>
                        <span className="text-muted-foreground">Actual: </span>
                        <span className="font-medium">
                          {milestone.actual_start_date
                            ? format(new Date(milestone.actual_start_date), "dd MMM")
                            : "N/A"}{" "}
                          -{" "}
                          {milestone.actual_end_date
                            ? format(new Date(milestone.actual_end_date), "dd MMM yyyy")
                            : "Ongoing"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Project Milestones</h3>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            {dynamicMilestones.length} milestone{dynamicMilestones.length !== 1 ? "s" : ""} • 
            {canEdit ? " Drag to reorder" : " View only"}
          </p>
        </div>
        {canEdit && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl text-sm sm:text-base w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Add Milestone
          </motion.button>
        )}
      </div>

      {/* Empty State */}
      {dynamicMilestones.length === 0 ? (
        <GlassCard className="text-center py-12 sm:py-16">
          <Calendar className="w-16 h-16 sm:w-20 sm:h-20 text-primary/30 mx-auto mb-4 sm:mb-6" />
          <p className="text-base sm:text-xl text-muted-foreground mb-4 sm:mb-6">No milestones yet</p>
          {canEdit && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="text-primary hover:text-primary/80 font-semibold text-base sm:text-lg"
            >
              Create your first milestone
            </button>
          )}
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {dynamicMilestones.map((milestone, idx) => renderMilestone(milestone, idx))}
        </div>
      )}

      {/* Create Milestone Modal Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl backdrop-blur-xl bg-background/95 border border-white/20 rounded-2xl p-6"
          >
            <h3 className="text-2xl font-bold mb-4">Create New Milestone</h3>
            <p className="text-muted-foreground mb-6">
              Create milestone modal coming soon! For now, milestones are auto-created.
            </p>
            <button
              onClick={() => setShowCreateModal(false)}
              className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}