"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Project {
  id:                       string;
  project_number:           string;
  title:                    string;
  description:              string | null;
  status:                   string | null;
  progress_percent:         number | null;
  budget_numeric:           number | null;
  currency:                 string | null;
  site_address:             string | null;
  site_city:                string | null;
  site_country:             string | null;
  start_date:               string | null;
  expected_completion_date: string | null;
  created_at:               string;
}

type LoanType        = "Term Loan" | "Asset Finance" | "Overdraft" | "Revolving Credit" | "Mortgage" | "Invoice Discounting" | "Other";
type InterestType    = "Fixed" | "Variable" | "CBR-Linked";
type RepayFrequency  = "Monthly" | "Quarterly" | "Semi-Annual" | "Annual" | "Bullet";
type PaymentStatus   = "Paid" | "Partially Paid" | "Due" | "Overdue" | "Waived";
type WithholdingApplicable = "Yes" | "No";

interface Loan {
  id:                         number;
  project_id:                 string;
  // Facility details
  facility_ref:               string;
  lender_name:                string;
  loan_type:                  LoanType;
  purpose:                    string;
  loan_start_date:            string;
  tenure_months:              number;
  repayment_frequency:        RepayFrequency;
  // Principal & Rate
  principal_approved_kes:     number;
  interest_rate_pa:           number;         // % p.a.
  interest_type:              InterestType;
  // Period schedule
  opening_balance:            number;
  installment_due:            number;
  principal_portion:          number;
  interest_portion:           number;
  // Kenyan tax fields
  withholding_tax_applicable: WithholdingApplicable; // KRA WHT on interest: 15% residents / 15% NR banks
  withholding_tax_rate:       number;                // e.g. 15
  withholding_tax_amount:     number;                // COMPUTED: interest_portion * wht_rate / 100
  net_interest_payable:       number;                // COMPUTED: interest_portion - withholding_tax_amount
  interest_deductible_ita:    WithholdingApplicable; // s.15(1) ITA – is interest deductible?
  thin_cap_flag:              boolean;               // Thin-cap alert: debt/equity > 3:1 (s.16(2) ITA)
  // Fees
  fees_and_charges:           number;
  total_due:                  number;                // COMPUTED: principal + net_interest + fees
  // Payment
  due_date:                   string;
  amount_paid:                number;
  payment_date:               string | null;
  closing_balance:            number;                // COMPUTED: opening - principal_portion
  payment_status:             PaymentStatus;
  days_in_arrears:            number;
  next_due_date:              string | null;
  date_period:                string;                // e.g. 2026-Q1
  notes:                      string | null;
  created_at?:                string;
  updated_at?:                string;
}

type LoanFormData = Omit<Loan, "id" | "created_at" | "updated_at">;

interface Props {
  projectId?: string;
  canEdit?:   boolean;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const LOAN_TYPES:       LoanType[]       = ["Term Loan","Asset Finance","Overdraft","Revolving Credit","Mortgage","Invoice Discounting","Other"];
const INTEREST_TYPES:   InterestType[]   = ["Fixed","Variable","CBR-Linked"];
const REPAY_FREQS:      RepayFrequency[] = ["Monthly","Quarterly","Semi-Annual","Annual","Bullet"];
const PAYMENT_STATUSES: PaymentStatus[]  = ["Paid","Partially Paid","Due","Overdue","Waived"];

// Kenya WHT rates (Income Tax Act Cap.470):
// s.35(1)(a) – interest paid to resident individual/company: 15%
// s.35(3)(b) – interest paid to non-resident bank: 15%
// Thin-cap rule s.16(2): total debt/equity ratio > 3:1 → excess interest disallowed
const KE_WHT_RESIDENT    = 15;
const KE_WHT_NR_BANK     = 15;
const KE_THIN_CAP_RATIO  = 3;

const STATUS_STYLE: Record<string, string> = {
  planning:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  on_hold:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const PAYMENT_STATUS_STYLE: Record<PaymentStatus, string> = {
  "Paid":           "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  "Partially Paid": "bg-yellow-500/10  border-yellow-500/30  text-yellow-300",
  "Due":            "bg-sky-500/10     border-sky-500/30     text-sky-300",
  "Overdue":        "bg-rose-500/10    border-rose-500/30    text-rose-300",
  "Waived":         "bg-slate-500/10   border-slate-500/30   text-slate-300",
};

const LOAN_TYPE_STYLE: Record<LoanType, { dot: string; accent: string; badge: string; row: string }> = {
  "Term Loan":           { dot: "bg-violet-400",  accent: "text-violet-400",  badge: "bg-violet-500/10  border-violet-500/30  text-violet-300",  row: "hover:bg-violet-950/30"  },
  "Asset Finance":       { dot: "bg-amber-400",   accent: "text-amber-400",   badge: "bg-amber-500/10   border-amber-500/30   text-amber-300",   row: "hover:bg-amber-950/30"   },
  "Overdraft":           { dot: "bg-rose-400",    accent: "text-rose-400",    badge: "bg-rose-500/10    border-rose-500/30    text-rose-300",    row: "hover:bg-rose-950/30"    },
  "Revolving Credit":    { dot: "bg-cyan-400",    accent: "text-cyan-400",    badge: "bg-cyan-500/10    border-cyan-500/30    text-cyan-300",    row: "hover:bg-cyan-950/30"    },
  "Mortgage":            { dot: "bg-orange-400",  accent: "text-orange-400",  badge: "bg-orange-500/10  border-orange-500/30  text-orange-300",  row: "hover:bg-orange-950/30"  },
  "Invoice Discounting": { dot: "bg-pink-400",    accent: "text-pink-400",    badge: "bg-pink-500/10    border-pink-500/30    text-pink-300",    row: "hover:bg-pink-950/30"    },
  "Other":               { dot: "bg-slate-400",   accent: "text-slate-400",   badge: "bg-slate-500/10   border-slate-500/30   text-slate-300",   row: "hover:bg-slate-950/30"   },
};

// ─── KENYA TAX COMPUTATIONS ───────────────────────────────────────────────────
// All calculations per Kenya Income Tax Act Cap. 470 & Finance Acts

/**
 * Compute WHT amount on interest (ITA s.35).
 * Rate: 15% for both resident and non-resident banks.
 */
function computeWHT(interestPortion: number, applicable: WithholdingApplicable, rate: number): number {
  if (applicable !== "Yes") return 0;
  return parseFloat(((interestPortion * rate) / 100).toFixed(2));
}

/**
 * Net interest payable after deducting WHT already remitted to KRA.
 * Borrower remits WHT to KRA and pays lender the net.
 */
function computeNetInterest(interestPortion: number, whtAmount: number): number {
  return parseFloat((interestPortion - whtAmount).toFixed(2));
}

/**
 * Total due = principal_portion + net_interest_payable + fees_and_charges.
 * WHT is remitted to KRA separately; lender receives net interest.
 */
function computeTotalDue(principal: number, netInterest: number, fees: number): number {
  return parseFloat((principal + netInterest + fees).toFixed(2));
}

/**
 * Closing balance = opening_balance - principal_portion.
 */
function computeClosingBalance(opening: number, principal: number): number {
  return parseFloat(Math.max(0, opening - principal).toFixed(2));
}

/**
 * Thin-cap check (ITA s.16(2) & s.16(3)).
 * If total interest-bearing debt > 3× equity, flag true.
 * We approximate here by checking if a flag is manually set or auto-derived.
 * In practice this needs equity figure; we expose the flag for the user.
 */
function thinCapFlag(principalApproved: number, equity: number): boolean {
  if (equity <= 0) return false;
  return principalApproved / equity > KE_THIN_CAP_RATIO;
}

// ─── DERIVED FORM HELPERS ─────────────────────────────────────────────────────

function deriveComputedFields(f: LoanFormData): LoanFormData {
  const wht      = computeWHT(f.interest_portion, f.withholding_tax_applicable, f.withholding_tax_rate);
  const netInt   = computeNetInterest(f.interest_portion, wht);
  const totalDue = computeTotalDue(f.principal_portion, netInt, f.fees_and_charges);
  const closing  = computeClosingBalance(f.opening_balance, f.principal_portion);
  return {
    ...f,
    withholding_tax_amount: wht,
    net_interest_payable:   netInt,
    total_due:              totalDue,
    closing_balance:        closing,
  };
}

const makeEmptyForm = (projectId: string): LoanFormData => ({
  project_id:                 projectId,
  facility_ref:               "",
  lender_name:                "",
  loan_type:                  "Term Loan",
  purpose:                    "",
  loan_start_date:            new Date().toISOString().split("T")[0],
  tenure_months:              12,
  repayment_frequency:        "Monthly",
  principal_approved_kes:     0,
  interest_rate_pa:           0,
  interest_type:              "Fixed",
  opening_balance:            0,
  installment_due:            0,
  principal_portion:          0,
  interest_portion:           0,
  withholding_tax_applicable: "Yes",
  withholding_tax_rate:       KE_WHT_RESIDENT,
  withholding_tax_amount:     0,
  net_interest_payable:       0,
  interest_deductible_ita:    "Yes",
  thin_cap_flag:              false,
  fees_and_charges:           0,
  total_due:                  0,
  due_date:                   "",
  amount_paid:                0,
  payment_date:               null,
  closing_balance:            0,
  payment_status:             "Due",
  days_in_arrears:            0,
  next_due_date:              null,
  date_period:                "",
  notes:                      null,
});

// ─── FORMATTERS ───────────────────────────────────────────────────────────────

const fmtKES  = (n: number) => `KES ${new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2 }).format(n)}`;
const fmtPct  = (n: number) => `${n}%`;
const fmtC    = (n: number) => new Intl.NumberFormat("en-KE", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ─── API ──────────────────────────────────────────────────────────────────────

function throwSb(error: { message?: string } | null, ctx: string): never {
  throw new Error(error?.message ?? `Supabase error during ${ctx}`);
}

const api = {
  async projects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,currency,site_address,site_city,site_country,start_date,expected_completion_date,created_at")
      .order("created_at", { ascending: false });
    if (error) throwSb(error, "projects");
    return (data ?? []) as Project[];
  },
  async loanCounts(ids: string[]): Promise<Record<string, number>> {
    const { data } = await supabase.from("loans").select("project_id").in("project_id", ids);
    const tally: Record<string, number> = {};
    (data ?? []).forEach((r: { project_id: string }) => {
      tally[r.project_id] = (tally[r.project_id] ?? 0) + 1;
    });
    return tally;
  },
  async list(projectId: string): Promise<Loan[]> {
    const { data, error } = await supabase
      .from("loans")
      .select("*")
      .eq("project_id", projectId)
      .order("loan_start_date", { ascending: false });
    if (error) throwSb(error, "list");
    return (data ?? []) as Loan[];
  },
  async create(body: LoanFormData): Promise<Loan> {
    const { data, error } = await supabase.from("loans").insert([body]).select().single();
    if (error) throwSb(error, "create");
    return data as Loan;
  },
  async update(id: number, body: LoanFormData): Promise<Loan> {
    const { created_at, updated_at, id: _id, ...safe } = body as LoanFormData & Partial<Loan>;
    void created_at; void updated_at; void _id;
    const { data, error } = await supabase
      .from("loans").update({ ...safe, updated_at: new Date().toISOString() })
      .eq("id", id).select().single();
    if (error) throwSb(error, "update");
    return data as Loan;
  },
  async remove(id: number): Promise<void> {
    const { error } = await supabase.from("loans").delete().eq("id", id);
    if (error) throwSb(error, "delete");
  },
};

// ─── TOAST ────────────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);
  const push = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, push };
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/40 transition-all";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground/60 italic">{hint}</span>}
    </div>
  );
}

function SelectField({ label, hint, value, onChange, options }: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void; options: string[];
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className={inputCls + " appearance-none pr-10 font-medium text-sm"}>
          {options.map(o => <option key={o} value={o} className="bg-background text-foreground">{o}</option>)}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </span>
      </div>
    </Field>
  );
}

// ─── LOAN MODAL ───────────────────────────────────────────────────────────────

function LoanModal({ initial, onSave, onClose, loading }: {
  initial: LoanFormData & { id?: number };
  onSave:  (d: LoanFormData) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<LoanFormData>(deriveComputedFields({ ...initial }));
  const isEdit = Boolean(initial.id);

  const set = <K extends keyof LoanFormData>(k: K, v: LoanFormData[K]) =>
    setForm(p => deriveComputedFields({ ...p, [k]: v }));

  // Section tabs for the modal
  const [tab, setTab] = useState<"facility" | "schedule" | "tax" | "payment">("facility");

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "facility", label: "Facility"  },
    { key: "schedule", label: "Schedule"  },
    { key: "tax",      label: "Tax / KRA" },
    { key: "payment",  label: "Payment"   },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-3xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-xl bg-white/10"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.96,  y: 8  }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            {isEdit ? "Edit Loan Record" : "New Loan Record"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-6 pt-4 border-b border-white/10 pb-0">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest rounded-t-lg transition-all ${
                tab === t.key
                  ? "bg-white/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 max-h-[58vh] overflow-y-auto">

          {/* ── TAB: Facility ─────────────────────────────────────────────── */}
          {tab === "facility" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Facility Reference *">
                <input value={form.facility_ref} onChange={e => set("facility_ref", e.target.value)}
                  placeholder="e.g. FAC-001" className={inputCls} />
              </Field>
              <Field label="Lender Name *">
                <input value={form.lender_name} onChange={e => set("lender_name", e.target.value)}
                  placeholder="e.g. KCB Bank Kenya" className={inputCls} />
              </Field>
              <SelectField label="Loan Type *" value={form.loan_type}
                onChange={v => set("loan_type", v as LoanType)} options={LOAN_TYPES} />
              <Field label="Purpose *">
                <input value={form.purpose} onChange={e => set("purpose", e.target.value)}
                  placeholder="e.g. Construction finance" className={inputCls} />
              </Field>
              <Field label="Loan Start Date *">
                <input type="date" value={form.loan_start_date}
                  onChange={e => set("loan_start_date", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Tenure (Months) *">
                <input type="number" min="1" value={form.tenure_months}
                  onChange={e => set("tenure_months", parseInt(e.target.value) || 1)} className={inputCls} />
              </Field>
              <SelectField label="Repayment Frequency *" value={form.repayment_frequency}
                onChange={v => set("repayment_frequency", v as RepayFrequency)} options={REPAY_FREQS} />
              <Field label="Principal Approved (KES) *">
                <input type="number" step="0.01" min="0" value={form.principal_approved_kes}
                  onChange={e => set("principal_approved_kes", parseFloat(e.target.value) || 0)} className={inputCls} />
              </Field>
              <Field label="Interest Rate % P.A. *">
                <input type="number" step="0.01" min="0" value={form.interest_rate_pa}
                  onChange={e => set("interest_rate_pa", parseFloat(e.target.value) || 0)} className={inputCls} />
              </Field>
              <SelectField label="Interest Type *" value={form.interest_type}
                onChange={v => set("interest_type", v as InterestType)} options={INTEREST_TYPES} />
              <div className="col-span-2">
                <Field label="Date Period *" hint="e.g. 2026-Q1, 2026-M01">
                  <input value={form.date_period} onChange={e => set("date_period", e.target.value)}
                    placeholder="2026-Q1" className={inputCls} />
                </Field>
              </div>
            </div>
          )}

          {/* ── TAB: Schedule ─────────────────────────────────────────────── */}
          {tab === "schedule" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Opening Balance (KES)">
                <input type="number" step="0.01" min="0" value={form.opening_balance}
                  onChange={e => set("opening_balance", parseFloat(e.target.value) || 0)} className={inputCls} />
              </Field>
              <Field label="Installment Due (KES)">
                <input type="number" step="0.01" min="0" value={form.installment_due}
                  onChange={e => set("installment_due", parseFloat(e.target.value) || 0)} className={inputCls} />
              </Field>
              <Field label="Principal Portion (KES)">
                <input type="number" step="0.01" min="0" value={form.principal_portion}
                  onChange={e => set("principal_portion", parseFloat(e.target.value) || 0)} className={inputCls} />
              </Field>
              <Field label="Interest Portion (KES)">
                <input type="number" step="0.01" min="0" value={form.interest_portion}
                  onChange={e => set("interest_portion", parseFloat(e.target.value) || 0)} className={inputCls} />
              </Field>
              <Field label="Fees & Charges (KES)">
                <input type="number" step="0.01" min="0" value={form.fees_and_charges}
                  onChange={e => set("fees_and_charges", parseFloat(e.target.value) || 0)} className={inputCls} />
              </Field>
              <Field label="Due Date *">
                <input type="date" value={form.due_date}
                  onChange={e => set("due_date", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Next Due Date">
                <input type="date" value={form.next_due_date ?? ""}
                  onChange={e => set("next_due_date", e.target.value || null)} className={inputCls} />
              </Field>
              <div />

              {/* Computed preview boxes */}
              <div className="col-span-2 grid grid-cols-3 gap-3 mt-2">
                {[
                  { label: "WHT Amount",       value: fmtKES(form.withholding_tax_amount), color: "text-amber-400"   },
                  { label: "Net Interest",      value: fmtKES(form.net_interest_payable),  color: "text-sky-400"     },
                  { label: "Total Due",         value: fmtKES(form.total_due),             color: "text-emerald-400" },
                  { label: "Closing Balance",   value: fmtKES(form.closing_balance),       color: "text-primary"     },
                ].map(box => (
                  <div key={box.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{box.label}</div>
                    <div className={`text-sm font-bold font-mono tabular-nums ${box.color}`}>{box.value}</div>
                    <div className="text-[9px] text-muted-foreground/50 mt-0.5">auto-computed</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: Tax / KRA ────────────────────────────────────────────── */}
          {tab === "tax" && (
            <div className="grid grid-cols-2 gap-4">

              {/* KRA notice banner */}
              <div className="col-span-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
                <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                </svg>
                <div className="text-[11px] text-amber-300/90 leading-relaxed">
                  <strong>Kenya ITA Cap.470 — Withholding Tax on Interest (s.35):</strong> 15% on interest paid to resident persons &amp; 
                  non-resident banks. WHT is deducted by the borrower and remitted to KRA by the 20th of the following month (iTax). 
                  Interest deductibility governed by s.15(1)(a); thin-capitalisation disallowance under s.16(2) where debt/equity &gt; 3:1.
                </div>
              </div>

              <SelectField
                label="WHT Applicable? (ITA s.35)"
                hint="Is withholding tax applicable on this interest payment?"
                value={form.withholding_tax_applicable}
                onChange={v => set("withholding_tax_applicable", v as WithholdingApplicable)}
                options={["Yes", "No"]}
              />
              <Field
                label="WHT Rate (%)"
                hint="Resident: 15% | Non-Resident Bank: 15% (ITA s.35)"
              >
                <input type="number" step="0.01" min="0" max="30"
                  value={form.withholding_tax_rate}
                  onChange={e => set("withholding_tax_rate", parseFloat(e.target.value) || 0)}
                  className={inputCls}
                  disabled={form.withholding_tax_applicable === "No"}
                />
              </Field>

              <SelectField
                label="Interest Deductible? (ITA s.15(1)(a))"
                hint="Is interest expense deductible for corporation tax purposes?"
                value={form.interest_deductible_ita}
                onChange={v => set("interest_deductible_ita", v as WithholdingApplicable)}
                options={["Yes", "No"]}
              />
              <Field
                label="Thin-Cap Flag (ITA s.16(2))"
                hint="Flag if total debt/equity > 3:1 — excess interest disallowed"
              >
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
                  <input type="checkbox" id="thin_cap"
                    checked={form.thin_cap_flag}
                    onChange={e => set("thin_cap_flag", e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                  <label htmlFor="thin_cap" className="text-sm text-foreground cursor-pointer">
                    Thin-cap rule triggered
                  </label>
                  {form.thin_cap_flag && (
                    <Badge className="ml-auto bg-rose-500/10 border-rose-500/30 text-rose-300 text-[10px]">
                      ⚠ Review Required
                    </Badge>
                  )}
                </div>
              </Field>

              {/* Computed tax summary */}
              <div className="col-span-2 grid grid-cols-3 gap-3 mt-1">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-amber-400/70 mb-1">WHT to Remit to KRA</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-amber-400">{fmtKES(form.withholding_tax_amount)}</div>
                  <div className="text-[9px] text-muted-foreground/50 mt-0.5">{fmtPct(form.withholding_tax_rate)} × interest portion</div>
                </div>
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-sky-400/70 mb-1">Net Interest to Lender</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-sky-400">{fmtKES(form.net_interest_payable)}</div>
                  <div className="text-[9px] text-muted-foreground/50 mt-0.5">Gross less WHT deducted</div>
                </div>
                <div className={`rounded-xl border px-3 py-2.5 ${
                  form.interest_deductible_ita === "Yes"
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-rose-500/20 bg-rose-500/5"
                }`}>
                  <div className={`text-[10px] uppercase tracking-wider mb-1 ${
                    form.interest_deductible_ita === "Yes" ? "text-emerald-400/70" : "text-rose-400/70"
                  }`}>Corp. Tax Deduction</div>
                  <div className={`text-sm font-bold ${
                    form.interest_deductible_ita === "Yes" ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {form.interest_deductible_ita === "Yes" ? "Allowable" : "Disallowed"}
                  </div>
                  <div className="text-[9px] text-muted-foreground/50 mt-0.5">ITA s.15(1)(a)</div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Payment ──────────────────────────────────────────────── */}
          {tab === "payment" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount Paid (KES)">
                <input type="number" step="0.01" min="0" value={form.amount_paid}
                  onChange={e => set("amount_paid", parseFloat(e.target.value) || 0)} className={inputCls} />
              </Field>
              <Field label="Payment Date">
                <input type="date" value={form.payment_date ?? ""}
                  onChange={e => set("payment_date", e.target.value || null)} className={inputCls} />
              </Field>
              <SelectField label="Payment Status *" value={form.payment_status}
                onChange={v => set("payment_status", v as PaymentStatus)} options={PAYMENT_STATUSES} />
              <Field label="Days in Arrears">
                <input type="number" min="0" value={form.days_in_arrears}
                  onChange={e => set("days_in_arrears", parseInt(e.target.value) || 0)} className={inputCls} />
              </Field>
              <div className="col-span-2">
                <Field label="Notes">
                  <textarea value={form.notes ?? ""} rows={3} placeholder="Any additional notes…"
                    onChange={e => set("notes", e.target.value || null)}
                    className={inputCls + " resize-none"} />
                </Field>
              </div>

              {/* Payment summary */}
              <div className="col-span-2 grid grid-cols-2 gap-3 mt-1">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Variance (Due vs Paid)</div>
                  <div className={`text-sm font-bold font-mono tabular-nums ${
                    form.amount_paid >= form.total_due ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {fmtKES(form.amount_paid - form.total_due)}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Closing Balance</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-primary">{fmtKES(form.closing_balance)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          <div className="flex gap-1">
            {tabs.map((t, i) => (
              <span key={t.key} className={`w-1.5 h-1.5 rounded-full transition-all ${tab === t.key ? "bg-primary" : "bg-white/20"}`} />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
              Cancel
            </button>
            <button onClick={() => onSave(form)} disabled={loading}
              className="px-5 py-2 text-sm font-medium rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
              {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {isEdit ? "Save Changes" : "Add Loan"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DELETE CONFIRM ───────────────────────────────────────────────────────────

function DeleteConfirm({ loan, onConfirm, onClose, loading }: {
  loan: Loan; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-xl bg-white/10"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}>
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Delete Loan Record</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Permanently delete{" "}
              <span className="text-foreground font-medium">{loan.facility_ref}</span>{" "}
              (<span className="font-mono text-primary text-xs">{loan.lender_name}</span>)?{" "}
              This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white transition-all disabled:opacity-50 flex items-center gap-2">
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Delete Loan
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── PROJECT CARD ─────────────────────────────────────────────────────────────

function ProjectCard({ project, onSelect, loanCount }: {
  project: Project; onSelect: (p: Project) => void; loanCount: number;
}) {
  const status    = project.status ?? "planning";
  const statusCls = STATUS_STYLE[status] ?? STATUS_STYLE.planning;

  return (
    <motion.button
      onClick={() => onSelect(project)}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
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
        {loanCount > 0 && (
          <span className="text-[10px] text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded-full flex-shrink-0 tabular-nums">
            {loanCount} {loanCount === 1 ? "loan" : "loans"}
          </span>
        )}
      </div>
      <h3 className="font-semibold text-foreground text-sm mb-1.5 group-hover:text-primary transition-colors leading-snug line-clamp-1">
        {project.title}
      </h3>
      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{project.description}</p>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
        {project.site_city && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
            </svg>
            {project.site_city}{project.site_country ? `, ${project.site_country}` : ""}
          </span>
        )}
        {project.budget_numeric != null && (
          <span className="flex items-center gap-1 text-emerald-400/80">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            KES {fmtC(project.budget_numeric)}
          </span>
        )}
        {project.expected_completion_date && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            Due {fmtDate(project.expected_completion_date)}
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
            <motion.div className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))" }}
              initial={{ width: 0 }} animate={{ width: `${project.progress_percent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        <span>Open Loans</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </div>
    </motion.button>
  );
}

// ─── PROJECT PICKER VIEW ──────────────────────────────────────────────────────

function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects,    setProjects]    = useState<Project[]>([]);
  const [fetching,    setFetching]    = useState(true);
  const [search,      setSearch]      = useState("");
  const [statusFilter,setStatusFilter]= useState("all");
  const [loanCounts,  setLoanCounts]  = useState<Record<string, number>>({});
  const { toasts, push } = useToast();

  useEffect(() => {
    setFetching(true);
    api.projects()
      .then(async data => {
        setProjects(data);
        if (data.length > 0) {
          const counts = await api.loanCounts(data.map(p => p.id));
          setLoanCounts(counts);
        }
      })
      .catch((e: unknown) => push(e instanceof Error ? e.message : "Failed to load projects.", "error"))
      .finally(() => setFetching(false));
  }, [push]);

  const statuses = useMemo(() => {
    const s = new Set(projects.map(p => p.status ?? "planning"));
    return ["all", ...Array.from(s)];
  }, [projects]);

  const filtered = useMemo(() =>
    projects.filter(p => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.title.toLowerCase().includes(q) ||
          p.project_number.toLowerCase().includes(q) ||
          (p.site_city ?? "").toLowerCase().includes(q);
      }
      return true;
    }),
  [projects, search, statusFilter]);

  const totalLoans = Object.values(loanCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${
                t.type === "success" ? "bg-emerald-950/80 border-emerald-500/25 text-emerald-300" : "bg-rose-950/80 border-rose-500/25 text-rose-300"
              }`}>{t.msg}</motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="container mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">Finance Module</p>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
            Loans{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Tracking</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Select a project to view or manage its loan schedules and KRA tax obligations.
          </p>
        </motion.div>

        {/* Stat cards */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Projects",       value: projects.length,                   sub: "in system"          },
            { label: "Projects with Loans",  value: Object.keys(loanCounts).length,    sub: "have loan records"  },
            { label: "Total Loan Records",   value: totalLoans,                        sub: "across all projects"},
          ].map(c => (
            <div key={c.label} className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">{c.label}</div>
              <div className="text-3xl font-bold text-foreground tabular-nums">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
            </div>
          ))}
        </motion.div>

        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-3xl font-bold">Projects</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, number or city…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all">
                {statuses.map(s => (
                  <option key={s} value={s}>
                    {s === "all" ? "All Statuses" : s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
              <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
                {filtered.length} / {projects.length} shown
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
                <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                Loading projects…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M2 20h20M5 20V8l7-6 7 6v12M9 20v-6h6v6"/>
                </svg>
                <p className="text-sm">No projects found.</p>
                {search && <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="text-xs text-primary hover:underline">Clear filters</button>}
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(p => <ProjectCard key={p.id} project={p} onSelect={onSelect} loanCount={loanCounts[p.id] ?? 0} />)}
              </div>
            )}
            {!fetching && projects.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">{projects.length} total projects · {Object.keys(loanCounts).length} with loans</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── LOANS VIEW ───────────────────────────────────────────────────────────────

function LoansView({ project, canEdit, onBack }: {
  project: Project; canEdit: boolean; onBack: () => void;
}) {
  const [loans,        setLoans]        = useState<Loan[]>([]);
  const [fetching,     setFetching]     = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterType,   setFilterType]   = useState<LoanType | "All">("All");
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | "All">("All");
  const [expanded,     setExpanded]     = useState<Record<string, boolean>>({});
  const [modal,        setModal]        = useState<null | "create" | "edit">(null);
  const [editing,      setEditing]      = useState<Loan | null>(null);
  const [deleting,     setDeleting]     = useState<Loan | null>(null);
  const [saving,       setSaving]       = useState(false);

  const { toasts, push } = useToast();

  const fetchLoans = useCallback(async () => {
    setFetching(true); setLoans([]);
    try {
      const data = await api.list(project.id);
      setLoans(data);
      const types = [...new Set(data.map(l => l.loan_type))];
      setExpanded(Object.fromEntries(types.map(t => [t, true])));
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to load loans.", "error");
    } finally { setFetching(false); }
  }, [project.id, push]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  const handleCreate = async (form: LoanFormData) => {
    setSaving(true);
    try {
      const row = await api.create({ ...form, project_id: project.id });
      setLoans(p => [row, ...p]);
      push("Loan record added."); setModal(null);
    } catch (e: unknown) { push(e instanceof Error ? e.message : "Failed to add loan.", "error"); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (form: LoanFormData) => {
    if (!editing) return; setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      setLoans(p => p.map(x => x.id === editing.id ? row : x));
      push("Loan record updated."); setModal(null); setEditing(null);
    } catch (e: unknown) { push(e instanceof Error ? e.message : "Failed to update loan.", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return; setSaving(true);
    try {
      await api.remove(deleting.id);
      setLoans(p => p.filter(x => x.id !== deleting.id));
      push("Loan record deleted."); setDeleting(null);
    } catch (e: unknown) { push(e instanceof Error ? e.message : "Failed to delete loan.", "error"); }
    finally { setSaving(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    loans.filter(l => {
      if (filterType   !== "All" && l.loan_type      !== filterType)   return false;
      if (filterStatus !== "All" && l.payment_status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          l.facility_ref.toLowerCase().includes(q) ||
          l.lender_name.toLowerCase().includes(q)  ||
          l.purpose.toLowerCase().includes(q)       ||
          l.date_period.toLowerCase().includes(q)
        );
      }
      return true;
    }),
  [loans, filterType, filterStatus, search]);

  // Group by loan_type
  const grouped = useMemo(() => {
    const g: Partial<Record<LoanType, Loan[]>> = {};
    filtered.forEach(l => {
      if (!g[l.loan_type]) g[l.loan_type] = [];
      g[l.loan_type]!.push(l);
    });
    return g;
  }, [filtered]);

  // Grand totals
  const totals = useMemo(() => ({
    principal:  loans.reduce((s, l) => s + Number(l.principal_approved_kes), 0),
    opening:    loans.reduce((s, l) => s + Number(l.opening_balance),        0),
    closing:    loans.reduce((s, l) => s + Number(l.closing_balance),        0),
    totalDue:   loans.reduce((s, l) => s + Number(l.total_due),              0),
    amtPaid:    loans.reduce((s, l) => s + Number(l.amount_paid),            0),
    wht:        loans.reduce((s, l) => s + Number(l.withholding_tax_amount), 0),
    netInt:     loans.reduce((s, l) => s + Number(l.net_interest_payable),   0),
    arrears:    loans.filter(l => l.days_in_arrears > 0).length,
    thinCap:    loans.filter(l => l.thin_cap_flag).length,
  }), [loans]);

  const status = project.status ?? "planning";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${
                t.type === "success" ? "bg-emerald-950/80 border-emerald-500/25 text-emerald-300" : "bg-rose-950/80 border-rose-500/25 text-rose-300"
              }`}>{t.msg}</motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal === "create" && (
          <LoanModal initial={makeEmptyForm(project.id)} onSave={handleCreate}
            onClose={() => setModal(null)} loading={saving} />
        )}
        {modal === "edit" && editing && (
          <LoanModal
            initial={(({ id: _id, created_at: _ca, updated_at: _ua, ...rest }) => rest)(editing)}
            onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
          />
        )}
        {deleting && (
          <DeleteConfirm loan={deleting} onConfirm={handleDelete}
            onClose={() => setDeleting(null)} loading={saving} />
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-16">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-10">
          <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            All Projects
          </button>

          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">Loans Tracking</p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
                  {project.project_number}
                </span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLE[status] ?? STATUS_STYLE.planning}`}>
                  {status.replace(/_/g, " ")}
                </span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  {project.title}
                </span>
              </h1>
              {project.site_city && (
                <p className="text-xl text-muted-foreground mt-2">
                  {project.site_city}{project.site_country ? `, ${project.site_country}` : ""}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* KRA Tax Summary Banner */}
        {totals.wht > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
            className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              </svg>
              <span className="text-amber-300 font-semibold font-sans text-[11px] uppercase tracking-wider">KRA Obligations</span>
            </div>
            <span className="text-amber-300">WHT to Remit: <strong>{fmtKES(totals.wht)}</strong></span>
            <span className="text-muted-foreground">·</span>
            <span className="text-sky-300">Net Interest (to lenders): <strong>{fmtKES(totals.netInt)}</strong></span>
            {totals.thinCap > 0 && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-rose-300">⚠ {totals.thinCap} facility{totals.thinCap > 1 ? "ies" : "y"} flagged for thin-cap review</span>
              </>
            )}
          </motion.div>
        )}

        {/* Grand stat cards */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Principal",   value: fmtKES(totals.principal), color: "text-foreground",  sub: `${loans.length} facilities` },
            { label: "Total Due",         value: fmtKES(totals.totalDue),  color: "text-primary",     sub: "this period"                },
            { label: "Total Paid",        value: fmtKES(totals.amtPaid),   color: "text-emerald-400", sub: `${loans.filter(l => l.payment_status === "Paid").length} settled` },
            { label: "Closing Balance",   value: fmtKES(totals.closing),   color: "text-sky-400",     sub: "outstanding debt"           },
          ].map(c => (
            <div key={c.label} className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">{c.label}</div>
              <div className={`text-lg font-bold tabular-nums font-mono ${c.color}`}>{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
            </div>
          ))}
        </motion.div>

        {/* Loan type filter pills */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.13 }}
          className="flex flex-wrap gap-2 mb-8">
          {LOAN_TYPES.filter(lt => loans.some(l => l.loan_type === lt)).map(lt => {
            const s        = LOAN_TYPE_STYLE[lt];
            const count    = loans.filter(l => l.loan_type === lt).length;
            const isActive = filterType === lt;
            return (
              <button key={lt} onClick={() => setFilterType(isActive ? "All" : lt)}
                className={`rounded-2xl border px-4 py-3 text-left transition-all duration-200 backdrop-blur-sm bg-white/5 min-w-[8rem] ${
                  isActive ? "border-white/20 ring-1 ring-white/20 scale-[1.02]" : "border-white/10 hover:border-white/20 hover:scale-[1.01]"
                }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  <span className={`text-[10px] uppercase tracking-widest font-semibold ${s.accent}`}>{lt}</span>
                </div>
                <div className="text-lg font-bold tabular-nums text-foreground">{count}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">facilities</div>
              </button>
            );
          })}
        </motion.div>

        {/* Main card */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-3xl font-bold">Loan Schedule</CardTitle>
              {canEdit && (
                <button onClick={() => setModal("create")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg"
                  style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  New Loan
                </button>
              )}
            </div>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by facility ref, lender, purpose or period…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all" />
              </div>
              <select value={filterType} onChange={e => setFilterType(e.target.value as LoanType | "All")}
                className={inputCls + " appearance-none pr-10 font-medium text-sm min-w-[9rem]"}>
                <option value="All">All Types</option>
                {LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as PaymentStatus | "All")}
                className={inputCls + " appearance-none pr-10 font-medium text-sm min-w-[9rem]"}>
                <option value="All">All Statuses</option>
                {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
                {filtered.length} / {loans.length} shown
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
                <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                Loading loans…
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                <p className="text-sm">No loan records found.</p>
                {(search || filterType !== "All" || filterStatus !== "All") && (
                  <button onClick={() => { setSearch(""); setFilterType("All"); setFilterStatus("All"); }}
                    className="text-xs text-primary hover:underline">Clear filters</button>
                )}
                {canEdit && !search && filterType === "All" && filterStatus === "All" && (
                  <button onClick={() => setModal("create")} className="text-xs text-primary hover:underline">Add first loan</button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {LOAN_TYPES.filter(lt => grouped[lt]).map(lt => {
                  const s      = LOAN_TYPE_STYLE[lt];
                  const rows   = grouped[lt]!;
                  const isOpen = expanded[lt] ?? true;
                  const grpPrincipal = rows.reduce((a, l) => a + Number(l.principal_approved_kes), 0);
                  const grpDue       = rows.reduce((a, l) => a + Number(l.total_due),              0);
                  const grpPaid      = rows.reduce((a, l) => a + Number(l.amount_paid),            0);
                  const grpWHT       = rows.reduce((a, l) => a + Number(l.withholding_tax_amount), 0);

                  return (
                    <div key={lt}>
                      {/* Group header */}
                      <button onClick={() => setExpanded(p => ({ ...p, [lt]: !p[lt] }))}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                          <span className={`text-xs font-bold uppercase tracking-[0.12em] ${s.accent}`}>{lt}</span>
                          <Badge className={`text-xs px-2.5 py-0.5 font-mono border rounded-full ${s.badge}`}>{rows.length}</Badge>
                        </div>
                        <div className="flex items-center gap-5">
                          <span className="text-xs font-mono tabular-nums text-muted-foreground hidden sm:block">
                            Principal {fmtKES(grpPrincipal)}
                          </span>
                          {grpWHT > 0 && (
                            <span className="text-xs font-mono tabular-nums text-amber-400 hidden md:block">
                              WHT {fmtKES(grpWHT)}
                            </span>
                          )}
                          <span className="text-sm font-bold tabular-nums font-mono text-primary">{fmtKES(grpDue)}</span>
                          <svg className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="m6 9 6 6 6-6"/>
                          </svg>
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div key={`lt-${lt}`}
                            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                            style={{ overflow: "hidden" }}>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-y border-white/6" style={{ background: "rgba(255,255,255,0.03)" }}>
                                    {[
                                      "Facility Ref", "Lender", "Purpose", "Period",
                                      "Interest Rate", "Tenure",
                                      "Opening Bal.", "Principal", "Interest",
                                      "WHT (15%)", "Net Interest", "Fees",
                                      "Total Due", "Paid", "Closing Bal.",
                                      "Due Date", "Status", "Arrears",
                                      ...(canEdit ? ["Actions"] : []),
                                    ].map(h => (
                                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((loan, ri) => {
                                    const ss = PAYMENT_STATUS_STYLE[loan.payment_status];
                                    return (
                                      <motion.tr key={loan.id}
                                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: ri * 0.02, duration: 0.16 }}
                                        className={`border-b border-white/5 transition-colors ${s.row}`}
                                      >
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                          <span className="font-mono text-xs font-semibold text-primary">{loan.facility_ref}</span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap font-medium text-foreground text-xs">{loan.lender_name}</td>
                                        <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-[120px]">
                                          <span className="line-clamp-1">{loan.purpose}</span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                          <span className="font-mono text-xs text-muted-foreground">{loan.date_period}</span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-foreground font-mono">
                                          {fmtPct(loan.interest_rate_pa)}
                                          <span className="text-[10px] text-muted-foreground ml-1">{loan.interest_type}</span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground text-center">{loan.tenure_months}m</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-foreground">{fmtKES(Number(loan.opening_balance))}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-foreground">{fmtKES(Number(loan.principal_portion))}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-foreground">{fmtKES(Number(loan.interest_portion))}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                          {Number(loan.withholding_tax_amount) > 0 ? (
                                            <span className="font-mono text-xs text-amber-400">{fmtKES(Number(loan.withholding_tax_amount))}</span>
                                          ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-sky-400">{fmtKES(Number(loan.net_interest_payable))}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-muted-foreground">{fmtKES(Number(loan.fees_and_charges))}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                          <span className="font-mono text-sm font-bold text-foreground">{fmtKES(Number(loan.total_due))}</span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-emerald-400">{fmtKES(Number(loan.amount_paid))}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-primary">{fmtKES(Number(loan.closing_balance))}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground font-mono">{fmtDate(loan.due_date)}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                          <Badge className={`text-[10px] px-2 py-0.5 border rounded-full font-semibold ${ss}`}>
                                            {loan.payment_status}
                                          </Badge>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                                          {loan.days_in_arrears > 0 ? (
                                            <span className="text-xs font-mono text-rose-400 font-bold">{loan.days_in_arrears}d</span>
                                          ) : (
                                            <span className="text-xs text-emerald-400">—</span>
                                          )}
                                        </td>
                                        {canEdit && (
                                          <td className="px-4 py-3.5 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                              <button onClick={() => { setEditing(loan); setModal("edit"); }} title="Edit"
                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                              </button>
                                              <button onClick={() => setDeleting(loan)} title="Delete"
                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                  <polyline points="3 6 5 6 21 6"/>
                                                  <path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                                                </svg>
                                              </button>
                                            </div>
                                          </td>
                                        )}
                                      </motion.tr>
                                    );
                                  })}
                                </tbody>
                                {/* Subtotal footer */}
                                <tfoot>
                                  <tr className="border-t border-white/10" style={{ background: "rgba(255,255,255,0.02)" }}>
                                    <td colSpan={6} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{lt} Total</td>
                                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-foreground">{fmtKES(rows.reduce((a,l) => a+Number(l.opening_balance),0))}</td>
                                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-foreground">{fmtKES(rows.reduce((a,l) => a+Number(l.principal_portion),0))}</td>
                                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-foreground">{fmtKES(rows.reduce((a,l) => a+Number(l.interest_portion),0))}</td>
                                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-amber-400">{fmtKES(grpWHT)}</td>
                                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-sky-400">{fmtKES(rows.reduce((a,l) => a+Number(l.net_interest_payable),0))}</td>
                                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-muted-foreground">{fmtKES(rows.reduce((a,l) => a+Number(l.fees_and_charges),0))}</td>
                                    <td className="px-4 py-2.5 font-mono text-sm font-bold text-foreground">{fmtKES(grpDue)}</td>
                                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-emerald-400">{fmtKES(grpPaid)}</td>
                                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-primary">{fmtKES(rows.reduce((a,l) => a+Number(l.closing_balance),0))}</td>
                                    <td colSpan={canEdit ? 4 : 3} />
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                {/* Grand total bar */}
                {loans.length > 0 && (
                  <div className="px-6 py-4 flex flex-wrap items-center gap-5 text-xs font-mono bg-primary/5 border-t border-primary/10">
                    <span className="text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wider">Grand Total</span>
                    <span className="text-foreground">Principal {fmtKES(totals.principal)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-amber-400">WHT {fmtKES(totals.wht)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-foreground">Due {fmtKES(totals.totalDue)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-emerald-400">Paid {fmtKES(totals.amtPaid)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-sky-400">Outstanding {fmtKES(totals.closing)}</span>
                    <Badge className="ml-auto bg-primary/10 border-primary/20 text-primary">
                      {loans.length} loan{loans.length !== 1 ? "s" : ""}
                      {totals.arrears > 0 && ` · ${totals.arrears} in arrears`}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {!fetching && loans.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">{loans.length} total loan record{loans.length !== 1 ? "s" : ""}</span>
                <button onClick={fetchLoans} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
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
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function LoansPage({ projectId, canEdit = true }: Props) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,currency,site_address,site_city,site_country,start_date,expected_completion_date,created_at")
      .eq("id", projectId).single()
      .then(({ data }) => { if (data) setSelectedProject(data as Project); })
      .catch(console.error);
  }, [projectId]);

  return (
    <AnimatePresence mode="wait">
      {selectedProject ? (
        <motion.div key={selectedProject.id}
          initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
          <LoansView project={selectedProject} canEdit={canEdit}
            onBack={() => { if (!projectId) setSelectedProject(null); }} />
        </motion.div>
      ) : (
        <motion.div key="picker"
          initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.25 }}>
          <ProjectPickerView onSelect={setSelectedProject} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}