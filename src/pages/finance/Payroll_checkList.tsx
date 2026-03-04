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

type PaymentStatus = "Paid" | "Unpaid" | "Pending" | "Overdue";
type RateType = "Per Hour" | "Per Week" | "Per Month";

interface PayrollEntry {
  id: number;
  project_id: string;
  job_id: string;
  employee_name: string;
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
const PAYMENT_STATUSES: PaymentStatus[] = ["Paid", "Unpaid", "Pending", "Overdue"];
const RATE_TYPES: RateType[] = ["Per Hour", "Per Week", "Per Month"];

const STATUS_STYLE: Record<PaymentStatus, { accent: string; badge: string; dot: string; row: string }> = {
  Paid: { accent: "text-emerald-400", badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", dot: "bg-emerald-400", row: "hover:bg-emerald-950/30" },
  Unpaid: { accent: "text-rose-400", badge: "bg-rose-500/10 border-rose-500/30 text-rose-300", dot: "bg-rose-400", row: "hover:bg-rose-950/30" },
  Pending: { accent: "text-amber-400", badge: "bg-amber-500/10 border-amber-500/30 text-amber-300", dot: "bg-amber-400", row: "hover:bg-amber-950/30" },
  Overdue: { accent: "text-orange-400", badge: "bg-orange-500/10 border-orange-500/30 text-orange-300", dot: "bg-orange-400", row: "hover:bg-orange-950/30" },
};

const PROJECT_STATUS_STYLE: Record<string, string> = {
  planning: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  on_hold: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const makeEmptyForm = (projectId: string): PayrollFormData => ({
  project_id: projectId,
  job_id: "",
  employee_name: "",
  rate: 0,
  rate_type: "Per Month",
  time_worked: "",
  gross_pay: 0,
  nssf_tier1: 0,
  nssf_tier2: 0,
  nssf_total: 0,
  shif: 0,
  housing_levy: 0,
  pension: 0,
  taxable_income: 0,
  paye_gross_tax: 0,
  personal_relief: 2400,
  insurance_relief: 0,
  paye_net: 0,
  total_deductions: 0,
  net_pay: 0,
  due_date: new Date().toISOString().slice(0, 10),
  paid_date: null,
  bank_code: null,
  serial_no: null,
  etims_code: null,
  payment_status: "Unpaid",
  notes: null,
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n: number, currency = "KES") =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);

const fmtC = (n: number) =>
  new Intl.NumberFormat("en-KE", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/** Strict Kenyan Statutory Payroll Calculator (Feb 2026 rates) */
const calculateKenyaPayroll = (
  gross: number,
  pension: number = 0,
  insuranceReliefInput: number = 0
) => {
  const nssfTier1 = Math.min(Math.min(gross, 9000) * 0.06, 540);
  const nssfTier2 = gross > 9000 ? Math.min(Math.min(gross - 9000, 99000) * 0.06, 5940) : 0;
  const nssfTotal = nssfTier1 + nssfTier2;

  const shif = Math.max(gross * 0.0275, 300);
  const housingLevy = gross * 0.015;

  const taxableIncome = Math.max(gross - nssfTotal - shif - housingLevy - pension, 0);

  let payeGrossTax = 0;
  let remaining = taxableIncome;
  if (remaining > 0) {
    const b1 = Math.min(remaining, 24000); payeGrossTax += b1 * 0.10; remaining -= b1;
    const b2 = Math.min(remaining, 8333);  payeGrossTax += b2 * 0.25; remaining -= b2;
    const b3 = Math.min(remaining, 467667);payeGrossTax += b3 * 0.30; remaining -= b3;
    const b4 = Math.min(remaining, 300000);payeGrossTax += b4 * 0.325; remaining -= b4;
    payeGrossTax += remaining * 0.35;
  }

  const insuranceRelief = Math.min(insuranceReliefInput, 5000);
  const payeNet = Math.max(payeGrossTax - 2400 - insuranceRelief, 0);

  const totalDeductions = nssfTotal + shif + housingLevy + pension + payeNet;
  const netPay = gross - totalDeductions;

  return {
    nssf_tier1: Number(nssfTier1.toFixed(2)),
    nssf_tier2: Number(nssfTier2.toFixed(2)),
    nssf_total: Number(nssfTotal.toFixed(2)),
    shif: Number(shif.toFixed(2)),
    housing_levy: Number(housingLevy.toFixed(2)),
    taxable_income: Number(taxableIncome.toFixed(2)),
    paye_gross_tax: Number(payeGrossTax.toFixed(2)),
    personal_relief: 2400,
    insurance_relief: insuranceRelief,
    paye_net: Number(payeNet.toFixed(2)),
    total_deductions: Number(totalDeductions.toFixed(2)),
    net_pay: Number(netPay.toFixed(2)),
  };
};

/** Parse time_worked into equivalent hours */
const parseTimeWorked = (timeStr: string, rateType: RateType): number => {
  const lower = timeStr.toLowerCase().trim();
  if (!lower) return 0;

  if (rateType === "Per Hour") {
    const match = lower.match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 0;
  }
  if (rateType === "Per Week") {
    const match = lower.match(/([\d.]+)/);
    const weeks = match ? parseFloat(match[1]) : 1;
    return weeks * 40; // standard 40-hour week
  }
  // Per Month
  const match = lower.match(/([\d.]+)/);
  const months = match ? parseFloat(match[1]) : 1;
  return months * 173.33; // average working hours per month (21.67 days × 8)
};

/** Strip server-managed columns */
function toWritable(form: PayrollFormData): PayrollFormData {
  const {
    project_id, job_id, employee_name, rate, rate_type, time_worked,
    gross_pay, nssf_tier1, nssf_tier2, nssf_total, shif, housing_levy, pension,
    taxable_income, paye_gross_tax, personal_relief, insurance_relief, paye_net,
    total_deductions, net_pay, due_date, paid_date, bank_code, serial_no,
    etims_code, payment_status, notes,
  } = form;
  return {
    project_id, job_id, employee_name, rate, rate_type, time_worked,
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
  async list(projectId: string): Promise<PayrollEntry[]> {
    const { data, error } = await supabase
      .from("payroll_checklist")
      .select("*")
      .eq("project_id", projectId)
      .order("due_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PayrollEntry[];
  },
  async create(form: PayrollFormData): Promise<PayrollEntry> {
    const { data, error } = await supabase
      .from("payroll_checklist")
      .insert([toWritable(form)])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as PayrollEntry;
  },
  async update(id: number, form: PayrollFormData): Promise<PayrollEntry> {
    const { data, error } = await supabase
      .from("payroll_checklist")
      .update(toWritable(form))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as PayrollEntry;
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

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/40 transition-all";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function SectionDivider({ label, dotColor, textColor }: { label: string; dotColor: string; textColor: string }) {
  return (
    <div className="col-span-2 flex items-center gap-2 pt-1">
      <span className={`w-1 h-4 rounded-full ${dotColor} flex-shrink-0`} />
      <span className={`text-[10px] font-bold uppercase tracking-widest ${textColor}`}>{label}</span>
      <div className="flex-1 h-px bg-white/8" />
    </div>
  );
}

// ─── ENTRY MODAL ──────────────────────────────────────────────────────────────
function EntryModal({
  initial,
  onSave,
  onClose,
  loading,
  currency,
}: {
  initial: PayrollFormData & { id?: number };
  onSave: (d: PayrollFormData) => void;
  onClose: () => void;
  loading: boolean;
  currency: string;
}) {
  const [form, setForm] = useState<PayrollFormData>({ ...initial });
  const isEdit = Boolean(initial.id);

  const set = <K extends keyof PayrollFormData>(k: K, v: PayrollFormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  // ── AUTO GROSS FROM RATE + TIME ───────────────────────────────────────────
  useEffect(() => {
    const hours = parseTimeWorked(form.time_worked, form.rate_type);
    const calcGross = form.rate * hours;
    if (Math.abs(calcGross - form.gross_pay) > 0.01) {
      set("gross_pay", Number(calcGross.toFixed(2)));
    }
  }, [form.rate, form.rate_type, form.time_worked]);

  // ── FULL KENYAN STATUTORY CALCULATION (live) ───────────────────────────────
  const computed = useMemo(() => {
    return calculateKenyaPayroll(form.gross_pay, form.pension, form.insurance_relief);
  }, [form.gross_pay, form.pension, form.insurance_relief]);

  // Sync computed values into form (for preview + save)
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      ...computed,
      personal_relief: 2400,
    }));
  }, [computed]);

  const isValid = form.job_id.trim() && form.employee_name.trim() && form.gross_pay > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-xl bg-white/10"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🇰🇪</span>
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              {isEdit ? "Edit Payroll Entry" : "New Payroll Entry"}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[68vh] overflow-y-auto">
          {/* EMPLOYEE & RATE */}
          <div className="space-y-6">
            <SectionDivider label="Employee & Rate" dotColor="bg-sky-400" textColor="text-sky-400" />
            <Field label="Job ID *">
              <input value={form.job_id} onChange={(e) => set("job_id", e.target.value)} placeholder="J-001" className={inputCls} />
            </Field>
            <Field label="Employee Name *">
              <input value={form.employee_name} onChange={(e) => set("employee_name", e.target.value)} placeholder="John Doe" className={inputCls} />
            </Field>

            <SectionDivider label="Pay Rate" dotColor="bg-violet-400" textColor="text-violet-400" />
            <div className="grid grid-cols-2 gap-4">
              <Field label={`Rate (${currency}) *`}>
                <input type="number" step="0.01" min="0" value={form.rate} onChange={(e) => set("rate", parseFloat(e.target.value) || 0)} className={inputCls} />
              </Field>
              <Field label="Rate Type *">
                <div className="flex gap-1 h-10 rounded-xl bg-white/5 border border-white/10 p-1">
                  {RATE_TYPES.map((rt) => (
                    <button
                      key={rt}
                      type="button"
                      onClick={() => set("rate_type", rt)}
                      className={`flex-1 rounded-lg text-xs font-semibold transition-all ${
                        form.rate_type === rt
                          ? "bg-primary text-primary-foreground shadow"
                          : "hover:bg-white/10 text-muted-foreground"
                      }`}
                    >
                      {rt}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <Field label="Time Worked *">
              <input
                value={form.time_worked}
                onChange={(e) => set("time_worked", e.target.value)}
                placeholder={form.rate_type === "Per Hour" ? "160h" : form.rate_type === "Per Week" ? "4 weeks" : "1 month"}
                className={inputCls}
              />
            </Field>
          </div>

          {/* DEDUCTIONS & LIVE CALCULATION */}
          <div>
            <SectionDivider label="Kenya Statutory Breakdown (Live)" dotColor="bg-emerald-400" textColor="text-emerald-400" />

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-5">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-medium">Gross Pay</span>
                <span className="text-2xl font-bold tabular-nums text-emerald-400">{fmt(form.gross_pay, currency)}</span>
              </div>

              {/* Deduction bars */}
              <div className="space-y-3 text-xs">
                {[
                  { label: "NSSF Total", value: computed.nssf_total, color: "bg-blue-500", percent: form.gross_pay ? (computed.nssf_total / form.gross_pay) * 100 : 0 },
                  { label: "SHIF (2.75%)", value: computed.shif, color: "bg-purple-500", percent: form.gross_pay ? (computed.shif / form.gross_pay) * 100 : 0 },
                  { label: "AHL (1.5%)", value: computed.housing_levy, color: "bg-amber-500", percent: form.gross_pay ? (computed.housing_levy / form.gross_pay) * 100 : 0 },
                  { label: "Pension", value: form.pension, color: "bg-sky-500", percent: form.gross_pay ? (form.pension / form.gross_pay) * 100 : 0 },
                  { label: "PAYE Net", value: computed.paye_net, color: "bg-rose-500", percent: form.gross_pay ? (computed.paye_net / form.gross_pay) * 100 : 0 },
                ].map((d) => (
                  <div key={d.label} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span>{d.label}</span>
                        <span className="font-mono">{fmt(d.value, currency)}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full ${d.color}`} style={{ width: `${Math.min(d.percent, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-emerald-400">Net Pay (Take-home)</span>
                  <span className="text-3xl font-bold tabular-nums text-emerald-400 tracking-tighter">
                    {fmt(computed.net_pay, currency)}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Fully compliant with KRA / NSSF / SHIF / AHL Feb 2026 rules</div>
              </div>
            </div>

            {/* Manual overrides */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <Field label="Pension Contribution (max KSh 30,000)">
                <input
                  type="number"
                  step="0.01"
                  value={form.pension}
                  onChange={(e) => set("pension", parseFloat(e.target.value) || 0)}
                  className={inputCls}
                />
              </Field>
              <Field label="Insurance Relief (max KSh 5,000)">
                <input
                  type="number"
                  step="0.01"
                  value={form.insurance_relief}
                  onChange={(e) => set("insurance_relief", parseFloat(e.target.value) || 0)}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          {/* PAYMENT & REFERENCES */}
          <div className="lg:col-span-2">
            <SectionDivider label="Payment & References" dotColor="bg-rose-400" textColor="text-rose-400" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Due Date">
                <input type="date" value={form.due_date ?? ""} onChange={(e) => set("due_date", e.target.value || null)} className={inputCls} />
              </Field>
              <Field label="Paid Date">
                <input type="date" value={form.paid_date ?? ""} onChange={(e) => set("paid_date", e.target.value || null)} className={inputCls} />
              </Field>
              <Field label="Payment Status *">
                <select value={form.payment_status} onChange={(e) => set("payment_status", e.target.value as PaymentStatus)} className={inputCls}>
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Bank Code">
                <input value={form.bank_code ?? ""} onChange={(e) => set("bank_code", e.target.value || null)} placeholder="1002" className={inputCls} />
              </Field>
              <Field label="Serial No.">
                <input value={form.serial_no ?? ""} onChange={(e) => set("serial_no", e.target.value || null)} placeholder="S-1001" className={inputCls} />
              </Field>
              <Field label="eTIMS Code">
                <input value={form.etims_code ?? ""} onChange={(e) => set("etims_code", e.target.value || null)} placeholder="ETIMS-55555" className={inputCls} />
              </Field>
            </div>

            <Field label="Notes" className="mt-4">
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value || null)}
                rows={3}
                placeholder="Additional notes or remarks…"
                className={inputCls + " resize-none"}
              />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={loading || !isValid}
            className="px-6 py-2.5 text-sm font-semibold rounded-2xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
          >
            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEdit ? "Save Changes" : "Add Entry"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DELETE CONFIRM ───────────────────────────────────────────────────────────
function DeleteConfirm({
  entry,
  onConfirm,
  onClose,
  loading,
}: {
  entry: PayrollEntry;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-xl bg-white/10"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Delete Entry</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Permanently delete payroll entry for{" "}
              <span className="text-foreground font-medium">{entry.employee_name}</span>?
              This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Delete Entry
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── PROJECT CARD & PICKER (unchanged except minor polish) ───────────────────
function ProjectCard({
  project,
  onSelect,
  counts,
}: {
  project: Project;
  onSelect: (p: Project) => void;
  counts: { total: number; unpaid: number; overdue: number };
}) {
  const status = project.status ?? "planning";
  const statusCls = PROJECT_STATUS_STYLE[status] ?? PROJECT_STATUS_STYLE.planning;
  const currency = project.currency?.trim() || "KES";

  return (
    <motion.button
      onClick={() => onSelect(project)}
      className="w-full text-left rounded-2xl border border-white/10 backdrop-blur-xl bg-white/5 p-5 hover:border-primary/30 hover:bg-white/8 transition-all duration-200 shadow-sm group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
            {project.project_number}
          </span>
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusCls}`}>
            {status.replace(/_/g, " ")}
          </span>
        </div>
        {counts.total > 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] bg-white/5 border border-white/10 text-muted-foreground px-2 py-0.5 rounded-full tabular-nums">
              {counts.total} entries
            </span>
            {counts.overdue > 0 && <span className="text-[10px] bg-orange-500/10 border border-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">+{counts.overdue} overdue</span>}
          </div>
        )}
      </div>
      <h3 className="font-semibold text-foreground text-sm mb-1.5 group-hover:text-primary transition-colors line-clamp-1">
        {project.title}
      </h3>
      {project.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{project.description}</p>}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
        {project.site_city && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            {project.site_city}
          </span>
        )}
        {project.budget_numeric != null && (
          <span className="flex items-center gap-1 text-emerald-400/80">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            {fmt(project.budget_numeric, currency)}
          </span>
        )}
      </div>
      {project.progress_percent != null && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-muted-foreground">Progress</span>
            <span className="text-[10px] font-mono text-primary">{project.progress_percent}%</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" initial={{ width: 0 }} animate={{ width: `${project.progress_percent}%` }} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        Open Payroll Checklist →
      </div>
    </motion.button>
  );
}

function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [counts, setCounts] = useState<Record<string, { total: number; unpaid: number; overdue: number }>>({});
  const { toasts, push } = useToast();

  useEffect(() => {
    api.projects()
      .then(async (data) => {
        setProjects(data);
        if (data.length) {
          const ids = data.map((p) => p.id);
          const { data: rows } = await supabase.from("payroll_checklist").select("project_id,payment_status").in("project_id", ids);
          if (rows) {
            const tally: Record<string, { total: number; unpaid: number; overdue: number }> = {};
            rows.forEach((r: any) => {
              if (!tally[r.project_id]) tally[r.project_id] = { total: 0, unpaid: 0, overdue: 0 };
              tally[r.project_id].total++;
              if (r.payment_status === "Unpaid") tally[r.project_id].unpaid++;
              if (r.payment_status === "Overdue") tally[r.project_id].overdue++;
            });
            setCounts(tally);
          }
        }
      })
      .catch((err) => push(err instanceof Error ? err.message : "Failed to load projects", "error"))
      .finally(() => setFetching(false));
  }, [push]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.project_number.toLowerCase().includes(search.toLowerCase()) ||
        (p.site_city ?? "").toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [projects, search, statusFilter]);

  const totalEntries = Object.values(counts).reduce((a, c) => a + c.total, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${
                t.type === "success" ? "bg-emerald-950/80 border-emerald-500/25 text-emerald-300" : "bg-rose-950/80 border-rose-500/25 text-rose-300"
              }`}
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="container mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">KENYA PAYROLL • 2026</p>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
            Payroll{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Checklist</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">Compliant with KRA, NSSF, SHIF & AHL regulations</p>
        </motion.div>

        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-3xl font-bold">Projects</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl">
                <option value="all">All Statuses</option>
                {Array.from(new Set(projects.map((p) => p.status ?? "planning"))).map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ").toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-24 text-muted-foreground">Loading projects…</div>
            ) : (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => (
                  <ProjectCard key={p.id} project={p} onSelect={onSelect} counts={counts[p.id] ?? { total: 0, unpaid: 0, overdue: 0 }} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── PAYROLL VIEW ─────────────────────────────────────────────────────────────
function PayrollView({ project, canEdit, onBack }: { project: Project; canEdit: boolean; onBack: () => void }) {
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | "All">("All");
  const [modal, setModal] = useState<null | "create" | "edit">(null);
  const [editing, setEditing] = useState<PayrollEntry | null>(null);
  const [deleting, setDeleting] = useState<PayrollEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<PaymentStatus, boolean>>(Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, true])) as any);

  const { toasts, push } = useToast();
  const currency = project.currency?.trim() || "KES";

  const fetchEntries = useCallback(async () => {
    setFetching(true);
    try {
      const data = await api.list(project.id);
      setEntries(data);
    } catch (err: any) {
      push(err.message || "Failed to load entries", "error");
    } finally {
      setFetching(false);
    }
  }, [project.id, push]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleCreate = async (form: PayrollFormData) => {
    setSaving(true);
    try {
      const row = await api.create({ ...form, project_id: project.id });
      setEntries((p) => [row, ...p]);
      push("Entry added successfully");
      setModal(null);
    } catch (err: any) {
      push(err.message || "Failed to add entry", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: PayrollFormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      setEntries((p) => p.map((e) => (e.id === editing.id ? row : e)));
      push("Entry updated");
      setModal(null);
      setEditing(null);
    } catch (err: any) {
      push(err.message || "Failed to update", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      setEntries((p) => p.filter((e) => e.id !== deleting.id));
      push("Entry deleted");
      setDeleting(null);
    } catch (err: any) {
      push(err.message || "Failed to delete", "error");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const statusMatch = filterStatus === "All" || e.payment_status === filterStatus;
      const searchMatch =
        !search ||
        e.employee_name.toLowerCase().includes(search.toLowerCase()) ||
        e.job_id.toLowerCase().includes(search.toLowerCase());
      return statusMatch && searchMatch;
    });
  }, [entries, filterStatus, search]);

  const grouped = useMemo(() => {
    const g: Partial<Record<PaymentStatus, PayrollEntry[]>> = {};
    PAYMENT_STATUSES.forEach((st) => {
      const items = filtered.filter((e) => e.payment_status === st);
      if (items.length) g[st] = items;
    });
    return g;
  }, [filtered]);

  const grandGross = entries.reduce((a, e) => a + e.gross_pay, 0);
  const grandNet = entries.reduce((a, e) => a + e.net_pay, 0);
  const paidCount = entries.filter((e) => e.payment_status === "Paid").length;
  const paidPct = entries.length ? Math.round((paidCount / entries.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Toasts & Modals */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${t.type === "success" ? "bg-emerald-950/80 border-emerald-500/25 text-emerald-300" : "bg-rose-950/80 border-rose-500/25 text-rose-300"}`}>
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {modal === "create" && <EntryModal initial={makeEmptyForm(project.id)} onSave={handleCreate} onClose={() => setModal(null)} loading={saving} currency={currency} />}
        {modal === "edit" && editing && <EntryModal initial={{ ...editing }} onSave={handleUpdate} onClose={() => { setModal(null); setEditing(null); }} loading={saving} currency={currency} />}
        {deleting && <DeleteConfirm entry={deleting} onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={saving} />}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-16">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          ← All Projects
        </button>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
          {project.title}
        </h1>
        <p className="text-xl text-muted-foreground mt-2">{project.site_city}</p>

        {/* Status summary strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 my-8">
          {PAYMENT_STATUSES.map((ps) => {
            const s = STATUS_STYLE[ps];
            const rows = entries.filter((e) => e.payment_status === ps);
            return (
              <button
                key={ps}
                onClick={() => setFilterStatus(filterStatus === ps ? "All" : ps)}
                className={`rounded-2xl border p-4 text-left transition-all ${filterStatus === ps ? "border-white/30 bg-white/5" : "border-white/10 hover:border-white/20"}`}
              >
                <div className={`text-xs uppercase tracking-widest ${s.accent}`}>{ps}</div>
                <div className="text-3xl font-bold tabular-nums mt-1">{rows.length}</div>
                <div className="text-xs text-muted-foreground">Net {fmtC(rows.reduce((a, e) => a + e.net_pay, 0))}</div>
              </button>
            );
          })}
          <div className={`rounded-2xl p-4 border ${paidPct === 100 ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10"}`}>
            <div className="text-xs uppercase tracking-widest text-emerald-400">Paid Rate</div>
            <div className="text-3xl font-bold tabular-nums text-emerald-400">{paidPct}%</div>
          </div>
        </div>

        {/* Main Table */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-3xl font-bold">Payroll Entries</CardTitle>
              {canEdit && (
                <button onClick={() => setModal("create")} className="px-5 py-2.5 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-2xl font-semibold flex items-center gap-2">
                  + New Entry
                </button>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee or job ID..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5" />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-xl px-4">
                <option value="All">All Statuses</option>
                {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="py-24 text-center text-muted-foreground">Loading payroll records…</div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="py-24 text-center text-muted-foreground">No entries yet</div>
            ) : (
              <div className="divide-y divide-white/10">
                {PAYMENT_STATUSES.filter((ps) => grouped[ps]).map((payStatus) => {
                  const s = STATUS_STYLE[payStatus];
                  const rows = grouped[payStatus]!;
                  const isOpen = expanded[payStatus];

                  return (
                    <div key={payStatus}>
                      <button onClick={() => setExpanded((prev) => ({ ...prev, [payStatus]: !prev[payStatus] }))} className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                          <span className={`font-bold uppercase tracking-widest ${s.accent}`}>{payStatus}</span>
                          <Badge className={s.badge}>{rows.length}</Badge>
                        </div>
                        <div className="font-mono text-sm">
                          Net {fmtC(rows.reduce((a, e) => a + e.net_pay, 0))}
                        </div>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-y border-white/10 bg-white/5">
                                    {["Job ID", "Employee", "Gross", "NSSF", "SHIF", "AHL", "PAYE", "Net Pay", "Due", "Status", ...(canEdit ? ["Actions"] : [])].map((h) => (
                                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((entry) => (
                                    <motion.tr key={entry.id} className={`border-b border-white/10 ${s.row}`}>
                                      <td className="px-5 py-4 font-mono text-primary">{entry.job_id}</td>
                                      <td className="px-5 py-4 font-medium">{entry.employee_name}</td>
                                      <td className="px-5 py-4 tabular-nums font-medium">{fmt(entry.gross_pay, currency)}</td>
                                      <td className="px-5 py-4 tabular-nums text-blue-300 text-xs">{fmt(entry.nssf_total, currency)}</td>
                                      <td className="px-5 py-4 tabular-nums text-purple-300 text-xs">{fmt(entry.shif, currency)}</td>
                                      <td className="px-5 py-4 tabular-nums text-amber-300 text-xs">{fmt(entry.housing_levy, currency)}</td>
                                      <td className="px-5 py-4 tabular-nums text-rose-300 text-xs">{fmt(entry.paye_net, currency)}</td>
                                      <td className="px-5 py-4 font-bold text-emerald-400 tabular-nums">{fmt(entry.net_pay, currency)}</td>
                                      <td className="px-5 py-4 text-xs text-muted-foreground">{fmtDate(entry.due_date)}</td>
                                      <td className="px-5 py-4">
                                        <Badge className={STATUS_STYLE[entry.payment_status].badge}>{entry.payment_status}</Badge>
                                      </td>
                                      {canEdit && (
                                        <td className="px-5 py-4">
                                          <div className="flex gap-2">
                                            <button onClick={() => { setEditing(entry); setModal("edit"); }} className="text-muted-foreground hover:text-foreground">Edit</button>
                                            <button onClick={() => setDeleting(entry)} className="text-rose-400 hover:text-rose-500">Delete</button>
                                          </div>
                                        </td>
                                      )}
                                    </motion.tr>
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
            )}

            {entries.length > 0 && (
              <div className="px-6 py-4 bg-emerald-950/30 flex items-center gap-6 text-xs font-mono border-t border-white/10">
                <span className="font-semibold">GRAND TOTAL</span>
                <span>Gross {fmt(grandGross, currency)}</span>
                <span className="text-emerald-400 font-bold">Net {fmt(grandNet, currency)}</span>
                <Badge className="ml-auto bg-emerald-500/10 text-emerald-300">{paidPct}% paid</Badge>
              </div>
            )}
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
      .select("*")
      .eq("id", projectId)
      .single()
      .then(({ data }) => {
        if (data) setSelectedProject(data as Project);
      });
  }, [projectId]);

  return (
    <AnimatePresence mode="wait">
      {selectedProject ? (
        <PayrollView project={selectedProject} canEdit={canEdit} onBack={() => setSelectedProject(null)} />
      ) : (
        <ProjectPickerView onSelect={setSelectedProject} />
      )}
    </AnimatePresence>
  );
}