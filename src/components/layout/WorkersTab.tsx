// src/components/projects/tabs/WorkersTab.tsx
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  Users,
  UserCheck,
  UserX,
  Plus,
  X,
  ArrowRight,
  Search,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  TrendingUp,
  Calendar,
  Check,
  XCircle,
  AlertTriangle,
  Eye,
  User,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Worker {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  id_number: string | null;
  address: string | null;
  status: string;
  created_at: string;
}

interface AttendanceRecord {
  id: string;
  worker_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: 'present' | 'absent' | 'late' | 'on_leave';
  notes: string | null;
  worker?: { full_name: string } | null;
}

interface Assignment {
  id: string;
  worker_id: string;
  project_id: string;
  milestone_id?: string | null;
  milestone?: { id: string; name: string } | null;
  task_description?: string;
  assigned_role?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status: 'assigned' | 'in_progress' | 'completed' | 'on_hold';
  tasks_assigned?: number;
  tasks_completed?: number;
  quality_score?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  worker?: { full_name: string; role: string } | null;
}

interface DashboardStats {
  total_workers: number;
  present_today: number;
  absent_today: number;
  avg_performance: number;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning';
}

interface WorkersTabProps {
  projectId: string;
  canEdit: boolean;
  onUpdate?: () => void;
}

type TabType = 'attendance' | 'workers' | 'assignments' | 'performance';

// Toast Notification Component
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

// GlassCard Component
const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

// StatCard Component
const StatCard = ({ icon: Icon, title, value, subtitle, color }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6 }}
    className="relative overflow-hidden rounded-2xl border-2 border-white/10 bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl p-6 hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 group"
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-xs font-semibold text-muted-foreground/80 mb-2 uppercase tracking-wider">{title}</p>
        <p className={`text-3xl sm:text-4xl font-bold mb-1 ${color} group-hover:scale-105 transition-transform duration-300`}>{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground/70 mt-2">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-2xl ${color.replace('text-', 'bg-').replace('600', '100')} group-hover:scale-110 transition-transform duration-300`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
    </div>
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
  </motion.div>
);

// EmptyState Component
const EmptyState = ({ icon: Icon, title, description, action, onAction }: any) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.6 }}
    className="flex flex-col items-center justify-center py-12 sm:py-16 px-4"
  >
    <div className="relative mb-6">
      <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
      <div className="relative p-6 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/10">
        <Icon className="w-12 h-12 sm:w-16 sm:h-16 text-primary" />
      </div>
    </div>
    <h3 className="text-xl sm:text-2xl font-bold mb-3 text-center">{title}</h3>
    <p className="text-muted-foreground text-center max-w-md mb-8 text-sm sm:text-base">{description}</p>
    {action && (
      <button
        onClick={onAction}
        className="flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 group"
      >
        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
        {action}
      </button>
    )}
  </motion.div>
);

const WorkersTab: React.FC<WorkersTabProps> = ({ projectId, canEdit, onUpdate }) => {
  console.log('[WorkersTab] Render start', { projectId, canEdit });

  const [activeTab, setActiveTab] = useState<TabType>('workers');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Workers state
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [workerForm, setWorkerForm] = useState({
    name: '',
    role: '',
    phone: '',
    id_number: '',
    address: ''
  });

  // Attendance state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [showMarkAttendance, setShowMarkAttendance] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<{[key: string]: any}>({});
  const [attendanceFilter, setAttendanceFilter] = useState({
    status: '',
    worker_id: '',
  });

  // Assignments state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showAssignTask, setShowAssignTask] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    worker_id: '',
    task: '',
    start_date: '',
    due_date: '',
    status: 'assigned' as 'assigned' | 'in_progress' | 'completed' | 'on_hold',
    notes: '',
    milestone_id: '',
  });

  // For editing assignments
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [assignmentFilter, setAssignmentFilter] = useState({
    worker_id: '',
    status: '',
    date: '',
    milestone_id: '',
  });

  // Stats state — computed locally from fetched data to ensure project-scoped accuracy
  const [stats, setStats] = useState<DashboardStats>({
    total_workers: 0,
    present_today: 0,
    absent_today: 0,
    avg_performance: 0
  });

  // Milestones state
  const [milestones, setMilestones] = useState<{ id: string; name: string }[]>([]);

  // Compute stats locally from workers + attendance + assignments.
  // workers list is already scoped to this project via fetchWorkers (project_id filter),
  // so total_workers is always the correct per-project count.
  const computeStats = (
    workerList: Worker[],
    attendanceList: AttendanceRecord[],
    assignmentList: Assignment[]
  ): DashboardStats => {
    const total_workers = workerList.length;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayAttendance = attendanceList.filter(a => a.date === todayStr);

    // Map attendance by worker_id for today
    const todayAttendanceMap: Record<string, AttendanceRecord> = {};
    todayAttendance.forEach(a => { todayAttendanceMap[a.worker_id] = a; });

    let present_today = 0;
    let absent_today = 0;
    workerList.forEach(w => {
      const rec = todayAttendanceMap[w.id];
      if (rec) {
        if (rec.status === 'present' || rec.status === 'late') present_today++;
        else if (rec.status === 'absent') absent_today++;
      }
      // Workers with no record today are not counted as absent unless explicitly marked
    });

    // Average quality score across assignments for this project
    const scoredAssignments = assignmentList.filter(a => a.quality_score != null);
    const avg_performance = scoredAssignments.length > 0
      ? Math.round(scoredAssignments.reduce((sum, a) => sum + (a.quality_score ?? 0), 0) / scoredAssignments.length)
      : 0;

    return { total_workers, present_today, absent_today, avg_performance };
  };

  // Fetch milestones for the project
  const fetchMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from('project_milestones')
        .select('id, title')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) {
        console.error('Milestones fetch error:', error);
        setMilestones([]);
        return;
      }
      setMilestones((data || []).map((m: any) => ({ id: m.id, name: m.title })));
    } catch (err) {
      console.error('[WorkersTab] Milestones fetch error:', err);
      setMilestones([]);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch workers — scoped DIRECTLY to this project via the workers.project_id column.
  // This is the correct approach given the schema: workers table has a project_id FK.
  // Previously the code went through worker_assignments which caused cross-project leakage.
  const fetchWorkers = async (): Promise<Worker[]> => {
    setError(null);
    try {
      const { data, error: workersError } = await supabase
        .from('workers')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (workersError) {
        console.error('[WorkersTab] Workers fetch error:', workersError);
        setError('Failed to fetch workers: ' + workersError.message);
        setWorkers([]);
        return [];
      }

      const workersData: Worker[] = data || [];
      setWorkers(workersData);
      return workersData;
    } catch (err: any) {
      console.error('[WorkersTab] Workers fetch error:', err);
      setWorkers([]);
      setError('Failed to fetch workers. Please check your connection.');
      return [];
    }
  };

  // Fetch attendance — scoped to this project's workers on the given date
  const fetchAttendance = async (date: string, workerIds?: string[]): Promise<AttendanceRecord[]> => {
    try {
      const ids = workerIds ?? workers.map(w => w.id);

      if (ids.length === 0) {
        setAttendance([]);
        return [];
      }

      // Try direct Supabase query first for accurate project-scoped data
      const { data, error: dbError } = await supabase
        .from('worker_attendance')
        .select('*')
        .eq('date', date)
        .in('worker_id', ids);

      if (!dbError && data) {
        setAttendance(data as AttendanceRecord[]);
        return data as AttendanceRecord[];
      }

      // Fallback to edge function
      const { data: fnData, error: invokeError } = await supabase.functions.invoke('get-daily-attendance', {
        method: 'POST',
        body: { date, worker_ids: ids },
      });

      if (invokeError) {
        console.error('Attendance function error:', invokeError);
        setAttendance([]);
        return [];
      }

      const records = (fnData?.attendance || []) as AttendanceRecord[];
      // Filter to only this project's workers
      const filtered = records.filter(r => ids.includes(r.worker_id));
      setAttendance(filtered);
      return filtered;
    } catch (err: any) {
      console.error('[WorkersTab] Attendance fetch error:', err);
      setAttendance([]);
      return [];
    }
  };

  // Fetch assignments — scoped to this project
  const fetchAssignments = async (): Promise<Assignment[]> => {
    try {
      // Direct Supabase query scoped to this project
      const { data, error: dbError } = await supabase
        .from('worker_assignments')
        .select(`
          *,
          worker:workers(full_name, role),
          milestone:project_milestones(id, title)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (!dbError && data) {
        // Normalize milestone shape: API returns { id, title } but our interface expects { id, name }
        const normalized = data.map((a: any) => ({
          ...a,
          milestone: a.milestone ? { id: a.milestone.id, name: a.milestone.title } : null,
        })) as Assignment[];
        setAssignments(normalized);
        return normalized;
      }

      // Fallback to edge function
      const { data: fnData, error: invokeError } = await supabase.functions.invoke('quick-task', {
        method: 'GET',
        body: { project_id: projectId },
      });

      if (invokeError) {
        console.error('Assignments function error:', invokeError);
        setAssignments([]);
        return [];
      }

      // Filter to this project only (edge function may return all)
      const all = (fnData?.assignments || []) as Assignment[];
      const projectAssignments = all.filter(a => a.project_id === projectId);
      setAssignments(projectAssignments);
      return projectAssignments;
    } catch (err: any) {
      console.error('[WorkersTab] Assignments fetch error:', err);
      setAssignments([]);
      return [];
    }
  };

  // Initial load — fetch everything and compute stats locally
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [fetchedWorkers, fetchedAssignments] = await Promise.all([
          fetchWorkers(),
          fetchAssignments(),
          fetchMilestones(),
        ]);

        const fetchedAttendance = await fetchAttendance(
          selectedDate,
          fetchedWorkers.map(w => w.id)
        );

        // Compute stats from project-scoped data
        setStats(computeStats(fetchedWorkers, fetchedAttendance, fetchedAssignments));
      } catch (err) {
        console.error('[WorkersTab] Initial load error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Reload attendance when date or tab changes, then recompute stats
  useEffect(() => {
    if (activeTab === 'attendance' && workers.length > 0) {
      fetchAttendance(selectedDate, workers.map(w => w.id)).then(fetchedAttendance => {
        setStats(prev => computeStats(workers, fetchedAttendance, assignments));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, activeTab]);

  // Recompute stats whenever workers, attendance, or assignments change
  useEffect(() => {
    setStats(computeStats(workers, attendance, assignments));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workers, attendance, assignments]);

  // Add Worker
  const handleAddWorker = async () => {
    if (!workerForm.name.trim() || !workerForm.role) {
      showToast('Full name and role are required', 'warning');
      return;
    }
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('add-worker', {
        method: 'POST',
        body: {
          name: workerForm.name.trim(),
          role: workerForm.role,
          phone: workerForm.phone || null,
          id_number: workerForm.id_number || null,
          address: workerForm.address || null,
          project_id: projectId,
        }
      });
      
      if (invokeError) {
        showToast(invokeError.message || 'Failed to add worker', 'error');
        return;
      }
      
      showToast('Worker added successfully!', 'success');
      setShowAddWorker(false);
      setWorkerForm({ name: '', role: '', phone: '', id_number: '', address: '' });
      const freshWorkers = await fetchWorkers();
      setStats(computeStats(freshWorkers, attendance, assignments));
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showToast('Failed to add worker: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  // Handle attendance change
  const handleAttendanceChange = (workerId: string, field: string, value: string) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [workerId]: { ...prev[workerId], [field]: value || null }
    }));
  };

  // Save attendance
  const handleSaveAttendance = async () => {
    const records = Object.entries(attendanceRecords)
      .filter(([_, values]) => values && (values.check_in || values.check_out || values.status))
      .map(([worker_id, values]) => ({
        worker_id,
        check_in: values.check_in || null,
        check_out: values.check_out || null,
        status: values.status || 'present',
        notes: values.notes || null,
      }));
    
    if (records.length === 0) {
      showToast('No changes to save', 'warning');
      return;
    }
    
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('worker-attendance', {
        method: 'POST',
        body: { date: selectedDate, records }
      });
      
      if (invokeError) {
        showToast(invokeError.message || 'Failed to save attendance', 'error');
        return;
      }
      
      showToast('Attendance saved successfully!', 'success');
      setShowMarkAttendance(false);
      setAttendanceRecords({});
      const freshAttendance = await fetchAttendance(selectedDate, workers.map(w => w.id));
      setStats(computeStats(workers, freshAttendance, assignments));
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showToast('Failed to save attendance: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  // Save (create or update) assignment
  const handleSaveAssignment = async () => {
    if (!assignmentForm.worker_id || !assignmentForm.task.trim()) {
      showToast('Worker and task are required', 'warning');
      return;
    }
    try {
      const payload: any = {
        worker_id: assignmentForm.worker_id,
        project_id: projectId,
        milestone_id: assignmentForm.milestone_id || null,
        task_description: assignmentForm.task,
        start_date: assignmentForm.start_date ? assignmentForm.start_date : null,
        end_date: assignmentForm.due_date ? assignmentForm.due_date : null,
        status: assignmentForm.status,
        notes: assignmentForm.notes || null,
        updated_at: new Date().toISOString(),
      };
      if (editingAssignment) {
        const { error } = await supabase
          .from('worker_assignments')
          .update(payload)
          .eq('id', editingAssignment.id);
        if (error) {
          showToast(error.message || 'Failed to update task', 'error');
          return;
        }
        showToast('Task updated successfully!', 'success');
      } else {
        payload.created_at = new Date().toISOString();
        const { error } = await supabase
          .from('worker_assignments')
          .insert([payload]);
        if (error) {
          showToast(error.message || 'Failed to assign task', 'error');
          return;
        }
        showToast('Task assigned successfully!', 'success');
      }
      setShowAssignTask(false);
      setEditingAssignment(null);
      setAssignmentForm({ worker_id: '', task: '', start_date: '', due_date: '', status: 'assigned', notes: '', milestone_id: '' });
      const freshAssignments = await fetchAssignments();
      setStats(computeStats(workers, attendance, freshAssignments));
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showToast('Failed to save task: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  // Delete assignment
  const handleDeleteAssignment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('worker_assignments')
        .delete()
        .eq('id', id);
      if (error) {
        showToast(error.message || 'Failed to delete task', 'error');
        return;
      }
      showToast('Task deleted!', 'success');
      const freshAssignments = await fetchAssignments();
      setStats(computeStats(workers, attendance, freshAssignments));
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showToast('Failed to delete task: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  // Filtered data
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => 
      w.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [workers, searchQuery]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((rec) => {
      let match = true;
      if (attendanceFilter.status) match = match && rec.status === attendanceFilter.status;
      if (attendanceFilter.worker_id) match = match && rec.worker_id === attendanceFilter.worker_id;
      return match;
    });
  }, [attendance, attendanceFilter]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      let match = true;
      if (assignmentFilter.worker_id) match = match && a.worker_id === assignmentFilter.worker_id;
      if (assignmentFilter.status) match = match && a.status === assignmentFilter.status;
      if (assignmentFilter.date) {
        const aDate = a.end_date;
        match = match && aDate === assignmentFilter.date;
      }
      if (assignmentFilter.milestone_id) match = match && a.milestone_id === assignmentFilter.milestone_id;
      return match;
    });
  }, [assignments, assignmentFilter]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800 border-green-300',
      inactive: 'bg-gray-100 text-gray-800 border-gray-300',
      present: 'bg-green-100 text-green-800 border-green-300',
      absent: 'bg-red-100 text-red-800 border-red-300',
      late: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      on_leave: 'bg-blue-100 text-blue-800 border-blue-300',
      assigned: 'bg-blue-100 text-blue-800 border-blue-300',
      in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      on_hold: 'bg-gray-100 text-gray-800 border-gray-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const units = ['mason', 'carpenter', 'electrician', 'plumber', 'painter', 'welder', 'laborer'];

  if (loading) {
    return (
      <GlassCard className="text-center py-16">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-6"></div>
          <div className="text-xl font-semibold">Loading workers data...</div>
        </motion.div>
      </GlassCard>
    );
  }

  if (error) {
    return (
      <GlassCard className="text-center py-16">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        <h3 className="text-2xl font-bold mb-4 text-red-500">Error Loading Data</h3>
        <p className="text-muted-foreground mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-3 bg-primary hover:bg-primary/90 text-background rounded-xl font-semibold"
        >
          Retry
        </button>
      </GlassCard>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stats Cards */}
        {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} title="Total Workers" value={stats.total_workers} color="text-primary" />
          <StatCard icon={UserCheck} title="Present Today" value={stats.present_today} color="text-green-600" />
          <StatCard icon={UserX} title="Absent Today" value={stats.absent_today} color="text-red-600" />
          <StatCard icon={TrendingUp} title="Avg Performance" value={stats.avg_performance > 0 ? `${stats.avg_performance}%` : '—'} color="text-blue-600" />
        </div> */}

        {/* Tab Navigation */}
        <GlassCard className="p-2">
          <div className="flex overflow-x-auto gap-2 scrollbar-hide">
            {[
              { id: 'workers' as TabType, label: 'Workers List', icon: Users },
              { id: 'attendance' as TabType, label: 'Daily Attendance', icon: Clock },
              { id: 'assignments' as TabType, label: 'Task Assignments', icon: CheckCircle },
              { id: 'performance' as TabType, label: 'Performance', icon: TrendingUp },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-3 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-primary text-background shadow-lg'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </motion.button>
              );
            })}
          </div>
        </GlassCard>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* WORKERS LIST TAB */}
          {activeTab === 'workers' && (
            <motion.div key="workers" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              {workers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No Workers Registered"
                  description="Add your first worker to start managing your team."
                  action={canEdit ? "Add Worker" : null}
                  onAction={() => setShowAddWorker(true)}
                />
              ) : (
                <GlassCard>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4 flex-1 max-w-2xl w-full">
                      <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <input
                          type="text"
                          placeholder="Search workers..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                        />
                      </div>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => setShowAddWorker(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 group"
                      >
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                        Add Worker
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-2xl border-2 border-white/10 bg-white/5 shadow-2xl">
                    <table className="min-w-full bg-transparent border-none rounded-2xl overflow-hidden">
                      <thead>
                        <tr className="bg-background/60">
                          <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Name</th>
                          <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Role</th>
                          <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Phone</th>
                          <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWorkers.map((worker) => (
                          <tr key={worker.id} className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors">
                            <td className="py-4 px-6 text-foreground font-medium">{worker.full_name}</td>
                            <td className="py-4 px-6 text-foreground capitalize">{worker.role}</td>
                            <td className="py-4 px-6 text-foreground">{worker.phone || '-'}</td>
                            <td className="py-4 px-6">
                              <span className={`px-3 py-1 rounded-xl text-xs font-semibold border ${getStatusColor(worker.status || 'active')}`}>
                                {worker.status || 'active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              )}
            </motion.div>
          )}

          {/* ATTENDANCE TAB */}
          {activeTab === 'attendance' && (
            <motion.div key="attendance" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <GlassCard>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div className="flex gap-2 items-center">
                    <label className="font-semibold text-sm">Date:</label>
                    <input 
                      type="date" 
                      value={selectedDate} 
                      onChange={e => setSelectedDate(e.target.value)} 
                      className="px-3 py-2 rounded-xl border border-white/20 bg-white/5 focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="text-sm">Status:</label>
                    <select 
                      value={attendanceFilter.status} 
                      onChange={e => setAttendanceFilter(f => ({ ...f, status: e.target.value }))} 
                      className="px-3 py-2 rounded-xl border border-white/20 bg-white/5 text-sm"
                    >
                      <option value="">All</option>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="on_leave">On Leave</option>
                    </select>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setShowMarkAttendance(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300"
                    >
                      <Plus className="w-5 h-5" />
                      Mark Attendance
                    </button>
                  )}
                </div>

                {filteredAttendance.length === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title="No Attendance Records"
                    description="No records found for selected filters."
                    action={canEdit ? "Mark Attendance" : null}
                    onAction={() => setShowMarkAttendance(true)}
                  />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border-2 border-white/10 bg-white/5 shadow-2xl">
                    <table className="min-w-full bg-transparent">
                      <thead>
                        <tr className="bg-background/60">
                          <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Worker</th>
                          <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Status</th>
                          <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Check In</th>
                          <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Check Out</th>
                          <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAttendance.map((rec, idx) => {
                          const worker = workers.find(w => w.id === rec.worker_id);
                          return (
                            <tr key={idx} className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors">
                              <td className="py-4 px-6 text-foreground font-medium">{worker ? worker.full_name : rec.worker_id}</td>
                              <td className="py-4 px-6">
                                <span className={`px-3 py-1 rounded-xl text-xs font-semibold border ${getStatusColor(rec.status)}`}>
                                  {rec.status}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-foreground">{rec.check_in || '-'}</td>
                              <td className="py-4 px-6 text-foreground">{rec.check_out || '-'}</td>
                              <td className="py-4 px-6 text-sm text-muted-foreground">{rec.notes || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}

          {/* ASSIGNMENTS TAB */}
          {activeTab === 'assignments' && (
            <motion.div key="assignments" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <GlassCard className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">Task Assignments</h2>
                    <p className="text-muted-foreground text-sm">Manage and review worker task assignments for this project.</p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setShowAssignTask(true)}
                      className="px-6 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 group"
                    >
                      <span className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                        Assign Task
                      </span>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 mb-4">
                  <select
                    value={assignmentFilter.worker_id}
                    onChange={e => setAssignmentFilter(f => ({ ...f, worker_id: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl"
                  >
                    <option value="" className="bg-background text-muted-foreground">All Workers</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id} className="bg-background text-foreground">{w.full_name}</option>
                    ))}
                  </select>
                  <select
                    value={assignmentFilter.status}
                    onChange={e => setAssignmentFilter(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl"
                  >
                    <option value="" className="bg-background text-muted-foreground">All Statuses</option>
                    <option value="assigned" className="bg-background text-foreground">Assigned</option>
                    <option value="in_progress" className="bg-background text-foreground">In Progress</option>
                    <option value="completed" className="bg-background text-foreground">Completed</option>
                    <option value="on_hold" className="bg-background text-foreground">On Hold</option>
                  </select>
                  <select
                    value={assignmentFilter.milestone_id}
                    onChange={e => setAssignmentFilter(f => ({ ...f, milestone_id: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl"
                  >
                    <option value="" className="bg-background text-muted-foreground">All Milestones</option>
                    {milestones && milestones.map(m => (
                      <option key={m.id} value={m.id} className="bg-background text-foreground">{m.name}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl"
                    value={assignmentFilter.date}
                    onChange={e => setAssignmentFilter(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
                {filteredAssignments.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle}
                    title="No Task Assignments"
                    description="Assign tasks to workers to start tracking project progress."
                    action={canEdit ? "Assign Task" : null}
                    onAction={() => setShowAssignTask(true)}
                  />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border-2 border-white/10 bg-white/5 shadow-2xl">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-primary/10 to-accent/10">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Worker</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Task</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Milestone</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Start Date</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Due Date</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Status</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Quality</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Notes</th>
                          {canEdit && <th className="px-4 py-3 text-left font-semibold text-primary">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAssignments.map(a => (
                          <tr key={a.id} className="border-b border-white/10 hover:bg-primary/5 transition-all">
                            <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                              {a.worker?.full_name || workers.find(w => w.id === a.worker_id)?.full_name || '—'}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {a.task_description}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {a.milestone?.name || milestones.find(m => m.id === a.milestone_id)?.name || '—'}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {a.start_date ? new Date(a.start_date).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {a.end_date ? new Date(a.end_date).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-3 py-1 rounded-xl font-semibold text-xs border ${getStatusColor(a.status)}`}>{a.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                            </td>
                            <td className="px-4 py-3 text-blue-600 font-bold whitespace-nowrap">
                              {a.quality_score != null ? `${a.quality_score}/100` : '—'}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {a.notes || '—'}
                            </td>
                            {canEdit && (
                              <td className="px-4 py-3 whitespace-nowrap flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingAssignment(a);
                                    setAssignmentForm({
                                      worker_id: a.worker_id,
                                      task: a.task_description || '',
                                      start_date: a.start_date || '',
                                      due_date: a.end_date || '',
                                      status: a.status,
                                      notes: a.notes || '',
                                      milestone_id: a.milestone_id || '',
                                    });
                                    setShowAssignTask(true);
                                  }}
                                  className="px-3 py-1 bg-primary text-background rounded-lg font-semibold hover:bg-primary/90 transition-all"
                                >Edit</button>
                                <button
                                  onClick={() => handleDeleteAssignment(a.id)}
                                  className="px-3 py-1 bg-red-600 text-background rounded-lg font-semibold hover:bg-red-700 transition-all"
                                >Delete</button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}

          {/* PERFORMANCE TAB */}
          {activeTab === 'performance' && (
            <motion.div key="performance" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <GlassCard className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">Performance Analytics</h2>
                    <p className="text-muted-foreground text-sm">Assess and manage worker performance based on tasks assigned and completed.</p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setShowAssignTask(true)}
                      className="px-6 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 group"
                    >
                      <span className="flex items-center gap-2">
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                        Add Performance
                      </span>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 mb-4">
                  <select
                    value={assignmentFilter.worker_id}
                    onChange={e => setAssignmentFilter(f => ({ ...f, worker_id: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl"
                  >
                    <option value="" className="bg-background text-muted-foreground">Select Worker</option>
                    {workers.map(w => (
                      <option key={w.id} value={w.id} className="bg-background text-foreground">{w.full_name}</option>
                    ))}
                  </select>
                </div>
                {filteredAssignments.filter(a => assignmentFilter.worker_id ? a.worker_id === assignmentFilter.worker_id : true).length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No Performance Data"
                    description="Select a worker to view and manage performance analytics based on assigned tasks."
                    action={canEdit ? "Add Performance" : null}
                    onAction={() => setShowAssignTask(true)}
                  />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border-2 border-white/10 bg-white/5 shadow-2xl">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-primary/10 to-accent/10">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Task</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Status</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Quality Score</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Completed</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Notes</th>
                          {canEdit && <th className="px-4 py-3 text-left font-semibold text-primary">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAssignments
                          .filter(a => assignmentFilter.worker_id ? a.worker_id === assignmentFilter.worker_id : true)
                          .map(a => (
                            <tr key={a.id} className="border-b border-white/10 hover:bg-primary/5 transition-all">
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{a.task_description}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-3 py-1 rounded-xl font-semibold text-xs border ${getStatusColor(a.status)}`}>{a.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                              </td>
                              <td className="px-4 py-3 text-blue-600 font-bold whitespace-nowrap">
                                {canEdit ? (
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={a.quality_score ?? ''}
                                    onChange={async e => {
                                      const val = e.target.value === '' ? null : Number(e.target.value);
                                      setAssignments(prev => prev.map(ass => ass.id === a.id ? { ...ass, quality_score: val } : ass));
                                      try {
                                        const { error } = await supabase
                                          .from('worker_assignments')
                                          .update({ quality_score: val, updated_at: new Date().toISOString() })
                                          .eq('id', a.id);
                                        if (error) showToast('Failed to update quality score', 'error');
                                        else showToast('Quality score updated!', 'success');
                                      } catch (err) {
                                        showToast('Failed to update quality score', 'error');
                                      }
                                    }}
                                    className="w-20 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-blue-600 font-bold focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl"
                                  />
                                ) : (
                                  a.quality_score != null ? `${a.quality_score}/100` : '—'
                                )}
                              </td>
                              <td className="px-4 py-3 text-green-600 font-bold whitespace-nowrap">{a.status === 'completed' ? 'Yes' : 'No'}</td>
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                {canEdit ? (
                                  <input
                                    type="text"
                                    value={a.notes ?? ''}
                                    onChange={e => {
                                      setAssignments(prev => prev.map(ass => ass.id === a.id ? { ...ass, notes: e.target.value } : ass));
                                    }}
                                    className="w-full px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl"
                                  />
                                ) : (
                                  a.notes || '—'
                                )}
                              </td>
                              {canEdit && (
                                <td className="px-4 py-3 whitespace-nowrap flex gap-2">
                                  <button
                                    onClick={async () => {
                                      try {
                                        const { error } = await supabase
                                          .from('worker_assignments')
                                          .update({ notes: a.notes, updated_at: new Date().toISOString() })
                                          .eq('id', a.id);
                                        if (error) showToast('Failed to save performance', 'error');
                                        else showToast('Performance updated!', 'success');
                                      } catch (err) {
                                        showToast('Failed to save performance', 'error');
                                      }
                                    }}
                                    className="px-3 py-1 bg-primary text-background rounded-lg font-semibold hover:bg-primary/90 transition-all"
                                  >Save</button>
                                  <button
                                    onClick={() => handleDeleteAssignment(a.id)}
                                    className="px-3 py-1 bg-red-600 text-background rounded-lg font-semibold hover:bg-red-700 transition-all"
                                  >Delete</button>
                                </td>
                              )}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Worker Modal */}
        <AnimatePresence>
          {showAddWorker && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-2xl backdrop-blur-xl bg-background/95 border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold">Add New Worker</h3>
                  <button onClick={() => setShowAddWorker(false)} className="p-2 hover:bg-white/10 rounded-lg transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="mb-2">Full Name *</Label>
                    <input
                      type="text"
                      value={workerForm.name}
                      onChange={(e) => setWorkerForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter full name"
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                    />
                  </div>
                  <div>
                    <Label className="mb-2">Role/Trade *</Label>
                    <Select
                      value={workerForm.role}
                      onValueChange={(value) => setWorkerForm(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5">
                        <SelectValue placeholder="Select role..." />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map(unit => (
                          <SelectItem key={unit} value={unit}>{unit.charAt(0).toUpperCase() + unit.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-2">Phone Number</Label>
                    <input
                      type="tel"
                      value={workerForm.phone}
                      onChange={(e) => setWorkerForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+254 XXX XXX XXX"
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5"
                    />
                  </div>
                  <div>
                    <Label className="mb-2">ID Number</Label>
                    <input
                      type="text"
                      value={workerForm.id_number}
                      onChange={(e) => setWorkerForm(prev => ({ ...prev, id_number: e.target.value }))}
                      placeholder="National ID"
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="mb-2">Address</Label>
                    <textarea
                      rows={3}
                      value={workerForm.address}
                      onChange={(e) => setWorkerForm(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Residential address"
                      className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddWorker}
                    className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all"
                  >
                    Add Worker
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAddWorker(false)}
                    className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Mark Attendance Modal */}
        <AnimatePresence>
          {showMarkAttendance && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-4xl backdrop-blur-xl bg-background/95 border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold">Mark Attendance</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Date: {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <button onClick={() => setShowMarkAttendance(false)} className="p-2 hover:bg-white/10 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {workers.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No workers available"
                    description="Add workers first before marking attendance."
                    action="Add Worker"
                    onAction={() => {
                      setShowMarkAttendance(false);
                      setShowAddWorker(true);
                    }}
                  />
                ) : (
                  <div className="space-y-4">
                    {workers.map((worker) => (
                      <div key={worker.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border-2 border-white/10 rounded-2xl hover:bg-white/5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center font-bold text-lg">
                            {worker.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-lg">{worker.full_name}</p>
                            <p className="text-sm text-muted-foreground capitalize">{worker.role}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold">Check In:</label>
                            <input
                              type="time"
                              value={attendanceRecords[worker.id]?.check_in || ''}
                              onChange={(e) => handleAttendanceChange(worker.id, 'check_in', e.target.value)}
                              className="w-32 px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold">Check Out:</label>
                            <input
                              type="time"
                              value={attendanceRecords[worker.id]?.check_out || ''}
                              onChange={(e) => handleAttendanceChange(worker.id, 'check_out', e.target.value)}
                              className="w-32 px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5"
                            />
                          </div>
                          <Select
                            value={attendanceRecords[worker.id]?.status || 'present'}
                            onValueChange={(value) => handleAttendanceChange(worker.id, 'status', value)}
                          >
                            <SelectTrigger className="w-40 px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">Present</SelectItem>
                              <SelectItem value="absent">Absent</SelectItem>
                              <SelectItem value="late">Late</SelectItem>
                              <SelectItem value="on_leave">On Leave</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {workers.length > 0 && (
                  <div className="flex gap-3 mt-6">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSaveAttendance}
                      className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl"
                    >
                      Save Attendance
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowMarkAttendance(false)}
                      className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl"
                    >
                      Cancel
                    </motion.button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Assign Task Modal */}
        <AnimatePresence>
          {showAssignTask && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-2xl backdrop-blur-xl bg-background/95 border border-white/20 rounded-2xl p-6"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold">{editingAssignment ? 'Edit Task' : 'Assign Task'}</h3>
                  <button onClick={() => { setShowAssignTask(false); setEditingAssignment(null); }} className="p-2 hover:bg-white/10 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 text-primary font-semibold">Worker</Label>
                    <select
                      value={assignmentForm.worker_id}
                      onChange={e => setAssignmentForm(f => ({ ...f, worker_id: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl"
                    >
                      <option value="" className="bg-background text-muted-foreground">Select worker</option>
                      {workers.map(w => <option key={w.id} value={w.id} className="bg-background text-foreground">{w.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="mb-2 text-primary font-semibold">Task Description</Label>
                    <input
                      type="text"
                      value={assignmentForm.task}
                      onChange={e => setAssignmentForm(f => ({ ...f, task: e.target.value }))}
                      placeholder="Task description"
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl"
                    />
                  </div>
                  <div>
                    <Label className="mb-2 text-primary font-semibold">Milestone</Label>
                    <select
                      value={assignmentForm.milestone_id || ''}
                      onChange={e => setAssignmentForm(f => ({ ...f, milestone_id: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl"
                    >
                      <option value="" className="bg-background text-muted-foreground">No milestone</option>
                      {milestones.map(m => <option key={m.id} value={m.id} className="bg-background text-foreground">{m.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 text-primary font-semibold">Start Date</Label>
                      <input
                        type="date"
                        value={assignmentForm.start_date}
                        onChange={e => setAssignmentForm(f => ({ ...f, start_date: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl"
                      />
                    </div>
                    <div>
                      <Label className="mb-2 text-primary font-semibold">Due Date</Label>
                      <input
                        type="date"
                        value={assignmentForm.due_date}
                        onChange={e => setAssignmentForm(f => ({ ...f, due_date: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 text-primary font-semibold">Status</Label>
                    <select
                      value={assignmentForm.status}
                      onChange={e => setAssignmentForm(f => ({ ...f, status: e.target.value as any }))}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl"
                    >
                      <option value="assigned" className="bg-background text-foreground">Assigned</option>
                      <option value="in_progress" className="bg-background text-foreground">In Progress</option>
                      <option value="completed" className="bg-background text-foreground">Completed</option>
                      <option value="on_hold" className="bg-background text-foreground">On Hold</option>
                    </select>
                  </div>
                  <div>
                    <Label className="mb-2 text-primary font-semibold">Notes</Label>
                    <textarea
                      rows={2}
                      value={assignmentForm.notes}
                      onChange={e => setAssignmentForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Additional notes"
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSaveAssignment}
                    className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl"
                  >
                    {editingAssignment ? 'Update Task' : 'Assign Task'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setShowAssignTask(false); setEditingAssignment(null); }}
                    className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl"
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </div>
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

export default WorkersTab;