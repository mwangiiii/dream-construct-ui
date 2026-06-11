"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { COAAccountSelect } from "@/components/finance/COAAccountSelect";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Project {
  id: string;
  project_number: string;
  title: string;
  description: string | null;
  status: string | null;
  progress_percent: number | null;
  budget_numeric: number | null;
  site_city: string | null;
  site_country: string | null;
  start_date: string | null;
  expected_completion_date: string | null;
}

type BilledStatus = "overbilled" | "underbilled" | "on_budget";

interface WIPEntry {
  id: number;
  project_id: string;
  total_contract: number;
  cost_incurred: number;
  percent_complete: number;
  earned_revenue: number;
  billed_to_date: number;
  billed_status: BilledStatus;
  amount: number;
  account: string | null;
  code_receivable: string | null;
  notes: string | null;
  last_update: string;
  created_at?: string;
  updated_at?: string;
}

type WIPFormData = Omit<WIPEntry, "id" | "created_at" | "updated_at">;

interface WIPSummary {
  totalContract: number;
  totalCostIncurred: number;
  totalEarnedRevenue: number;
  totalBilledToDate: number;
  overbilledCount: number;
  underbilledCount: number;
  onBudgetCount: number;
  overbilledAmount: number;
  underbilledAmount: number;
}

// Auto-fill snapshot pulled from the expense modules + AR + budget view
interface ProjectFinancials {
  ap_cost: number;
  job_cost: number;
  tax_cost: number;
  loan_cost: number;
  payroll_cost: number;      // SUM gross_pay from payroll_checklist
  cost_incurred: number;     // AP + JC + Tax + Loans + Payroll
  billed_to_date: number;    // from AR
  original_budget: number;   // projects.budget_numeric
  approved_changes: number;  // SUM approved change orders
  revised_budget: number;    // original + approved (= contract value)
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CURRENCY = "KES";
const BILLED_STATUSES: BilledStatus[] = ["overbilled", "underbilled", "on_budget"];

const BILLED_STYLE: Record<
  BilledStatus,
  { accent: string; badge: string; dot: string; row: string; label: string }
> = {
  overbilled: {
    accent: "text-rose-400",
    badge: "bg-rose-500/10 border-rose-500/30 text-rose-300",
    dot: "bg-rose-400",
    row: "hover:bg-rose-950/20",
    label: "Overbilled",
  },
  underbilled: {
    accent: "text-amber-400",
    badge: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    dot: "bg-amber-400",
    row: "hover:bg-amber-950/20",
    label: "Underbilled",
  },
  on_budget: {
    accent: "text-emerald-400",
    badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    dot: "bg-emerald-400",
    row: "hover:bg-emerald-950/20",
    label: "On Budget",
  },
};

const PROJECT_STATUS_STYLE: Record<string, string> = {
  planning: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  on_hold: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined) => {
  const safe = typeof n === "number" && isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
};

const n0 = (v: number | null | undefined): number =>
  typeof v === "number" && isFinite(v) ? v : 0;

const fmtDate = (d: string | null) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const pct = (v: number) => `${Math.min(100, Math.max(0, v)).toFixed(1)}%`;

function deriveBilledStatus(earned: number, billed: number): BilledStatus {
  const diff = billed - earned;
  if (Math.abs(diff) < 0.01) return "on_budget";
  if (diff > 0) return "overbilled";
  return "underbilled";
}

function sanitizeWIP(raw: WIPEntry): WIPEntry {
  const entry: WIPEntry = {
    ...raw,
    total_contract: n0(raw.total_contract),
    cost_incurred: n0(raw.cost_incurred),
    percent_complete: n0(raw.percent_complete),
    earned_revenue: n0(raw.earned_revenue),
    billed_to_date: n0(raw.billed_to_date),
    amount: n0(raw.amount),
  };
  // Derive billed_status if not set
  if (!entry.billed_status) {
    entry.billed_status = deriveBilledStatus(
      entry.earned_revenue,
      entry.billed_to_date
    );
  }
  return entry;
}

const makeEmptyForm = (projectId: string): WIPFormData => ({
  project_id: projectId,
  total_contract: 0,
  cost_incurred: 0,
  percent_complete: 0,
  earned_revenue: 0,
  billed_to_date: 0,
  billed_status: "on_budget",
  amount: 0,
  account: null,
  code_receivable: null,
  notes: null,
  last_update: new Date().toISOString().slice(0, 10),
});

// ─── API ──────────────────────────────────────────────────────────────────────
const api = {
  async projects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select(
        "id,project_number,title,description,status,progress_percent,budget_numeric,site_city,site_country,start_date,expected_completion_date"
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Project[];
  },

  async list(projectId: string): Promise<WIPEntry[]> {
    const { data, error } = await supabase
      .from("work_in_progress")
      .select("*")
      .eq("project_id", projectId)
      .order("last_update", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as WIPEntry[]).map(sanitizeWIP);
  },

  async create(form: WIPFormData): Promise<WIPEntry> {
    const { data, error } = await supabase
      .from("work_in_progress")
      .insert([form])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return sanitizeWIP(data as WIPEntry);
  },

  async update(id: number, form: WIPFormData): Promise<WIPEntry> {
    const { data, error } = await supabase
      .from("work_in_progress")
      .update(form)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return sanitizeWIP(data as WIPEntry);
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from("work_in_progress")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
  },

  async wipSummary(projectId: string): Promise<WIPSummary | null> {
    const { data, error } = await supabase.functions.invoke("wip-summary", {
      body: { project_id: projectId },
    });
    if (error) return null;
    return data as WIPSummary;
  },

  // Auto-fill source: cost from all expense modules + payroll + AR + budget view.
  async projectFinancials(projectId: string): Promise<ProjectFinancials> {
    const [costRes, arRes, budgetRes, payrollRes] = await Promise.all([
      supabase
        .from("vw_project_cost_incurred")
        .select("ap_cost,job_cost,tax_cost,loan_cost,total_cost")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("vw_project_ar_summary")
        .select("total_billed")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("vw_project_budget")
        .select("original_budget,approved_changes,revised_budget")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("payroll_checklist")
        .select("gross_pay")
        .eq("project_id", projectId),
    ]);
    if (costRes.error)   throw new Error(`Cost view: ${costRes.error.message}`);
    if (arRes.error)     throw new Error(`AR view: ${arRes.error.message}`);
    if (budgetRes.error) throw new Error(`Budget view: ${budgetRes.error.message}`);
    // payroll errors are non-fatal — fall back to 0
    const c = costRes.data;
    const b = budgetRes.data;
    const payrollCost = (payrollRes.data ?? []).reduce(
      (sum, row) => sum + n0(Number((row as any).gross_pay)), 0
    );
    const viewTotal = n0(Number(c?.total_cost));
    return {
      ap_cost:          n0(Number(c?.ap_cost)),
      job_cost:         n0(Number(c?.job_cost)),
      tax_cost:         n0(Number(c?.tax_cost)),
      loan_cost:        n0(Number(c?.loan_cost)),
      payroll_cost:     payrollCost,
      cost_incurred:    viewTotal + payrollCost,
      billed_to_date:   n0(Number(arRes.data?.total_billed)),
      original_budget:  n0(Number(b?.original_budget)),
      approved_changes: n0(Number(b?.approved_changes)),
      revised_budget:   n0(Number(b?.revised_budget)),
    };
  },
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<
    { id: number; msg: string; type: "success" | "error" }[]
  >([]);
  const push = useCallback(
    (msg: string, type: "success" | "error" = "success") => {
      const id = Date.now();
      setToasts((p) => [...p, { id, msg, type }]);
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
    },
    []
  );
  return { toasts, push };
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all";

function Select({
  value,
  onChange,
  options,
  className = "",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-foreground hover:bg-white/8 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected?.label ?? placeholder ?? "Select…"}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.13, ease: "easeOut" }}
            className="absolute z-50 mt-1.5 w-full min-w-max rounded-xl border border-white/12 bg-[#111]/95 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden"
          >
            <div className="py-1 max-h-64 overflow-y-auto">
              {options.map((opt) => {
                const isActive = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm text-left transition-colors ${
                      isActive
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-foreground/80 hover:bg-white/6 hover:text-foreground"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isActive && (
                      <svg
                        className="w-3.5 h-3.5 flex-shrink-0 text-primary"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        viewBox="0 0 24 24"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">
        {label}
      </label>
      {children}
      {hint && (
        <span className="text-[9px] text-muted-foreground/60 leading-tight">
          {hint}
        </span>
      )}
    </div>
  );
}

function SectionLabel({
  label,
  dotColor,
  textColor,
  sub,
}: {
  label: string;
  dotColor: string;
  textColor: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-1">
      <span className={`w-1.5 h-5 rounded-full ${dotColor} flex-shrink-0`} />
      <div>
        <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${textColor}`}>
          {label}
        </span>
        {sub && (
          <span className="ml-2 text-[9px] text-muted-foreground/60 tracking-wide">
            {sub}
          </span>
        )}
      </div>
      <div className="flex-1 h-px bg-white/8" />
    </div>
  );
}

// ─── WIP SUMMARY BARS ─────────────────────────────────────────────────────────
function WIPSummaryBars({
  totalContract,
  totalEarnedRevenue,
  totalBilledToDate,
  totalCostIncurred,
}: {
  totalContract: number;
  totalEarnedRevenue: number;
  totalBilledToDate: number;
  totalCostIncurred: number;
}) {
  const max = Math.max(totalContract, 1);
  const earnedPct = Math.min((totalEarnedRevenue / max) * 100, 100);
  const billedPct = Math.min((totalBilledToDate / max) * 100, 100);
  const costPct = Math.min((totalCostIncurred / max) * 100, 100);
  const variance = totalBilledToDate - totalEarnedRevenue;

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-white/8">
        <div className="flex items-end justify-between mb-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            WIP Overview
          </p>
          <p
            className={`text-[10px] font-bold ${
              variance > 0
                ? "text-rose-400"
                : variance < 0
                ? "text-amber-400"
                : "text-emerald-400"
            }`}
          >
            {variance > 0 ? "Overbilled" : variance < 0 ? "Underbilled" : "On Budget"}
          </p>
        </div>
        <p
          className={`text-4xl font-black tabular-nums tracking-tighter mt-1 ${
            variance > 0
              ? "text-rose-400"
              : variance < 0
              ? "text-amber-400"
              : "text-emerald-400"
          }`}
        >
          {fmt(Math.abs(variance))}
        </p>
        <p className="text-[9px] text-muted-foreground mt-0.5">
          {variance > 0
            ? "Billed more than earned"
            : variance < 0
            ? "Earned more than billed"
            : "Billing matches earned revenue"}
        </p>
      </div>
      <div className="px-5 py-4 space-y-3">
        {[
          { label: "Contract Value", value: totalContract, pct: 100, color: "from-violet-600 to-violet-400", textColor: "text-violet-400" },
          { label: "Earned Revenue", value: totalEarnedRevenue, pct: earnedPct, color: "from-sky-600 to-sky-400", textColor: "text-sky-400" },
          { label: "Billed to Date", value: totalBilledToDate, pct: billedPct, color: "from-emerald-600 to-emerald-400", textColor: "text-emerald-400" },
          { label: "Cost Incurred", value: totalCostIncurred, pct: costPct, color: "from-rose-600 to-rose-400", textColor: "text-rose-400" },
        ].map((item) => (
          <div key={item.label}>
            <div className="flex justify-between text-[10px] mb-1">
              <span className={`${item.textColor} font-semibold`}>{item.label}</span>
              <span className={`font-mono font-bold ${item.textColor}`}>{fmt(item.value)}</span>
            </div>
            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
              <motion.div
                className={`h-full bg-gradient-to-r ${item.color} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${item.pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PROGRESS RING ────────────────────────────────────────────────────────────
function ProgressRing({
  value,
  size = 40,
  strokeWidth = 3,
  color = "stroke-primary",
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, value)) / 100) * circ;
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-white/10"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
        className={color}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
    </svg>
  );
}

// ─── WIP ENTRY MODAL ──────────────────────────────────────────────────────────
function WIPModal({
  initial,
  onSave,
  onClose,
  loading,
  project,
}: {
  initial: WIPFormData & { id?: number };
  onSave: (d: WIPFormData) => void;
  onClose: () => void;
  loading: boolean;
  project?: Project;
}) {
  const [form, setForm] = useState<WIPFormData>({ ...initial });
  const isEdit = Boolean(initial.id);
  const [autofilling, setAutofilling] = useState(false);
  const [breakdown, setBreakdown] = useState<ProjectFinancials | null>(null);
  const [autofillError, setAutofillError] = useState<string | null>(null);

  const set = <K extends keyof WIPFormData>(k: K, v: WIPFormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  // Pull contract + % from the project, and cost/billed from the expense
  // modules + AR. Contract/percent only applied when `withContract` is true
  // (initial load) so a manual edit isn't clobbered on a later recalc.
  const applyAutofill = useCallback(
    async (withContract: boolean) => {
      const pid = initial.project_id;
      if (!pid) return;
      setAutofilling(true);
      setAutofillError(null);
      try {
        const fin = await api.projectFinancials(pid);
        setBreakdown(fin);
        setForm((p) => ({
          ...p,
          cost_incurred: fin.cost_incurred,
          billed_to_date: fin.billed_to_date,
          ...(withContract
            ? {
                // Contract value = revised budget (original + approved change orders)
                total_contract: fin.revised_budget,
                percent_complete: project?.progress_percent ?? p.percent_complete,
              }
            : {}),
        }));
      } catch (err: unknown) {
        setAutofillError(err instanceof Error ? err.message : "Failed to pull module data");
      } finally {
        setAutofilling(false);
      }
    },
    [initial.project_id, project]
  );

  // On create, auto-populate everything from the project + modules.
  useEffect(() => {
    if (!isEdit) applyAutofill(true);
    else applyAutofill(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-derive billed_status and amount
  useEffect(() => {
    const status = deriveBilledStatus(n0(form.earned_revenue), n0(form.billed_to_date));
    const amount = Math.abs(n0(form.billed_to_date) - n0(form.earned_revenue));
    setForm((p) => ({ ...p, billed_status: status, amount: +amount.toFixed(2) }));
  }, [form.earned_revenue, form.billed_to_date]);

  // Auto-compute earned revenue from contract × percent_complete
  useEffect(() => {
    if (n0(form.total_contract) > 0 && n0(form.percent_complete) > 0) {
      const earned = +(n0(form.total_contract) * (n0(form.percent_complete) / 100)).toFixed(2);
      setForm((p) => ({ ...p, earned_revenue: earned }));
    }
  }, [form.total_contract, form.percent_complete]);

  const isValid =
    n0(form.total_contract) > 0 &&
    n0(form.percent_complete) >= 0 &&
    form.last_update !== "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <motion.div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-3xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl bg-[#0d0d0d]/95"
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">
                {isEdit ? "Edit WIP Entry" : "New WIP Entry"}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                Earned revenue & billing status auto-computed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-xl hover:bg-white/10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[72vh] overflow-y-auto space-y-4">
          {/* Contract */}
          <SectionLabel label="Contract & Progress" dotColor="bg-violet-400" textColor="text-violet-400" />

          {/* Auto-fill banner — pulls contract/%, cost and billing from modules */}
          <div className="rounded-2xl border border-white/15 bg-white/[0.05] backdrop-blur-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M3 3v18h18" />
                    <path d="m7 14 4-4 3 3 5-5" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-tight text-foreground leading-tight">Auto-Fill from Modules</p>
                  <p className="text-[10px] text-muted-foreground truncate">Budget · AP · Job Costs · Taxes · Loans · AR</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => applyAutofill(true)}
                disabled={autofilling}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-primary bg-primary/10 border border-primary/25 hover:bg-primary/15 hover:border-primary/40 active:scale-95 transition-all disabled:opacity-50"
              >
                {autofilling ? (
                  <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M23 4v6h-6M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                )}
                Recalculate
              </button>
            </div>

            {/* Cost breakdown — hairline-divided metric cells */}
            {breakdown && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-white/[0.06]">
                {[
                  { label: "AP",       value: fmt(breakdown.ap_cost),       emphasis: false },
                  { label: "Job Costs",value: fmt(breakdown.job_cost),      emphasis: false },
                  { label: "Taxes",    value: fmt(breakdown.tax_cost),      emphasis: false },
                  { label: "Loans",    value: fmt(breakdown.loan_cost),     emphasis: false },
                  { label: "Payroll",  value: fmt(breakdown.payroll_cost),  emphasis: false },
                  { label: "Total Cost",value: fmt(breakdown.cost_incurred),emphasis: true  },
                ].map((c) => (
                  <div
                    key={c.label}
                    className={`px-4 py-2.5 transition-colors hover:bg-white/[0.03] ${c.emphasis ? "bg-rose-500/[0.08]" : "bg-[#0e1015]/60"}`}
                  >
                    <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-medium mb-1">{c.label}</p>
                    <p className={`text-xs font-mono tabular-nums tracking-tight ${c.emphasis ? "text-rose-300 font-bold" : "text-foreground/80"}`}>
                      {c.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Footnotes */}
            {(breakdown?.approved_changes || autofillError || breakdown?.revised_budget === 0) && (
              <div className="px-4 py-2.5 border-t border-white/8 space-y-1">
                {breakdown && breakdown.approved_changes > 0 && (
                  <p className="text-[10px] text-emerald-400/80 font-mono tabular-nums">
                    Contract = original {fmt(breakdown.original_budget)} + approved COs {fmt(breakdown.approved_changes)} = {fmt(breakdown.revised_budget)}
                  </p>
                )}
                {autofillError && (
                  <p className="text-[10px] text-rose-400">⚠️ {autofillError}</p>
                )}
                {breakdown && breakdown.revised_budget === 0 && (
                  <p className="text-[10px] text-amber-400/80">
                    ⚠️ This project has no budget set — Total Contract will be 0. Set the project budget to populate it.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Total Contract Value (KES) *">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.total_contract || ""}
                onChange={(e) => set("total_contract", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
            <Field label="Percent Complete (%) *" hint="Earned revenue = contract × % complete">
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.percent_complete || ""}
                  onChange={(e) => set("percent_complete", parseFloat(e.target.value) || 0)}
                  placeholder="0.0"
                  className={inputCls + " pr-8"}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">%</span>
              </div>
            </Field>
            <Field label="Cost Incurred (KES)" hint="Auto-summed from AP, Job Costs, Taxes & Loans — editable">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.cost_incurred || ""}
                onChange={(e) => set("cost_incurred", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
            <Field label="Earned Revenue (KES)" hint="Auto-calculated from contract × %">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.earned_revenue || ""}
                onChange={(e) => set("earned_revenue", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Billing */}
          <SectionLabel label="Billing" dotColor="bg-emerald-400" textColor="text-emerald-400" sub="billed to date vs earned determines status" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Billed to Date (KES)" hint="Auto-pulled from Accounts Receivable — editable">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.billed_to_date || ""}
                onChange={(e) => set("billed_to_date", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
            <Field label="Billed Status (auto-derived)">
              <Select
                value={form.billed_status}
                onChange={(v) => set("billed_status", v as BilledStatus)}
                options={BILLED_STATUSES.map((s) => ({
                  value: s,
                  label: BILLED_STYLE[s].label,
                }))}
              />
            </Field>
          </div>

          {/* Variance preview */}
          {(n0(form.earned_revenue) > 0 || n0(form.billed_to_date) > 0) && (() => {
            const variance = n0(form.billed_to_date) - n0(form.earned_revenue);
            const style = BILLED_STYLE[form.billed_status];
            return (
              <div className={`rounded-xl px-4 py-3 border flex items-center justify-between ${
                form.billed_status === "overbilled"
                  ? "bg-rose-950/30 border-rose-500/20"
                  : form.billed_status === "underbilled"
                  ? "bg-amber-950/30 border-amber-500/20"
                  : "bg-emerald-950/20 border-emerald-500/20"
              }`}>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
                    Billing Variance
                  </span>
                  <span className={`text-[9px] ${style.accent}`}>{style.label}</span>
                </div>
                <span className={`text-lg font-black tabular-nums ${style.accent}`}>
                  {variance >= 0 ? "+" : ""}{fmt(variance)}
                </span>
              </div>
            );
          })()}

          {/* References */}
          <SectionLabel label="References & Dates" dotColor="bg-sky-400" textColor="text-sky-400" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <COAAccountSelect
              value={form.account ?? null}
              onChange={(v) => set("account", v || null)}
              filter="all"
              valueField="code"
              label="Account Code"
              hint="Select an account from the Chart of Accounts"
            />
            <COAAccountSelect
              value={form.code_receivable ?? null}
              onChange={(v) => set("code_receivable", v || null)}
              filter="receivable"
              valueField="code"
              label="Code Receivable"
              hint="Select a receivable account for billing"
            />
            <Field label="Last Update Date *">
              <input
                type="date"
                value={form.last_update}
                onChange={(e) => set("last_update", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Amount (KES)" hint="Auto-computed: |billed − earned|">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount || ""}
                onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value || null)}
              rows={2}
              placeholder="Additional remarks…"
              className={inputCls + " resize-none"}
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={loading || !isValid}
            className="px-6 py-2.5 text-sm font-bold rounded-2xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
          >
            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEdit ? "Save Changes" : "Add WIP Entry"}
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
  entry: WIPEntry;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-2xl bg-[#0d0d0d]/95"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18 }}
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Delete WIP Entry</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Permanently remove this WIP record for{" "}
              <span className="text-foreground font-semibold">
                {fmtDate(entry.last_update)}
              </span>
              ? This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Delete Entry
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── PROJECT CARD ─────────────────────────────────────────────────────────────
function ProjectCard({
  project,
  onSelect,
  wipCount,
}: {
  project: Project;
  onSelect: (p: Project) => void;
  wipCount: number;
}) {
  const status = project.status ?? "planning";
  const statusCls = PROJECT_STATUS_STYLE[status] ?? PROJECT_STATUS_STYLE.planning;

  return (
    <motion.button
      onClick={() => onSelect(project)}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="w-full text-left rounded-2xl border border-white/10 backdrop-blur-xl bg-white/4 p-5 hover:border-primary/35 hover:bg-white/7 transition-all duration-200 shadow-sm group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg tracking-tight font-bold">
            {project.project_number}
          </span>
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusCls}`}>
            {status.replace(/_/g, " ")}
          </span>
        </div>
        {wipCount > 0 && (
          <span className="text-[9px] bg-white/5 border border-white/10 text-muted-foreground px-2 py-0.5 rounded-full tabular-nums flex-shrink-0">
            {wipCount} WIP {wipCount === 1 ? "record" : "records"}
          </span>
        )}
      </div>
      <h3 className="font-bold text-foreground text-sm mb-1.5 group-hover:text-primary transition-colors line-clamp-1">
        {project.title}
      </h3>
      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
          {project.description}
        </p>
      )}
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
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              initial={{ width: 0 }}
              animate={{ width: `${project.progress_percent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      )}
      <div className="flex items-center gap-1 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
        Open WIP Report →
      </div>
    </motion.button>
  );
}

// ─── PROJECT PICKER ───────────────────────────────────────────────────────────
function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [wipCounts, setWipCounts] = useState<Record<string, number>>({});
  const { toasts, push } = useToast();

  useEffect(() => {
    api
      .projects()
      .then(async (data) => {
        setProjects(data);
        if (data.length) {
          const ids = data.map((p) => p.id);
          const { data: rows } = await supabase
            .from("work_in_progress")
            .select("project_id")
            .in("project_id", ids);
          if (rows) {
            const counts: Record<string, number> = {};
            rows.forEach((r: { project_id: string }) => {
              counts[r.project_id] = (counts[r.project_id] ?? 0) + 1;
            });
            setWipCounts(counts);
          }
        }
      })
      .catch((err) => push(err instanceof Error ? err.message : "Failed to load projects", "error"))
      .finally(() => setFetching(false));
  }, [push]);

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        const matchStatus = statusFilter === "all" || p.status === statusFilter;
        const matchSearch =
          !search ||
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.project_number.toLowerCase().includes(search.toLowerCase()) ||
          (p.site_city ?? "").toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchSearch;
      }),
    [projects, search, statusFilter]
  );

  const totalWIP = Object.values(wipCounts).reduce((a, c) => a + c, 0);

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-semibold border backdrop-blur-xl shadow-lg ${
                t.type === "success"
                  ? "bg-emerald-950/90 border-emerald-500/25 text-emerald-300"
                  : "bg-rose-950/90 border-rose-500/25 text-rose-300"
              }`}
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 font-bold flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
                </svg>
                WORK IN PROGRESS · KES · 2026
              </p>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black leading-none tracking-tighter">
                Work{" "}
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  In Progress
                </span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground mt-3 max-w-xl">
                Track contract values, earned revenue, cost incurred and billing status per project.
              </p>
            </div>
            {totalWIP > 0 && (
              <div className="flex gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center min-w-[80px]">
                  <p className="text-2xl font-black tabular-nums text-foreground">{totalWIP}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">WIP Records</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center min-w-[80px]">
                  <p className="text-2xl font-black tabular-nums text-foreground">{projects.length}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Projects</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects by name, number or city…"
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "All Statuses" },
              ...Array.from(new Set(projects.map((p) => p.status ?? "planning"))).map((s) => ({
                value: s,
                label: s.replace(/_/g, " ").toUpperCase(),
              })),
            ]}
          />
        </div>

        {fetching ? (
          <div className="flex items-center justify-center py-32 text-muted-foreground">
            <span className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-3" />
            Loading projects…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 text-muted-foreground">No projects found.</div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } }, hidden: {} }}
          >
            {filtered.map((p) => (
              <motion.div key={p.id} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
                <ProjectCard project={p} onSelect={onSelect} wipCount={wipCounts[p.id] ?? 0} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── WIP ROW ──────────────────────────────────────────────────────────────────
function WIPRow({
  entry,
  canEdit,
  onEdit,
  onDelete,
}: {
  entry: WIPEntry;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const s = BILLED_STYLE[entry.billed_status];
  const [expanded, setExpanded] = useState(false);
  const completePct = n0(entry.percent_complete);
  const variance = n0(entry.billed_to_date) - n0(entry.earned_revenue);

  return (
    <>
      <motion.tr
        className={`border-b border-white/8 cursor-pointer transition-colors ${s.row}`}
        onClick={() => setExpanded((x) => !x)}
      >
        {/* Date */}
        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
          {fmtDate(entry.last_update)}
        </td>
        {/* Progress */}
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <ProgressRing
              value={completePct}
              size={36}
              strokeWidth={3}
              color={
                completePct >= 75
                  ? "stroke-emerald-400"
                  : completePct >= 40
                  ? "stroke-sky-400"
                  : "stroke-amber-400"
              }
            />
            <span className="text-xs font-bold tabular-nums">{pct(completePct)}</span>
          </div>
        </td>
        {/* Contract */}
        <td className="px-4 py-3.5 tabular-nums text-xs font-semibold text-right">
          <span className="text-violet-400">{fmt(entry.total_contract)}</span>
        </td>
        {/* Cost Incurred */}
        <td className="px-4 py-3.5 tabular-nums text-xs font-semibold text-right hidden sm:table-cell">
          <span className="text-rose-400">{fmt(entry.cost_incurred)}</span>
        </td>
        {/* Earned Revenue */}
        <td className="px-4 py-3.5 tabular-nums text-xs font-semibold text-right">
          <span className="text-sky-400">{fmt(entry.earned_revenue)}</span>
        </td>
        {/* Billed to Date */}
        <td className="px-4 py-3.5 tabular-nums text-xs font-semibold text-right">
          <span className="text-emerald-400">{fmt(entry.billed_to_date)}</span>
        </td>
        {/* Variance */}
        <td className="px-4 py-3.5 tabular-nums text-xs font-semibold text-right hidden md:table-cell">
          <span className={variance > 0 ? "text-rose-400" : variance < 0 ? "text-amber-400" : "text-emerald-400"}>
            {variance >= 0 ? "+" : ""}{fmt(variance)}
          </span>
        </td>
        {/* Status */}
        <td className="px-4 py-3.5">
          <Badge className={`text-[9px] font-bold ${s.badge}`}>{s.label}</Badge>
        </td>
        {/* Account */}
        <td className="px-4 py-3.5 hidden lg:table-cell">
          {entry.account ? (
            <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
              {entry.account}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </td>
        {/* Code Receivable */}
        <td className="px-4 py-3.5 text-xs text-muted-foreground hidden lg:table-cell">
          {entry.code_receivable ?? "—"}
        </td>
        {/* Actions */}
        {canEdit && (
          <td className="px-4 py-3.5">
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={onEdit}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-white/8 font-medium"
              >
                Edit
              </button>
              <button
                onClick={onDelete}
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 rounded-lg hover:bg-rose-500/10 font-medium"
              >
                Del
              </button>
            </div>
          </td>
        )}
      </motion.tr>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white/2"
          >
            <td colSpan={canEdit ? 11 : 10} className="px-6 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-[10px]">
                {[
                  { label: "Total Contract", value: fmt(entry.total_contract) },
                  { label: "Cost Incurred", value: fmt(entry.cost_incurred) },
                  { label: "% Complete", value: pct(entry.percent_complete) },
                  { label: "Earned Revenue", value: fmt(entry.earned_revenue) },
                  { label: "Billed to Date", value: fmt(entry.billed_to_date) },
                  { label: "Billing Variance", value: `${variance >= 0 ? "+" : ""}${fmt(variance)}` },
                  { label: "Amount", value: fmt(entry.amount) },
                  { label: "Account", value: entry.account || "—" },
                  { label: "Code Receivable", value: entry.code_receivable || "—" },
                  { label: "Last Update", value: fmtDate(entry.last_update) },
                  ...(entry.notes ? [{ label: "Notes", value: entry.notes }] : []),
                ].map((item) => (
                  <div key={item.label} className="bg-white/4 rounded-xl p-3 border border-white/8">
                    <p className="text-muted-foreground uppercase tracking-wider mb-1 text-[9px] font-bold">{item.label}</p>
                    <p className="font-mono font-semibold text-foreground text-[11px]">{item.value}</p>
                  </div>
                ))}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── WIP VIEW ─────────────────────────────────────────────────────────────────
function WIPView({
  project,
  canEdit,
  onBack,
}: {
  project: Project;
  canEdit: boolean;
  onBack: () => void;
}) {
  const [entries, setEntries] = useState<WIPEntry[]>([]);
  const [financials, setFinancials] = useState<ProjectFinancials | null>(null);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<BilledStatus | "All">("All");
  const [modal, setModal] = useState<null | "create" | "edit">(null);
  const [editing, setEditing] = useState<WIPEntry | null>(null);
  const [deleting, setDeleting] = useState<WIPEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const { toasts, push } = useToast();

  const fetchEntries = useCallback(async () => {
    setFetching(true);
    try {
      const [data, fin] = await Promise.all([
        api.list(project.id),
        api.projectFinancials(project.id).catch(() => null),
      ]);
      setEntries(data);
      setFinancials(fin);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to load WIP entries", "error");
    } finally {
      setFetching(false);
    }
  }, [project.id, push]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleCreate = async (form: WIPFormData) => {
    setSaving(true);
    try {
      const row = await api.create({ ...form, project_id: project.id });
      setEntries((p) => [row, ...p]);
      push("WIP entry added ✓");
      setModal(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to add entry", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: WIPFormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      setEntries((p) => p.map((e) => (e.id === editing.id ? row : e)));
      push("WIP entry updated ✓");
      setModal(null);
      setEditing(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to update", "error");
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
      push("WIP entry deleted");
      setDeleting(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        const statusMatch = filterStatus === "All" || e.billed_status === filterStatus;
        const searchMatch =
          !search ||
          (e.account ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (e.code_receivable ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (e.notes ?? "").toLowerCase().includes(search.toLowerCase());
        return statusMatch && searchMatch;
      }),
    [entries, filterStatus, search]
  );

  // Summary stats
  const totalContract = entries.reduce((a, e) => a + n0(e.total_contract), 0);
  const totalCostIncurred = entries.reduce((a, e) => a + n0(e.cost_incurred), 0);
  const totalEarnedRevenue = entries.reduce((a, e) => a + n0(e.earned_revenue), 0);
  const totalBilledToDate = entries.reduce((a, e) => a + n0(e.billed_to_date), 0);
  const overbilledCount = entries.filter((e) => e.billed_status === "overbilled").length;
  const underbilledCount = entries.filter((e) => e.billed_status === "underbilled").length;
  const onBudgetCount = entries.filter((e) => e.billed_status === "on_budget").length;
  const avgComplete =
    entries.length > 0
      ? entries.reduce((a, e) => a + n0(e.percent_complete), 0) / entries.length
      : 0;

  const TABLE_HEADERS = [
    "Last Update", "% Complete", "Total Contract", "Cost Incurred",
    "Earned Revenue", "Billed to Date", "Variance",
    "Status", "Account", "Code Recv.",
    ...(canEdit ? ["Actions"] : []),
  ];
  const HEADER_ALIGN = [
    "text-left", "text-left", "text-right", "text-right hidden sm:table-cell",
    "text-right", "text-right", "text-right hidden md:table-cell",
    "text-left", "text-left hidden lg:table-cell", "text-left hidden lg:table-cell",
    ...(canEdit ? ["text-left"] : []),
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-semibold border backdrop-blur-xl shadow-lg ${
                t.type === "success"
                  ? "bg-emerald-950/90 border-emerald-500/25 text-emerald-300"
                  : "bg-rose-950/90 border-rose-500/25 text-rose-300"
              }`}
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal === "create" && (
          <WIPModal
            initial={makeEmptyForm(project.id)}
            onSave={handleCreate}
            onClose={() => setModal(null)}
            loading={saving}
            project={project}
          />
        )}
        {modal === "edit" && editing && (
          <WIPModal
            initial={{ ...editing }}
            onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
            project={project}
          />
        )}
        {deleting && (
          <DeleteConfirm
            entry={deleting}
            onConfirm={handleDelete}
            onClose={() => setDeleting(null)}
            loading={saving}
          />
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-10 max-w-[1400px]">
        {/* Back */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors group"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7" />
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
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tighter bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-none mt-1">
            {project.title}
          </h1>
          {project.site_city && (
            <p className="text-base text-muted-foreground mt-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              {project.site_city}{project.site_country ? `, ${project.site_country}` : ""}
            </p>
          )}
        </div>

        {/* Live Project Financials — auto-pulled from project + modules + AR */}
        {(() => {
          const liveContract = financials ? n0(financials.revised_budget) : n0(project.budget_numeric);
          const livePercent = n0(project.progress_percent);
          const liveEarned = +(liveContract * (livePercent / 100)).toFixed(2);
          const liveCost = n0(financials?.cost_incurred);
          const liveBilled = n0(financials?.billed_to_date);
          const grossProfit = liveContract - liveCost;
          const contractNote = financials && financials.approved_changes > 0
            ? `incl. ${fmt(financials.approved_changes)} approved COs`
            : (liveContract === 0 ? "no budget set" : "original + approved COs");
          const marginPct = liveContract > 0 ? (grossProfit / liveContract) * 100 : 0;
          const cells = [
            { label: "Contract Value", value: fmt(liveContract), color: "text-foreground",   note: contractNote },
            { label: "Completion",     value: pct(livePercent),  color: "text-primary",       note: "project progress" },
            { label: "Earned Revenue", value: fmt(liveEarned),   color: "text-foreground/90", note: "contract × completion" },
            { label: "Cost Incurred",  value: fmt(liveCost),     color: "text-rose-300",      note: "AP · Job · Tax · Loans" },
            { label: "Billed to Date", value: fmt(liveBilled),   color: "text-emerald-300",   note: "from receivables" },
            { label: "Gross Profit",   value: fmt(grossProfit),  color: grossProfit >= 0 ? "text-emerald-400" : "text-rose-400", note: `${marginPct >= 0 ? "+" : ""}${marginPct.toFixed(1)}% margin` },
          ];
          return (
            <div className="mb-8 rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M3 3v18h18" />
                      <path d="m7 14 4-4 3 3 5-5" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground leading-tight">
                      Project Financials
                    </h3>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Auto-consolidated from Budget, AP, Job Costs, Taxes, Loans &amp; AR
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/70" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    Live
                  </span>
                  <button
                    onClick={fetchEntries}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground border border-white/10 hover:bg-white/5 hover:border-white/20 transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Refresh
                  </button>
                </div>
              </div>
              {/* Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-white/[0.06]">
                {cells.map((c) => (
                  <div
                    key={c.label}
                    className="px-5 py-4 bg-[#0e1015]/60 transition-colors hover:bg-white/[0.03]"
                  >
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium mb-1.5">
                      {c.label}
                    </p>
                    <p className={`text-base lg:text-lg font-bold font-mono tabular-nums tracking-tight leading-none ${c.color}`}>
                      {c.value}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1.5 truncate">{c.note}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Summary Strip + WIP Bars */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Status pills + avg completion */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {BILLED_STATUSES.map((st) => {
              const s = BILLED_STYLE[st];
              const count = entries.filter((e) => e.billed_status === st).length;
              const isActive = filterStatus === st;
              return (
                <button
                  key={st}
                  onClick={() => setFilterStatus(isActive ? "All" : st)}
                  className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                    isActive ? "border-white/30 bg-white/8 shadow-lg" : "border-white/8 hover:border-white/20 bg-white/3 hover:bg-white/5"
                  }`}
                >
                  <div className={`text-[9px] uppercase tracking-widest font-black mb-1 ${s.accent}`}>{s.label}</div>
                  <div className="text-2xl sm:text-3xl font-black tabular-nums">{count}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">entries</div>
                </button>
              );
            })}
            {/* Avg completion */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-4 flex flex-col justify-between">
              <div className="text-[9px] uppercase tracking-widest font-black text-primary mb-2">Avg Complete</div>
              <div className="flex items-center gap-3">
                <ProgressRing value={avgComplete} size={44} strokeWidth={4} color="stroke-primary" />
                <div>
                  <div className="text-2xl font-black tabular-nums">{pct(avgComplete)}</div>
                  <div className="text-[9px] text-muted-foreground">{entries.length} entries</div>
                </div>
              </div>
            </div>
          </div>

          {/* WIP Summary Bars */}
          <WIPSummaryBars
            totalContract={totalContract}
            totalEarnedRevenue={totalEarnedRevenue}
            totalBilledToDate={totalBilledToDate}
            totalCostIncurred={totalCostIncurred}
          />
        </div>

        {/* Main Card */}
        <Card className="backdrop-blur-xl bg-white/5 border border-white/12 rounded-2xl shadow-xl overflow-hidden">
          <CardHeader className="pb-0 border-b border-white/8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5">
              <div>
                <CardTitle className="text-2xl font-black">Work In Progress</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click any row to expand full entry detail · Earned revenue auto-computed from contract × %
                </p>
              </div>
              {canEdit && (
                <button
                  onClick={() => setModal("create")}
                  className="flex-shrink-0 px-5 py-2.5 rounded-2xl font-bold text-sm text-primary-foreground flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                  style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New WIP Entry
                </button>
              )}
            </div>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 pb-4">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by account code, receivable or notes…"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>
              <Select
                value={filterStatus}
                onChange={(v) => setFilterStatus(v as BilledStatus | "All")}
                options={[
                  { value: "All", label: "All Statuses" },
                  ...BILLED_STATUSES.map((s) => ({ value: s, label: BILLED_STYLE[s].label })),
                ]}
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-28 text-muted-foreground">
                <span className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-3" />
                Loading WIP data…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 text-muted-foreground gap-3">
                <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
                </svg>
                <p className="text-sm">No WIP entries yet</p>
                {canEdit && (
                  <button onClick={() => setModal("create")} className="text-sm text-primary hover:underline">
                    Add the first WIP entry →
                  </button>
                )}
              </div>
            ) : (
              <>
              {/* Mobile card list — no horizontal scroll */}
              <div className="md:hidden divide-y divide-white/8">
                {filtered.map((entry) => {
                  const s = BILLED_STYLE[entry.billed_status];
                  const variance = n0(entry.billed_to_date) - n0(entry.earned_revenue);
                  const meta = [
                    { label: "% Complete",     node: pct(entry.percent_complete) },
                    { label: "Earned Revenue", node: fmt(entry.earned_revenue) },
                    { label: "Variance",       node: `${variance >= 0 ? "+" : ""}${fmt(variance)}` },
                    { label: "Amount",         node: fmt(entry.amount) },
                    { label: "Account",        node: entry.account || "—" },
                    { label: "Code Recv.",     node: entry.code_receivable || "—" },
                  ];
                  return (
                    <div key={entry.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm">{fmtDate(entry.last_update)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{pct(entry.percent_complete)} complete</p>
                        </div>
                        <Badge className={`text-[9px] font-bold shrink-0 ${s.badge}`}>{s.label}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { l: "Contract", v: fmt(entry.total_contract), c: "text-violet-400" },
                          { l: "Cost",     v: fmt(entry.cost_incurred),  c: "text-rose-400" },
                          { l: "Billed",   v: fmt(entry.billed_to_date), c: "text-emerald-400" },
                        ].map(a => (
                          <div key={a.l} className="rounded-lg bg-white/5 border border-white/8 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">{a.l}</p>
                            <p className={`text-xs font-mono font-bold tabular-nums ${a.c}`}>{a.v}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {meta.map((m, mi) => (
                          <div key={mi} className="flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{m.label}</span>
                            <span className="font-mono text-xs text-muted-foreground/90 truncate text-right">{m.node}</span>
                          </div>
                        ))}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/8">
                          <button onClick={() => { setEditing(entry); setModal("edit"); }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground border border-white/10 hover:bg-white/5 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Edit
                          </button>
                          <button onClick={() => setDeleting(entry)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:bg-rose-500/10 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/3">
                      {TABLE_HEADERS.map((h, i) => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap ${HEADER_ALIGN[i]}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((entry) => (
                      <WIPRow
                        key={entry.id}
                        entry={entry}
                        canEdit={canEdit}
                        onEdit={() => { setEditing(entry); setModal("edit"); }}
                        onDelete={() => setDeleting(entry)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}

            {/* Footer Summary */}
            {entries.length > 0 && (
              <div className="border-t border-white/12 bg-white/3">
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                      Summary — {entries.length} entries
                    </span>
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold ml-auto">
                      {filtered.length} shown
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Total Contract", value: totalContract, color: "text-violet-400", sub: "KES" },
                      { label: "Cost Incurred", value: totalCostIncurred, color: "text-rose-400", sub: "KES" },
                      { label: "Earned Revenue", value: totalEarnedRevenue, color: "text-sky-400", sub: "KES" },
                      {
                        label: "Billing Variance",
                        value: totalBilledToDate - totalEarnedRevenue,
                        color: totalBilledToDate - totalEarnedRevenue > 0 ? "text-rose-400" : totalBilledToDate - totalEarnedRevenue < 0 ? "text-amber-400" : "text-emerald-400",
                        sub: totalBilledToDate - totalEarnedRevenue > 0 ? "Overbilled" : totalBilledToDate - totalEarnedRevenue < 0 ? "Underbilled" : "On Budget",
                      },
                    ].map((item) => (
                      <div key={item.label} className="bg-white/4 rounded-xl p-3 border border-white/8">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">{item.label}</p>
                          <span className="text-[9px] font-bold text-muted-foreground/60">{item.sub}</span>
                        </div>
                        <p className={`text-sm font-black tabular-nums tracking-tight ${item.color}`}>
                          {fmt(item.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
interface Props {
  projectId?: string;
  canEdit?: boolean;
}

export default function WorkInProgressPage({ projectId, canEdit = true }: Props) {
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
        <motion.div
          key="wip"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <WIPView project={selectedProject} canEdit={canEdit} onBack={() => setSelectedProject(null)} />
        </motion.div>
      ) : (
        <motion.div
          key="picker"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <ProjectPickerView onSelect={setSelectedProject} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}