// src/components/projects/tabs/WorkersTab.tsx
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserCheck,
  UserX,
  Plus,
  X,
  Search,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  TrendingUp,
  Check,
  XCircle,
  AlertTriangle,
  Eye,
  User,
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  FileText,
  Award,
  ShieldAlert,
  Info,
  Lock,
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

// ─── All worker roles ────────────────────────────────────────────────────────
const ALL_WORKER_ROLES = [
  'mason', 'carpenter', 'electrician', 'plumber', 'painter', 'welder', 'laborer',
  'supervisor', 'foreman', 'architect', 'engineer', 'site_manager', 'safety_officer',
  'quality_inspector', 'project_manager', 'heavy_equipment_operator', 'concrete_finisher',
  'steel_worker', 'scaffolder', 'roofer', 'glazier', 'insulator', 'drywaller',
  'flooring_installer', 'landscaper', 'demolition_worker', 'surveying_technician',
  'crane_operator', 'pipefitter', 'hvac_technician', 'carpet_layer', 'tile_setter',
  'asphalt_worker', 'concrete_worker', 'steel_fabricator', 'formwork_carpenter',
  'reinforcement_worker', 'scaffolding_erector', 'interior_designer', 'exterior_designer',
  'quantity_surveyor', 'cost_estimator', 'construction_manager', 'project_engineer',
  'site_engineer', 'safety_manager', 'quality_manager', 'logistics_coordinator',
  'material_handler', 'equipment_operator', 'welding_inspector', 'concrete_pump_operator',
  'crane_rigger', 'steel_detailer', 'formwork_designer', 'reinforcement_designer',
  'scaffolding_designer', 'interior_decorator', 'exterior_decorator',
  'quantity_surveyor_assistant', 'cost_estimator_assistant', 'construction_supervisor',
  'project_supervisor', 'site_supervisor', 'safety_supervisor', 'quality_supervisor',
  'logistics_supervisor', 'material_supervisor', 'equipment_supervisor',
  'welding_supervisor', 'concrete_pump_supervisor', 'crane_rigger_supervisor',
  'steel_detailer_supervisor', 'formwork_designer_supervisor',
  'reinforcement_designer_supervisor', 'scaffolding_designer_supervisor',
  'interior_decorator_supervisor', 'exterior_decorator_supervisor',
  'quantity_surveyor_supervisor', 'cost_estimator_supervisor',
  'construction_manager_supervisor',
];

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface Worker {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  id_number: string | null;
  address: string | null;
  status: string;
  milestone_id: string | null;
  payment_method: 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque' | 'card';
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  mobile_money_provider: 'mpesa' | 'airtel_money' | 'tkash' | 'equitel' | 'other' | null;
  mobile_money_number: string | null;
  card_type: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other' | null;
  card_number_last4: string | null;
  card_holder_name: string | null;
  cheque_payable_to: string | null;
  payment_notes: string | null;
  quality_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  milestone?: { id: string; title: string } | null;
}

interface AttendanceRecord {
  id: string;
  worker_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: 'present' | 'absent' | 'late' | 'on_leave';
  notes: string | null;
}

interface MilestoneTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  milestone_id: string | null;
  start_date: string | null;
  due_date: string | null;
}

interface Assignment {
  id: string;
  worker_id: string;
  project_id: string;
  milestone_id?: string | null;
  task_id?: string | null;
  milestone?: { id: string; title: string } | null;
  task?: { id: string; title: string } | null;
  task_description?: string;
  start_date?: string | null;
  end_date?: string | null;
  status: 'assigned' | 'in_progress' | 'completed' | 'on_hold';
  quality_score?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  worker?: { full_name: string; role: string } | null;
}

// ─── Assignment Form State ────────────────────────────────────────────────────
interface AssignmentFormState {
  worker_id: string;
  milestone_id: string;       // '' = no milestone (standalone)
  task_id: string;
  task_title: string;         // read-only, from tasks table
  preset_description: string; // read-only, from tasks.description
  additional_info: string;    // editable by admin
  start_date: string;         // read-only when task selected, editable when custom
  due_date: string;           // read-only when task selected, editable when custom
  status: 'assigned' | 'in_progress' | 'completed' | 'on_hold';
  notes: string;
  is_custom: boolean;         // true when "None / Custom" task selected
}

// ─── Quality Scoring ──────────────────────────────────────────────────────────
interface QualityScoreData {
  structural_correct_measurements: boolean;
  structural_correct_methodology: boolean;
  equipment_returned: boolean;
  equipment_condition: boolean;
  equipment_clean: boolean;
  equipment_notes: string;
  completed_on_time: boolean | null;
  completion_delay_reason: string;
  presentation_neatness: boolean;
  presentation_texture: boolean;
  presentation_shape: boolean;
  presentation_alignment: boolean;
  attendance_check_in: string;
}

interface PayrollEligibility {
  eligible: boolean;
  reason: string;
  totalScore: number;
  breakdown: {
    structural: number;
    equipment: number;
    timeliness: number;
    presentation: number;
    attendance: number;
  };
  bonusEligible: boolean;
}

interface DashboardStats {
  total_workers: number;
  present_today: number;
  absent_today: number;
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

// ─── Quality Score Calculator ─────────────────────────────────────────────────
function calculateQualityScore(data: QualityScoreData): PayrollEligibility {
  const structuralPassed = data.structural_correct_measurements && data.structural_correct_methodology;
  const structural = structuralPassed ? 60 : 0;

  let equipment = 0;
  if (data.equipment_returned) {
    let count = 1;
    if (data.equipment_condition) count++;
    if (data.equipment_clean) count++;
    equipment = Math.round((count / 3) * 15);
  }

  const timeliness = data.completed_on_time === true ? 10 : 0;

  const presChecks = [
    data.presentation_neatness,
    data.presentation_texture,
    data.presentation_shape,
    data.presentation_alignment,
  ].filter(Boolean).length;
  const presentation = Math.round((presChecks / 4) * 5);

  let attendance = 10;
  if (data.attendance_check_in) {
    const [h, m] = data.attendance_check_in.split(':').map(Number);
    const totalMinutes = h * 60 + m;
    const startMinutes = 8 * 60;
    const lateMinutes = Math.max(0, totalMinutes - startMinutes);
    const halfHoursLate = Math.floor(lateMinutes / 30);
    attendance = Math.max(1, 10 - halfHoursLate * 3);
  }

  const totalScore = structural + equipment + timeliness + presentation + attendance;
  const eligible = structural === 60 && equipment >= 5;
  let reason = '';
  if (structural < 60) {
    reason = 'Failed structural integrity standards (0/60). Must pass all structural checks.';
  } else if (equipment < 5) {
    reason = 'Equipment not returned (0/15). Must return tools to qualify for payroll.';
  }

  return {
    eligible,
    reason,
    totalScore,
    breakdown: { structural, equipment, timeliness, presentation, attendance },
    bonusEligible: totalScore > 93,
  };
}

// ─── Toast Component ──────────────────────────────────────────────────────────
const ToastNotification: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const config = {
    success: { icon: <Check className="w-5 h-5" />, bg: 'bg-green-500/20', border: 'border-green-500/50', text: 'text-green-200' },
    error:   { icon: <XCircle className="w-5 h-5" />, bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-200' },
    warning: { icon: <AlertTriangle className="w-5 h-5" />, bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-200' },
  };
  const { icon, bg, border, text } = config[toast.type];
  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`flex items-center gap-3 min-w-80 max-w-md backdrop-blur-xl ${bg} ${border} ${text} border rounded-xl shadow-2xl p-4 cursor-pointer hover:opacity-90 transition-all pointer-events-auto`}
      onClick={() => onDismiss(toast.id)}
    >
      <div className="p-2 bg-white/20 rounded-lg">{icon}</div>
      <p className="font-medium text-sm">{toast.message}</p>
      <button onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }} className="ml-auto opacity-70 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

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

// ─── Read-Only Field Component ────────────────────────────────────────────────
const ReadOnlyField = ({ label, value }: { label: string; value: string }) => (
  <div>
    <Label className="mb-1 text-primary font-semibold flex items-center gap-1.5">
      <Lock className="w-3 h-3 opacity-60" />
      {label}
    </Label>
    <div
      className="w-full px-4 py-3 rounded-xl text-sm font-normal bg-white/[0.03] border border-white/[0.06] text-muted-foreground cursor-not-allowed select-none"
    >
      {value || <span className="opacity-40 italic">—</span>}
    </div>
    <span className="text-[10px] text-muted-foreground/60 mt-1 block">
      Auto-filled from task — not editable
    </span>
  </div>
);

// ─── Quality Score Modal ───────────────────────────────────────────────────────
const QualityScoreModal: React.FC<{
  assignment: Assignment;
  worker: Worker | undefined;
  onClose: () => void;
  onSave: (assignmentId: string, score: number, scoreData: QualityScoreData) => void;
}> = ({ assignment, worker, onClose, onSave }) => {
  const [scoreData, setScoreData] = useState<QualityScoreData>({
    structural_correct_measurements: false,
    structural_correct_methodology: false,
    equipment_returned: false,
    equipment_condition: false,
    equipment_clean: false,
    equipment_notes: '',
    completed_on_time: null,
    completion_delay_reason: '',
    presentation_neatness: false,
    presentation_texture: false,
    presentation_shape: false,
    presentation_alignment: false,
    attendance_check_in: '08:00',
  });

  const result = useMemo(() => calculateQualityScore(scoreData), [scoreData]);

  const toggle = (field: keyof QualityScoreData) => {
    setScoreData(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const CheckItem = ({ label, field, disabled = false }: { label: string; field: keyof QualityScoreData; disabled?: boolean }) => (
    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
      disabled ? 'opacity-40 cursor-not-allowed border-white/10 bg-white/5' :
      scoreData[field]
        ? 'border-green-500/50 bg-green-500/10 text-green-300'
        : 'border-white/20 bg-white/5 hover:bg-white/10'
    }`}>
      <div
        className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 ${
          scoreData[field] ? 'bg-green-500 border-green-500' : 'border-white/30'
        }`}
        onClick={() => !disabled && toggle(field)}
      >
        {scoreData[field] && <Check className="w-3 h-3 text-white" />}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-3xl bg-background/98 border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold">Quality Assessment</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {worker?.full_name} — {assignment.task_description || assignment.task?.title}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Score Bar */}
        <div className="mb-6 p-4 rounded-2xl border-2 border-white/10 bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-lg">Total Score</span>
            <span className={`text-3xl font-bold ${result.totalScore >= 93 ? 'text-green-400' : result.totalScore >= 65 ? 'text-yellow-400' : 'text-red-400'}`}>
              {result.totalScore}/100
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 mb-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${result.totalScore >= 93 ? 'bg-green-500' : result.totalScore >= 65 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${result.totalScore}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(result.breakdown).map(([k, v]) => (
              <span key={k} className="px-2 py-1 rounded-lg bg-white/10 font-semibold capitalize">
                {k}: <span className="text-primary">{v}</span>
              </span>
            ))}
          </div>
          <div className={`mt-3 p-3 rounded-xl border flex items-start gap-3 ${
            result.eligible ? 'border-green-500/40 bg-green-500/10' : 'border-red-500/40 bg-red-500/10'
          }`}>
            {result.eligible
              ? <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              : <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            }
            <div>
              <p className={`font-semibold text-sm ${result.eligible ? 'text-green-300' : 'text-red-300'}`}>
                {result.eligible
                  ? result.bonusEligible
                    ? '🎉 Payroll Eligible — Bonus Tier (>93%)'
                    : result.totalScore >= 65
                      ? '✅ Payroll Eligible — Normal Pay (65–93%)'
                      : '✅ Payroll Eligible'
                  : '❌ NOT Eligible for Payroll'
                }
              </p>
              {!result.eligible && <p className="text-xs text-red-300/80 mt-1">{result.reason}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* 1. Structural Integrity (60%) */}
          <div className="p-5 rounded-2xl border border-white/20 bg-white/5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-base flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-400">60%</span>
                </div>
                Structural Stability & Integrity
              </h4>
              <span className={`text-sm font-bold px-3 py-1 rounded-lg ${result.breakdown.structural === 60 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                {result.breakdown.structural}/60
              </span>
            </div>
            <p className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4 flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              All items must be checked to earn the full 60%. Missing even one results in 0%.
            </p>
            <div className="space-y-2">
              <CheckItem label="Correct measurements and placements" field="structural_correct_measurements" />
              <CheckItem label="Correct methodology of work" field="structural_correct_methodology" />
            </div>
          </div>

          {/* 2. Equipment & Tool Maintenance (15%) */}
          <div className="p-5 rounded-2xl border border-white/20 bg-white/5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-base flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-purple-400">15%</span>
                </div>
                Equipment & Tool Maintenance
              </h4>
              <span className={`text-sm font-bold px-3 py-1 rounded-lg ${result.breakdown.equipment > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                {result.breakdown.equipment}/15
              </span>
            </div>
            <div className="space-y-2 mb-3">
              <CheckItem label="Returned tools and equipment" field="equipment_returned" />
              <CheckItem label="Appropriate condition of returned tools" field="equipment_condition" disabled={!scoreData.equipment_returned} />
              <CheckItem label="Clean tools and equipment on returning" field="equipment_clean" disabled={!scoreData.equipment_returned} />
            </div>
            {!scoreData.equipment_returned && (
              <p className="text-xs text-red-300/80 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Failure to return equipment results in automatic 0% for this section.
              </p>
            )}
            <div className="mt-3">
              <Label className="mb-1 text-xs text-muted-foreground">Equipment Notes</Label>
              <textarea
                rows={2}
                value={scoreData.equipment_notes}
                onChange={e => setScoreData(prev => ({ ...prev, equipment_notes: e.target.value }))}
                placeholder="Notes about equipment condition..."
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm resize-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* 3. In-Time Finishing (10%) */}
          <div className="p-5 rounded-2xl border border-white/20 bg-white/5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-base flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-green-400">10%</span>
                </div>
                In-Time Finishing of Task
              </h4>
              <span className={`text-sm font-bold px-3 py-1 rounded-lg ${result.breakdown.timeliness === 10 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                {result.breakdown.timeliness}/10
              </span>
            </div>
            <div className="flex gap-3 mb-3">
              <button
                onClick={() => setScoreData(prev => ({ ...prev, completed_on_time: true }))}
                className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${scoreData.completed_on_time === true ? 'border-green-500 bg-green-500/20 text-green-300' : 'border-white/20 bg-white/5 hover:bg-white/10'}`}
              >
                ✅ Yes — Completed on Time
              </button>
              <button
                onClick={() => setScoreData(prev => ({ ...prev, completed_on_time: false }))}
                className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${scoreData.completed_on_time === false ? 'border-red-500 bg-red-500/20 text-red-300' : 'border-white/20 bg-white/5 hover:bg-white/10'}`}
              >
                ❌ No — Delayed
              </button>
            </div>
            {scoreData.completed_on_time === false && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <Label className="mb-1 text-xs text-muted-foreground">Reason for Delay</Label>
                <textarea
                  rows={2}
                  value={scoreData.completion_delay_reason}
                  onChange={e => setScoreData(prev => ({ ...prev, completion_delay_reason: e.target.value }))}
                  placeholder="Explain the reason for delay..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm resize-none focus:ring-2 focus:ring-primary"
                />
              </motion.div>
            )}
          </div>

          {/* 4. Presentation (5%) */}
          <div className="p-5 rounded-2xl border border-white/20 bg-white/5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-base flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-yellow-400">5%</span>
                </div>
                Presentation of Task
              </h4>
              <span className={`text-sm font-bold px-3 py-1 rounded-lg ${result.breakdown.presentation >= 3 ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                {result.breakdown.presentation}/5
              </span>
            </div>
            <div className="space-y-2">
              <CheckItem label="Neatness" field="presentation_neatness" />
              <CheckItem label="Desired texture" field="presentation_texture" />
              <CheckItem label="Desired shape" field="presentation_shape" />
              <CheckItem label="Desired alignment" field="presentation_alignment" />
            </div>
          </div>

          {/* 5. Attendance (10%) */}
          <div className="p-5 rounded-2xl border border-white/20 bg-white/5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-base flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-orange-400">10%</span>
                </div>
                Attendance
              </h4>
              <span className={`text-sm font-bold px-3 py-1 rounded-lg ${result.breakdown.attendance === 10 ? 'bg-green-500/20 text-green-300' : 'bg-orange-500/20 text-orange-300'}`}>
                {result.breakdown.attendance}/10
              </span>
            </div>
            <p className="text-xs text-muted-foreground/80 bg-white/5 border border-white/10 rounded-lg p-3 mb-4 flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Start time: 8:00 AM. Each 30 minutes late deducts 3%. Minimum score: 1%.
            </p>
            <div>
              <Label className="mb-2 text-sm">Check-in Time</Label>
              <input
                type="time"
                value={scoreData.attendance_check_in}
                onChange={e => setScoreData(prev => ({ ...prev, attendance_check_in: e.target.value }))}
                className="px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSave(assignment.id, result.totalScore, scoreData)}
            className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all"
          >
            Save Assessment ({result.totalScore}/100)
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
          >
            Cancel
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Main WorkersTab Component ────────────────────────────────────────────────
const WorkersTab: React.FC<WorkersTabProps> = ({ projectId, canEdit, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<TabType>('workers');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [workerForm, setWorkerForm] = useState({
    name: '', role: '', phone: '', id_number: '', address: '', milestone_id: '',
    payment_method: 'cash' as 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque' | 'card',
    bank_name: '', bank_account_number: '', bank_account_name: '',
    mobile_money_provider: '' as '' | 'mpesa' | 'airtel_money' | 'tkash' | 'equitel' | 'other',
    mobile_money_number: '',
    card_type: '' as '' | 'visa' | 'mastercard' | 'amex' | 'discover' | 'other',
    card_number_last4: '', card_holder_name: '', cheque_payable_to: '',
    payment_notes: '', notes: '',
  });

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [showMarkAttendance, setShowMarkAttendance] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<{ [key: string]: any }>({});
  const [attendanceFilter, setAttendanceFilter] = useState({ status: '', worker_id: '' });

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showAssignTask, setShowAssignTask] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // ── Extended Assignment Form State ────────────────────────────────────────
  const defaultAssignmentForm: AssignmentFormState = {
    worker_id: '',
    milestone_id: '',
    task_id: '',
    task_title: '',
    preset_description: '',
    additional_info: '',
    start_date: '',
    due_date: '',
    status: 'assigned',
    notes: '',
    is_custom: false,
  };
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>(defaultAssignmentForm);

  // Tasks fetched for the selected milestone OR standalone tasks (milestone_id IS NULL)
  const [milestoneTasks, setMilestoneTasks] = useState<MilestoneTask[]>([]);
  const [standaloneTasks, setStandaloneTasks] = useState<MilestoneTask[]>([]);
  const [loadingMilestoneTasks, setLoadingMilestoneTasks] = useState(false);
  const [loadingStandaloneTasks, setLoadingStandaloneTasks] = useState(false);

  const [assignmentFilter, setAssignmentFilter] = useState({ worker_id: '', status: '', milestone_id: '' });

  // Quality Score modal — only for completed assignments
  const [qualityModalAssignment, setQualityModalAssignment] = useState<Assignment | null>(null);

  const [stats, setStats] = useState<DashboardStats>({ total_workers: 0, present_today: 0, absent_today: 0 });
  const [milestones, setMilestones] = useState<{ id: string; title: string }[]>([]);
  const [viewingWorker, setViewingWorker] = useState<Worker | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Worker | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };
  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchMilestones = async () => {
    try {
      const { data } = await supabase
        .from('project_milestones')
        .select('id, title')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });
      setMilestones(data || []);
    } catch { setMilestones([]); }
  };

  // Fetch tasks for a specific milestone
  const fetchTasksForMilestone = async (milestoneId: string) => {
    if (!milestoneId) { setMilestoneTasks([]); return; }
    setLoadingMilestoneTasks(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, status, milestone_id, start_date, due_date')
        .eq('milestone_id', milestoneId)
        .order('created_at', { ascending: true });
      if (error) { setMilestoneTasks([]); return; }
      setMilestoneTasks(data || []);
    } catch { setMilestoneTasks([]); }
    finally { setLoadingMilestoneTasks(false); }
  };

  // Fetch standalone tasks (milestone_id IS NULL) for the project
  const fetchStandaloneTasks = async () => {
    setLoadingStandaloneTasks(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, status, milestone_id, start_date, due_date')
        .eq('project_id', projectId)
        .is('milestone_id', null)
        .order('created_at', { ascending: true });
      if (error) { setStandaloneTasks([]); return; }
      setStandaloneTasks(data || []);
    } catch { setStandaloneTasks([]); }
    finally { setLoadingStandaloneTasks(false); }
  };

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: projectWorkers } = await supabase.from('workers').select('id').eq('project_id', projectId);
      const workerIds = (projectWorkers || []).map((w: any) => w.id);

      let presentToday = 0;
      let absentToday = 0;
      if (workerIds.length > 0) {
        const { data: attData } = await supabase
          .from('worker_attendance')
          .select('status')
          .in('worker_id', workerIds)
          .eq('date', today);
        presentToday = (attData || []).filter((a: any) => a.status === 'present').length;
        absentToday = (attData || []).filter((a: any) => a.status === 'absent').length;
      }
      setStats({ total_workers: workerIds.length, present_today: presentToday, absent_today: absentToday });
    } catch {
      /* stats are best-effort */
    }
  };

  const fetchWorkers = async () => {
    setError(null);
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*, milestone:project_milestones(id, title)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) { setWorkers([]); setError('Failed to fetch workers: ' + error.message); return; }
      setWorkers(data || []);
    } catch { setWorkers([]); setError('Failed to fetch workers.'); }
  };

  const fetchAttendance = async (date: string) => {
    try {
      const { data: projectWorkers } = await supabase.from('workers').select('id').eq('project_id', projectId);
      const workerIds = (projectWorkers || []).map((w: any) => w.id);
      if (workerIds.length === 0) { setAttendance([]); return; }
      const { data, error } = await supabase
        .from('worker_attendance')
        .select('*')
        .in('worker_id', workerIds)
        .eq('date', date);
      if (error) { setAttendance([]); return; }
      setAttendance(data || []);
    } catch { setAttendance([]); }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('worker_assignments')
        .select(`
          *,
          worker:workers(full_name, role),
          milestone:project_milestones(id, title),
          task:tasks(id, title)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) { setAssignments([]); return; }
      setAssignments(data || []);
    } catch { setAssignments([]); }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchWorkers(), fetchMilestones(), fetchAssignments()]);
      await fetchAttendance(selectedDate);
      await fetchStats();
      setLoading(false);
    };
    load();
  }, [projectId]);

  useEffect(() => {
    if (activeTab === 'attendance') fetchAttendance(selectedDate);
  }, [selectedDate, activeTab]);

  // When milestone changes in assignment form, fetch tasks for that milestone
  // or standalone tasks if no milestone
  useEffect(() => {
    if (!editingAssignment) {
      if (assignmentForm.milestone_id) {
        fetchTasksForMilestone(assignmentForm.milestone_id);
        setStandaloneTasks([]);
      } else {
        setMilestoneTasks([]);
        fetchStandaloneTasks();
      }
      // Clear task selection when milestone changes
      setAssignmentForm(prev => ({
        ...prev,
        task_id: '',
        task_title: '',
        preset_description: '',
        additional_info: '',
        start_date: '',
        due_date: '',
        is_custom: false,
      }));
    }
  }, [assignmentForm.milestone_id]);

  // Apply auto-population when task is selected
  const handleTaskSelect = async (taskId: string) => {
    if (!taskId || taskId === '__custom__') {
      // Custom / no task selected — all fields become editable
      setAssignmentForm(prev => ({
        ...prev,
        task_id: '',
        task_title: '',
        preset_description: '',
        additional_info: '',
        start_date: '',
        due_date: '',
        is_custom: true,
      }));
      return;
    }

    // Fetch full task record for auto-population
    try {
      const { data: task } = await supabase
        .from('tasks')
        .select('id, title, description, start_date, due_date')
        .eq('id', taskId)
        .single();

      if (task) {
        setAssignmentForm(prev => ({
          ...prev,
          task_id: task.id,
          task_title: task.title || '',
          preset_description: task.description || '',
          additional_info: '',
          start_date: task.start_date ? task.start_date.split('T')[0] : '',
          due_date: task.due_date ? task.due_date.split('T')[0] : '',
          is_custom: false,
        }));
      }
    } catch {
      showToast('Failed to load task details', 'error');
    }
  };

  const resetWorkerForm = () => {
    setWorkerForm({
      name: '', role: '', phone: '', id_number: '', address: '', milestone_id: '',
      payment_method: 'cash', bank_name: '', bank_account_number: '', bank_account_name: '',
      mobile_money_provider: '', mobile_money_number: '', card_type: '',
      card_number_last4: '', card_holder_name: '', cheque_payable_to: '',
      payment_notes: '', notes: '',
    });
    setEditingWorker(null);
  };

  const resetAssignmentForm = () => {
    setAssignmentForm(defaultAssignmentForm);
    setMilestoneTasks([]);
    setStandaloneTasks([]);
    setEditingAssignment(null);
  };

  const handleEditWorker = (worker: Worker) => {
    setEditingWorker(worker);
    setWorkerForm({
      name: worker.full_name, role: worker.role, phone: worker.phone || '',
      id_number: worker.id_number || '', address: worker.address || '',
      milestone_id: worker.milestone_id || '',
      payment_method: worker.payment_method || 'cash',
      bank_name: worker.bank_name || '', bank_account_number: worker.bank_account_number || '',
      bank_account_name: worker.bank_account_name || '',
      mobile_money_provider: worker.mobile_money_provider || '',
      mobile_money_number: worker.mobile_money_number || '',
      card_type: worker.card_type || '', card_number_last4: worker.card_number_last4 || '',
      card_holder_name: worker.card_holder_name || '',
      cheque_payable_to: worker.cheque_payable_to || '',
      payment_notes: worker.payment_notes || '',
      notes: worker.notes || '',
    });
    setShowAddWorker(true);
  };

  const handleSaveWorker = async () => {
    if (!workerForm.name.trim() || !workerForm.role) { showToast('Full name and role are required', 'warning'); return; }
    if (!workerForm.id_number?.trim()) { showToast('ID Number is required', 'warning'); return; }
    if (!projectId) { showToast('No project selected', 'error'); return; }

    if (workerForm.payment_method === 'bank_transfer' && (!workerForm.bank_name || !workerForm.bank_account_number || !workerForm.bank_account_name)) {
      showToast('Bank details are required', 'warning'); return;
    }
    if (workerForm.payment_method === 'mobile_money' && (!workerForm.mobile_money_provider || !workerForm.mobile_money_number)) {
      showToast('Mobile money details are required', 'warning'); return;
    }
    if (workerForm.payment_method === 'card') {
      if (!workerForm.card_type || !workerForm.card_number_last4 || !workerForm.card_holder_name) {
        showToast('Card details are required', 'warning'); return;
      }
      if (workerForm.card_number_last4.length !== 4 || !/^\d{4}$/.test(workerForm.card_number_last4)) {
        showToast('Card number must be exactly 4 digits', 'warning'); return;
      }
    }
    if (workerForm.payment_method === 'cheque' && !workerForm.cheque_payable_to) {
      showToast('Payable to name is required', 'warning'); return;
    }

    try {
      const workerData = {
        full_name: workerForm.name.trim(), role: workerForm.role,
        phone: workerForm.phone || null, id_number: workerForm.id_number || null,
        address: workerForm.address || null, milestone_id: workerForm.milestone_id || null,
        payment_method: workerForm.payment_method,
        bank_name: workerForm.payment_method === 'bank_transfer' ? workerForm.bank_name : null,
        bank_account_number: workerForm.payment_method === 'bank_transfer' ? workerForm.bank_account_number : null,
        bank_account_name: workerForm.payment_method === 'bank_transfer' ? workerForm.bank_account_name : null,
        mobile_money_provider: workerForm.payment_method === 'mobile_money' ? workerForm.mobile_money_provider : null,
        mobile_money_number: workerForm.payment_method === 'mobile_money' ? workerForm.mobile_money_number : null,
        card_type: workerForm.payment_method === 'card' ? workerForm.card_type : null,
        card_number_last4: workerForm.payment_method === 'card' ? workerForm.card_number_last4 : null,
        card_holder_name: workerForm.payment_method === 'card' ? workerForm.card_holder_name : null,
        cheque_payable_to: workerForm.payment_method === 'cheque' ? workerForm.cheque_payable_to : null,
        payment_notes: workerForm.payment_notes || null,
        notes: workerForm.notes || null,
        status: 'active',
        project_id: projectId,
      };

      if (editingWorker) {
        const { error } = await supabase.from('workers').update(workerData).eq('id', editingWorker.id);
        if (error) { showToast(error.message || 'Failed to update worker', 'error'); return; }
        showToast('Worker updated successfully!', 'success');
      } else {
        const { error } = await supabase.from('workers').insert([workerData]);
        if (error) { showToast(error.message || 'Failed to add worker', 'error'); return; }
        showToast('Worker added successfully!', 'success');
      }
      setShowAddWorker(false);
      resetWorkerForm();
      await Promise.all([fetchWorkers(), fetchStats()]);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showToast('Failed to save worker: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  const handleDeleteWorker = async (worker: Worker) => {
    try {
      const { error } = await supabase.from('workers').delete().eq('id', worker.id);
      if (error) { showToast(error.message || 'Failed to delete worker', 'error'); return; }
      showToast('Worker deleted successfully!', 'success');
      setConfirmDelete(null);
      await Promise.all([fetchWorkers(), fetchStats()]);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showToast('Failed to delete worker: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  const handleAttendanceChange = (workerId: string, field: string, value: string) => {
    setAttendanceRecords(prev => ({ ...prev, [workerId]: { ...prev[workerId], [field]: value || null } }));
  };

  const handleSaveAttendance = async () => {
    const records = Object.entries(attendanceRecords)
      .filter(([_, v]) => v && (v.check_in || v.check_out || v.status))
      .map(([worker_id, v]) => ({
        worker_id, date: selectedDate,
        check_in: v.check_in || null, check_out: v.check_out || null,
        status: v.status || 'present', notes: v.notes || null,
      }));
    if (records.length === 0) { showToast('No changes to save', 'warning'); return; }
    try {
      const { error } = await supabase.from('worker_attendance').upsert(records, { onConflict: 'worker_id,date' });
      if (error) { showToast(error.message || 'Failed to save attendance', 'error'); return; }
      showToast('Attendance saved successfully!', 'success');
      setShowMarkAttendance(false);
      setAttendanceRecords({});
      await Promise.all([fetchAttendance(selectedDate), fetchStats()]);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showToast('Failed to save attendance: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  // ── Save Assignment ────────────────────────────────────────────────────────
  const handleSaveAssignment = async () => {
    if (!assignmentForm.worker_id) { showToast('Please select a worker', 'warning'); return; }

    // Validation: need task OR custom description
    const hasTask = !!assignmentForm.task_id;
    const effectiveDescription = assignmentForm.is_custom
      ? assignmentForm.additional_info.trim()
      : assignmentForm.preset_description.trim();

    if (!hasTask && !effectiveDescription) {
      showToast('Please select a task or enter a custom task description', 'warning');
      return;
    }

    // Build the stored task_description
    let storedDescription = '';
    if (assignmentForm.is_custom) {
      storedDescription = assignmentForm.additional_info.trim();
    } else if (assignmentForm.preset_description && assignmentForm.additional_info.trim()) {
      storedDescription = `${assignmentForm.preset_description}\n\n[Note]: ${assignmentForm.additional_info.trim()}`;
    } else {
      storedDescription = assignmentForm.preset_description;
    }

    try {
      const payload: any = {
        worker_id: assignmentForm.worker_id,
        project_id: projectId,
        milestone_id: assignmentForm.milestone_id || null,
        task_id: assignmentForm.task_id || null,
        task_description: storedDescription,
        start_date: assignmentForm.start_date || null,
        end_date: assignmentForm.due_date || null,
        status: assignmentForm.status,
        notes: assignmentForm.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (editingAssignment) {
        // In edit mode, only status and notes (+ additional_info) are updated
        const editPayload: any = {
          status: assignmentForm.status,
          notes: assignmentForm.notes || null,
          updated_at: new Date().toISOString(),
        };
        // Also update task_description if additional_info changed
        if (!assignmentForm.is_custom && assignmentForm.preset_description) {
          editPayload.task_description = storedDescription;
        }

        const { error } = await supabase.from('worker_assignments').update(editPayload).eq('id', editingAssignment.id);
        if (error) { showToast('Failed to update assignment: ' + error.message, 'error'); return; }

        // If status changed to completed, mark linked task as done
        if (assignmentForm.status === 'completed' && assignmentForm.task_id) {
          await supabase
            .from('tasks')
            .update({ status: 'done', completed_at: new Date().toISOString() })
            .eq('id', assignmentForm.task_id);
        }

        showToast('Assignment updated successfully!', 'success');
      } else {
        payload.created_at = new Date().toISOString();
        const { error } = await supabase.from('worker_assignments').insert([payload]);
        if (error) { showToast('Failed to create assignment: ' + error.message, 'error'); return; }

        // If created with completed status, mark linked task as done immediately
        if (assignmentForm.status === 'completed' && assignmentForm.task_id) {
          await supabase
            .from('tasks')
            .update({ status: 'done', completed_at: new Date().toISOString() })
            .eq('id', assignmentForm.task_id);
        }

        showToast('Task assigned successfully!', 'success');
      }

      setShowAssignTask(false);
      resetAssignmentForm();
      await fetchAssignments();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showToast('Failed to save assignment: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    try {
      const { error } = await supabase.from('worker_assignments').delete().eq('id', id);
      if (error) { showToast(error.message || 'Failed to delete assignment', 'error'); return; }
      showToast('Assignment deleted!', 'success');
      await fetchAssignments();
      if (onUpdate) onUpdate();
    } catch { showToast('Failed to delete assignment', 'error'); }
  };

  // Save quality assessment (only called from completed assignments)
  const handleSaveQualityScore = async (assignmentId: string, score: number, scoreData: QualityScoreData) => {
    try {
      const { error } = await supabase
        .from('worker_assignments')
        .update({
          quality_score: score,
          notes: JSON.stringify({
            scoreBreakdown: calculateQualityScore(scoreData).breakdown,
            scoreData,
          }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);
      if (error) { showToast('Failed to save quality score', 'error'); return; }
      showToast(`Quality score saved: ${score}/100`, 'success');
      setQualityModalAssignment(null);
      await fetchAssignments();
    } catch { showToast('Failed to save quality score', 'error'); }
  };

  const filteredWorkers = useMemo(() => workers.filter(w =>
    w.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.id_number?.toLowerCase().includes(searchQuery.toLowerCase())
  ), [workers, searchQuery]);

  const filteredAttendance = useMemo(() => attendance.filter(rec => {
    let match = true;
    if (attendanceFilter.status) match = match && rec.status === attendanceFilter.status;
    if (attendanceFilter.worker_id) match = match && rec.worker_id === attendanceFilter.worker_id;
    return match;
  }), [attendance, attendanceFilter]);

  const filteredAssignments = useMemo(() => {
    let result = assignments;
    if (assignmentFilter.worker_id) result = result.filter(a => a.worker_id === assignmentFilter.worker_id);
    if (assignmentFilter.status) result = result.filter(a => a.status === assignmentFilter.status);
    if (assignmentFilter.milestone_id) result = result.filter(a => a.milestone_id === assignmentFilter.milestone_id);
    return result;
  }, [assignments, assignmentFilter]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/20 border-green-500/50 text-green-300',
      inactive: 'bg-gray-500/20 border-gray-500/50 text-gray-300',
      present: 'bg-green-500/20 border-green-500/50 text-green-300',
      absent: 'bg-red-500/20 border-red-500/50 text-red-300',
      late: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
      on_leave: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
      assigned: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
      in_progress: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
      completed: 'bg-green-500/20 border-green-500/50 text-green-300',
      on_hold: 'bg-orange-500/20 border-orange-500/50 text-orange-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getQualityColor = (score: number | null) => {
    if (score == null) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getPayrollBadge = (score: number | null) => {
    if (score == null) return null;
    if (score > 93) return { label: 'Bonus Eligible', color: 'bg-green-500/30 text-green-300 border-green-500/50' };
    if (score >= 65) return { label: 'Normal Pay', color: 'bg-blue-500/30 text-blue-300 border-blue-500/50' };
    return { label: 'Below Threshold', color: 'bg-red-500/30 text-red-300 border-red-500/50' };
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash': return Wallet;
      case 'bank_transfer': return Building2;
      case 'mobile_money': return Smartphone;
      case 'card': return CreditCard;
      case 'cheque': return FileText;
      default: return Wallet;
    }
  };

  const paymentMethods = [
    { value: 'cash', label: 'Cash', icon: Wallet },
    { value: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
    { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
    { value: 'card', label: 'Card Payment', icon: CreditCard },
    { value: 'cheque', label: 'Cheque', icon: FileText },
  ];
  const mobileMoneyProviders = [
    { value: 'mpesa', label: 'M-Pesa' }, { value: 'airtel_money', label: 'Airtel Money' },
    { value: 'tkash', label: 'T-Kash' }, { value: 'equitel', label: 'Equitel' }, { value: 'other', label: 'Other' },
  ];
  const cardTypes = [
    { value: 'visa', label: 'Visa' }, { value: 'mastercard', label: 'Mastercard' },
    { value: 'amex', label: 'American Express' }, { value: 'discover', label: 'Discover' }, { value: 'other', label: 'Other' },
  ];

  // Shared input className
  const inputCls = "w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-foreground font-medium focus:ring-2 focus:ring-primary focus:outline-none backdrop-blur-xl";
  const readOnlyCls = "w-full px-4 py-3 rounded-xl text-sm font-normal bg-white/[0.03] border border-white/[0.06] text-muted-foreground cursor-not-allowed select-none";

  if (loading) {
    return (
      <GlassCard className="text-center py-16">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-6" />
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
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-primary hover:bg-primary/90 text-background rounded-xl font-semibold">Retry</button>
      </GlassCard>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={Users} title="Total Workers" value={stats.total_workers} color="text-primary" subtitle="Linked to this project" />
          <StatCard icon={UserCheck} title="Present Today" value={stats.present_today} color="text-green-600" />
          <StatCard icon={UserX} title="Absent Today" value={stats.absent_today} color="text-red-600" />
        </div>

        {/* Tab Navigation */}
        <GlassCard className="p-2">
          <div className="flex overflow-x-auto gap-2 scrollbar-hide">
            {[
              { id: 'workers' as TabType, label: 'Workers List', icon: Users },
              { id: 'attendance' as TabType, label: 'Daily Attendance', icon: Clock },
              { id: 'assignments' as TabType, label: 'Task Assignments', icon: CheckCircle },
              { id: 'performance' as TabType, label: 'Performance', icon: TrendingUp },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-3 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-primary text-background shadow-lg' : 'hover:bg-white/10'}`}
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

          {/* ── WORKERS LIST TAB ── */}
          {activeTab === 'workers' && (
            <motion.div key="workers" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              {workers.length === 0 ? (
                <EmptyState icon={Users} title="No Workers Registered" description="Add your first worker to start managing your team." action={canEdit ? 'Add Worker' : null} onAction={() => setShowAddWorker(true)} />
              ) : (
                <GlassCard>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="relative flex-1 max-w-2xl w-full">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                      <input
                        type="text" placeholder="Search workers by name, role, or ID..."
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium"
                      />
                    </div>
                    {canEdit && (
                      <button onClick={() => { resetWorkerForm(); setShowAddWorker(true); }} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 group">
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
                          <th className="py-4 px-6 text-left font-semibold text-muted-foreground">ID Number</th>
                          <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Phone</th>
                          <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Milestone</th>
                          <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Payment</th>
                          <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Status</th>
                          {canEdit && <th className="py-4 px-6 text-center font-semibold text-muted-foreground">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWorkers.map(worker => {
                          const PaymentIcon = getPaymentIcon(worker.payment_method);
                          return (
                            <tr key={worker.id} className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors">
                              <td className="py-4 px-6 text-foreground font-medium">{worker.full_name}</td>
                              <td className="py-4 px-6 text-foreground capitalize">{worker.role.replace(/_/g, ' ')}</td>
                              <td className="py-4 px-6 text-foreground font-mono text-sm">{worker.id_number || '-'}</td>
                              <td className="py-4 px-6 text-foreground">{worker.phone || '-'}</td>
                              <td className="py-4 px-6 text-foreground text-sm">{worker.milestone?.title || '-'}</td>
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-2">
                                  <PaymentIcon className="w-4 h-4 text-primary" />
                                  <span className="text-sm capitalize">{worker.payment_method.replace(/_/g, ' ')}</span>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <span className={`px-3 py-1 rounded-xl text-xs font-semibold border ${getStatusColor(worker.status || 'active')}`}>
                                  {worker.status || 'active'}
                                </span>
                              </td>
                              {canEdit && (
                                <td className="py-4 px-6">
                                  <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => setViewingWorker(worker)} className="p-2 hover:bg-blue-500/20 rounded-lg transition-all text-blue-500" title="View Details"><Eye className="w-4 h-4" /></button>
                                    <button onClick={() => handleEditWorker(worker)} className="p-2 hover:bg-primary/20 rounded-lg transition-all text-primary" title="Edit Worker"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => setConfirmDelete(worker)} className="p-2 hover:bg-red-500/20 rounded-lg transition-all text-red-500" title="Delete Worker"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              )}
            </motion.div>
          )}

          {/* ── ATTENDANCE TAB ── */}
          {activeTab === 'attendance' && (
            <motion.div key="attendance" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <GlassCard>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div className="flex gap-2 items-center">
                    <label className="font-semibold text-sm">Date:</label>
                    <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="px-3 py-2 rounded-xl border border-white/20 bg-white/5 focus:ring-2 focus:ring-primary" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="text-sm">Status:</label>
                    <Select value={attendanceFilter.status || 'all'} onValueChange={value => setAttendanceFilter(f => ({ ...f, status: value === 'all' ? '' : value }))}>
                      <SelectTrigger className="w-36 px-3 py-2 border-2 border-white/10 rounded-xl bg-white/5 text-sm">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                        <SelectItem value="late">Late</SelectItem>
                        <SelectItem value="on_leave">On Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {canEdit && (
                    <button onClick={() => setShowMarkAttendance(true)} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300">
                      <Plus className="w-5 h-5" />
                      Mark Attendance
                    </button>
                  )}
                </div>
                {filteredAttendance.length === 0 ? (
                  <EmptyState icon={Clock} title="No Attendance Records" description="No records found for selected filters." action={canEdit ? 'Mark Attendance' : null} onAction={() => setShowMarkAttendance(true)} />
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
                              <td className="py-4 px-6"><span className={`px-3 py-1 rounded-xl text-xs font-semibold border ${getStatusColor(rec.status)}`}>{rec.status}</span></td>
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

          {/* ── ASSIGNMENTS TAB ── */}
          {activeTab === 'assignments' && (
            <motion.div key="assignments" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <GlassCard className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">Task Assignments</h2>
                    <p className="text-muted-foreground text-sm">Assign milestone tasks to workers and track quality on completion.</p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => { resetAssignmentForm(); setShowAssignTask(true); }}
                      className="px-6 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 group"
                    >
                      <span className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Assign Task
                      </span>
                    </button>
                  )}
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <select
                    value={assignmentFilter.worker_id || 'all'}
                    onChange={e => setAssignmentFilter(f => ({ ...f, worker_id: e.target.value === 'all' ? '' : e.target.value }))}
                    className={inputCls}
                  >
                    <option value="all" className="bg-background">All Workers</option>
                    {workers.map(w => <option key={w.id} value={w.id} className="bg-background">{w.full_name}</option>)}
                  </select>
                  <select
                    value={assignmentFilter.status || 'all'}
                    onChange={e => setAssignmentFilter(f => ({ ...f, status: e.target.value === 'all' ? '' : e.target.value }))}
                    className={inputCls}
                  >
                    <option value="all" className="bg-background">All Statuses</option>
                    <option value="assigned" className="bg-background">Assigned</option>
                    <option value="in_progress" className="bg-background">In Progress</option>
                    <option value="completed" className="bg-background">Completed</option>
                    <option value="on_hold" className="bg-background">On Hold</option>
                  </select>
                  <select
                    value={assignmentFilter.milestone_id || 'all'}
                    onChange={e => setAssignmentFilter(f => ({ ...f, milestone_id: e.target.value === 'all' ? '' : e.target.value }))}
                    className={inputCls}
                  >
                    <option value="all" className="bg-background">All Milestones</option>
                    {milestones.map(m => <option key={m.id} value={m.id} className="bg-background">{m.title}</option>)}
                  </select>
                </div>

                {filteredAssignments.length === 0 ? (
                  <EmptyState icon={CheckCircle} title="No Task Assignments" description="Assign tasks to workers to start tracking project progress." action={canEdit ? 'Assign Task' : null} onAction={() => { resetAssignmentForm(); setShowAssignTask(true); }} />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border-2 border-white/10 bg-white/5 shadow-2xl">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-primary/10 to-accent/10">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Worker</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Milestone</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Task</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Description</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Start</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Due</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Status</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Quality / Payroll</th>
                          {canEdit && <th className="px-4 py-3 text-center font-semibold text-primary">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAssignments.map(a => {
                          const payrollBadge = getPayrollBadge(a.quality_score ?? null);
                          return (
                            <tr key={a.id} className="border-b border-white/10 hover:bg-primary/5 transition-all">
                              <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                                {a.worker?.full_name || workers.find(w => w.id === a.worker_id)?.full_name || '—'}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                {a.milestone?.title || milestones.find(m => m.id === a.milestone_id)?.title || '—'}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                {a.task?.title || '—'}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{a.task_description || '—'}</td>
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{a.start_date ? new Date(a.start_date).toLocaleDateString() : '—'}</td>
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{a.end_date ? new Date(a.end_date).toLocaleDateString() : '—'}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-3 py-1 rounded-xl font-semibold text-xs border ${getStatusColor(a.status)}`}>
                                  {a.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {a.status === 'completed' ? (
                                  a.quality_score != null ? (
                                    <div className="space-y-1">
                                      <span className={`font-bold text-sm ${getQualityColor(a.quality_score)}`}>{a.quality_score}/100</span>
                                      {payrollBadge && (
                                        <div>
                                          <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${payrollBadge.color}`}>{payrollBadge.label}</span>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-amber-400 font-semibold">⏳ Pending assessment</span>
                                  )
                                ) : (
                                  <span className="text-xs text-muted-foreground">Assess on completion</span>
                                )}
                              </td>
                              {canEdit && (
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex gap-2 justify-center">
                                    {a.status === 'completed' && (
                                      <button
                                        onClick={() => setQualityModalAssignment(a)}
                                        className="px-3 py-1 bg-accent/80 text-background rounded-lg font-semibold hover:bg-accent transition-all text-xs"
                                        title="Quality Assessment"
                                      >
                                        <Award className="w-3 h-3 inline mr-1" />
                                        {a.quality_score != null ? 'Re-assess' : 'Assess'}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setEditingAssignment(a);
                                        setAssignmentForm({
                                          worker_id: a.worker_id,
                                          milestone_id: a.milestone_id || '',
                                          task_id: a.task_id || '',
                                          task_title: a.task?.title || '',
                                          preset_description: a.task_description || '',
                                          additional_info: '',
                                          start_date: a.start_date ? a.start_date.split('T')[0] : '',
                                          due_date: a.end_date ? a.end_date.split('T')[0] : '',
                                          status: a.status,
                                          notes: a.notes || '',
                                          is_custom: !a.task_id,
                                        });
                                        setShowAssignTask(true);
                                      }}
                                      className="px-3 py-1 bg-primary text-background rounded-lg font-semibold hover:bg-primary/90 transition-all text-xs"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAssignment(a.id)}
                                      className="px-3 py-1 bg-red-600 text-background rounded-lg font-semibold hover:bg-red-700 transition-all text-xs"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              )}
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

          {/* ── PERFORMANCE TAB ── */}
          {activeTab === 'performance' && (
            <motion.div key="performance" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <GlassCard className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">Performance & Payroll Summary</h2>
                    <p className="text-muted-foreground text-sm">Quality scores are recorded per completed task assignment.</p>
                  </div>
                </div>

                {/* Payroll Threshold Legend */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5">
                    <p className="font-bold text-red-300 text-sm mb-1">❌ Not Eligible for Payroll</p>
                    <p className="text-xs text-red-300/70">Must have 60% structural + ≥5% equipment (tools returned)</p>
                  </div>
                  <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
                    <p className="font-bold text-blue-300 text-sm mb-1">✅ Normal Pay (65–93%)</p>
                    <p className="text-xs text-blue-300/70">Eligible for agreed pay rate</p>
                  </div>
                  <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5">
                    <p className="font-bold text-green-300 text-sm mb-1">🎉 Bonus Eligible (&gt;93%)</p>
                    <p className="text-xs text-green-300/70">Eligible for bonus on top of normal pay</p>
                  </div>
                </div>

                {/* Score Breakdown Reference */}
                <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                  <h4 className="font-bold mb-3 text-sm flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> Scoring Breakdown</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    {[
                      { label: 'Structural Integrity', pct: '60%', note: 'All-or-nothing', color: 'text-blue-400' },
                      { label: 'Equipment & Tools', pct: '15%', note: 'Must return = 0 baseline', color: 'text-purple-400' },
                      { label: 'In-Time Finishing', pct: '10%', note: 'Yes/No', color: 'text-green-400' },
                      { label: 'Presentation', pct: '5%', note: '4 checklist items', color: 'text-yellow-400' },
                      { label: 'Attendance', pct: '10%', note: '-3% per 30min late, min 1%', color: 'text-orange-400' },
                    ].map(item => (
                      <div key={item.label} className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <p className={`font-bold text-lg ${item.color}`}>{item.pct}</p>
                        <p className="font-semibold text-foreground">{item.label}</p>
                        <p className="text-muted-foreground">{item.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {workers.length === 0 ? (
                  <EmptyState icon={TrendingUp} title="No Workers" description="Add workers to view performance data." action={null} onAction={null} />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border-2 border-white/10 bg-white/5 shadow-2xl">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-primary/10 to-accent/10">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Worker</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Role</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Completed Tasks</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Avg Quality Score</th>
                          <th className="px-4 py-3 text-left font-semibold text-primary">Payroll Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workers.map(worker => {
                          const workerAssignments = assignments.filter(a => a.worker_id === worker.id);
                          const completedAssignments = workerAssignments.filter(a => a.status === 'completed');
                          const scoredAssignments = completedAssignments.filter(a => a.quality_score != null);
                          const avgScore = scoredAssignments.length > 0
                            ? Math.round(scoredAssignments.reduce((sum, a) => sum + (a.quality_score || 0), 0) / scoredAssignments.length)
                            : null;
                          const payrollBadge = getPayrollBadge(avgScore);

                          return (
                            <tr key={worker.id} className="border-b border-white/10 hover:bg-primary/5 transition-all">
                              <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{worker.full_name}</td>
                              <td className="px-4 py-3 text-muted-foreground capitalize whitespace-nowrap">{worker.role.replace(/_/g, ' ')}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-primary font-bold">{completedAssignments.length}</span>
                                <span className="text-muted-foreground"> / {workerAssignments.length} total</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {avgScore != null ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-white/10 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full transition-all duration-500 ${avgScore >= 93 ? 'bg-green-500' : avgScore >= 65 ? 'bg-blue-500' : 'bg-red-500'}`}
                                        style={{ width: `${avgScore}%` }}
                                      />
                                    </div>
                                    <span className={`font-bold text-sm ${getQualityColor(avgScore)}`}>{avgScore}/100</span>
                                    <span className="text-xs text-muted-foreground">({scoredAssignments.length} assessed)</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {completedAssignments.length > 0 ? '⏳ Pending assessment' : 'No completed tasks'}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {payrollBadge ? (
                                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold border ${payrollBadge.color}`}>{payrollBadge.label}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Pending</span>
                                )}
                              </td>
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
        </AnimatePresence>

        {/* ── Add/Edit Worker Modal ── */}
        <AnimatePresence>
          {showAddWorker && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowAddWorker(false); resetWorkerForm(); }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-4xl backdrop-blur-xl bg-background/95 border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold">{editingWorker ? 'Edit Worker' : 'Add New Worker'}</h3>
                  <button onClick={() => { setShowAddWorker(false); resetWorkerForm(); }} className="p-2 hover:bg-white/10 rounded-lg transition-all"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-6">
                  {/* Basic Information */}
                  <div>
                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2 text-primary"><User className="w-5 h-5" />Basic Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="mb-2">Full Name *</Label>
                        <input type="text" value={workerForm.name} onChange={e => setWorkerForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Enter full name" className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 backdrop-blur-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-300 font-medium" />
                      </div>
                      <div>
                        <Label className="mb-2">Role/Trade *</Label>
                        <Select value={workerForm.role} onValueChange={value => setWorkerForm(prev => ({ ...prev, role: value }))}>
                          <SelectTrigger className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5">
                            <SelectValue placeholder="Select role..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-64 overflow-y-auto">
                            {ALL_WORKER_ROLES.map(role => (
                              <SelectItem key={role} value={role}>
                                {role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="mb-2">ID Number *</Label>
                        <input type="text" value={workerForm.id_number} onChange={e => setWorkerForm(prev => ({ ...prev, id_number: e.target.value }))} placeholder="National ID or Passport" className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5" />
                      </div>
                      <div>
                        <Label className="mb-2">Phone Number</Label>
                        <input type="tel" value={workerForm.phone} onChange={e => setWorkerForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="+254 XXX XXX XXX" className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="mb-2">Milestone Assignment</Label>
                        <Select value={workerForm.milestone_id || 'none'} onValueChange={value => setWorkerForm(prev => ({ ...prev, milestone_id: value === 'none' ? '' : value }))}>
                          <SelectTrigger className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5">
                            <SelectValue placeholder="Select milestone (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No milestone</SelectItem>
                            {milestones.map(m => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="mb-2">Address</Label>
                        <textarea rows={2} value={workerForm.address} onChange={e => setWorkerForm(prev => ({ ...prev, address: e.target.value }))} placeholder="Residential address" className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 resize-none" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="mb-2">Worker Notes</Label>
                        <textarea rows={3} value={workerForm.notes} onChange={e => setWorkerForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Notes about this worker's performance, behaviour, skills, etc." className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 resize-none" />
                      </div>
                    </div>
                  </div>

                  {/* Payment Information */}
                  <div className="border-t border-white/10 pt-6">
                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2 text-primary"><Wallet className="w-5 h-5" />Payment Information</h4>
                    <div className="space-y-4">
                      <div>
                        <Label className="mb-2">Payment Method *</Label>
                        <Select
                          value={workerForm.payment_method}
                          onValueChange={(value: any) => setWorkerForm(prev => ({
                            ...prev, payment_method: value,
                            bank_name: '', bank_account_number: '', bank_account_name: '',
                            mobile_money_provider: '', mobile_money_number: '',
                            card_type: '', card_number_last4: '', card_holder_name: '', cheque_payable_to: ''
                          }))}
                        >
                          <SelectTrigger className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5">
                            <SelectValue placeholder="Select payment method..." />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods.map(method => {
                              const Icon = method.icon;
                              return (
                                <SelectItem key={method.value} value={method.value}>
                                  <div className="flex items-center gap-2"><Icon className="w-4 h-4" />{method.label}</div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      {workerForm.payment_method === 'bank_transfer' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                          <div className="sm:col-span-2">
                            <Label className="mb-2 flex items-center gap-2"><Building2 className="w-4 h-4" />Bank Name *</Label>
                            <input type="text" value={workerForm.bank_name} onChange={e => setWorkerForm(prev => ({ ...prev, bank_name: e.target.value }))} placeholder="e.g., Equity Bank, KCB" className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5" />
                          </div>
                          <div>
                            <Label className="mb-2">Account Number *</Label>
                            <input type="text" value={workerForm.bank_account_number} onChange={e => setWorkerForm(prev => ({ ...prev, bank_account_number: e.target.value }))} placeholder="Account number" className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5" />
                          </div>
                          <div>
                            <Label className="mb-2">Account Name *</Label>
                            <input type="text" value={workerForm.bank_account_name} onChange={e => setWorkerForm(prev => ({ ...prev, bank_account_name: e.target.value }))} placeholder="Name on account" className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5" />
                          </div>
                        </motion.div>
                      )}

                      {workerForm.payment_method === 'mobile_money' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                          <div>
                            <Label className="mb-2 flex items-center gap-2"><Smartphone className="w-4 h-4" />Provider *</Label>
                            <Select value={workerForm.mobile_money_provider} onValueChange={(value: any) => setWorkerForm(prev => ({ ...prev, mobile_money_provider: value }))}>
                              <SelectTrigger className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5"><SelectValue placeholder="Select provider..." /></SelectTrigger>
                              <SelectContent>{mobileMoneyProviders.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="mb-2">Phone Number *</Label>
                            <input type="tel" value={workerForm.mobile_money_number} onChange={e => setWorkerForm(prev => ({ ...prev, mobile_money_number: e.target.value }))} placeholder="+254 XXX XXX XXX" className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5" />
                          </div>
                        </motion.div>
                      )}

                      {workerForm.payment_method === 'card' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                          <div>
                            <Label className="mb-2 flex items-center gap-2"><CreditCard className="w-4 h-4" />Card Type *</Label>
                            <Select value={workerForm.card_type} onValueChange={(value: any) => setWorkerForm(prev => ({ ...prev, card_type: value }))}>
                              <SelectTrigger className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5"><SelectValue placeholder="Select card type..." /></SelectTrigger>
                              <SelectContent>{cardTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="mb-2">Last 4 Digits *</Label>
                            <input type="text" maxLength={4} value={workerForm.card_number_last4} onChange={e => setWorkerForm(prev => ({ ...prev, card_number_last4: e.target.value.replace(/\D/g, '') }))} placeholder="XXXX" className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 font-mono" />
                          </div>
                          <div className="sm:col-span-2">
                            <Label className="mb-2">Cardholder Name *</Label>
                            <input type="text" value={workerForm.card_holder_name} onChange={e => setWorkerForm(prev => ({ ...prev, card_holder_name: e.target.value }))} placeholder="Name on card" className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5" />
                          </div>
                        </motion.div>
                      )}

                      {workerForm.payment_method === 'cheque' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                          <Label className="mb-2 flex items-center gap-2"><FileText className="w-4 h-4" />Payable To *</Label>
                          <input type="text" value={workerForm.cheque_payable_to} onChange={e => setWorkerForm(prev => ({ ...prev, cheque_payable_to: e.target.value }))} placeholder="Name for cheque payment" className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5" />
                        </motion.div>
                      )}

                      <div>
                        <Label className="mb-2">Payment Notes (Optional)</Label>
                        <textarea rows={2} value={workerForm.payment_notes} onChange={e => setWorkerForm(prev => ({ ...prev, payment_notes: e.target.value }))} placeholder="Any additional payment information..." className="w-full px-4 py-3 border-2 border-white/10 rounded-xl bg-white/5 resize-none" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSaveWorker} className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all">
                    {editingWorker ? 'Update Worker' : 'Add Worker'}
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setShowAddWorker(false); resetWorkerForm(); }} className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all">
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── View Worker Details Modal ── */}
        <AnimatePresence>
          {viewingWorker && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewingWorker(null)}>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-3xl backdrop-blur-xl bg-background/95 border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold">Worker Details</h3>
                  <button onClick={() => setViewingWorker(null)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-primary"><User className="w-5 h-5" />Basic Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><p className="text-muted-foreground">Full Name</p><p className="font-semibold">{viewingWorker.full_name}</p></div>
                      <div><p className="text-muted-foreground">Role</p><p className="font-semibold capitalize">{viewingWorker.role.replace(/_/g, ' ')}</p></div>
                      <div><p className="text-muted-foreground">ID Number</p><p className="font-semibold font-mono">{viewingWorker.id_number || '-'}</p></div>
                      <div><p className="text-muted-foreground">Phone</p><p className="font-semibold">{viewingWorker.phone || '-'}</p></div>
                      <div className="col-span-2"><p className="text-muted-foreground">Address</p><p className="font-semibold">{viewingWorker.address || '-'}</p></div>
                      <div className="col-span-2"><p className="text-muted-foreground">Milestone</p><p className="font-semibold">{viewingWorker.milestone?.title || 'Not assigned'}</p></div>
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-primary"><CheckCircle className="w-5 h-5" />Assignment Summary</h4>
                    {(() => {
                      const wa = assignments.filter(a => a.worker_id === viewingWorker.id);
                      const completed = wa.filter(a => a.status === 'completed');
                      const scored = completed.filter(a => a.quality_score != null);
                      const avg = scored.length > 0 ? Math.round(scored.reduce((s, a) => s + (a.quality_score || 0), 0) / scored.length) : null;
                      return (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div><p className="text-muted-foreground">Total Assignments</p><p className="font-bold text-primary">{wa.length}</p></div>
                          <div><p className="text-muted-foreground">Completed</p><p className="font-bold text-green-400">{completed.length}</p></div>
                          <div><p className="text-muted-foreground">Avg Quality Score</p><p className={`font-bold ${getQualityColor(avg)}`}>{avg != null ? `${avg}/100` : 'Not assessed'}</p></div>
                          <div>
                            <p className="text-muted-foreground">Payroll Status</p>
                            {getPayrollBadge(avg) ? (
                              <span className={`px-2 py-1 rounded-lg text-xs font-semibold border ${getPayrollBadge(avg)!.color}`}>{getPayrollBadge(avg)!.label}</span>
                            ) : <p className="text-muted-foreground text-xs">Pending</p>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
                  {canEdit && (
                    <>
                      <button onClick={() => { setViewingWorker(null); handleEditWorker(viewingWorker); }} className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl">Edit Worker</button>
                      <button onClick={() => { setConfirmDelete(viewingWorker); setViewingWorker(null); }} className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl">Delete</button>
                    </>
                  )}
                  <button onClick={() => setViewingWorker(null)} className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl">Close</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Delete Confirmation ── */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-background border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-red-500" /></div>
                  <div><h2 className="text-xl font-bold">Delete Worker</h2><p className="text-sm text-muted-foreground">This action cannot be undone</p></div>
                </div>
                <p className="mb-6 text-muted-foreground">Are you sure you want to delete <span className="font-semibold text-foreground">{confirmDelete.full_name}</span>? This will permanently remove them from the system.</p>
                <div className="flex justify-end gap-3">
                  <button className="px-6 py-3 rounded-xl bg-background/60 border border-white/10 font-semibold hover:bg-background/80 transition" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  <button className="px-6 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition flex items-center gap-2" onClick={() => handleDeleteWorker(confirmDelete)}><Trash2 className="w-4 h-4" />Delete Worker</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Mark Attendance Modal ── */}
        <AnimatePresence>
          {showMarkAttendance && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-4xl backdrop-blur-xl bg-background/95 border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold">Mark Attendance</h3>
                    <p className="text-sm text-muted-foreground mt-1">Date: {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <button onClick={() => setShowMarkAttendance(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
                {workers.length === 0 ? (
                  <EmptyState icon={Users} title="No workers" description="Add workers before marking attendance." action="Add Worker" onAction={() => { setShowMarkAttendance(false); setShowAddWorker(true); }} />
                ) : (
                  <div className="space-y-4">
                    {workers.map(worker => (
                      <div key={worker.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border-2 border-white/10 rounded-2xl hover:bg-white/5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center font-bold text-lg">{worker.full_name.charAt(0).toUpperCase()}</div>
                          <div>
                            <p className="font-bold text-lg">{worker.full_name}</p>
                            <p className="text-sm text-muted-foreground capitalize">{worker.role.replace(/_/g, ' ')}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold">Check In:</label>
                            <input type="time" value={attendanceRecords[worker.id]?.check_in || ''} onChange={e => handleAttendanceChange(worker.id, 'check_in', e.target.value)} className="w-32 px-3 py-2 border-2 border-white/10 rounded-xl bg-white/5" />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold">Check Out:</label>
                            <input type="time" value={attendanceRecords[worker.id]?.check_out || ''} onChange={e => handleAttendanceChange(worker.id, 'check_out', e.target.value)} className="w-32 px-3 py-2 border-2 border-white/10 rounded-xl bg-white/5" />
                          </div>
                          <Select value={attendanceRecords[worker.id]?.status || 'present'} onValueChange={value => handleAttendanceChange(worker.id, 'status', value)}>
                            <SelectTrigger className="w-36 px-3 py-2 border-2 border-white/10 rounded-xl bg-white/5"><SelectValue placeholder="Status" /></SelectTrigger>
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
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSaveAttendance} className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl">Save Attendance</motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowMarkAttendance(false)} className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl">Cancel</motion.button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Assign Task / Edit Assignment Modal ── */}
        <AnimatePresence>
          {showAssignTask && (
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => { setShowAssignTask(false); resetAssignmentForm(); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-2xl backdrop-blur-xl bg-background/95 border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-2xl font-bold">
                      {editingAssignment ? 'Edit Assignment' : 'Assign Task to Worker'}
                    </h3>
                    {editingAssignment && (
                      <p className="text-xs text-amber-400/80 mt-1 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Edit mode — only status and notes are editable
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowAssignTask(false); resetAssignmentForm(); }}
                    className="p-2 hover:bg-white/10 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-5 mt-5">

                  {/* ── FIELD 1: Worker ── */}
                  <div>
                    <Label className="mb-2 text-primary font-semibold flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Worker *
                    </Label>
                    {editingAssignment ? (
                      <div className={readOnlyCls}>
                        {workers.find(w => w.id === assignmentForm.worker_id)?.full_name || assignmentForm.worker_id}
                      </div>
                    ) : (
                      <select
                        value={assignmentForm.worker_id}
                        onChange={e => setAssignmentForm(f => ({ ...f, worker_id: e.target.value }))}
                        className={inputCls}
                      >
                        <option value="" className="bg-background text-muted-foreground">Select worker…</option>
                        {workers.map(w => (
                          <option key={w.id} value={w.id} className="bg-background">
                            {w.full_name} — {w.role.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* ── FIELD 2: Milestone ── */}
                  <div>
                    <Label className="mb-2 text-primary font-semibold">Milestone</Label>
                    {editingAssignment ? (
                      <div className={readOnlyCls}>
                        {milestones.find(m => m.id === assignmentForm.milestone_id)?.title || 'No Milestone / Standalone Task'}
                      </div>
                    ) : (
                      <select
                        value={assignmentForm.milestone_id}
                        onChange={e => setAssignmentForm(f => ({ ...f, milestone_id: e.target.value }))}
                        className={inputCls}
                      >
                        <option value="" className="bg-background text-muted-foreground">No Milestone / Standalone Task</option>
                        {milestones.map(m => (
                          <option key={m.id} value={m.id} className="bg-background">{m.title}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* ── FIELD 3a: Task from milestone / FIELD 3b: Standalone task ── */}
                  {!editingAssignment && (
                    <div>
                      <Label className="mb-2 text-primary font-semibold">
                        {assignmentForm.milestone_id ? 'Task (from milestone)' : 'Standalone Task'}
                      </Label>

                      {assignmentForm.milestone_id ? (
                        // FIELD 3a
                        loadingMilestoneTasks ? (
                          <p className="text-xs text-muted-foreground px-4 py-3 rounded-xl border border-white/10 bg-white/5">
                            Loading tasks…
                          </p>
                        ) : (
                          <select
                            value={assignmentForm.task_id || ''}
                            onChange={e => handleTaskSelect(e.target.value)}
                            className={inputCls}
                          >
                            <option value="" className="bg-background text-muted-foreground">Select task (optional)…</option>
                            <option value="__custom__" className="bg-background text-muted-foreground">— None / Custom —</option>
                            {milestoneTasks.map(t => (
                              <option key={t.id} value={t.id} className="bg-background">
                                {t.title}{t.status === 'done' ? ' ✅' : ''}
                              </option>
                            ))}
                            {milestoneTasks.length === 0 && (
                              <option disabled className="bg-background text-muted-foreground">No tasks in this milestone yet</option>
                            )}
                          </select>
                        )
                      ) : (
                        // FIELD 3b — standalone tasks
                        loadingStandaloneTasks ? (
                          <p className="text-xs text-muted-foreground px-4 py-3 rounded-xl border border-white/10 bg-white/5">
                            Loading standalone tasks…
                          </p>
                        ) : (
                          <select
                            value={assignmentForm.task_id || ''}
                            onChange={e => handleTaskSelect(e.target.value)}
                            className={inputCls}
                          >
                            <option value="" className="bg-background text-muted-foreground">Select standalone task…</option>
                            <option value="__custom__" className="bg-background text-muted-foreground">— None / Custom —</option>
                            {standaloneTasks.map(t => (
                              <option key={t.id} value={t.id} className="bg-background">
                                {t.title}{t.status === 'done' ? ' ✅' : ''}
                              </option>
                            ))}
                            {standaloneTasks.length === 0 && (
                              <option disabled className="bg-background text-muted-foreground">No standalone tasks available</option>
                            )}
                          </select>
                        )
                      )}
                    </div>
                  )}

                  {/* Show locked task title in edit mode */}
                  {editingAssignment && assignmentForm.task_id && (
                    <ReadOnlyField label="Task" value={assignmentForm.task_title || assignmentForm.task_id} />
                  )}

                  {/* ── FIELD 4: Task Title (auto-populated, read-only) ── */}
                  {/* Only shown in create mode when a task is selected (not custom) */}
                  {!editingAssignment && assignmentForm.task_id && !assignmentForm.is_custom && assignmentForm.task_title && (
                    <ReadOnlyField label="Task Title" value={assignmentForm.task_title} />
                  )}

                  {/* ── FIELD 5: Task Description ── */}
                  <div>
                    <Label className="mb-2 text-primary font-semibold">
                      {assignmentForm.is_custom || (!assignmentForm.task_id && !editingAssignment) ? 'Task Description *' : 'Task Description'}
                    </Label>

                    {/* When a task is selected (not custom, not edit mode) — show locked preset + additional info */}
                    {!editingAssignment && assignmentForm.task_id && !assignmentForm.is_custom ? (
                      <div className="space-y-3">
                        {assignmentForm.preset_description && (
                          <div>
                            <div className="w-full px-4 py-3 rounded-xl text-sm bg-white/[0.03] border border-white/[0.06] text-muted-foreground cursor-not-allowed select-none whitespace-pre-wrap min-h-[60px]">
                              {assignmentForm.preset_description}
                            </div>
                            <span className="text-[10px] text-muted-foreground/60 mt-1 block flex items-center gap-1">
                              <Lock className="w-3 h-3 inline" /> Auto-filled from task — not editable
                            </span>
                          </div>
                        )}
                        <div>
                          <Label className="mb-1 text-xs text-muted-foreground">Additional Info (optional)</Label>
                          <textarea
                            rows={2}
                            maxLength={200}
                            value={assignmentForm.additional_info}
                            onChange={e => setAssignmentForm(f => ({ ...f, additional_info: e.target.value }))}
                            placeholder="Add any extra context for this specific assignment..."
                            className={`${inputCls} resize-none`}
                          />
                          <span className="text-[10px] text-muted-foreground/60 mt-1 block text-right">
                            {assignmentForm.additional_info.length}/200
                          </span>
                        </div>
                      </div>
                    ) : editingAssignment ? (
                      // Edit mode: show locked preset description + editable additional_info
                      <div className="space-y-3">
                        {assignmentForm.preset_description && (
                          <div>
                            <div className="w-full px-4 py-3 rounded-xl text-sm bg-white/[0.03] border border-white/[0.06] text-muted-foreground cursor-not-allowed select-none whitespace-pre-wrap min-h-[60px]">
                              {assignmentForm.preset_description}
                            </div>
                            <span className="text-[10px] text-muted-foreground/60 mt-1 block flex items-center gap-1">
                              <Lock className="w-3 h-3 inline" /> Original task description — not editable
                            </span>
                          </div>
                        )}
                        <div>
                          <Label className="mb-1 text-xs text-muted-foreground">Additional Info (optional)</Label>
                          <textarea
                            rows={2}
                            maxLength={200}
                            value={assignmentForm.additional_info}
                            onChange={e => setAssignmentForm(f => ({ ...f, additional_info: e.target.value }))}
                            placeholder="Add any extra context for this assignment..."
                            className={`${inputCls} resize-none`}
                          />
                        </div>
                      </div>
                    ) : (
                      // Custom / no task selected — fully editable
                      <textarea
                        rows={3}
                        value={assignmentForm.additional_info}
                        onChange={e => setAssignmentForm(f => ({ ...f, additional_info: e.target.value }))}
                        placeholder="Describe what the worker needs to do…"
                        className={`${inputCls} resize-none`}
                      />
                    )}
                  </div>

                  {/* ── FIELDS 6 & 7: Start Date & Due Date ── */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-2 text-primary font-semibold flex items-center gap-1.5">
                        {(!assignmentForm.is_custom && assignmentForm.task_id && !editingAssignment) && <Lock className="w-3 h-3 opacity-60" />}
                        Start Date
                      </Label>
                      {(!assignmentForm.is_custom && assignmentForm.task_id && !editingAssignment) ? (
                        <>
                          <div className={readOnlyCls}>{assignmentForm.start_date || '—'}</div>
                          <span className="text-[10px] text-muted-foreground/60 mt-1 block">Auto-filled from task — not editable</span>
                        </>
                      ) : (
                        <input
                          type="date"
                          value={assignmentForm.start_date}
                          onChange={e => setAssignmentForm(f => ({ ...f, start_date: e.target.value }))}
                          disabled={editingAssignment !== null}
                          className={editingAssignment ? readOnlyCls : inputCls}
                        />
                      )}
                    </div>
                    <div>
                      <Label className="mb-2 text-primary font-semibold flex items-center gap-1.5">
                        {(!assignmentForm.is_custom && assignmentForm.task_id && !editingAssignment) && <Lock className="w-3 h-3 opacity-60" />}
                        Due Date
                      </Label>
                      {(!assignmentForm.is_custom && assignmentForm.task_id && !editingAssignment) ? (
                        <>
                          <div className={readOnlyCls}>{assignmentForm.due_date || '—'}</div>
                          <span className="text-[10px] text-muted-foreground/60 mt-1 block">Auto-filled from task — not editable</span>
                        </>
                      ) : (
                        <input
                          type="date"
                          value={assignmentForm.due_date}
                          min={assignmentForm.start_date || undefined}
                          onChange={e => setAssignmentForm(f => ({ ...f, due_date: e.target.value }))}
                          disabled={editingAssignment !== null}
                          className={editingAssignment ? readOnlyCls : inputCls}
                        />
                      )}
                    </div>
                  </div>

                  {/* ── FIELD 8: Assignment Status ── */}
                  <div>
                    <Label className="mb-2 text-primary font-semibold">Assignment Status</Label>
                    <select
                      value={assignmentForm.status}
                      onChange={e => setAssignmentForm(f => ({ ...f, status: e.target.value as any }))}
                      className={inputCls}
                    >
                      <option value="assigned" className="bg-background">Assigned</option>
                      <option value="in_progress" className="bg-background">In Progress</option>
                      <option value="completed" className="bg-background">Completed</option>
                      <option value="on_hold" className="bg-background">On Hold</option>
                    </select>
                    {assignmentForm.status === 'completed' && assignmentForm.task_id && (
                      <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Marking as completed will also mark the linked task as done, contributing to milestone progress.
                      </p>
                    )}
                  </div>

                  {/* ── FIELD 9: Notes ── */}
                  <div>
                    <Label className="mb-2 text-primary font-semibold">Notes</Label>
                    <textarea
                      rows={2}
                      value={assignmentForm.notes}
                      onChange={e => setAssignmentForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Additional notes or instructions…"
                      className={`${inputCls} resize-none`}
                    />
                  </div>

                </div>

                {/* Footer */}
                <div className="flex gap-3 mt-6 pt-6 border-t border-white/10">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSaveAssignment}
                    className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all"
                  >
                    {editingAssignment ? 'Update Assignment' : 'Assign Task'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setShowAssignTask(false); resetAssignmentForm(); }}
                    className="px-6 py-3 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Quality Score Modal ── */}
        <AnimatePresence>
          {qualityModalAssignment && (
            <QualityScoreModal
              assignment={qualityModalAssignment}
              worker={workers.find(w => w.id === qualityModalAssignment.worker_id)}
              onClose={() => setQualityModalAssignment(null)}
              onSave={handleSaveQualityScore}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Floating Toasts */}
      <div className="fixed bottom-6 right-6 z-[9999] space-y-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <ToastNotification key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
};

export default WorkersTab;