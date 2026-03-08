"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";

// ─── ACTUAL SCHEMA (already migrated) ────────────────────────────────────────
//
// Key facts about your existing accounts_payable table:
//   id                     UUID (gen_random_uuid())  — NOT bigserial
//   project_id             UUID NOT NULL             — required, NOT nullable
//   etims_code             TEXT NOT NULL             — required, NOT nullable
//   receiving_account_code TEXT NOT NULL             — required, NOT nullable
//   balance                NUMERIC GENERATED ALWAYS AS (total_amount - paid_amount) STORED
//   status check           only: 'open','paid','overdue','partial'  — no 'disputed' or 'cancelled'
//   NO retaining_amount column                       — computed in UI only
//   updated_at trigger     set_updated_at() already exists
//
// ─────────────────────────────────────────────────────────────────────────────

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Project {
  id: string;
  project_number: string;
  title: string;
  status: string | null;
}

type APStatus =
  | "open"
  | "partial"
  | "paid"
  | "overdue";

interface AccountsPayable {
  id: string;                      // UUID
  project_id: string;              // NOT NULL — always required
  vendor_name: string;
  invoice_number: string;
  etims_code: string;              // NOT NULL
  date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  balance: number;                 // DB GENERATED — never written
  status: APStatus;
  retaining_percent: number;
  date_of_payment: string | null;
  receiving_account_code: string;  // NOT NULL
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

// Column never sent to DB (server-computed)
const GENERATED_COLS = ["balance"] as const;

function stripGenerated(body: Partial<APFormData>): Partial<APFormData> {
  const clean = { ...body };
  delete (clean as any)["balance"];
  return clean;
}

const STATUS_STYLE: Record<APStatus, { badge: string; row: string }> = {
  open:    { badge: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",   row: "hover:bg-yellow-950/20"  },
  partial: { badge: "bg-sky-500/10 border-sky-500/30 text-sky-300",             row: "hover:bg-sky-950/20"     },
  paid:    { badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", row: "hover:bg-emerald-950/20" },
  overdue: { badge: "bg-rose-500/10 border-rose-500/30 text-rose-300",          row: "hover:bg-rose-950/20"    },
};

const STATUS_LABEL: Record<APStatus, string> = {
  open: "Open", partial: "Partial", paid: "Paid", overdue: "Overdue",
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

// ─── DERIVED FIELDS (UI preview — mirrors DB generated columns) ───────────────
function deriveAP(f: APFormData): APFormData {
  const total     = Number(f.total_amount)     || 0;
  const paid      = Number(f.paid_amount)      || 0;
  const retPct    = Number(f.retaining_percent)|| 0;
  return {
    ...f,
    total_amount:      total,
    paid_amount:       paid,
    retaining_percent: retPct,
  };
}

const makeEmpty = (projectId: string): APFormData => ({
  project_id:             projectId,
  vendor_name:            "",
  invoice_number:         "",
  etims_code:             "",              // NOT NULL in DB
  date:                   new Date().toISOString().split("T")[0],
  due_date:               "",
  total_amount:           0,
  paid_amount:            0,
  status:                 "open",
  retaining_percent:      0,
  date_of_payment:        null,
  receiving_account_code: "",             // NOT NULL in DB
  notes:                  null,
});

// ─── API ──────────────────────────────────────────────────────────────────────
function throwSb(error: { message?: string } | null, ctx: string): never {
  throw new Error(error?.message ?? `Supabase error during ${ctx}`);
}

const api = {
  async projects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("id,project_number,title,status")
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
    const clean = stripGenerated(body);
    const { data, error } = await supabase
      .from("accounts_payable")
      .insert([clean])
      .select("*")
      .single();
    if (error) throwSb(error, "create");
    return data as AccountsPayable;
  },
  async update(id: number, body: APFormData): Promise<AccountsPayable> {
    const clean = stripGenerated(body);
    const { data, error } = await supabase
      .from("accounts_payable")
      .update({ ...clean, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throwSb(error, "update");
    return data as AccountsPayable;
  },
  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from("accounts_payable")
      .delete()
      .eq("id", id);
    if (error) throwSb(error, "delete");
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

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-foreground " +
  "placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 " +
  "focus:border-primary/40 transition-all";

const selectCls =
  "w-full px-3 py-2 rounded-xl text-sm border text-foreground focus:outline-none " +
  "focus:ring-1 focus:ring-primary/60 focus:border-primary/40 transition-all " +
  "appearance-none pr-10 font-medium bg-[#111318] border-white/10 [color-scheme:dark]";

const SelectChevron = () => (
  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  </span>
);

function Field({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      {children}
      {hint && (
        <span className="text-[10px] text-muted-foreground/60 italic">{hint}</span>
      )}
    </div>
  );
}

function SelectField({
  label, hint, value, onChange, options, disabled,
}: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void; options: { value: string; label: string }[];
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
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <SelectChevron />
      </div>
    </Field>
  );
}

// ─── NUMERIC INPUT — no sticky-zero bug ───────────────────────────────────────
function NumericInput({
  value, onChange, step = "0.01", min = "0", max, placeholder, disabled,
}: {
  value: number; onChange: (n: number) => void;
  step?: string; min?: string; max?: string;
  placeholder?: string; disabled?: boolean;
}) {
  const [display, setDisplay] = useState(value === 0 ? "" : String(value));

  useEffect(() => {
    setDisplay(value === 0 ? "" : String(value));
  }, [value]);

  return (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      value={display}
      placeholder={placeholder ?? "0"}
      disabled={disabled}
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

// ─── AP MODAL ─────────────────────────────────────────────────────────────────
function APModal({
  initial, onSave, onClose, loading, projects,
}: {
  initial: APFormData & { id?: number };
  onSave: (d: APFormData) => void;
  onClose: () => void;
  loading: boolean;
  projects?: Project[];
}) {
  const [form, setForm] = useState<APFormData>(deriveAP({ ...initial }));
  const isEdit = Boolean(initial.id);
  const [tab, setTab] = useState<"invoice" | "payment" | "notes">("invoice");

  const set = <K extends keyof APFormData>(k: K, v: APFormData[K]) =>
    setForm(p => deriveAP({ ...p, [k]: v }));

  // Live-computed previews
  const balance        = (Number(form.total_amount) || 0) - (Number(form.paid_amount) || 0);
  const retainingAmt   = ((Number(form.total_amount) || 0) * (Number(form.retaining_percent) || 0)) / 100;

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
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-white/10 pb-0">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest rounded-t-lg transition-all ${
                tab === t.key
                  ? "bg-white/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 max-h-[58vh] overflow-y-auto">

          {/* ── TAB: Invoice ── */}
          {tab === "invoice" && (
            <div className="grid grid-cols-2 gap-4">
              {projects && (
                <div className="col-span-2">
                  <Field label="Project *" hint="All AP records must be linked to a project">
                    <div className="relative">
                      <select
                        value={form.project_id ?? ""}
                        onChange={e => set("project_id", e.target.value)}
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
              )}

              <Field label="Vendor Name *">
                <input
                  value={form.vendor_name}
                  onChange={e => set("vendor_name", e.target.value)}
                  placeholder="e.g. ABC Supplies Ltd."
                  className={inputCls}
                />
              </Field>
              <Field label="Invoice Number *">
                <input
                  value={form.invoice_number}
                  onChange={e => set("invoice_number", e.target.value)}
                  placeholder="e.g. INV-2026-001"
                  className={inputCls}
                />
              </Field>
              <Field label="eTIMS Code *" hint="Kenya Revenue Authority eTIMS code">
                <input
                  value={form.etims_code}
                  onChange={e => set("etims_code", e.target.value)}
                  placeholder="e.g. ETIMS-12345"
                  className={inputCls}
                />
              </Field>
              <SelectField
                label="Status *"
                value={form.status}
                onChange={v => set("status", v as APStatus)}
                options={AP_STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s] }))}
              />
              <Field label="Invoice Date *">
                <input
                  type="date"
                  value={form.date}
                  onChange={e => set("date", e.target.value)}
                  className={inputCls + " [color-scheme:dark]"}
                />
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
                <NumericInput
                  value={form.total_amount}
                  onChange={v => set("total_amount", v)}
                  placeholder="e.g. 120000"
                />
              </Field>
              <Field label="Retaining % (if applicable)" hint="Retention held back from payment">
                <NumericInput
                  value={form.retaining_percent}
                  onChange={v => set("retaining_percent", v)}
                  placeholder="e.g. 10"
                  max="100"
                />
              </Field>

              {/* Computed preview */}
              <div className="col-span-2 grid grid-cols-3 gap-3 mt-1">
                {[
                  { label: "Retention Amount (UI)", value: fmtKES(retainingAmt), color: "text-amber-400",   hint: "% of total, not stored"         },
                  { label: "Balance Due",            value: fmtKES(balance),      color: balance > 0 ? "text-rose-400" : "text-emerald-400", hint: "DB generated column" },
                  { label: "Paid Amount",            value: fmtKES(Number(form.paid_amount)), color: "text-emerald-400", hint: "entered above" },
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
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount Paid (KES)">
                <NumericInput
                  value={form.paid_amount}
                  onChange={v => set("paid_amount", v)}
                  placeholder="e.g. 60000"
                />
              </Field>
              <Field label="Date of Payment">
                <input
                  type="date"
                  value={form.date_of_payment ?? ""}
                  onChange={e => set("date_of_payment", e.target.value || null)}
                  className={inputCls + " [color-scheme:dark]"}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Receiving Account Code *" hint="Chart of accounts code for this payment">
                  <input
                    value={form.receiving_account_code}
                    onChange={e => set("receiving_account_code", e.target.value)}
                    placeholder="e.g. 1001"
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Payment summary cards */}
              <div className="col-span-2 grid grid-cols-3 gap-3 mt-2">
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
            <div className="grid grid-cols-1 gap-4">
              <Field label="Notes">
                <textarea
                  value={form.notes ?? ""}
                  rows={6}
                  placeholder="Any additional notes about this invoice or payment…"
                  onChange={e => set("notes", e.target.value || null)}
                  className={inputCls + " resize-none"}
                />
              </Field>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          <div className="flex gap-1">
            {tabs.map(t => (
              <span
                key={t.key}
                className={`w-1.5 h-1.5 rounded-full transition-all ${tab === t.key ? "bg-primary" : "bg-white/20"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5"
            >
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
              {loading && (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {isEdit ? "Save Changes" : "Add Invoice"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DELETE CONFIRM ───────────────────────────────────────────────────────────
function DeleteConfirm({
  row, onConfirm, onClose, loading,
}: {
  row: AccountsPayable; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-xl bg-[#0d0d0d]/95"
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
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── AP TABLE ─────────────────────────────────────────────────────────────────
function APTable({
  rows, filtered, totals, canEdit, fetching,
  search, filterStatus, setSearch, setFilterStatus,
  onEdit, onDelete, onCreate,
  emptyLabel = "No accounts payable records found.",
}: {
  rows: AccountsPayable[];
  filtered: AccountsPayable[];
  totals: { total: number; paid: number; balance: number; retaining: number; overdue: number };
  canEdit: boolean;
  fetching: boolean;
  search: string;
  filterStatus: APStatus | "All";
  setSearch: (v: string) => void;
  setFilterStatus: (v: APStatus | "All") => void;
  onEdit: (r: AccountsPayable) => void;
  onDelete: (r: AccountsPayable) => void;
  onCreate: () => void;
  emptyLabel?: string;
}) {
  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mt-5 px-6 pb-4">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendor, invoice number, eTIMS code…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all"
          />
        </div>

        <div className="relative" style={{ minWidth: "9rem" }}>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as APStatus | "All")}
            className={selectCls}
          >
            <option value="All">All Statuses</option>
            {AP_STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
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
              <button
                onClick={() => { setSearch(""); setFilterStatus("All"); }}
                className="text-xs text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
            {canEdit && !search && filterStatus === "All" && (
              <button onClick={onCreate} className="text-xs text-primary hover:underline">
                Add first invoice
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-white/6" style={{ background: "rgba(255,255,255,0.03)" }}>
                    {[
                      "Vendor","Invoice #","eTIMS Code","Date","Due Date",
                      "Total","Paid","Balance","Retaining","Ret. Amount",
                      "Status","Payment Date","Account Code","Notes",
                      ...(canEdit ? ["Actions"] : []),
                    ].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, ri) => {
                    const ss = STATUS_STYLE[row.status];
                    const balance = Number(row.balance);
                    return (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: ri * 0.02, duration: 0.16 }}
                        className={`border-b border-white/5 transition-colors ${ss.row}`}
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap font-medium text-foreground text-xs">
                          {row.vendor_name}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-mono text-xs font-semibold text-primary">
                            {row.invoice_number}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {row.etims_code ? (
                            <span className="font-mono text-xs text-muted-foreground">{row.etims_code}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground font-mono">
                          {fmtDate(row.date)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-mono">
                          <span className={
                            row.status === "overdue" ? "text-rose-400 font-semibold" : "text-muted-foreground"
                          }>
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
                          <span className={balance > 0 ? "text-rose-400 font-semibold" : "text-emerald-400"}>
                            {fmtKES(balance)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-center text-muted-foreground">
                          {row.retaining_percent > 0 ? `${row.retaining_percent}%` : "—"}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-amber-400">
                          {Number(row.retaining_percent) > 0
                            ? fmtKES(Number(row.total_amount) * Number(row.retaining_percent) / 100)
                            : <span className="text-muted-foreground/40">—</span>
                          }
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
                          {row.receiving_account_code ? (
                            <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5">
                              {row.receiving_account_code}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-[140px]">
                          <span className="line-clamp-1">{row.notes || "—"}</span>
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => onEdit(row)}
                                title="Edit"
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => onDelete(row)}
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
                    <td colSpan={canEdit ? 5 : 4} />
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

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AccountsPayablePage({ projectId, canEdit = true }: Props) {
  const [rows, setRows]                 = useState<AccountsPayable[]>([]);
  const [projects, setProjects]         = useState<Project[]>([]);
  const [fetching, setFetching]         = useState(true);
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState<APStatus | "All">("All");
  const [modal, setModal]               = useState<null | "create" | "edit">(null);
  const [editing, setEditing]           = useState<AccountsPayable | null>(null);
  const [deleting, setDeleting]         = useState<AccountsPayable | null>(null);
  const [saving, setSaving]             = useState(false);
  const { toasts, push }                = useToast();

  const fetchRows = useCallback(async () => {
    setFetching(true);
    try {
      const data = projectId ? await api.list(projectId) : await api.listAll();
      setRows(data ?? []);
    } catch (err: any) {
      push(err.message || "Failed to load records", "error");
    } finally {
      setFetching(false);
    }
  }, [projectId, push]);

  useEffect(() => {
    fetchRows();
    api.projects().then(setProjects).catch(() => {});
  }, [fetchRows]);

  const filtered = useMemo(() =>
    rows.filter(r => {
      if (filterStatus !== "All" && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.vendor_name.toLowerCase().includes(q) ||
          r.invoice_number.toLowerCase().includes(q) ||
          (r.etims_code ?? "").toLowerCase().includes(q) ||
          (r.receiving_account_code ?? "").toLowerCase().includes(q)
        );
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

  const handleCreate = async (form: APFormData) => {
    setSaving(true);
    try {
      const row = await api.create(form);
      setRows(p => [row, ...p]);
      push("Invoice added.");
      setModal(null);
    } catch (err: any) {
      push(err.message || "Failed to add invoice", "error");
    } finally { setSaving(false); }
  };

  const handleUpdate = async (form: APFormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      setRows(p => p.map(r => r.id === editing.id ? row : r));
      push("Invoice updated.");
      setModal(null); setEditing(null);
    } catch (err: any) {
      push(err.message || "Failed to update invoice", "error");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      setRows(p => p.filter(r => r.id !== deleting.id));
      push("Invoice deleted.");
      setDeleting(null);
    } catch (err: any) {
      push(err.message || "Failed to delete invoice", "error");
    } finally { setSaving(false); }
  };

  // Status pill counts for quick-filter bar
  const statusCounts = useMemo(() => {
    const c: Partial<Record<APStatus, number>> = {};
    rows.forEach(r => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
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
          <APModal
            initial={makeEmpty(projectId ?? "")}
            onSave={handleCreate}
            onClose={() => setModal(null)}
            loading={saving}
            projects={projects}
          />
        )}
        {modal === "edit" && editing && (
          <APModal
            initial={(({ id: _id, balance: _b, created_at: _ca, updated_at: _ua, ...rest }) => rest)(editing)}
            onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
            projects={projects}
          />
        )}
      </AnimatePresence>

      {deleting && (
        <DeleteConfirm
          row={deleting}
          onConfirm={handleDelete}
          onClose={() => setDeleting(null)}
          loading={saving}
        />
      )}

      <div className="container mx-auto px-4 py-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-12 text-center"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">
            Finance Module
          </p>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
            Accounts{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Payable
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Track outstanding vendor invoices, payments and KRA eTIMS obligations.
          </p>
        </motion.div>

        {/* Summary stat cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: "Total Invoiced",  value: fmtKES(totals.total),     color: "text-foreground",  sub: `${rows.length} invoices`                             },
            { label: "Total Paid",      value: fmtKES(totals.paid),      color: "text-emerald-400", sub: `${rows.filter(r => r.status === "paid").length} settled` },
            { label: "Outstanding",     value: fmtKES(totals.balance),   color: totals.balance > 0 ? "text-rose-400" : "text-emerald-400", sub: "balance due" },
            { label: "Retention Held",  value: fmtKES(totals.retaining), color: "text-amber-400",   sub: "across all invoices"                                 },
          ].map(c => (
            <div key={c.label} className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">
                {c.label}
              </div>
              <div className={`text-lg font-bold tabular-nums font-mono ${c.color}`}>{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
            </div>
          ))}
        </motion.div>

        {/* Status quick-filter pills */}
        {rows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="flex flex-wrap gap-2 mb-8"
          >
            {AP_STATUSES.filter(s => statusCounts[s]).map(s => {
              const ss = STATUS_STYLE[s];
              const isActive = filterStatus === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(isActive ? "All" : s)}
                  className={`rounded-2xl border px-4 py-3 text-left transition-all duration-200 backdrop-blur-sm bg-white/5 min-w-[7rem] ${
                    isActive
                      ? "border-white/20 ring-1 ring-white/20 scale-[1.02]"
                      : "border-white/10 hover:border-white/20 hover:scale-[1.01]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] uppercase tracking-widest font-semibold`}>{STATUS_LABEL[s]}</span>
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
        )}

        {/* Overdue alert */}
        {totals.overdue > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.14 }}
            className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 px-5 py-4 flex flex-wrap items-center gap-4 text-xs font-mono"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
              <span className="text-rose-300 font-semibold font-sans text-[11px] uppercase tracking-wider">
                Overdue Invoices
              </span>
            </div>
            <span className="text-rose-300">
              {totals.overdue} invoice{totals.overdue > 1 ? "s" : ""} overdue ·{" "}
              <strong>
                {fmtKES(rows.filter(r => r.status === "overdue").reduce((a, r) => a + Number(r.balance), 0))}
              </strong>{" "}
              outstanding
            </span>
          </motion.div>
        )}

        {/* Main card */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-3xl font-bold">Accounts Payable</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {projectId
                    ? "Invoices linked to this project."
                    : "All invoices across all projects and standalone records."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchRows}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-white/10 rounded-xl hover:bg-white/5 transition-all"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Refresh
                </button>
                {canEdit && (
                  <button
                    onClick={() => setModal("create")}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg"
                    style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    New Record
                  </button>
                )}
              </div>
            </div>
          </CardHeader>

          <APTable
            rows={rows}
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
          />

          {!fetching && rows.length > 0 && (
            <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {rows.length} total invoice{rows.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}