"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { COAAccountSelect } from "@/components/finance/COAAccountSelect";

// ─── DATABASE MIGRATION NOTE ──────────────────────────────────────────────────
// To support global (unlinked) entries, run this once in your Supabase SQL editor:
//
//   ALTER TABLE statement_of_account
//     ALTER COLUMN project_id DROP NOT NULL;
//
// This allows statement entries that belong to the firm as a whole rather
// than any specific project (e.g. firm-wide retainers, corporate adjustments).
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
  currency: string | null;
  site_address: string | null;
  site_city: string | null;
  site_country: string | null;
  start_date: string | null;
  expected_completion_date: string | null;
  created_at: string;
}

type EntryStatus = "Outstanding" | "Paid" | "Overdue" | "Partial" | "Void";
type EntryType =
  | "Invoice"
  | "Payment"
  | "Credit Note"
  | "Debit Note"
  | "Retainer"
  | "Adjustment";

interface StatementEntry {
  id: number;
  project_id: string | null;
  entry_date: string;
  due_date: string | null;
  description: string;
  entry_type: EntryType;
  account_code: string | null;
  reference_no: string | null;
  charges: number;
  credits: number;
  running_balance: number;
  status: EntryStatus;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

type EntryFormData = Omit<StatementEntry, "id" | "running_balance" | "created_at">;

interface Props {
  projectId?: string;
  canEdit?: boolean;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CURRENCY = "KES";

const ENTRY_STATUSES: EntryStatus[] = [
  "Outstanding",
  "Paid",
  "Overdue",
  "Partial",
  "Void",
];
const ENTRY_TYPES: EntryType[] = [
  "Invoice",
  "Payment",
  "Credit Note",
  "Debit Note",
  "Retainer",
  "Adjustment",
];

const STATUS_STYLE: Record<EntryStatus, { accent: string; badge: string; dot: string; row: string }> = {
  Outstanding: {
    accent: "text-amber-400",
    badge: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    dot: "bg-amber-400",
    row: "hover:bg-amber-950/20"
  },
  Paid: {
    accent: "text-emerald-400",
    badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    dot: "bg-emerald-400",
    row: "hover:bg-emerald-950/20"
  },
  Overdue: {
    accent: "text-rose-400",
    badge: "bg-rose-500/10 border-rose-500/30 text-rose-300",
    dot: "bg-rose-400",
    row: "hover:bg-rose-950/20"
  },
  Partial: {
    accent: "text-sky-400",
    badge: "bg-sky-500/10 border-sky-500/30 text-sky-300",
    dot: "bg-sky-400",
    row: "hover:bg-sky-950/20"
  },
  Void: {
    accent: "text-gray-400",
    badge: "bg-gray-500/10 border-gray-500/30 text-gray-400",
    dot: "bg-gray-500",
    row: "hover:bg-gray-950/20"
  }
};

const TYPE_STYLE: Record<EntryType, { color: string; bg: string }> = {
  Invoice: {
    color: "text-violet-300",
    bg: "bg-violet-500/10 border-violet-500/25",
  },
  Payment: {
    color: "text-emerald-300",
    bg: "bg-emerald-500/10 border-emerald-500/25",
  },
  "Credit Note": {
    color: "text-sky-300",
    bg: "bg-sky-500/10 border-sky-500/25",
  },
  "Debit Note": {
    color: "text-orange-300",
    bg: "bg-orange-500/10 border-orange-500/25",
  },
  Retainer: {
    color: "text-pink-300",
    bg: "bg-pink-500/10 border-pink-500/25",
  },
  Adjustment: {
    color: "text-gray-300",
    bg: "bg-gray-500/10 border-gray-500/25",
  },
};

const PROJECT_STATUS_STYLE: Record<string, string> = {
  planning: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  on_hold: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2.5 rounded-xl text-sm font-normal tracking-normal leading-snug " +
  "bg-white/5 border border-white/10 text-foreground placeholder-muted-foreground " +
  "focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/40 transition-all";

const readonlyCls =
  "w-full px-3 py-2.5 rounded-xl text-sm font-normal tracking-normal leading-snug " +
  "bg-white/[0.03] border border-white/[0.06] text-muted-foreground cursor-not-allowed select-none";

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

const fmtDateTime = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleString("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const isOverdue = (due: string | null, status: EntryStatus) => {
  if (!due || status === "Paid" || status === "Void") return false;
  return new Date(due + "T00:00:00") < new Date();
};

const todayISO = () => new Date().toISOString().slice(0, 10);

function sanitizeEntry(raw: StatementEntry): StatementEntry {
  return {
    ...raw,
    charges: n0(raw.charges),
    credits: n0(raw.credits),
    running_balance: n0(raw.running_balance),
  };
}

function recomputeBalances(entries: StatementEntry[]): StatementEntry[] {
  let balance = 0;
  return entries.map((e) => {
    balance += n0(e.charges) - n0(e.credits);
    return { ...e, running_balance: +balance.toFixed(2) };
  });
}

// entry_date and updated_at are always auto-set — never editable by user
const makeEmptyForm = (projectId: string | null = null): EntryFormData => ({
  project_id: projectId,
  entry_date: todayISO(),         // auto: today, read-only
  due_date: null,
  description: "",
  entry_type: "Invoice",
  account_code: null,
  reference_no: null,
  charges: 0,
  credits: 0,
  status: "Outstanding",
  notes: null,
  updated_at: new Date().toISOString(), // auto: now, read-only
});

// ─── AUDIT LOGGING ────────────────────────────────────────────────────────────
async function writeAuditLog(
  action: "INSERT" | "UPDATE" | "DELETE",
  recordId: number | null,
  oldData: object | null,
  newData: object | null
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert([
      {
        table_name: "statement_of_account",
        record_id: recordId ? String(recordId) : null,
        action,
        old_data: oldData,
        new_data: newData,
        changed_by: user?.id ?? null,
      },
    ]);
  } catch {
    // Audit failures are non-blocking — silently ignore
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────
function toWritable(form: EntryFormData): EntryFormData {
  const {
    project_id,
    entry_date,
    due_date,
    description,
    entry_type,
    account_code,
    reference_no,
    charges,
    credits,
    status,
    notes,
    updated_at,
  } = form;
  return {
    project_id,
    entry_date,
    due_date,
    description,
    entry_type,
    account_code,
    reference_no,
    charges,
    credits,
    status,
    notes,
    updated_at,
  };
}

const api = {
  async projects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select(
        "id,project_number,title,description,status,progress_percent,budget_numeric,currency,site_address,site_city,site_country,start_date,expected_completion_date,created_at"
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Project[];
  },

  async list(projectId: string): Promise<StatementEntry[]> {
    const { data, error } = await supabase
      .from("statement_of_account")
      .select("*")
      .eq("project_id", projectId)
      .order("entry_date", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as StatementEntry[]).map(sanitizeEntry);
    return recomputeBalances(rows);
  },

  async listAll(): Promise<StatementEntry[]> {
    const { data, error } = await supabase
      .from("statement_of_account")
      .select("*")
      .order("entry_date", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as StatementEntry[]).map(sanitizeEntry);
    return recomputeBalances(rows);
  },

  async listFirmWide(): Promise<StatementEntry[]> {
    const { data, error } = await supabase
      .from("statement_of_account")
      .select("*")
      .is("project_id", null)
      .order("entry_date", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as StatementEntry[]).map(sanitizeEntry);
    return recomputeBalances(rows);
  },

  async create(form: EntryFormData): Promise<StatementEntry> {
    // Always stamp entry_date and updated_at fresh on create
    const payload = toWritable({
      ...form,
      entry_date: todayISO(),
      updated_at: new Date().toISOString(),
    });

    // Strip project_id for firm-wide entries
    if (!payload.project_id) {
      const { project_id: _omit, ...rest } = payload;
      void _omit;
      const { data, error } = await supabase
        .from("statement_of_account")
        .insert([rest])
        .select()
        .single();
      if (error) {
        if (error.message.includes("not-null") || error.code === "23502") {
          throw new Error(
            "Your database requires a project. Run:\n\n" +
              "ALTER TABLE statement_of_account ALTER COLUMN project_id DROP NOT NULL;"
          );
        }
        throw new Error(error.message);
      }
      const row = sanitizeEntry(data as StatementEntry);
      await writeAuditLog("INSERT", row.id, null, row);
      return row;
    }

    const { data, error } = await supabase
      .from("statement_of_account")
      .insert([payload])
      .select()
      .single();
    if (error) throw new Error(error.message);
    const row = sanitizeEntry(data as StatementEntry);
    await writeAuditLog("INSERT", row.id, null, row);
    return row;
  },

  async update(id: number, form: EntryFormData): Promise<StatementEntry> {
    // Fetch old for audit
    const { data: oldRaw } = await supabase
      .from("statement_of_account")
      .select("*")
      .eq("id", id)
      .single();

    // Always stamp updated_at fresh on update; entry_date stays unchanged from DB
    const payload = toWritable({
      ...form,
      updated_at: new Date().toISOString(),
    });

    const { data, error } = await supabase
      .from("statement_of_account")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const row = sanitizeEntry(data as StatementEntry);
    await writeAuditLog("UPDATE", id, oldRaw ?? null, row);
    return row;
  },

  async remove(id: number): Promise<void> {
    // Fetch old for audit
    const { data: oldRaw } = await supabase
      .from("statement_of_account")
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("statement_of_account")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    await writeAuditLog("DELETE", id, oldRaw ?? null, null);
  },
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);
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

// ─── TOAST RENDERER ───────────────────────────────────────────────────────────
function ToastStack({
  toasts,
}: {
  toasts: { id: number; msg: string; type: "success" | "error" }[];
}) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg max-w-sm ${
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
  );
}

// ─── MIGRATION BANNER ─────────────────────────────────────────────────────────
function MigrationBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
    >
      <div className="flex items-start gap-3">
        <svg
          className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-300 mb-1">
            Database migration required for firm-wide entries
          </p>
          <p className="text-xs font-normal text-amber-200/70 mb-2">
            Run this once in your Supabase SQL editor:
          </p>
          <code className="block bg-black/30 border border-amber-500/20 rounded-lg px-3 py-2 text-xs font-mono text-amber-200 mb-2">
            ALTER TABLE statement_of_account ALTER COLUMN project_id DROP NOT
            NULL;
          </code>
          <p className="text-xs font-normal text-amber-200/50">
            This is safe — existing project-linked entries are unaffected.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-amber-400/60 hover:text-amber-300 transition-colors p-0.5 shrink-0"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

// ─── CUSTOM SELECT ────────────────────────────────────────────────────────────
function Select({
  value,
  onChange,
  options,
  className = "",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; isHeader?: boolean }[];
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value && !o.isHeader);

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
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-normal bg-white/5 border border-white/10 text-foreground hover:bg-white/8 hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/40 transition-all"
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
                if (opt.isHeader) {
                  return (
                    <div
                      key={opt.value}
                      className="px-3.5 pt-3 pb-1 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/50 select-none"
                    >
                      {opt.label}
                    </div>
                  );
                }
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

// ─── FIELD ────────────────────────────────────────────────────────────────────
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
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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

// ─── SECTION LABEL ────────────────────────────────────────────────────────────
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
      <span
        className={`w-1.5 h-5 rounded-full ${dotColor} flex-shrink-0`}
      />
      <div>
        <span
          className={`text-[10px] font-black uppercase tracking-[0.18em] ${textColor}`}
        >
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

// ─── BALANCE BAR ──────────────────────────────────────────────────────────────
function BalanceBar({
  totalCharges,
  totalCredits,
  balance,
}: {
  totalCharges: number;
  totalCredits: number;
  balance: number;
}) {
  const max = Math.max(totalCharges, totalCredits, 1);
  const chargesPct = Math.min((totalCharges / max) * 100, 100);
  const creditsPct = Math.min((totalCredits / max) * 100, 100);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-white/8">
        <div className="flex items-end justify-between mb-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Account Balance
          </p>
          <p
            className={`text-[10px] font-bold ${
              balance > 0
                ? "text-rose-400"
                : balance < 0
                ? "text-emerald-400"
                : "text-muted-foreground"
            }`}
          >
            {balance > 0 ? "Amount Owed" : balance < 0 ? "Credit" : "Settled"}
          </p>
        </div>
        <p
          className={`text-4xl font-black tabular-nums tracking-tighter mt-1 ${
            balance > 0
              ? "text-rose-400"
              : balance < 0
              ? "text-emerald-400"
              : "text-foreground"
          }`}
        >
          {fmt(Math.abs(balance))}
        </p>
        {balance !== 0 && (
          <p className="text-[9px] text-muted-foreground mt-0.5">
            {balance > 0
              ? "Outstanding balance due"
              : "Credit balance in your favour"}
          </p>
        )}
      </div>
      <div className="px-5 py-4 space-y-3">
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-rose-400 font-semibold">Total Debits</span>
            <span className="font-mono font-bold text-rose-400">
              {fmt(totalCharges)}
            </span>
          </div>
          <div className="h-2 bg-white/8 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${chargesPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-emerald-400 font-semibold">
              Total Credits
            </span>
            <span className="font-mono font-bold text-emerald-400">
              {fmt(totalCredits)}
            </span>
          </div>
          <div className="h-2 bg-white/8 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${creditsPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ERP IMPORT SOURCES ───────────────────────────────────────────────────────
// Pulls open AR / AP rows for a project so the user can drop one straight into
// a Statement of Account entry. Each option, when picked, prefills description,
// entry_type, charges/credits, reference_no and due_date.

interface ErpSource {
  key:           string;
  label:         string;
  description:   string;
  entry_type:    EntryType;
  charges:       number;
  credits:       number;
  reference_no:  string | null;
  due_date:      string | null;
  status:        EntryStatus;
}

const mapARStatusToEntryStatus = (s: string): EntryStatus => {
  switch ((s ?? "").toLowerCase()) {
    case "paid":    return "Paid";
    case "overdue": return "Overdue";
    case "partial": return "Partial";
    default:        return "Outstanding";
  }
};

const mapAPStatusToEntryStatus = (s: string): EntryStatus => {
  switch ((s ?? "").toLowerCase()) {
    case "paid":    return "Paid";
    case "overdue": return "Overdue";
    case "partial": return "Partial";
    default:        return "Outstanding";
  }
};

// Invoice-type entries (Invoice / Debit Note) → list project invoices and
// auto-fill the DEBIT (charges) side from the chosen invoice total.
async function fetchInvoiceSources(projectId: string | null): Promise<ErpSource[]> {
  if (!projectId) return [];
  const { data } = await supabase
    .from("invoices")
    .select("id,invoice_number,client_company_name,total,due_date,invoice_date,status")
    .eq("project_id", projectId)
    .order("invoice_date", { ascending: false });

  return (data ?? []).map((r: any) => ({
    key:          `inv:${r.id}`,
    label:        `${r.invoice_number ?? r.id}${r.client_company_name ? " · " + r.client_company_name : ""} — ${fmt(r.total)}`,
    description:  `Invoice ${r.invoice_number ?? r.id}${r.client_company_name ? " — " + r.client_company_name : ""}`,
    entry_type:   "Invoice",
    charges:      Number(r.total) || 0,
    credits:      0,
    reference_no: r.invoice_number ?? null,
    due_date:     null,
    status:       (r.status === "paid" ? "Paid" : r.status === "overdue" ? "Overdue" : r.status === "partial" ? "Partial" : "Outstanding") as EntryStatus,
  }));
}

// Payment-type entries (Payment / Credit Note) → list PM vendors, project
// workers, and WIP costs; auto-fill the CREDITS side from what we'd pay them.
//
//   Vendor amount  = Σ project_financials.total_price billed by that vendor
//   Worker amount  = most recent payroll_checklist.net_pay for that worker
//   WIP cost       = vw_project_cost_incurred.total_cost (AP + JC + Tax + Loan)
async function fetchPaymentSources(projectId: string | null): Promise<ErpSource[]> {
  if (!projectId) return [];

  const [pmRes, wkRes, wipRes] = await Promise.all([
    supabase.from("project_financials")
      .select("id,tender_company_id,total_price,tender_company:tender_companies(id,name)")
      .eq("project_id", projectId)
      .not("tender_company_id", "is", null),
    supabase.from("workers")
      .select("id,full_name,role,worker_assignments!inner(project_id)")
      .eq("worker_assignments.project_id", projectId),
    supabase.from("vw_project_cost_incurred")
      .select("total_cost")
      .eq("project_id", projectId)
      .single(),
  ]);

  // Roll up PM vendors by tender_company_id
  const vendorMap = new Map<string, { name: string; total: number }>();
  for (const r of (pmRes.data ?? []) as any[]) {
    const tcId = r.tender_company_id as string;
    if (!tcId) continue;
    const cur = vendorMap.get(tcId) ?? { name: r.tender_company?.name ?? "—", total: 0 };
    cur.total += Number(r.total_price) || 0;
    vendorMap.set(tcId, cur);
  }

  const workers = ((wkRes.data ?? []) as any[]).map(w => ({
    id:        w.id as string,
    full_name: w.full_name as string,
    role:      (w.role as string | null) ?? null,
  }));

  // Latest payroll net pay per worker
  const netPayByWorker: Record<string, number> = {};
  if (workers.length) {
    const payRes = await supabase
      .from("payroll_checklist")
      .select("worker_id,net_pay,due_date,project_id")
      .in("worker_id", workers.map(w => w.id))
      .eq("project_id", projectId)
      .order("due_date", { ascending: false });
    for (const r of (payRes.data ?? []) as any[]) {
      if (!netPayByWorker[r.worker_id]) netPayByWorker[r.worker_id] = Number(r.net_pay) || 0;
    }
  }

  const out: ErpSource[] = [];
  vendorMap.forEach((v, id) => out.push({
    key:          `vendor:${id}`,
    label:        `${v.name} — ${fmt(v.total)}`,
    description:  `Payment to vendor ${v.name}`,
    entry_type:   "Payment",
    charges:      0,
    credits:      v.total,
    reference_no: null,
    due_date:     null,
    status:       "Outstanding",
  }));
  workers.forEach(w => out.push({
    key:          `worker:${w.id}`,
    label:        `${w.full_name}${w.role ? " (" + w.role.replace(/_/g, " ") + ")" : ""} — ${fmt(netPayByWorker[w.id] || 0)}`,
    description:  `Payment to worker ${w.full_name}${w.role ? " (" + w.role.replace(/_/g, " ") + ")" : ""}`,
    entry_type:   "Payment",
    charges:      0,
    credits:      netPayByWorker[w.id] || 0,
    reference_no: null,
    due_date:     null,
    status:       "Outstanding",
  }));

  // Add WIP cost incurred as a separate line item (if any)
  const wipTotal = Number(wipRes.data?.total_cost ?? 0) || 0;
  if (wipTotal > 0) {
    out.push({
      key:          "wip:cost_incurred",
      label:        `Project Costs (WIP) — ${fmt(wipTotal)}`,
      description:  "Project costs incurred (AP, Job Costs, Taxes, Loan Financing)",
      entry_type:   "Payment",
      charges:      0,
      credits:      wipTotal,
      reference_no: null,
      due_date:     null,
      status:       "Outstanding",
    });
  }

  return out;
}

// ─── ENTRY MODAL ──────────────────────────────────────────────────────────────
function EntryModal({
  initial,
  onSave,
  onClose,
  loading,
  projects = [],
  showProjectSelector = false,
}: {
  initial: EntryFormData & { id?: number };
  onSave: (d: EntryFormData) => void;
  onClose: () => void;
  loading: boolean;
  projects?: Project[];
  showProjectSelector?: boolean;
}) {
  const isEdit = Boolean(initial.id);

  // entry_date is locked to today on create; locked to DB value on edit.
  // updated_at is always "now" at the moment of save — we display a live clock.
  const [form, setForm] = useState<EntryFormData>({
    ...initial,
    // On create, always today. On edit, keep the existing entry_date from DB.
    entry_date: initial.entry_date ?? todayISO(),
  });

  // ERP import — sources depend on the chosen entry type:
  //   Invoice / Debit Note → project invoices → fill DEBIT (charges)
  //   Payment / Credit Note → PM vendors + project workers → fill CREDITS
  const importKind: "invoice" | "payment" | null =
    form.entry_type === "Invoice" || form.entry_type === "Debit Note"   ? "invoice" :
    form.entry_type === "Payment" || form.entry_type === "Credit Note"  ? "payment" :
    null;

  const [erpSources, setErpSources] = useState<ErpSource[]>([]);
  const [erpLoading, setErpLoading] = useState(false);
  const [erpPick, setErpPick]       = useState<string>("");

  useEffect(() => {
    setErpPick("");
    if (isEdit) return;
    const pid = form.project_id;
    if (!pid || !importKind) { setErpSources([]); return; }
    setErpLoading(true);
    const loader = importKind === "invoice" ? fetchInvoiceSources(pid) : fetchPaymentSources(pid);
    loader
      .then(setErpSources)
      .catch(() => setErpSources([]))
      .finally(() => setErpLoading(false));
  }, [form.project_id, form.entry_type, isEdit, importKind]);

  const applyErpSource = (key: string) => {
    setErpPick(key);
    if (!key || key.startsWith("__hdr_")) return;
    const src = erpSources.find(s => s.key === key);
    if (!src) return;
    setForm(p => ({
      ...p,
      description:  src.description,
      entry_type:   src.entry_type,
      charges:      src.charges,
      credits:      src.credits,
      reference_no: src.reference_no,
      due_date:     src.due_date,
      status:       src.status,
    }));
  };

  // Live "last updated" display — ticks every minute so the user sees it's auto
  const [nowDisplay, setNowDisplay] = useState(fmtDateTime(new Date().toISOString()));
  useEffect(() => {
    const id = setInterval(() => {
      setNowDisplay(fmtDateTime(new Date().toISOString()));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const set = <K extends keyof EntryFormData>(k: K, v: EntryFormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  // Auto-set status based on credit amounts
  useEffect(() => {
    if (
      form.credits > 0 &&
      form.credits >= form.charges &&
      form.status !== "Void"
    ) {
      set("status", "Paid");
    } else if (
      form.credits > 0 &&
      form.credits < form.charges &&
      form.status === "Paid"
    ) {
      set("status", "Partial");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.charges, form.credits]);

  const netAmount = n0(form.charges) - n0(form.credits);
  const isFirmWide =
    showProjectSelector &&
    (form.project_id === null || form.project_id === "");
  const isValid =
    form.description.trim() !== "" &&
    (n0(form.charges) > 0 || n0(form.credits) > 0);

  const handleSave = () => {
    // Stamp updated_at at the exact moment the user clicks save
    onSave({
      ...form,
      // entry_date: never changed by user — kept as-is from form state
      updated_at: new Date().toISOString(),
    });
  };

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
              <svg
                className="w-4 h-4 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">
                {isEdit ? "Edit Statement Entry" : "New Statement Entry"}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                {isFirmWide
                  ? "This entry will be posted to the firm-wide statement (not linked to any project)."
                  : "Running balance recalculated automatically"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-xl hover:bg-white/10"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[72vh] overflow-y-auto space-y-4">
          {/* Linked Project — only in global modal */}
          {showProjectSelector && (
            <>
              <SectionLabel
                label="Scope"
                dotColor="bg-primary/70"
                textColor="text-primary"
              />
              <Field label="Linked Project">
                <Select
                  value={form.project_id ?? ""}
                  onChange={(v) =>
                    set("project_id", v === "" ? null : (v as string))
                  }
                  options={[
                    {
                      value: "",
                      label: "— Firm-wide entry (no project) —",
                    },
                    ...projects.map((p) => ({
                      value: p.id,
                      label: `${p.project_number} · ${p.title}`,
                    })),
                  ]}
                />
                <span className="text-[9px] text-muted-foreground/70 mt-1 leading-relaxed">
                  {isFirmWide
                    ? "This entry will appear only in the consolidated firm statement."
                    : "This entry will appear in both the project statement and the consolidated view."}
                </span>
              </Field>
            </>
          )}

          {/* Entry Details */}
          <SectionLabel
            label="Entry Details"
            dotColor="bg-violet-400"
            textColor="text-violet-400"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Description *" className="sm:col-span-2">
              <input
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="e.g. Invoice #001 – Site Works Phase 1"
                className={inputCls}
              />
            </Field>
            <Field label="Entry Type *">
              <Select
                value={form.entry_type}
                onChange={(v) => set("entry_type", v as EntryType)}
                options={ENTRY_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </Field>
            <Field label="Status *">
              <Select
                value={form.status}
                onChange={(v) => set("status", v as EntryStatus)}
                options={ENTRY_STATUSES.map((s) => ({ value: s, label: s }))}
              />
            </Field>

            {/* Invoice / Debit Note — inline invoice picker */}
            {!isEdit && (form.entry_type === "Invoice" || form.entry_type === "Debit Note") && (
              <Field
                label={erpLoading ? "Invoice — Loading…" : "Select Invoice"}
                className="sm:col-span-2"
                hint="Fills in the debit amount, description, reference and due date automatically."
              >
                {form.project_id ? (
                  <Select
                    value={erpPick}
                    onChange={(v) => applyErpSource(v as string)}
                    options={[
                      {
                        value: "",
                        label: erpLoading
                          ? "Loading invoices…"
                          : erpSources.length === 0
                          ? "— No invoices found for this project —"
                          : "— Select an invoice —",
                      },
                      ...erpSources.map((s) => ({ value: s.key, label: s.label })),
                    ]}
                  />
                ) : (
                  <div className={readonlyCls + " text-[11px]"}>
                    Select a project first to see its invoices
                  </div>
                )}
              </Field>
            )}

            {/* Payment / Credit Note — inline vendor & worker picker (grouped) */}
            {!isEdit && (form.entry_type === "Payment" || form.entry_type === "Credit Note") && (
              <Field
                label={erpLoading ? "Loading…" : "Select Vendor, Worker, or Project Costs"}
                className="sm:col-span-2"
                hint="Fills in the credits amount and description automatically."
              >
                {form.project_id ? (() => {
                  const vendors = erpSources.filter(s => s.key.startsWith("vendor:"));
                  const workers = erpSources.filter(s => s.key.startsWith("worker:"));
                  const wipCosts = erpSources.filter(s => s.key.startsWith("wip:"));
                  return (
                    <Select
                      value={erpPick}
                      onChange={(v) => applyErpSource(v as string)}
                      options={[
                        {
                          value: "",
                          label: erpLoading
                            ? "Loading…"
                            : erpSources.length === 0
                            ? "— No vendors, workers, or costs on this project —"
                            : "— Select an item —",
                        },
                        ...(vendors.length > 0 ? [
                          { value: "__hdr_vendors__", label: "PM Vendors", isHeader: true },
                          ...vendors.map(s => ({ value: s.key, label: s.label })),
                        ] : []),
                        ...(workers.length > 0 ? [
                          { value: "__hdr_workers__", label: "Project Workers", isHeader: true },
                          ...workers.map(s => ({ value: s.key, label: s.label })),
                        ] : []),
                        ...(wipCosts.length > 0 ? [
                          { value: "__hdr_wip__", label: "Project Costs", isHeader: true },
                          ...wipCosts.map(s => ({ value: s.key, label: s.label })),
                        ] : []),
                      ]}
                    />
                  );
                })() : (
                  <div className={readonlyCls + " text-[11px]"}>
                    Select a project first to see vendors, workers & costs
                  </div>
                )}
              </Field>
            )}
          </div>

          {/* Amounts */}
          <SectionLabel
            label="Amounts"
            dotColor="bg-emerald-400"
            textColor="text-emerald-400"
            sub="debit = money owed to us · credits = payment to be paid to someone else"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Debit (KES)" hint="Money owed to us">
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.charges || ""}
                  onChange={(e) =>
                    set("charges", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className={inputCls + " pr-14"}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-rose-400">
                  DR
                </span>
              </div>
            </Field>
            <Field label="Credits (KES)" hint="Payment to be paid to someone else">
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.credits || ""}
                  onChange={(e) =>
                    set("credits", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className={inputCls + " pr-14"}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-400">
                  CR
                </span>
              </div>
            </Field>
          </div>

          {/* Net preview */}
          {(n0(form.charges) > 0 || n0(form.credits) > 0) && (
            <div
              className={`rounded-xl px-4 py-3 border flex items-center justify-between ${
                netAmount > 0
                  ? "bg-rose-950/30 border-rose-500/20"
                  : netAmount < 0
                  ? "bg-emerald-950/30 border-emerald-500/20"
                  : "bg-white/5 border-white/10"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Net Movement
              </span>
              <span
                className={`text-lg font-black tabular-nums ${
                  netAmount > 0
                    ? "text-rose-400"
                    : netAmount < 0
                    ? "text-emerald-400"
                    : "text-muted-foreground"
                }`}
              >
                {netAmount > 0 ? "+" : ""}
                {fmt(netAmount)}
              </span>
            </div>
          )}

          {/* Dates & References */}
          <SectionLabel
            label="Dates & References"
            dotColor="bg-sky-400"
            textColor="text-sky-400"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Entry Date — always auto, always read-only */}
            <Field
              label="Entry Date"
              hint="Auto-set to today. Cannot be changed."
            >
              <div className="relative">
                <input
                  type="text"
                  value={fmtDate(form.entry_date)}
                  readOnly
                  tabIndex={-1}
                  className={readonlyCls}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">
                  Auto
                </span>
              </div>
            </Field>

            <Field label="Due Date">
              <input
                type="date"
                value={form.due_date ?? ""}
                onChange={(e) => set("due_date", e.target.value || null)}
                className={inputCls}
              />
            </Field>

            <COAAccountSelect
              value={form.account_code ?? null}
              onChange={(v) => set("account_code", v || null)}
              filter="all"
              valueField="code"
              label="Account Code"
              hint="Select an account from the Chart of Accounts"
            />

            <Field label="Reference No.">
              <input
                value={form.reference_no ?? ""}
                onChange={(e) =>
                  set("reference_no", e.target.value || null)
                }
                placeholder="e.g. INV-001 / REC-055"
                className={inputCls}
              />
            </Field>

            {/* Last Updated — always auto, always read-only */}
            <Field
              label="Last Updated"
              hint="Auto-stamped on save. Cannot be changed."
              className="sm:col-span-2"
            >
              <div className="relative">
                <input
                  type="text"
                  value={isEdit ? nowDisplay : nowDisplay}
                  readOnly
                  tabIndex={-1}
                  className={readonlyCls}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">
                  Auto
                </span>
              </div>
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
            className="px-4 py-2 text-sm font-normal text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !isValid}
            className="px-6 py-2.5 text-sm font-bold rounded-2xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 flex items-center gap-2"
            style={{
              background:
                "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))",
            }}
          >
            {loading && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
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
  entry: StatementEntry;
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
            <svg
              className="w-5 h-5 text-rose-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Delete Entry</h3>
            <p className="text-sm font-normal text-muted-foreground leading-relaxed">
              Permanently remove{" "}
              <span className="text-foreground font-semibold">
                {entry.description}
              </span>
              ? Running balances will be recalculated. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-normal text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
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
  summary,
}: {
  project: Project;
  onSelect: (p: Project) => void;
  summary: { total: number; outstanding: number; overdue: number };
}) {
  const status = project.status ?? "planning";
  const statusCls =
    PROJECT_STATUS_STYLE[status] ?? PROJECT_STATUS_STYLE.planning;

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
          <span
            className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusCls}`}
          >
            {status.replace(/_/g, " ")}
          </span>
        </div>
        {summary.total > 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[9px] bg-white/5 border border-white/10 text-muted-foreground px-2 py-0.5 rounded-full tabular-nums">
              {summary.total} entries
            </span>
            {summary.overdue > 0 && (
              <span className="text-[9px] bg-rose-500/10 border border-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full">
                {summary.overdue} overdue
              </span>
            )}
          </div>
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
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            {project.site_city}
          </span>
        )}
        {project.budget_numeric != null && (
          <span className="flex items-center gap-1 text-emerald-400/80">
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            {fmt(project.budget_numeric)}
          </span>
        )}
      </div>
      {project.progress_percent != null && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
              Progress
            </span>
            <span className="text-[10px] font-mono font-bold text-primary">
              {project.progress_percent}%
            </span>
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
        Open Statement of Account →
      </div>
    </motion.button>
  );
}

// ─── STATEMENT ROW ────────────────────────────────────────────────────────────
function StatementRow({
  entry,
  canEdit,
  onEdit,
  onDelete,
  isOverdueRow,
  showProjectCol = false,
  projects = [],
}: {
  entry: StatementEntry;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isOverdueRow: boolean;
  showProjectCol?: boolean;
  projects?: Project[];
}) {
  const s = STATUS_STYLE[entry.status];
  const t = TYPE_STYLE[entry.entry_type];
  const [expanded, setExpanded] = useState(false);
  const balance = n0(entry.running_balance);

  const projectLabel = (pid: string | null) => {
    if (!pid)
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-violet-300 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded">
          Firm-wide
        </span>
      );
    const p = projects.find((pr) => pr.id === pid);
    return p ? (
      <span className="font-mono text-[10px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
        {p.project_number}
      </span>
    ) : (
      <span className="italic font-normal text-muted-foreground/60 text-xs">
        Unknown
      </span>
    );
  };

  const colSpanCount = showProjectCol
    ? canEdit
      ? 11
      : 10
    : canEdit
    ? 10
    : 9;

  return (
    <>
      <motion.tr
        className={`border-b border-white/8 cursor-pointer transition-colors ${s.row} ${isOverdueRow ? "bg-rose-950/10" : ""}`}
        onClick={() => setExpanded((x) => !x)}
      >
        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
          {fmtDate(entry.entry_date)}
        </td>
        <td className="px-4 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground line-clamp-1">
              {entry.description}
            </span>
            {entry.reference_no && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {entry.reference_no}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3.5 hidden sm:table-cell">
          <span
            className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${t.bg} ${t.color}`}
          >
            {entry.entry_type}
          </span>
        </td>
        <td className="px-4 py-3.5 hidden md:table-cell">
          {entry.account_code ? (
            <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
              {entry.account_code}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </td>
        {showProjectCol && (
          <td className="px-4 py-3.5 whitespace-nowrap hidden md:table-cell">
            {projectLabel(entry.project_id)}
          </td>
        )}
        <td className="px-4 py-3.5 tabular-nums text-sm font-semibold text-right">
          {n0(entry.charges) > 0 ? (
            <span className="text-rose-400">{fmt(entry.charges)}</span>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </td>
        <td className="px-4 py-3.5 tabular-nums text-sm font-semibold text-right">
          {n0(entry.credits) > 0 ? (
            <span className="text-emerald-400">{fmt(entry.credits)}</span>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </td>
        <td className="px-4 py-3.5 tabular-nums font-black text-sm text-right whitespace-nowrap">
          <span
            className={
              balance > 0
                ? "text-rose-400"
                : balance < 0
                ? "text-emerald-400"
                : "text-muted-foreground"
            }
          >
            {fmt(balance)}
          </span>
        </td>
        <td className="px-4 py-3.5 text-xs hidden lg:table-cell whitespace-nowrap">
          {isOverdueRow ? (
            <span className="text-rose-400 font-semibold">
              {fmtDate(entry.due_date)} ⚠
            </span>
          ) : (
            <span className="text-muted-foreground">{fmtDate(entry.due_date)}</span>
          )}
        </td>
        <td className="px-4 py-3.5">
          <Badge className={`text-[9px] font-bold ${s.badge}`}>
            {entry.status}
          </Badge>
        </td>
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

      <AnimatePresence>
        {expanded && (
          <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white/2"
          >
            <td colSpan={colSpanCount} className="px-6 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-[10px]">
                {[
                  { label: "Entry Type", value: entry.entry_type },
                  { label: "Entry Date", value: fmtDate(entry.entry_date) },
                  { label: "Due Date", value: fmtDate(entry.due_date) },
                  { label: "Account Code", value: entry.account_code || "—" },
                  { label: "Reference No.", value: entry.reference_no || "—" },
                  { label: "Debit (DR)", value: fmt(entry.charges) },
                  { label: "Credits (CR)", value: fmt(entry.credits) },
                  {
                    label: "Net Movement",
                    value: fmt(n0(entry.charges) - n0(entry.credits)),
                  },
                  {
                    label: "Running Balance",
                    value: fmt(entry.running_balance),
                  },
                  ...(showProjectCol
                    ? [
                        {
                          label: "Scope",
                          value: entry.project_id
                            ? (projects.find((p) => p.id === entry.project_id)
                                ?.project_number ?? "Unknown")
                            : "Firm-wide",
                        },
                      ]
                    : []),
                  ...(entry.notes ? [{ label: "Notes", value: entry.notes }] : []),
                  ...(entry.updated_at
                    ? [{ label: "Last Updated", value: fmtDateTime(entry.updated_at) }]
                    : []),
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-white/4 rounded-xl p-3 border border-white/8"
                  >
                    <p className="text-muted-foreground uppercase tracking-wider mb-1 text-[9px] font-bold">
                      {item.label}
                    </p>
                    <p className="font-mono font-semibold text-foreground text-[11px]">
                      {item.value}
                    </p>
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

// ─── STATEMENT TABLE (shared between project + global views) ──────────────────
function StatementTable({
  entries,
  canEdit,
  onEdit,
  onDelete,
  showProjectCol = false,
  projects = [],
}: {
  entries: StatementEntry[];
  canEdit: boolean;
  onEdit: (e: StatementEntry) => void;
  onDelete: (e: StatementEntry) => void;
  showProjectCol?: boolean;
  projects?: Project[];
}) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<EntryStatus | "All">("All");
  const [filterType, setFilterType] = useState<EntryType | "All">("All");

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        const statusMatch = filterStatus === "All" || e.status === filterStatus;
        const typeMatch = filterType === "All" || e.entry_type === filterType;
        const searchMatch =
          !search ||
          e.description.toLowerCase().includes(search.toLowerCase()) ||
          (e.reference_no ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (e.account_code ?? "").toLowerCase().includes(search.toLowerCase());
        return statusMatch && typeMatch && searchMatch;
      }),
    [entries, filterStatus, filterType, search]
  );

  const TABLE_HEADERS = [
    "Date",
    "Description",
    "Type",
    "Acc. Code",
    ...(showProjectCol ? ["Scope"] : []),
    "Debit (DR)",
    "Credits (CR)",
    "Balance",
    "Due Date",
    "Status",
    ...(canEdit ? ["Actions"] : []),
  ];

  const HEADER_ALIGN = [
    "text-left",
    "text-left",
    "text-left hidden sm:table-cell",
    "text-left hidden md:table-cell",
    ...(showProjectCol ? ["text-left hidden md:table-cell"] : []),
    "text-right",
    "text-right",
    "text-right",
    "text-left hidden lg:table-cell",
    "text-left",
    ...(canEdit ? ["text-left"] : []),
  ];

  return (
    <>
      {/* Toolbar */}
      <div className="px-6 pt-2 pb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, reference or account code…"
            className={inputCls + " pl-9"}
          />
        </div>
        <Select
          value={filterStatus}
          onChange={(v) => setFilterStatus(v as EntryStatus | "All")}
          options={[
            { value: "All", label: "All Statuses" },
            ...ENTRY_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
          className="w-full sm:w-44"
        />
        <Select
          value={filterType}
          onChange={(v) => setFilterType(v as EntryType | "All")}
          options={[
            { value: "All", label: "All Types" },
            ...ENTRY_TYPES.map((t) => ({ value: t, label: t })),
          ]}
          className="w-full sm:w-44"
        />
        <div className="inline-flex items-center px-4 py-2.5 text-xs font-normal text-muted-foreground border border-white/10 rounded-xl bg-white/5 whitespace-nowrap tabular-nums">
          {filtered.length} / {entries.length} shown
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <svg
            className="w-10 h-10 opacity-30"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
          </svg>
          <p className="text-sm font-normal">No matching entries found.</p>
        </div>
      ) : (
        <>
        {/* Mobile card list — no horizontal scroll */}
        <div className="md:hidden divide-y divide-white/8">
          {filtered.map((entry) => {
            const s = STATUS_STYLE[entry.status];
            const rb = n0(entry.running_balance);
            const meta = [
              { label: "Entry Date",  node: fmtDate(entry.entry_date) },
              { label: "Due Date",    node: <span className={isOverdue(entry.due_date, entry.status) ? "text-rose-400 font-semibold" : ""}>{fmtDate(entry.due_date)}</span> },
              { label: "Type",        node: entry.entry_type },
              { label: "Account",     node: entry.account_code || "—" },
              { label: "Reference",   node: entry.reference_no || "—" },
              ...(showProjectCol ? [{ label: "Project", node: projects.find(p => p.id === entry.project_id)?.project_number ?? "—" }] : []),
            ];
            return (
              <div key={entry.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{entry.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.entry_type}</p>
                  </div>
                  <Badge className={`text-[10px] px-2 py-0.5 border rounded-full font-semibold shrink-0 ${s.badge}`}>{entry.status}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { l: "Debit", v: fmt(n0(entry.charges)), c: "text-rose-400" },
                    { l: "Credits", v: fmt(n0(entry.credits)), c: "text-emerald-400" },
                    { l: "Balance", v: fmt(rb),                c: rb > 0 ? "text-rose-400" : rb < 0 ? "text-emerald-400" : "text-muted-foreground" },
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
                    <button onClick={() => onEdit(entry)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground border border-white/10 hover:bg-white/5 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                    <button onClick={() => onDelete(entry)}
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
          <table className="w-full text-sm min-w-[800px]">
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
                <StatementRow
                  key={entry.id}
                  entry={entry}
                  canEdit={canEdit}
                  onEdit={() => onEdit(entry)}
                  onDelete={() => onDelete(entry)}
                  isOverdueRow={isOverdue(entry.due_date, entry.status)}
                  showProjectCol={showProjectCol}
                  projects={projects}
                />
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </>
  );
}

// ─── SUMMARY FOOTER ───────────────────────────────────────────────────────────
function SummaryFooter({
  entries,
  shownCount,
}: {
  entries: StatementEntry[];
  shownCount?: number;
}) {
  const totalCharges = entries.reduce((a, e) => a + n0(e.charges), 0);
  const totalCredits = entries.reduce((a, e) => a + n0(e.credits), 0);
  const closingBalance =
    entries.length > 0 ? n0(entries[entries.length - 1].running_balance) : 0;

  return (
    <div className="border-t border-white/12 bg-white/3">
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Summary — {entries.length} entries
          </span>
          {shownCount !== undefined && (
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold ml-auto">
              {shownCount} shown
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Total Debits",
              value: totalCharges,
              color: "text-rose-400",
              sub: "DR",
            },
            {
              label: "Total Credits",
              value: totalCredits,
              color: "text-emerald-400",
              sub: "CR",
            },
            {
              label: "Net Movement",
              value: totalCharges - totalCredits,
              color:
                totalCharges - totalCredits > 0
                  ? "text-rose-400"
                  : "text-emerald-400",
              sub: totalCharges - totalCredits > 0 ? "Owed" : "Credit",
            },
            {
              label: "Closing Balance",
              value: closingBalance,
              color:
                closingBalance > 0
                  ? "text-rose-400"
                  : closingBalance < 0
                  ? "text-emerald-400"
                  : "text-muted-foreground",
              sub:
                closingBalance > 0
                  ? "Outstanding"
                  : closingBalance < 0
                  ? "Credit"
                  : "Settled",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white/4 rounded-xl p-3 border border-white/8"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                  {item.label}
                </p>
                <span className="text-[9px] font-bold text-muted-foreground/60">
                  {item.sub}
                </span>
              </div>
              <p
                className={`text-sm font-black tabular-nums tracking-tight ${item.color}`}
              >
                {fmt(item.value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GLOBAL STATEMENT VIEW ────────────────────────────────────────────────────
type GlobalTab = "consolidated" | "firm-wide";

function GlobalStatementView({
  canEdit,
  projects,
}: {
  canEdit: boolean;
  projects: Project[];
}) {
  const [allEntries, setAllEntries] = useState<StatementEntry[]>([]);
  const [fetching, setFetching] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StatementEntry | null>(null);
  const [deleting, setDeleting] = useState<StatementEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<GlobalTab>("consolidated");
  const [showMigration, setShowMigration] = useState(false);

  const { toasts, push } = useToast();

  const fetchEntries = useCallback(async () => {
    setFetching(true);
    setAllEntries([]);
    try {
      setAllEntries(await api.listAll());
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to load entries.", "error");
    } finally {
      setFetching(false);
    }
  }, [push]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const refreshBalances = useCallback((updated: StatementEntry[]) => {
    const sorted = [...updated].sort(
      (a, b) =>
        new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );
    setAllEntries(recomputeBalances(sorted));
  }, []);

  const handleCreate = async (form: EntryFormData) => {
    setSaving(true);
    try {
      const row = await api.create(form);
      refreshBalances([...allEntries, row]);
      push("Entry added successfully.");
      setShowModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add entry.";
      push(msg, "error");
      if (
        msg.includes("not-null") ||
        msg.includes("migration") ||
        msg.includes("project_id")
      ) {
        setShowMigration(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: EntryFormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      const next = allEntries.map((e) => (e.id === editing.id ? row : e));
      refreshBalances(next);
      push("Entry updated.");
      setEditing(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to update entry.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      const next = allEntries.filter((e) => e.id !== deleting.id);
      refreshBalances(next);
      push("Entry deleted.");
      setDeleting(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to delete entry.", "error");
    } finally {
      setSaving(false);
    }
  };

  const displayEntries = useMemo(
    () =>
      activeTab === "firm-wide"
        ? allEntries.filter((e) => e.project_id === null)
        : allEntries,
    [allEntries, activeTab]
  );

  const firmWideCount = allEntries.filter((e) => e.project_id === null).length;
  const consolidatedCount = allEntries.length;

  const overdueCount = displayEntries.filter((e) =>
    isOverdue(e.due_date, e.status)
  ).length;

  const tabs: {
    key: GlobalTab;
    label: string;
    count: number;
    description: string;
  }[] = [
    {
      key: "consolidated",
      label: "Consolidated",
      count: consolidatedCount,
      description:
        "All entries across every project + firm-wide accounts",
    },
    {
      key: "firm-wide",
      label: "Firm-wide Only",
      count: firmWideCount,
      description: "Entries not linked to any specific project",
    },
  ];

  return (
    <div className="container mx-auto px-4 pb-20">
      <ToastStack toasts={toasts} />

      <AnimatePresence>
        {showModal && (
          <EntryModal
            initial={makeEmptyForm(null)}
            onSave={handleCreate}
            onClose={() => setShowModal(false)}
            loading={saving}
            projects={projects}
            showProjectSelector
          />
        )}
        {editing && !showModal && (
          <EntryModal
            initial={{ ...editing }}
            onSave={handleUpdate}
            onClose={() => setEditing(null)}
            loading={saving}
            projects={projects}
            showProjectSelector
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

      {/* Section Heading */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground px-2">
            Firm Overview
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-2">
          Consolidated{" "}
          <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Statement of Account
          </span>
        </h2>
        <p className="text-center text-sm font-normal text-muted-foreground max-w-xl mx-auto">
          Auto-generated from all posted entries across every project and
          firm-wide accounts. Add a new entry to update any section of the
          statement.
        </p>
      </motion.div>

      <AnimatePresence>
        {showMigration && (
          <MigrationBanner onDismiss={() => setShowMigration(false)} />
        )}
      </AnimatePresence>

      {/* Global stat cards */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {[
          {
            label: "Total Entries",
            value: allEntries.length,
            sub: "all scopes",
            color: "",
            isNum: true,
          },
          {
            label: "Total Debits",
            value: allEntries.reduce((a, e) => a + n0(e.charges), 0),
            sub: "DR",
            color: "text-rose-400",
            isNum: false,
          },
          {
            label: "Total Credits",
            value: allEntries.reduce((a, e) => a + n0(e.credits), 0),
            sub: "CR",
            color: "text-emerald-400",
            isNum: false,
          },
          {
            label: "Overdue",
            value: overdueCount,
            sub: "past due date",
            color: overdueCount > 0 ? "text-rose-400" : "",
            isNum: true,
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-4 backdrop-blur-sm bg-white/5 ${
              card.color === "text-rose-400" && card.isNum && overdueCount > 0
                ? "border-rose-500/20"
                : "border-white/10"
            }`}
          >
            <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">
              {card.label}
            </div>
            <div
              className={`text-3xl font-bold tabular-nums ${card.color || "text-foreground"}`}
            >
              {card.isNum ? card.value : fmt(card.value as number)}
            </div>
            <div className="text-xs font-normal text-muted-foreground mt-1">
              {card.sub}
            </div>
          </div>
        ))}
      </motion.div>

      <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-3xl font-bold">
                All Posted Entries
              </CardTitle>
              <p className="text-xs font-normal text-muted-foreground mt-1">
                The consolidated view is the authoritative firm-wide statement.
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))",
                }}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Entry
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium tracking-normal transition-all ${
                  activeTab === tab.key
                    ? "bg-white/10 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full tabular-nums ${
                    activeTab === tab.key
                      ? "bg-primary/20 text-primary"
                      : "bg-white/5 text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs font-normal text-muted-foreground mt-2">
            {tabs.find((t) => t.key === activeTab)?.description}
          </p>
        </CardHeader>

        <CardContent className="p-0">
          {fetching ? (
            <div className="flex items-center justify-center py-24 gap-3 text-sm text-muted-foreground">
              <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
              Loading statement…
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
              <svg
                className="w-12 h-12 opacity-20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
              </svg>
              <p className="text-sm font-normal">
                {activeTab === "firm-wide"
                  ? "No firm-wide entries yet. Add an entry without linking a project."
                  : "No entries posted yet."}
              </p>
              {canEdit && (
                <button
                  onClick={() => setShowModal(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Add first entry
                </button>
              )}
            </div>
          ) : (
            <StatementTable
              entries={displayEntries}
              canEdit={canEdit}
              onEdit={(e) => setEditing(e)}
              onDelete={(e) => setDeleting(e)}
              showProjectCol={activeTab === "consolidated"}
              projects={projects}
            />
          )}

          {displayEntries.length > 0 && (
            <SummaryFooter entries={displayEntries} />
          )}

          {!fetching && allEntries.length > 0 && (
            <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs font-normal text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="tabular-nums">
                  {allEntries.length} total entries
                </span>
                {firmWideCount > 0 && (
                  <span className="tabular-nums text-violet-400/70">
                    {firmWideCount} firm-wide
                  </span>
                )}
                <span className="tabular-nums text-primary/70">
                  {allEntries.length - firmWideCount} project-linked
                </span>
              </div>
              <button
                onClick={fetchEntries}
                className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Refresh
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── PROJECT PICKER ───────────────────────────────────────────────────────────
function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [summaries, setSummaries] = useState<Record<string, { total: number; outstanding: number; overdue: number }>>({});
  const { toasts, push } = useToast();

  useEffect(() => {
    api
      .projects()
      .then(async (data) => {
        setProjects(data);
        if (data.length) {
          const ids = data.map((p) => p.id);
          const { data: rows } = await supabase
            .from("statement_of_account")
            .select("project_id,status,due_date")
            .in("project_id", ids);
          if (rows) {
            const tally: Record<string, { total: number; outstanding: number; overdue: number }> = {};
            (rows as { project_id: string; status: EntryStatus; due_date: string | null }[]).forEach((r) => {
              if (!tally[r.project_id])
                tally[r.project_id] = {
                  total: 0,
                  outstanding: 0,
                  overdue: 0,
                };
              tally[r.project_id].total++;
              if (r.status === "Outstanding")
                tally[r.project_id].outstanding++;
              if (isOverdue(r.due_date, r.status))
                tally[r.project_id].overdue++;
            });
            setSummaries(tally);
          }
        }
      })
      .catch((err) =>
        push(
          err instanceof Error ? err.message : "Failed to load projects",
          "error"
        )
      )
      .finally(() => setFetching(false));
  }, [push]);

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        const matchStatus =
          statusFilter === "all" || p.status === statusFilter;
        const matchSearch =
          !search ||
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.project_number.toLowerCase().includes(search.toLowerCase()) ||
          (p.site_city ?? "").toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchSearch;
      }),
    [projects, search, statusFilter]
  );

  const totalEntries = Object.values(summaries).reduce(
    (a, c) => a + c.total,
    0
  );
  const totalOverdue = Object.values(summaries).reduce(
    (a, c) => a + c.overdue,
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <ToastStack toasts={toasts} />

      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 font-bold flex items-center gap-2">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
                </svg>
                STATEMENT OF ACCOUNT · KES · 2026
              </p>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black leading-none tracking-tighter">
                Statement{" "}
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  of Account
                </span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground mt-3 max-w-xl">
                Full charge, credit and running balance ledger per project.
              </p>
            </div>
            {totalEntries > 0 && (
              <div className="flex gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center min-w-[80px]">
                  <p className="text-2xl font-black tabular-nums text-foreground">
                    {totalEntries}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                    Entries
                  </p>
                </div>
                {totalOverdue > 0 && (
                  <div className="rounded-2xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 text-center min-w-[80px]">
                    <p className="text-2xl font-black tabular-nums text-rose-400">
                      {totalOverdue}
                    </p>
                    <p className="text-[9px] uppercase tracking-wider text-rose-400/70 mt-0.5">
                      Overdue
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Summary stat cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
        >
          {[
            {
              label: "Total Projects",
              value: projects.length,
              sub: "in system",
              color: "",
            },
            {
              label: "Projects with Entries",
              value: Object.keys(summaries).length,
              sub: "have SOA records",
              color: "",
            },
            {
              label: "Total Overdue",
              value: totalOverdue,
              sub: "past due date",
              color: totalOverdue > 0 ? "text-rose-400" : "",
            },
            {
              label: "Total Entries",
              value: totalEntries,
              sub: "across all projects",
              color: "",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5"
            >
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                {card.label}
              </div>
              <div
                className={`text-3xl font-bold tabular-nums ${card.color || "text-foreground"}`}
              >
                {card.value}
              </div>
              <div className="text-xs font-normal text-muted-foreground mt-1">
                {card.sub}
              </div>
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
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, number or city…"
                  className={inputCls + " pl-9"}
                />
              </div>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: "All Statuses" },
                  ...Array.from(
                    new Set(projects.map((p) => p.status ?? "planning"))
                  ).map((s) => ({
                    value: s,
                    label: s
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase()),
                  })),
                ]}
                className="w-full sm:w-52"
              />
              <div className="inline-flex items-center px-4 py-2.5 text-xs font-normal text-muted-foreground border border-white/10 rounded-xl bg-white/5 whitespace-nowrap tabular-nums">
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
                <svg
                  className="w-12 h-12 opacity-20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path d="M2 20h20M5 20V8l7-6 7 6v12M9 20v-6h6v6" />
                </svg>
                <p className="text-sm font-normal">No projects found.</p>
                {search && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onSelect={onSelect}
                    summary={
                      summaries[p.id] ?? {
                        total: 0,
                        outstanding: 0,
                        overdue: 0,
                      }
                    }
                  />
                ))}
              </div>
            )}
            {!fetching && projects.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs font-normal text-muted-foreground">
                <span className="tabular-nums">
                  {projects.length} total projects ·{" "}
                  {Object.keys(summaries).length} with statement entries
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Global consolidated view */}
        {!fetching && (
          <GlobalStatementView canEdit={true} projects={projects} />
        )}
      </div>
    </div>
  );
}

// ─── STATEMENT VIEW (per-project) ─────────────────────────────────────────────
function StatementView({
  project,
  canEdit,
  onBack,
}: {
  project: Project;
  canEdit: boolean;
  onBack: () => void;
}) {
  const [entries, setEntries] = useState<StatementEntry[]>([]);
  const [fetching, setFetching] = useState(false);
  const [modal, setModal] = useState<null | "create" | "edit">(null);
  const [editing, setEditing] = useState<StatementEntry | null>(null);
  const [deleting, setDeleting] = useState<StatementEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<EntryStatus | "All">("All");

  const { toasts, push } = useToast();

  const fetchEntries = useCallback(async () => {
    setFetching(true);
    try {
      setEntries(await api.list(project.id));
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to load entries", "error");
    } finally {
      setFetching(false);
    }
  }, [project.id, push]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const refreshBalances = useCallback((updated: StatementEntry[]) => {
    const sorted = [...updated].sort(
      (a, b) =>
        new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );
    setEntries(recomputeBalances(sorted));
  }, []);

  const handleCreate = async (form: EntryFormData) => {
    setSaving(true);
    try {
      const row = await api.create({ ...form, project_id: project.id });
      refreshBalances([...entries, row]);
      push("Entry added ✓");
      setModal(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to add entry", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: EntryFormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      refreshBalances(entries.map((e) => (e.id === editing.id ? row : e)));
      push("Entry updated ✓");
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
      refreshBalances(entries.filter((e) => e.id !== deleting.id));
      push("Entry deleted");
      setDeleting(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setSaving(false);
    }
  };

  const totalCharges = entries.reduce((a, e) => a + n0(e.charges), 0);
  const totalCredits = entries.reduce((a, e) => a + n0(e.credits), 0);
  const closingBalance =
    entries.length > 0 ? n0(entries[entries.length - 1].running_balance) : 0;
  const outstandingCount = entries.filter(
    (e) => e.status === "Outstanding"
  ).length;
  const overdueCount = entries.filter((e) =>
    isOverdue(e.due_date, e.status)
  ).length;
  const paidCount = entries.filter((e) => e.status === "Paid").length;
  const paidPct = entries.length
    ? Math.round((paidCount / entries.length) * 100)
    : 0;

  // suppress unused variable warning
  void outstandingCount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <ToastStack toasts={toasts} />

      <AnimatePresence>
        {modal === "create" && (
          <EntryModal
            initial={makeEmptyForm(project.id)}
            onSave={handleCreate}
            onClose={() => setModal(null)}
            loading={saving}
          />
        )}
        {modal === "edit" && editing && (
          <EntryModal
            initial={{ ...editing }}
            onSave={handleUpdate}
            onClose={() => {
              setModal(null);
              setEditing(null);
            }}
            loading={saving}
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
          className="inline-flex items-center gap-1.5 text-sm font-normal text-muted-foreground hover:text-foreground mb-8 transition-colors group"
        >
          <svg
            className="w-4 h-4 transition-transform group-hover:-translate-x-0.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
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
              <span
                className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                  PROJECT_STATUS_STYLE[project.status] ??
                  PROJECT_STATUS_STYLE.planning
                }`}
              >
                {project.status.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tighter bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent leading-none mt-1">
            {project.title}
          </h1>
          {project.site_city && (
            <p className="text-base text-muted-foreground mt-2 flex items-center gap-1.5">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              {project.site_city}
              {project.site_country ? `, ${project.site_country}` : ""}
            </p>
          )}
        </div>

        {/* Summary Strip + Balance Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ENTRY_STATUSES.map((st) => {
              const s = STATUS_STYLE[st];
              const count = entries.filter((e) => e.status === st).length;
              const isActive = filterStatus === st;
              return (
                <button
                  key={st}
                  onClick={() => setFilterStatus(isActive ? "All" : st)}
                  className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                    isActive
                      ? "border-white/30 bg-white/8 shadow-lg"
                      : "border-white/8 hover:border-white/20 bg-white/3 hover:bg-white/5"
                  }`}
                >
                  <div
                    className={`text-[9px] uppercase tracking-widest font-black mb-1 ${s.accent}`}
                  >
                    {st}
                  </div>
                  <div className="text-2xl sm:text-3xl font-black tabular-nums">
                    {count}
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">
                    entries
                  </div>
                </button>
              );
            })}
            <div
              className={`rounded-2xl border p-4 ${
                overdueCount > 0
                  ? "border-rose-500/25 bg-rose-500/8"
                  : "border-white/8 bg-white/3"
              }`}
            >
              <div
                className={`text-[9px] uppercase tracking-widest font-black mb-1 ${
                  overdueCount > 0
                    ? "text-rose-400"
                    : "text-muted-foreground"
                }`}
              >
                Overdue
              </div>
              <div
                className={`text-2xl sm:text-3xl font-black tabular-nums ${
                  overdueCount > 0 ? "text-rose-400" : ""
                }`}
              >
                {overdueCount}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                past due date
              </div>
            </div>
            <div
              className={`rounded-2xl border p-4 ${
                paidPct === 100
                  ? "border-emerald-500/30 bg-emerald-500/8"
                  : "border-white/8 bg-white/3"
              }`}
            >
              <div className="text-[9px] uppercase tracking-widest font-black text-emerald-400 mb-1">
                Paid Rate
              </div>
              <div
                className={`text-2xl sm:text-3xl font-black tabular-nums ${
                  paidPct === 100 ? "text-emerald-400" : ""
                }`}
              >
                {paidPct}%
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">
                {paidCount} of {entries.length}
              </div>
            </div>
          </div>
          <BalanceBar
            totalCharges={totalCharges}
            totalCredits={totalCredits}
            balance={closingBalance}
          />
        </div>

        {/* Main Card */}
        <Card className="backdrop-blur-xl bg-white/5 border border-white/12 rounded-2xl shadow-xl overflow-hidden">
          <CardHeader className="pb-0 border-b border-white/8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5">
              <div>
                <CardTitle className="text-2xl font-black">
                  Statement of Account
                </CardTitle>
                <p className="text-xs font-normal text-muted-foreground mt-0.5">
                  Click any row to expand full entry detail · Running balance
                  auto-computed
                </p>
              </div>
              {canEdit && (
                <button
                  onClick={() => setModal("create")}
                  className="flex-shrink-0 px-5 py-2.5 rounded-2xl font-bold text-sm text-primary-foreground flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                  style={{
                    background:
                      "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))",
                  }}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New Entry
                </button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-28 text-muted-foreground gap-3">
                <span className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                Loading statement…
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 text-muted-foreground gap-3">
                <svg
                  className="w-10 h-10 opacity-30"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
                </svg>
                <p className="text-sm font-normal">
                  No statement entries yet for this project.
                </p>
                {canEdit && (
                  <button
                    onClick={() => setModal("create")}
                    className="text-sm text-primary hover:underline"
                  >
                    Add the first entry →
                  </button>
                )}
              </div>
            ) : (
              <StatementTable
                entries={entries}
                canEdit={canEdit}
                onEdit={(e) => {
                  setEditing(e);
                  setModal("edit");
                }}
                onDelete={(e) => setDeleting(e)}
                showProjectCol={false}
              />
            )}

            {entries.length > 0 && <SummaryFooter entries={entries} />}

            {!fetching && entries.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs font-normal text-muted-foreground">
                <span className="tabular-nums">
                  {entries.length} total entries
                </span>
                <button
                  onClick={fetchEntries}
                  className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path d="M23 4v6h-6" />
                    <path d="M1 20v-6h6" />
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

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function StatementOfAccountPage({
  projectId,
  canEdit = true,
}: Props) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select(
        "id,project_number,title,description,status,progress_percent,budget_numeric,currency,site_address,site_city,site_country,start_date,expected_completion_date,created_at"
      )
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
          key="statement"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25 }}
        >
          <StatementView
            project={selectedProject}
            canEdit={canEdit}
            onBack={() => {
              if (!projectId) setSelectedProject(null);
            }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="picker"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.25 }}
        >
          <ProjectPickerView onSelect={setSelectedProject} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}