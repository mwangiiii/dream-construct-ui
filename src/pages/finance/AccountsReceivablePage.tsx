"use client";
import React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { COAAccountSelect } from "@/components/finance/COAAccountSelect";

// ─── MIGRATION (run once in Supabase SQL Editor) ──────────────────────────────
//
// CREATE TABLE IF NOT EXISTS public.accounts_receivable (
//   id                   UUID NOT NULL DEFAULT gen_random_uuid(),
//   project_id           UUID REFERENCES projects(id) ON DELETE SET NULL,
//   client               TEXT NOT NULL,
//   billing_number       TEXT NOT NULL,
//   etims_code           TEXT,
//   purpose              TEXT,
//   date                 DATE NOT NULL,
//   due_date             DATE NOT NULL,
//   amount_billed        NUMERIC(15,2) NOT NULL DEFAULT 0,
//   amount_received      NUMERIC(15,2) NOT NULL DEFAULT 0,
//   balance              NUMERIC(15,2) GENERATED ALWAYS AS (amount_billed - amount_received) STORED,
//   aging_days           INTEGER NOT NULL DEFAULT 0,
//   retaining_percent    NUMERIC(5,2) NOT NULL DEFAULT 0,
//   retaining_amount     NUMERIC(15,2) GENERATED ALWAYS AS (amount_billed * retaining_percent / 100) STORED,
//   status               TEXT NOT NULL DEFAULT 'unpaid'
//                          CHECK (status = ANY (ARRAY[
//                            'unpaid','partial','paid','overdue','disputed','written_off'
//                          ])),
//   account_received     TEXT,
//   date_received        DATE,
//   receipt_reference    TEXT,
//   notes                TEXT,
//   created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   CONSTRAINT accounts_receivable_pkey PRIMARY KEY (id)
// );
//
// -- Make project_id nullable (standalone / firm-wide billings)
// ALTER TABLE public.accounts_receivable ALTER COLUMN project_id DROP NOT NULL;
//
// -- Add receipt_reference if not already present
// ALTER TABLE public.accounts_receivable ADD COLUMN IF NOT EXISTS receipt_reference TEXT;
//
// -- Auto-update updated_at
// CREATE TRIGGER trg_ar_updated_at
//   BEFORE UPDATE ON public.accounts_receivable
//   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
//
// -- RLS
// ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Auth read AR"   ON public.accounts_receivable FOR SELECT USING (auth.role()='authenticated');
// CREATE POLICY "Auth insert AR" ON public.accounts_receivable FOR INSERT WITH CHECK (auth.role()='authenticated');
// CREATE POLICY "Auth update AR" ON public.accounts_receivable FOR UPDATE USING (auth.role()='authenticated');
// CREATE POLICY "Auth delete AR" ON public.accounts_receivable FOR DELETE USING (auth.role()='authenticated');
//
// ─── audit_logs (must already exist) ─────────────────────────────────────────
// create table public.audit_logs (
//   id bigserial not null,
//   table_name text not null,
//   record_id uuid null,
//   action text not null,
//   old_data jsonb null,
//   new_data jsonb null,
//   changed_by uuid null,
//   changed_at timestamptz not null default now(),
//   constraint audit_logs_pkey primary key (id),
//   constraint audit_logs_changed_by_fkey foreign key (changed_by) references auth.users (id),
//   constraint audit_logs_action_check check (
//     action = any (array['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])
//   )
// );
// create index if not exists idx_audit_table      on public.audit_logs using btree (table_name);
// create index if not exists idx_audit_changed_by on public.audit_logs using btree (changed_by);
// create index if not exists idx_audit_changed_at on public.audit_logs using btree (changed_at desc);
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
  client_name: string | null;
}

// Raw shape returned by the projects query (client is an embedded profile)
interface ProjectRow extends Omit<Project, "client_name"> {
  client?: { full_name: string | null; company_name: string | null } | null;
}

// Project invoice (for auto-associating AR billings)
interface ProjectInvoice {
  id: string;
  invoice_number: string;
  client_company_name: string | null;
  total: number;
  invoice_date: string | null;
}

type ARStatus =
  | "unpaid"
  | "partial"
  | "paid"
  | "overdue"
  | "disputed"
  | "written_off";

interface AccountsReceivable {
  id: string;
  project_id: string | null;
  client: string;
  billing_number: string;
  etims_code: string | null;
  purpose: string | null;
  date: string;
  due_date: string;
  amount_billed: number;
  amount_received: number;
  balance: number;
  aging_days: number;
  retaining_percent: number;
  retaining_amount: number;
  status: ARStatus;
  account_received: string | null;
  date_received: string | null;
  receipt_reference: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

type ARFormData = Omit<
  AccountsReceivable,
  "id" | "balance" | "retaining_amount" | "created_at" | "updated_at"
>;

interface Props {
  projectId?: string;
  canEdit?: boolean;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const AR_STATUSES: ARStatus[] = [
  "unpaid", "partial", "paid", "overdue", "disputed", "written_off",
];

const GENERATED_COLS = ["balance", "retaining_amount"] as const;

function stripGenerated(body: Partial<ARFormData>): Partial<ARFormData> {
  const clean = { ...body };
  for (const col of GENERATED_COLS) delete (clean as Record<string, unknown>)[col];
  return clean;
}

const STATUS_STYLE: Record<ARStatus, { badge: string; row: string }> = {
  unpaid:      { badge: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",    row: "hover:bg-yellow-950/20"  },
  partial:     { badge: "bg-sky-500/10 border-sky-500/30 text-sky-300",             row: "hover:bg-sky-950/20"     },
  paid:        { badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", row: "hover:bg-emerald-950/20" },
  overdue:     { badge: "bg-rose-500/10 border-rose-500/30 text-rose-300",          row: "hover:bg-rose-950/20"    },
  disputed:    { badge: "bg-orange-500/10 border-orange-500/30 text-orange-300",    row: "hover:bg-orange-950/20"  },
  written_off: { badge: "bg-slate-500/10 border-slate-500/30 text-slate-300",       row: "hover:bg-slate-950/20"   },
};

const STATUS_LABEL: Record<ARStatus, string> = {
  unpaid: "Unpaid", partial: "Partial", paid: "Paid",
  overdue: "Overdue", disputed: "Disputed", written_off: "Written Off",
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
function deriveAR(f: ARFormData): ARFormData {
  return {
    ...f,
    amount_billed:     Number(f.amount_billed)     || 0,
    amount_received:   Number(f.amount_received)   || 0,
    retaining_percent: Number(f.retaining_percent) || 0,
    aging_days:        Number(f.aging_days)        || 0,
  };
}

const makeEmpty = (projectId: string | null): ARFormData => ({
  project_id:        projectId,
  client:            "",
  billing_number:    "",
  etims_code:        null,
  purpose:           null,
  date:              new Date().toISOString().split("T")[0],
  due_date:          "",
  amount_billed:     0,
  amount_received:   0,
  aging_days:        0,
  retaining_percent: 0,
  status:            "unpaid",
  account_received:  null,
  date_received:     null,
  receipt_reference: null,
  notes:             null,
});

// ─── EDGE FUNCTION API ────────────────────────────────────────────────────────
// ALL mutations go through the Edge Function at /functions/v1/accounts-receivable.
// The Edge Function uses the service_role key to write to audit_logs, which
// guarantees audit records are always persisted regardless of client-side RLS.
// Reads (SELECT) are performed directly from the browser via the Supabase JS client.

// Derive the project URL from the already-initialised supabase client so
// process.env is never referenced at browser runtime.
const SUPABASE_PROJECT_URL: string =
  (supabase as unknown as { supabaseUrl?: string }).supabaseUrl ?? "";
const EDGE_BASE = `${SUPABASE_PROJECT_URL}/functions/v1/accounts-receivable`;

async function edgeRequest(
  method: "POST" | "PATCH" | "DELETE",
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated. Please sign in.");
  const res = await fetch(EDGE_BASE, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

// ─── API ──────────────────────────────────────────────────────────────────────
function throwSb(error: { message?: string } | null, ctx: string): never {
  throw new Error(error?.message ?? `Supabase error during ${ctx}`);
}

const api = {
  // ── Reads: direct Supabase JS (SELECT only, covered by RLS) ────────────────
  async projects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,site_city,site_country,expected_completion_date,created_at,client:profiles!client_id(full_name,company_name)")
      .order("created_at", { ascending: false });
    if (error) throwSb(error, "projects");
    return ((data ?? []) as ProjectRow[]).map(p => ({
      ...p,
      client_name: p.client?.company_name || p.client?.full_name || null,
    }));
  },

  async invoicesByProject(projectId: string): Promise<ProjectInvoice[]> {
    const { data, error } = await supabase
      .from("invoices")
      .select("id,invoice_number,client_company_name,total,invoice_date")
      .eq("project_id", projectId)
      .order("invoice_date", { ascending: false });
    if (error) throwSb(error, "invoicesByProject");
    return (data ?? []) as ProjectInvoice[];
  },

  async list(projectId: string): Promise<AccountsReceivable[]> {
    const { data, error } = await supabase
      .from("accounts_receivable")
      .select("*")
      .eq("project_id", projectId)
      .order("date", { ascending: false });
    if (error) throwSb(error, "list");
    return (data ?? []) as AccountsReceivable[];
  },

  async listAll(): Promise<AccountsReceivable[]> {
    const { data, error } = await supabase
      .from("accounts_receivable")
      .select("*")
      .order("date", { ascending: false });
    if (error) throwSb(error, "listAll");
    return (data ?? []) as AccountsReceivable[];
  },

  // ── Writes: all go through Edge Function → service_role → audit guaranteed ─
  async create(body: ARFormData): Promise<AccountsReceivable> {
    const json = await edgeRequest("POST", { action: "create", payload: body });
    return json.data as AccountsReceivable;
  },

  async update(id: string, body: ARFormData, _oldRow: AccountsReceivable): Promise<AccountsReceivable> {
    // oldRow is fetched server-side in the Edge Function for audit accuracy
    const json = await edgeRequest("PATCH", { action: "update", id, payload: body });
    return json.data as AccountsReceivable;
  },

  async remove(row: AccountsReceivable): Promise<void> {
    // Full row is fetched server-side before deletion for audit old_data
    await edgeRequest("DELETE", { action: "delete", id: row.id });
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
  "w-full px-3 py-2 rounded-xl text-sm border text-foreground focus:outline-none " +
  "focus:ring-1 focus:ring-primary/60 focus:border-primary/40 transition-all " +
  "appearance-none pr-10 font-medium bg-[#111318] border-white/10 [color-scheme:dark]";

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

function IntegerInput({ value, onChange, min = "0", placeholder }: {
  value: number; onChange: (n: number) => void; min?: string; placeholder?: string;
}) {
  const [display, setDisplay] = useState(value === 0 ? "" : String(value));
  useEffect(() => { setDisplay(value === 0 ? "" : String(value)); }, [value]);
  return (
    <input
      type="number" step="1" min={min}
      value={display} placeholder={placeholder ?? "0"}
      className={inputCls}
      onChange={e => {
        setDisplay(e.target.value);
        const p = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
        onChange(isNaN(p) ? 0 : p);
      }}
      onBlur={() => {
        const p = display === "" ? 0 : parseInt(display, 10);
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

// ─── AR MODAL ─────────────────────────────────────────────────────────────────
// showProjectSelector = true  →  global modal: project linking is optional
// showProjectSelector = false →  per-project modal: project_id is fixed, not shown
function ARModal({
  initial, onSave, onClose, loading, projects = [], showProjectSelector = false,
}: {
  initial: ARFormData & { id?: string };
  onSave: (d: ARFormData) => void;
  onClose: () => void;
  loading: boolean;
  projects?: Project[];
  showProjectSelector?: boolean;
}) {
  const [form, setForm] = useState<ARFormData>(deriveAR({ ...initial }));
  const isEdit = Boolean(initial.id);
  const [tab, setTab] = useState<"billing" | "receipt" | "notes">("billing");
  const [invoices, setInvoices] = useState<ProjectInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const set = <K extends keyof ARFormData>(k: K, v: ARFormData[K]) =>
    setForm(p => deriveAR({ ...p, [k]: v }));

  const clientForProject = (projectId: string | null): string | null =>
    projects.find(p => p.id === projectId)?.client_name ?? null;

  // Selecting a project auto-fills the client (only when client field is blank
  // or still matches the previously-linked project's client — never clobbers
  // a manually typed client).
  const handleProjectChange = (projectId: string | null) => {
    setForm(p => {
      const prevClient = clientForProject(p.project_id);
      const nextClient = clientForProject(projectId);
      const keepClient = p.client && p.client !== prevClient ? p.client : (nextClient ?? p.client);
      return deriveAR({ ...p, project_id: projectId, client: keepClient });
    });
  };

  // Load this project's invoices so a billing can be associated to one
  useEffect(() => {
    if (!form.project_id) { setInvoices([]); return; }
    let cancelled = false;
    setInvoicesLoading(true);
    api.invoicesByProject(form.project_id)
      .then(rows => { if (!cancelled) setInvoices(rows); })
      .catch(() => { if (!cancelled) setInvoices([]); })
      .finally(() => { if (!cancelled) setInvoicesLoading(false); });
    return () => { cancelled = true; };
  }, [form.project_id]);

  // Picking an invoice auto-fills billing number, amount billed and client
  const handleInvoiceSelect = (invoiceId: string) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    setForm(p => deriveAR({
      ...p,
      billing_number: inv.invoice_number,
      amount_billed:  Number(inv.total) || p.amount_billed,
      client:         inv.client_company_name || p.client,
    }));
  };

  const balance      = (Number(form.amount_billed) || 0) - (Number(form.amount_received) || 0);
  const retainingAmt = ((Number(form.amount_billed) || 0) * (Number(form.retaining_percent) || 0)) / 100;
  const isStandalone = showProjectSelector && (!form.project_id || form.project_id === "");

  const tabs = [
    { key: "billing"  as const, label: "Billing"  },
    { key: "receipt"  as const, label: "Receipt"  },
    { key: "notes"    as const, label: "Notes"    },
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
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              {isEdit ? "Edit AR Record" : "New AR Record"}
            </h2>
            {isStandalone && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Not linked to any project — this will appear in the firm-wide register.
              </p>
            )}
          </div>
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

          {/* ── TAB: Billing ── */}
          {tab === "billing" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Project selector — only in global modal */}
              {showProjectSelector && (
                <div className="col-span-2">
                  <Field label="Linked Project" hint="Leave blank to post as a firm-wide (standalone) billing">
                    <div className="relative">
                      <select
                        value={form.project_id ?? ""}
                        onChange={e => handleProjectChange(e.target.value || null)}
                        className={selectCls}
                      >
                        <option value="">— No project (firm-wide / standalone) —</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.project_number} — {p.title}
                          </option>
                        ))}
                      </select>
                      <SelectChevron />
                    </div>
                    {isStandalone && (
                      <p className="text-[10px] text-violet-400/70 mt-1">
                        Entry will appear only in the consolidated firm-wide AR register.
                      </p>
                    )}
                  </Field>
                </div>
              )}

              {/* Project invoice picker — auto-associates an existing invoice */}
              {form.project_id && (
                <div className="col-span-2">
                  <Field
                    label="Associate Project Invoice"
                    hint="Auto-fills client, invoice number and amount billed from a project invoice"
                  >
                    <div className="relative">
                      <select
                        value=""
                        onChange={e => e.target.value && handleInvoiceSelect(e.target.value)}
                        disabled={invoicesLoading || invoices.length === 0}
                        className={selectCls + ((invoicesLoading || invoices.length === 0) ? " opacity-50 cursor-not-allowed" : "")}
                      >
                        <option value="">
                          {invoicesLoading
                            ? "Loading invoices…"
                            : invoices.length === 0
                              ? "— No invoices for this project —"
                              : "— Select an invoice to auto-fill —"}
                        </option>
                        {invoices.map(inv => (
                          <option key={inv.id} value={inv.id}>
                            {inv.invoice_number} — {fmtKES(Number(inv.total))}
                            {inv.client_company_name ? ` · ${inv.client_company_name}` : ""}
                          </option>
                        ))}
                      </select>
                      <SelectChevron />
                    </div>
                  </Field>
                </div>
              )}

              <Field label="Client *">
                <input value={form.client}
                  onChange={e => set("client", e.target.value)}
                  placeholder="e.g. Acme Corp." className={inputCls} />
              </Field>
              <Field label="Invoice Number *">
                <input value={form.billing_number}
                  onChange={e => set("billing_number", e.target.value)}
                  placeholder="e.g. BILL-2026-001" className={inputCls} />
              </Field>
              <Field label="eTIMS Code" hint="Kenya Revenue Authority eTIMS reference">
                <input value={form.etims_code ?? ""}
                  onChange={e => set("etims_code", e.target.value || null)}
                  placeholder="e.g. ETIMS-11111" className={inputCls} />
              </Field>
              <Field label="Purpose">
                <input value={form.purpose ?? ""}
                  onChange={e => set("purpose", e.target.value || null)}
                  placeholder="e.g. Project Payment" className={inputCls} />
              </Field>
              <SelectField label="Status *"
                value={form.status}
                onChange={v => set("status", v as ARStatus)}
                options={AR_STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s] }))}
              />
              <Field label="Billing Date *">
                <input type="date" value={form.date}
                  onChange={e => set("date", e.target.value)}
                  className={inputCls + " [color-scheme:dark]"} />
              </Field>
              <Field label="Due Date *">
                <input type="date" value={form.due_date}
                  onChange={e => set("due_date", e.target.value)}
                  className={inputCls + " [color-scheme:dark]"} />
              </Field>
              <Field label="Amount Billed (KES) *">
                <NumericInput value={form.amount_billed}
                  onChange={v => set("amount_billed", v)} placeholder="e.g. 100000" />
              </Field>
              <Field label="Retaining %" hint="Retention held back by client">
                <NumericInput value={form.retaining_percent}
                  onChange={v => set("retaining_percent", v)}
                  placeholder="e.g. 5" max="100" />
              </Field>
              <Field label="Aging (Days)" hint="Days since invoice was issued">
                <IntegerInput value={form.aging_days}
                  onChange={v => set("aging_days", v)} placeholder="e.g. 30" />
              </Field>

              {/* Computed preview */}
              <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                {[
                  { label: "Retaining Amount", value: fmtKES(retainingAmt), color: "text-amber-400" },
                  { label: "Balance Due",       value: fmtKES(balance),      color: balance > 0 ? "text-rose-400" : "text-emerald-400" },
                  { label: "Received",          value: fmtKES(Number(form.amount_received)), color: "text-emerald-400" },
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

          {/* ── TAB: Receipt ── */}
          {tab === "receipt" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Amount Received (KES)">
                <NumericInput value={form.amount_received}
                  onChange={v => set("amount_received", v)} placeholder="e.g. 80000" />
              </Field>
              <Field label="Date Received">
                <input type="date" value={form.date_received ?? ""}
                  onChange={e => set("date_received", e.target.value || null)}
                  className={inputCls + " [color-scheme:dark]"} />
              </Field>
              <Field label="Receipt Reference" hint="Cheque no., EFT ref., M-Pesa code, bank slip, etc.">
                <input
                  value={form.receipt_reference ?? ""}
                  onChange={e => set("receipt_reference", e.target.value || null)}
                  placeholder="e.g. EFT-20260301-00123"
                  className={inputCls}
                />
              </Field>
              <COAAccountSelect
                value={form.account_received ?? null}
                onChange={v => set("account_received", v || null)}
                filter="bank"
                valueField="code"
                label="Account Received"
                hint=""
              />

              {/* Receipt summary */}
              <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total Billed</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-foreground">{fmtKES(Number(form.amount_billed))}</div>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1">Amount Received</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-emerald-400">{fmtKES(Number(form.amount_received))}</div>
                </div>
                <div className={`rounded-xl border px-3 py-2.5 ${balance > 0 ? "border-rose-500/20 bg-rose-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
                  <div className={`text-[10px] uppercase tracking-wider mb-1 ${balance > 0 ? "text-rose-400/70" : "text-emerald-400/70"}`}>Balance</div>
                  <div className={`text-sm font-bold font-mono tabular-nums ${balance > 0 ? "text-rose-400" : "text-emerald-400"}`}>{fmtKES(balance)}</div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Notes ── */}
          {tab === "notes" && (
            <Field label="Notes">
              <textarea value={form.notes ?? ""} rows={6}
                placeholder="Any additional notes about this billing or receipt…"
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
              disabled={loading || !form.client || !form.billing_number || !form.date || !form.due_date}
              className="px-5 py-2 text-sm font-medium rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {isEdit ? "Save Changes" : "Add Billing"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DELETE CONFIRM ───────────────────────────────────────────────────────────
function DeleteConfirm({ row, onConfirm, onClose, loading }: {
  row: AccountsReceivable; onConfirm: () => void; onClose: () => void; loading: boolean;
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
            <h3 className="font-semibold text-foreground mb-1">Delete AR Record</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Permanently delete billing{" "}
              <span className="text-foreground font-medium">{row.billing_number}</span>{" "}
              for <span className="font-mono text-primary text-xs">{row.client}</span>?{" "}
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
function ProjectCard({ project, onSelect, billingCount }: {
  project: Project; onSelect: (p: Project) => void; billingCount: number;
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
        {billingCount > 0 && (
          <span className="text-[10px] text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded-full shrink-0 tabular-nums">
            {billingCount} {billingCount === 1 ? "billing" : "billings"}
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
        <span>Open AR Register</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </div>
    </motion.button>
  );
}

// ─── AR TABLE (shared) ────────────────────────────────────────────────────────
function ARTable({
  rows, filtered, totals, canEdit, fetching,
  search, filterStatus, setSearch, setFilterStatus,
  onEdit, onDelete, onCreate,
  showProjectCol = false,
  projects = [],
  emptyLabel = "No accounts receivable records found.",
}: {
  rows: AccountsReceivable[];
  filtered: AccountsReceivable[];
  totals: { billed: number; received: number; balance: number; retaining: number; overdue: number };
  canEdit: boolean; fetching: boolean;
  search: string; filterStatus: ARStatus | "All";
  setSearch: (v: string) => void;
  setFilterStatus: (v: ARStatus | "All") => void;
  onEdit: (r: AccountsReceivable) => void;
  onDelete: (r: AccountsReceivable) => void;
  onCreate: () => void;
  showProjectCol?: boolean;
  projects?: Project[];
  emptyLabel?: string;
}) {
  const projectLabel = (pid: string | null) => {
    if (!pid) return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-300 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded">
        Standalone
      </span>
    );
    const p = projects.find(pr => pr.id === pid);
    return p
      ? <span className="font-mono text-[11px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">{p.project_number}</span>
      : <span className="italic text-muted-foreground/60 text-xs">Unknown</span>;
  };

  const headers = [
    "Client", "Billing #", "eTIMS Code", "Purpose", "Date", "Due Date",
    "Billed", "Received", "Balance", "Aging", "Retaining", "Ret. Amount",
    "Status", "Date Received", "Receipt Ref", "Account",
    ...(showProjectCol ? ["Scope"] : []),
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
            placeholder="Search client, billing #, eTIMS code, purpose…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all" />
        </div>
        <div className="relative" style={{ minWidth: "9rem" }}>
          <select value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as ARStatus | "All")}
            className={selectCls}>
            <option value="All">All Statuses</option>
            {AR_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
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
                Add first billing
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile card list — no horizontal scroll */}
            <div className="md:hidden divide-y divide-white/8">
              {filtered.map((row) => {
                const ss  = STATUS_STYLE[row.status];
                const bal = Number(row.balance ?? (Number(row.amount_billed) - Number(row.amount_received)));
                const meta = [
                  { label: "Date",         node: fmtDate(row.date) },
                  { label: "Due Date",     node: <span className={row.status === "overdue" ? "text-rose-400 font-semibold" : ""}>{fmtDate(row.due_date)}</span> },
                  { label: "Purpose",      node: row.purpose || "—" },
                  { label: "eTIMS",        node: row.etims_code || "—" },
                  { label: "Aging",        node: row.aging_days > 0 ? `${row.aging_days}d` : "—" },
                  { label: "Retaining",    node: row.retaining_percent > 0 ? `${row.retaining_percent}%` : "—" },
                  { label: "Ret. Amount",  node: Number(row.retaining_amount) > 0 ? fmtKES(Number(row.retaining_amount)) : "—" },
                  { label: "Date Received",node: fmtDate(row.date_received) },
                  { label: "Receipt Ref",  node: row.receipt_reference || "—" },
                  { label: "Account",      node: row.account_received || "—" },
                  ...(showProjectCol ? [{ label: "Scope", node: projectLabel(row.project_id) }] : []),
                ];
                return (
                  <div key={row.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{row.client}</p>
                        <p className="font-mono text-xs text-primary mt-0.5">{row.billing_number}</p>
                      </div>
                      <Badge className={`text-[10px] px-2 py-0.5 border rounded-full font-semibold shrink-0 ${ss.badge}`}>
                        {STATUS_LABEL[row.status]}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { l: "Billed",   v: fmtKES(Number(row.amount_billed)),   c: "text-foreground" },
                        { l: "Received", v: fmtKES(Number(row.amount_received)), c: "text-emerald-400" },
                        { l: "Balance",  v: fmtKES(bal),                         c: bal > 0 ? "text-rose-400" : "text-emerald-400" },
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
                    const bal = Number(row.balance ?? (Number(row.amount_billed) - Number(row.amount_received)));
                    return (
                      <motion.tr key={row.id}
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: ri * 0.02, duration: 0.16 }}
                        className={`border-b border-white/5 transition-colors ${ss.row}`}>
                        <td className="px-4 py-3.5 whitespace-nowrap font-medium text-foreground text-xs">{row.client}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-mono text-xs font-semibold text-primary">{row.billing_number}</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {row.etims_code
                            ? <span className="font-mono text-xs text-muted-foreground">{row.etims_code}</span>
                            : <span className="text-xs text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-[110px]">
                          <span className="line-clamp-1">{row.purpose || "—"}</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground font-mono">{fmtDate(row.date)}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-mono">
                          <span className={row.status === "overdue" ? "text-rose-400 font-semibold" : "text-muted-foreground"}>
                            {fmtDate(row.due_date)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs font-bold text-foreground">
                          {fmtKES(Number(row.amount_billed))}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-emerald-400">
                          {fmtKES(Number(row.amount_received))}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs">
                          <span className={bal > 0 ? "text-rose-400 font-semibold" : "text-emerald-400"}>{fmtKES(bal)}</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-center">
                          {row.aging_days > 0
                            ? <span className={`font-mono font-bold ${row.aging_days > 60 ? "text-rose-400" : row.aging_days > 30 ? "text-amber-400" : "text-muted-foreground"}`}>{row.aging_days}d</span>
                            : <span className="text-emerald-400 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-center text-muted-foreground">
                          {row.retaining_percent > 0 ? `${row.retaining_percent}%` : "—"}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-amber-400">
                          {Number(row.retaining_amount) > 0
                            ? fmtKES(Number(row.retaining_amount))
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Badge className={`text-[10px] px-2 py-0.5 border rounded-full font-semibold ${ss.badge}`}>
                            {STATUS_LABEL[row.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground font-mono">{fmtDate(row.date_received)}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {row.receipt_reference
                            ? <span className="font-mono text-xs text-sky-300">{row.receipt_reference}</span>
                            : <span className="text-xs text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {row.account_received
                            ? <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5">{row.account_received}</Badge>
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
                    <td colSpan={6} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Subtotal ({filtered.length})
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-foreground">
                      {fmtKES(filtered.reduce((a, r) => a + Number(r.amount_billed), 0))}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-emerald-400">
                      {fmtKES(filtered.reduce((a, r) => a + Number(r.amount_received), 0))}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-rose-400">
                      {fmtKES(filtered.reduce((a, r) => a + (Number(r.balance ?? (Number(r.amount_billed) - Number(r.amount_received)))), 0))}
                    </td>
                    <td /><td />
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-amber-400">
                      {fmtKES(filtered.reduce((a, r) => a + (Number(r.retaining_amount) || 0), 0))}
                    </td>
                    <td colSpan={showProjectCol ? (canEdit ? 7 : 6) : (canEdit ? 6 : 5)} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Grand total bar */}
            {rows.length > 0 && (
              <div className="px-6 py-4 flex flex-wrap items-center gap-5 text-xs font-mono bg-primary/5 border-t border-primary/10">
                <span className="text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wider">Grand Total</span>
                <span className="text-foreground">Billed {fmtKES(totals.billed)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-emerald-400">Received {fmtKES(totals.received)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-rose-400">Outstanding {fmtKES(totals.balance)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-amber-400">Retaining {fmtKES(totals.retaining)}</span>
                <Badge className="ml-auto bg-primary/10 border-primary/20 text-primary">
                  {rows.length} billing{rows.length !== 1 ? "s" : ""}
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

// ─── STAT CARDS ───────────────────────────────────────────────────────────────
function StatCards({ totals, rows }: {
  totals: { billed: number; received: number; balance: number; retaining: number; overdue: number };
  rows: AccountsReceivable[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.08 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
    >
      {[
        { label: "Total Billed",   value: fmtKES(totals.billed),    color: "text-foreground",  sub: `${rows.length} billings` },
        { label: "Total Received", value: fmtKES(totals.received),  color: "text-emerald-400", sub: `${rows.filter(r => r.status === "paid").length} settled` },
        { label: "Outstanding",    value: fmtKES(totals.balance),   color: totals.balance > 0 ? "text-rose-400" : "text-emerald-400", sub: "balance due" },
        { label: "Retention Held", value: fmtKES(totals.retaining), color: "text-amber-400",   sub: "across all billings" },
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
function StatusPills({
  rows, filterStatus, setFilterStatus,
}: {
  rows: AccountsReceivable[];
  filterStatus: ARStatus | "All";
  setFilterStatus: (s: ARStatus | "All") => void;
}) {
  const statusCounts = useMemo(() => {
    const c: Partial<Record<ARStatus, number>> = {};
    rows.forEach(r => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  if (!rows.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12 }}
      className="flex flex-wrap gap-2 mb-8">
      {AR_STATUSES.filter(s => statusCounts[s]).map(s => {
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
                {fmtKES(rows.filter(r => r.status === s).reduce((a, r) => a + Number(r.amount_billed), 0))}
              </Badge>
            </div>
          </button>
        );
      })}
    </motion.div>
  );
}

// ─── OVERDUE ALERT ────────────────────────────────────────────────────────────
function OverdueAlert({ rows }: { rows: AccountsReceivable[] }) {
  const overdueRows = rows.filter(r => r.status === "overdue");
  if (!overdueRows.length) return null;
  const overdueBalance = overdueRows.reduce((a, r) => a + (Number(r.balance ?? (Number(r.amount_billed) - Number(r.amount_received)))), 0);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.14 }}
      className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 px-5 py-4 flex flex-wrap items-center gap-4 text-xs font-mono">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
        <span className="text-rose-300 font-semibold font-sans text-[11px] uppercase tracking-wider">Overdue Billings</span>
      </div>
      <span className="text-rose-300">
        {overdueRows.length} billing{overdueRows.length > 1 ? "s" : ""} overdue ·{" "}
        <strong>{fmtKES(overdueBalance)}</strong> outstanding
      </span>
    </motion.div>
  );
}

// ─── CRUD HOOK ────────────────────────────────────────────────────────────────
function useARCrud(push: (msg: string, type?: "success" | "error") => void) {
  const [saving, setSaving] = useState(false);

  const handleCreate = useCallback(async (
    form: ARFormData,
    onSuccess: (row: AccountsReceivable) => void,
    onDone: () => void,
  ) => {
    setSaving(true);
    try {
      const row = await api.create(form);
      onSuccess(row);
      push("Billing added.");
      onDone();
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to add billing.", "error");
    } finally { setSaving(false); }
  }, [push]);

  const handleUpdate = useCallback(async (
    id: string,
    form: ARFormData,
    oldRow: AccountsReceivable,
    onSuccess: (row: AccountsReceivable) => void,
    onDone: () => void,
  ) => {
    setSaving(true);
    try {
      const row = await api.update(id, form, oldRow);
      onSuccess(row);
      push("Billing updated.");
      onDone();
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to update billing.", "error");
    } finally { setSaving(false); }
  }, [push]);

  const handleDelete = useCallback(async (
    row: AccountsReceivable,
    onSuccess: () => void,
    onDone: () => void,
  ) => {
    setSaving(true);
    try {
      await api.remove(row);
      onSuccess();
      push("Billing deleted.");
      onDone();
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to delete billing.", "error");
    } finally { setSaving(false); }
  }, [push]);

  return { saving, handleCreate, handleUpdate, handleDelete };
}

// ─── PER-PROJECT AR VIEW ──────────────────────────────────────────────────────
// Exactly as the original — project is always linked, no project selector in modal
function ProjectARView({ project, canEdit, onBack }: {
  project: Project; canEdit: boolean; onBack: () => void;
}) {
  const [rows,         setRows]         = useState<AccountsReceivable[]>([]);
  const [fetching,     setFetching]     = useState(false);
  const [modal,        setModal]        = useState<null | "create" | "edit">(null);
  const [editing,      setEditing]      = useState<AccountsReceivable | null>(null);
  const [deleting,     setDeleting]     = useState<AccountsReceivable | null>(null);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState<ARStatus | "All">("All");
  const { toasts, push }               = useToast();
  const { saving, handleCreate, handleUpdate, handleDelete } = useARCrud(push);

  const fetchRows = useCallback(async () => {
    setFetching(true);
    setRows([]);
    try { setRows(await api.list(project.id)); }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed to load.", "error"); }
    finally { setFetching(false); }
  }, [project.id, push]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filtered = useMemo(() =>
    rows.filter(r => {
      if (filterStatus !== "All" && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.client.toLowerCase().includes(q) ||
          r.billing_number.toLowerCase().includes(q) ||
          (r.etims_code ?? "").toLowerCase().includes(q) ||
          (r.purpose ?? "").toLowerCase().includes(q);
      }
      return true;
    }),
  [rows, filterStatus, search]);

  const totals = useMemo(() => ({
    billed:   rows.reduce((a, r) => a + Number(r.amount_billed), 0),
    received: rows.reduce((a, r) => a + Number(r.amount_received), 0),
    balance:  rows.reduce((a, r) => a + (Number(r.balance ?? (Number(r.amount_billed) - Number(r.amount_received)))), 0),
    retaining:rows.reduce((a, r) => a + (Number(r.retaining_amount) || 0), 0),
    overdue:  rows.filter(r => r.status === "overdue").length,
  }), [rows]);

  const status    = project.status ?? "planning";
  const statusCls = PROJECT_STATUS_STYLE[status] ?? PROJECT_STATUS_STYLE.planning;

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-background via-background to-primary/5">
      <ToastStack toasts={toasts} />

      <AnimatePresence>
        {modal === "create" && (
          <ARModal
            initial={{ ...makeEmpty(project.id), client: project.client_name ?? "" }}
            onSave={form =>
              handleCreate(
                { ...form, project_id: project.id },
                row => setRows(p => [row, ...p]),
                () => setModal(null),
              )
            }
            onClose={() => setModal(null)}
            loading={saving}
            projects={[project]}
            showProjectSelector={false}
          />
        )}
        {modal === "edit" && editing && (
          <ARModal
            initial={(({ id: _i, balance: _b, retaining_amount: _r, created_at: _c, updated_at: _u, ...rest }) =>
              ({ ...rest, id: editing.id }))(editing)}
            onSave={form =>
              handleUpdate(
                editing.id, form, editing,
                row => setRows(p => p.map(r => r.id === editing.id ? row : r)),
                () => { setModal(null); setEditing(null); },
              )
            }
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
            projects={[project]}
            showProjectSelector={false}
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
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">Accounts Receivable</p>
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
                <CardTitle className="text-3xl font-bold">AR Register</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">All billings linked to this project.</p>
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
                    New Billing
                  </button>
                )}
              </div>
            </div>
          </CardHeader>

          <ARTable
            rows={rows} filtered={filtered} totals={totals}
            canEdit={canEdit} fetching={fetching}
            search={search} filterStatus={filterStatus}
            setSearch={setSearch} setFilterStatus={setFilterStatus}
            onEdit={row => { setEditing(row); setModal("edit"); }}
            onDelete={setDeleting}
            onCreate={() => setModal("create")}
            showProjectCol={false}
          />

          {!fetching && rows.length > 0 && (
            <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
              <span className="tabular-nums">{rows.length} total billing{rows.length !== 1 ? "s" : ""}</span>
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

// ─── GLOBAL AR VIEW ───────────────────────────────────────────────────────────
// Mirrors GlobalBalanceSheetView exactly:
//   - Consolidated tab: all billings (project-linked + standalone)
//   - Standalone tab: only billings with project_id = null
//   - Project selector in modal (optional linking)
//   - "Scope" column in consolidated view
type GlobalARTab = "consolidated" | "standalone";

function GlobalARView({ canEdit, projects }: {
  canEdit: boolean;
  projects: Project[];
}) {
  const [allRows,      setAllRows]      = useState<AccountsReceivable[]>([]);
  const [fetching,     setFetching]     = useState(false);
  const [modal,        setModal]        = useState<null | "create" | "edit">(null);
  const [editing,      setEditing]      = useState<AccountsReceivable | null>(null);
  const [deleting,     setDeleting]     = useState<AccountsReceivable | null>(null);
  const [activeTab,    setActiveTab]    = useState<GlobalARTab>("consolidated");
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState<ARStatus | "All">("All");
  const { toasts, push }               = useToast();
  const { saving, handleCreate, handleUpdate, handleDelete } = useARCrud(push);

  const fetchRows = useCallback(async () => {
    setFetching(true);
    setAllRows([]);
    try { setAllRows(await api.listAll()); }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed to load.", "error"); }
    finally { setFetching(false); }
  }, [push]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const displayRows = useMemo(
    () => activeTab === "standalone" ? allRows.filter(r => r.project_id === null) : allRows,
    [allRows, activeTab]
  );

  const filtered = useMemo(() =>
    displayRows.filter(r => {
      if (filterStatus !== "All" && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.client.toLowerCase().includes(q) ||
          r.billing_number.toLowerCase().includes(q) ||
          (r.etims_code ?? "").toLowerCase().includes(q) ||
          (r.purpose ?? "").toLowerCase().includes(q);
      }
      return true;
    }),
  [displayRows, filterStatus, search]);

  const totals = useMemo(() => ({
    billed:   displayRows.reduce((a, r) => a + Number(r.amount_billed), 0),
    received: displayRows.reduce((a, r) => a + Number(r.amount_received), 0),
    balance:  displayRows.reduce((a, r) => a + (Number(r.balance ?? (Number(r.amount_billed) - Number(r.amount_received)))), 0),
    retaining:displayRows.reduce((a, r) => a + (Number(r.retaining_amount) || 0), 0),
    overdue:  displayRows.filter(r => r.status === "overdue").length,
  }), [displayRows]);

  const standaloneCount   = allRows.filter(r => r.project_id === null).length;
  const consolidatedCount = allRows.length;

  const tabs: { key: GlobalARTab; label: string; count: number; description: string }[] = [
    { key: "consolidated", label: "Consolidated",    count: consolidatedCount, description: "All billings across every project plus standalone firm-wide records" },
    { key: "standalone",   label: "Standalone Only", count: standaloneCount,   description: "Billings not linked to any specific project" },
  ];

  return (
    <div className="container mx-auto px-4 pb-20">
      <ToastStack toasts={toasts} />

      <AnimatePresence>
        {modal === "create" && (
          <ARModal
            initial={makeEmpty(null)}
            onSave={form =>
              handleCreate(
                { ...form, project_id: form.project_id || null },
                row => setAllRows(p => [row, ...p]),
                () => setModal(null),
              )
            }
            onClose={() => setModal(null)}
            loading={saving}
            projects={projects}
            showProjectSelector={true}
          />
        )}
        {modal === "edit" && editing && (
          <ARModal
            initial={(({ id: _i, balance: _b, retaining_amount: _r, created_at: _c, updated_at: _u, ...rest }) =>
              ({ ...rest, id: editing.id }))(editing)}
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
            showProjectSelector={true}
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

      {/* Section heading — same pattern as Global Balance Sheet */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground px-2">Firm Overview</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-2">
          Global{" "}
          <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Accounts Receivable
          </span>
        </h2>
        <p className="text-center text-sm text-muted-foreground max-w-xl mx-auto">
          Consolidated view of all billings across every project and standalone firm-wide records.
          Project linking is optional — leave blank to post a standalone billing.
        </p>
      </motion.div>

      <StatCards totals={totals} rows={displayRows} />
      <StatusPills rows={displayRows} filterStatus={filterStatus} setFilterStatus={setFilterStatus} />
      <OverdueAlert rows={displayRows} />

      <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
        <CardHeader className="pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-3xl font-bold">All Billings</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                The consolidated view is the authoritative firm-wide AR register.
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
                  New Billing
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
            {tabs.map(tab => (
              <button key={tab.key}
                onClick={() => setActiveTab(tab.key)}
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
          <p className="text-xs text-muted-foreground mt-2 mb-1">
            {tabs.find(t => t.key === activeTab)?.description}
          </p>
        </CardHeader>

        <ARTable
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
            activeTab === "standalone"
              ? "No standalone billings yet. Add a billing without linking a project."
              : "No billings posted yet."
          }
        />

        {!fetching && allRows.length > 0 && (
          <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="tabular-nums">{allRows.length} total billings</span>
              {standaloneCount > 0 && <span className="tabular-nums text-violet-400/70">{standaloneCount} standalone</span>}
              <span className="tabular-nums text-primary/70">{allRows.length - standaloneCount} project-linked</span>
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
// Landing page — grid of project cards → click to drill into per-project AR
// Below the grid: GlobalARView (same pattern as balance sheet)
function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects,        setProjects]        = useState<Project[]>([]);
  const [fetching,        setFetching]        = useState(true);
  const [search,          setSearch]          = useState("");
  const [statusFilter,    setStatusFilter]    = useState("all");
  const [billingCounts,   setBillingCounts]   = useState<Record<string, number>>({});
  const [standaloneCount, setStandaloneCount] = useState(0);
  const { toasts, push } = useToast();

  useEffect(() => {
    setFetching(true);
    api.projects()
      .then(async data => {
        setProjects(data);
        if (data.length > 0) {
          const ids = data.map(p => p.id);
          const { data: counts } = await supabase
            .from("accounts_receivable").select("project_id").in("project_id", ids);
          if (counts) {
            const tally: Record<string, number> = {};
            (counts as { project_id: string }[]).forEach(r => {
              tally[r.project_id] = (tally[r.project_id] ?? 0) + 1;
            });
            setBillingCounts(tally);
          }
          const { count } = await supabase
            .from("accounts_receivable")
            .select("id", { count: "exact", head: true })
            .is("project_id", null);
          setStandaloneCount(count ?? 0);
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

  const totalBillings = Object.values(billingCounts).reduce((a, b) => a + b, 0) + standaloneCount;

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
              Receivable
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Select a project to view its AR register, or scroll down for the firm-wide consolidated view.
          </p>
        </motion.div>

        {/* Summary stat cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: "Total Projects",         value: projects.length,                   sub: "in system",           color: "" },
            { label: "Projects with Billings", value: Object.keys(billingCounts).length, sub: "have AR records",     color: "" },
            { label: "Standalone Billings",    value: standaloneCount,                   sub: "not project-linked",  color: "text-violet-400" },
            { label: "Total Billings",         value: totalBillings,                     sub: "across all accounts", color: "" },
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
                  <ProjectCard key={p.id} project={p} onSelect={onSelect} billingCount={billingCounts[p.id] ?? 0} />
                ))}
              </div>
            )}

            {!fetching && projects.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {projects.length} total projects · {Object.keys(billingCounts).length} with AR records
                  {standaloneCount > 0 && ` · ${standaloneCount} standalone billings`}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Global AR section embedded below project picker ── */}
        {!fetching && <GlobalARView canEdit={true} projects={projects} />}
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function AccountsReceivablePage({ projectId, canEdit = true }: Props) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // If a projectId prop is passed (e.g. embedded in a project detail page),
  // skip the picker entirely and go straight to that project's AR view.
  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,site_city,site_country,expected_completion_date,created_at,client:profiles!client_id(full_name,company_name)")
      .eq("id", projectId)
      .single()
      .then(({ data }) => {
        if (data) {
          const row = data as ProjectRow;
          setSelectedProject({
            ...row,
            client_name: row.client?.company_name || row.client?.full_name || null,
          });
        }
      });
  }, [projectId]);

  return (
    <AnimatePresence mode="wait">
      {selectedProject ? (
        <motion.div
          key={selectedProject.id}
          initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}
        >
          <ProjectARView
            project={selectedProject}
            canEdit={canEdit}
            // If projectId was passed as a prop we are embedded — disable back navigation
            onBack={() => { if (!projectId) setSelectedProject(null); }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="picker"
          initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.25 }}
        >
          <ProjectPickerView onSelect={setSelectedProject} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}