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

type CashFlowQuarter = "Q1" | "Q2" | "Q3" | "Q4";
type CashFlowMonth   =
  | "January" | "February" | "March"    | "April"
  | "May"     | "June"     | "July"     | "August"
  | "September" | "October" | "November" | "December";

interface CashFlowEntry {
  id:              number;
  project_id:      string;
  year:            number;
  quarter:         CashFlowQuarter;
  month:           CashFlowMonth;
  inflows:         number;
  outflows:        number;
  net_cash_flow:   number;   // GENERATED ALWAYS AS (inflows - outflows) STORED
  account_codes:   string | null;
  etims_codes:     string | null;
  ending_balance:  number;
  notes:           string | null;
  created_at?:     string;
  updated_at?:     string;
}

type CFFormData = Omit<CashFlowEntry, "id" | "created_at" | "updated_at" | "net_cash_flow">;

interface Props {
  projectId?: string;
  canEdit?:   boolean;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const QUARTERS: CashFlowQuarter[] = ["Q1", "Q2", "Q3", "Q4"];
const MONTHS: CashFlowMonth[] = [
  "January", "February", "March",    "April",
  "May",     "June",     "July",     "August",
  "September", "October", "November", "December",
];

const QUARTER_OF_MONTH: Record<CashFlowMonth, CashFlowQuarter> = {
  January: "Q1", February: "Q1", March: "Q1",
  April:   "Q2", May:      "Q2", June: "Q2",
  July:    "Q3", August:   "Q3", September: "Q3",
  October: "Q4", November: "Q4", December:  "Q4",
};

const QUARTER_STYLE: Record<CashFlowQuarter, { accent: string; badge: string; dot: string; row: string }> = {
  Q1: { accent: "text-sky-400",     badge: "bg-sky-500/10     border-sky-500/30     text-sky-300",     dot: "bg-sky-400",     row: "hover:bg-sky-950/30"     },
  Q2: { accent: "text-violet-400",  badge: "bg-violet-500/10  border-violet-500/30  text-violet-300",  dot: "bg-violet-400",  row: "hover:bg-violet-950/30"  },
  Q3: { accent: "text-amber-400",   badge: "bg-amber-500/10   border-amber-500/30   text-amber-300",   dot: "bg-amber-400",   row: "hover:bg-amber-950/30"   },
  Q4: { accent: "text-emerald-400", badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", dot: "bg-emerald-400", row: "hover:bg-emerald-950/30" },
};

const PROJECT_STATUS_STYLE: Record<string, string> = {
  planning:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  on_hold:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const CURRENT_YEAR = new Date().getFullYear();

const makeEmptyForm = (projectId: string): CFFormData => ({
  project_id:     projectId,
  year:           CURRENT_YEAR,
  quarter:        "Q1",
  month:          "January",
  inflows:        0,
  outflows:       0,
  account_codes:  "",
  etims_codes:    "",
  ending_balance: 0,
  notes:          "",
});

const fmt = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);

const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "—";

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
  async list(projectId: string): Promise<CashFlowEntry[]> {
    const { data, error } = await supabase
      .from("cash_flow_entries")
      .select("*")
      .eq("project_id", projectId)
      .order("year",    { ascending: false })
      .order("quarter", { ascending: false })
      .order("month",   { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CashFlowEntry[];
  },
  async create(body: CFFormData): Promise<CashFlowEntry> {
    // net_cash_flow is GENERATED ALWAYS AS (inflows - outflows) STORED — never send it
    const { data, error } = await supabase
      .from("cash_flow_entries").insert([body]).select().single();
    if (error) throw new Error(error.message);
    return data as CashFlowEntry;
  },
  async update(id: number, body: CFFormData): Promise<CashFlowEntry> {
    // net_cash_flow is a generated column — omit it from the update payload
    const payload = { ...body, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from("cash_flow_entries")
      .update(payload)
      .eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data as CashFlowEntry;
  },
  async remove(id: number): Promise<void> {
    const { error } = await supabase.from("cash_flow_entries").delete().eq("id", id);
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
  initial: CFFormData & { id?: number };
  onSave:  (d: CFFormData) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<CFFormData>({ ...initial });
  const isEdit = Boolean(initial.id);

  const setField = (k: keyof CFFormData, v: unknown) =>
    setForm((prev) => {
      const next = { ...prev, [k]: v } as CFFormData;
      // Auto-sync quarter when month changes
      if (k === "month") next.quarter = QUARTER_OF_MONTH[v as CashFlowMonth];
      return next;
    });

  const liveNet = form.inflows - form.outflows;

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
            {isEdit ? "Edit Cash Flow Entry" : "New Cash Flow Entry"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
          <Field label="Year *">
            <input type="number" min={2000} max={2100} value={form.year}
              onChange={(e) => setField("year", parseInt(e.target.value) || CURRENT_YEAR)}
              className={inputCls} />
          </Field>
          <Field label="Month *">
            <div className="relative">
              <select
                value={form.month}
                onChange={(e) => setField("month", e.target.value as CashFlowMonth)}
                className={
                  inputCls +
                  " appearance-none pr-10 font-medium tracking-wide text-sm focus:ring-2 focus:ring-primary/60 focus:border-primary/40 transition-all"
                }
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m} className="bg-background text-foreground font-medium">
                    {m}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </Field>
          <Field label="Quarter">
            <div className="relative">
              <select
                value={form.quarter}
                onChange={(e) => setField("quarter", e.target.value as CashFlowQuarter)}
                className={
                  inputCls +
                  " appearance-none pr-10 font-medium tracking-wide text-sm focus:ring-2 focus:ring-primary/60 focus:border-primary/40 transition-all"
                }
              >
                {QUARTERS.map((q) => (
                  <option key={q} value={q} className="bg-background text-foreground font-medium">
                    {q}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </Field>
          <Field label="Inflows (USD) *">
            <input type="number" step="0.01" min="0" value={form.inflows}
              onChange={(e) => setField("inflows", parseFloat(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Outflows (USD) *">
            <input type="number" step="0.01" min="0" value={form.outflows}
              onChange={(e) => setField("outflows", parseFloat(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Ending Balance (USD) *">
            <input type="number" step="0.01" value={form.ending_balance}
              onChange={(e) => setField("ending_balance", parseFloat(e.target.value) || 0)} className={inputCls} />
          </Field>

          {/* Live net cash flow preview */}
          <div className="col-span-2">
            <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
              liveNet >= 0
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-rose-500/5 border-rose-500/20"
            }`}>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Cash Flow Preview</span>
              <span className={`text-sm font-bold font-mono tabular-nums ${liveNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {liveNet >= 0 ? "+" : ""}{fmt(liveNet)} {liveNet >= 0 ? "✓" : "⚠"}
              </span>
            </div>
          </div>

          <Field label="Account Codes">
            <input value={form.account_codes ?? ""} onChange={(e) => setField("account_codes", e.target.value || null)}
              placeholder="e.g. 1001, 1002" className={inputCls} />
          </Field>
          <Field label="eTIMS Codes">
            <input value={form.etims_codes ?? ""} onChange={(e) => setField("etims_codes", e.target.value || null)}
              placeholder="e.g. ETIMS-11111" className={inputCls} />
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
            onClick={() => onSave(form)} disabled={loading}
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
  entry: CashFlowEntry; onConfirm: () => void; onClose: () => void; loading: boolean;
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
              Permanently delete the{" "}
              <span className="text-foreground font-medium">{entry.month} {entry.year}</span>{" "}
              cash flow entry
              {" "}(<span className="font-mono text-primary text-xs">{entry.quarter}</span>)?
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
        <span>Open Cash Flow</span>
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
            .from("cash_flow_entries").select("project_id").in("project_id", ids);
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
            Cash{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Flow
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Select a project to view or manage its cash flow records.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Projects",          value: projects.length,                                        sub: "in system"              },
            { label: "Projects with Entries",    value: Object.keys(entryCounts).length,                       sub: "have cash flow records"  },
            { label: "Total Cash Flow Entries",  value: Object.values(entryCounts).reduce((a, b) => a + b, 0), sub: "across all projects"     },
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
                  {projects.length} total projects · {Object.keys(entryCounts).length} with cash flow entries
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
  const [entries,      setEntries]      = useState<CashFlowEntry[]>([]);
  const [fetching,     setFetching]     = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterYear,   setFilterYear]   = useState<number | "All">("All");
  const [filterQ,      setFilterQ]      = useState<CashFlowQuarter | "All">("All");
  const [expanded,     setExpanded]     = useState<Record<string, boolean>>({});
  const [modal,        setModal]        = useState<null | "create" | "edit">(null);
  const [editing,      setEditing]      = useState<CashFlowEntry | null>(null);
  const [deleting,     setDeleting]     = useState<CashFlowEntry | null>(null);
  const [saving,       setSaving]       = useState(false);

  const { toasts, push } = useToast();
  const currency = project.currency?.trim() || "USD";

  const fetchEntries = useCallback(async () => {
    setFetching(true);
    setEntries([]);
    try {
      const data = await api.list(project.id);
      setEntries(data);
      // Default-expand all year groups
      const years = [...new Set(data.map((e) => e.year))];
      setExpanded(Object.fromEntries(years.map((y) => [y, true])));
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to load entries.", "error");
    } finally { setFetching(false); }
  }, [project.id, push]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleCreate = async (form: CFFormData) => {
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

  const handleUpdate = async (form: CFFormData) => {
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

  // ── Derived ──────────────────────────────────────────────────────────────────
  const availableYears = useMemo(() =>
    [...new Set(entries.map((e) => e.year))].sort((a, b) => b - a),
  [entries]);

  const filtered = useMemo(() =>
    entries.filter((e) => {
      if (filterYear !== "All" && e.year    !== filterYear) return false;
      if (filterQ    !== "All" && e.quarter !== filterQ)    return false;
      if (search) {
        const q = search.toLowerCase();
        return e.month.toLowerCase().includes(q) ||
          e.year.toString().includes(q) ||
          (e.account_codes ?? "").toLowerCase().includes(q) ||
          (e.etims_codes   ?? "").toLowerCase().includes(q) ||
          (e.notes         ?? "").toLowerCase().includes(q);
      }
      return true;
    }),
  [entries, filterYear, filterQ, search]);

  // Group by year → quarter
  const grouped = useMemo(() => {
    const byYear: Record<number, Record<CashFlowQuarter, CashFlowEntry[]>> = {};
    filtered.forEach((e) => {
      if (!byYear[e.year]) byYear[e.year] = { Q1: [], Q2: [], Q3: [], Q4: [] };
      byYear[e.year][e.quarter].push(e);
    });
    return byYear;
  }, [filtered]);

  const sortedYears = useMemo(() =>
    Object.keys(grouped).map(Number).sort((a, b) => b - a),
  [grouped]);

  // Grand totals from ALL entries (not filtered)
  const grandTotals = useMemo(() => ({
    inflows:        entries.reduce((s, e) => s + Number(e.inflows),       0),
    outflows:       entries.reduce((s, e) => s + Number(e.outflows),      0),
    net_cash_flow:  entries.reduce((s, e) => s + Number(e.net_cash_flow), 0),
    ending_balance: entries.length > 0 ? Number(entries[0].ending_balance) : 0, // most recent
  }), [entries]);

  const quarterTotals = useMemo(() =>
    Object.fromEntries(
      QUARTERS.map((q) => [q, {
        inflows:       entries.filter((e) => e.quarter === q).reduce((s, e) => s + Number(e.inflows),       0),
        outflows:      entries.filter((e) => e.quarter === q).reduce((s, e) => s + Number(e.outflows),      0),
        net_cash_flow: entries.filter((e) => e.quarter === q).reduce((s, e) => s + Number(e.net_cash_flow), 0),
        count:         entries.filter((e) => e.quarter === q).length,
      }])
    ) as Record<CashFlowQuarter, { inflows: number; outflows: number; net_cash_flow: number; count: number }>,
  [entries]);

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
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">Cash Flow</p>
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

        {/* Stat cards — one per quarter, clickable filter + summary */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {QUARTERS.map((q) => {
            const s        = QUARTER_STYLE[q];
            const isActive = filterQ === q;
            const qt       = quarterTotals[q];
            return (
              <button key={q}
                onClick={() => setFilterQ(isActive ? "All" : q)}
                className={`rounded-2xl border p-4 text-left transition-all duration-200 backdrop-blur-sm bg-white/5 ${
                  isActive ? "border-white/20 ring-1 ring-white/20 scale-[1.02]" : "border-white/10 hover:border-white/20 hover:scale-[1.01]"
                }`}
              >
                <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${s.accent}`}>{q}</div>
                <div className={`text-2xl font-bold tabular-nums ${qt.net_cash_flow >= 0 ? "text-foreground" : "text-rose-400"}`}>
                  {qt.net_cash_flow >= 0 ? "+" : ""}{fmtCompact(qt.net_cash_flow)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{qt.count} {qt.count === 1 ? "entry" : "entries"}</div>
              </button>
            );
          })}
          {/* Grand net card */}
          <div className={`rounded-2xl border p-4 text-left backdrop-blur-sm ${
            grandTotals.net_cash_flow >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"
          }`}>
            <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${grandTotals.net_cash_flow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              Net Total
            </div>
            <div className={`text-2xl font-bold tabular-nums ${grandTotals.net_cash_flow >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {grandTotals.net_cash_flow >= 0 ? "+" : ""}{fmtCompact(grandTotals.net_cash_flow)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{entries.length} total entries</div>
          </div>
        </motion.div>

        {/* Main card */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-3xl font-bold">Cash Flow Entries</CardTitle>
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
                  placeholder="Search by month, account code or notes…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all" />
              </div>
              <div className="relative">
                <select
                  value={filterYear === "All" ? "All" : String(filterYear)}
                  onChange={(e) => setFilterYear(e.target.value === "All" ? "All" : Number(e.target.value))}
                  className={
                    inputCls +
                    " appearance-none pr-10 font-medium tracking-wide text-sm focus:ring-2 focus:ring-primary/60 focus:border-primary/40 transition-all min-w-[7.5rem]"
                  }
                >
                  <option value="All" className="bg-background text-foreground font-medium">All Years</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y} className="bg-background text-foreground font-medium">{y}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </div>
              <div className="relative">
                <select
                  value={filterQ}
                  onChange={(e) => setFilterQ(e.target.value as CashFlowQuarter | "All")}
                  className={
                    inputCls +
                    " appearance-none pr-10 font-medium tracking-wide text-sm focus:ring-2 focus:ring-primary/60 focus:border-primary/40 transition-all min-w-[7.5rem]"
                  }
                >
                  <option value="All" className="bg-background text-foreground font-medium">All Quarters</option>
                  {QUARTERS.map((q) => (
                    <option key={q} value={q} className="bg-background text-foreground font-medium">{q}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </div>
              <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
                {filtered.length} / {entries.length} shown
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
                <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                Loading cash flow…
              </div>
            ) : sortedYears.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 5-5"/>
                </svg>
                <p className="text-sm">No cash flow entries yet for this project.</p>
                {canEdit && (
                  <button onClick={() => setModal("create")} className="text-xs text-primary hover:underline">
                    Add first entry
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {sortedYears.map((year) => {
                  const isYearOpen = expanded[year] ?? true;
                  const yearEntries = Object.values(grouped[year]).flat();
                  const yearInflows  = yearEntries.reduce((s, e) => s + Number(e.inflows),       0);
                  const yearOutflows = yearEntries.reduce((s, e) => s + Number(e.outflows),      0);
                  const yearNet      = yearEntries.reduce((s, e) => s + Number(e.net_cash_flow), 0);

                  return (
                    <div key={year}>
                      {/* Year group header */}
                      <button
                        onClick={() => setExpanded((p) => ({ ...p, [year]: !p[year] }))}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-primary/70" />
                          <span className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{year}</span>
                          <Badge className="text-xs px-2.5 py-0.5 font-mono border rounded-full bg-primary/10 border-primary/20 text-primary">
                            {yearEntries.length}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">
                            In {fmt(yearInflows, currency)} · Out {fmt(yearOutflows, currency)}
                          </span>
                          <span className={`text-sm font-semibold tabular-nums ${yearNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {yearNet >= 0 ? "+" : ""}{fmt(yearNet, currency)}
                          </span>
                          <svg
                            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isYearOpen ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                          >
                            <path d="m6 9 6 6 6-6"/>
                          </svg>
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isYearOpen && (
                          <motion.div key={`year-${year}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            style={{ overflow: "hidden" }}
                          >
                            {/* Quarter sub-groups */}
                            {QUARTERS.filter((q) => grouped[year][q]?.length > 0).map((q) => {
                              const s         = QUARTER_STYLE[q];
                              const qRows     = grouped[year][q];
                              const qInflows  = qRows.reduce((s, e) => s + Number(e.inflows),       0);
                              const qOutflows = qRows.reduce((s, e) => s + Number(e.outflows),      0);
                              const qNet      = qRows.reduce((s, e) => s + Number(e.net_cash_flow), 0);

                              return (
                                <div key={q} className="border-t border-white/5">
                                  {/* Quarter sub-header */}
                                  <div className="flex items-center justify-between px-8 py-2.5" style={{ background: "rgba(255,255,255,0.02)" }}>
                                    <div className="flex items-center gap-2">
                                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                      <span className={`text-[11px] font-bold uppercase tracking-widest ${s.accent}`}>{q}</span>
                                      <Badge className={`text-[10px] px-2 py-0 font-mono border rounded-full ${s.badge}`}>{qRows.length}</Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs tabular-nums">
                                      <span className="text-muted-foreground hidden md:block">
                                        In {fmtCompact(qInflows)} · Out {fmtCompact(qOutflows)}
                                      </span>
                                      <span className={`font-semibold ${qNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                        {qNet >= 0 ? "+" : ""}{fmt(qNet, currency)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Rows table */}
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-y border-white/6" style={{ background: "rgba(255,255,255,0.03)" }}>
                                          {[
                                            "Month", "Inflows", "Outflows", "Net Cash Flow",
                                            "Ending Balance", "Account Codes", "eTIMS Codes", "Notes",
                                            ...(canEdit ? ["Actions"] : [])
                                          ].map((h) => (
                                            <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                                              {h}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {qRows.map((entry, ri) => {
                                          const net = Number(entry.net_cash_flow);
                                          return (
                                            <motion.tr key={entry.id}
                                              initial={{ opacity: 0, x: -6 }}
                                              animate={{ opacity: 1, x: 0 }}
                                              transition={{ delay: ri * 0.02, duration: 0.16 }}
                                              className={`border-b border-white/5 transition-colors ${s.row}`}
                                            >
                                              <td className="px-5 py-3.5 whitespace-nowrap font-medium text-foreground">
                                                {entry.month}
                                              </td>
                                              <td className="px-5 py-3.5 whitespace-nowrap">
                                                <span className="text-sm font-semibold tabular-nums text-emerald-400">
                                                  {fmt(Number(entry.inflows), currency)}
                                                </span>
                                              </td>
                                              <td className="px-5 py-3.5 whitespace-nowrap">
                                                <span className="text-sm font-semibold tabular-nums text-rose-400">
                                                  {fmt(Number(entry.outflows), currency)}
                                                </span>
                                              </td>
                                              <td className="px-5 py-3.5 whitespace-nowrap">
                                                <span className={`text-sm font-bold tabular-nums ${net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                                  {net >= 0 ? "+" : ""}{fmt(net, currency)}
                                                </span>
                                              </td>
                                              <td className="px-5 py-3.5 whitespace-nowrap">
                                                <span className="text-sm tabular-nums text-foreground font-mono">
                                                  {fmt(Number(entry.ending_balance), currency)}
                                                </span>
                                              </td>
                                              <td className="px-5 py-3.5 whitespace-nowrap">
                                                {entry.account_codes
                                                  ? <Badge className="font-mono text-xs px-2 py-0.5 bg-white/5 border border-white/10 text-muted-foreground">{entry.account_codes}</Badge>
                                                  : <span className="text-muted-foreground">—</span>
                                                }
                                              </td>
                                              <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                                                {entry.etims_codes || "—"}
                                              </td>
                                              <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-xs">
                                                <span className="line-clamp-1">{entry.notes || "—"}</span>
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
                                      {/* Quarter subtotal footer */}
                                      <tfoot>
                                        <tr className="border-t border-white/10" style={{ background: "rgba(255,255,255,0.02)" }}>
                                          <td className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            {q} Total
                                          </td>
                                          <td className="px-5 py-2.5 text-sm font-bold tabular-nums text-emerald-400">{fmt(qInflows,  currency)}</td>
                                          <td className="px-5 py-2.5 text-sm font-bold tabular-nums text-rose-400">{fmt(qOutflows, currency)}</td>
                                          <td className={`px-5 py-2.5 text-sm font-bold tabular-nums ${qNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                            {qNet >= 0 ? "+" : ""}{fmt(qNet, currency)}
                                          </td>
                                          <td colSpan={canEdit ? 5 : 4} />
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                {/* Grand summary bar */}
                {entries.length > 0 && (
                  <div className={`px-6 py-4 flex flex-wrap items-center gap-6 text-xs font-mono ${
                    grandTotals.net_cash_flow >= 0 ? "bg-emerald-950/20" : "bg-rose-950/20"
                  }`}>
                    <span className="text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wider">Grand Total</span>
                    <span className="text-emerald-400">Inflows {fmt(grandTotals.inflows, currency)}</span>
                    <span className="text-muted-foreground">−</span>
                    <span className="text-rose-400">Outflows {fmt(grandTotals.outflows, currency)}</span>
                    <span className="text-muted-foreground">=</span>
                    <span className={grandTotals.net_cash_flow >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      Net {grandTotals.net_cash_flow >= 0 ? "+" : ""}{fmt(grandTotals.net_cash_flow, currency)}
                    </span>
                    <Badge className={`ml-auto ${
                      grandTotals.net_cash_flow >= 0
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}>
                      {grandTotals.net_cash_flow >= 0 ? "✓ Positive Cash Flow" : "⚠ Negative Cash Flow"}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            {!fetching && entries.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">{entries.length} total entries · {availableYears.length} year{availableYears.length !== 1 ? "s" : ""}</span>
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

export default function CashFlowPage({ projectId, canEdit = true }: Props) {
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