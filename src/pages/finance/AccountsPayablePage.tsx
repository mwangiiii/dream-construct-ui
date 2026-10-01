"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { COAAccountSelect } from "@/components/finance/COAAccountSelect";
import { VendorSelect, type Vendor, type PMVendorFill } from "@/components/finance/VendorSelect";

// ─── ACTUAL SCHEMA (already migrated) ────────────────────────────────────────
//
// Key facts about your existing accounts_payable table:
//   id                     UUID (gen_random_uuid())  — NOT bigserial
//   project_id             UUID NOT NULL             — required, NOT nullable
//   etims_code             TEXT NOT NULL             — required, NOT nullable
//   receiving_account_code TEXT NOT NULL             — required, NOT nullable
//   balance                NUMERIC GENERATED ALWAYS AS (total_amount - paid_amount) STORED
//   status check           only: 'open','paid','overdue','partial'
//   NO retaining_amount column                       — computed in UI only
//   updated_at trigger     set_updated_at() already exists
//
// ─────────────────────────────────────────────────────────────────────────────

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
  expected_completion_date: string | null;
  created_at: string;
}

type APStatus = "open" | "partial" | "paid" | "overdue";

interface AccountsPayable {
  id: string;                          // UUID
  project_id: string;                  // NOT NULL — always required
  vendor_id: string | null;            // FK → vendors.id
  // FK → project_financials.id. When set, ties this AP invoice to ONE specific
  // PM commodity (vendor + commodity + amount) rather than a vendor-level
  // rollup. NULL for ad-hoc AP entries with no PM counterpart.
  project_financial_id: number | null;
  vendor_name: string;
  invoice_number: string;
  etims_code: string;                  // NOT NULL
  date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  balance: number;                     // DB GENERATED — never written
  status: APStatus;
  retaining_percent: number;
  date_of_payment: string | null;
  receiving_account_code: string;      // NOT NULL
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

// Fields we send to DB (omit generated column + metadata)
type APFormData = Omit<
  AccountsPayable,
  "id" | "balance" | "created_at" | "updated_at"
>;

interface Props {
  projectId?: string;
  canEdit?: boolean;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const AP_STATUSES: APStatus[] = ["open", "partial", "paid", "overdue"];

// ─── FIX: Explicitly build the payload with only writable DB columns ──────────
// This prevents any generated/computed/client-only fields from being sent,
// which was causing: column "retaining_amount" can only be updated to DEFAULT
function buildDBPayload(form: APFormData): Record<string, unknown> {
  return {
    project_id:             form.project_id,
    vendor_id:              form.vendor_id   || null,
    project_financial_id:   form.project_financial_id ?? null,
    vendor_name:            form.vendor_name,
    invoice_number:         form.invoice_number,
    etims_code:             form.etims_code,
    date:                   form.date,
    due_date:               form.due_date,
    total_amount:           Number(form.total_amount)      || 0,
    paid_amount:            Number(form.paid_amount)       || 0,
    status:                 form.status,
    retaining_percent:      Number(form.retaining_percent) || 0,
    date_of_payment:        form.date_of_payment || null,
    receiving_account_code: form.receiving_account_code,
    notes:                  form.notes || null,
    // DO NOT include: balance (GENERATED ALWAYS), retaining_amount (doesn't exist),
    //                 id, created_at, updated_at (handled by DB trigger)
  };
}

const STATUS_STYLE: Record<APStatus, { badge: string; row: string }> = {
  open:    { badge: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",    row: "hover:bg-yellow-950/20"  },
  partial: { badge: "bg-sky-500/10 border-sky-500/30 text-sky-300",             row: "hover:bg-sky-950/20"     },
  paid:    { badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", row: "hover:bg-emerald-950/20" },
  overdue: { badge: "bg-rose-500/10 border-rose-500/30 text-rose-300",          row: "hover:bg-rose-950/20"    },
};

const STATUS_LABEL: Record<APStatus, string> = {
  open: "Open", partial: "Partial", paid: "Paid", overdue: "Overdue",
};

const PROJECT_STATUS_STYLE: Record<string, string> = {
  planning:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  on_hold:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

// ─── FORMATTERS ───────────────────────────────────────────────────────────────
const fmtKES = (n: number) =>
  `KES ${new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2 }).format(n)}`;

const fmtDate = (d: string | null) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-KE", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "—";

// ─── DERIVED FIELDS ───────────────────────────────────────────────────────────
function deriveAP(f: APFormData): APFormData {
  return {
    ...f,
    total_amount:      Number(f.total_amount)      || 0,
    paid_amount:       Number(f.paid_amount)       || 0,
    retaining_percent: Number(f.retaining_percent) || 0,
  };
}

const makeEmpty = (projectId: string): APFormData => ({
  project_id:             projectId,
  vendor_id:              null,
  project_financial_id:   null,
  vendor_name:            "",
  invoice_number:         "",
  etims_code:             "",
  date:                   new Date().toISOString().split("T")[0],
  due_date:               "",
  total_amount:           0,
  paid_amount:            0,
  status:                 "open",
  retaining_percent:      0,
  date_of_payment:        null,
  receiving_account_code: "",
  notes:                  null,
});

// ─── AUDIT HELPER ─────────────────────────────────────────────────────────────
async function writeAudit(params: {
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert([{
      table_name: params.table_name,
      record_id:  params.record_id,
      action:     params.action,
      old_data:   params.old_data  ?? null,
      new_data:   params.new_data  ?? null,
      changed_by: user?.id         ?? null,
      changed_at: new Date().toISOString(),
    }]);
  } catch {
    /* audit is best-effort */
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────
function throwSb(error: { message?: string } | null, ctx: string): never {
  throw new Error(error?.message ?? `Supabase error during ${ctx}`);
}

const api = {
  async projects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,site_city,site_country,expected_completion_date,created_at")
      .order("created_at", { ascending: false });
    if (error) throwSb(error, "projects");
    return (data ?? []) as Project[];
  },

  async list(projectId: string): Promise<AccountsPayable[]> {
    const { data, error } = await supabase
      .from("accounts_payable")
      .select("*")
      .eq("project_id", projectId)
      .order("date", { ascending: false });
    if (error) throwSb(error, "list");
    return (data ?? []) as AccountsPayable[];
  },

  async listAll(): Promise<AccountsPayable[]> {
    const { data, error } = await supabase
      .from("accounts_payable")
      .select("*")
      .order("date", { ascending: false });
    if (error) throwSb(error, "listAll");
    return (data ?? []) as AccountsPayable[];
  },

  async create(body: APFormData): Promise<AccountsPayable> {
    // FIX: use buildDBPayload to send only writable columns
    const payload = buildDBPayload(body);
    const { data, error } = await supabase
      .from("accounts_payable")
      .insert([payload])
      .select("*")
      .single();
    if (error) throwSb(error, "create");
    const row = data as AccountsPayable;
    await writeAudit({
      table_name: "accounts_payable",
      record_id:  row.id,
      action:     "INSERT",
      old_data:   null,
      new_data:   row as unknown as Record<string, unknown>,
    });
    return row;
  },

  async update(id: string, body: APFormData, oldRow: AccountsPayable): Promise<AccountsPayable> {
    // FIX: use buildDBPayload — do NOT manually set updated_at (trigger handles it),
    //      and do NOT spread body directly (risks sending balance, retaining_amount, etc.)
    const payload = buildDBPayload(body);
    const { data, error } = await supabase
      .from("accounts_payable")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throwSb(error, "update");
    const row = data as AccountsPayable;
    await writeAudit({
      table_name: "accounts_payable",
      record_id:  id,
      action:     "UPDATE",
      old_data:   oldRow as unknown as Record<string, unknown>,
      new_data:   row    as unknown as Record<string, unknown>,
    });
    return row;
  },

  async remove(row: AccountsPayable): Promise<void> {
    const { error } = await supabase
      .from("accounts_payable")
      .delete()
      .eq("id", row.id);
    if (error) throwSb(error, "delete");
    await writeAudit({
      table_name: "accounts_payable",
      record_id:  row.id,
      action:     "DELETE",
      old_data:   row as unknown as Record<string, unknown>,
      new_data:   null,
    });
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
      setToasts(p => [...p, { id, msg, type }]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
    },
    []
  );
  return { toasts, push };
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-foreground " +
  "placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 " +
  "focus:border-primary/40 transition-all";

const selectCls =
  "w-full px-3 py-2.5 rounded-xl text-sm border text-foreground focus:outline-none " +
  "focus:ring-1 focus:ring-primary/60 focus:border-primary/40 transition-all " +
  "appearance-none pr-10 cursor-pointer bg-[hsl(var(--background))] border-white/10 " +
  "[&>option]:bg-[hsl(var(--background))] [&>option]:text-foreground [color-scheme:dark]";

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const SelectChevron = () => (
  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  </span>
);

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground/60 italic">{hint}</span>}
    </div>
  );
}

function SelectField({ label, hint, value, onChange, options, disabled }: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className={selectCls + (disabled ? " opacity-50 cursor-not-allowed" : "")}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <SelectChevron />
      </div>
    </Field>
  );
}

function NumericInput({ value, onChange, step = "0.01", min = "0", max, placeholder, disabled }: {
  value: number; onChange: (n: number) => void;
  step?: string; min?: string; max?: string;
  placeholder?: string; disabled?: boolean;
}) {
  const [display, setDisplay] = useState(value === 0 ? "" : String(value));
  useEffect(() => { setDisplay(value === 0 ? "" : String(value)); }, [value]);
  return (
    <input
      type="number" step={step} min={min} max={max}
      value={display} placeholder={placeholder ?? "0"} disabled={disabled}
      className={inputCls}
      onWheel={e => (e.target as HTMLInputElement).blur()}
      onChange={e => {
        setDisplay(e.target.value);
        const p = e.target.value === "" ? 0 : parseFloat(e.target.value);
        onChange(isNaN(p) ? 0 : p);
      }}
      onBlur={() => {
        const p = display === "" ? 0 : parseFloat(display);
        const safe = isNaN(p) ? 0 : p;
        onChange(safe);
        setDisplay(safe === 0 ? "" : String(safe));
      }}
    />
  );
}

function ToastStack({ toasts }: { toasts: { id: number; msg: string; type: "success" | "error" }[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id}
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${
              t.type === "success"
                ? "bg-emerald-950/80 border-emerald-500/25 text-emerald-300"
                : "bg-rose-950/80 border-rose-500/25 text-rose-300"
            }`}>{t.msg}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── AP MODAL ─────────────────────────────────────────────────────────────────
interface ProjectBudget {
  budget: number;
  committed: number;
  remaining: number;
}

function APModal({
  initial, onSave, onClose, loading, projects = [],
}: {
  initial: APFormData & { id?: string };
  onSave: (d: APFormData) => void;
  onClose: () => void;
  loading: boolean;
  projects?: Project[];
}) {
  const [form, setForm] = useState<APFormData>(deriveAP({ ...initial }));
  const isEdit = Boolean(initial.id);
  const [tab, setTab] = useState<"invoice" | "payment" | "notes">("invoice");
  const [projectBudget, setProjectBudget] = useState<ProjectBudget | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);

  const set = <K extends keyof APFormData>(k: K, v: APFormData[K]) =>
    setForm(p => deriveAP({ ...p, [k]: v }));

  // Fetch budget context whenever project changes
  useEffect(() => {
    if (!form.project_id) { setProjectBudget(null); return; }
    const proj = projects.find(p => p.id === form.project_id);
    if (!proj) return;
    setBudgetLoading(true);
    supabase
      .from("accounts_payable")
      .select("total_amount")
      .eq("project_id", form.project_id)
      .then(({ data }) => {
        const committed = (data ?? []).reduce((s, r) => s + Number(r.total_amount), 0);
        const budget    = Number(proj.budget_numeric) || 0;
        setProjectBudget({ budget, committed, remaining: budget - committed });
        setBudgetLoading(false);
      });
  }, [form.project_id, projects]);

  const handleProjectChange = (projectId: string) => {
    setForm(p => deriveAP({
      ...p,
      project_id: projectId,
    }));
  };

  const handleVendorSelect = (vendor: Vendor | null) => {
    if (!vendor) return;
    setForm(p => deriveAP({
      ...p,
      vendor_id:            vendor.id,
      project_financial_id: null,      // ad-hoc vendor → no PM commodity link
      vendor_name:          vendor.name,
    }));
  };

  // Picking a PM commodity fills the AP invoice from ONE specific
  // project_financials row — vendor + this commodity's total, never a
  // cross-commodity aggregate. project_financial_id is the FK that ties this
  // invoice to that row (and drives the "Vendor → Commodity" label in Job
  // Costing via the AP mirror trigger).
  const handlePMVendorSelect = (fill: PMVendorFill) => {
    setForm(p => deriveAP({
      ...p,
      vendor_id:            null,
      project_financial_id: fill.pmFinancialId,
      vendor_name:          fill.vendorName,
      total_amount:         fill.totalAmount > 0 ? fill.totalAmount : p.total_amount,
      notes:                fill.notes || p.notes,
    }));
  };

  const balance      = (Number(form.total_amount) || 0) - (Number(form.paid_amount) || 0);
  const retainingAmt = ((Number(form.total_amount) || 0) * (Number(form.retaining_percent) || 0)) / 100;

  const tabs = [
    { key: "invoice" as const, label: "Invoice" },
    { key: "payment" as const, label: "Payment" },
    { key: "notes"   as const, label: "Notes"   },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-xl bg-[#0d0d0d]/95"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            {isEdit ? "Edit AP Record" : "New AP Record"}
          </h2>
          <button onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
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

          {/* ── TAB: Invoice ── */}
          {tab === "invoice" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Project selector */}
              <div className="col-span-2">
                <Field label="Project *" hint="All AP records must be linked to a project">
                  <div className="relative">
                    <select
                      value={form.project_id ?? ""}
                      onChange={e => handleProjectChange(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">— Select a project —</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.project_number} — {p.title}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </div>
                </Field>
              </div>

              {/* Project Info — read-only panel, auto-populated from selected project */}
              {form.project_id && (() => {
                const proj = projects.find(p => p.id === form.project_id);
                if (!proj) return null;
                const status = proj.status ?? "planning";
                const statusCls = {
                  planning:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
                  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
                  on_hold:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
                  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
                  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
                }[status] ?? "bg-blue-500/15 text-blue-300 border-blue-500/30";
                return (
                  <div className="col-span-2 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
                    {/* Project header */}
                    <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-primary/10 flex-wrap">
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary">Project Info</span>
                      <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
                        {proj.project_number}
                      </span>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusCls}`}>
                        {status.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs font-medium text-foreground truncate">{proj.title}</span>
                    </div>
                    {/* Details row */}
                    <div className="px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      {proj.site_city && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-muted-foreground/50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                            <circle cx="12" cy="9" r="2.5"/>
                          </svg>
                          {proj.site_city}{proj.site_country ? `, ${proj.site_country}` : ""}
                        </span>
                      )}
                      {proj.expected_completion_date && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-muted-foreground/50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                          </svg>
                          Due {fmtDate(proj.expected_completion_date)}
                        </span>
                      )}
                      {proj.description && (
                        <span className="text-muted-foreground/60 italic line-clamp-1 w-full">{proj.description}</span>
                      )}
                    </div>
                    {/* Budget strip */}
                    {budgetLoading ? (
                      <div className="px-4 pb-3 flex items-center gap-2 text-xs text-muted-foreground/60">
                        <span className="w-3 h-3 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                        Loading budget…
                      </div>
                    ) : projectBudget && (
                      <div className="grid grid-cols-3 gap-px bg-primary/10 border-t border-primary/10">
                        {[
                          { label: "Project Budget",   value: fmtKES(projectBudget.budget),    color: "text-foreground"   },
                          { label: "AP Committed",     value: fmtKES(projectBudget.committed), color: "text-amber-400"    },
                          { label: "Budget Remaining", value: fmtKES(projectBudget.remaining), color: projectBudget.remaining < 0 ? "text-rose-400" : "text-emerald-400" },
                        ].map(c => (
                          <div key={c.label} className="bg-[#0d0d0d]/60 px-3 py-2">
                            <div className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-0.5">{c.label}</div>
                            <div className={`text-xs font-bold font-mono tabular-nums ${c.color}`}>{c.value}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Vendor selector */}
              <div className="col-span-2">
                <VendorSelect
                  value={form.vendor_id ?? null}
                  onChange={v => set("vendor_id", v || null)}
                  onSelect={handleVendorSelect}
                  onPMVendorSelect={handlePMVendorSelect}
                  projectId={form.project_id || null}
                  label="Vendor *"
                  hint={form.project_id ? "Shows project vendors from PM — or pick from master list" : "Select a project first to see PM vendors"}
                  required
                />
              </div>

              {/* Vendor name — auto-filled, read-only */}
              <Field label="Vendor Name" hint="Auto-filled from vendor selection">
                <div className={inputCls + " cursor-not-allowed bg-white/3 text-foreground/80 flex items-center justify-between"}>
                  <span className={form.vendor_name ? "text-foreground" : "text-muted-foreground/50 italic"}>
                    {form.vendor_name || "Auto-fills when vendor is selected"}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-primary/60 shrink-0 ml-2">auto</span>
                </div>
              </Field>
              <Field label="Invoice Number *">
                <input value={form.invoice_number}
                  onChange={e => set("invoice_number", e.target.value)}
                  placeholder="e.g. INV-2026-001" className={inputCls} />
              </Field>
              <Field label="eTIMS Code *" hint="Kenya Revenue Authority eTIMS code">
                <input value={form.etims_code}
                  onChange={e => set("etims_code", e.target.value)}
                  placeholder="e.g. ETIMS-12345" className={inputCls} />
              </Field>
              <SelectField label="Status *"
                value={form.status}
                onChange={v => set("status", v as APStatus)}
                options={AP_STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s] }))}
              />
              <Field label="Invoice Date" hint="Auto-set to today">
                <div className={inputCls + " cursor-not-allowed bg-white/3 text-foreground/80 flex items-center justify-between"}>
                  <span className="font-mono text-sm">{form.date ? fmtDate(form.date) : "—"}</span>
                  <span className="text-[9px] uppercase tracking-wider text-primary/60 shrink-0 ml-2">auto</span>
                </div>
              </Field>
              <Field label="Due Date *">
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => set("due_date", e.target.value)}
                  className={inputCls + " [color-scheme:dark]"}
                />
              </Field>
              <Field label="Total Amount (KES) *">
                <NumericInput value={form.total_amount}
                  onChange={v => set("total_amount", v)} placeholder="e.g. 120000" />
              </Field>
              <Field label="Retaining %" hint="Retention held back from payment">
                <NumericInput value={form.retaining_percent}
                  onChange={v => set("retaining_percent", v)}
                  placeholder="e.g. 10" max="100" />
              </Field>

              {/* Computed preview */}
              <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                {[
                  { label: "Retention Amount (UI)", value: fmtKES(retainingAmt), color: "text-amber-400",   hint: "% of total, not stored"         },
                  { label: "Balance Due",            value: fmtKES(balance),      color: balance > 0 ? "text-rose-400" : "text-emerald-400", hint: "DB generated column" },
                  { label: "Paid Amount",            value: fmtKES(Number(form.paid_amount)), color: "text-emerald-400", hint: "entered in Payment tab" },
                ].map(box => (
                  <div key={box.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{box.label}</div>
                    <div className={`text-sm font-bold font-mono tabular-nums ${box.color}`}>{box.value}</div>
                    <div className="text-[9px] text-muted-foreground/50 mt-0.5">{box.hint}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: Payment ── */}
          {tab === "payment" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Amount Paid (KES)">
                <NumericInput value={form.paid_amount}
                  onChange={v => set("paid_amount", v)} placeholder="e.g. 60000" />
              </Field>
              <Field label="Date of Payment">
                <input type="date" value={form.date_of_payment ?? ""}
                  onChange={e => set("date_of_payment", e.target.value || null)}
                  className={inputCls + " [color-scheme:dark]"} />
              </Field>
              <div className="col-span-2">
                <COAAccountSelect
                  value={form.receiving_account_code}
                  onChange={v => set("receiving_account_code", v)}
                  filter="bank"
                  valueField="code"
                  label="Receiving Account Code *"
                  hint="Select a bank account for this payment"
                  required
                />
              </div>

              {/* Payment summary */}
              <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total Invoice</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-foreground">{fmtKES(Number(form.total_amount))}</div>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1">Amount Paid</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-emerald-400">{fmtKES(Number(form.paid_amount))}</div>
                </div>
                <div className={`rounded-xl border px-3 py-2.5 ${balance > 0 ? "border-rose-500/20 bg-rose-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
                  <div className={`text-[10px] uppercase tracking-wider mb-1 ${balance > 0 ? "text-rose-400/70" : "text-emerald-400/70"}`}>Balance Due</div>
                  <div className={`text-sm font-bold font-mono tabular-nums ${balance > 0 ? "text-rose-400" : "text-emerald-400"}`}>{fmtKES(balance)}</div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Notes ── */}
          {tab === "notes" && (
            <Field label="Notes">
              <textarea value={form.notes ?? ""} rows={6}
                placeholder="Any additional notes about this invoice or payment…"
                onChange={e => set("notes", e.target.value || null)}
                className={inputCls + " resize-none"} />
            </Field>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          <div className="flex gap-1">
            {tabs.map(t => (
              <span key={t.key}
                className={`w-1.5 h-1.5 rounded-full transition-all ${tab === t.key ? "bg-primary" : "bg-white/20"}`} />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
              Cancel
            </button>
            <button
              onClick={() => onSave(form)}
              disabled={
                loading ||
                !form.project_id ||
                !form.vendor_name ||
                !form.invoice_number ||
                !form.etims_code ||
                !form.receiving_account_code ||
                !form.date ||
                !form.due_date
              }
              className="px-5 py-2 text-sm font-medium rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {isEdit ? "Save Changes" : "Add Invoice"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DELETE CONFIRM ───────────────────────────────────────────────────────────
function DeleteConfirm({ row, onConfirm, onClose, loading }: {
  row: AccountsPayable; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-xl bg-[#0d0d0d]/95"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}>
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Delete AP Record</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Permanently delete invoice{" "}
              <span className="text-foreground font-medium">{row.invoice_number}</span>{" "}
              from <span className="font-mono text-primary text-xs">{row.vendor_name}</span>?{" "}
              This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white transition-all disabled:opacity-50 flex items-center gap-2">
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── PROJECT CARD ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onSelect, invoiceCount }: {
  project: Project; onSelect: (p: Project) => void; invoiceCount: number;
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
        {invoiceCount > 0 && (
          <span className="text-[10px] text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded-full shrink-0 tabular-nums">
            {invoiceCount} {invoiceCount === 1 ? "invoice" : "invoices"}
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
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
            {project.site_city}{project.site_country ? `, ${project.site_country}` : ""}
          </span>
        )}
        {project.budget_numeric != null && (
          <span className="flex items-center gap-1 text-emerald-400/80">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            {fmtKES(project.budget_numeric)}
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
        <span>Open AP Register</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </div>
    </motion.button>
  );
}

// ─── STAT CARDS ───────────────────────────────────────────────────────────────
function StatCards({ totals, rows }: {
  totals: { total: number; paid: number; balance: number; retaining: number; overdue: number };
  rows: AccountsPayable[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.08 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
    >
      {[
        { label: "Total Invoiced",  value: fmtKES(totals.total),     color: "text-foreground",  sub: `${rows.length} invoices` },
        { label: "Total Paid",      value: fmtKES(totals.paid),      color: "text-emerald-400", sub: `${rows.filter(r => r.status === "paid").length} settled` },
        { label: "Outstanding",     value: fmtKES(totals.balance),   color: totals.balance > 0 ? "text-rose-400" : "text-emerald-400", sub: "balance due" },
        { label: "Retention Held",  value: fmtKES(totals.retaining), color: "text-amber-400",   sub: "across all invoices" },
      ].map(c => (
        <div key={c.label} className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
          <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">{c.label}</div>
          <div className={`text-lg font-bold tabular-nums font-mono ${c.color}`}>{c.value}</div>
          <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
        </div>
      ))}
    </motion.div>
  );
}

// ─── STATUS PILLS ─────────────────────────────────────────────────────────────
function StatusPills({ rows, filterStatus, setFilterStatus }: {
  rows: AccountsPayable[];
  filterStatus: APStatus | "All";
  setFilterStatus: (s: APStatus | "All") => void;
}) {
  const statusCounts = useMemo(() => {
    const c: Partial<Record<APStatus, number>> = {};
    rows.forEach(r => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  if (!rows.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12 }}
      className="flex flex-wrap gap-2 mb-8">
      {AP_STATUSES.filter(s => statusCounts[s]).map(s => {
        const ss = STATUS_STYLE[s];
        const isActive = filterStatus === s;
        return (
          <button key={s}
            onClick={() => setFilterStatus(isActive ? "All" : s)}
            className={`rounded-2xl border px-4 py-3 text-left transition-all duration-200 backdrop-blur-sm bg-white/5 min-w-[7rem] ${
              isActive ? "border-white/20 ring-1 ring-white/20 scale-[1.02]" : "border-white/10 hover:border-white/20 hover:scale-[1.01]"
            }`}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-widest font-semibold">{STATUS_LABEL[s]}</span>
            </div>
            <div className="text-lg font-bold tabular-nums text-foreground">{statusCounts[s]}</div>
            <div>
              <Badge className={`text-[9px] px-1.5 py-0 border rounded-full mt-1 ${ss.badge}`}>
                {fmtKES(rows.filter(r => r.status === s).reduce((a, r) => a + Number(r.total_amount), 0))}
              </Badge>
            </div>
          </button>
        );
      })}
    </motion.div>
  );
}

// ─── OVERDUE ALERT ────────────────────────────────────────────────────────────
function OverdueAlert({ rows }: { rows: AccountsPayable[] }) {
  const overdueRows = rows.filter(r => r.status === "overdue");
  if (!overdueRows.length) return null;
  const overdueBalance = overdueRows.reduce((a, r) => a + Number(r.balance), 0);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.14 }}
      className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 px-5 py-4 flex flex-wrap items-center gap-4 text-xs font-mono">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
        <span className="text-rose-300 font-semibold font-sans text-[11px] uppercase tracking-wider">Overdue Invoices</span>
      </div>
      <span className="text-rose-300">
        {overdueRows.length} invoice{overdueRows.length > 1 ? "s" : ""} overdue ·{" "}
        <strong>{fmtKES(overdueBalance)}</strong> outstanding
      </span>
    </motion.div>
  );
}

// ─── CRUD HOOK ────────────────────────────────────────────────────────────────
function useAPCrud(push: (msg: string, type?: "success" | "error") => void) {
  const [saving, setSaving] = useState(false);

  const handleCreate = useCallback(async (
    form: APFormData,
    onSuccess: (row: AccountsPayable) => void,
    onDone: () => void,
  ) => {
    setSaving(true);
    try {
      const row = await api.create(form);
      onSuccess(row);
      push("Invoice added.");
      onDone();
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to add invoice.", "error");
    } finally { setSaving(false); }
  }, [push]);

  const handleUpdate = useCallback(async (
    id: string,
    form: APFormData,
    oldRow: AccountsPayable,
    onSuccess: (row: AccountsPayable) => void,
    onDone: () => void,
  ) => {
    setSaving(true);
    try {
      const row = await api.update(id, form, oldRow);
      onSuccess(row);
      push("Invoice updated.");
      onDone();
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to update invoice.", "error");
    } finally { setSaving(false); }
  }, [push]);

  const handleDelete = useCallback(async (
    row: AccountsPayable,
    onSuccess: () => void,
    onDone: () => void,
  ) => {
    setSaving(true);
    try {
      await api.remove(row);
      onSuccess();
      push("Invoice deleted.");
      onDone();
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to delete invoice.", "error");
    } finally { setSaving(false); }
  }, [push]);

  return { saving, handleCreate, handleUpdate, handleDelete };
}

// ─── AP TABLE (shared) ────────────────────────────────────────────────────────
function APTable({
  rows, filtered, totals, canEdit, fetching,
  search, filterStatus, setSearch, setFilterStatus,
  onEdit, onDelete, onCreate,
  showProjectCol = false,
  projects = [],
  emptyLabel = "No accounts payable records found.",
}: {
  rows: AccountsPayable[];
  filtered: AccountsPayable[];
  totals: { total: number; paid: number; balance: number; retaining: number; overdue: number };
  canEdit: boolean; fetching: boolean;
  search: string; filterStatus: APStatus | "All";
  setSearch: (v: string) => void;
  setFilterStatus: (v: APStatus | "All") => void;
  onEdit: (r: AccountsPayable) => void;
  onDelete: (r: AccountsPayable) => void;
  onCreate: () => void;
  showProjectCol?: boolean;
  projects?: Project[];
  emptyLabel?: string;
}) {
  const projectLabel = (pid: string) => {
    const p = projects.find(pr => pr.id === pid);
    return p
      ? <span className="font-mono text-[11px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">{p.project_number}</span>
      : <span className="italic text-muted-foreground/60 text-xs">Unknown</span>;
  };

  const headers = [
    "Vendor", "Invoice #", "eTIMS Code", "Date", "Due Date",
    "Total", "Paid", "Balance", "Retaining", "Ret. Amount",
    "Status", "Payment Date", "Account Code",
    ...(showProjectCol ? ["Project"] : []),
    "Notes",
    ...(canEdit ? ["Actions"] : []),
  ];

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mt-5 px-6 pb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search vendor, invoice number, eTIMS code…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all" />
        </div>
        <div className="relative" style={{ minWidth: "9rem" }}>
          <select value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as APStatus | "All")}
            className={selectCls}>
            <option value="All">All Statuses</option>
            {AP_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <SelectChevron />
        </div>
        <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
          {filtered.length} / {rows.length} shown
        </div>
      </div>

      <CardContent className="p-0">
        {fetching ? (
          <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
            <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
            </svg>
            <p className="text-sm">{emptyLabel}</p>
            {(search || filterStatus !== "All") && (
              <button onClick={() => { setSearch(""); setFilterStatus("All"); }}
                className="text-xs text-primary hover:underline">Clear filters</button>
            )}
            {canEdit && !search && filterStatus === "All" && (
              <button onClick={onCreate} className="text-xs text-primary hover:underline">
                Add first invoice
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile card list — no horizontal scroll */}
            <div className="md:hidden divide-y divide-white/8">
              {filtered.map((row) => {
                const ss  = STATUS_STYLE[row.status];
                const bal = Number(row.balance);
                const retAmt = Number(row.total_amount) * Number(row.retaining_percent) / 100;
                const meta = [
                  { label: "Date",         node: fmtDate(row.date) },
                  { label: "Due Date",     node: <span className={row.status === "overdue" ? "text-rose-400 font-semibold" : ""}>{fmtDate(row.due_date)}</span> },
                  { label: "eTIMS",        node: row.etims_code || "—" },
                  { label: "Account",      node: row.receiving_account_code || "—" },
                  { label: "Retaining",    node: row.retaining_percent > 0 ? `${row.retaining_percent}%` : "—" },
                  { label: "Ret. Amount",  node: retAmt > 0 ? fmtKES(retAmt) : "—" },
                  { label: "Payment Date", node: fmtDate(row.date_of_payment) },
                  ...(showProjectCol ? [{ label: "Project", node: projectLabel(row.project_id) }] : []),
                ];
                return (
                  <div key={row.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{row.vendor_name}</p>
                        <p className="font-mono text-xs text-primary mt-0.5">{row.invoice_number}</p>
                      </div>
                      <Badge className={`text-[10px] px-2 py-0.5 border rounded-full font-semibold shrink-0 ${ss.badge}`}>
                        {STATUS_LABEL[row.status]}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { l: "Total",   v: fmtKES(Number(row.total_amount)), c: "text-foreground" },
                        { l: "Paid",    v: fmtKES(Number(row.paid_amount)),  c: "text-emerald-400" },
                        { l: "Balance", v: fmtKES(bal),                      c: bal > 0 ? "text-rose-400" : "text-emerald-400" },
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
                    {row.notes && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{row.notes}</p>}
                    {canEdit && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/8">
                        <button onClick={() => onEdit(row)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground border border-white/10 hover:bg-white/5 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Edit
                        </button>
                        <button onClick={() => onDelete(row)}
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
                    {headers.map(h => (
                      <th key={h}
                        className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, ri) => {
                    const ss  = STATUS_STYLE[row.status];
                    const bal = Number(row.balance);
                    const retAmt = Number(row.total_amount) * Number(row.retaining_percent) / 100;
                    return (
                      <motion.tr key={row.id}
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: ri * 0.02, duration: 0.16 }}
                        className={`border-b border-white/5 transition-colors ${ss.row}`}>
                        <td className="px-4 py-3.5 whitespace-nowrap font-medium text-foreground text-xs">{row.vendor_name}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-mono text-xs font-semibold text-primary">{row.invoice_number}</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {row.etims_code
                            ? <span className="font-mono text-xs text-muted-foreground">{row.etims_code}</span>
                            : <span className="text-xs text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground font-mono">{fmtDate(row.date)}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-mono">
                          <span className={row.status === "overdue" ? "text-rose-400 font-semibold" : "text-muted-foreground"}>
                            {fmtDate(row.due_date)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs font-bold text-foreground">
                          {fmtKES(Number(row.total_amount))}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-emerald-400">
                          {fmtKES(Number(row.paid_amount))}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs">
                          <span className={bal > 0 ? "text-rose-400 font-semibold" : "text-emerald-400"}>{fmtKES(bal)}</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-center text-muted-foreground">
                          {row.retaining_percent > 0 ? `${row.retaining_percent}%` : "—"}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-amber-400">
                          {retAmt > 0
                            ? fmtKES(retAmt)
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Badge className={`text-[10px] px-2 py-0.5 border rounded-full font-semibold ${ss.badge}`}>
                            {STATUS_LABEL[row.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground font-mono">
                          {fmtDate(row.date_of_payment)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {row.receiving_account_code
                            ? <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5">{row.receiving_account_code}</Badge>
                            : <span className="text-xs text-muted-foreground/40">—</span>}
                        </td>
                        {showProjectCol && (
                          <td className="px-4 py-3.5 whitespace-nowrap">{projectLabel(row.project_id)}</td>
                        )}
                        <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-[140px]">
                          <span className="line-clamp-1">{row.notes || "—"}</span>
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => onEdit(row)} title="Edit"
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button onClick={() => onDelete(row)} title="Delete"
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all">
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
                    <td colSpan={5} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Subtotal ({filtered.length})
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-foreground">
                      {fmtKES(filtered.reduce((a, r) => a + Number(r.total_amount), 0))}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-emerald-400">
                      {fmtKES(filtered.reduce((a, r) => a + Number(r.paid_amount), 0))}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-rose-400">
                      {fmtKES(filtered.reduce((a, r) => a + Number(r.balance), 0))}
                    </td>
                    <td />
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-amber-400">
                      {fmtKES(filtered.reduce((a, r) => a + (Number(r.total_amount) * Number(r.retaining_percent) / 100), 0))}
                    </td>
                    <td colSpan={showProjectCol ? (canEdit ? 5 : 4) : (canEdit ? 4 : 3)} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Grand total bar */}
            {rows.length > 0 && (
              <div className="px-6 py-4 flex flex-wrap items-center gap-5 text-xs font-mono bg-primary/5 border-t border-primary/10">
                <span className="text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wider">Grand Total</span>
                <span className="text-foreground">Invoiced {fmtKES(totals.total)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-emerald-400">Paid {fmtKES(totals.paid)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-rose-400">Outstanding {fmtKES(totals.balance)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-amber-400">Retaining {fmtKES(totals.retaining)}</span>
                <Badge className="ml-auto bg-primary/10 border-primary/20 text-primary">
                  {rows.length} invoice{rows.length !== 1 ? "s" : ""}
                  {totals.overdue > 0 && ` · ${totals.overdue} overdue`}
                </Badge>
              </div>
            )}
          </>
        )}
      </CardContent>
    </>
  );
}

// ─── PER-PROJECT AP VIEW ──────────────────────────────────────────────────────
function ProjectAPView({ project, canEdit, onBack }: {
  project: Project; canEdit: boolean; onBack: () => void;
}) {
  const [rows,         setRows]         = useState<AccountsPayable[]>([]);
  const [fetching,     setFetching]     = useState(false);
  const [modal,        setModal]        = useState<null | "create" | "edit">(null);
  const [editing,      setEditing]      = useState<AccountsPayable | null>(null);
  const [deleting,     setDeleting]     = useState<AccountsPayable | null>(null);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState<APStatus | "All">("All");
  const [projects,     setProjects]     = useState<Project[]>([]);
  const { toasts, push }               = useToast();
  const { saving, handleCreate, handleUpdate, handleDelete } = useAPCrud(push);

  const fetchRows = useCallback(async () => {
    setFetching(true);
    setRows([]);
    try { setRows(await api.list(project.id)); }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed to load.", "error"); }
    finally { setFetching(false); }
  }, [project.id, push]);

  useEffect(() => {
    fetchRows();
    api.projects().then(setProjects).catch(() => {});
  }, [fetchRows]);

  const filtered = useMemo(() =>
    rows.filter(r => {
      if (filterStatus !== "All" && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.vendor_name.toLowerCase().includes(q) ||
          r.invoice_number.toLowerCase().includes(q) ||
          (r.etims_code ?? "").toLowerCase().includes(q) ||
          (r.receiving_account_code ?? "").toLowerCase().includes(q);
      }
      return true;
    }),
  [rows, filterStatus, search]);

  const totals = useMemo(() => ({
    total:    rows.reduce((a, r) => a + Number(r.total_amount), 0),
    paid:     rows.reduce((a, r) => a + Number(r.paid_amount), 0),
    balance:  rows.reduce((a, r) => a + Number(r.balance), 0),
    retaining:rows.reduce((a, r) => a + (Number(r.total_amount) * Number(r.retaining_percent) / 100), 0),
    overdue:  rows.filter(r => r.status === "overdue").length,
  }), [rows]);

  const status    = project.status ?? "planning";
  const statusCls = PROJECT_STATUS_STYLE[status] ?? PROJECT_STATUS_STYLE.planning;

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-background via-background to-primary/5">
      <ToastStack toasts={toasts} />

      <AnimatePresence>
        {modal === "create" && (
          <APModal
            initial={makeEmpty(project.id)}
            onSave={form =>
              handleCreate(
                { ...form, project_id: project.id },
                row => setRows(p => [row, ...p]),
                () => setModal(null),
              )
            }
            onClose={() => setModal(null)}
            loading={saving}
            projects={projects}
          />
        )}
        {modal === "edit" && editing && (
          <APModal
            // FIX: build a clean APFormData from the editing row,
            // explicitly excluding balance, created_at, updated_at
            initial={{
              id:                     editing.id,
              project_id:             editing.project_id,
              vendor_id:              editing.vendor_id ?? null,
              project_financial_id:   editing.project_financial_id ?? null,
              vendor_name:            editing.vendor_name,
              invoice_number:         editing.invoice_number,
              etims_code:             editing.etims_code,
              date:                   editing.date,
              due_date:               editing.due_date,
              total_amount:           editing.total_amount,
              paid_amount:            editing.paid_amount,
              status:                 editing.status,
              retaining_percent:      editing.retaining_percent,
              date_of_payment:        editing.date_of_payment,
              receiving_account_code: editing.receiving_account_code,
              notes:                  editing.notes,
            }}
            onSave={form =>
              handleUpdate(
                editing.id, form, editing,
                row => setRows(p => p.map(r => r.id === editing.id ? row : r)),
                () => { setModal(null); setEditing(null); },
              )
            }
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
            projects={projects}
          />
        )}
        {deleting && (
          <DeleteConfirm
            row={deleting}
            onConfirm={() =>
              handleDelete(
                deleting,
                () => setRows(p => p.filter(r => r.id !== deleting.id)),
                () => setDeleting(null),
              )
            }
            onClose={() => setDeleting(null)}
            loading={saving}
          />
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-16">
        {/* Back button + hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-10">
          <button onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            All Projects
          </button>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">Accounts Payable</p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
                  {project.project_number}
                </span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusCls}`}>
                  {status.replace(/_/g, " ")}
                </span>
              </div>
              <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold leading-tight break-words">
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

        <StatCards totals={totals} rows={rows} />
        <StatusPills rows={rows} filterStatus={filterStatus} setFilterStatus={setFilterStatus} />
        <OverdueAlert rows={rows} />

        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-3xl font-bold">AP Register</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">All invoices linked to this project.</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={fetchRows}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-white/10 rounded-xl hover:bg-white/5 transition-all">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  Refresh
                </button>
                {canEdit && (
                  <button onClick={() => setModal("create")}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg"
                    style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    New Invoice
                  </button>
                )}
              </div>
            </div>
          </CardHeader>

          <APTable
            rows={rows} filtered={filtered} totals={totals}
            canEdit={canEdit} fetching={fetching}
            search={search} filterStatus={filterStatus}
            setSearch={setSearch} setFilterStatus={setFilterStatus}
            onEdit={row => { setEditing(row); setModal("edit"); }}
            onDelete={setDeleting}
            onCreate={() => setModal("create")}
            showProjectCol={false}
            projects={projects}
          />

          {!fetching && rows.length > 0 && (
            <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
              <span className="tabular-nums">{rows.length} total invoice{rows.length !== 1 ? "s" : ""}</span>
              <button onClick={fetchRows} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Refresh
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── GLOBAL AP VIEW ───────────────────────────────────────────────────────────
type GlobalAPTab = "consolidated" | "by_project";

function GlobalAPView({ canEdit, projects }: {
  canEdit: boolean;
  projects: Project[];
}) {
  const [allRows,       setAllRows]      = useState<AccountsPayable[]>([]);
  const [fetching,      setFetching]     = useState(false);
  const [modal,         setModal]        = useState<null | "create" | "edit">(null);
  const [editing,       setEditing]      = useState<AccountsPayable | null>(null);
  const [deleting,      setDeleting]     = useState<AccountsPayable | null>(null);
  const [activeTab,     setActiveTab]    = useState<GlobalAPTab>("consolidated");
  const [projectFilter, setProjectFilter]= useState<string>("all");
  const [search,        setSearch]       = useState("");
  const [filterStatus,  setFilterStatus] = useState<APStatus | "All">("All");
  const { toasts, push }                = useToast();
  const { saving, handleCreate, handleUpdate, handleDelete } = useAPCrud(push);

  const fetchRows = useCallback(async () => {
    setFetching(true);
    setAllRows([]);
    try { setAllRows(await api.listAll()); }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed to load.", "error"); }
    finally { setFetching(false); }
  }, [push]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const displayRows = useMemo(() => {
    if (activeTab === "by_project" && projectFilter !== "all") {
      return allRows.filter(r => r.project_id === projectFilter);
    }
    return allRows;
  }, [allRows, activeTab, projectFilter]);

  const filtered = useMemo(() =>
    displayRows.filter(r => {
      if (filterStatus !== "All" && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.vendor_name.toLowerCase().includes(q) ||
          r.invoice_number.toLowerCase().includes(q) ||
          (r.etims_code ?? "").toLowerCase().includes(q) ||
          (r.receiving_account_code ?? "").toLowerCase().includes(q);
      }
      return true;
    }),
  [displayRows, filterStatus, search]);

  const totals = useMemo(() => ({
    total:    displayRows.reduce((a, r) => a + Number(r.total_amount), 0),
    paid:     displayRows.reduce((a, r) => a + Number(r.paid_amount), 0),
    balance:  displayRows.reduce((a, r) => a + Number(r.balance), 0),
    retaining:displayRows.reduce((a, r) => a + (Number(r.total_amount) * Number(r.retaining_percent) / 100), 0),
    overdue:  displayRows.filter(r => r.status === "overdue").length,
  }), [displayRows]);

  const invoiceCountByProject = useMemo(() => {
    const c: Record<string, number> = {};
    allRows.forEach(r => { c[r.project_id] = (c[r.project_id] ?? 0) + 1; });
    return c;
  }, [allRows]);

  const projectsWithInvoices = useMemo(
    () => projects.filter(p => invoiceCountByProject[p.id] > 0),
    [projects, invoiceCountByProject]
  );

  const tabs: { key: GlobalAPTab; label: string; count: number; description: string }[] = [
    { key: "consolidated", label: "Consolidated",  count: allRows.length,     description: "All invoices across every project in the firm" },
    { key: "by_project",   label: "By Project",    count: projectsWithInvoices.length, description: "Filter invoices by a specific project" },
  ];

  return (
    <div className="container mx-auto px-4 pb-20">
      <ToastStack toasts={toasts} />

      <AnimatePresence>
        {modal === "create" && (
          <APModal
            initial={makeEmpty(projects[0]?.id ?? "")}
            onSave={form =>
              handleCreate(
                form,
                row => setAllRows(p => [row, ...p]),
                () => setModal(null),
              )
            }
            onClose={() => setModal(null)}
            loading={saving}
            projects={projects}
          />
        )}
        {modal === "edit" && editing && (
          <APModal
            // FIX: build a clean APFormData from the editing row,
            // explicitly excluding balance, created_at, updated_at
            initial={{
              id:                     editing.id,
              project_id:             editing.project_id,
              vendor_id:              editing.vendor_id ?? null,
              project_financial_id:   editing.project_financial_id ?? null,
              vendor_name:            editing.vendor_name,
              invoice_number:         editing.invoice_number,
              etims_code:             editing.etims_code,
              date:                   editing.date,
              due_date:               editing.due_date,
              total_amount:           editing.total_amount,
              paid_amount:            editing.paid_amount,
              status:                 editing.status,
              retaining_percent:      editing.retaining_percent,
              date_of_payment:        editing.date_of_payment,
              receiving_account_code: editing.receiving_account_code,
              notes:                  editing.notes,
            }}
            onSave={form =>
              handleUpdate(
                editing.id, form, editing,
                row => setAllRows(p => p.map(r => r.id === editing.id ? row : r)),
                () => { setModal(null); setEditing(null); },
              )
            }
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
            projects={projects}
          />
        )}
        {deleting && (
          <DeleteConfirm
            row={deleting}
            onConfirm={() =>
              handleDelete(
                deleting,
                () => setAllRows(p => p.filter(r => r.id !== deleting.id)),
                () => setDeleting(null),
              )
            }
            onClose={() => setDeleting(null)}
            loading={saving}
          />
        )}
      </AnimatePresence>

      {/* Section heading */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground px-2">Firm Overview</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-2">
          Global{" "}
          <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Accounts Payable
          </span>
        </h2>
        <p className="text-center text-sm text-muted-foreground max-w-xl mx-auto">
          Consolidated view of all vendor invoices across every project.
          Switch to "By Project" to drill into a specific project's payables.
        </p>
      </motion.div>

      <StatCards totals={totals} rows={displayRows} />
      <StatusPills rows={displayRows} filterStatus={filterStatus} setFilterStatus={setFilterStatus} />
      <OverdueAlert rows={displayRows} />

      <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
        <CardHeader className="pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-3xl font-bold">All Invoices</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                The consolidated view is the authoritative firm-wide AP register.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={fetchRows}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-white/10 rounded-xl hover:bg-white/5 transition-all">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Refresh
              </button>
              {canEdit && (
                <button onClick={() => setModal("create")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg shrink-0"
                  style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  New Invoice
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
            {tabs.map(tab => (
              <button key={tab.key}
                onClick={() => { setActiveTab(tab.key); setProjectFilter("all"); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium tracking-normal transition-all ${
                  activeTab === tab.key
                    ? "bg-white/10 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                {tab.label}
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full tabular-nums ${
                  activeTab === tab.key ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {activeTab === "by_project" && (
            <div className="mt-3 flex items-center gap-3">
              <div className="relative w-72">
                <select
                  value={projectFilter}
                  onChange={e => setProjectFilter(e.target.value)}
                  className={selectCls}
                >
                  <option value="all">— All Projects —</option>
                  {projectsWithInvoices.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.project_number} — {p.title} ({invoiceCountByProject[p.id] ?? 0})
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>
              {projectFilter !== "all" && (
                <button
                  onClick={() => setProjectFilter("all")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Clear
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-2 mb-1">
            {tabs.find(t => t.key === activeTab)?.description}
          </p>
        </CardHeader>

        <APTable
          rows={displayRows}
          filtered={filtered}
          totals={totals}
          canEdit={canEdit}
          fetching={fetching}
          search={search}
          filterStatus={filterStatus}
          setSearch={setSearch}
          setFilterStatus={setFilterStatus}
          onEdit={row => { setEditing(row); setModal("edit"); }}
          onDelete={setDeleting}
          onCreate={() => setModal("create")}
          showProjectCol={activeTab === "consolidated"}
          projects={projects}
          emptyLabel={
            activeTab === "by_project" && projectFilter !== "all"
              ? "No invoices found for this project."
              : "No invoices posted yet."
          }
        />

        {!fetching && allRows.length > 0 && (
          <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="tabular-nums">{allRows.length} total invoices</span>
              <span className="tabular-nums text-primary/70">
                {projectsWithInvoices.length} project{projectsWithInvoices.length !== 1 ? "s" : ""} with invoices
              </span>
            </div>
            <button onClick={fetchRows} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── PROJECT PICKER VIEW ──────────────────────────────────────────────────────
function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects,      setProjects]      = useState<Project[]>([]);
  const [fetching,      setFetching]      = useState(true);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [invoiceCounts, setInvoiceCounts] = useState<Record<string, number>>({});
  const { toasts, push } = useToast();

  useEffect(() => {
    setFetching(true);
    api.projects()
      .then(async data => {
        setProjects(data);
        if (data.length > 0) {
          const ids = data.map(p => p.id);
          const { data: counts } = await supabase
            .from("accounts_payable").select("project_id").in("project_id", ids);
          if (counts) {
            const tally: Record<string, number> = {};
            (counts as { project_id: string }[]).forEach(r => {
              tally[r.project_id] = (tally[r.project_id] ?? 0) + 1;
            });
            setInvoiceCounts(tally);
          }
        }
      })
      .catch((err: unknown) => push(err instanceof Error ? err.message : "Failed to load projects.", "error"))
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

  const totalInvoices        = Object.values(invoiceCounts).reduce((a, b) => a + b, 0);
  const projectsWithInvoices = Object.keys(invoiceCounts).length;

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-background via-background to-primary/5">
      <ToastStack toasts={toasts} />

      <div className="container mx-auto px-4 py-16">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="mb-12 text-center"
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">Finance Module</p>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-4 leading-tight">
            Accounts{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Payable
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Select a project to view its AP register, or scroll down for the firm-wide consolidated view.
          </p>
        </motion.div>

        {/* Summary stat cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: "Total Projects",          value: projects.length,       sub: "in system",           color: "" },
            { label: "Projects with Invoices",  value: projectsWithInvoices,  sub: "have AP records",     color: "" },
            { label: "Total Invoices",          value: totalInvoices,         sub: "across all projects", color: "" },
            { label: "Projects without AP",     value: projects.length - projectsWithInvoices, sub: "no invoices yet", color: "text-muted-foreground" },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{card.label}</div>
              <div className={`text-3xl font-bold tabular-nums ${card.color || "text-foreground"}`}>{card.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{card.sub}</div>
            </div>
          ))}
        </motion.div>

        {/* Projects card */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-16">
          <CardHeader className="pb-4">
            <CardTitle className="text-3xl font-bold">Projects</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, number or city…"
                  className={inputCls + " pl-9"}
                />
              </div>
              <div className="relative w-full sm:w-52">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className={selectCls}
                >
                  {statuses.map(s => (
                    <option key={s} value={s}>
                      {s === "all" ? "All Statuses" : s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>
              <div className="inline-flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/10 rounded-xl bg-white/5 whitespace-nowrap tabular-nums">
                {filtered.length} / {projects.length} shown
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-24 gap-3 text-sm text-muted-foreground">
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
                {filtered.map(p => (
                  <ProjectCard key={p.id} project={p} onSelect={onSelect} invoiceCount={invoiceCounts[p.id] ?? 0} />
                ))}
              </div>
            )}

            {!fetching && projects.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {projects.length} total projects · {projectsWithInvoices} with AP records
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Global AP section embedded below project picker ── */}
        {!fetching && <GlobalAPView canEdit={true} projects={projects} />}
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function AccountsPayablePage({ projectId, canEdit = true }: Props) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,site_city,site_country,expected_completion_date,created_at")
      .eq("id", projectId)
      .single()
      .then(({ data }) => { if (data) setSelectedProject(data as Project); });
  }, [projectId]);

  return (
    <AnimatePresence mode="wait">
      {selectedProject ? (
        <motion.div
          key={selectedProject.id}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
        >
          <ProjectAPView
            project={selectedProject}
            canEdit={canEdit}
            onBack={() => { if (!projectId) setSelectedProject(null); }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="picker"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
        >
          <ProjectPickerView onSelect={setSelectedProject} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}