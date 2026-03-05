"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  project_id: string;
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

type EntryFormData = Omit<StatementEntry, "id" | "running_balance" | "created_at" | "updated_at">;

interface Props {
  projectId?: string;
  canEdit?: boolean;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CURRENCY = "KES";

const ENTRY_STATUSES: EntryStatus[] = ["Outstanding", "Paid", "Overdue", "Partial", "Void"];
const ENTRY_TYPES: EntryType[] = [
  "Invoice",
  "Payment",
  "Credit Note",
  "Debit Note",
  "Retainer",
  "Adjustment",
];

const STATUS_STYLE: Record<
  EntryStatus,
  { accent: string; badge: string; dot: string; row: string }
> = {
  Outstanding: {
    accent: "text-amber-400",
    badge: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    dot: "bg-amber-400",
    row: "hover:bg-amber-950/20",
  },
  Paid: {
    accent: "text-emerald-400",
    badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    dot: "bg-emerald-400",
    row: "hover:bg-emerald-950/20",
  },
  Overdue: {
    accent: "text-rose-400",
    badge: "bg-rose-500/10 border-rose-500/30 text-rose-300",
    dot: "bg-rose-400",
    row: "hover:bg-rose-950/20",
  },
  Partial: {
    accent: "text-sky-400",
    badge: "bg-sky-500/10 border-sky-500/30 text-sky-300",
    dot: "bg-sky-400",
    row: "hover:bg-sky-950/20",
  },
  Void: {
    accent: "text-gray-400",
    badge: "bg-gray-500/10 border-gray-500/30 text-gray-400",
    dot: "bg-gray-500",
    row: "hover:bg-gray-950/20",
  },
};

const TYPE_STYLE: Record<EntryType, { color: string; bg: string }> = {
  Invoice:     { color: "text-violet-300",  bg: "bg-violet-500/10 border-violet-500/25" },
  Payment:     { color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/25" },
  "Credit Note": { color: "text-sky-300",   bg: "bg-sky-500/10 border-sky-500/25" },
  "Debit Note":  { color: "text-orange-300", bg: "bg-orange-500/10 border-orange-500/25" },
  Retainer:    { color: "text-pink-300",    bg: "bg-pink-500/10 border-pink-500/25" },
  Adjustment:  { color: "text-gray-300",    bg: "bg-gray-500/10 border-gray-500/25" },
};

const PROJECT_STATUS_STYLE: Record<string, string> = {
  planning:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  on_hold:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
/** Null/NaN-safe KES formatter */
const fmt = (n: number | null | undefined) => {
  const safe = typeof n === "number" && isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
};

/** Compact formatter e.g. 1.2M */
const fmtC = (n: number | null | undefined) => {
  const safe = typeof n === "number" && isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-KE", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(safe);
};

/** Null-safe number coercion */
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

const isOverdue = (due: string | null, status: EntryStatus) => {
  if (!due || status === "Paid" || status === "Void") return false;
  return new Date(due + "T00:00:00") < new Date();
};

/** Sanitize a DB row — coerce nulls, recompute running_balance if needed */
function sanitizeEntry(raw: StatementEntry): StatementEntry {
  return {
    ...raw,
    charges:         n0(raw.charges),
    credits:         n0(raw.credits),
    running_balance: n0(raw.running_balance),
  };
}

/** Recompute running balances for an ordered list of entries */
function recomputeBalances(entries: StatementEntry[]): StatementEntry[] {
  let balance = 0;
  return entries.map((e) => {
    balance += n0(e.charges) - n0(e.credits);
    return { ...e, running_balance: +balance.toFixed(2) };
  });
}

const makeEmptyForm = (projectId: string): EntryFormData => ({
  project_id:  projectId,
  entry_date:  new Date().toISOString().slice(0, 10),
  due_date:    null,
  description: "",
  entry_type:  "Invoice",
  account_code: null,
  reference_no: null,
  charges:     0,
  credits:     0,
  status:      "Outstanding",
  notes:       null,
});

// ─── API ──────────────────────────────────────────────────────────────────────
function toWritable(form: EntryFormData): EntryFormData {
  const {
    project_id, entry_date, due_date, description, entry_type,
    account_code, reference_no, charges, credits, status, notes,
  } = form;
  return {
    project_id, entry_date, due_date, description, entry_type,
    account_code, reference_no, charges, credits, status, notes,
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

  async create(form: EntryFormData): Promise<StatementEntry> {
    const { data, error } = await supabase
      .from("statement_of_account")
      .insert([toWritable(form)])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return sanitizeEntry(data as StatementEntry);
  },

  async update(id: number, form: EntryFormData): Promise<StatementEntry> {
    const { data, error } = await supabase
      .from("statement_of_account")
      .update(toWritable(form))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return sanitizeEntry(data as StatementEntry);
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from("statement_of_account")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
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

/**
 * Custom Select — fully themed dropdown that matches the dark page aesthetic.
 * Replaces all native <select> elements so browser system UI never bleeds in.
 */
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

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
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
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown panel */}
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
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm text-left transition-colors ${
                      isActive
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-foreground/80 hover:bg-white/6 hover:text-foreground"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isActive && (
                      <svg className="w-3.5 h-3.5 flex-shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
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

// ─── BALANCE INDICATOR ────────────────────────────────────────────────────────
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

      {/* Visual bars */}
      <div className="px-5 py-4 space-y-3">
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-rose-400 font-semibold">Total Charges</span>
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
            <span className="text-emerald-400 font-semibold">Total Credits</span>
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

// ─── ENTRY MODAL ──────────────────────────────────────────────────────────────
function EntryModal({
  initial,
  onSave,
  onClose,
  loading,
}: {
  initial: EntryFormData & { id?: number };
  onSave: (d: EntryFormData) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<EntryFormData>({ ...initial });
  const isEdit = Boolean(initial.id);

  const set = <K extends keyof EntryFormData>(k: K, v: EntryFormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  // Auto-set status to Paid when full credit matches charges
  useEffect(() => {
    if (form.credits > 0 && form.credits >= form.charges && form.status !== "Void") {
      set("status", "Paid");
    } else if (form.credits > 0 && form.credits < form.charges && form.status === "Paid") {
      set("status", "Partial");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.charges, form.credits]);

  const netAmount = n0(form.charges) - n0(form.credits);
  const isValid =
    form.description.trim() !== "" &&
    (n0(form.charges) > 0 || n0(form.credits) > 0);

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
                Running balance recalculated automatically
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
          {/* Entry details */}
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
          </div>

          {/* Amounts */}
          <SectionLabel
            label="Amounts"
            dotColor="bg-emerald-400"
            textColor="text-emerald-400"
            sub="charges = debits owed · credits = payments received"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Charges (KES)" hint="Amount billed / invoiced">
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
            <Field label="Credits (KES)" hint="Amount paid / received">
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
            <Field label="Entry Date *">
              <input
                type="date"
                value={form.entry_date}
                onChange={(e) => set("entry_date", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Due Date">
              <input
                type="date"
                value={form.due_date ?? ""}
                onChange={(e) => set("due_date", e.target.value || null)}
                className={inputCls}
              />
            </Field>
            <Field label="Account Code">
              <input
                value={form.account_code ?? ""}
                onChange={(e) => set("account_code", e.target.value || null)}
                placeholder="e.g. 1002"
                className={inputCls}
              />
            </Field>
            <Field label="Reference No.">
              <input
                value={form.reference_no ?? ""}
                onChange={(e) => set("reference_no", e.target.value || null)}
                placeholder="e.g. INV-001 / REC-055"
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
            <p className="text-sm text-muted-foreground leading-relaxed">
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
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5"
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

// ─── PROJECT PICKER ───────────────────────────────────────────────────────────
function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [summaries, setSummaries] = useState<
    Record<string, { total: number; outstanding: number; overdue: number }>
  >({});
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
            const tally: Record<
              string,
              { total: number; outstanding: number; overdue: number }
            > = {};
            rows.forEach((r: any) => {
              if (!tally[r.project_id])
                tally[r.project_id] = { total: 0, outstanding: 0, overdue: 0 };
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

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
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

        {/* Project Grid */}
        {fetching ? (
          <div className="flex items-center justify-center py-32 text-muted-foreground">
            <span className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-3" />
            Loading projects…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 text-muted-foreground">
            No projects found.
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05 } },
              hidden: {},
            }}
          >
            {filtered.map((p) => (
              <motion.div
                key={p.id}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <ProjectCard
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
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── STATEMENT ROW ────────────────────────────────────────────────────────────
function StatementRow({
  entry,
  canEdit,
  onEdit,
  onDelete,
  isOverdueRow,
}: {
  entry: StatementEntry;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isOverdueRow: boolean;
}) {
  const s = STATUS_STYLE[entry.status];
  const t = TYPE_STYLE[entry.entry_type];
  const [expanded, setExpanded] = useState(false);
  const balance = n0(entry.running_balance);

  return (
    <>
      <motion.tr
        className={`border-b border-white/8 cursor-pointer transition-colors ${s.row} ${
          isOverdueRow ? "bg-rose-950/10" : ""
        }`}
        onClick={() => setExpanded((x) => !x)}
      >
        {/* Date */}
        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
          {fmtDate(entry.entry_date)}
        </td>
        {/* Description */}
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
        {/* Type */}
        <td className="px-4 py-3.5 hidden sm:table-cell">
          <span
            className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${t.bg} ${t.color}`}
          >
            {entry.entry_type}
          </span>
        </td>
        {/* Account code */}
        <td className="px-4 py-3.5 hidden md:table-cell">
          {entry.account_code ? (
            <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
              {entry.account_code}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </td>
        {/* Charges (DR) */}
        <td className="px-4 py-3.5 tabular-nums text-sm font-semibold text-right">
          {n0(entry.charges) > 0 ? (
            <span className="text-rose-400">{fmt(entry.charges)}</span>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </td>
        {/* Credits (CR) */}
        <td className="px-4 py-3.5 tabular-nums text-sm font-semibold text-right">
          {n0(entry.credits) > 0 ? (
            <span className="text-emerald-400">{fmt(entry.credits)}</span>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </td>
        {/* Running Balance */}
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
        {/* Due date */}
        <td className="px-4 py-3.5 text-xs hidden lg:table-cell whitespace-nowrap">
          {isOverdueRow ? (
            <span className="text-rose-400 font-semibold">
              {fmtDate(entry.due_date)} ⚠
            </span>
          ) : (
            <span className="text-muted-foreground">
              {fmtDate(entry.due_date)}
            </span>
          )}
        </td>
        {/* Status */}
        <td className="px-4 py-3.5">
          <Badge className={`text-[9px] font-bold ${s.badge}`}>
            {entry.status}
          </Badge>
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

      {/* Expanded detail row */}
      <AnimatePresence>
        {expanded && (
          <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white/2"
          >
            <td colSpan={canEdit ? 10 : 9} className="px-6 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-[10px]">
                {[
                  {
                    label: "Entry Type",
                    value: entry.entry_type,
                  },
                  {
                    label: "Entry Date",
                    value: fmtDate(entry.entry_date),
                  },
                  {
                    label: "Due Date",
                    value: fmtDate(entry.due_date),
                  },
                  {
                    label: "Account Code",
                    value: entry.account_code || "—",
                  },
                  {
                    label: "Reference No.",
                    value: entry.reference_no || "—",
                  },
                  {
                    label: "Charges (DR)",
                    value: fmt(entry.charges),
                  },
                  {
                    label: "Credits (CR)",
                    value: fmt(entry.credits),
                  },
                  {
                    label: "Net Movement",
                    value: fmt(n0(entry.charges) - n0(entry.credits)),
                  },
                  {
                    label: "Running Balance",
                    value: fmt(entry.running_balance),
                  },
                  ...(entry.notes
                    ? [{ label: "Notes", value: entry.notes }]
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

// ─── STATEMENT VIEW ───────────────────────────────────────────────────────────
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
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<EntryStatus | "All">("All");
  const [filterType, setFilterType] = useState<EntryType | "All">("All");
  const [modal, setModal] = useState<null | "create" | "edit">(null);
  const [editing, setEditing] = useState<StatementEntry | null>(null);
  const [deleting, setDeleting] = useState<StatementEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const { toasts, push } = useToast();

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

  // After every mutation, re-run balance computation on the full list
  const refreshBalances = useCallback(
    (updated: StatementEntry[]) => {
      const sorted = [...updated].sort(
        (a, b) =>
          new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
      );
      setEntries(recomputeBalances(sorted));
    },
    []
  );

  const handleCreate = async (form: EntryFormData) => {
    setSaving(true);
    try {
      const row = await api.create({ ...form, project_id: project.id });
      const next = [...entries, row];
      refreshBalances(next);
      push("Entry added ✓");
      setModal(null);
    } catch (err: any) {
      push(err.message || "Failed to add entry", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: EntryFormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      const next = entries.map((e) => (e.id === editing.id ? row : e));
      refreshBalances(next);
      push("Entry updated ✓");
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
      const next = entries.filter((e) => e.id !== deleting.id);
      refreshBalances(next);
      push("Entry deleted");
      setDeleting(null);
    } catch (err: any) {
      push(err.message || "Failed to delete", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered + Search ──────────────────────────────────────────────────────
  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        const statusMatch = filterStatus === "All" || e.status === filterStatus;
        const typeMatch = filterType === "All" || e.entry_type === filterType;
        const searchMatch =
          !search ||
          e.description.toLowerCase().includes(search.toLowerCase()) ||
          (e.reference_no ?? "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (e.account_code ?? "")
            .toLowerCase()
            .includes(search.toLowerCase());
        return statusMatch && typeMatch && searchMatch;
      }),
    [entries, filterStatus, filterType, search]
  );

  // ── Summary Stats ──────────────────────────────────────────────────────────
  const totalCharges = entries.reduce((a, e) => a + n0(e.charges), 0);
  const totalCredits = entries.reduce((a, e) => a + n0(e.credits), 0);
  const closingBalance =
    entries.length > 0
      ? n0(entries[entries.length - 1].running_balance)
      : 0;
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

  const TABLE_HEADERS = [
    "Date",
    "Description",
    "Type",
    "Acc. Code",
    "Charges (DR)",
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
    "text-right",
    "text-right",
    "text-right",
    "text-left hidden lg:table-cell",
    "text-left",
    ...(canEdit ? ["text-left"] : []),
  ];

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
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors group"
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
          {/* Status pills */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ENTRY_STATUSES.map((st) => {
              const s = STATUS_STYLE[st];
              const count = entries.filter((e) => e.status === st).length;
              const isActive = filterStatus === st;
              return (
                <button
                  key={st}
                  onClick={() =>
                    setFilterStatus(isActive ? "All" : st)
                  }
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
            {/* Overdue count */}
            <div
              className={`rounded-2xl border p-4 ${
                overdueCount > 0
                  ? "border-rose-500/25 bg-rose-500/8"
                  : "border-white/8 bg-white/3"
              }`}
            >
              <div
                className={`text-[9px] uppercase tracking-widest font-black mb-1 ${
                  overdueCount > 0 ? "text-rose-400" : "text-muted-foreground"
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
            {/* Paid rate */}
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

          {/* Balance bar */}
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
                <p className="text-xs text-muted-foreground mt-0.5">
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

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3 pb-4">
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
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>
              <Select
                value={filterStatus}
                onChange={(v) => setFilterStatus(v as EntryStatus | "All")}
                options={[
                  { value: "All", label: "All Statuses" },
                  ...ENTRY_STATUSES.map((s) => ({ value: s, label: s })),
                ]}
              />
              <Select
                value={filterType}
                onChange={(v) => setFilterType(v as EntryType | "All")}
                options={[
                  { value: "All", label: "All Types" },
                  ...ENTRY_TYPES.map((t) => ({ value: t, label: t })),
                ]}
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-28 text-muted-foreground">
                <span className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-3" />
                Loading statement…
              </div>
            ) : filtered.length === 0 ? (
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
                <p className="text-sm">No statement entries yet</p>
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
              <div className="overflow-x-auto">
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
                        onEdit={() => {
                          setEditing(entry);
                          setModal("edit");
                        }}
                        onDelete={() => setDeleting(entry)}
                        isOverdueRow={isOverdue(entry.due_date, entry.status)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Closing Balance Footer */}
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
                      {
                        label: "Total Charges",
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
                        sub:
                          totalCharges - totalCredits > 0
                            ? "Owed"
                            : "Credit",
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
          key="statement"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.25 }}
        >
          <StatementView
            project={selectedProject}
            canEdit={canEdit}
            onBack={() => setSelectedProject(null)}
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