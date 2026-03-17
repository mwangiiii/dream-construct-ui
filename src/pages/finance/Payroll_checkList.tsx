"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Project {
  id: string;
  project_number: string;
  title: string;
  description: string | null;
  status: string | null;
  progress_percent: number | null;
  budget_numeric: number | null;
  currency: string | null;
  site_address: string | null;
  site_city: string | null;
  site_country: string | null;
  start_date: string | null;
  expected_completion_date: string | null;
  created_at: string;
}

interface Worker {
  id: string;
  full_name: string;
  role?: string | null;
  phone?: string | null;
}

type PaymentStatus = "Paid" | "Unpaid" | "Pending" | "Overdue";
type RateType = "Per Hour" | "Per Week" | "Per Month";

interface PayrollEntry {
  id: number;
  project_id: string | null;
  job_id: string;
  employee_name: string;
  worker_id: string | null;
  rate: number;
  rate_type: RateType;
  time_worked: string;
  gross_pay: number;
  nssf_tier1: number;
  nssf_tier2: number;
  nssf_total: number;
  shif: number;
  housing_levy: number;
  pension: number;
  taxable_income: number;
  paye_gross_tax: number;
  personal_relief: number;
  insurance_relief: number;
  paye_net: number;
  total_deductions: number;
  net_pay: number;
  due_date: string | null;
  paid_date: string | null;
  payment_status: PaymentStatus;
  bank_code: string | null;
  serial_no: string | null;
  etims_code: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

type PayrollFormData = Omit<PayrollEntry, "id" | "created_at" | "updated_at">;

interface Props {
  projectId?: string;
  canEdit?: boolean;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CURRENCY = "KES";
const PAYMENT_STATUSES: PaymentStatus[] = ["Paid", "Unpaid", "Pending", "Overdue"];
const RATE_TYPES: RateType[] = ["Per Hour", "Per Week", "Per Month"];

const STATUS_STYLE: Record<PaymentStatus, { accent: string; badge: string; dot: string; row: string; glow: string }> = {
  Paid:    { accent: "text-emerald-400", badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", dot: "bg-emerald-400", row: "hover:bg-emerald-950/20", glow: "shadow-emerald-500/10" },
  Unpaid:  { accent: "text-rose-400",    badge: "bg-rose-500/10 border-rose-500/30 text-rose-300",          dot: "bg-rose-400",    row: "hover:bg-rose-950/20",    glow: "shadow-rose-500/10"    },
  Pending: { accent: "text-amber-400",   badge: "bg-amber-500/10 border-amber-500/30 text-amber-300",       dot: "bg-amber-400",   row: "hover:bg-amber-950/20",   glow: "shadow-amber-500/10"   },
  Overdue: { accent: "text-orange-400",  badge: "bg-orange-500/10 border-orange-500/30 text-orange-300",    dot: "bg-orange-400",  row: "hover:bg-orange-950/20",  glow: "shadow-orange-500/10"  },
};

const PROJECT_STATUS_STYLE: Record<string, string> = {
  planning:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  on_hold:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const makeEmptyProjectForm = (projectId: string): PayrollFormData => ({
  project_id: projectId,
  job_id: "",
  worker_id: null,
  employee_name: "",
  rate: 0,
  rate_type: "Per Month",
  time_worked: "1 month",
  gross_pay: 0,
  nssf_tier1: 0, nssf_tier2: 0, nssf_total: 0,
  shif: 0, housing_levy: 0, pension: 0,
  taxable_income: 0, paye_gross_tax: 0,
  personal_relief: 2400, insurance_relief: 0,
  paye_net: 0, total_deductions: 0, net_pay: 0,
  due_date: new Date().toISOString().slice(0, 10),
  paid_date: null, bank_code: null, serial_no: null,
  etims_code: null, payment_status: "Unpaid", notes: null,
});

const makeEmptyGlobalForm = (): PayrollFormData => ({
  project_id: null,
  job_id: "",
  worker_id: null,
  employee_name: "",
  rate: 0,
  rate_type: "Per Month",
  time_worked: "1 month",
  gross_pay: 0,
  nssf_tier1: 0, nssf_tier2: 0, nssf_total: 0,
  shif: 0, housing_levy: 0, pension: 0,
  taxable_income: 0, paye_gross_tax: 0,
  personal_relief: 2400, insurance_relief: 0,
  paye_net: 0, total_deductions: 0, net_pay: 0,
  due_date: new Date().toISOString().slice(0, 10),
  paid_date: null, bank_code: null, serial_no: null,
  etims_code: null, payment_status: "Unpaid", notes: null,
});

// Reverse-derive the raw insurance premium from the stored relief value
// relief = min(premium * 0.15, 5000)  →  premium = relief / 0.15  (when relief < 5000)
const derivePremiumFromRelief = (relief: number): number =>
  relief > 0 ? +(relief / 0.15).toFixed(2) : 0;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined) => {
  const safe = typeof n === "number" && isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-KE", {
    style: "currency", currency: CURRENCY,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(safe);
};

const n0 = (v: number | null | undefined): number =>
  typeof v === "number" && isFinite(v) ? v : 0;

const fmtC = (n: number | null | undefined) => {
  const safe = typeof n === "number" && isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-KE", { notation: "compact", maximumFractionDigits: 1 }).format(safe);
};

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-KE", {
    day: "2-digit", month: "short", year: "numeric",
  }) : "—";

const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-KE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "—";

function sanitizeEntry(raw: PayrollEntry): PayrollEntry {
  const gross = n0(raw.gross_pay);
  const hasCalc = n0(raw.nssf_total) > 0 || n0(raw.net_pay) > 0 || gross === 0;
  if (hasCalc) {
    return {
      ...raw,
      gross_pay: gross,
      nssf_tier1: n0(raw.nssf_tier1), nssf_tier2: n0(raw.nssf_tier2),
      nssf_total: n0(raw.nssf_total), shif: n0(raw.shif),
      housing_levy: n0(raw.housing_levy), pension: n0(raw.pension),
      taxable_income: n0(raw.taxable_income), paye_gross_tax: n0(raw.paye_gross_tax),
      personal_relief: n0(raw.personal_relief) || 2400,
      insurance_relief: n0(raw.insurance_relief), paye_net: n0(raw.paye_net),
      total_deductions: n0(raw.total_deductions), net_pay: n0(raw.net_pay),
      rate: n0(raw.rate),
    };
  }
  const pension = n0(raw.pension);
  const insurancePremium = derivePremiumFromRelief(n0(raw.insurance_relief));
  const calc = calculateKenyaPayroll(gross, pension, insurancePremium);
  return { ...raw, gross_pay: gross, ...calc, pension, rate: n0(raw.rate) };
}

// ─── KENYA STATUTORY PAYROLL CALCULATOR ──────────────────────────────────────
interface KenyaPayrollResult {
  nssf_tier1: number; nssf_tier2: number; nssf_total: number;
  shif: number; housing_levy: number; taxable_income: number;
  paye_gross_tax: number; personal_relief: number; insurance_relief: number;
  paye_net: number; total_deductions: number; net_pay: number;
  effective_tax_rate: number;
}

function calculateKenyaPayroll(grossPay: number, pensionContrib = 0, insurancePremium = 0): KenyaPayrollResult {
  const gross = Math.max(grossPay, 0);
  const nssfTier1 = +(Math.min(gross, 9_000) * 0.06).toFixed(2);
  const nssfTier2 = gross > 9_000 ? +(Math.min(gross - 9_000, 99_000) * 0.06).toFixed(2) : 0;
  const nssfTotal = +(nssfTier1 + nssfTier2).toFixed(2);
  const shif = +Math.max(gross * 0.0275, 300).toFixed(2);
  const housingLevy = +(gross * 0.015).toFixed(2);
  const pension = +Math.min(Math.max(pensionContrib, 0), 30_000).toFixed(2);
  const taxableIncome = +Math.max(gross - nssfTotal - shif - housingLevy - pension, 0).toFixed(2);
  let payeGrossTax = 0;
  let rem = taxableIncome;
  const bands = [
    { limit: 24_000, rate: 0.10 }, { limit: 8_333, rate: 0.25 },
    { limit: 467_667, rate: 0.30 }, { limit: 300_000, rate: 0.325 },
    { limit: Infinity, rate: 0.35 },
  ];
  for (const band of bands) {
    if (rem <= 0) break;
    const taxable = band.limit === Infinity ? rem : Math.min(rem, band.limit);
    payeGrossTax += taxable * band.rate;
    rem -= taxable;
  }
  payeGrossTax = +payeGrossTax.toFixed(2);
  const personalRelief = 2_400;
  const insuranceRelief = +Math.min(insurancePremium * 0.15, 5_000).toFixed(2);
  const payeNet = +Math.max(payeGrossTax - personalRelief - insuranceRelief, 0).toFixed(2);
  const totalDeductions = +(nssfTotal + shif + housingLevy + pension + payeNet).toFixed(2);
  const netPay = +(gross - totalDeductions).toFixed(2);
  const effectiveTaxRate = gross > 0 ? +((totalDeductions / gross) * 100).toFixed(1) : 0;
  return {
    nssf_tier1: nssfTier1, nssf_tier2: nssfTier2, nssf_total: nssfTotal,
    shif, housing_levy: housingLevy, taxable_income: taxableIncome,
    paye_gross_tax: payeGrossTax, personal_relief: personalRelief,
    insurance_relief: insuranceRelief, paye_net: payeNet,
    total_deductions: totalDeductions, net_pay: netPay,
    effective_tax_rate: effectiveTaxRate,
  };
}

function parseTimeWorked(timeStr: string): number {
  const lower = timeStr.toLowerCase().trim();
  if (!lower) return 0;
  const match = lower.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 1;
}

function computeGrossFromRate(rate: number, _rateType: RateType, timeWorked: string): number {
  return +(rate * parseTimeWorked(timeWorked)).toFixed(2);
}

function toWritable(form: PayrollFormData): PayrollFormData {
  const {
    project_id, job_id, worker_id, employee_name, rate, rate_type, time_worked,
    gross_pay, nssf_tier1, nssf_tier2, nssf_total, shif, housing_levy, pension,
    taxable_income, paye_gross_tax, personal_relief, insurance_relief, paye_net,
    total_deductions, net_pay, due_date, paid_date, bank_code, serial_no,
    etims_code, payment_status, notes,
  } = form;
  return {
    project_id, job_id, worker_id, employee_name, rate, rate_type, time_worked,
    gross_pay, nssf_tier1, nssf_tier2, nssf_total, shif, housing_levy, pension,
    taxable_income, paye_gross_tax, personal_relief, insurance_relief, paye_net,
    total_deductions, net_pay, due_date, paid_date, bank_code, serial_no,
    etims_code, payment_status, notes,
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────
const api = {
  async projects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,currency,site_address,site_city,site_country,start_date,expected_completion_date,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Project[];
  },

  async workersForProject(projectId: string): Promise<Worker[]> {
    const { data, error } = await supabase
      .from("worker_assignments")
      .select("workers(id, full_name, role, phone)")
      .eq("project_id", projectId);
    if (error) return [];
    const seen = new Set<string>();
    const workers: Worker[] = [];
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const w = row.workers as { id: string; full_name: string; role?: string | null; phone?: string | null } | null;
      if (w && !seen.has(w.id)) {
        seen.add(w.id);
        workers.push({ id: w.id, full_name: w.full_name, role: w.role, phone: w.phone });
      }
    }
    return workers.sort((a, b) => a.full_name.localeCompare(b.full_name));
  },

  async allWorkers(): Promise<Worker[]> {
    const { data, error } = await supabase
      .from("workers")
      .select("id, full_name, role, phone")
      .eq("status", "active")
      .order("full_name", { ascending: true });
    if (error) return [];
    return (data ?? []) as Worker[];
  },

  async list(projectId: string): Promise<PayrollEntry[]> {
    const { data, error } = await supabase
      .from("payroll_checklist")
      .select("*")
      .eq("project_id", projectId)
      .order("due_date", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as PayrollEntry[]).map(sanitizeEntry);
  },

  async listAll(): Promise<PayrollEntry[]> {
    const { data, error } = await supabase
      .from("payroll_checklist")
      .select("*")
      .order("due_date", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as PayrollEntry[]).map(sanitizeEntry);
  },

  async create(form: PayrollFormData): Promise<PayrollEntry> {
    const writable = toWritable(form);
    const payload = { ...writable, project_id: writable.project_id ?? null };
    const { data, error } = await supabase
      .from("payroll_checklist")
      .insert([payload])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return sanitizeEntry(data as PayrollEntry);
  },

  async update(id: number, form: PayrollFormData): Promise<PayrollEntry> {
    const { data, error } = await supabase
      .from("payroll_checklist")
      .update({ ...toWritable(form), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return sanitizeEntry(data as PayrollEntry);
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase.from("payroll_checklist").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);
  const push = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);
  return { toasts, push };
}

function ToastStack({ toasts }: { toasts: { id: number; msg: string; type: "success" | "error" }[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-semibold border backdrop-blur-xl shadow-lg ${
              t.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/25 text-emerald-300"
                : "bg-rose-950/90 border-rose-500/25 text-rose-300"
            }`}>{t.msg}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all";

const selectCls =
  "w-full px-3 py-2.5 rounded-xl text-sm border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all appearance-none pr-9 " +
  "bg-[#111318] border-white/10 [color-scheme:dark]";

const SelectChevron = () => (
  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  </span>
);

function Field({ label, children, className = "", hint }: {
  label: string; children: React.ReactNode; className?: string; hint?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{label}</label>
      {children}
      {hint && <span className="text-[9px] text-muted-foreground/60 leading-tight">{hint}</span>}
    </div>
  );
}

function SectionLabel({ label, dotColor, textColor, sub }: {
  label: string; dotColor: string; textColor: string; sub?: string;
}) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-1">
      <span className={`w-1.5 h-5 rounded-full ${dotColor} flex-shrink-0`} />
      <div>
        <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${textColor}`}>{label}</span>
        {sub && <span className="ml-2 text-[9px] text-muted-foreground/60 tracking-wide">{sub}</span>}
      </div>
      <div className="flex-1 h-px bg-white/8" />
    </div>
  );
}

// ─── PAYSLIP BREAKDOWN CARD ───────────────────────────────────────────────────
function PayslipBreakdown({ gross, computed, pension }: {
  gross: number; computed: KenyaPayrollResult; pension: number;
}) {
  const deductionItems = [
    { label: "NSSF Tier I",        sublabel: "6% of min(gross, KES 9,000)",            value: computed.nssf_tier1,   color: "bg-blue-400",   textColor: "text-blue-300"   },
    { label: "NSSF Tier II",       sublabel: "6% of (gross − 9,000) up to KES 99,000", value: computed.nssf_tier2,   color: "bg-blue-500",   textColor: "text-blue-300"   },
    { label: "SHIF",               sublabel: "2.75% gross (min KES 300)",               value: computed.shif,         color: "bg-purple-500", textColor: "text-purple-300" },
    { label: "Housing Levy (AHL)", sublabel: "1.5% of gross",                           value: computed.housing_levy, color: "bg-amber-500",  textColor: "text-amber-300"  },
    { label: "Pension",            sublabel: "Employee contrib. (max KES 30,000)",      value: pension,               color: "bg-sky-500",    textColor: "text-sky-300"    },
    { label: "PAYE (Net)",         sublabel: "After personal + insurance relief",       value: computed.paye_net,     color: "bg-rose-500",   textColor: "text-rose-300"   },
  ];
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden w-full max-w-full">
      <div className="px-5 pt-5 pb-4 border-b border-white/8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Gross Pay</p>
            <p className="text-3xl font-black tabular-nums tracking-tighter text-foreground mt-0.5">{fmt(gross)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Effective rate</p>
            <p className="text-lg font-bold text-rose-400 tabular-nums">{computed.effective_tax_rate}%</p>
          </div>
        </div>
        <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden flex">
          <div className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-500"
            style={{ width: `${gross > 0 ? (computed.total_deductions / gross) * 100 : 0}%` }} />
          <div className="h-full bg-emerald-500 flex-1 transition-all duration-500" />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-rose-400">Deductions {fmt(computed.total_deductions)}</span>
          <span className="text-[9px] text-emerald-400">Net {fmt(computed.net_pay)}</span>
        </div>
      </div>
      <div className="px-5 py-3 space-y-2.5">
        {deductionItems.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${item.color} flex-shrink-0`} />
                <span className="text-[11px] font-semibold text-foreground/90">{item.label}</span>
              </div>
              <span className={`text-[11px] font-mono font-bold ${item.textColor}`}>{fmt(item.value)}</span>
            </div>
            <div className="ml-3.5 flex items-center gap-2">
              <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
                <div className={`h-full ${item.color} transition-all duration-500`}
                  style={{ width: `${gross > 0 ? Math.min((item.value / gross) * 100, 100) : 0}%` }} />
              </div>
              <span className="text-[9px] text-muted-foreground/50 w-8 text-right">
                {gross > 0 ? ((item.value / gross) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mx-5 mb-4 mt-1 rounded-xl bg-rose-950/30 border border-rose-500/15 px-4 py-3 space-y-1.5 text-[10px]">
        <p className="font-bold uppercase tracking-widest text-rose-400 mb-2">PAYE Detail</p>
        <div className="flex justify-between"><span className="text-muted-foreground">Taxable Income</span><span className="font-mono text-foreground">{fmt(computed.taxable_income)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">PAYE Gross Tax</span><span className="font-mono text-foreground">{fmt(computed.paye_gross_tax)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Less: Personal Relief</span><span className="font-mono text-emerald-400">− {fmt(computed.personal_relief)}</span></div>
        {computed.insurance_relief > 0 && (
          <div className="flex justify-between"><span className="text-muted-foreground">Less: Insurance Relief</span><span className="font-mono text-emerald-400">− {fmt(computed.insurance_relief)}</span></div>
        )}
        <div className="border-t border-rose-500/20 pt-1.5 flex justify-between font-bold">
          <span className="text-rose-300">PAYE Net Payable</span>
          <span className="font-mono text-rose-300">{fmt(computed.paye_net)}</span>
        </div>
      </div>
      <div className="px-5 py-4 bg-emerald-950/30 border-t border-emerald-500/15">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Take-home (Net Pay)</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">KRA / NSSF / SHIF / AHL compliant · 2026</p>
          </div>
          <p className="text-4xl font-black tabular-nums tracking-tighter text-emerald-400">{fmt(computed.net_pay)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── SHARED PAYROLL FORM FIELDS ───────────────────────────────────────────────
// Extracted so both modals share identical pay/deduction/payment field rendering.
// insurancePremium / setInsurancePremium are owned by the parent modal — this is
// the fix for the self-erasing bug: the raw premium lives in separate local state
// and is never overwritten by the computed-sync useEffect.
function PayrollFormFields({
  form, set, insurancePremium, setInsurancePremium,
}: {
  form: PayrollFormData;
  set: <K extends keyof PayrollFormData>(k: K, v: PayrollFormData[K]) => void;
  insurancePremium: number;
  setInsurancePremium: (v: number) => void;
}) {
  const timeWorkedPlaceholder =
    form.rate_type === "Per Hour" ? "e.g. 160 (hours)"
    : form.rate_type === "Per Week" ? "e.g. 4 (weeks)"
    : "e.g. 1 (month)";

  return (
    <>
      {/* Pay Rate */}
      <SectionLabel label="Pay Rate" dotColor="bg-violet-400" textColor="text-violet-400" sub="Gross auto-calculated from rate × time" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="Rate (KES) *" hint="Amount per unit of time">
          <input type="number" step="0.01" min="0" value={form.rate || ""}
            onChange={(e) => set("rate", parseFloat(e.target.value) || 0)}
            className={inputCls} placeholder="0.00" />
        </Field>
        <Field label="Rate Type *">
          <div className="flex gap-1 h-10 rounded-xl bg-white/5 border border-white/10 p-1">
            {RATE_TYPES.map((rt) => (
              <button key={rt} type="button" onClick={() => set("rate_type", rt)}
                className={`flex-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                  form.rate_type === rt
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-white/10 text-muted-foreground"
                }`}>{rt.replace("Per ", "")}</button>
            ))}
          </div>
        </Field>
        <Field label="Time Worked *" hint={timeWorkedPlaceholder}>
          <input value={form.time_worked} onChange={(e) => set("time_worked", e.target.value)}
            placeholder={timeWorkedPlaceholder} className={inputCls} />
        </Field>
      </div>

      <Field label="Gross Pay (KES) *" hint="Auto-calculated or enter manually">
        <div className="relative">
          <input type="number" step="0.01" min="0" value={form.gross_pay || ""}
            onChange={(e) => set("gross_pay", parseFloat(e.target.value) || 0)}
            className={inputCls + " pr-16 font-bold text-base"} placeholder="0.00" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">KES</span>
        </div>
      </Field>

      {/* Voluntary Deductions */}
      <SectionLabel label="Voluntary Deductions" dotColor="bg-sky-400" textColor="text-sky-400" sub="Tax-deductible; updates live" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Pension Contribution (KES)" hint="Max KES 30,000 p.m. (tax exempt)">
          <input type="number" step="0.01" min="0" max="30000"
            value={form.pension || ""}
            onChange={(e) => set("pension", Math.min(parseFloat(e.target.value) || 0, 30_000))}
            placeholder="0.00" className={inputCls} />
        </Field>

        {/* ── Fixed field: raw premium in its own state, never clobbered by computed sync ── */}
        <Field label="Annual Insurance Premium (KES)" hint="Relief = 15% of premium, max KES 5,000 p.m.">
          <input
            type="number"
            step="0.01"
            min="0"
            value={insurancePremium || ""}
            onChange={(e) => setInsurancePremium(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className={inputCls}
          />
          {insurancePremium > 0 && (
            <span className="text-[9px] text-emerald-400/80 mt-0.5">
              Relief: {fmt(Math.min(insurancePremium * 0.15, 5_000))}
            </span>
          )}
        </Field>
      </div>

      {/* Payment & References */}
      <SectionLabel label="Payment & References" dotColor="bg-rose-400" textColor="text-rose-400" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="Due Date">
          <input type="date" value={form.due_date ?? ""}
            onChange={(e) => set("due_date", e.target.value || null)}
            className={inputCls + " [color-scheme:dark]"} />
        </Field>
        <Field label="Paid Date">
          <input type="date" value={form.paid_date ?? ""}
            onChange={(e) => set("paid_date", e.target.value || null)}
            className={inputCls + " [color-scheme:dark]"} />
        </Field>
        <Field label="Payment Status *">
          <div className="relative">
            <select value={form.payment_status}
              onChange={(e) => set("payment_status", e.target.value as PaymentStatus)}
              className={selectCls}>
              {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <SelectChevron />
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="Bank Code">
          <input value={form.bank_code ?? ""} onChange={(e) => set("bank_code", e.target.value || null)}
            placeholder="e.g. 1002" className={inputCls} />
        </Field>
        <Field label="Serial No.">
          <input value={form.serial_no ?? ""} onChange={(e) => set("serial_no", e.target.value || null)}
            placeholder="S-1001" className={inputCls} />
        </Field>
        <Field label="eTIMS Code">
          <input value={form.etims_code ?? ""} onChange={(e) => set("etims_code", e.target.value || null)}
            placeholder="ETIMS-55555" className={inputCls} />
        </Field>
      </div>

      <Field label="Notes">
        <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)}
          rows={2} placeholder="Additional remarks…" className={inputCls + " resize-none"} />
      </Field>
    </>
  );
}

// ─── SHARED MODAL COMPUTED SYNC HOOK ─────────────────────────────────────────
// Centralises the useEffect logic that syncs calculator output back into form state.
// Crucially, insurance_relief IS included here (it's a computed output from the
// calculator, not a user-typed input), but the raw premium that DRIVES it lives
// separately in insurancePremium state — so there is no feedback loop.
function usePayrollSync(
  form: PayrollFormData,
  setForm: React.Dispatch<React.SetStateAction<PayrollFormData>>,
  insurancePremium: number,
) {
  // Auto-compute gross from rate × time
  useEffect(() => {
    if (form.rate <= 0) return;
    const calcGross = computeGrossFromRate(form.rate, form.rate_type, form.time_worked);
    if (Math.abs(calcGross - form.gross_pay) > 0.005)
      setForm((p) => ({ ...p, gross_pay: calcGross }));
  }, [form.rate, form.rate_type, form.time_worked]); // eslint-disable-line react-hooks/exhaustive-deps

  const computed = useMemo(
    () => calculateKenyaPayroll(form.gross_pay, form.pension, insurancePremium),
    [form.gross_pay, form.pension, insurancePremium],
  );

  // Sync all statutory outputs back into form — including insurance_relief (computed output).
  // The raw premium input field uses its own `insurancePremium` state so it is never touched here.
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      nssf_tier1: computed.nssf_tier1,
      nssf_tier2: computed.nssf_tier2,
      nssf_total: computed.nssf_total,
      shif: computed.shif,
      housing_levy: computed.housing_levy,
      taxable_income: computed.taxable_income,
      paye_gross_tax: computed.paye_gross_tax,
      personal_relief: computed.personal_relief,
      insurance_relief: computed.insurance_relief, // ← computed output, safe to sync
      paye_net: computed.paye_net,
      total_deductions: computed.total_deductions,
      net_pay: computed.net_pay,
    }));
  }, [computed]); // eslint-disable-line react-hooks/exhaustive-deps

  return computed;
}

// ─── PROJECT ENTRY MODAL ──────────────────────────────────────────────────────
function ProjectEntryModal({
  initial, projectWorkers, onSave, onClose, loading,
}: {
  initial: PayrollFormData & { id?: number; updated_at?: string };
  projectWorkers: Worker[];
  onSave: (d: PayrollFormData) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<PayrollFormData>({ ...initial });
  const isEdit = Boolean(initial.id);

  // Raw insurance premium in its own state — NOT derived from form.insurance_relief
  // on every render, only initialised once from the stored relief value.
  const [insurancePremium, setInsurancePremium] = useState<number>(
    () => derivePremiumFromRelief(initial.insurance_relief),
  );

  const set = <K extends keyof PayrollFormData>(k: K, v: PayrollFormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const computed = usePayrollSync(form, setForm, insurancePremium);

  const handleWorkerSelect = (workerId: string) => {
    const worker = projectWorkers.find((w) => w.id === workerId);
    if (!worker) {
      set("worker_id", null);
      set("employee_name", "");
      set("job_id", "");
      return;
    }
    set("worker_id", workerId);
    set("employee_name", worker.full_name);
    if (!isEdit) {
      const nameSlug = worker.full_name.replace(/\s+/g, "").slice(0, 3).toUpperCase();
      const idSlug = workerId.slice(0, 4).toUpperCase();
      set("job_id", `${nameSlug}-${idSlug}`);
    }
  };

  const hasWorkers = projectWorkers.length > 0;
  const isValid = form.worker_id != null && form.employee_name.trim() !== "" && form.gross_pay > 0;
  const lastUpdatedDisplay = isEdit
    ? fmtDateTime(initial.updated_at ?? new Date().toISOString())
    : fmtDateTime(new Date().toISOString());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4">
      <motion.div className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-5xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl bg-[#0d0d0d]/95 mx-2"
        initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }} transition={{ duration: 0.22, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <span className="text-base">🇰🇪</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">
                {isEdit ? "Edit Payroll Entry" : "New Project Payroll Entry"}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                Select a worker assigned to this project · Kenya statutory calculations applied automatically
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold">Last Updated</p>
              <p className="text-[10px] font-mono text-muted-foreground">{lastUpdatedDisplay}</p>
            </div>
            <button onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-xl hover:bg-white/10">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-5 max-h-[76vh] overflow-y-auto w-full">
          <div className="lg:col-span-3 px-2 sm:px-6 py-5 space-y-4 border-r border-white/8 min-w-0">

            {/* Worker select */}
            <SectionLabel label="Employee" dotColor="bg-sky-400" textColor="text-sky-400"
              sub={hasWorkers ? `${projectWorkers.length} workers assigned to this project` : "No workers assigned"} />

            {hasWorkers ? (
              <Field label="Select Worker *" hint="Only workers assigned to this project via worker_assignments are listed">
                <div className="relative">
                  <select
                    value={form.worker_id ?? ""}
                    onChange={(e) => handleWorkerSelect(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">— Select worker —</option>
                    {projectWorkers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.full_name}{w.role ? ` · ${w.role}` : ""}
                      </option>
                    ))}
                    {isEdit && form.worker_id && !projectWorkers.find((w) => w.id === form.worker_id) && (
                      <option value={form.worker_id}>{form.employee_name} (saved — no longer assigned)</option>
                    )}
                  </select>
                  <SelectChevron />
                </div>
                {form.employee_name && (
                  <p className="text-[10px] text-emerald-400/80 mt-1">
                    ✓ {form.employee_name}{form.job_id ? ` · Ref: ${form.job_id}` : ""}
                  </p>
                )}
              </Field>
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-300">
                No workers are currently assigned to this project. Please assign workers via Project Management first.
              </div>
            )}

            <PayrollFormFields
              form={form}
              set={set}
              insurancePremium={insurancePremium}
              setInsurancePremium={setInsurancePremium}
            />

            <Field label="Last Updated" hint="Auto-filled — cannot be changed manually">
              <div className={inputCls + " cursor-not-allowed opacity-60 font-mono text-xs select-none bg-white/3"}>
                {lastUpdatedDisplay}
              </div>
            </Field>
          </div>

          {/* Live Payslip */}
          <div className="lg:col-span-2 px-2 sm:px-5 py-5 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-3">Live Payslip Preview</p>
            <PayslipBreakdown gross={form.gross_pay} computed={computed} pension={form.pension} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
            Cancel
          </button>
          <button onClick={() => onSave(form)} disabled={loading || !isValid}
            className="px-6 py-2.5 text-sm font-bold rounded-2xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEdit ? "Save Changes" : "Add Entry"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── GLOBAL ENTRY MODAL ───────────────────────────────────────────────────────
function GlobalEntryModal({
  initial, projects, allWorkers, onSave, onClose, loading,
}: {
  initial: PayrollFormData & { id?: number; updated_at?: string };
  projects?: Project[];
  allWorkers?: Worker[];
  onSave: (d: PayrollFormData) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<PayrollFormData>({ ...initial });
  const isEdit = Boolean(initial.id);

  // Raw insurance premium — separate state, never overwritten by computed sync
  const [insurancePremium, setInsurancePremium] = useState<number>(
    () => derivePremiumFromRelief(initial.insurance_relief),
  );

  const [dynamicProjectWorkers, setDynamicProjectWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);

  const set = <K extends keyof PayrollFormData>(k: K, v: PayrollFormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const computed = usePayrollSync(form, setForm, insurancePremium);

  useEffect(() => {
    if (!form.project_id) { setDynamicProjectWorkers([]); return; }
    setLoadingWorkers(true);
    api.workersForProject(form.project_id)
      .then(setDynamicProjectWorkers)
      .finally(() => setLoadingWorkers(false));
  }, [form.project_id]);

  const workerList: Worker[] = form.project_id && dynamicProjectWorkers.length > 0
    ? dynamicProjectWorkers
    : (allWorkers ?? []);

  const hasWorkers = workerList.length > 0;
  const isValid = form.job_id.trim() !== "" && form.employee_name.trim() !== "" && form.gross_pay > 0;
  const lastUpdatedDisplay = isEdit
    ? fmtDateTime(initial.updated_at ?? new Date().toISOString())
    : fmtDateTime(new Date().toISOString());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4">
      <motion.div className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-5xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl bg-[#0d0d0d]/95 mx-2"
        initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }} transition={{ duration: 0.22, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <span className="text-base">🇰🇪</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">
                {isEdit ? "Edit Payroll Entry" : "New Company Payroll Entry"}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                Company-wide entry — project link is optional
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold">Last Updated</p>
              <p className="text-[10px] font-mono text-muted-foreground">{lastUpdatedDisplay}</p>
            </div>
            <button onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-xl hover:bg-white/10">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 max-h-[76vh] overflow-y-auto w-full">
          <div className="lg:col-span-3 px-2 sm:px-6 py-5 space-y-4 border-r border-white/8 min-w-0">

            {/* Project link */}
            {projects && (
              <>
                <SectionLabel label="Link to Project" dotColor="bg-primary/50" textColor="text-primary/70"
                  sub="Optional — leave blank for company-wide entry" />
                <Field label="Project (optional)"
                  hint="Selecting a project filters the employee dropdown to that project's workers">
                  <div className="relative">
                    <select
                      value={form.project_id ?? ""}
                      onChange={(e) => {
                        set("project_id", e.target.value || null);
                        set("employee_name", "");
                        set("worker_id", null);
                      }}
                      className={selectCls}
                    >
                      <option value="">— No project (company-wide entry) —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.project_number} · {p.title}</option>
                      ))}
                    </select>
                    <SelectChevron />
                  </div>
                  {form.project_id && loadingWorkers && (
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <span className="w-2.5 h-2.5 border border-white/20 border-t-primary rounded-full animate-spin inline-block" />
                      Loading project workers…
                    </p>
                  )}
                  {form.project_id && !loadingWorkers && dynamicProjectWorkers.length > 0 && (
                    <p className="text-[10px] text-emerald-400/80 mt-1">
                      ✓ {dynamicProjectWorkers.length} workers found for this project
                    </p>
                  )}
                  {form.project_id && !loadingWorkers && dynamicProjectWorkers.length === 0 && (
                    <p className="text-[10px] text-amber-400/80 mt-1">
                      No assigned workers found — showing all active company workers
                    </p>
                  )}
                </Field>
              </>
            )}

            {/* Employee details */}
            <SectionLabel label="Employee Details" dotColor="bg-sky-400" textColor="text-sky-400" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Job ID *">
                <input value={form.job_id} onChange={(e) => set("job_id", e.target.value)}
                  placeholder="J-001" className={inputCls} />
              </Field>
              <Field
                label="Employee Name *"
                hint={
                  hasWorkers
                    ? form.project_id
                      ? `${workerList.length} workers assigned to selected project`
                      : `${workerList.length} active company workers`
                    : "No workers found — enter name manually"
                }
              >
                {hasWorkers ? (
                  <div className="relative">
                    <select
                      value={form.employee_name}
                      onChange={(e) => set("employee_name", e.target.value)}
                      className={selectCls}
                    >
                      <option value="">— Select employee —</option>
                      {workerList.map((w) => (
                        <option key={w.id} value={w.full_name}>
                          {w.full_name}{w.role ? ` (${w.role})` : ""}
                        </option>
                      ))}
                      {form.employee_name && !workerList.find((w) => w.full_name === form.employee_name) && (
                        <option value={form.employee_name}>{form.employee_name} (saved)</option>
                      )}
                    </select>
                    <SelectChevron />
                  </div>
                ) : (
                  <input value={form.employee_name}
                    onChange={(e) => set("employee_name", e.target.value)}
                    placeholder="Full Name" className={inputCls} autoComplete="off" />
                )}
              </Field>
            </div>

            <PayrollFormFields
              form={form}
              set={set}
              insurancePremium={insurancePremium}
              setInsurancePremium={setInsurancePremium}
            />

            <Field label="Last Updated" hint="Auto-filled — cannot be changed manually">
              <div className={inputCls + " cursor-not-allowed opacity-60 font-mono text-xs select-none bg-white/3"}>
                {lastUpdatedDisplay}
              </div>
            </Field>
          </div>

          {/* Live Payslip */}
          <div className="lg:col-span-2 px-2 sm:px-5 py-5 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-3">Live Payslip Preview</p>
            <PayslipBreakdown gross={form.gross_pay} computed={computed} pension={form.pension} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/3">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
            Cancel
          </button>
          <button onClick={() => onSave(form)} disabled={loading || !isValid}
            className="px-6 py-2.5 text-sm font-bold rounded-2xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEdit ? "Save Changes" : "Add Entry"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DELETE CONFIRM ───────────────────────────────────────────────────────────
function DeleteConfirm({ entry, onConfirm, onClose, loading }: {
  entry: PayrollEntry; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-2xl bg-[#0d0d0d]/95"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}>
        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Delete Payroll Entry</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Permanently remove the payroll record for{" "}
              <span className="text-foreground font-semibold">{entry.employee_name}</span>?{" "}
              This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition-all disabled:opacity-50 flex items-center gap-2">
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Delete Entry
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── PROJECT CARD ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onSelect, counts }: {
  project: Project;
  onSelect: (p: Project) => void;
  counts: { total: number; unpaid: number; overdue: number };
}) {
  const status = project.status ?? "planning";
  const statusCls = PROJECT_STATUS_STYLE[status] ?? PROJECT_STATUS_STYLE.planning;
  return (
    <motion.button onClick={() => onSelect(project)} whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
      className="w-full text-left rounded-2xl border border-white/10 backdrop-blur-xl bg-white/4 p-5 hover:border-primary/35 hover:bg-white/7 transition-all duration-200 shadow-sm group">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg tracking-tight">
            {project.project_number}
          </span>
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusCls}`}>
            {status.replace(/_/g, " ")}
          </span>
        </div>
        {counts.total > 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[9px] bg-white/5 border border-white/10 text-muted-foreground px-2 py-0.5 rounded-full tabular-nums">
              {counts.total}
            </span>
            {counts.overdue > 0 && (
              <span className="text-[9px] bg-orange-500/10 border border-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">
                {counts.overdue} overdue
              </span>
            )}
          </div>
        )}
      </div>
      <h3 className="font-bold text-foreground text-sm mb-1.5 group-hover:text-primary transition-colors line-clamp-1">
        {project.title}
      </h3>
      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{project.description}</p>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
        {project.site_city && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
            {project.site_city}
          </span>
        )}
        {project.budget_numeric != null && (
          <span className="flex items-center gap-1 text-emerald-400/80">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            {fmt(project.budget_numeric)}
          </span>
        )}
      </div>
      {project.progress_percent != null && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Progress</span>
            <span className="text-[10px] font-mono font-bold text-primary">{project.progress_percent}%</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              initial={{ width: 0 }} animate={{ width: `${project.progress_percent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-1 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
        Open Payroll Checklist →
      </div>
    </motion.button>
  );
}

// ─── PAYROLL ROW ──────────────────────────────────────────────────────────────
function PayrollRow({ entry, canEdit, onEdit, onDelete, showProject, projectMap }: {
  entry: PayrollEntry; canEdit: boolean; onEdit: () => void; onDelete: () => void;
  showProject?: boolean; projectMap?: Record<string, Project>;
}) {
  const s = STATUS_STYLE[entry.payment_status];
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <motion.tr
        className={`border-b border-white/8 cursor-pointer transition-colors ${s.row}`}
        onClick={() => setExpanded((x) => !x)}
        style={{ wordBreak: 'break-word' }}
      >
        {showProject && (
          <td className="px-4 py-3.5 whitespace-nowrap min-w-[90px]">
            {entry.project_id && projectMap?.[entry.project_id] ? (
              <div>
                <span className="font-mono text-[10px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                  {projectMap[entry.project_id].project_number}
                </span>
                <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[100px] truncate">
                  {projectMap[entry.project_id].title}
                </div>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground italic px-1.5 py-0.5 rounded border border-white/10 bg-white/5">
                Company
              </span>
            )}
          </td>
        )}
        {showProject && (
          <td className="px-4 py-3.5 font-mono text-xs text-primary font-bold min-w-[100px] whitespace-nowrap">{entry.job_id || "—"}</td>
        )}
        <td className="px-4 py-3.5 font-semibold text-sm min-w-[120px] whitespace-nowrap">{entry.employee_name}</td>
        <td className="px-4 py-3.5 tabular-nums text-sm font-semibold min-w-[100px] whitespace-nowrap">{fmt(entry.gross_pay)}</td>
        <td className="px-4 py-3.5 tabular-nums text-xs text-blue-300 min-w-[80px] whitespace-nowrap">{fmt(entry.nssf_total)}</td>
        <td className="px-4 py-3.5 tabular-nums text-xs text-purple-300 min-w-[80px] whitespace-nowrap">{fmt(entry.shif)}</td>
        <td className="px-4 py-3.5 tabular-nums text-xs text-amber-300 min-w-[80px] whitespace-nowrap">{fmt(entry.housing_levy)}</td>
        <td className="px-4 py-3.5 tabular-nums text-xs text-rose-300 min-w-[80px] whitespace-nowrap">{fmt(entry.paye_net)}</td>
        <td className="px-4 py-3.5 font-black text-emerald-400 tabular-nums text-sm min-w-[100px] whitespace-nowrap">{fmt(entry.net_pay)}</td>
        <td className="px-4 py-3.5 text-xs text-muted-foreground hidden sm:table-cell min-w-[100px] whitespace-nowrap">{fmtDate(entry.due_date)}</td>
        <td className="px-4 py-3.5 whitespace-nowrap min-w-[120px]">
          <span className="text-[9px] font-mono text-muted-foreground/60 tabular-nums">
            {fmtDateTime(entry.updated_at ?? entry.created_at)}
          </span>
        </td>
        <td className="px-4 py-3.5 min-w-[80px] whitespace-nowrap">
          <Badge className={`text-[9px] font-bold ${s.badge}`}>{entry.payment_status}</Badge>
        </td>
        {canEdit && (
          <td className="px-4 py-3.5 min-w-[90px] whitespace-nowrap">
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button onClick={onEdit}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-white/8 font-medium">
                Edit
              </button>
              <button onClick={onDelete}
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 rounded-lg hover:bg-rose-500/10 font-medium">
                Del
              </button>
            </div>
          </td>
        )}
      </motion.tr>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white/2">
            <td colSpan={showProject ? (canEdit ? 13 : 12) : (canEdit ? 10 : 9)} className="px-2 sm:px-6 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-[10px] min-w-0">
                {[
                  { label: "Rate",            value: `${fmt(entry.rate)} / ${entry.rate_type}` },
                  { label: "Time Worked",      value: entry.time_worked || "—" },
                  { label: "NSSF Tier I",      value: fmt(entry.nssf_tier1) },
                  { label: "NSSF Tier II",     value: fmt(entry.nssf_tier2) },
                  { label: "Pension",          value: fmt(entry.pension) },
                  { label: "Taxable Income",   value: fmt(entry.taxable_income) },
                  { label: "PAYE Gross",       value: fmt(entry.paye_gross_tax) },
                  { label: "Personal Relief",  value: fmt(entry.personal_relief) },
                  { label: "Insurance Relief", value: fmt(entry.insurance_relief) },
                  { label: "Total Deductions", value: fmt(entry.total_deductions) },
                  ...(showProject && entry.job_id ? [{ label: "Job Ref",   value: entry.job_id   }] : []),
                  ...(entry.bank_code  ? [{ label: "Bank Code",  value: entry.bank_code  }] : []),
                  ...(entry.serial_no  ? [{ label: "Serial No.", value: entry.serial_no  }] : []),
                  ...(entry.etims_code ? [{ label: "eTIMS Code", value: entry.etims_code }] : []),
                  ...(entry.paid_date  ? [{ label: "Paid Date",  value: fmtDate(entry.paid_date) }] : []),
                  ...(entry.notes      ? [{ label: "Notes",      value: entry.notes      }] : []),
                ].map((item) => (
                  <div key={item.label} className="bg-white/4 rounded-xl p-3 border border-white/8">
                    <p className="text-muted-foreground uppercase tracking-wider mb-1 text-[9px] font-bold">{item.label}</p>
                    <p className={`text-sm font-black tabular-nums tracking-tight ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </td>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── GRAND TOTAL FOOTER ───────────────────────────────────────────────────────
function GrandTotalFooter({ entries, label = "Grand Total" }: { entries: PayrollEntry[]; label?: string }) {
  const gross      = entries.reduce((a, e) => a + n0(e.gross_pay), 0);
  const net        = entries.reduce((a, e) => a + n0(e.net_pay), 0);
  const nssf       = entries.reduce((a, e) => a + n0(e.nssf_total), 0);
  const shif       = entries.reduce((a, e) => a + n0(e.shif), 0);
  const ahl        = entries.reduce((a, e) => a + n0(e.housing_levy), 0);
  const paye       = entries.reduce((a, e) => a + n0(e.paye_net), 0);
  const deductions = entries.reduce((a, e) => a + n0(e.total_deductions), 0);
  const paidCount  = entries.filter((e) => e.payment_status === "Paid").length;
  if (!entries.length) return null;
  return (
    <div className="border-t border-white/12 bg-white/3 px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          {label} · {entries.length} records
        </span>
        <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-[9px] font-bold ml-auto">
          {entries.length ? Math.round((paidCount / entries.length) * 100) : 0}% paid
        </Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Gross Pay", value: gross, color: "text-foreground"  },
          { label: "NSSF",      value: nssf,  color: "text-blue-300"    },
          { label: "SHIF",      value: shif,  color: "text-purple-300"  },
          { label: "AHL",       value: ahl,   color: "text-amber-300"   },
          { label: "PAYE",      value: paye,  color: "text-rose-300"    },
          { label: "Net Pay",   value: net,   color: "text-emerald-400" },
        ].map((item) => (
          <div key={item.label} className="bg-white/4 rounded-xl p-3 border border-white/8">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1 font-bold">{item.label}</p>
            <p className={`text-sm font-black tabular-nums tracking-tight ${item.color}`}>{fmt(item.value)}</p>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-muted-foreground/50 mt-3">
        Total deductions: {fmt(deductions)} · Effective rate:{" "}
        {gross > 0 ? ((deductions / gross) * 100).toFixed(1) : 0}% · KRA / NSSF / SHIF / AHL compliant · 2026
      </p>
    </div>
  );
}

// ─── GROUPED TABLE BODY ───────────────────────────────────────────────────────
function GroupedPayrollBody({
  entries, filtered, grouped, fetching, canEdit,
  showProject, projectMap, onEdit, onDelete, onCreateFirst, tableHeaders,
}: {
  entries: PayrollEntry[];
  filtered: PayrollEntry[];
  grouped: Partial<Record<PaymentStatus, PayrollEntry[]>>;
  fetching: boolean;
  canEdit: boolean;
  showProject?: boolean;
  projectMap?: Record<string, Project>;
  onEdit: (e: PayrollEntry) => void;
  onDelete: (e: PayrollEntry) => void;
  onCreateFirst: () => void;
  tableHeaders: string[];
}) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, true])),
  );

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-28 text-muted-foreground">
        <span className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-3" />
        Loading payroll records…
      </div>
    );
  }

  if (Object.keys(grouped).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-muted-foreground gap-3">
        <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>
        </svg>
        <p className="text-sm">No payroll entries found.</p>
        {canEdit && (
          <button onClick={onCreateFirst} className="text-sm text-primary hover:underline">
            Add the first entry →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/8">
      {PAYMENT_STATUSES.filter((ps) => grouped[ps]).map((payStatus) => {
        const s = STATUS_STYLE[payStatus];
        const rows = grouped[payStatus]!;
        const isOpen = expandedGroups[payStatus];
        const groupNet   = rows.reduce((a, e) => a + n0(e.net_pay),   0);
        const groupGross = rows.reduce((a, e) => a + n0(e.gross_pay), 0);
        return (
          <div key={payStatus}>
            <button
              onClick={() => setExpandedGroups((prev) => ({ ...prev, [payStatus]: !prev[payStatus] }))}
              className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-white/4 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${s.accent}`}>{payStatus}</span>
                <Badge className={`text-[9px] font-bold ${s.badge}`}>{rows.length}</Badge>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-[9px] text-muted-foreground">Net / Gross</p>
                  <p className="text-xs font-mono font-bold">
                    {fmt(groupNet)} / <span className="text-muted-foreground font-normal">{fmt(groupGross)}</span>
                  </p>
                </div>
                <svg className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm min-w-[600px] max-w-full">
                      <thead>
                        <tr className="border-y border-white/8 bg-white/3">
                          {tableHeaders.map((h) => (
                            <th
                              key={h}
                              className={`px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap min-w-[80px] ${h === 'Employee' ? 'min-w-[120px]' : ''} ${h === 'Job ID' ? 'min-w-[100px]' : ''} ${h === 'Actions' ? 'min-w-[90px]' : ''}`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((entry) => (
                          <PayrollRow key={entry.id} entry={entry} canEdit={canEdit}
                            showProject={showProject} projectMap={projectMap}
                            onEdit={() => onEdit(entry)} onDelete={() => onDelete(entry)} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ─── GLOBAL PAYROLL VIEW ──────────────────────────────────────────────────────
type GlobalPayrollTab = "consolidated" | "by_project";

function GlobalPayrollView({ projects, canEdit }: { projects: Project[]; canEdit: boolean }) {
  const [allEntries,    setAllEntries]    = useState<PayrollEntry[]>([]);
  const [fetching,      setFetching]      = useState(true);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState<PaymentStatus | "All">("All");
  const [activeTab,     setActiveTab]     = useState<GlobalPayrollTab>("consolidated");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [modal,         setModal]         = useState<null | "create" | "edit">(null);
  const [editing,       setEditing]       = useState<PayrollEntry | null>(null);
  const [deleting,      setDeleting]      = useState<PayrollEntry | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [allWorkers,    setAllWorkers]    = useState<Worker[]>([]);
  const { toasts, push } = useToast();

  const projectMap = useMemo(() =>
    Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  const fetchEntries = useCallback(async () => {
    setFetching(true);
    try { setAllEntries(await api.listAll()); }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed to load entries.", "error"); }
    finally { setFetching(false); }
  }, [push]);

  useEffect(() => { fetchEntries(); api.allWorkers().then(setAllWorkers); }, [fetchEntries]);

  const handleCreate = async (form: PayrollFormData) => {
    setSaving(true);
    try { const r = await api.create(form); setAllEntries((p) => [r, ...p]); push("Entry added ✓"); setModal(null); }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed.", "error"); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (form: PayrollFormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const r = await api.update(editing.id, form);
      setAllEntries((p) => p.map((e) => e.id === editing.id ? r : e));
      push("Entry updated ✓"); setModal(null); setEditing(null);
    }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed.", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      setAllEntries((p) => p.filter((e) => e.id !== deleting.id));
      push("Entry deleted"); setDeleting(null);
    }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed.", "error"); }
    finally { setSaving(false); }
  };

  const displayRows = useMemo(() => {
    if (activeTab === "by_project") {
      if (projectFilter === "company") return allEntries.filter((e) => e.project_id === null);
      if (projectFilter !== "all") return allEntries.filter((e) => e.project_id === projectFilter);
    }
    return allEntries;
  }, [allEntries, activeTab, projectFilter]);

  const filtered = useMemo(() =>
    displayRows.filter((e) => {
      if (filterStatus !== "All" && e.payment_status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return e.employee_name.toLowerCase().includes(q) ||
          e.job_id.toLowerCase().includes(q) ||
          (e.project_id ? (projectMap[e.project_id]?.title ?? "").toLowerCase().includes(q) : false) ||
          (e.project_id ? (projectMap[e.project_id]?.project_number ?? "").toLowerCase().includes(q) : false);
      }
      return true;
    }), [displayRows, filterStatus, search, projectMap]);

  const grouped = useMemo(() => {
    const g: Partial<Record<PaymentStatus, PayrollEntry[]>> = {};
    PAYMENT_STATUSES.forEach((st) => {
      const items = filtered.filter((e) => e.payment_status === st);
      if (items.length) g[st] = items;
    });
    return g;
  }, [filtered]);

  const entryCountByProject = useMemo(() => {
    const c: Record<string, number> = {};
    allEntries.forEach((e) => { if (e.project_id) c[e.project_id] = (c[e.project_id] ?? 0) + 1; });
    return c;
  }, [allEntries]);

  const companyCount = allEntries.filter((e) => !e.project_id).length;
  const projectsWithEntries = useMemo(
    () => projects.filter((p) => entryCountByProject[p.id] > 0),
    [projects, entryCountByProject],
  );

  const grandGross = allEntries.reduce((a, e) => a + n0(e.gross_pay), 0);
  const grandNet   = allEntries.reduce((a, e) => a + n0(e.net_pay),   0);
  const paidCount  = allEntries.filter((e) => e.payment_status === "Paid").length;

  const statusTotals = useMemo(() =>
    Object.fromEntries(PAYMENT_STATUSES.map((ps) => [ps, {
      count: allEntries.filter((e) => e.payment_status === ps).length,
      net:   allEntries.filter((e) => e.payment_status === ps).reduce((a, e) => a + n0(e.net_pay), 0),
    }])) as Record<PaymentStatus, { count: number; net: number }>,
  [allEntries]);

  const tabs: { key: GlobalPayrollTab; label: string; count: number; description: string }[] = [
    { key: "consolidated", label: "Consolidated",  count: allEntries.length,           description: "All payroll entries — project-linked + company-wide. Scope + Job ID columns visible." },
    { key: "by_project",   label: "By Project",    count: projectsWithEntries.length,  description: "Filter by a specific project or show company-wide only." },
  ];

  const TABLE_HEADERS_GLOBAL = [
    "Scope", "Job ID", "Employee", "Gross", "NSSF", "SHIF", "AHL", "PAYE",
    "Net Pay", "Due Date", "Last Updated", "Status",
    ...(canEdit ? ["Actions"] : []),
  ];

  return (
    <>
      <ToastStack toasts={toasts} />

      <AnimatePresence>
        {modal === "create" && (
          <GlobalEntryModal
            initial={makeEmptyGlobalForm()}
            projects={projects}
            allWorkers={allWorkers}
            onSave={handleCreate}
            onClose={() => setModal(null)}
            loading={saving}
          />
        )}
        {modal === "edit" && editing && (
          <GlobalEntryModal
            initial={{ ...editing }}
            projects={projects}
            allWorkers={allWorkers}
            onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
          />
        )}
        {deleting && (
          <DeleteConfirm entry={deleting} onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={saving} />
        )}
      </AnimatePresence>

      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden mb-6 border border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(99,102,241,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(16,185,129,0.2) 0%, transparent 40%)" }} />
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🇰🇪</span>
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/70">
                  Firm Overview · Company Payroll
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-7xl font-black tracking-tight">
                Company-Wide Payroll Register
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                All payroll obligations across the company — project-linked and standalone entries.
                KRA / NSSF / SHIF / AHL compliant · 2026
              </p>
            </div>
            {canEdit && (
              <button onClick={() => setModal("create")}
                className="flex-shrink-0 px-5 py-2.5 rounded-2xl font-bold text-sm text-primary-foreground flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
                style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                New Entry
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-5">
            {[
              { label: "Total Entries",  value: allEntries.length,                 color: "text-foreground",    bg: "bg-white/8"        },
              { label: "Company-wide",   value: companyCount,                      color: "text-sky-300",       bg: "bg-sky-500/10"     },
              { label: "Project-linked", value: allEntries.length - companyCount,  color: "text-violet-300",    bg: "bg-violet-500/10"  },
              { label: "Gross Payroll",  value: `KES ${fmtC(grandGross)}`,         color: "text-foreground",    bg: "bg-white/8"        },
              { label: "Net Payroll",    value: `KES ${fmtC(grandNet)}`,           color: "text-emerald-300",   bg: "bg-emerald-500/10" },
              { label: "% Paid",
                value: `${allEntries.length ? Math.round((paidCount / allEntries.length) * 100) : 0}%`,
                color: paidCount === allEntries.length && allEntries.length > 0 ? "text-emerald-400" : "text-amber-300",
                bg: "bg-white/8" },
            ].map((stat) => (
              <div key={stat.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 ${stat.bg}`}>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">{stat.label}</span>
                <span className={`text-xs font-black tabular-nums ${stat.color}`}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Card className="backdrop-blur-xl bg-white/5 border border-white/12 rounded-2xl shadow-xl overflow-hidden">
        <CardHeader className="pb-0 border-b border-white/8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 pt-4">
            {PAYMENT_STATUSES.map((ps) => {
              const s = STATUS_STYLE[ps];
              const t = statusTotals[ps];
              const isActive = filterStatus === ps;
              return (
                <button key={ps} onClick={() => setFilterStatus(isActive ? "All" : ps)}
                  className={`rounded-xl border p-3 text-left transition-all backdrop-blur-sm bg-white/3 ${
                    isActive ? "border-white/25 ring-1 ring-white/20 scale-[1.02]" : "border-white/8 hover:border-white/18"
                  }`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    <span className={`text-[9px] uppercase tracking-widest font-black ${s.accent}`}>{ps}</span>
                  </div>
                  <div className="text-2xl font-black tabular-nums">{t.count}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">KES {fmtC(t.net)} net</div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-1 mb-4 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
            {tabs.map((tab) => (
              <button key={tab.key}
                onClick={() => { setActiveTab(tab.key); setProjectFilter("all"); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key ? "bg-white/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}>
                {tab.label}
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full tabular-nums ${
                  activeTab === tab.key ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {activeTab === "by_project" && (
            <div className="flex items-center gap-3 mb-3">
              <div className="relative w-80">
                <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={selectCls}>
                  <option value="all">— All Entries —</option>
                  <option value="company">Company-wide only ({companyCount})</option>
                  {projectsWithEntries.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.project_number} — {p.title} ({entryCountByProject[p.id] ?? 0})
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>
              {projectFilter !== "all" && (
                <button onClick={() => setProjectFilter("all")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Clear
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground mb-3">
            {tabs.find((t) => t.key === activeTab)?.description}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pb-4">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee, job ID or project…"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-foreground placeholder-muted-foreground" />
            </div>
            <div className="relative">
              <select value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as PaymentStatus | "All")}
                className={selectCls} style={{ minWidth: "9rem" }}>
                <option value="All">All Statuses</option>
                {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <SelectChevron />
            </div>
            <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
              {filtered.length} / {displayRows.length}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <GroupedPayrollBody
            entries={displayRows} filtered={filtered} grouped={grouped}
            fetching={fetching} canEdit={canEdit} showProject={true}
            projectMap={projectMap}
            onEdit={(e) => { setEditing(e); setModal("edit"); }}
            onDelete={setDeleting}
            onCreateFirst={() => setModal("create")}
            tableHeaders={TABLE_HEADERS_GLOBAL}
          />
          <GrandTotalFooter entries={displayRows} label="Company Grand Total" />
          {!fetching && allEntries.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/8 text-xs text-muted-foreground">
              <span className="tabular-nums">{allEntries.length} total entries</span>
              <button onClick={fetchEntries} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Refresh
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── PROJECT PICKER ───────────────────────────────────────────────────────────
function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [fetching,     setFetching]     = useState(true);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [counts,       setCounts]       = useState<Record<string, { total: number; unpaid: number; overdue: number }>>({});
  const { toasts, push } = useToast();

  useEffect(() => {
    api.projects()
      .then(async (data) => {
        setProjects(data);
        if (data.length) {
          const ids = data.map((p) => p.id);
          const { data: rows } = await supabase
            .from("payroll_checklist")
            .select("project_id,payment_status")
            .in("project_id", ids);
          if (rows) {
            const tally: Record<string, { total: number; unpaid: number; overdue: number }> = {};
            (rows as { project_id: string; payment_status: string }[]).forEach((r) => {
              if (!r.project_id) return;
              if (!tally[r.project_id]) tally[r.project_id] = { total: 0, unpaid: 0, overdue: 0 };
              tally[r.project_id].total++;
              if (r.payment_status === "Unpaid") tally[r.project_id].unpaid++;
              if (r.payment_status === "Overdue") tally[r.project_id].overdue++;
            });
            setCounts(tally);
          }
        }
      })
      .catch((err: unknown) => push(err instanceof Error ? err.message : "Failed to load projects", "error"))
      .finally(() => setFetching(false));
  }, [push]);

  const filtered = useMemo(() =>
    projects.filter((p) => {
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchSearch = !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.project_number.toLowerCase().includes(search.toLowerCase()) ||
        (p.site_city ?? "").toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    }), [projects, search, statusFilter]);

  const totalEntries = Object.values(counts).reduce((a, c) => a + c.total, 0);
  const totalOverdue = Object.values(counts).reduce((a, c) => a + c.overdue, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <ToastStack toasts={toasts} />
      <div className="container mx-auto px-4 py-12 max-w-7xl">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 font-bold flex items-center gap-2">
                <span className="text-base">🇰🇪</span>
                KENYA PAYROLL · NSSF / SHIF / AHL / PAYE · 2026
              </p>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black leading-none tracking-tighter">
                Payroll{" "}
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Checklist
                </span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground mt-3 max-w-xl">
                Fully compliant statutory payroll — NSSF, SHIF, AHL & PAYE auto-applied.
                Select a project below, or use the company register at the bottom.
              </p>
            </div>
            {totalEntries > 0 && (
              <div className="flex gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center min-w-[80px]">
                  <p className="text-2xl font-black tabular-nums text-foreground">{totalEntries}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Project Entries</p>
                </div>
                {totalOverdue > 0 && (
                  <div className="rounded-2xl border border-orange-500/25 bg-orange-500/8 px-4 py-3 text-center min-w-[80px]">
                    <p className="text-2xl font-black tabular-nums text-orange-400">{totalOverdue}</p>
                    <p className="text-[9px] uppercase tracking-wider text-orange-400/70 mt-0.5">Overdue</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Project Payrolls section */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-violet-400 to-primary" />
          <h2 className="text-xl font-black text-foreground">Project Payrolls</h2>
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-muted-foreground">Click a project to manage its payroll</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects by name, number or city…"
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-foreground placeholder-muted-foreground" />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className={selectCls} style={{ minWidth: "9rem" }}>
              <option value="all">All Statuses</option>
              {Array.from(new Set(projects.map((p) => p.status ?? "planning"))).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ").toUpperCase()}</option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>

        {fetching ? (
          <div className="flex items-center justify-center py-32 text-muted-foreground">
            <span className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-3" />
            Loading projects…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 text-muted-foreground">No projects found.</div>
        ) : (
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14"
            initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } }, hidden: {} }}>
            {filtered.map((p) => (
              <motion.div key={p.id} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
                <ProjectCard project={p} onSelect={onSelect} counts={counts[p.id] ?? { total: 0, unpaid: 0, overdue: 0 }} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Company-Wide Payroll Register */}
        {!fetching && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-sky-500" />
              <h2 className="text-xl font-black text-foreground">Company Payroll Register</h2>
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-muted-foreground">All entries — project-linked + company-wide</span>
            </div>
            <GlobalPayrollView projects={projects} canEdit={true} />
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── PAYROLL VIEW (per-project) ───────────────────────────────────────────────
function PayrollView({ project, canEdit, onBack }: {
  project: Project; canEdit: boolean; onBack: () => void;
}) {
  const [entries,        setEntries]        = useState<PayrollEntry[]>([]);
  const [fetching,       setFetching]       = useState(false);
  const [search,         setSearch]         = useState("");
  const [filterStatus,   setFilterStatus]   = useState<PaymentStatus | "All">("All");
  const [modal,          setModal]          = useState<null | "create" | "edit">(null);
  const [editing,        setEditing]        = useState<PayrollEntry | null>(null);
  const [deleting,       setDeleting]       = useState<PayrollEntry | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [projectWorkers, setProjectWorkers] = useState<Worker[]>([]);
  const { toasts, push } = useToast();

  const fetchEntries = useCallback(async () => {
    setFetching(true);
    try { setEntries(await api.list(project.id)); }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed to load entries", "error"); }
    finally { setFetching(false); }
  }, [project.id, push]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { api.workersForProject(project.id).then(setProjectWorkers); }, [project.id]);

  const handleCreate = async (form: PayrollFormData) => {
    setSaving(true);
    try {
      const row = await api.create({ ...form, project_id: project.id });
      setEntries((p) => [row, ...p]); push("Entry added ✓"); setModal(null);
    }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed.", "error"); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (form: PayrollFormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      setEntries((p) => p.map((e) => e.id === editing.id ? row : e));
      push("Entry updated ✓"); setModal(null); setEditing(null);
    }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed.", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      setEntries((p) => p.filter((e) => e.id !== deleting.id));
      push("Entry deleted"); setDeleting(null);
    }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed.", "error"); }
    finally { setSaving(false); }
  };

  const filtered = useMemo(() =>
    entries.filter((e) => {
      const statusMatch = filterStatus === "All" || e.payment_status === filterStatus;
      const searchMatch = !search || e.employee_name.toLowerCase().includes(search.toLowerCase());
      return statusMatch && searchMatch;
    }), [entries, filterStatus, search]);

  const grouped = useMemo(() => {
    const g: Partial<Record<PaymentStatus, PayrollEntry[]>> = {};
    PAYMENT_STATUSES.forEach((st) => {
      const items = filtered.filter((e) => e.payment_status === st);
      if (items.length) g[st] = items;
    });
    return g;
  }, [filtered]);

  const grandGross = entries.reduce((a, e) => a + n0(e.gross_pay), 0);
  const grandNet   = entries.reduce((a, e) => a + n0(e.net_pay),   0);
  const paidCount  = entries.filter((e) => e.payment_status === "Paid").length;
  const paidPct    = entries.length ? Math.round((paidCount / entries.length) * 100) : 0;

  const TABLE_HEADERS = [
    "Employee", "Gross", "NSSF", "SHIF", "AHL", "PAYE",
    "Net Pay", "Due Date", "Last Updated", "Status",
    ...(canEdit ? ["Actions"] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <ToastStack toasts={toasts} />

      <AnimatePresence>
        {modal === "create" && (
          <ProjectEntryModal
            initial={makeEmptyProjectForm(project.id)}
            projectWorkers={projectWorkers}
            onSave={handleCreate}
            onClose={() => setModal(null)}
            loading={saving}
          />
        )}
        {modal === "edit" && editing && (
          <ProjectEntryModal
            initial={{ ...editing }}
            projectWorkers={projectWorkers}
            onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
          />
        )}
        {deleting && (
          <DeleteConfirm entry={deleting} onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={saving} />
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-10 max-w-[1400px]">
        <button onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors group">
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          All Projects
        </button>

        {/* Project Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-xl tracking-tight font-bold">
              {project.project_number}
            </span>
            {project.status && (
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${PROJECT_STATUS_STYLE[project.status] ?? PROJECT_STATUS_STYLE.planning}`}>
                {project.status.replace(/_/g, " ")}
              </span>
            )}
            {projectWorkers.length > 0 && (
              <span className="text-[9px] bg-sky-500/10 border border-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full font-bold">
                {projectWorkers.length} workers assigned
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tighter bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-none mt-1">
            {project.title}
          </h1>
          {project.site_city && (
            <p className="text-base text-muted-foreground mt-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
              {project.site_city}{project.site_country ? `, ${project.site_country}` : ""}
            </p>
          )}
        </div>

        {/* Status Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {PAYMENT_STATUSES.map((ps) => {
            const s = STATUS_STYLE[ps];
            const rows = entries.filter((e) => e.payment_status === ps);
            const isActive = filterStatus === ps;
            return (
              <button key={ps} onClick={() => setFilterStatus(isActive ? "All" : ps)}
                className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                  isActive ? "border-white/30 bg-white/8 shadow-lg" : "border-white/8 hover:border-white/20 bg-white/3 hover:bg-white/5"
                }`}>
                <div className={`text-[9px] uppercase tracking-widest font-black mb-1 ${s.accent}`}>{ps}</div>
                <div className="text-2xl sm:text-3xl font-black tabular-nums">{rows.length}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">
                  KES {fmtC(rows.reduce((a, e) => a + n0(e.net_pay), 0))} net
                </div>
              </button>
            );
          })}
          <div className={`rounded-2xl p-4 border transition-all ${paidPct === 100 ? "border-emerald-500/30 bg-emerald-500/8" : "border-white/8 bg-white/3"}`}>
            <div className="text-[9px] uppercase tracking-widest font-black text-emerald-400 mb-1">Paid Rate</div>
            <div className={`text-2xl sm:text-3xl font-black tabular-nums ${paidPct === 100 ? "text-emerald-400" : ""}`}>{paidPct}%</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{paidCount} of {entries.length}</div>
          </div>
          <div className="rounded-2xl p-4 border border-white/8 bg-white/3 col-span-2 sm:col-span-1">
            <div className="text-[9px] uppercase tracking-widest font-black text-foreground/60 mb-1">Total Net</div>
            <div className="text-xl font-black tabular-nums text-emerald-400 tracking-tight">KES {fmtC(grandNet)}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">Gross KES {fmtC(grandGross)}</div>
          </div>
        </div>

        {/* Main Card */}
        <Card className="backdrop-blur-xl bg-white/5 border border-white/12 rounded-2xl shadow-xl overflow-hidden">
          <CardHeader className="pb-0 border-b border-white/8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5">
              <div>
                <CardTitle className="text-2xl font-black">Payroll Entries</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click any row to expand · Workers sourced exclusively from this project's worker_assignments
                </p>
              </div>
              {canEdit && (
                <button onClick={() => setModal("create")}
                  className="flex-shrink-0 px-5 py-2.5 rounded-2xl font-bold text-sm text-primary-foreground flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                  style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  New Entry
                </button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pb-4">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employee name…"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-foreground placeholder-muted-foreground" />
              </div>
              <div className="relative">
                <select value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as PaymentStatus | "All")}
                  className={selectCls} style={{ minWidth: "9rem" }}>
                  <option value="All">All Statuses</option>
                  {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <SelectChevron />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <GroupedPayrollBody
              entries={entries} filtered={filtered} grouped={grouped}
              fetching={fetching} canEdit={canEdit} showProject={false}
              onEdit={(e) => { setEditing(e); setModal("edit"); }}
              onDelete={setDeleting}
              onCreateFirst={() => setModal("create")}
              tableHeaders={TABLE_HEADERS}
            />
            <GrandTotalFooter entries={entries} label={`Grand Total — ${entries.length} employees`} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function PayrollChecklistPage({ projectId, canEdit = true }: Props) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,currency,site_address,site_city,site_country,start_date,expected_completion_date,created_at")
      .eq("id", projectId)
      .single()
      .then(({ data }) => { if (data) setSelectedProject(data as Project); });
  }, [projectId]);

  return (
    <AnimatePresence mode="wait">
      {selectedProject ? (
        <motion.div key="payroll"
          initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
          <PayrollView
            project={selectedProject}
            canEdit={canEdit}
            onBack={() => { if (!projectId) setSelectedProject(null); }}
          />
        </motion.div>
      ) : (
        <motion.div key="picker"
          initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.25 }}>
          <ProjectPickerView onSelect={setSelectedProject} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}