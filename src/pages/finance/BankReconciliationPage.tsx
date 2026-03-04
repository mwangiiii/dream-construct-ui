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

type ReconciliationStatus = "Reconciled" | "Unreconciled" | "Pending" | "Disputed";
type TransactionType      = "Deposit" | "Withdrawal" | "Transfer" | "Interest" | "Fee" | "Adjustment";

interface BankReconciliationEntry {
  id:                   number;
  project_id:           string;
  bank_code:            string;
  transaction_date:     string;
  description:          string;
  transaction_code:     string | null;
  transaction_type:     TransactionType;
  book_amount:          number;
  bank_amount:          number;
  difference:           number;
  reconciliation_status: ReconciliationStatus;
  reconciled_by:        string | null;
  reconciled_at:        string | null;
  notes:                string | null;
  reference_number:     string | null;
  last_updated:         string | null;
  created_at?:          string;
  updated_at?:          string;
}

type BRFormData = Omit<BankReconciliationEntry, "id" | "created_at" | "updated_at" | "difference">;

interface Props {
  projectId?: string;
  canEdit?:   boolean;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const RECONCILIATION_STATUSES: ReconciliationStatus[] = ["Reconciled", "Unreconciled", "Pending", "Disputed"];
const TRANSACTION_TYPES: TransactionType[]             = ["Deposit", "Withdrawal", "Transfer", "Interest", "Fee", "Adjustment"];

const STATUS_STYLE_RECON: Record<ReconciliationStatus, { accent: string; badge: string; dot: string; row: string }> = {
  Reconciled:   { accent: "text-emerald-400", badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", dot: "bg-emerald-400", row: "hover:bg-emerald-950/30" },
  Unreconciled: { accent: "text-rose-400",    badge: "bg-rose-500/10    border-rose-500/30    text-rose-300",    dot: "bg-rose-400",    row: "hover:bg-rose-950/30"    },
  Pending:      { accent: "text-yellow-400",  badge: "bg-yellow-500/10  border-yellow-500/30  text-yellow-300",  dot: "bg-yellow-400",  row: "hover:bg-yellow-950/30"  },
  Disputed:     { accent: "text-orange-400",  badge: "bg-orange-500/10  border-orange-500/30  text-orange-300",  dot: "bg-orange-400",  row: "hover:bg-orange-950/30"  },
};

const PROJECT_STATUS_STYLE: Record<string, string> = {
  planning:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  on_hold:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const makeEmptyForm = (projectId: string): BRFormData => ({
  project_id:            projectId,
  bank_code:             "",
  transaction_date:      new Date().toISOString().split("T")[0],
  description:           "",
  transaction_code:      "",
  transaction_type:      "Deposit",
  book_amount:           0,
  bank_amount:           0,
  reconciliation_status: "Unreconciled",
  reconciled_by:         null,
  reconciled_at:         null,
  notes:                 null,
  reference_number:      null,
  last_updated:          new Date().toISOString().split("T")[0],
});

const fmt = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const calcDifference = (book: number, bank: number) =>
  parseFloat((book - bank).toFixed(2));

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
  async list(projectId: string): Promise<BankReconciliationEntry[]> {
    const { data, error } = await supabase
      .from("bank_reconciliation_entries")
      .select("*")
      .eq("project_id", projectId)
      .order("transaction_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as BankReconciliationEntry[];
  },
  async create(body: BRFormData): Promise<BankReconciliationEntry> {
    // `difference` is GENERATED ALWAYS AS (book_amount - bank_amount) STORED in Postgres.
    // Never include it in INSERT — Postgres computes it automatically.
    const { difference: _drop, ...payload } = { ...body, difference: undefined };
    const { data, error } = await supabase
      .from("bank_reconciliation_entries").insert([payload]).select().single();
    if (error) throw new Error(error.message);
    return data as BankReconciliationEntry;
  },
  async update(id: number, body: BRFormData): Promise<BankReconciliationEntry> {
    // `difference` is a generated column — never write it in UPDATE payloads.
    const { difference: _drop2, ...safeBody } = body as Record<string, unknown>;
    const payload = {
      ...safeBody,
      updated_at:   new Date().toISOString(),
      last_updated: new Date().toISOString().split("T")[0],
    };
    const { data, error } = await supabase
      .from("bank_reconciliation_entries")
      .update(payload)
      .eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data as BankReconciliationEntry;
  },
  async remove(id: number): Promise<void> {
    const { error } = await supabase.from("bank_reconciliation_entries").delete().eq("id", id);
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

// ─── SHARED ───────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/40 transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

// ─── ENTRY MODAL ──────────────────────────────────────────────────────────────

function EntryModal({ initial, onSave, onClose, loading }: {
  initial: BRFormData & { id?: number };
  onSave:  (d: BRFormData) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<BRFormData>({ ...initial });
  const isEdit = Boolean(initial.id);

  const setField = (k: keyof BRFormData, v: unknown) =>
    setForm((prev) => ({ ...prev, [k]: v } as BRFormData));

  const livePreviewDiff = calcDifference(form.book_amount, form.bank_amount);

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
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.96,  y: 8  }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            {isEdit ? "Edit Reconciliation Entry" : "New Reconciliation Entry"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
          <Field label="Bank Code *">
            <input value={form.bank_code} onChange={(e) => setField("bank_code", e.target.value)}
              placeholder="e.g. BANK-001" className={inputCls} />
          </Field>
          <Field label="Transaction Type *">
            <select value={form.transaction_type} onChange={(e) => setField("transaction_type", e.target.value as TransactionType)} className={inputCls}>
              {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Description *">
              <input value={form.description} onChange={(e) => setField("description", e.target.value)}
                placeholder="e.g. Payment received from client ABC" className={inputCls} />
            </Field>
          </div>
          <Field label="Transaction Code">
            <input value={form.transaction_code ?? ""} onChange={(e) => setField("transaction_code", e.target.value || null)}
              placeholder="e.g. TX-001" className={inputCls} />
          </Field>
          <Field label="Reference Number">
            <input value={form.reference_number ?? ""} onChange={(e) => setField("reference_number", e.target.value || null)}
              placeholder="e.g. REF-2024-001" className={inputCls} />
          </Field>
          <Field label="Transaction Date *">
            <input type="date" value={form.transaction_date}
              onChange={(e) => setField("transaction_date", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Reconciliation Status *">
            <select value={form.reconciliation_status}
              onChange={(e) => setField("reconciliation_status", e.target.value as ReconciliationStatus)} className={inputCls}>
              {RECONCILIATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Book Amount (USD) *">
            <input type="number" step="0.01" min="0" value={form.book_amount}
              onChange={(e) => setField("book_amount", parseFloat(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Bank Amount (USD) *">
            <input type="number" step="0.01" min="0" value={form.bank_amount}
              onChange={(e) => setField("bank_amount", parseFloat(e.target.value) || 0)} className={inputCls} />
          </Field>

          {/* Live difference preview */}
          <div className="col-span-2">
            <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
              livePreviewDiff === 0
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-rose-500/5 border-rose-500/20"
            }`}>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Calculated Difference</span>
              <span className={`text-sm font-bold font-mono tabular-nums ${livePreviewDiff === 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {fmt(livePreviewDiff)}
                {livePreviewDiff === 0 ? " ✓" : " ⚠"}
              </span>
            </div>
          </div>

          <Field label="Reconciled By">
            <input value={form.reconciled_by ?? ""} onChange={(e) => setField("reconciled_by", e.target.value || null)}
              placeholder="e.g. John Smith" className={inputCls} />
          </Field>
          <Field label="Reconciled At">
            <input type="date" value={form.reconciled_at?.split("T")[0] ?? ""}
              onChange={(e) => setField("reconciled_at", e.target.value ? e.target.value + "T00:00:00" : null)} className={inputCls} />
          </Field>
          <div className="col-span-2">
            <Field label="Notes">
              <textarea value={form.notes ?? ""} onChange={(e) => setField("notes", e.target.value || null)}
                rows={2} placeholder="Additional notes…" className={inputCls + " resize-none"} />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)} disabled={loading || !form.bank_code || !form.description}
            className="px-5 py-2 text-sm font-medium rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center gap-2"
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

function DeleteConfirm({ entry, onConfirm, onClose, loading }: {
  entry: BankReconciliationEntry; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-xl bg-white/10"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
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
              Permanently delete{" "}
              <span className="text-foreground font-medium">{entry.description}</span>{" "}
              (<span className="font-mono text-primary text-xs">{entry.transaction_code ?? entry.bank_code}</span>)?
              {" "}This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white transition-all disabled:opacity-50 flex items-center gap-2">
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Delete Entry
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── PROJECT CARD ─────────────────────────────────────────────────────────────

function ProjectCard({ project, onSelect, entryCount }: {
  project: Project; onSelect: (p: Project) => void; entryCount: number;
}) {
  const status    = project.status ?? "planning";
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
        {entryCount > 0 && (
          <span className="text-[10px] text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded-full flex-shrink-0 tabular-nums">
            {entryCount} {entryCount === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      <h3 className="font-semibold text-foreground text-sm mb-1.5 group-hover:text-primary transition-colors leading-snug line-clamp-1">
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
            {fmt(project.budget_numeric, project.currency?.trim() || "USD")}
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
        <span>Open Reconciliation</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </div>
    </motion.button>
  );
}

// ─── PROJECT PICKER VIEW ──────────────────────────────────────────────────────

function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [fetching,     setFetching]     = useState(true);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [entryCounts,  setEntryCounts]  = useState<Record<string, number>>({});
  const { toasts, push } = useToast();

  useEffect(() => {
    setFetching(true);
    api.projects()
      .then(async (data) => {
        setProjects(data);
        if (data.length > 0) {
          const ids = data.map((p) => p.id);
          const { data: counts } = await supabase
            .from("bank_reconciliation_entries").select("project_id").in("project_id", ids);
          if (counts) {
            const tally: Record<string, number> = {};
            (counts as { project_id: string }[]).forEach((r) => {
              tally[r.project_id] = (tally[r.project_id] ?? 0) + 1;
            });
            setEntryCounts(tally);
          }
        }
      })
      .catch((err: unknown) => push(err instanceof Error ? err.message : "Failed to load projects.", "error"))
      .finally(() => setFetching(false));
  }, [push]);

  const statuses = useMemo(() => {
    const s = new Set(projects.map((p) => p.status ?? "planning"));
    return ["all", ...Array.from(s)];
  }, [projects]);

  const filtered = useMemo(() =>
    projects.filter((p) => {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id}
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${
                t.type === "success"
                  ? "bg-emerald-950/80 border-emerald-500/25 text-emerald-300"
                  : "bg-rose-950/80 border-rose-500/25 text-rose-300"
              }`}
            >{t.msg}</motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="container mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">Finance Module</p>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
            Bank{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Reconciliation
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Select a project to view or manage its bank reconciliation records.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Projects",              value: projects.length,                                                 sub: "in system"          },
            { label: "Projects with Entries",        value: Object.keys(entryCounts).length,                                sub: "have BR records"    },
            { label: "Total Reconciliation Entries", value: Object.values(entryCounts).reduce((a, b) => a + b, 0),          sub: "across all projects" },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">{card.label}</div>
              <div className="text-3xl font-bold text-foreground tabular-nums">{card.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{card.sub}</div>
            </div>
          ))}
        </motion.div>

        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-3xl font-bold">Projects</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, number or city…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all">
                {statuses.map((s) => (
                  <option key={s} value={s}>{s === "all" ? "All Statuses" : s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>
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
                {search && (
                  <button onClick={() => { setSearch(""); setStatusFilter("all"); }}
                    className="text-xs text-primary hover:underline">Clear filters</button>
                )}
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => (
                  <ProjectCard key={p.id} project={p} onSelect={onSelect} entryCount={entryCounts[p.id] ?? 0} />
                ))}
              </div>
            )}
            {!fetching && projects.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {projects.length} total projects · {Object.keys(entryCounts).length} with reconciliation entries
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── ENTRIES VIEW ─────────────────────────────────────────────────────────────

function EntriesView({ project, canEdit, onBack }: {
  project: Project; canEdit: boolean; onBack: () => void;
}) {
  const [entries,      setEntries]      = useState<BankReconciliationEntry[]>([]);
  const [fetching,     setFetching]     = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState<ReconciliationStatus | "All">("All");
  const [modal,        setModal]        = useState<null | "create" | "edit">(null);
  const [editing,      setEditing]      = useState<BankReconciliationEntry | null>(null);
  const [deleting,     setDeleting]     = useState<BankReconciliationEntry | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [expanded,     setExpanded]     = useState<Record<ReconciliationStatus, boolean>>(
    Object.fromEntries(RECONCILIATION_STATUSES.map((s) => [s, true])) as Record<ReconciliationStatus, boolean>
  );

  const { toasts, push } = useToast();
  const currency = project.currency?.trim() || "USD";

  const fetchEntries = useCallback(async () => {
    setFetching(true);
    setEntries([]);
    try {
      const data = await api.list(project.id);
      setEntries(data);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to load entries.", "error");
    } finally { setFetching(false); }
  }, [project.id, push]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleCreate = async (form: BRFormData) => {
    setSaving(true);
    try {
      const row = await api.create({ ...form, project_id: project.id });
      setEntries((p) => [row, ...p]);
      push("Entry added successfully.");
      setModal(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to add entry.", "error");
    } finally { setSaving(false); }
  };

  const handleUpdate = async (form: BRFormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      setEntries((p) => p.map((e) => (e.id === editing.id ? row : e)));
      push("Entry updated successfully.");
      setModal(null); setEditing(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to update entry.", "error");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      setEntries((p) => p.filter((e) => e.id !== deleting.id));
      push("Entry deleted.");
      setDeleting(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to delete entry.", "error");
    } finally { setSaving(false); }
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    entries.filter((e) => {
      if (filterStatus !== "All" && e.reconciliation_status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return e.description.toLowerCase().includes(q) ||
          (e.transaction_code   ?? "").toLowerCase().includes(q) ||
          (e.bank_code          ?? "").toLowerCase().includes(q) ||
          (e.reference_number   ?? "").toLowerCase().includes(q);
      }
      return true;
    }),
  [entries, filterStatus, search]);

  const grouped = useMemo(() => {
    const g: Partial<Record<ReconciliationStatus, BankReconciliationEntry[]>> = {};
    RECONCILIATION_STATUSES.forEach((s) => {
      const items = filtered.filter((e) => e.reconciliation_status === s);
      if (items.length) g[s] = items;
    });
    return g;
  }, [filtered]);

  const statusTotals = useMemo(
    () => Object.fromEntries(
      RECONCILIATION_STATUSES.map((status) => [
        status,
        {
          count:      entries.filter((e) => e.reconciliation_status === status).length,
          book:       entries.filter((e) => e.reconciliation_status === status).reduce((s, e) => s + Number(e.book_amount), 0),
          bank:       entries.filter((e) => e.reconciliation_status === status).reduce((s, e) => s + Number(e.bank_amount), 0),
          difference: entries.filter((e) => e.reconciliation_status === status).reduce((s, e) => s + Number(e.difference), 0),
        }
      ])
    ) as Record<ReconciliationStatus, { count: number; book: number; bank: number; difference: number }>,
    [entries]
  );

  const grandTotalBook       = entries.reduce((s, e) => s + Number(e.book_amount),  0);
  const grandTotalBank       = entries.reduce((s, e) => s + Number(e.bank_amount),  0);
  const grandTotalDifference = entries.reduce((s, e) => s + Number(e.difference),   0);
  const reconciledCount      = entries.filter((e) => e.reconciliation_status === "Reconciled").length;
  const reconciledPct        = entries.length > 0 ? Math.round((reconciledCount / entries.length) * 100) : 0;

  const status = project.status ?? "planning";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id}
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${
                t.type === "success"
                  ? "bg-emerald-950/80 border-emerald-500/25 text-emerald-300"
                  : "bg-rose-950/80 border-rose-500/25 text-rose-300"
              }`}
            >{t.msg}</motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal === "create" && (
          <EntryModal initial={makeEmptyForm(project.id)} onSave={handleCreate}
            onClose={() => setModal(null)} loading={saving} />
        )}
        {modal === "edit" && editing && (
          <EntryModal initial={{ ...editing }} onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }} loading={saving} />
        )}
        {deleting && (
          <DeleteConfirm entry={deleting} onConfirm={handleDelete}
            onClose={() => setDeleting(null)} loading={saving} />
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-16">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-10">
          <button onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            All Projects
          </button>

          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">Bank Reconciliation</p>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
                  {project.project_number}
                </span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${PROJECT_STATUS_STYLE[status] ?? PROJECT_STATUS_STYLE.planning}`}>
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

        {/* Stat cards — filterable by reconciliation status */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {RECONCILIATION_STATUSES.map((rs) => {
            const s        = STATUS_STYLE_RECON[rs];
            const isActive = filterStatus === rs;
            return (
              <button key={rs}
                onClick={() => setFilterStatus(isActive ? "All" : rs)}
                className={`rounded-2xl border p-4 text-left transition-all duration-200 backdrop-blur-sm bg-white/5 ${
                  isActive ? "border-white/20 ring-1 ring-white/20 scale-[1.02]" : "border-white/10 hover:border-white/20 hover:scale-[1.01]"
                }`}
              >
                <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${s.accent}`}>{rs}</div>
                <div className="text-2xl font-bold text-foreground tabular-nums">{statusTotals[rs]?.count ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                  Δ {fmt(statusTotals[rs]?.difference ?? 0, currency)}
                </div>
              </button>
            );
          })}
          {/* Reconciliation rate card */}
          <div className={`rounded-2xl border p-4 text-left backdrop-blur-sm ${
            reconciledPct === 100
              ? "bg-emerald-500/5 border-emerald-500/20"
              : reconciledPct >= 50
                ? "bg-yellow-500/5 border-yellow-500/20"
                : "bg-rose-500/5 border-rose-500/20"
          }`}>
            <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${
              reconciledPct === 100 ? "text-emerald-400" : reconciledPct >= 50 ? "text-yellow-400" : "text-rose-400"
            }`}>Reconciled</div>
            <div className={`text-2xl font-bold tabular-nums ${
              reconciledPct === 100 ? "text-emerald-400" : reconciledPct >= 50 ? "text-yellow-400" : "text-rose-400"
            }`}>{reconciledPct}%</div>
            <div className="text-xs text-muted-foreground mt-1">{reconciledCount} / {entries.length} entries</div>
          </div>
        </motion.div>

        {/* Main card */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-3xl font-bold">Reconciliation Entries</CardTitle>
              {canEdit && (
                <button
                  onClick={() => setModal("create")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg"
                  style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  New Entry
                </button>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by description, code or bank…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all" />
              </div>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as ReconciliationStatus | "All")}
                className="px-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all">
                <option value="All">All Statuses</option>
                {RECONCILIATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
                {filtered.length} / {entries.length} shown
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
                <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                Loading reconciliation entries…
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M9 14l2 2 4-4M3 6h18M3 12h18M3 18h18"/>
                </svg>
                <p className="text-sm">No reconciliation entries yet for this project.</p>
                {canEdit && (
                  <button onClick={() => setModal("create")} className="text-xs text-primary hover:underline">
                    Add first entry
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {RECONCILIATION_STATUSES.filter((rs) => grouped[rs]).map((reconStatus) => {
                  const s        = STATUS_STYLE_RECON[reconStatus];
                  const isOpen   = expanded[reconStatus];
                  const rows     = grouped[reconStatus]!;
                  const subtotalDiff = rows.reduce((sum, e) => sum + Number(e.difference), 0);
                  const subtotalBook = rows.reduce((sum, e) => sum + Number(e.book_amount), 0);

                  return (
                    <div key={reconStatus}>
                      {/* Group header toggle */}
                      <button
                        onClick={() => setExpanded((p) => ({ ...p, [reconStatus]: !p[reconStatus] }))}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                          <span className={`text-xs font-bold uppercase tracking-[0.12em] ${s.accent}`}>{reconStatus}</span>
                          <Badge className={`text-xs px-2.5 py-0.5 font-mono border rounded-full ${s.badge}`}>
                            {rows.length}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-sm font-semibold tabular-nums ${s.accent}`}>
                            {fmt(subtotalBook, currency)}
                          </span>
                          <svg
                            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                          >
                            <path d="m6 9 6 6 6-6"/>
                          </svg>
                        </div>
                      </button>

                      {/* Rows */}
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div key="rows"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            style={{ overflow: "hidden" }}
                          >
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-y border-white/6" style={{ background: "rgba(255,255,255,0.03)" }}>
                                    {[
                                      "Bank Code", "Tx Code", "Date", "Type", "Description",
                                      "Book Amount", "Bank Amount", "Difference", "Status",
                                      "Reconciled By", "Last Updated",
                                      ...(canEdit ? ["Actions"] : [])
                                    ].map((h) => (
                                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((entry, ri) => {
                                    const diffNum = Number(entry.difference);
                                    return (
                                      <motion.tr key={entry.id}
                                        initial={{ opacity: 0, x: -6 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: ri * 0.02, duration: 0.16 }}
                                        className={`border-b border-white/5 transition-colors ${s.row}`}
                                      >
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="font-mono text-xs font-semibold text-primary">{entry.bank_code || "—"}</span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="font-mono text-xs text-muted-foreground">{entry.transaction_code || "—"}</span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground font-mono">
                                          {fmtDate(entry.transaction_date)}
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                                            {entry.transaction_type}
                                          </span>
                                        </td>
                                        <td className="px-5 py-3.5 font-medium text-foreground max-w-xs">
                                          <span className="line-clamp-1">{entry.description}</span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="text-sm font-semibold tabular-nums text-foreground">{fmt(Number(entry.book_amount), currency)}</span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="text-sm font-semibold tabular-nums text-foreground">{fmt(Number(entry.bank_amount), currency)}</span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className={`text-sm font-bold tabular-nums ${
                                            diffNum === 0 ? "text-emerald-400" : diffNum > 0 ? "text-rose-400" : "text-orange-400"
                                          }`}>
                                            {diffNum === 0 ? "—" : fmt(diffNum, currency)}
                                          </span>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <Badge className={`text-xs px-2.5 py-0.5 border rounded-full ${STATUS_STYLE_RECON[entry.reconciliation_status].badge}`}>
                                            {entry.reconciliation_status}
                                          </Badge>
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                                          {entry.reconciled_by || "—"}
                                        </td>
                                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground font-mono">
                                          {fmtDate(entry.last_updated)}
                                        </td>
                                        {canEdit && (
                                          <td className="px-5 py-3.5 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                              <button
                                                onClick={() => { setEditing(entry); setModal("edit"); }}
                                                title="Edit"
                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                                              >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                              </button>
                                              <button
                                                onClick={() => setDeleting(entry)}
                                                title="Delete"
                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                              >
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
                                {/* Sub-total footer */}
                                <tfoot>
                                  <tr className="border-t border-white/10" style={{ background: "rgba(255,255,255,0.02)" }}>
                                    <td colSpan={5} className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                      Subtotal — {reconStatus}
                                    </td>
                                    <td className="px-5 py-2.5 text-sm font-bold tabular-nums text-foreground">
                                      {fmt(subtotalBook, currency)}
                                    </td>
                                    <td className="px-5 py-2.5 text-sm font-bold tabular-nums text-foreground">
                                      {fmt(rows.reduce((sum, e) => sum + Number(e.bank_amount), 0), currency)}
                                    </td>
                                    <td className={`px-5 py-2.5 text-sm font-bold tabular-nums ${subtotalDiff === 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      {subtotalDiff === 0 ? "—" : fmt(subtotalDiff, currency)}
                                    </td>
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

                {/* Grand total summary bar */}
                {entries.length > 0 && (
                  <div className={`px-6 py-4 flex flex-wrap items-center gap-6 text-xs font-mono ${
                    grandTotalDifference === 0 ? "bg-emerald-950/20" : "bg-rose-950/20"
                  }`}>
                    <span className="text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wider">Grand Total</span>
                    <span className="text-foreground">Book {fmt(grandTotalBook, currency)}</span>
                    <span className="text-muted-foreground">vs</span>
                    <span className="text-foreground">Bank {fmt(grandTotalBank, currency)}</span>
                    <span className="text-muted-foreground">Δ</span>
                    <span className={grandTotalDifference === 0 ? "text-emerald-400" : "text-rose-400"}>
                      {grandTotalDifference === 0 ? "No difference" : fmt(grandTotalDifference, currency)}
                    </span>
                    <Badge className={`ml-auto ${grandTotalDifference === 0
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"}`}>
                      {grandTotalDifference === 0 ? "✓ Fully Reconciled" : `⚠ ${reconciledPct}% Reconciled`}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            {!fetching && entries.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">{entries.length} total entries · {reconciledCount} reconciled</span>
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
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function BankReconciliationPage({ projectId, canEdit = true }: Props) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,currency,site_address,site_city,site_country,start_date,expected_completion_date,created_at")
      .eq("id", projectId)
      .single()
      .then(({ data }) => { if (data) setSelectedProject(data as Project); })
      .catch(console.error);
  }, [projectId]);

  return (
    <AnimatePresence mode="wait">
      {selectedProject ? (
        <motion.div key={selectedProject.id}
          initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
          <EntriesView
            project={selectedProject}
            canEdit={canEdit}
            onBack={() => { if (!projectId) setSelectedProject(null); }}
          />
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