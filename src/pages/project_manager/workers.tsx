import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserCheck, UserX, TrendingUp, Clock, CheckCircle,
  Plus, X, ArrowRight, Download, Search,
  Edit, Eye, Trash2
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

function PMWorkers() {
  console.log('[PMWorkers] Render start');
  // Error boundary state
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('attendance');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showMarkAttendance, setShowMarkAttendance] = useState(false);
  const [showAssignTask, setShowAssignTask] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [workers, setWorkers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total_workers: 0,
    present_today: 0,
    absent_today: 0,
    avg_performance: 0
  });
  // Assignment states
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentForm, setAssignmentForm] = useState({
    worker_id: '',
    task: '',
    due_date: '',
    status: 'pending',
    notes: ''
  });
  const [assignmentFilter, setAssignmentFilter] = useState({
    worker_id: '',
    status: '',
    date: ''
  });
  // Attendance filter
  const [attendanceFilter, setAttendanceFilter] = useState({
    status: '',
    worker_id: '',
  });

  // Form & modal states
  const [workerForm, setWorkerForm] = useState({
    name: '',
    role: '',
    phone: '',
    id_number: '',
    address: ''
  });
  const [attendanceRecords, setAttendanceRecords] = useState<{[key: string]: any}>({});

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard stats
  const fetchStats = async () => {
    console.log('[PMWorkers] fetchStats called');
    try {
      const { data, error: funcError } = await supabase.functions.invoke('get-dashboard-stats');
      console.log('[PMWorkers] fetchStats result', { data, funcError });
      if (funcError) {
        console.error('Stats function error:', funcError);
        return;
      }
      if (data) setStats(data);
    } catch (err: any) {
      console.error('[PMWorkers] Stats error:', err);
    }
  };

  // Fetch all workers
  const fetchWorkers = async () => {
    console.log('[PMWorkers] fetchWorkers called');
    setError(null);
    try {
      const { data, error: funcError } = await supabase.functions.invoke('get-workers', { method: 'GET' });
      if (funcError) {
        console.error('Workers function error:', funcError);
        setWorkers([]);
        setError('Failed to fetch workers: ' + funcError.message);
        return;
      }
      setWorkers(data?.workers || []);
    } catch (err: any) {
      console.error('[PMWorkers] Workers fetch error:', err);
      setWorkers([]);
      setError('Failed to fetch workers. Please check your connection.');
    }
  };

  // Fetch attendance for selected date
  const fetchAttendance = async (date: string) => {
    console.log('[PMWorkers] fetchAttendance called', { date });
    try {
      const { data, error: funcError } = await supabase.functions.invoke('get-daily-attendance', {
        body: { date }
      });
      console.log('[PMWorkers] fetchAttendance result', { data, funcError });
      if (funcError) {
        console.error('Attendance function error:', funcError);
        setAttendance([]);
        return;
      }
      if (data?.attendance) setAttendance(data.attendance);
      else setAttendance([]);
    } catch (err: any) {
      console.error('[PMWorkers] Attendance fetch error:', err);
      setAttendance([]);
    }
  };

  // Fetch assignments
  const fetchAssignments = async () => {
    try {
      const { data, error: funcError } = await supabase.functions.invoke('get-worker-assignments', { method: 'GET' });
      if (funcError) {
        setAssignments([]);
        return;
      }
      setAssignments(data?.assignments || []);
    } catch (err) {
      setAssignments([]);
    }
  };

  // Initial load
  useEffect(() => {
    console.log('[PMWorkers] useEffect initial load');
    const loadInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchStats(), fetchWorkers(), fetchAssignments()]);
        await fetchAttendance(selectedDate);
      } catch (err) {
        console.error('[PMWorkers] Initial load error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Reload attendance when date or tab changes
  useEffect(() => {
    console.log('[PMWorkers] useEffect selectedDate/activeTab', { selectedDate, activeTab });
    if (activeTab === 'attendance') {
      fetchAttendance(selectedDate);
    }
  }, [selectedDate, activeTab]);

  // Add Worker
  const handleAddWorker = async () => {
    if (!workerForm.name.trim() || !workerForm.role) {
      alert('Full name and role are required');
      return;
    }
    try {
      const { data, error: funcError } = await supabase.functions.invoke('add-worker', {
        body: {
          name: workerForm.name.trim(),
          role: workerForm.role,
          phone: workerForm.phone || null,
          id_number: workerForm.id_number || null,
          address: workerForm.address || null
        }
      });
      
      if (funcError) {
        alert(funcError.message || 'Failed to add worker');
        return;
      }
      
      setShowAddWorker(false);
      setWorkerForm({ name: '', role: '', phone: '', id_number: '', address: '' });
      await Promise.all([fetchWorkers(), fetchStats()]);
    } catch (err: any) {
      alert('Failed to add worker: ' + (err.message || 'Unknown error'));
    }
  };

  // Local attendance change tracking
  const handleAttendanceChange = (workerId: string, field: string, value: string) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [workerId]: { ...prev[workerId], [field]: value || null }
    }));
  };

  // Save batch attendance
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
      alert('No changes to save');
      return;
    }
    
    try {
      console.log('[Attendance] Saving records:', { date: selectedDate, records });
      
      const { data, error: funcError } = await supabase.functions.invoke('worker_attendance', {
        body: { date: selectedDate, records }
      });
      
      console.log('[Attendance] Save result', { data, funcError });
      
      if (funcError) {
        console.error('[Attendance] Save failed:', funcError);
        alert(funcError.message || 'Failed to save attendance');
        return;
      }
      
      alert('Attendance saved successfully!');
      setShowMarkAttendance(false);
      setAttendanceRecords({});
      await Promise.all([fetchAttendance(selectedDate), fetchStats()]);
    } catch (err: any) {
      console.error('[Attendance] Save error:', err);
      alert('Failed to save attendance: ' + (err.message || 'Unknown error'));
    }
  };

  // Assignment creation
  const handleAssignTask = async () => {
    if (!assignmentForm.worker_id || !assignmentForm.task.trim()) {
      alert('Worker and task are required');
      return;
    }
    try {
      const { data, error: funcError } = await supabase.functions.invoke('assign-task', {
        body: assignmentForm
      });
      
      if (funcError) {
        alert(funcError.message || 'Failed to assign task');
        return;
      }
      
      setShowAssignTask(false);
      setAssignmentForm({ worker_id: '', task: '', due_date: '', status: 'pending', notes: '' });
      await fetchAssignments();
    } catch (err: any) {
      alert('Failed to assign task: ' + (err.message || 'Unknown error'));
    }
  };

  // Filtered attendance
  const filteredAttendance = attendance.filter((rec) => {
    let match = true;
    if (attendanceFilter.status) match = match && rec.status === attendanceFilter.status;
    if (attendanceFilter.worker_id) match = match && rec.worker_id === attendanceFilter.worker_id;
    return match;
  });

  // Filtered assignments
  const filteredAssignments = assignments.filter((a) => {
    let match = true;
    if (assignmentFilter.worker_id) match = match && a.worker_id === assignmentFilter.worker_id;
    if (assignmentFilter.status) match = match && a.status === assignmentFilter.status;
    if (assignmentFilter.date) match = match && a.due_date === assignmentFilter.date;
    return match;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800 border-green-300',
      inactive: 'bg-gray-100 text-gray-800 border-gray-300',
      present: 'bg-green-100 text-green-800 border-green-300',
      absent: 'bg-red-100 text-red-800 border-red-300',
      late: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      on_leave: 'bg-blue-100 text-blue-800 border-blue-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative overflow-hidden rounded-2xl border-2 border-white/10 bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl p-8 hover:shadow-2xl hover:shadow-primary/20 transition-all duration-300 group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-muted-foreground/80 mb-2 uppercase tracking-wider">{title}</p>
          <p className={`text-5xl font-bold mb-1 ${color} group-hover:scale-105 transition-transform duration-300`}>{value}</p>
          {subtitle && <p className="text-sm text-muted-foreground/70 mt-2">{subtitle}</p>}
        </div>
        <div className={`p-4 rounded-2xl ${color.replace('text-', 'bg-').replace('600', '100')} group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-8 h-8 ${color}`} />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
    </motion.div>
  );

  const EmptyState = ({ icon: Icon, title, description, action, onAction }: any) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      className="flex flex-col items-center justify-center py-20 px-4"
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
        <div className="relative p-6 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/10">
          <Icon className="w-16 h-16 text-primary" />
        </div>
      </div>
      <h3 className="text-2xl font-bold mb-3 text-center">{title}</h3>
      <p className="text-muted-foreground text-center max-w-md mb-8">{description}</p>
      {action && (
        <button
          onClick={onAction}
          className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          {action}
        </button>
      )}
    </motion.div>
  );

  console.log('[PMWorkers] Render state', { loading, error, runtimeError, workers, attendance, stats });
  
  if (runtimeError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center max-w-md p-8 bg-red-950/50 border-2 border-red-500 rounded-2xl">
          <p className="font-bold mb-4 text-2xl text-red-400">Runtime Error</p>
          <p className="text-red-300">{runtimeError}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-2xl font-semibold text-white">Loading Workers & Attendance...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center max-w-md p-8 bg-red-950/50 border-2 border-red-500 rounded-2xl">
          <p className="font-bold mb-4 text-2xl text-red-400">Error Loading Data</p>
          <p className="text-red-300 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-3 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
          Workers & Attendance
        </h1>
        <p className="text-lg text-muted-foreground">Track worker attendance, manage assignments, and monitor performance</p>
      </motion.div>

      {/* Main Content Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative overflow-hidden rounded-3xl border-2 border-white/10 bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl shadow-2xl"
      >
        {/* Tab Headers */}
        <div className="flex overflow-x-auto border-b-2 border-white/10 bg-gradient-to-r from-white/5 to-transparent">
          {[
            { id: 'attendance', label: 'Daily Attendance', icon: Clock },
            { id: 'workers', label: 'Workers List', icon: Users },
            { id: 'assignments', label: 'Task Assignments', icon: CheckCircle },
            { id: 'performance', label: 'Performance', icon: TrendingUp },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-8 py-5 font-bold transition-all duration-300 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-primary border-b-4 border-primary bg-gradient-to-t from-primary/10 to-transparent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-8">
          <AnimatePresence mode="wait">
            {/* ATTENDANCE TAB */}
            {activeTab === 'attendance' && (
              <motion.div key="attendance" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                  <div className="flex gap-2 items-center">
                    <label className="font-semibold">Date:</label>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="px-3 py-2 rounded border" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label>Status:</label>
                    <select value={attendanceFilter.status} onChange={e => setAttendanceFilter(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 rounded border">
                      <option value="">All</option>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="on_leave">On Leave</option>
                    </select>
                  </div>
                  <div className="flex gap-2 items-center">
                    <label>Worker:</label>
                    <select value={attendanceFilter.worker_id} onChange={e => setAttendanceFilter(f => ({ ...f, worker_id: e.target.value }))} className="px-3 py-2 rounded border">
                      <option value="">All</option>
                      {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={() => setShowMarkAttendance(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 group"
                  >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                    Mark Attendance
                  </button>
                </div>
                {filteredAttendance.length === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title="No Attendance Records"
                    description="No records found for selected filters."
                    action="Mark Attendance"
                    onAction={() => setShowMarkAttendance(true)}
                  />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border-2 border-white/10">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="bg-gradient-to-r from-white/10 to-white/5 border-b-2 border-white/10">
                          <th className="px-4 py-2">Worker</th>
                          <th className="px-4 py-2">Status</th>
                          <th className="px-4 py-2">Check In</th>
                          <th className="px-4 py-2">Check Out</th>
                          <th className="px-4 py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAttendance.map((rec, idx) => {
                          const worker = workers.find(w => w.id === rec.worker_id);
                          return (
                            <tr key={idx} className="border-b hover:bg-white/5">
                              <td className="px-4 py-2">{worker ? worker.full_name : rec.worker_id}</td>
                              <td className="px-4 py-2">
                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(rec.status)}`}>
                                  {rec.status}
                                </span>
                              </td>
                              <td className="px-4 py-2">{rec.check_in || '-'}</td>
                              <td className="px-4 py-2">{rec.check_out || '-'}</td>
                              <td className="px-4 py-2">{rec.notes || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {/* WORKERS LIST TAB */}
            {activeTab === 'workers' && (
              <motion.div key="workers" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                {workers.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No Workers Registered"
                    description="Add your first worker to start managing your team."
                    action="Add Worker"
                    onAction={() => setShowAddWorker(true)}
                  />
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
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
                      <button
                        onClick={() => setShowAddWorker(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 group"
                      >
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                        Add Worker
                      </button>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border-2 border-white/10">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gradient-to-r from-white/10 to-white/5 border-b-2 border-white/10">
                        <th className="px-6 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider">Name</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider">Phone</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {workers
                        .filter(w => w.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((worker) => (
                          <tr key={worker.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-semibold text-foreground">{worker.full_name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground capitalize">
                              {worker.role}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                              {worker.phone || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(worker.status || 'active')}`}>
                                {worker.status || 'active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ASSIGNMENTS TAB */}
        {activeTab === 'assignments' && (
          <motion.div key="assignments" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <button
                onClick={() => setShowAssignTask(true)}
                className="px-6 py-3 bg-gradient-to-r from-primary to-accent text-background rounded-xl font-semibold hover:shadow-lg"
              >Assign Task</button>
              <div className="flex gap-2 items-center">
                <label>Status:</label>
                <select value={assignmentFilter.status} onChange={e => setAssignmentFilter(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 rounded border">
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="flex gap-2 items-center">
                <label>Worker:</label>
                <select value={assignmentFilter.worker_id} onChange={e => setAssignmentFilter(f => ({ ...f, worker_id: e.target.value }))} className="px-3 py-2 rounded border">
                  <option value="">All</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 items-center">
                <label>Due Date:</label>
                <input type="date" value={assignmentFilter.date} onChange={e => setAssignmentFilter(f => ({ ...f, date: e.target.value }))} className="px-3 py-2 rounded border" />
              </div>
            </div>
            {filteredAssignments.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="No Assignments"
                description="No assignments found for selected filters."
                action="Assign Task"
                onAction={() => setShowAssignTask(true)}
              />
            ) : (
              <div className="overflow-x-auto rounded-2xl border-2 border-white/10">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="bg-gradient-to-r from-white/10 to-white/5 border-b-2 border-white/10">
                      <th className="px-4 py-2">Worker</th>
                      <th className="px-4 py-2">Task</th>
                      <th className="px-4 py-2">Due Date</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignments.map((a, idx) => {
                      const worker = workers.find(w => w.id === a.worker_id);
                      return (
                        <tr key={idx} className="border-b hover:bg-white/5">
                          <td className="px-4 py-2">{worker ? worker.full_name : a.worker_id}</td>
                          <td className="px-4 py-2">{a.task}</td>
                          <td className="px-4 py-2">{a.due_date || '-'}</td>
                          <td className="px-4 py-2">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(a.status)}`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="px-4 py-2">{a.notes || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
        
        {/* PERFORMANCE TAB */}
        {activeTab === 'performance' && (
          <motion.div key="performance" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <EmptyState
              icon={TrendingUp}
              title="Performance Analytics"
              description="Detailed performance metrics coming soon."
              action={null}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </motion.div>

  {/* Add Worker Modal */}
  <AnimatePresence>
    {showAddWorker && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={() => setShowAddWorker(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative bg-gradient-to-br from-background to-accent/5 rounded-3xl border-2 border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 bg-gradient-to-r from-primary/10 to-accent/10 backdrop-blur-xl border-b-2 border-white/10 p-6 flex items-center justify-between">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Add New Worker</h2>
            <button onClick={() => setShowAddWorker(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-foreground mb-2 uppercase tracking-wide">Full Name *</label>
                <input
                  type="text"
                  value={workerForm.name}
                  onChange={(e) => setWorkerForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name"
                  className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                />
              </div>
              <div>
                <Label className="mb-2 uppercase tracking-wide">Role/Trade *</Label>
                <Select
                  value={workerForm.role}
                  onValueChange={(value) => setWorkerForm(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium">
                    <SelectValue placeholder="Select role..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mason">Mason</SelectItem>
                    <SelectItem value="carpenter">Carpenter</SelectItem>
                    <SelectItem value="electrician">Electrician</SelectItem>
                    <SelectItem value="plumber">Plumber</SelectItem>
                    <SelectItem value="painter">Painter</SelectItem>
                    <SelectItem value="welder">Welder</SelectItem>
                    <SelectItem value="laborer">General Laborer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-bold text-foreground mb-2 uppercase tracking-wide">Phone Number</label>
                <input
                  type="tel"
                  value={workerForm.phone}
                  onChange={(e) => setWorkerForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+254 XXX XXX XXX"
                  className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-foreground mb-2 uppercase tracking-wide">ID Number</label>
                <input
                  type="text"
                  value={workerForm.id_number}
                  onChange={(e) => setWorkerForm(prev => ({ ...prev, id_number: e.target.value }))}
                  placeholder="National ID"
                  className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-bold text-foreground mb-2 uppercase tracking-wide">Address</label>
                <textarea
                  rows={3}
                  value={workerForm.address}
                  onChange={(e) => setWorkerForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Residential address"
                  className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium resize-none"
                />
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 bg-gradient-to-t from-background to-transparent backdrop-blur-xl border-t-2 border-white/10 p-6 flex gap-4 justify-end">
            <button
              onClick={() => setShowAddWorker(false)}
              className="px-8 py-3 border-2 border-white/10 rounded-xl font-semibold hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAddWorker}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 group"
            >
              Add Worker
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>

  {/* Mark Attendance Modal */}
  <AnimatePresence>
    {showMarkAttendance && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={() => setShowMarkAttendance(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative bg-gradient-to-br from-background to-accent/5 rounded-3xl border-2 border-white/10 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 bg-gradient-to-r from-primary/10 to-accent/10 backdrop-blur-xl border-b-2 border-white/10 p-6 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Mark Attendance</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Date: {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <button onClick={() => setShowMarkAttendance(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6">
            {workers.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground mb-6">No workers available</p>
                <button
                  onClick={() => {
                    setShowMarkAttendance(false);
                    setShowAddWorker(true);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 mx-auto"
                >
                  <Plus className="w-5 h-5" />
                  Add Your First Worker
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {workers.map((worker) => (
                  <div key={worker.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border-2 border-white/10 rounded-2xl hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center font-bold text-lg">
                        {worker.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">{worker.full_name}</p>
                        <p className="text-sm text-muted-foreground capitalize">{worker.role}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Check In:</label>
                        <input
                          type="time"
                          value={attendanceRecords[worker.id]?.check_in || ''}
                          onChange={(e) => handleAttendanceChange(worker.id, 'check_in', e.target.value)}
                          className="w-32 px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Check Out:</label>
                        <input
                          type="time"
                          value={attendanceRecords[worker.id]?.check_out || ''}
                          onChange={(e) => handleAttendanceChange(worker.id, 'check_out', e.target.value)}
                          className="w-32 px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                        />
                      </div>
                      <Select
                        value={attendanceRecords[worker.id]?.status || 'present'}
                        onValueChange={(value) => handleAttendanceChange(worker.id, 'status', value)}
                      >
                        <SelectTrigger className="w-40 px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-semibold">
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
          </div>
          {workers.length > 0 && (
            <div className="sticky bottom-0 bg-gradient-to-t from-background to-transparent backdrop-blur-xl border-t-2 border-white/10 p-6 flex gap-4 justify-end">
              <button
                onClick={() => setShowMarkAttendance(false)}
                className="px-8 py-3 border-2 border-white/10 rounded-xl font-semibold hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAttendance}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 group"
              >
                Save Attendance
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>

  {/* Assign Task Modal */}
  <AnimatePresence>
    {showAssignTask && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={() => setShowAssignTask(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative bg-gradient-to-br from-background to-accent/5 rounded-3xl border-2 border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 bg-gradient-to-r from-primary/10 to-accent/10 backdrop-blur-xl border-b-2 border-white/10 p-6 flex items-center justify-between">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Assign Task</h2>
            <button onClick={() => setShowAssignTask(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="font-semibold">Worker</label>
                <select value={assignmentForm.worker_id} onChange={e => setAssignmentForm(f => ({ ...f, worker_id: e.target.value }))} className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5">
                  <option value="">Select worker</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold">Task</label>
                <input type="text" value={assignmentForm.task} onChange={e => setAssignmentForm(f => ({ ...f, task: e.target.value }))} placeholder="Task description" className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5" />
              </div>
              <div>
                <label className="font-semibold">Due Date</label>
                <input type="date" value={assignmentForm.due_date} onChange={e => setAssignmentForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5" />
              </div>
              <div>
                <label className="font-semibold">Status</label>
                <select value={assignmentForm.status} onChange={e => setAssignmentForm(f => ({ ...f, status: e.target.value }))} className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5">
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="font-semibold">Notes</label>
                <textarea rows={2} value={assignmentForm.notes} onChange={e => setAssignmentForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes" className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 resize-none" />
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 bg-gradient-to-t from-background to-transparent backdrop-blur-xl border-t-2 border-white/10 p-6 flex gap-4 justify-end">
            <button
              onClick={() => setShowAssignTask(false)}
              className="px-8 py-3 border-2 border-white/10 rounded-xl font-semibold hover:bg-white/5 transition-all"
            >Cancel</button>
            <button
              onClick={handleAssignTask}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary to-accent text-background rounded-xl font-semibold hover:shadow-lg"
            >Assign Task <ArrowRight className="w-5 h-5" /></button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
</div>
);
}

export default PMWorkers;