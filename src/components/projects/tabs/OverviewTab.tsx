// src/components/projects/tabs/OverviewTab.tsx
import { useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  Calendar,
  DollarSign,
  MessageSquare,
  FileText,
  CheckCircle2,
  Edit2,
  Save,
  X,
  Clock,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface OverviewTabProps {
  project: any;
  milestones: any[];
  tasks: any[];
  updates: any[];
  documents: any[];
  canEdit: boolean;
  isClient: boolean;
  onProjectUpdate: () => void;
}

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

const statusOptions = [
  { value: "planning", label: "Planning", color: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
  { value: "pre_construction", label: "Pre-Construction", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { value: "in_construction", label: "In Construction", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  { value: "inspections", label: "Inspections", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { value: "completed", label: "Completed", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  { value: "on_hold", label: "On Hold", color: "bg-red-500/20 text-red-300 border-red-500/30" },
];

export default function OverviewTab({
  project,
  milestones,
  tasks,
  updates,
  documents,
  canEdit,
  isClient,
  onProjectUpdate,
}: OverviewTabProps) {
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [isEditingProgress, setIsEditingProgress] = useState(false);
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [loading, setLoading] = useState(false);

  const [statusValue, setStatusValue] = useState(project.status);
  const [progressValue, setProgressValue] = useState(project.progress_percent);
  const [startDate, setStartDate] = useState(project.start_date || "");
  const [expectedDate, setExpectedDate] = useState(project.expected_completion_date || "");
  const [actualDate, setActualDate] = useState(project.actual_completion_date || "");
  const [dateError, setDateError] = useState("");

  // Get project creation date (cannot set dates before this)
  const projectCreatedDate = project.created_at ? new Date(project.created_at).toISOString().split('T')[0] : null;
  const today = new Date().toISOString().split('T')[0];

  // Date validation function
  const validateDates = (start: string, expected: string, actual: string): string | null => {
    const startDateObj = start ? new Date(start) : null;
    const expectedDateObj = expected ? new Date(expected) : null;
    const actualDateObj = actual ? new Date(actual) : null;
    const createdDateObj = projectCreatedDate ? new Date(projectCreatedDate) : null;

    // Start date cannot be before project creation date
    if (startDateObj && createdDateObj && startDateObj < createdDateObj) {
      return "Start date cannot be before the project was created";
    }

    // Expected completion cannot be before start date
    if (startDateObj && expectedDateObj && expectedDateObj < startDateObj) {
      return "Expected completion date cannot be before start date";
    }

    // Actual completion cannot be before project creation date
    if (actualDateObj && createdDateObj && actualDateObj < createdDateObj) {
      return "Actual completion date cannot be before the project was created";
    }

    // Actual completion cannot be before start date (if both exist)
    if (startDateObj && actualDateObj && actualDateObj < startDateObj) {
      return "Actual completion date cannot be before start date";
    }

    return null;
  };

  // Handle date changes with validation
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    const error = validateDates(value, expectedDate, actualDate);
    setDateError(error || "");
  };

  const handleExpectedDateChange = (value: string) => {
    setExpectedDate(value);
    const error = validateDates(startDate, value, actualDate);
    setDateError(error || "");
  };

  const handleActualDateChange = (value: string) => {
    setActualDate(value);
    const error = validateDates(startDate, expectedDate, value);
    setDateError(error || "");
  };

  // Edge Function #1: Update Project Status
  const handleUpdateStatus = async () => {
    if (!canEdit) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-project-status", {
        body: {
          projectId: project.id,
          status: statusValue,
          progress_percent: progressValue,
        },
      });

      if (error) throw error;

      // Check if the response contains an error
      if (data && !data.success) {
        throw new Error(data.error || "Failed to update status");
      }

      alert("Project status updated successfully!");
      setIsEditingStatus(false);
      setIsEditingProgress(false);
      onProjectUpdate();
    } catch (error: any) {
      console.error("Error updating status:", error);
      alert(error.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  // Edge Function #2: Update Project Dates
  const handleUpdateDates = async () => {
    if (!canEdit) return;

    // Final validation before submission
    const validationError = validateDates(startDate, expectedDate, actualDate);
    if (validationError) {
      setDateError(validationError);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-project-dates", {
        body: {
          projectId: project.id,
          start_date: startDate || null,
          expected_completion_date: expectedDate || null,
          actual_completion_date: actualDate || null,
        },
      });

      if (error) throw error;

      // Check if the response contains an error
      if (data && !data.success) {
        throw new Error(data.error || "Failed to update dates");
      }

      alert("Project dates updated successfully!");
      setIsEditingDates(false);
      setDateError("");
      onProjectUpdate();
    } catch (error: any) {
      console.error("Error updating dates:", error);
      alert(error.message || "Failed to update dates");
    } finally {
      setLoading(false);
    }
  };

  const currentStatus = statusOptions.find((s) => s.value === project.status) || statusOptions[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
      {/* Left Column - Main Info */}
      <div className="lg:col-span-2 space-y-4 sm:space-y-8">
        {/* Project Status Card */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold">Project Status</h3>
            {canEdit && !isEditingStatus && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditingStatus(true)}
                className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
              >
                <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.button>
            )}
          </div>

          {isEditingStatus ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={statusValue}
                  onChange={(e) => setStatusValue(e.target.value)}
                  className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value} className="bg-background text-foreground">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUpdateStatus}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-xl transition-all"
                >
                  <Save className="w-4 h-4" />
                  {loading ? "Saving..." : "Save"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setStatusValue(project.status);
                    setIsEditingStatus(false);
                  }}
                  className="px-4 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-xl text-sm font-semibold backdrop-blur-xl border ${currentStatus.color}`}>
                {currentStatus.label}
              </span>
            </div>
          )}
        </GlassCard>

        {/* Progress Card */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold">Project Progress</h3>
            {canEdit && !isEditingProgress && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditingProgress(true)}
                className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
              >
                <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.button>
            )}
          </div>

          {isEditingProgress ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Progress Percentage</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={progressValue}
                  onChange={(e) => setProgressValue(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                />
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUpdateStatus}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-background font-semibold rounded-xl transition-all"
                >
                  <Save className="w-4 h-4" />
                  {loading ? "Saving..." : "Save"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setProgressValue(project.progress_percent);
                    setIsEditingProgress(false);
                  }}
                  className="px-4 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between text-sm sm:text-base mb-3">
                <span className="font-medium">Overall Progress</span>
                <span className="font-bold text-primary text-lg sm:text-xl">{project.progress_percent}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3 sm:h-4 overflow-hidden backdrop-blur-xl border border-white/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${project.progress_percent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="bg-gradient-to-r from-primary to-accent h-full rounded-full"
                />
              </div>
            </div>
          )}
        </GlassCard>

        {/* Key Dates Card */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold">Key Dates</h3>
            {canEdit && !isEditingDates && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setIsEditingDates(true);
                  setDateError("");
                }}
                className="p-2 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
              >
                <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </motion.button>
            )}
          </div>

          {isEditingDates ? (
            <div className="space-y-4">
              {dateError && (
                <div className="flex items-start gap-2 p-3 backdrop-blur-xl bg-red-500/20 border border-red-500/30 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{dateError}</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  min={projectCreatedDate || undefined}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground
                  [&::-webkit-calendar-picker-indicator]:cursor-pointer 
                  [&::-webkit-calendar-picker-indicator]:opacity-70
                  [&::-webkit-calendar-picker-indicator]:hover:opacity-100
                  [&::-webkit-calendar-picker-indicator]:transition-opacity
                  [&::-webkit-datetime-edit]:text-foreground
                  [&::-webkit-datetime-edit-fields-wrapper]:text-foreground
                  [&::-webkit-datetime-edit-text]:text-muted-foreground"
                />
                {projectCreatedDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Cannot be before {format(new Date(projectCreatedDate), "dd MMM yyyy")}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Expected Completion</label>
                <input
                  type="date"
                  value={expectedDate}
                  min={startDate || projectCreatedDate || undefined}
                  onChange={(e) => handleExpectedDateChange(e.target.value)}
                  className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground
                  [&::-webkit-calendar-picker-indicator]:cursor-pointer 
                  [&::-webkit-calendar-picker-indicator]:opacity-70
                  [&::-webkit-calendar-picker-indicator]:hover:opacity-100
                  [&::-webkit-calendar-picker-indicator]:transition-opacity
                  [&::-webkit-datetime-edit]:text-foreground
                  [&::-webkit-datetime-edit-fields-wrapper]:text-foreground
                  [&::-webkit-datetime-edit-text]:text-muted-foreground"
                />
                {startDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Cannot be before start date ({format(new Date(startDate), "dd MMM yyyy")})
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Actual Completion (if completed)</label>
                <input
                  type="date"
                  value={actualDate}
                  min={projectCreatedDate || undefined}
                  onChange={(e) => handleActualDateChange(e.target.value)}
                  className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground
                  [&::-webkit-calendar-picker-indicator]:cursor-pointer 
                  [&::-webkit-calendar-picker-indicator]:opacity-70
                  [&::-webkit-calendar-picker-indicator]:hover:opacity-100
                  [&::-webkit-calendar-picker-indicator]:transition-opacity
                  [&::-webkit-datetime-edit]:text-foreground
                  [&::-webkit-datetime-edit-fields-wrapper]:text-foreground
                  [&::-webkit-datetime-edit-text]:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Cannot be before project creation
                </p>
              </div>
              
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUpdateDates}
                  disabled={loading || !!dateError}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed text-background font-semibold rounded-xl transition-all"
                >
                  <Save className="w-4 h-4" />
                  {loading ? "Saving..." : "Save"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setStartDate(project.start_date || "");
                    setExpectedDate(project.expected_completion_date || "");
                    setActualDate(project.actual_completion_date || "");
                    setDateError("");
                    setIsEditingDates(false);
                  }}
                  className="px-4 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">Start Date</p>
                <p className="text-base sm:text-lg font-semibold">
                  {project.start_date ? format(new Date(project.start_date), "dd MMM yyyy") : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">Expected Completion</p>
                <p className="text-base sm:text-lg font-semibold">
                  {project.expected_completion_date
                    ? format(new Date(project.expected_completion_date), "dd MMM yyyy")
                    : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">Actual Completion</p>
                <p className="text-base sm:text-lg font-semibold">
                  {project.actual_completion_date
                    ? format(new Date(project.actual_completion_date), "dd MMM yyyy")
                    : "Ongoing"}
                </p>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Project Description */}
        <GlassCard>
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 sm:mb-6">Project Description</h3>
          <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
            {project.description || "No description provided"}
          </p>
        </GlassCard>
      </div>

      {/* Right Column - Stats & Summary */}
      <div className="space-y-4 sm:space-y-8">
        {!isClient && (
          <GlassCard>
            <h3 className="text-base sm:text-lg md:text-xl font-bold mb-2 sm:mb-4">Budget Summary</h3>
            <div className="text-xl sm:text-2xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-1 sm:mb-2 break-all">
              {(project.budget_numeric || 0).toLocaleString()} {project.currency || "KES"}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Project Budget</p>
          </GlassCard>
        )}

        <GlassCard>
          <h3 className="text-base sm:text-lg md:text-xl font-bold mb-4 sm:mb-6">Quick Stats</h3>
          <div className="space-y-4 sm:space-y-5">
            {[
              { label: "Milestones", value: milestones.length, icon: Calendar },
              ...(isClient ? [] : [{ label: "Tasks", value: tasks.length, icon: CheckCircle2 }]),
              { label: "Updates", value: updates.length, icon: MessageSquare },
              { label: "Documents", value: documents.length, icon: FileText },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    <span className="text-xs sm:text-sm md:text-base">{stat.label}</span>
                  </div>
                  <span className="text-base sm:text-lg md:text-xl font-bold text-primary">{stat.value}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Project Timeline Summary */}
        <GlassCard>
          <h3 className="text-base sm:text-lg md:text-xl font-bold mb-4 sm:mb-6">Timeline</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 backdrop-blur-xl bg-primary/20 border border-primary/30 rounded-lg">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-sm font-semibold">
                  {project.start_date && project.expected_completion_date
                    ? `${Math.ceil(
                        (new Date(project.expected_completion_date).getTime() -
                          new Date(project.start_date).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )} days`
                    : "Not calculated"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 backdrop-blur-xl bg-accent/20 border border-accent/30 rounded-lg">
                <TrendingUp className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm font-semibold">{currentStatus.label}</p>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}