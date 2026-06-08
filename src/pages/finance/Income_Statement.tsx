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
  site_address: string | null;
  site_city: string | null;
  site_country: string | null;
  start_date: string | null;
  expected_completion_date: string | null;
  created_at: string;
}

type StatementStatus = "Draft" | "Review" | "Final" | "Amended";

interface IncomeStatement {
  id: number;
  period_label: string;
  start_date: string;
  end_date: string;
  status: StatementStatus;
  notes: string;
  project_id?: string | null;
  // Writable inputs
  gross_revenue: number;
  returns_and_allowances: number;
  cost_of_goods_sold: number;
  operating_expenses: number;
  other_income: number;
  other_expenses: number;
  income_tax_expense: number;
  // GENERATED — read-only, never sent in INSERT/UPDATE
  net_revenue: number;
  gross_profit: number;
  operating_income: number;
  income_before_tax: number;
  net_income: number;
  created_at?: string;
  updated_at?: string;
}

type ISFormData = Omit<
  IncomeStatement,
  "id" | "net_revenue" | "gross_profit" | "operating_income" | "income_before_tax" | "net_income" | "created_at" | "updated_at"
>;

interface Props {
  projectId?: string;
  canEdit?: boolean;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STATEMENT_STATUSES: StatementStatus[] = ["Draft", "Review", "Final", "Amended"];

const STATUS_STYLE_IS: Record<StatementStatus, { accent: string; badge: string; dot: string; row: string }> = {
  Draft:   { accent: "text-slate-400",   badge: "bg-slate-500/10 border-slate-500/30 text-slate-300",   dot: "bg-slate-400",   row: "hover:bg-slate-950/30"  },
  Review:  { accent: "text-amber-400",   badge: "bg-amber-500/10 border-amber-500/30 text-amber-300",   dot: "bg-amber-400",   row: "hover:bg-amber-950/30"  },
  Final:   { accent: "text-emerald-400", badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", dot: "bg-emerald-400", row: "hover:bg-emerald-950/30" },
  Amended: { accent: "text-violet-400",  badge: "bg-violet-500/10 border-violet-500/30 text-violet-300", dot: "bg-violet-400",  row: "hover:bg-violet-950/30"  },
};

const PROJECT_STATUS_STYLE: Record<string, string> = {
  planning:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  on_hold:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 2 }).format(n);

const fmtC = (n: number) =>
  new Intl.NumberFormat("en-KE", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** Strip every GENERATED / server-managed column before any write */
function toWritable(form: ISFormData): ISFormData {
  const {
    period_label, start_date, end_date, status, notes, project_id,
    gross_revenue, returns_and_allowances, cost_of_goods_sold,
    operating_expenses, other_income, other_expenses, income_tax_expense,
  } = form;
  return {
    period_label, start_date, end_date, status, notes, project_id: project_id ?? null,
    gross_revenue, returns_and_allowances, cost_of_goods_sold,
    operating_expenses, other_income, other_expenses, income_tax_expense,
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────
const api = {
  async projects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,site_address,site_city,site_country,start_date,expected_completion_date,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Project[];
  },

  async list(): Promise<IncomeStatement[]> {
    const { data, error } = await supabase
      .from("income_statement")
      .select("*")
      .order("start_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as IncomeStatement[];
  },

  async create(form: ISFormData): Promise<IncomeStatement> {
    const { data, error } = await supabase
      .from("income_statement")
      .insert([toWritable(form)])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as IncomeStatement;
  },

  async update(id: number, form: ISFormData): Promise<IncomeStatement> {
    const { data, error } = await supabase
      .from("income_statement")
      .update(toWritable(form))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as IncomeStatement;
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase.from("income_statement").delete().eq("id", id);
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
  "w-full px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/40 transition-all appearance-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
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

// ─── STATEMENT MODAL ──────────────────────────────────────────────────────────
function StatementModal({
  initial,
  projects,
  onSave,
  onClose,
  loading,
}: {
  initial: ISFormData & { id?: number };
  projects?: Project[];
  onSave: (d: ISFormData) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<ISFormData>({ ...initial });
  const isEdit = Boolean(initial.id);

  const set = <K extends keyof ISFormData>(k: K, v: ISFormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const netRev    = (form.gross_revenue || 0) - (form.returns_and_allowances || 0);
  const grossPnL  = netRev - (form.cost_of_goods_sold || 0);
  const opIncome  = grossPnL - (form.operating_expenses || 0);
  const beforeTax = opIncome + (form.other_income || 0) - (form.other_expenses || 0);
  const netInc    = beforeTax - (form.income_tax_expense || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-xl bg-white/10"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            {isEdit ? "Edit Income Statement" : "New Income Statement"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">

          {/* Project link (only shown in global/standalone context) */}
          {projects && projects.length > 0 && (
            <div className="col-span-2">
              <Field label="Linked Project (optional)">
                <div className="relative">
                  <select
                    value={form.project_id ?? ""}
                    onChange={(e) => set("project_id", e.target.value || null)}
                    className={inputCls + " pr-10"}
                  >
                    <option value="">— No project (standalone) —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project_number} · {p.title}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </Field>
            </div>
          )}

          {/* Identity */}
          <div className="col-span-2">
            <Field label="Period Label *">
              <input
                value={form.period_label}
                onChange={(e) => set("period_label", e.target.value)}
                placeholder="e.g. Q1-2026 (Jan–Mar)"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Start Date *">
            <input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} className={inputCls} />
          </Field>
          <Field label="End Date *">
            <input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Status *">
            <div className="relative">
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as StatementStatus)}
                className={inputCls + " pr-10"}
              >
                {STATEMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </Field>
          <Field label="Notes">
            <input
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes"
              className={inputCls}
            />
          </Field>

          {/* Revenue */}
          <SectionDivider label="Revenue" dotColor="bg-sky-400" textColor="text-sky-400" />
          <Field label="Gross Revenue (KES) *">
            <input type="number" step="0.01" min="0"
              value={form.gross_revenue || ""}
              onChange={e => set("gross_revenue", e.target.value === "" ? 0 : parseFloat(e.target.value))}
              className={inputCls} />
          </Field>
          <Field label="Returns & Allowances (KES)">
            <input type="number" step="0.01" min="0"
              value={form.returns_and_allowances || ""}
              onChange={e => set("returns_and_allowances", e.target.value === "" ? 0 : parseFloat(e.target.value))}
              className={inputCls} />
          </Field>

          {/* COGS */}
          <SectionDivider label="Cost of Goods Sold" dotColor="bg-rose-400" textColor="text-rose-400" />
          <div className="col-span-2">
            <Field label="Cost of Goods Sold (KES) *">
              <input type="number" step="0.01" min="0"
                value={form.cost_of_goods_sold || ""}
                onChange={e => set("cost_of_goods_sold", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className={inputCls} />
            </Field>
          </div>

          {/* Operating Expenses */}
          <SectionDivider label="Operating Expenses" dotColor="bg-orange-400" textColor="text-orange-400" />
          <div className="col-span-2">
            <Field label="Total Operating Expenses (KES)">
              <input type="number" step="0.01" min="0"
                value={form.operating_expenses || ""}
                onChange={e => set("operating_expenses", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className={inputCls} />
            </Field>
          </div>

          {/* Other Income / Expenses */}
          <SectionDivider label="Other Income / Expenses" dotColor="bg-emerald-400" textColor="text-emerald-400" />
          <Field label="Other Income (KES)">
            <input type="number" step="0.01"
              value={form.other_income || ""}
              onChange={e => set("other_income", e.target.value === "" ? 0 : parseFloat(e.target.value))}
              className={inputCls} />
          </Field>
          <Field label="Other Expenses (KES)">
            <input type="number" step="0.01" min="0"
              value={form.other_expenses || ""}
              onChange={e => set("other_expenses", e.target.value === "" ? 0 : parseFloat(e.target.value))}
              className={inputCls} />
          </Field>

          {/* Tax */}
          <SectionDivider label="Tax" dotColor="bg-violet-400" textColor="text-violet-400" />
          <div className="col-span-2">
            <Field label="Income Tax Expense (KES)">
              <input type="number" step="0.01" min="0"
                value={form.income_tax_expense || ""}
                onChange={e => set("income_tax_expense", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className={inputCls} />
            </Field>
          </div>

          {/* Live preview */}
          <div className="col-span-2 rounded-xl border border-white/10 bg-white/3 overflow-hidden">
            <div className="px-4 py-2 border-b border-white/8 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Live Preview — DB will compute these
            </div>
            <div className="divide-y divide-white/6">
              {[
                { label: "Net Revenue",       value: netRev,    color: "text-sky-300" },
                { label: "Gross Profit / Loss", value: grossPnL, color: grossPnL >= 0 ? "text-emerald-400" : "text-rose-400" },
                { label: "Operating Income",  value: opIncome,  color: opIncome >= 0 ? "text-emerald-400" : "text-rose-400" },
                { label: "Income Before Tax", value: beforeTax, color: beforeTax >= 0 ? "text-emerald-400" : "text-rose-400" },
                { label: "Net Income",        value: netInc,    color: netInc >= 0 ? "text-emerald-400" : "text-rose-400", bold: true },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className={`font-mono text-xs tabular-nums ${row.bold ? "font-bold text-sm" : ""} ${row.color}`}>
                    {row.value < 0 ? `(${fmt(Math.abs(row.value))})` : fmt(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={loading || !form.period_label}
            className="px-5 py-2 text-sm font-medium rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
          >
            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEdit ? "Save Changes" : "Add Statement"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DELETE CONFIRM ───────────────────────────────────────────────────────────
function DeleteConfirm({
  statement,
  onConfirm,
  onClose,
  loading,
}: {
  statement: IncomeStatement;
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
        transition={{ duration: 0.18 }}
      >
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Delete Statement</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Permanently delete <span className="text-foreground font-medium">{statement.period_label}</span>? This cannot be undone.
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
            className="px-4 py-2 text-sm font-medium rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Delete Statement
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── PROJECT CARD ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onSelect }: { project: Project; onSelect: (p: Project) => void }) {
  const status = project.status ?? "planning";
  const statusCls = PROJECT_STATUS_STYLE[status] ?? PROJECT_STATUS_STYLE.planning;

  return (
    <motion.button
      onClick={() => onSelect(project)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
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
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            {project.site_city}{project.site_country ? `, ${project.site_country}` : ""}
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
        {project.expected_completion_date && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
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
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))" }}
              initial={{ width: 0 }}
              animate={{ width: `${project.progress_percent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        <span>Open Income Statements</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>
    </motion.button>
  );
}

// ─── GLOBAL INCOME STATEMENTS TABLE ──────────────────────────────────────────
function GlobalIncomeStatementsTable({
  projects,
  canEdit,
}: {
  projects: Project[];
  canEdit: boolean;
}) {
  const [statements, setStatements] = useState<IncomeStatement[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatementStatus | "All">("All");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [modal, setModal] = useState<null | "create" | "edit">(null);
  const [editing, setEditing] = useState<IncomeStatement | null>(null);
  const [deleting, setDeleting] = useState<IncomeStatement | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<StatementStatus, boolean>>(
    Object.fromEntries(STATEMENT_STATUSES.map((s) => [s, true])) as Record<StatementStatus, boolean>
  );
  const { toasts, push } = useToast();

  // Project lookup map
  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects]
  );

  const fetchStatements = useCallback(async () => {
    setFetching(true);
    try {
      const data = await api.list();
      setStatements(data);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to load statements.", "error");
    } finally {
      setFetching(false);
    }
  }, [push]);

  useEffect(() => { fetchStatements(); }, [fetchStatements]);

  const handleCreate = async (form: ISFormData) => {
    setSaving(true);
    try {
      const row = await api.create(form);
      setStatements((p) => [row, ...p]);
      push("Income statement added.");
      setModal(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to add statement.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: ISFormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      setStatements((p) => p.map((s) => (s.id === editing.id ? row : s)));
      push("Income statement updated.");
      setModal(null);
      setEditing(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to update statement.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      setStatements((p) => p.filter((s) => s.id !== deleting.id));
      push("Income statement deleted.");
      setDeleting(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to delete statement.", "error");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(
    () =>
      statements.filter((s) => {
        if (filterStatus !== "All" && s.status !== filterStatus) return false;
        if (filterProject !== "all") {
          if (filterProject === "standalone") {
            if (s.project_id) return false;
          } else {
            if (s.project_id !== filterProject) return false;
          }
        }
        if (search) {
          const q = search.toLowerCase();
          return (
            s.period_label.toLowerCase().includes(q) ||
            (s.notes ?? "").toLowerCase().includes(q) ||
            (s.project_id ? (projectMap[s.project_id]?.title ?? "").toLowerCase().includes(q) : false)
          );
        }
        return true;
      }),
    [statements, filterStatus, filterProject, search, projectMap]
  );

  const grouped = useMemo(() => {
    const g: Partial<Record<StatementStatus, IncomeStatement[]>> = {};
    STATEMENT_STATUSES.forEach((st) => {
      const items = filtered.filter((s) => s.status === st);
      if (items.length) g[st] = items;
    });
    return g;
  }, [filtered]);

  const grandRevenue  = statements.reduce((a, s) => a + Number(s.gross_revenue), 0);
  const grandCOGS     = statements.reduce((a, s) => a + Number(s.cost_of_goods_sold), 0);
  const grandOpEx     = statements.reduce((a, s) => a + Number(s.operating_expenses), 0);
  const grandNetIncome = statements.reduce((a, s) => a + Number(s.net_income), 0);
  const finalizedCount = statements.filter((s) => s.status === "Final").length;
  const finalizedPct  = statements.length > 0 ? Math.round((finalizedCount / statements.length) * 100) : 0;
  const standaloneCount = statements.filter((s) => !s.project_id).length;

  const defaultForm: ISFormData = {
    period_label: "", start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10), status: "Draft", notes: "",
    project_id: null, gross_revenue: 0, returns_and_allowances: 0,
    cost_of_goods_sold: 0, operating_expenses: 0, other_income: 0,
    other_expenses: 0, income_tax_expense: 0,
  };

  return (
    <>
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${
                t.type === "success"
                  ? "bg-emerald-950/80 border-emerald-500/25 text-emerald-300"
                  : "bg-rose-950/80 border-rose-500/25 text-rose-300"
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
          <StatementModal
            initial={defaultForm}
            projects={projects}
            onSave={handleCreate}
            onClose={() => setModal(null)}
            loading={saving}
          />
        )}
        {modal === "edit" && editing && (
          <StatementModal
            initial={{ ...editing }}
            projects={projects}
            onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
          />
        )}
        {deleting && (
          <DeleteConfirm
            statement={deleting}
            onConfirm={handleDelete}
            onClose={() => setDeleting(null)}
            loading={saving}
          />
        )}
      </AnimatePresence>

      <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-3xl font-bold">All Income Statements</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {statements.length} statements across all projects · {standaloneCount} standalone
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => setModal("create")}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg whitespace-nowrap"
                style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Statement
              </button>
            )}
          </div>

          {/* Summary pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {STATEMENT_STATUSES.map((st) => {
              const s = STATUS_STYLE_IS[st];
              const count = statements.filter((x) => x.status === st).length;
              const net = statements.filter((x) => x.status === st).reduce((a, x) => a + Number(x.net_income), 0);
              return (
                <button
                  key={st}
                  onClick={() => setFilterStatus(filterStatus === st ? "All" : st)}
                  className={`rounded-xl border p-3 text-left transition-all backdrop-blur-sm bg-white/5 ${
                    filterStatus === st ? "border-white/25 ring-1 ring-white/20 scale-[1.02]" : "border-white/10 hover:border-white/18"
                  }`}
                >
                  <div className={`text-[10px] uppercase tracking-widest font-semibold mb-1 ${s.accent}`}>{st}</div>
                  <div className="text-xl font-bold text-foreground tabular-nums">{count}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                    {count > 0 ? (
                      <span className={net >= 0 ? "text-emerald-400/80" : "text-rose-400/80"}>
                        Net {fmtC(net)}
                      </span>
                    ) : "—"}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search period, notes or project…"
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StatementStatus | "All")}
              className={inputCls + " px-4 py-2.5 w-auto"}
            >
              <option value="All">All Statuses</option>
              {STATEMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className={inputCls + " px-4 py-2.5 w-auto max-w-[200px]"}
            >
              <option value="all">All Projects</option>
              <option value="standalone">Standalone only</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.project_number} · {p.title}</option>
              ))}
            </select>
            <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
              {filtered.length} / {statements.length}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {fetching ? (
            <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground text-sm">
              <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
              Loading income statements…
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8" />
              </svg>
              <p className="text-sm">No income statements found.</p>
              {canEdit && (
                <button onClick={() => setModal("create")} className="text-xs text-primary hover:underline">
                  Add first statement
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/8">
              {STATEMENT_STATUSES.filter((st) => grouped[st]).map((stStatus) => {
                const s = STATUS_STYLE_IS[stStatus];
                const isOpen = expanded[stStatus];
                const rows = grouped[stStatus]!;
                const subtotalRevenue  = rows.reduce((a, r) => a + Number(r.gross_revenue), 0);
                const subtotalNetRev   = rows.reduce((a, r) => a + Number(r.net_revenue), 0);
                const subtotalGross    = rows.reduce((a, r) => a + Number(r.gross_profit), 0);
                const subtotalOpIncome = rows.reduce((a, r) => a + Number(r.operating_income), 0);
                const subtotalNet      = rows.reduce((a, r) => a + Number(r.net_income), 0);

                return (
                  <div key={stStatus}>
                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [stStatus]: !p[stStatus] }))}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                        <span className={`text-xs font-bold uppercase tracking-[0.12em] ${s.accent}`}>{stStatus}</span>
                        <Badge className={`text-xs px-2.5 py-0.5 font-mono border rounded-full ${s.badge}`}>{rows.length}</Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold tabular-nums text-foreground hidden md:block">Rev {fmtC(subtotalRevenue)}</span>
                        <span className={`text-sm font-semibold tabular-nums ${subtotalNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          Net {subtotalNet < 0 ? `(${fmtC(Math.abs(subtotalNet))})` : fmtC(subtotalNet)}
                        </span>
                        <svg className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="rows"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          style={{ overflow: "hidden" }}
                        >
                          {/* Mobile card list — no horizontal scroll */}
                          <div className="md:hidden divide-y divide-white/8">
                            {rows.map((stmt) => {
                              const sfmt = (n: number) => n < 0 ? `(${fmt(Math.abs(n))})` : fmt(n);
                              const linkedProject = stmt.project_id ? projectMap[stmt.project_id] : null;
                              const meta = [
                                { label: "Dates",         node: `${fmtDate(stmt.start_date)} – ${fmtDate(stmt.end_date)}` },
                                { label: "Gross Revenue", node: fmt(Number(stmt.gross_revenue)) },
                                { label: "Returns",       node: fmt(Number(stmt.returns_and_allowances)) },
                                { label: "COGS",          node: fmt(Number(stmt.cost_of_goods_sold)) },
                                { label: "Op. Expenses",  node: fmt(Number(stmt.operating_expenses)) },
                                { label: "Op. Income",    node: sfmt(Number(stmt.operating_income)) },
                                { label: "Before Tax",    node: sfmt(Number(stmt.income_before_tax)) },
                                { label: "Tax",           node: fmt(Number(stmt.income_tax_expense)) },
                                { label: "Last Updated",  node: fmtDateTime(stmt.updated_at ?? stmt.created_at) },
                              ];
                              return (
                                <div key={stmt.id} className="px-4 py-4">
                                  <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-foreground text-sm truncate">{stmt.period_label}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{linkedProject ? linkedProject.project_number : "Standalone"}</p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 mb-3">
                                    {[
                                      { l: "Net Revenue",  v: fmt(Number(stmt.net_revenue)),  c: "text-sky-300" },
                                      { l: "Gross Profit", v: sfmt(Number(stmt.gross_profit)), c: Number(stmt.gross_profit) >= 0 ? "text-emerald-400" : "text-rose-400" },
                                      { l: "Net Income",   v: sfmt(Number(stmt.net_income)),   c: Number(stmt.net_income) >= 0 ? "text-emerald-400" : "text-rose-400" },
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
                                      <button onClick={() => { setEditing(stmt); setModal("edit"); }}
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground border border-white/10 hover:bg-white/5 transition-all">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        Edit
                                      </button>
                                      <button onClick={() => setDeleting(stmt)}
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
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-y border-white/6" style={{ background: "rgba(255,255,255,0.03)" }}>
                                  {[
                                    "Project", "Period", "Dates",
                                    "Gross Revenue", "Returns", "Net Revenue",
                                    "COGS", "Gross Profit", "Op. Expenses",
                                    "Op. Income", "Other Net", "Inc. Before Tax",
                                    "Tax", "Net Income", "Last Updated",
                                    ...(canEdit ? ["Actions"] : []),
                                  ].map((h) => (
                                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((stmt, ri) => {
                                  const netInc    = Number(stmt.net_income);
                                  const grossProf = Number(stmt.gross_profit);
                                  const opInc     = Number(stmt.operating_income);
                                  const beforeTax = Number(stmt.income_before_tax);
                                  const otherNet  = Number(stmt.other_income) - Number(stmt.other_expenses);
                                  const linkedProject = stmt.project_id ? projectMap[stmt.project_id] : null;

                                  return (
                                    <motion.tr
                                      key={stmt.id}
                                      initial={{ opacity: 0, x: -6 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: ri * 0.02, duration: 0.16 }}
                                      className={`border-b border-white/5 transition-colors ${s.row}`}
                                    >
                                      {/* Project */}
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        {linkedProject ? (
                                          <div>
                                            <span className="font-mono text-[10px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                                              {linkedProject.project_number}
                                            </span>
                                            <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[120px] truncate">{linkedProject.title}</div>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] text-muted-foreground italic px-1.5 py-0.5 rounded border border-white/10 bg-white/5">
                                            Standalone
                                          </span>
                                        )}
                                      </td>
                                      {/* Period */}
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="font-semibold text-sm text-foreground">{stmt.period_label}</span>
                                        {stmt.notes && <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">{stmt.notes}</div>}
                                      </td>
                                      {/* Dates */}
                                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground font-mono">
                                        {fmtDate(stmt.start_date)}<br />{fmtDate(stmt.end_date)}
                                      </td>
                                      {/* Gross Revenue */}
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="text-sm font-semibold tabular-nums text-foreground font-mono">{fmt(Number(stmt.gross_revenue))}</span>
                                      </td>
                                      {/* Returns */}
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="text-xs tabular-nums text-muted-foreground font-mono">{fmt(Number(stmt.returns_and_allowances))}</span>
                                      </td>
                                      {/* Net Revenue */}
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="text-sm font-semibold tabular-nums text-sky-300 font-mono">{fmt(Number(stmt.net_revenue))}</span>
                                      </td>
                                      {/* COGS */}
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="text-xs tabular-nums text-rose-300 font-mono">{fmt(Number(stmt.cost_of_goods_sold))}</span>
                                      </td>
                                      {/* Gross Profit */}
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className={`text-sm font-bold tabular-nums font-mono ${grossProf >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                          {grossProf < 0 ? `(${fmt(Math.abs(grossProf))})` : fmt(grossProf)}
                                        </span>
                                      </td>
                                      {/* Op Expenses */}
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="text-xs tabular-nums text-orange-300 font-mono">{fmt(Number(stmt.operating_expenses))}</span>
                                      </td>
                                      {/* Op Income */}
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className={`text-sm font-semibold tabular-nums font-mono ${opInc >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                          {opInc < 0 ? `(${fmt(Math.abs(opInc))})` : fmt(opInc)}
                                        </span>
                                      </td>
                                      {/* Other Net */}
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className={`text-xs tabular-nums font-mono ${otherNet >= 0 ? "text-muted-foreground" : "text-rose-400/70"}`}>
                                          {otherNet < 0 ? `(${fmt(Math.abs(otherNet))})` : fmt(otherNet)}
                                        </span>
                                      </td>
                                      {/* Income Before Tax */}
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className={`text-xs tabular-nums font-mono ${beforeTax >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
                                          {beforeTax < 0 ? `(${fmt(Math.abs(beforeTax))})` : fmt(beforeTax)}
                                        </span>
                                      </td>
                                      {/* Tax */}
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="text-xs tabular-nums text-violet-300 font-mono">{fmt(Number(stmt.income_tax_expense))}</span>
                                      </td>
                                      {/* Net Income */}
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className={`text-sm font-bold tabular-nums font-mono ${netInc >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                          {netInc < 0 ? `(${fmt(Math.abs(netInc))})` : fmt(netInc)}
                                        </span>
                                      </td>
                                      {/* Last Updated */}
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="text-[10px] tabular-nums text-muted-foreground font-mono leading-relaxed">
                                          {fmtDateTime(stmt.updated_at ?? stmt.created_at)}
                                        </span>
                                      </td>
                                      {/* Actions */}
                                      {canEdit && (
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <div className="flex items-center gap-1.5">
                                            <button
                                              onClick={() => { setEditing(stmt); setModal("edit"); }}
                                              title="Edit"
                                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                                            >
                                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                              </svg>
                                            </button>
                                            <button
                                              onClick={() => setDeleting(stmt)}
                                              title="Delete"
                                              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                            >
                                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6l-1 14H6L5 6" />
                                                <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                                              </svg>
                                            </button>
                                          </div>
                                        </td>
                                      )}
                                    </motion.tr>
                                  );
                                })}
                              </tbody>
                              {/* Sub-total footer */}
                              <tfoot>
                                <tr className="border-t border-white/10" style={{ background: "rgba(255,255,255,0.02)" }}>
                                  <td colSpan={3} className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Subtotal — {stStatus}
                                  </td>
                                  <td className="px-5 py-2.5 text-sm font-bold tabular-nums text-foreground font-mono">{fmt(subtotalRevenue)}</td>
                                  <td />
                                  <td className="px-5 py-2.5 text-sm font-bold tabular-nums text-sky-300 font-mono">{fmt(subtotalNetRev)}</td>
                                  <td />
                                  <td className={`px-5 py-2.5 text-sm font-bold tabular-nums font-mono ${subtotalGross >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {subtotalGross < 0 ? `(${fmt(Math.abs(subtotalGross))})` : fmt(subtotalGross)}
                                  </td>
                                  <td />
                                  <td className={`px-5 py-2.5 text-sm font-bold tabular-nums font-mono ${subtotalOpIncome >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {subtotalOpIncome < 0 ? `(${fmt(Math.abs(subtotalOpIncome))})` : fmt(subtotalOpIncome)}
                                  </td>
                                  <td colSpan={2} />
                                  <td />
                                  <td className={`px-5 py-2.5 text-sm font-bold tabular-nums font-mono ${subtotalNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                    {subtotalNet < 0 ? `(${fmt(Math.abs(subtotalNet))})` : fmt(subtotalNet)}
                                  </td>
                                  <td colSpan={canEdit ? 2 : 1} />
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
              {statements.length > 0 && (
                <div className={`px-6 py-4 flex flex-wrap items-center gap-6 text-xs font-mono ${grandNetIncome >= 0 ? "bg-emerald-950/20" : "bg-rose-950/20"}`}>
                  <span className="text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wider">Grand Total</span>
                  <span className="text-foreground">Revenue {fmt(grandRevenue)}</span>
                  <span className="text-muted-foreground">−</span>
                  <span className="text-rose-300">COGS {fmt(grandCOGS)}</span>
                  <span className="text-muted-foreground">−</span>
                  <span className="text-orange-300">OpEx {fmt(grandOpEx)}</span>
                  <span className="text-muted-foreground">=</span>
                  <span className={grandNetIncome >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                    Net {grandNetIncome < 0 ? `(${fmt(Math.abs(grandNetIncome))})` : fmt(grandNetIncome)}
                  </span>
                  <Badge className={`ml-auto ${grandNetIncome >= 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border-rose-500/30 text-rose-300"}`}>
                    {statements.length} statements · {finalizedPct}% finalized
                  </Badge>
                </div>
              )}
            </div>
          )}

          {!fetching && statements.length > 0 && (
            <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {statements.length} total · {finalizedCount} finalized · {standaloneCount} standalone
              </span>
              <button onClick={fetchStatements} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
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

// ─── PROJECT PICKER VIEW ──────────────────────────────────────────────────────
function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toasts, push } = useToast();

  useEffect(() => {
    setFetching(true);
    api
      .projects()
      .then((data) => setProjects(data))
      .catch((err: unknown) => push(err instanceof Error ? err.message : "Failed to load projects.", "error"))
      .finally(() => setFetching(false));
  }, [push]);

  const statuses = useMemo(() => {
    const s = new Set(projects.map((p) => p.status ?? "planning"));
    return ["all", ...Array.from(s)];
  }, [projects]);

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        if (statusFilter !== "all" && p.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            p.title.toLowerCase().includes(q) ||
            p.project_number.toLowerCase().includes(q) ||
            (p.site_city ?? "").toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [projects, search, statusFilter]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${
                t.type === "success"
                  ? "bg-emerald-950/80 border-emerald-500/25 text-emerald-300"
                  : "bg-rose-950/80 border-rose-500/25 text-rose-300"
              }`}
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="container mx-auto px-4 py-16">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">Finance Module</p>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
            Income{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Statement</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Select a project to view its statements, or manage all statements below.
          </p>
        </motion.div>

        {/* Summary card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-1 gap-4 mb-8"
        >
          <div className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
            <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">Total Projects</div>
            <div className="text-3xl font-bold text-foreground tabular-nums">{projects.length}</div>
            <div className="text-xs text-muted-foreground mt-1">in system</div>
          </div>
        </motion.div>

        {/* Projects card */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-10">
          <CardHeader className="pb-4">
            <CardTitle className="text-3xl font-bold">Projects</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, number or city…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={inputCls + " px-4 py-2.5 w-auto"}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "All Statuses" : s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
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
                  <path d="M2 20h20M5 20V8l7-6 7 6v12M9 20v-6h6v6" />
                </svg>
                <p className="text-sm">No projects found.</p>
                {search && (
                  <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="text-xs text-primary hover:underline">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => (
                  <ProjectCard key={p.id} project={p} onSelect={onSelect} />
                ))}
              </div>
            )}

            {!fetching && projects.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">{projects.length} total projects</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── GLOBAL INCOME STATEMENTS TABLE ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1 h-6 rounded-full bg-gradient-to-b from-primary to-accent" />
            <h2 className="text-2xl font-bold text-foreground">All Income Statements</h2>
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-muted-foreground">Across every project + standalone entries</span>
          </div>
          {!fetching && (
            <GlobalIncomeStatementsTable projects={projects} canEdit={true} />
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─── STATEMENTS VIEW (per-project) ───────────────────────────────────────────
function StatementsView({ project, canEdit, onBack }: { project: Project; canEdit: boolean; onBack: () => void }) {
  const [statements, setStatements] = useState<IncomeStatement[]>([]);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatementStatus | "All">("All");
  const [modal, setModal] = useState<null | "create" | "edit">(null);
  const [editing, setEditing] = useState<IncomeStatement | null>(null);
  const [deleting, setDeleting] = useState<IncomeStatement | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<StatementStatus, boolean>>(
    Object.fromEntries(STATEMENT_STATUSES.map((s) => [s, true])) as Record<StatementStatus, boolean>
  );
  const { toasts, push } = useToast();

  const fetchStatements = useCallback(async () => {
    setFetching(true);
    setStatements([]);
    try {
      const data = await api.list();
      setStatements(data);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to load statements.", "error");
    } finally {
      setFetching(false);
    }
  }, [push]);

  useEffect(() => { fetchStatements(); }, [fetchStatements]);

  const handleCreate = async (form: ISFormData) => {
    setSaving(true);
    try {
      const row = await api.create({ ...form, project_id: project.id });
      setStatements((p) => [row, ...p]);
      push("Income statement added.");
      setModal(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to add statement.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: ISFormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      setStatements((p) => p.map((s) => (s.id === editing.id ? row : s)));
      push("Income statement updated.");
      setModal(null);
      setEditing(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to update statement.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      setStatements((p) => p.filter((s) => s.id !== deleting.id));
      push("Income statement deleted.");
      setDeleting(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to delete statement.", "error");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(
    () =>
      statements.filter((s) => {
        if (filterStatus !== "All" && s.status !== filterStatus) return false;
        if (search) {
          const q = search.toLowerCase();
          return s.period_label.toLowerCase().includes(q) || (s.notes ?? "").toLowerCase().includes(q);
        }
        return true;
      }),
    [statements, filterStatus, search]
  );

  const grouped = useMemo(() => {
    const g: Partial<Record<StatementStatus, IncomeStatement[]>> = {};
    STATEMENT_STATUSES.forEach((st) => {
      const items = filtered.filter((s) => s.status === st);
      if (items.length) g[st] = items;
    });
    return g;
  }, [filtered]);

  const statusTotals = useMemo(
    () =>
      Object.fromEntries(
        STATEMENT_STATUSES.map((st) => {
          const rows = statements.filter((s) => s.status === st);
          return [
            st,
            {
              count: rows.length,
              gross_revenue: rows.reduce((a, s) => a + Number(s.gross_revenue), 0),
              net_income: rows.reduce((a, s) => a + Number(s.net_income), 0),
            },
          ];
        })
      ) as Record<StatementStatus, { count: number; gross_revenue: number; net_income: number }>,
    [statements]
  );

  const grandRevenue   = statements.reduce((a, s) => a + Number(s.gross_revenue), 0);
  const grandCOGS      = statements.reduce((a, s) => a + Number(s.cost_of_goods_sold), 0);
  const grandOpEx      = statements.reduce((a, s) => a + Number(s.operating_expenses), 0);
  const grandNetIncome = statements.reduce((a, s) => a + Number(s.net_income), 0);
  const finalizedCount = statements.filter((s) => s.status === "Final").length;
  const finalizedPct   = statements.length > 0 ? Math.round((finalizedCount / statements.length) * 100) : 0;
  const projectStatus  = project.status ?? "planning";

  const defaultForm: ISFormData = {
    period_label: "", start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10), status: "Draft", notes: "",
    project_id: project.id, gross_revenue: 0, returns_and_allowances: 0,
    cost_of_goods_sold: 0, operating_expenses: 0, other_income: 0,
    other_expenses: 0, income_tax_expense: 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${
                t.type === "success"
                  ? "bg-emerald-950/80 border-emerald-500/25 text-emerald-300"
                  : "bg-rose-950/80 border-rose-500/25 text-rose-300"
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
          <StatementModal initial={defaultForm} onSave={handleCreate} onClose={() => setModal(null)} loading={saving} />
        )}
        {modal === "edit" && editing && (
          <StatementModal initial={{ ...editing }} onSave={handleUpdate} onClose={() => { setModal(null); setEditing(null); }} loading={saving} />
        )}
        {deleting && (
          <DeleteConfirm statement={deleting} onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={saving} />
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-16">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-10">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6" />
            </svg>
            All Projects
          </button>

          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">Income Statement</p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">{project.project_number}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${PROJECT_STATUS_STYLE[projectStatus] ?? PROJECT_STATUS_STYLE.planning}`}>
                  {projectStatus.replace(/_/g, " ")}
                </span>
              </div>
              <h1 className="text-5xl md:text-7xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">{project.title}</span>
              </h1>
              {project.site_city && (
                <p className="text-xl text-muted-foreground mt-2">
                  {project.site_city}{project.site_country ? `, ${project.site_country}` : ""}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Status filter cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8"
        >
          {STATEMENT_STATUSES.map((st) => {
            const s = STATUS_STYLE_IS[st];
            const isActive = filterStatus === st;
            const totals = statusTotals[st];
            return (
              <button
                key={st}
                onClick={() => setFilterStatus(isActive ? "All" : st)}
                className={`rounded-2xl border p-4 text-left transition-all duration-200 backdrop-blur-sm bg-white/5 ${
                  isActive ? "border-white/20 ring-1 ring-white/20 scale-[1.02]" : "border-white/10 hover:border-white/20 hover:scale-[1.01]"
                }`}
              >
                <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${s.accent}`}>{st}</div>
                <div className="text-2xl font-bold text-foreground tabular-nums">{totals.count}</div>
                <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                  {totals.count > 0 ? (
                    <span className={totals.net_income >= 0 ? "text-emerald-400/80" : "text-rose-400/80"}>Net {fmtC(totals.net_income)}</span>
                  ) : "—"}
                </div>
              </button>
            );
          })}

          {/* Finalized rate card */}
          <div className={`rounded-2xl border p-4 text-left backdrop-blur-sm ${
            finalizedPct === 100 ? "bg-emerald-500/5 border-emerald-500/20"
            : finalizedPct >= 50 ? "bg-yellow-500/5 border-yellow-500/20"
            : "bg-rose-500/5 border-rose-500/20"
          }`}>
            <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${
              finalizedPct === 100 ? "text-emerald-400" : finalizedPct >= 50 ? "text-yellow-400" : "text-rose-400"
            }`}>Finalized</div>
            <div className={`text-2xl font-bold tabular-nums ${
              finalizedPct === 100 ? "text-emerald-400" : finalizedPct >= 50 ? "text-yellow-400" : "text-rose-400"
            }`}>{finalizedPct}%</div>
            <div className="text-xs text-muted-foreground mt-1">{finalizedCount} / {statements.length} statements</div>
          </div>
        </motion.div>

        {/* Main card */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-3xl font-bold">Income Statements</CardTitle>
              {canEdit && (
                <button
                  onClick={() => setModal("create")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg"
                  style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New Statement
                </button>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by period label or notes…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as StatementStatus | "All")}
                className={inputCls + " px-4 py-2.5 w-auto"}
              >
                <option value="All">All Statuses</option>
                {STATEMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
                {filtered.length} / {statements.length} shown
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
                <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                Loading income statements…
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8" />
                </svg>
                <p className="text-sm">No income statements yet.</p>
                {canEdit && (
                  <button onClick={() => setModal("create")} className="text-xs text-primary hover:underline">
                    Add first statement
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {STATEMENT_STATUSES.filter((st) => grouped[st]).map((stStatus) => {
                  const s = STATUS_STYLE_IS[stStatus];
                  const isOpen = expanded[stStatus];
                  const rows = grouped[stStatus]!;
                  const subtotalRevenue  = rows.reduce((a, r) => a + Number(r.gross_revenue), 0);
                  const subtotalNetRev   = rows.reduce((a, r) => a + Number(r.net_revenue), 0);
                  const subtotalGross    = rows.reduce((a, r) => a + Number(r.gross_profit), 0);
                  const subtotalOpIncome = rows.reduce((a, r) => a + Number(r.operating_income), 0);
                  const subtotalNet      = rows.reduce((a, r) => a + Number(r.net_income), 0);

                  return (
                    <div key={stStatus}>
                      <button
                        onClick={() => setExpanded((p) => ({ ...p, [stStatus]: !p[stStatus] }))}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                          <span className={`text-xs font-bold uppercase tracking-[0.12em] ${s.accent}`}>{stStatus}</span>
                          <Badge className={`text-xs px-2.5 py-0.5 font-mono border rounded-full ${s.badge}`}>{rows.length}</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-semibold tabular-nums text-foreground hidden md:block">Rev {fmtC(subtotalRevenue)}</span>
                          <span className={`text-sm font-semibold tabular-nums ${subtotalNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            Net {subtotalNet < 0 ? `(${fmtC(Math.abs(subtotalNet))})` : fmtC(subtotalNet)}
                          </span>
                          <svg className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            key="rows"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            style={{ overflow: "hidden" }}
                          >
                            {/* Mobile card list — no horizontal scroll */}
                            <div className="md:hidden divide-y divide-white/8">
                              {rows.map((stmt) => {
                                const sfmt = (n: number) => n < 0 ? `(${fmt(Math.abs(n))})` : fmt(n);
                                const meta = [
                                  { label: "Dates",         node: `${fmtDate(stmt.start_date)} – ${fmtDate(stmt.end_date)}` },
                                  { label: "Gross Revenue", node: fmt(Number(stmt.gross_revenue)) },
                                  { label: "Returns",       node: fmt(Number(stmt.returns_and_allowances)) },
                                  { label: "COGS",          node: fmt(Number(stmt.cost_of_goods_sold)) },
                                  { label: "Op. Expenses",  node: fmt(Number(stmt.operating_expenses)) },
                                  { label: "Op. Income",    node: sfmt(Number(stmt.operating_income)) },
                                  { label: "Before Tax",    node: sfmt(Number(stmt.income_before_tax)) },
                                  { label: "Tax",           node: fmt(Number(stmt.income_tax_expense)) },
                                  { label: "Last Updated",  node: fmtDateTime(stmt.updated_at ?? stmt.created_at) },
                                ];
                                return (
                                  <div key={stmt.id} className="px-4 py-4">
                                    <p className="font-semibold text-foreground text-sm mb-3">{stmt.period_label}</p>
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                      {[
                                        { l: "Net Revenue",  v: fmt(Number(stmt.net_revenue)),  c: "text-sky-300" },
                                        { l: "Gross Profit", v: sfmt(Number(stmt.gross_profit)), c: Number(stmt.gross_profit) >= 0 ? "text-emerald-400" : "text-rose-400" },
                                        { l: "Net Income",   v: sfmt(Number(stmt.net_income)),   c: Number(stmt.net_income) >= 0 ? "text-emerald-400" : "text-rose-400" },
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
                                        <button onClick={() => { setEditing(stmt); setModal("edit"); }}
                                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground border border-white/10 hover:bg-white/5 transition-all">
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                          Edit
                                        </button>
                                        <button onClick={() => setDeleting(stmt)}
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
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-y border-white/6" style={{ background: "rgba(255,255,255,0.03)" }}>
                                    {[
                                      "Period", "Dates", "Gross Revenue", "Returns", "Net Revenue",
                                      "COGS", "Gross Profit", "Op. Expenses", "Op. Income",
                                      "Other Net", "Inc. Before Tax", "Tax", "Net Income",
                                      "Last Updated",
                                      ...(canEdit ? ["Actions"] : []),
                                    ].map((h) => (
                                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((stmt, ri) => {
                                    const netInc    = Number(stmt.net_income);
                                    const grossProf = Number(stmt.gross_profit);
                                    const opInc     = Number(stmt.operating_income);
                                    const beforeTax = Number(stmt.income_before_tax);
                                    const otherNet  = Number(stmt.other_income) - Number(stmt.other_expenses);

                                    return (
                                      <motion.tr
                                        key={stmt.id}
                                        initial={{ opacity: 0, x: -6 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: ri * 0.02, duration: 0.16 }}
                                        className={`border-b border-white/5 transition-colors ${s.row}`}
                                      >
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="font-semibold text-sm text-foreground">{stmt.period_label}</span>
                                          {stmt.notes && <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">{stmt.notes}</div>}
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground font-mono">
                                          {fmtDate(stmt.start_date)}<br />{fmtDate(stmt.end_date)}
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="text-sm font-semibold tabular-nums text-foreground font-mono">{fmt(Number(stmt.gross_revenue))}</span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="text-xs tabular-nums text-muted-foreground font-mono">{fmt(Number(stmt.returns_and_allowances))}</span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="text-sm font-semibold tabular-nums text-sky-300 font-mono">{fmt(Number(stmt.net_revenue))}</span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="text-xs tabular-nums text-rose-300 font-mono">{fmt(Number(stmt.cost_of_goods_sold))}</span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className={`text-sm font-bold tabular-nums font-mono ${grossProf >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                            {grossProf < 0 ? `(${fmt(Math.abs(grossProf))})` : fmt(grossProf)}
                                          </span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="text-xs tabular-nums text-orange-300 font-mono">{fmt(Number(stmt.operating_expenses))}</span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className={`text-sm font-semibold tabular-nums font-mono ${opInc >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                            {opInc < 0 ? `(${fmt(Math.abs(opInc))})` : fmt(opInc)}
                                          </span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className={`text-xs tabular-nums font-mono ${otherNet >= 0 ? "text-muted-foreground" : "text-rose-400/70"}`}>
                                            {otherNet < 0 ? `(${fmt(Math.abs(otherNet))})` : fmt(otherNet)}
                                          </span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className={`text-xs tabular-nums font-mono ${beforeTax >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
                                            {beforeTax < 0 ? `(${fmt(Math.abs(beforeTax))})` : fmt(beforeTax)}
                                          </span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="text-xs tabular-nums text-violet-300 font-mono">{fmt(Number(stmt.income_tax_expense))}</span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className={`text-sm font-bold tabular-nums font-mono ${netInc >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                            {netInc < 0 ? `(${fmt(Math.abs(netInc))})` : fmt(netInc)}
                                          </span>
                                        </td>
                                        {/* Last Updated */}
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="text-[10px] tabular-nums text-muted-foreground font-mono leading-relaxed">
                                            {fmtDateTime(stmt.updated_at ?? stmt.created_at)}
                                          </span>
                                        </td>
                                        {canEdit && (
                                          <td className="px-5 py-3.5 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                              <button
                                                onClick={() => { setEditing(stmt); setModal("edit"); }}
                                                title="Edit"
                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                                              >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                              </button>
                                              <button
                                                onClick={() => setDeleting(stmt)}
                                                title="Delete"
                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                              >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                  <polyline points="3 6 5 6 21 6" />
                                                  <path d="M19 6l-1 14H6L5 6" />
                                                  <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                                                </svg>
                                              </button>
                                            </div>
                                          </td>
                                        )}
                                      </motion.tr>
                                    );
                                  })}
                                </tbody>

                                <tfoot>
                                  <tr className="border-t border-white/10" style={{ background: "rgba(255,255,255,0.02)" }}>
                                    <td colSpan={2} className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                      Subtotal — {stStatus}
                                    </td>
                                    <td className="px-5 py-2.5 text-sm font-bold tabular-nums text-foreground font-mono">{fmt(subtotalRevenue)}</td>
                                    <td />
                                    <td className="px-5 py-2.5 text-sm font-bold tabular-nums text-sky-300 font-mono">{fmt(subtotalNetRev)}</td>
                                    <td />
                                    <td className={`px-5 py-2.5 text-sm font-bold tabular-nums font-mono ${subtotalGross >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      {subtotalGross < 0 ? `(${fmt(Math.abs(subtotalGross))})` : fmt(subtotalGross)}
                                    </td>
                                    <td />
                                    <td className={`px-5 py-2.5 text-sm font-bold tabular-nums font-mono ${subtotalOpIncome >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      {subtotalOpIncome < 0 ? `(${fmt(Math.abs(subtotalOpIncome))})` : fmt(subtotalOpIncome)}
                                    </td>
                                    <td colSpan={2} />
                                    <td />
                                    <td className={`px-5 py-2.5 text-sm font-bold tabular-nums font-mono ${subtotalNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      {subtotalNet < 0 ? `(${fmt(Math.abs(subtotalNet))})` : fmt(subtotalNet)}
                                    </td>
                                    <td colSpan={canEdit ? 2 : 1} />
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

                {/* Grand total */}
                {statements.length > 0 && (
                  <div className={`px-6 py-4 flex flex-wrap items-center gap-6 text-xs font-mono ${grandNetIncome >= 0 ? "bg-emerald-950/20" : "bg-rose-950/20"}`}>
                    <span className="text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wider">Grand Total</span>
                    <span className="text-foreground">Revenue {fmt(grandRevenue)}</span>
                    <span className="text-muted-foreground">−</span>
                    <span className="text-rose-300">COGS {fmt(grandCOGS)}</span>
                    <span className="text-muted-foreground">−</span>
                    <span className="text-orange-300">OpEx {fmt(grandOpEx)}</span>
                    <span className="text-muted-foreground">=</span>
                    <span className={grandNetIncome >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                      Net {grandNetIncome < 0 ? `(${fmt(Math.abs(grandNetIncome))})` : fmt(grandNetIncome)}
                    </span>
                    <Badge className={`ml-auto ${grandNetIncome >= 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border-rose-500/30 text-rose-300"}`}>
                      {statements.length} statements · {finalizedPct}% finalized
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {!fetching && statements.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">{statements.length} total statements · {finalizedCount} finalized</span>
                <button onClick={fetchStatements} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
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
export default function IncomeStatementPage({ projectId, canEdit = true }: Props) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,site_address,site_city,site_country,start_date,expected_completion_date,created_at")
      .eq("id", projectId)
      .single()
      .then(({ data }) => { if (data) setSelectedProject(data as Project); })
      .catch(console.error);
  }, [projectId]);

  return (
    <AnimatePresence mode="wait">
      {selectedProject ? (
        <motion.div key={selectedProject.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
          <StatementsView project={selectedProject} canEdit={canEdit} onBack={() => setSelectedProject(null)} />
        </motion.div>
      ) : (
        <motion.div key="picker" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.25 }}>
          <ProjectPickerView onSelect={setSelectedProject} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}