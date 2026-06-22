"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
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

type TransactionType =
  | "Invoice"
  | "Payment"
  | "Credit Note"
  | "Debit Note"
  | "Journal"
  | "Receipt";

type DeductionCategory = "Statutory" | "Contractual" | "Voluntary" | "Penalty";
type DeductionType = "PAYE" | "WHT" | "VAT" | "NSSF" | "SHIF" | "AHL" | "Other";

interface TaxEntry {
  id: number;
  project_id: string;
  date: string;
  counter_party: string;
  kra_pin: string | null;
  transaction_type: TransactionType;
  ref_number: string | null;
  description: string;
  tax_period: string;
  gross_amount: number;
  vat_rate: number;
  vat: number;
  output_vat: number;
  input_vat: number;
  net_amount: number;
  retention_percentage: number;
  retention_amount: number;
  wht_rate: number;
  wht_amount: number;
  paye: number;
  nssf: number;
  shif: number;
  housing_levy: number;
  deduction_category: DeductionCategory;
  allowable_deduction: boolean;
  deduction_type: DeductionType;
  is_asset: boolean;
  capital_allowance: number;
  cash_in: number;
  cash_out: number;
  running_balance: number;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

type TaxFormData = Omit<TaxEntry, "id" | "created_at" | "updated_at">;

interface Props {
  projectId?: string;
  canEdit?: boolean;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CURRENCY = "KES";

const TRANSACTION_TYPES: TransactionType[] = [
  "Invoice", "Payment", "Credit Note", "Debit Note", "Journal", "Receipt",
];
const DEDUCTION_CATEGORIES: DeductionCategory[] = [
  "Statutory", "Contractual", "Voluntary", "Penalty",
];
const DEDUCTION_TYPES: DeductionType[] = [
  "PAYE", "WHT", "VAT", "NSSF", "SHIF", "AHL", "Other",
];

const KE_VAT_RATE = 16;

// All preset periods shown in the dropdown.
// If the user needs a period not here, they pick "Other…" and type freely.
const PRESET_PERIODS = [
  "2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4",
  "2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4",
  "2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4",
];

const TX_TYPE_STYLE: Record<TransactionType, { color: string; bg: string }> = {
  Invoice:       { color: "text-violet-300",  bg: "bg-violet-500/10 border-violet-500/25"  },
  Payment:       { color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/25"},
  "Credit Note": { color: "text-sky-300",     bg: "bg-sky-500/10 border-sky-500/25"        },
  "Debit Note":  { color: "text-orange-300",  bg: "bg-orange-500/10 border-orange-500/25"  },
  Journal:       { color: "text-pink-300",    bg: "bg-pink-500/10 border-pink-500/25"      },
  Receipt:       { color: "text-teal-300",    bg: "bg-teal-500/10 border-teal-500/25"      },
};

const PROJECT_STATUS_STYLE: Record<string, string> = {
  planning:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  on_hold:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

// ─── TAX CALCULATOR ───────────────────────────────────────────────────────────
interface TaxCalcResult {
  vat: number;
  output_vat: number;
  input_vat: number;
  net_amount: number;
  wht_amount: number;
  retention_amount: number;
  cash_in: number;
  cash_out: number;
}

function calculateTaxFields(
  grossAmount: number,
  vatRate: number,
  whtRate: number,
  retentionPct: number,
  transactionType: TransactionType,
): TaxCalcResult {
  const gross = Math.max(grossAmount, 0);
  const vatR  = Math.max(vatRate, 0);
  const whtR  = Math.max(whtRate, 0);
  const retR  = Math.max(retentionPct, 0);

  const vat       = +(gross - gross / (1 + vatR / 100)).toFixed(2);
  const netAmount = +(gross - vat).toFixed(2);

  const isIncoming = ["Invoice", "Debit Note", "Journal"].includes(transactionType);
  const outputVat  = isIncoming ? vat : 0;
  const inputVat   = isIncoming ? 0 : vat;

  const whtAmount       = +(netAmount * whtR / 100).toFixed(2);
  const retentionAmount = +(gross * retR / 100).toFixed(2);

  let cashIn = 0, cashOut = 0;
  if (["Invoice", "Debit Note"].includes(transactionType)) {
    cashIn  = +(netAmount - whtAmount - retentionAmount).toFixed(2);
  } else if (["Payment", "Receipt", "Credit Note"].includes(transactionType)) {
    cashOut = netAmount;
  } else {
    cashIn  = netAmount >= 0 ? netAmount : 0;
    cashOut = netAmount < 0  ? Math.abs(netAmount) : 0;
  }

  return {
    vat,
    output_vat:       outputVat,
    input_vat:        inputVat,
    net_amount:       netAmount,
    wht_amount:       whtAmount,
    retention_amount: retentionAmount,
    cash_in:          Math.max(cashIn, 0),
    cash_out:         Math.max(cashOut, 0),
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const n0 = (v: number | null | undefined): number =>
  typeof v === "number" && isFinite(v) ? v : 0;

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency", currency: CURRENCY,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(typeof n === "number" && isFinite(n) ? n : 0);

const fmtC = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-KE", {
    notation: "compact", maximumFractionDigits: 1,
  }).format(typeof n === "number" && isFinite(n) ? n : 0);

const fmtPct = (n: number | null | undefined) =>
  `${n0(n).toFixed(n0(n) % 1 === 0 ? 0 : 2)}%`;

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-KE", {
    day: "2-digit", month: "short", year: "numeric",
  }) : "—";

function sanitizeEntry(raw: TaxEntry): TaxEntry {
  return {
    ...raw,
    gross_amount:         n0(raw.gross_amount),
    vat_rate:             n0(raw.vat_rate) || KE_VAT_RATE,
    vat:                  n0(raw.vat),
    output_vat:           n0(raw.output_vat),
    input_vat:            n0(raw.input_vat),
    net_amount:           n0(raw.net_amount),
    retention_percentage: n0(raw.retention_percentage),
    retention_amount:     n0(raw.retention_amount),
    wht_rate:             n0(raw.wht_rate),
    wht_amount:           n0(raw.wht_amount),
    paye:                 n0(raw.paye),
    nssf:                 n0(raw.nssf),
    shif:                 n0(raw.shif),
    housing_levy:         n0(raw.housing_levy),
    capital_allowance:    n0(raw.capital_allowance),
    cash_in:              n0(raw.cash_in),
    cash_out:             n0(raw.cash_out),
    running_balance:      n0(raw.running_balance),
    allowable_deduction:  Boolean(raw.allowable_deduction),
    is_asset:             Boolean(raw.is_asset),
  };
}

function recomputeBalances(entries: TaxEntry[]): TaxEntry[] {
  let balance = 0;
  return entries.map((e) => {
    balance = +(balance + n0(e.cash_in) - n0(e.cash_out)).toFixed(2);
    return { ...e, running_balance: balance };
  });
}

const makeEmptyForm = (projectId: string): TaxFormData => ({
  project_id:           projectId,
  date:                 new Date().toISOString().slice(0, 10),
  counter_party:        "",
  kra_pin:              null,
  transaction_type:     "Invoice",
  ref_number:           null,
  description:          "",
  tax_period:           "2026-Q1",
  gross_amount:         0,
  vat_rate:             KE_VAT_RATE,
  vat:                  0,
  output_vat:           0,
  input_vat:            0,
  net_amount:           0,
  retention_percentage: 0,
  retention_amount:     0,
  wht_rate:             0,
  wht_amount:           0,
  paye:                 0,
  nssf:                 0,
  shif:                 0,
  housing_levy:         0,
  deduction_category:   "Statutory",
  allowable_deduction:  true,
  deduction_type:       "VAT",
  is_asset:             false,
  capital_allowance:    0,
  cash_in:              0,
  cash_out:             0,
  running_balance:      0,
  notes:                null,
});

// ─── API ──────────────────────────────────────────────────────────────────────
function toWritable(form: TaxFormData): TaxFormData {
  const {
    project_id, date, counter_party, kra_pin, transaction_type,
    ref_number, description, tax_period, gross_amount, vat_rate, vat,
    output_vat, input_vat, net_amount, retention_percentage, retention_amount,
    wht_rate, wht_amount, paye, nssf, shif, housing_levy,
    deduction_category, allowable_deduction, deduction_type,
    is_asset, capital_allowance, cash_in, cash_out, running_balance, notes,
  } = form;
  return {
    project_id, date, counter_party, kra_pin, transaction_type,
    ref_number, description, tax_period, gross_amount, vat_rate, vat,
    output_vat, input_vat, net_amount, retention_percentage, retention_amount,
    wht_rate, wht_amount, paye, nssf, shif, housing_levy,
    deduction_category, allowable_deduction, deduction_type,
    is_asset, capital_allowance, cash_in, cash_out, running_balance, notes,
  };
}

const api = {
  async projects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,currency,site_address,site_city,site_country,start_date,expected_completion_date,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Project[];
  },

  async list(projectId: string): Promise<TaxEntry[]> {
    const { data, error } = await supabase
      .from("tax_transactions")
      .select("*")
      .eq("project_id", projectId)
      .order("date", { ascending: true });
    if (error) throw new Error(error.message);
    return recomputeBalances(((data ?? []) as TaxEntry[]).map(sanitizeEntry));
  },

  async listAll(): Promise<TaxEntry[]> {
    const { data, error } = await supabase
      .from("tax_transactions")
      .select("*")
      .order("date", { ascending: true });
    if (error) throw new Error(error.message);
    return recomputeBalances(((data ?? []) as TaxEntry[]).map(sanitizeEntry));
  },

  async create(form: TaxFormData): Promise<TaxEntry> {
    const { data, error } = await supabase
      .from("tax_transactions")
      .insert([toWritable(form)])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return sanitizeEntry(data as TaxEntry);
  },

  async update(id: number, form: TaxFormData): Promise<TaxEntry> {
    const { data, error } = await supabase
      .from("tax_transactions")
      .update(toWritable(form))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return sanitizeEntry(data as TaxEntry);
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase.from("tax_transactions").delete().eq("id", id);
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

function Toasts({ toasts }: { toasts: { id: number; msg: string; type: "success" | "error" }[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id}
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-semibold border backdrop-blur-xl shadow-lg ${
              t.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/25 text-emerald-300"
                : "bg-rose-950/90 border-rose-500/25 text-rose-300"
            }`}>
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all [color-scheme:dark] [&>option]:bg-[hsl(var(--background))] [&>option]:text-foreground";

const selectCls =
  "px-4 py-2.5 rounded-xl text-sm border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all appearance-none pr-10 cursor-pointer " +
  "bg-[hsl(var(--background))] border-white/10 [&>option]:bg-[hsl(var(--background))] [&>option]:text-foreground [color-scheme:dark]";

function Field({ label, children, className = "", hint }: {
  label: string; children: React.ReactNode; className?: string; hint?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">{label}</label>
      {children}
      {hint && <span className="text-[9px] text-muted-foreground/60 leading-tight">{hint}</span>}
    </div>
  );
}

function SectionLabel({ label, dotColor, textColor, sub }: {
  label: string; dotColor: string; textColor: string; sub?: string;
}) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-1">
      <span className={`w-1.5 h-5 rounded-full ${dotColor} flex-shrink-0`} />
      <div>
        <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${textColor}`}>{label}</span>
        {sub && <span className="ml-2 text-[9px] text-muted-foreground/60 tracking-wide">{sub}</span>}
      </div>
      <div className="flex-1 h-px bg-white/8" />
    </div>
  );
}

// ─── TAX PERIOD PICKER ────────────────────────────────────────────────────────
// ★ FIX: This is a completely self-contained component.
//
// ROOT CAUSE of the original bug:
//   The parent EntryModal stored `customPeriodMode` as state. Every keystroke
//   called `set("tax_period", value)` which updated the parent form, which
//   triggered a re-render of EntryModal, which reset `customPeriodMode` via
//   its useEffect (because the new value wasn't in knownPeriods yet while
//   typing), causing the input to unmount/remount and lose focus.
//
// FIX:
//   We keep ALL custom-mode state (`mode` + `draft`) inside this component.
//   The parent only ever sees the final committed value via `onChange`.
//   The custom <input> is a plain uncontrolled-feel input driven by local
//   `draft` state — parent re-renders never touch it.
//   `onBlur` commits the draft to the parent. The "← Presets" button lets
//   the user switch back to the Select at any time.
// ─────────────────────────────────────────────────────────────────────────────
function TaxPeriodPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const isPreset        = PRESET_PERIODS.includes(value);
  const [mode, setMode] = useState<"preset" | "custom">(isPreset ? "preset" : "custom");
  // `draft` is purely local — never synced back from parent after initial mount
  const [draft, setDraft] = useState<string>(isPreset ? "" : value);
  const inputRef          = useRef<HTMLInputElement>(null);

  // If the parent externally resets value back to a preset (e.g. modal reopens)
  // sync mode. We intentionally do NOT run this on every `value` change to
  // avoid disrupting active typing.
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (prevValueRef.current !== value && PRESET_PERIODS.includes(value)) {
      setMode("preset");
      setDraft("");
    }
    prevValueRef.current = value;
  }, [value]);

  const switchToCustom = () => {
    setMode("custom");
    setDraft("");
    // Focus after the DOM updates
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const switchToPreset = () => {
    setMode("preset");
    setDraft("");
    // Revert parent to first preset so it's not stuck on a partial custom value
    if (!PRESET_PERIODS.includes(value)) {
      onChange("2026-Q1");
    }
  };

  const handleDraftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDraft(raw); // update local state immediately — no parent call here
  };

  const commitDraft = () => {
    // Commit on blur or Enter — trims & uppercases for KRA format
    const committed = draft.trim().toUpperCase();
    if (committed) {
      onChange(committed);
    } else if (!PRESET_PERIODS.includes(value)) {
      // Empty custom — revert to preset
      switchToPreset();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraft();
    }
  };

  if (mode === "preset") {
    return (
      <Select value={value} onValueChange={(v) => {
        if (v === "__other__") {
          switchToCustom();
        } else {
          onChange(v);
        }
      }}>
        <SelectTrigger className={inputCls}>
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          {PRESET_PERIODS.map((p) => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
          ))}
          {/* Divider */}
          <div className="h-px bg-white/10 my-1" />
          <SelectItem value="__other__">
            <span className="flex items-center gap-1.5 text-primary font-semibold">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Other / Custom period…
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // Custom mode — plain input, fully isolated from parent state
  return (
    <div className="flex gap-2">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={handleDraftChange}
        onBlur={commitDraft}
        onKeyDown={handleKeyDown}
        placeholder="e.g. 2027-Q1, 2026-07, Jan 2027"
        className={inputCls + " flex-1 font-mono tracking-wide"}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={switchToPreset}
        title="Back to preset periods list"
        className="flex-shrink-0 px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground border border-white/10 hover:bg-white/10 transition-all whitespace-nowrap"
      >
        ← Presets
      </button>
    </div>
  );
}

// ─── TAX BREAKDOWN PANEL ──────────────────────────────────────────────────────
function TaxBreakdownPanel({ form, calc }: { form: TaxFormData; calc: TaxCalcResult }) {
  const rows = [
    { label: "Gross Amount",                             value: form.gross_amount,         color: "text-foreground",  bg: "bg-foreground"  },
    { label: `VAT (${fmtPct(form.vat_rate)})`,           value: calc.vat,                  color: "text-amber-300",   bg: "bg-amber-500"   },
    { label: "Net Amount",                               value: calc.net_amount,            color: "text-sky-300",     bg: "bg-sky-500"     },
    { label: `WHT (${fmtPct(form.wht_rate)})`,           value: calc.wht_amount,           color: "text-rose-300",    bg: "bg-rose-500"    },
    { label: `Retention (${fmtPct(form.retention_percentage)})`, value: calc.retention_amount, color: "text-orange-300", bg: "bg-orange-500" },
    { label: "Cash In",                                  value: calc.cash_in,               color: "text-emerald-400", bg: "bg-emerald-500" },
    { label: "Cash Out",                                 value: calc.cash_out,              color: "text-rose-400",    bg: "bg-rose-600"    },
  ];
  const max = Math.max(form.gross_amount, 1);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/8">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Live Tax Breakdown</p>
        <p className="text-3xl font-black tabular-nums tracking-tighter text-foreground mt-1">{fmt(form.gross_amount)}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[9px] text-emerald-400 font-semibold">Cash In {fmt(calc.cash_in)}</span>
          <span className="text-[9px] text-rose-400 font-semibold">Cash Out {fmt(calc.cash_out)}</span>
        </div>
      </div>
      <div className="px-5 py-4 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-0.5">
              <span className={`text-[11px] font-semibold ${r.color}`}>{r.label}</span>
              <span className={`text-[11px] font-mono font-bold ${r.color}`}>{fmt(r.value)}</span>
            </div>
            <div className="h-1 bg-white/8 rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${r.bg} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((n0(r.value) / max) * 100, 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        ))}
      </div>
      {(calc.output_vat > 0 || calc.input_vat > 0) && (
        <div className="mx-5 mb-4 rounded-xl bg-amber-950/30 border border-amber-500/15 px-4 py-3 space-y-1.5 text-[10px]">
          <p className="font-bold uppercase tracking-widest text-amber-400 mb-2">VAT Position</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Output VAT (charged)</span>
            <span className="font-mono text-amber-300">{fmt(calc.output_vat)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Input VAT (claimable)</span>
            <span className="font-mono text-sky-300">{fmt(calc.input_vat)}</span>
          </div>
          <div className="border-t border-amber-500/20 pt-1.5 flex justify-between font-bold">
            <span className="text-amber-300">Net VAT payable to KRA</span>
            <span className="font-mono text-amber-300">{fmt(calc.output_vat - calc.input_vat)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ENTRY MODAL ──────────────────────────────────────────────────────────────
function EntryModal({ initial, onSave, onClose, loading }: {
  initial: TaxFormData & { id?: number };
  onSave: (d: TaxFormData) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<TaxFormData>({ ...initial });
  const isEdit = Boolean(initial.id);

  const set = <K extends keyof TaxFormData>(k: K, v: TaxFormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const calc = useMemo(() => calculateTaxFields(
    form.gross_amount, form.vat_rate, form.wht_rate,
    form.retention_percentage, form.transaction_type,
  ), [form.gross_amount, form.vat_rate, form.wht_rate, form.retention_percentage, form.transaction_type]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      vat:              calc.vat,
      output_vat:       calc.output_vat,
      input_vat:        calc.input_vat,
      net_amount:       calc.net_amount,
      wht_amount:       calc.wht_amount,
      retention_amount: calc.retention_amount,
      cash_in:          calc.cash_in,
      cash_out:         calc.cash_out,
    }));
  }, [calc]);

  const isValid = form.description.trim() !== "" && form.counter_party.trim() !== "" && form.gross_amount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <motion.div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-6xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl bg-[#0d0d0d]/95"
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <span className="text-base">🇰🇪</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">
                {isEdit ? "Edit Tax Transaction" : "New Tax Transaction"}
              </h2>
              <p className="text-[10px] text-muted-foreground">VAT · WHT · Retention auto-calculated per KRA 2026 rules</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-xl hover:bg-white/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-5 max-h-[76vh] overflow-y-auto">
          {/* LEFT — inputs */}
          <div className="lg:col-span-3 px-6 py-5 space-y-4 border-r border-white/8 overflow-y-auto">

            <SectionLabel label="Transaction Identity" dotColor="bg-sky-400" textColor="text-sky-400" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Counter Party *">
                <input value={form.counter_party} onChange={(e) => set("counter_party", e.target.value)}
                  placeholder="Company / Person name" className={inputCls} />
              </Field>
              <Field label="KRA PIN" hint="A123456789Z format">
                <input value={form.kra_pin ?? ""} onChange={(e) => set("kra_pin", e.target.value || null)}
                  placeholder="A123456789Z" className={inputCls} />
              </Field>
              <Field label="Description *" className="sm:col-span-2">
                <input value={form.description} onChange={(e) => set("description", e.target.value)}
                  placeholder="e.g. Invoice for site works Phase 1" className={inputCls} />
              </Field>
              <Field label="Transaction Type *">
                <Select value={form.transaction_type} onValueChange={v => set("transaction_type", v as TransactionType)}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reference No.">
                <input value={form.ref_number ?? ""} onChange={(e) => set("ref_number", e.target.value || null)}
                  placeholder="INV-001 / PAY-055" className={inputCls} />
              </Field>
              <Field label="Date *">
                <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
                  className={inputCls + " [color-scheme:dark]"} />
              </Field>

              {/*
               * ★ TAX PERIOD — uses self-contained TaxPeriodPicker.
               *   Selecting "Other / Custom period…" from the dropdown shows a
               *   plain text input. Typing is never interrupted because the
               *   local `draft` state lives entirely inside TaxPeriodPicker —
               *   parent re-renders do NOT unmount or reset the input.
               *   Press Enter or click away to commit the value to the form.
               */}
              <Field
                label="Tax Period *"
                hint='Choose a preset quarter or pick "Other…" to type any custom period'
                className="sm:col-span-2"
              >
                <TaxPeriodPicker
                  value={form.tax_period}
                  onChange={(v) => set("tax_period", v)}
                />
              </Field>
            </div>

            <SectionLabel label="Gross Amount & VAT" dotColor="bg-amber-400" textColor="text-amber-400" sub="Kenya VAT standard 16%" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Gross Amount (KES) *" hint="Tax-inclusive figure">
                <input type="number" step="0.01" min="0"
                  value={form.gross_amount === 0 ? "" : form.gross_amount}
                  onChange={(e) => set("gross_amount", parseFloat(e.target.value) || 0)}
                  placeholder="0.00" className={inputCls + " font-bold"} />
              </Field>
              <Field label="VAT Rate (%)" hint="Standard 16% or exempt 0%">
                <div className="flex gap-1 h-10 rounded-xl bg-white/5 border border-white/10 p-1">
                  {[0, 8, 16].map((r) => (
                    <button key={r} type="button" onClick={() => set("vat_rate", r)}
                      className={`flex-1 rounded-lg text-xs font-bold transition-all ${form.vat_rate === r ? "bg-amber-500 text-black shadow" : "hover:bg-white/10 text-muted-foreground"}`}>
                      {r}%
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Custom VAT Rate (%)">
                <input type="number" step="0.01" min="0" max="100" value={form.vat_rate}
                  onChange={(e) => set("vat_rate", parseFloat(e.target.value) || 0)}
                  className={inputCls} />
              </Field>
            </div>

            <SectionLabel label="WHT & Retention" dotColor="bg-rose-400" textColor="text-rose-400" sub="Deducted at source" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="WHT Rate (%)" hint="Prof. services 5% · Rent 30%">
                <div className="flex gap-1 h-10 rounded-xl bg-white/5 border border-white/10 p-1">
                  {[0, 3, 5, 10, 15, 30].map((r) => (
                    <button key={r} type="button" onClick={() => set("wht_rate", r)}
                      className={`flex-1 rounded-lg text-[9px] font-bold transition-all ${form.wht_rate === r ? "bg-rose-500 text-white shadow" : "hover:bg-white/10 text-muted-foreground"}`}>
                      {r}%
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Retention (%)" hint="Usually 5–10% of contract value">
                <div className="flex gap-1 h-10 rounded-xl bg-white/5 border border-white/10 p-1">
                  {[0, 5, 10, 15].map((r) => (
                    <button key={r} type="button" onClick={() => set("retention_percentage", r)}
                      className={`flex-1 rounded-lg text-xs font-bold transition-all ${form.retention_percentage === r ? "bg-orange-500 text-white shadow" : "hover:bg-white/10 text-muted-foreground"}`}>
                      {r}%
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <SectionLabel label="Statutory Deductions" dotColor="bg-violet-400" textColor="text-violet-400" sub="PAYE · NSSF · SHIF · AHL" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="PAYE (KES)">
                <input type="number" step="0.01" min="0" value={form.paye || ""}
                  onChange={(e) => set("paye", parseFloat(e.target.value) || 0)} placeholder="0.00" className={inputCls} />
              </Field>
              <Field label="NSSF (KES)">
                <input type="number" step="0.01" min="0" value={form.nssf || ""}
                  onChange={(e) => set("nssf", parseFloat(e.target.value) || 0)} placeholder="0.00" className={inputCls} />
              </Field>
              <Field label="SHIF (KES)" hint="Replaces NHIF">
                <input type="number" step="0.01" min="0" value={form.shif || ""}
                  onChange={(e) => set("shif", parseFloat(e.target.value) || 0)} placeholder="0.00" className={inputCls} />
              </Field>
              <Field label="Housing Levy (KES)">
                <input type="number" step="0.01" min="0" value={form.housing_levy || ""}
                  onChange={(e) => set("housing_levy", parseFloat(e.target.value) || 0)} placeholder="0.00" className={inputCls} />
              </Field>
            </div>

            <SectionLabel label="Deduction Classification" dotColor="bg-pink-400" textColor="text-pink-400" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Deduction Category">
                <Select value={form.deduction_category} onValueChange={v => set("deduction_category", v as DeductionCategory)}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEDUCTION_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Deduction Type">
                <Select value={form.deduction_type} onValueChange={v => set("deduction_type", v as DeductionType)}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEDUCTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Allowable Deduction">
                <div className="flex gap-2 h-10">
                  {[true, false].map((v) => (
                    <button key={String(v)} type="button" onClick={() => set("allowable_deduction", v)}
                      className={`flex-1 rounded-xl text-xs font-bold border transition-all ${form.allowable_deduction === v
                        ? v ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                            : "bg-rose-500/20 border-rose-500/40 text-rose-300"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"}`}>
                      {v ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <SectionLabel label="Capital & Asset" dotColor="bg-teal-400" textColor="text-teal-400" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Is Asset?">
                <div className="flex gap-2 h-10">
                  {[false, true].map((v) => (
                    <button key={String(v)} type="button" onClick={() => set("is_asset", v)}
                      className={`flex-1 rounded-xl text-xs font-bold border transition-all ${form.is_asset === v
                        ? "bg-teal-500/20 border-teal-500/40 text-teal-300"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"}`}>
                      {v ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Capital Allowance (KES)" hint="Annual wear & tear deduction">
                <input type="number" step="0.01" min="0" value={form.capital_allowance || ""}
                  onChange={(e) => set("capital_allowance", parseFloat(e.target.value) || 0)}
                  placeholder="0.00" className={inputCls} disabled={!form.is_asset} />
              </Field>
            </div>

            <Field label="Notes">
              <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)}
                rows={2} placeholder="Additional remarks…" className={inputCls + " resize-none"} />
            </Field>
          </div>

          {/* RIGHT — live preview */}
          <div className="lg:col-span-2 px-5 py-5 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Live Preview</p>
            <TaxBreakdownPanel form={form} calc={calc} />
            {(n0(form.paye) + n0(form.nssf) + n0(form.shif) + n0(form.housing_levy)) > 0 && (
              <div className="rounded-xl bg-violet-950/30 border border-violet-500/15 px-4 py-3 space-y-1.5 text-[10px]">
                <p className="font-bold uppercase tracking-widest text-violet-400 mb-2">Statutory Summary</p>
                {[
                  { label: "PAYE",         value: form.paye,         color: "text-rose-300"   },
                  { label: "NSSF",         value: form.nssf,         color: "text-blue-300"   },
                  { label: "SHIF",         value: form.shif,         color: "text-purple-300" },
                  { label: "Housing Levy", value: form.housing_levy, color: "text-amber-300"  },
                ].map((s) => s.value > 0 && (
                  <div key={s.label} className="flex justify-between">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className={`font-mono font-bold ${s.color}`}>{fmt(s.value)}</span>
                  </div>
                ))}
                <div className="border-t border-violet-500/20 pt-1.5 flex justify-between font-bold">
                  <span className="text-violet-300">Total Statutory</span>
                  <span className="font-mono text-violet-300">
                    {fmt(n0(form.paye) + n0(form.nssf) + n0(form.shif) + n0(form.housing_levy))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={loading || !isValid}
            className="px-6 py-2.5 text-sm font-bold rounded-2xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 flex items-center gap-2"
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
  entry: TaxEntry; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-2xl bg-[#0d0d0d]/95"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
      >
        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-1">Delete Tax Entry</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Permanently remove <span className="text-foreground font-semibold">{entry.description}</span>?
              Running balances will be recalculated. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm font-bold rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition-all disabled:opacity-50 flex items-center gap-2">
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Delete Entry
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── TAX TABLE ROW ────────────────────────────────────────────────────────────
function TaxRow({ entry, canEdit, onEdit, onDelete }: {
  entry: TaxEntry; canEdit: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const t       = TX_TYPE_STYLE[entry.transaction_type];
  const balance = n0(entry.running_balance);

  return (
    <>
      <motion.tr
        className="border-b border-white/8 cursor-pointer transition-colors hover:bg-white/4"
        onClick={() => setExpanded((x) => !x)}
      >
        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(entry.date)}</td>
        <td className="px-4 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground line-clamp-1">{entry.description}</span>
            <span className="text-[10px] text-muted-foreground">{entry.counter_party}</span>
          </div>
        </td>
        <td className="px-4 py-3.5 hidden sm:table-cell">
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${t.bg} ${t.color}`}>
            {entry.transaction_type}
          </span>
        </td>
        <td className="px-4 py-3.5 tabular-nums text-sm font-semibold text-right">{fmt(entry.gross_amount)}</td>
        <td className="px-4 py-3.5 tabular-nums text-xs text-amber-300 text-right hidden md:table-cell">{fmt(entry.vat)}</td>
        <td className="px-4 py-3.5 tabular-nums text-xs text-sky-300 text-right hidden md:table-cell">{fmt(entry.net_amount)}</td>
        <td className="px-4 py-3.5 tabular-nums text-xs text-rose-300 text-right hidden lg:table-cell">{fmt(entry.wht_amount)}</td>
        <td className="px-4 py-3.5 tabular-nums text-xs text-orange-300 text-right hidden lg:table-cell">{fmt(entry.retention_amount)}</td>
        <td className="px-4 py-3.5 tabular-nums text-xs text-emerald-400 text-right hidden xl:table-cell">{fmt(entry.cash_in)}</td>
        <td className="px-4 py-3.5 tabular-nums text-xs text-rose-400 text-right hidden xl:table-cell">{fmt(entry.cash_out)}</td>
        <td className="px-4 py-3.5 tabular-nums font-black text-sm text-right whitespace-nowrap">
          <span className={balance > 0 ? "text-emerald-400" : balance < 0 ? "text-rose-400" : "text-muted-foreground"}>
            {fmt(balance)}
          </span>
        </td>
        <td className="px-4 py-3.5 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">{entry.tax_period}</td>
        {canEdit && (
          <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-2">
              <button onClick={onEdit} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-white/8 font-medium">Edit</button>
              <button onClick={onDelete} className="text-xs text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 rounded-lg hover:bg-rose-500/10 font-medium">Del</button>
            </div>
          </td>
        )}
      </motion.tr>
      <AnimatePresence>
        {expanded && (
          <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white/2">
            <td colSpan={canEdit ? 13 : 12} className="px-6 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 text-[10px]">
                {[
                  { label: "KRA PIN",          value: entry.kra_pin || "—"                               },
                  { label: "Reference",         value: entry.ref_number || "—"                           },
                  { label: "VAT Rate",          value: fmtPct(entry.vat_rate)                            },
                  { label: "Output VAT",        value: fmt(entry.output_vat)                             },
                  { label: "Input VAT",         value: fmt(entry.input_vat)                              },
                  { label: "Net VAT to KRA",    value: fmt(n0(entry.output_vat) - n0(entry.input_vat))  },
                  { label: "WHT Rate",          value: fmtPct(entry.wht_rate)                            },
                  { label: "WHT Amount",        value: fmt(entry.wht_amount)                             },
                  { label: "Retention %",       value: fmtPct(entry.retention_percentage)                },
                  { label: "Retention Amount",  value: fmt(entry.retention_amount)                       },
                  { label: "PAYE",              value: fmt(entry.paye)                                   },
                  { label: "NSSF",              value: fmt(entry.nssf)                                   },
                  { label: "SHIF",              value: fmt(entry.shif)                                   },
                  { label: "Housing Levy",      value: fmt(entry.housing_levy)                           },
                  { label: "Ded. Category",     value: entry.deduction_category                          },
                  { label: "Ded. Type",         value: entry.deduction_type                              },
                  { label: "Allowable Ded.",    value: entry.allowable_deduction ? "Yes" : "No"          },
                  { label: "Is Asset",          value: entry.is_asset ? "Yes" : "No"                    },
                  { label: "Capital Allowance", value: fmt(entry.capital_allowance)                      },
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

// ─── REUSABLE TAX TABLE ───────────────────────────────────────────────────────
// Used by both TaxView (per-project) and GlobalTaxTable.
function TaxTable({
  entries, canEdit, fetching,
  onEdit, onDelete, onNew, emptyLabel = "No tax entries yet.",
}: {
  entries: TaxEntry[];
  canEdit: boolean;
  fetching: boolean;
  onEdit: (e: TaxEntry) => void;
  onDelete: (e: TaxEntry) => void;
  onNew: () => void;
  emptyLabel?: string;
}) {
  const [search, setSearch]           = useState("");
  const [filterType, setFilterType]   = useState<TransactionType | "All">("All");
  const [filterPeriod, setFilterPeriod] = useState<string>("All");

  const periods = useMemo(() =>
    Array.from(new Set(entries.map((e) => e.tax_period))).sort().reverse(),
    [entries]
  );

  const filtered = useMemo(() => entries.filter((e) => {
    const typeOk   = filterType   === "All" || e.transaction_type === filterType;
    const periodOk = filterPeriod === "All" || e.tax_period       === filterPeriod;
    const q        = search.toLowerCase();
    const textOk   = !search ||
      e.description.toLowerCase().includes(q) ||
      e.counter_party.toLowerCase().includes(q) ||
      (e.kra_pin ?? "").toLowerCase().includes(q) ||
      (e.ref_number ?? "").toLowerCase().includes(q);
    return typeOk && periodOk && textOk;
  }), [entries, filterType, filterPeriod, search]);

  const totalGross     = entries.reduce((a, e) => a + n0(e.gross_amount), 0);
  const totalVat       = entries.reduce((a, e) => a + n0(e.vat), 0);
  const totalOutputVat = entries.reduce((a, e) => a + n0(e.output_vat), 0);
  const totalInputVat  = entries.reduce((a, e) => a + n0(e.input_vat), 0);
  const totalNetVat    = totalOutputVat - totalInputVat;
  const totalWht       = entries.reduce((a, e) => a + n0(e.wht_amount), 0);
  const totalRetention = entries.reduce((a, e) => a + n0(e.retention_amount), 0);
  const totalCashIn    = entries.reduce((a, e) => a + n0(e.cash_in), 0);
  const closingBalance = entries.length > 0 ? n0(entries[entries.length - 1].running_balance) : 0;

  return (
    <>
      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3 px-5 py-4 border-b border-white/8">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, counterparty, KRA PIN or ref…"
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as TransactionType | "All")}
          className={selectCls}>
          <option value="All">All Types</option>
          {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)}
          className={selectCls}>
          <option value="All">All Periods</option>
          {periods.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Table body */}
      {fetching ? (
        <div className="flex items-center justify-center py-28 text-muted-foreground">
          <span className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-3" />
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-muted-foreground gap-3">
          <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
          </svg>
          <p className="text-sm">{emptyLabel}</p>
          {canEdit && <button onClick={onNew} className="text-sm text-primary hover:underline">Add the first entry →</button>}
        </div>
      ) : (
        <>
        {/* Mobile card list — no horizontal scroll */}
        <div className="md:hidden divide-y divide-white/8">
          {filtered.map((entry) => {
            const meta = [
              { label: "Date",      node: fmtDate(entry.date) },
              { label: "KRA PIN",   node: entry.kra_pin || "—" },
              { label: "Type",      node: entry.transaction_type },
              { label: "VAT",       node: fmt(Number(entry.vat)) },
              { label: "WHT",       node: fmt(Number(entry.wht_amount)) },
              { label: "Retention", node: fmt(Number(entry.retention_amount)) },
              { label: "Cash In",   node: fmt(Number(entry.cash_in)) },
              { label: "Cash Out",  node: fmt(Number(entry.cash_out)) },
              { label: "Period",    node: entry.tax_period },
            ];
            return (
              <div key={entry.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{entry.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.counter_party}{entry.ref_number ? ` · ${entry.ref_number}` : ""}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground shrink-0">{entry.transaction_type}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { l: "Gross",   v: fmt(Number(entry.gross_amount)),    c: "text-foreground" },
                    { l: "Net",     v: fmt(Number(entry.net_amount)),      c: "text-foreground" },
                    { l: "Balance", v: fmt(Number(entry.running_balance)), c: "text-primary" },
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
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-white/8 bg-white/3">
                {[
                  { h: "Date",               cls: "text-left" },
                  { h: "Description / Party",cls: "text-left" },
                  { h: "Type",               cls: "text-left hidden sm:table-cell" },
                  { h: "Gross",              cls: "text-right" },
                  { h: "VAT",                cls: "text-right hidden md:table-cell" },
                  { h: "Net",                cls: "text-right hidden md:table-cell" },
                  { h: "WHT",                cls: "text-right hidden lg:table-cell" },
                  { h: "Retention",          cls: "text-right hidden lg:table-cell" },
                  { h: "Cash In",            cls: "text-right hidden xl:table-cell" },
                  { h: "Cash Out",           cls: "text-right hidden xl:table-cell" },
                  { h: "Balance",            cls: "text-right" },
                  { h: "Period",             cls: "text-left hidden sm:table-cell" },
                  ...(canEdit ? [{ h: "Actions", cls: "text-left" }] : []),
                ].map(({ h, cls }) => (
                  <th key={h} className={`px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap ${cls}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <TaxRow key={entry.id} entry={entry} canEdit={canEdit}
                  onEdit={() => onEdit(entry)}
                  onDelete={() => onDelete(entry)} />
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Footer totals */}
      {entries.length > 0 && (
        <div className="border-t border-white/12 bg-white/3 px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Totals — {entries.length} entries
            </span>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold ml-auto">
              {filtered.length} shown
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: "Gross",         value: totalGross,     color: "text-foreground" },
              { label: "VAT",           value: totalVat,       color: "text-amber-300"  },
              { label: "Net VAT→KRA",   value: totalNetVat,    color: totalNetVat > 0 ? "text-rose-400" : "text-emerald-400" },
              { label: "WHT",           value: totalWht,       color: "text-rose-300"   },
              { label: "Cash In",       value: totalCashIn,    color: "text-emerald-400"},
              { label: "Closing Bal.",  value: closingBalance, color: closingBalance > 0 ? "text-emerald-400" : "text-rose-400" },
            ].map((item) => (
              <div key={item.label} className="bg-white/4 rounded-xl p-3 border border-white/8">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 font-bold">{item.label}</p>
                <p className={`text-sm font-black tabular-nums tracking-tight ${item.color}`}>{fmt(item.value)}</p>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground/50 mt-3">
            Output VAT {fmt(totalOutputVat)} · Input VAT {fmt(totalInputVat)} · Net VAT payable to KRA {fmt(totalNetVat)} · Retention held {fmt(totalRetention)} · KRA compliant 2026
          </p>
        </div>
      )}
    </>
  );
}

// ─── PROJECT CARD ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onSelect, summary }: {
  project: Project;
  onSelect: (p: Project) => void;
  summary: { total: number; vat_total: number; wht_total: number };
}) {
  const status    = project.status ?? "planning";
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
        {summary.total > 0 && (
          <span className="text-[9px] bg-white/5 border border-white/10 text-muted-foreground px-2 py-0.5 rounded-full tabular-nums flex-shrink-0">
            {summary.total} entries
          </span>
        )}
      </div>

      <h3 className="font-bold text-foreground text-sm mb-1.5 group-hover:text-primary transition-colors line-clamp-1">{project.title}</h3>
      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{project.description}</p>
      )}

      {summary.total > 0 && (
        <div className="flex gap-3 mb-3">
          <div className="flex-1 rounded-xl bg-amber-500/8 border border-amber-500/15 px-3 py-2">
            <p className="text-[9px] text-amber-400/70 font-bold uppercase tracking-wider">VAT</p>
            <p className="text-xs font-mono font-black text-amber-300">KES {fmtC(summary.vat_total)}</p>
          </div>
          <div className="flex-1 rounded-xl bg-rose-500/8 border border-rose-500/15 px-3 py-2">
            <p className="text-[9px] text-rose-400/70 font-bold uppercase tracking-wider">WHT</p>
            <p className="text-xs font-mono font-black text-rose-300">KES {fmtC(summary.wht_total)}</p>
          </div>
        </div>
      )}

      {project.progress_percent != null && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Progress</span>
            <span className="text-[10px] font-mono font-bold text-primary">{project.progress_percent}%</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              initial={{ width: 0 }} animate={{ width: `${project.progress_percent}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
        Open Tax Register →
      </div>
    </motion.button>
  );
}

// ─── PER-PROJECT TAX VIEW ─────────────────────────────────────────────────────
function TaxView({ project, canEdit, onBack }: {
  project: Project; canEdit: boolean; onBack: () => void;
}) {
  const [entries, setEntries]   = useState<TaxEntry[]>([]);
  const [fetching, setFetching] = useState(false);
  const [modal, setModal]       = useState<null | "create" | "edit">(null);
  const [editing, setEditing]   = useState<TaxEntry | null>(null);
  const [deleting, setDeleting] = useState<TaxEntry | null>(null);
  const [saving, setSaving]     = useState(false);
  const { toasts, push }        = useToast();

  const fetchEntries = useCallback(async () => {
    setFetching(true);
    try { setEntries(await api.list(project.id)); }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed to load", "error"); }
    finally { setFetching(false); }
  }, [project.id, push]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const refresh = useCallback((rows: TaxEntry[]) => {
    setEntries(recomputeBalances([...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())));
  }, []);

  const handleCreate = async (form: TaxFormData) => {
    setSaving(true);
    try {
      const row = await api.create({ ...form, project_id: project.id });
      refresh([...entries, row]);
      push("Entry added ✓"); setModal(null);
    } catch (err: unknown) { push(err instanceof Error ? err.message : "Failed", "error"); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (form: TaxFormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      refresh(entries.map((e) => (e.id === editing.id ? row : e)));
      push("Entry updated ✓"); setModal(null); setEditing(null);
    } catch (err: unknown) { push(err instanceof Error ? err.message : "Failed", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      refresh(entries.filter((e) => e.id !== deleting.id));
      push("Entry deleted"); setDeleting(null);
    } catch (err: unknown) { push(err instanceof Error ? err.message : "Failed", "error"); }
    finally { setSaving(false); }
  };

  // Summary stats
  const totalGross     = entries.reduce((a, e) => a + n0(e.gross_amount), 0);
  const totalVat       = entries.reduce((a, e) => a + n0(e.vat), 0);
  const totalOutputVat = entries.reduce((a, e) => a + n0(e.output_vat), 0);
  const totalInputVat  = entries.reduce((a, e) => a + n0(e.input_vat), 0);
  const totalNetVat    = totalOutputVat - totalInputVat;
  const totalWht       = entries.reduce((a, e) => a + n0(e.wht_amount), 0);
  const totalRetention = entries.reduce((a, e) => a + n0(e.retention_amount), 0);
  const totalPaye      = entries.reduce((a, e) => a + n0(e.paye), 0);
  const totalNssf      = entries.reduce((a, e) => a + n0(e.nssf), 0);
  const totalShif      = entries.reduce((a, e) => a + n0(e.shif), 0);
  const totalAhl       = entries.reduce((a, e) => a + n0(e.housing_levy), 0);
  const closingBalance = entries.length > 0 ? n0(entries[entries.length - 1].running_balance) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Toasts toasts={toasts} />

      <AnimatePresence>
        {modal === "create" && (
          <EntryModal initial={makeEmptyForm(project.id)} onSave={handleCreate} onClose={() => setModal(null)} loading={saving} />
        )}
        {modal === "edit" && editing && (
          <EntryModal initial={{ ...editing }} onSave={handleUpdate} onClose={() => { setModal(null); setEditing(null); }} loading={saving} />
        )}
        {deleting && (
          <DeleteConfirm entry={deleting} onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={saving} />
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-10 max-w-[1400px]">
        {/* Back button */}
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors group">
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          All Projects
        </button>

        {/* Project header */}
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

        {/* KRA summary grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
          {[
            { label: "Total Gross",    value: totalGross,     color: "text-foreground"    },
            { label: "Total VAT",      value: totalVat,       color: "text-amber-400"     },
            { label: "Output VAT",     value: totalOutputVat, color: "text-amber-300"     },
            { label: "Input VAT",      value: totalInputVat,  color: "text-sky-300"       },
            { label: "Net VAT to KRA", value: totalNetVat,    color: totalNetVat > 0 ? "text-rose-400" : "text-emerald-400" },
            { label: "WHT",            value: totalWht,       color: "text-rose-300"      },
            { label: "Retention",      value: totalRetention, color: "text-orange-300"    },
            { label: "Closing Bal.",   value: closingBalance, color: closingBalance > 0 ? "text-emerald-400" : "text-rose-400" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/8 bg-white/3 p-4">
              <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-1">{item.label}</div>
              <div className={`text-base sm:text-lg font-black tabular-nums tracking-tight ${item.color}`}>
                KES {fmtC(item.value)}
              </div>
            </div>
          ))}
        </div>

        {/* Statutory row */}
        {(totalPaye + totalNssf + totalShif + totalAhl) > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "PAYE",         value: totalPaye, color: "text-rose-300"   },
              { label: "NSSF",         value: totalNssf, color: "text-blue-300"   },
              { label: "SHIF",         value: totalShif, color: "text-purple-300" },
              { label: "Housing Levy", value: totalAhl,  color: "text-amber-300"  },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-violet-500/15 bg-violet-500/5 p-4">
                <div className="text-[9px] uppercase tracking-widest font-black text-violet-400/70 mb-1">{item.label}</div>
                <div className={`text-base font-black tabular-nums tracking-tight ${item.color}`}>{fmt(item.value)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Main card */}
        <Card className="backdrop-blur-xl bg-white/5 border border-white/12 rounded-2xl shadow-xl overflow-hidden">
          <CardHeader className="pb-0 border-b border-white/8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5">
              <div>
                <CardTitle className="text-2xl font-black">
                  Tax Register — {project.project_number}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click any row to expand full detail · Cash flow balance auto-computed
                </p>
              </div>
              {canEdit && (
                <button onClick={() => setModal("create")}
                  className="flex-shrink-0 px-5 py-2.5 rounded-2xl font-bold text-sm text-primary-foreground flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                  style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New Entry
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <TaxTable
              entries={entries}
              canEdit={canEdit}
              fetching={fetching}
              onEdit={(e) => { setEditing(e); setModal("edit"); }}
              onDelete={setDeleting}
              onNew={() => setModal("create")}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── PROJECT PICKER VIEW ──────────────────────────────────────────────────────
function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects, setProjects]         = useState<Project[]>([]);
  const [fetching, setFetching]         = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [summaries, setSummaries]       = useState<Record<string, { total: number; vat_total: number; wht_total: number }>>({});
  const { toasts, push }               = useToast();

  useEffect(() => {
    api.projects()
      .then(async (data) => {
        setProjects(data);
        if (data.length) {
          const ids = data.map((p) => p.id);
          const { data: rows } = await supabase
            .from("tax_transactions")
            .select("project_id,vat,wht_amount")
            .in("project_id", ids);
          if (rows) {
            const tally: Record<string, { total: number; vat_total: number; wht_total: number }> = {};
            (rows as { project_id: string; vat: number; wht_amount: number }[]).forEach((r) => {
              if (!tally[r.project_id]) tally[r.project_id] = { total: 0, vat_total: 0, wht_total: 0 };
              tally[r.project_id].total++;
              tally[r.project_id].vat_total += n0(r.vat);
              tally[r.project_id].wht_total += n0(r.wht_amount);
            });
            setSummaries(tally);
          }
        }
      })
      .catch((err: unknown) => push(err instanceof Error ? err.message : "Failed to load projects", "error"))
      .finally(() => setFetching(false));
  }, [push]);

  const filtered = useMemo(() =>
    projects.filter((p) => {
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchSearch = !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.project_number.toLowerCase().includes(search.toLowerCase()) ||
        (p.site_city ?? "").toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    }),
    [projects, search, statusFilter]
  );

  const totalEntries = Object.values(summaries).reduce((a, c) => a + c.total, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Toasts toasts={toasts} />
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 font-bold flex items-center gap-2">
                <span className="text-base">🇰🇪</span>
                KRA TAX REGISTER · VAT · WHT · PAYE · 2026
              </p>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black leading-none tracking-tighter">
                Tax{" "}
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Tracking
                </span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground mt-3 max-w-xl">
                Full KRA-compliant tax ledger VAT, WHT, Retention, PAYE, NSSF, SHIF & AHL auto-calculated.
                Select a project below to open its dedicated tax register.
              </p>
            </div>
            {totalEntries > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center min-w-[80px]">
                <p className="text-2xl font-black tabular-nums text-foreground">{totalEntries}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Total Entries</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects…"
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className={selectCls}>
            <option value="all">All Statuses</option>
            {Array.from(new Set(projects.map((p) => p.status ?? "planning"))).map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ").toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* Project grid */}
        {fetching ? (
          <div className="flex items-center justify-center py-32 text-muted-foreground">
            <span className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-3" />
            Loading projects…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 text-muted-foreground">No projects found.</div>
        ) : (
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16"
            initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } }, hidden: {} }}>
            {filtered.map((p) => (
              <motion.div key={p.id} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
                <ProjectCard project={p} onSelect={onSelect}
                  summary={summaries[p.id] ?? { total: 0, vat_total: 0, wht_total: 0 }} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── GLOBAL TAX TABLE ─────────────────────────────────────────────────────────
type GlobalTab = "consolidated" | "firm-wide";

function GlobalTaxTable({ canEdit }: { canEdit: boolean }) {
  const [allEntries, setAllEntries] = useState<TaxEntry[]>([]);
  const [fetching, setFetching]     = useState(false);
  const [activeTab, setActiveTab]   = useState<GlobalTab>("consolidated");
  const [deleting, setDeleting]     = useState<TaxEntry | null>(null);
  const [saving, setSaving]         = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<TaxEntry | null>(null);
  const { toasts, push }            = useToast();

  const fetchAll = useCallback(async () => {
    setFetching(true);
    try { setAllEntries(await api.listAll()); }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed to load", "error"); }
    finally { setFetching(false); }
  }, [push]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async (form: TaxFormData) => {
    setSaving(true);
    try {
      const row = await api.create(form);
      setAllEntries((prev) => recomputeBalances([...prev, row]));
      push("Entry added ✓"); setShowModal(false);
    } catch (err: unknown) { push(err instanceof Error ? err.message : "Failed", "error"); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (form: TaxFormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      setAllEntries((prev) => recomputeBalances(prev.map((e) => (e.id === editing.id ? row : e))));
      push("Entry updated ✓"); setShowModal(false); setEditing(null);
    } catch (err: unknown) { push(err instanceof Error ? err.message : "Failed", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      setAllEntries((prev) => recomputeBalances(prev.filter((e) => e.id !== deleting.id)));
      push("Entry deleted"); setDeleting(null);
    } catch (err: unknown) { push(err instanceof Error ? err.message : "Failed", "error"); }
    finally { setSaving(false); }
  };

  const displayEntries = useMemo(
    () => activeTab === "firm-wide" ? allEntries.filter((e) => !e.project_id) : allEntries,
    [allEntries, activeTab]
  );

  const totalGross  = displayEntries.reduce((a, e) => a + n0(e.gross_amount), 0);
  const totalVat    = displayEntries.reduce((a, e) => a + n0(e.vat), 0);
  const totalNetVat = displayEntries.reduce((a, e) => a + n0(e.output_vat) - n0(e.input_vat), 0);
  const totalWht    = displayEntries.reduce((a, e) => a + n0(e.wht_amount), 0);

  const tabs: { key: GlobalTab; label: string; count: number; desc: string }[] = [
    { key: "consolidated", label: "Consolidated",   count: allEntries.length,                              desc: "All tax entries across every project + firm-wide" },
    { key: "firm-wide",    label: "Firm-wide Only", count: allEntries.filter((e) => !e.project_id).length, desc: "Entries not linked to any specific project"        },
  ];

  return (
    <div className="container mx-auto px-4 pb-20 max-w-[1400px]">
      <Toasts toasts={toasts} />

      <AnimatePresence>
        {showModal && !editing && (
          <EntryModal initial={makeEmptyForm("")} onSave={handleCreate} onClose={() => setShowModal(false)} loading={saving} />
        )}
        {showModal && editing && (
          <EntryModal initial={{ ...editing }} onSave={handleUpdate} onClose={() => { setShowModal(false); setEditing(null); }} loading={saving} />
        )}
        {deleting && (
          <DeleteConfirm entry={deleting} onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={saving} />
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground px-2">Firm Overview</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-2">
          Consolidated{" "}
          <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Tax Register
          </span>
        </h2>
        <p className="text-center text-sm font-normal text-muted-foreground max-w-xl mx-auto">
          Auto-generated from all tax entries across every project and firm-wide accounts.
        </p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Gross",    value: totalGross,  color: "text-foreground" },
          { label: "Total VAT",      value: totalVat,    color: "text-amber-400"  },
          { label: "Net VAT to KRA", value: totalNetVat, color: totalNetVat > 0 ? "text-rose-400" : "text-emerald-400" },
          { label: "WHT",            value: totalWht,    color: "text-rose-300"   },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/8 bg-white/3 p-4">
            <div className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-1">{item.label}</div>
            <div className={`text-base sm:text-lg font-black tabular-nums tracking-tight ${item.color}`}>KES {fmtC(item.value)}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit mb-1">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium tracking-normal transition-all ${activeTab === tab.key ? "bg-white/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {tab.label}
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full tabular-nums ${activeTab === tab.key ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs font-normal text-muted-foreground mb-6">{tabs.find((t) => t.key === activeTab)?.desc}</p>

      <Card className="backdrop-blur-xl bg-white/5 border border-white/12 rounded-2xl shadow-xl overflow-hidden">
        <CardHeader className="pb-0 border-b border-white/8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5">
            <div>
              <CardTitle className="text-2xl font-black">Tax Register</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Click any row to expand full detail · Cash flow balance auto-computed</p>
            </div>
            {canEdit && (
              <button onClick={() => { setEditing(null); setShowModal(true); }}
                className="flex-shrink-0 px-5 py-2.5 rounded-2xl font-bold text-sm text-primary-foreground flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Entry
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <TaxTable
            entries={displayEntries}
            canEdit={canEdit}
            fetching={fetching}
            onEdit={(e) => { setEditing(e); setShowModal(true); }}
            onDelete={setDeleting}
            onNew={() => { setEditing(null); setShowModal(true); }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function TaxesPage({ projectId, canEdit = true }: Props) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [view, setView] = useState<"picker" | "project" | "global">(
    projectId ? "project" : "picker"
  );

  useEffect(() => {
    if (projectId) {
      supabase.from("projects").select("*").eq("id", projectId).single()
        .then(({ data }) => { if (data) { setSelectedProject(data as Project); setView("project"); } });
    }
  }, [projectId]);

  return (
    <AnimatePresence mode="wait">
      {view === "project" && selectedProject ? (
        <motion.div key={selectedProject.id}
          initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
          <TaxView
            project={selectedProject}
            canEdit={canEdit}
            onBack={() => {
              if (projectId) return; // embedded usage — no back nav
              setSelectedProject(null);
              setView("picker");
            }}
          />
        </motion.div>
      ) : view === "global" ? (
        <motion.div key="global"
          initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
          <GlobalTaxTable canEdit={canEdit} />
        </motion.div>
      ) : (
        <motion.div key="picker"
          initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }} transition={{ duration: 0.25 }}>
          {/* Project picker + consolidated table below it */}
          <div>
            <ProjectPickerView onSelect={(p) => { setSelectedProject(p); setView("project"); }} />
            <GlobalTaxTable canEdit={canEdit} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}