"use client";
import React from "react";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";

// ─── DATABASE MIGRATION NOTE ──────────────────────────────────────────────────
// To support global (unlinked) entries, run this once in your Supabase SQL editor:
//
//   ALTER TABLE balance_sheet_entries
//     ALTER COLUMN project_id DROP NOT NULL;
//
// This allows balance sheet entries that belong to the firm as a whole rather
// than any specific project (e.g. corporate equity, firm-wide liabilities, etc.).
// ─────────────────────────────────────────────────────────────────────────────

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

type EntryType     = "Asset" | "Liability" | "Equity";
type AssetType     = "Current Asset" | "Non-Current Asset" | "Fixed Asset" | "Other Asset";
type LiabilityType = "Current Liability" | "Non-Current Liability" | "Long-term Liability";
type EquityType    = "Owner's Equity" | "Retained Earnings" | "Owner's Capital" | "Shareholder Equity";

interface BalanceSheetEntry {
  id:             number;
  project_id:     string | null;
  entry_type:     EntryType;
  asset_type:     AssetType     | null;
  liability_type: LiabilityType | null;
  equity_type:    EquityType    | null;
  account_name:   string;
  description:    string | null;
  amount:         number;
  entry_date:     string;
  reference_code: string | null;
  notes:          string | null;
  created_at?:    string;
  updated_at?:    string;
}

type BSFormData = Omit<BalanceSheetEntry, "id" | "created_at" | "updated_at">;

interface Props {
  projectId?: string;
  canEdit?:   boolean;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ENTRY_TYPES: EntryType[] = ["Asset", "Liability", "Equity"];

// Sub-types align with the Chart of Accounts subcategories so the account
// dropdown can be filtered correctly. Older values ("Fixed Asset",
// "Long-term Liability", "Owner's Capital", "Shareholder Equity") remain
// valid in the TS union and in the DB CHECK constraint for legacy rows.
const SUB_TYPES: Record<EntryType, string[]> = {
  Asset:     ["Current Asset", "Non-Current Asset"],
  Liability: ["Current Liability", "Non-Current Liability"],
  Equity:    ["Owner's Equity", "Retained Earnings"],
};

// Map legacy BS sub-types to the COA subcategory used for filtering.
const COA_SUBCATEGORY: Record<string, string> = {
  "Current Asset":         "Current Asset",
  "Non-Current Asset":     "Non-Current Asset",
  "Fixed Asset":           "Non-Current Asset",
  "Other Asset":           "Non-Current Asset",
  "Current Liability":     "Current Liability",
  "Non-Current Liability": "Non-Current Liability",
  "Long-term Liability":   "Non-Current Liability",
  "Owner's Equity":        "Owner's Equity",
  "Owner's Capital":       "Owner's Equity",
  "Shareholder Equity":    "Owner's Equity",
  "Retained Earnings":     "Retained Earnings",
};

const TYPE_STYLE: Record<EntryType, { accent: string; badge: string; dot: string; row: string }> = {
  Asset:     { accent: "text-emerald-400", badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", dot: "bg-emerald-400", row: "hover:bg-emerald-950/30" },
  Liability: { accent: "text-rose-400",    badge: "bg-rose-500/10    border-rose-500/30    text-rose-300",    dot: "bg-rose-400",    row: "hover:bg-rose-950/30"    },
  Equity:    { accent: "text-violet-400",  badge: "bg-violet-500/10  border-violet-500/30  text-violet-300",  dot: "bg-violet-400",  row: "hover:bg-violet-950/30"  },
};

const STATUS_STYLE: Record<string, string> = {
  planning:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  on_hold:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const todayISO = () => new Date().toISOString().split("T")[0];

const makeEmptyForm = (projectId: string | null = null): BSFormData => ({
  project_id:     projectId,
  entry_type:     "Asset",
  asset_type:     "Current Asset",
  liability_type: null,
  equity_type:    null,
  account_name:   "",
  description:    "",
  amount:         0,
  entry_date:     todayISO(),
  reference_code: "",
  notes:          "",
});

const fmt = (n: number, currency = "Kshs") =>
  currency === "Kshs"
    ? `Kshs ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`
    : new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);

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

  async list(projectId: string): Promise<BalanceSheetEntry[]> {
    const { data, error } = await supabase
      .from("balance_sheet_entries")
      .select("*")
      .eq("project_id", projectId)
      .order("entry_type")
      .order("entry_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as BalanceSheetEntry[];
  },

  async listAll(): Promise<BalanceSheetEntry[]> {
    const { data, error } = await supabase
      .from("balance_sheet_entries")
      .select("*")
      .order("entry_type")
      .order("entry_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as BalanceSheetEntry[];
  },

  async listFirmWide(): Promise<BalanceSheetEntry[]> {
    const { data, error } = await supabase
      .from("balance_sheet_entries")
      .select("*")
      .is("project_id", null)
      .order("entry_type")
      .order("entry_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as BalanceSheetEntry[];
  },

  async create(body: BSFormData): Promise<BalanceSheetEntry> {
    const today = todayISO();

    if (body.project_id === null || body.project_id === "") {
      const { project_id: _omit, ...rest } = body;
      void _omit;
      const payload = { ...rest, entry_date: today };
      const { data, error } = await supabase
        .from("balance_sheet_entries")
        .insert([payload])
        .select()
        .single();
      if (error) {
        if (error.message.includes("not-null") || error.code === "23502") {
          throw new Error(
            "Your database requires a project to be selected. " +
            "To allow firm-wide entries, run this SQL in Supabase:\n\n" +
            "ALTER TABLE balance_sheet_entries ALTER COLUMN project_id DROP NOT NULL;"
          );
        }
        throw new Error(error.message);
      }
      return data as BalanceSheetEntry;
    }

    const payload = { ...body, entry_date: today };
    const { data, error } = await supabase
      .from("balance_sheet_entries")
      .insert([payload])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as BalanceSheetEntry;
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase.from("balance_sheet_entries").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

// ─── TOAST ────────────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);
  const push = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  }, []);
  return { toasts, push };
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
//
// Single source of truth for every interactive form element.
// ALL <input>, <textarea>, and <select> elements across the entire file
// are built from these three constants only — never with ad-hoc inline classes.
//
// inputCls   — text inputs and textareas
// selectCls  — ALL dropdowns (appearance-none strips native arrow; pr-9 leaves
//              room for the custom <SelectWrapper> chevron)
// readonlyCls — non-editable display fields (e.g. auto-set posting date)
//
// Typography shared across all three:
//   text-sm · font-normal · tracking-normal · leading-snug
// Geometry shared across all three:
//   rounded-xl · py-2.5 · border border-white/10
// Colour shared across all three:
//   bg-white/5 · text-foreground
// Focus shared across inputCls / selectCls:
//   focus:outline-none · focus:ring-1 · focus:ring-primary/60 · focus:border-primary/40

const inputCls =
  "w-full px-3 py-2.5 rounded-xl " +
  "text-sm font-normal tracking-normal leading-snug " +
  "bg-white/5 border border-white/10 " +
  "text-foreground placeholder-muted-foreground " +
  "focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/40 " +
  "transition-all";

const selectCls =
  "w-full pl-3 pr-9 py-2.5 rounded-xl " +
  "text-sm font-normal tracking-normal leading-snug " +
  "appearance-none cursor-pointer " +
  "bg-white/5 border border-white/10 " +
  "text-foreground " +
  "focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/40 " +
  "transition-all " +
  // Dark-theme option list (honoured in Chrome/Edge/Firefox on Windows)
  "[&>option]:bg-[hsl(var(--background))] [&>option]:text-foreground";

const readonlyCls =
  "w-full px-3 py-2.5 rounded-xl " +
  "text-sm font-normal tracking-normal leading-snug " +
  "bg-white/[0.03] border border-white/[0.06] " +
  "text-muted-foreground cursor-not-allowed select-none";

// ─── SELECT WRAPPER ───────────────────────────────────────────────────────────
//
// Renders the custom chevron that replaces the browser's native <select> arrow.
// Wrap every <select> in <SelectWrapper> — the chevron is pointer-events-none
// so it never blocks click events on the underlying element.

function SelectWrapper({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {children}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

// ─── FIELD ────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

// ─── TOOLBAR ──────────────────────────────────────────────────────────────────
// Reusable search + entry-type filter row used in every table view.

function Toolbar({
  search,
  onSearch,
  filterType,
  onFilterType,
  shownCount,
  totalCount,
  searchPlaceholder = "Search by account name or reference…",
}: {
  search:              string;
  onSearch:            (v: string) => void;
  filterType:          EntryType | "All";
  onFilterType:        (v: EntryType | "All") => void;
  shownCount:          number;
  totalCount:          number;
  searchPlaceholder?:  string;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
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
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className={inputCls + " pl-9"}
        />
      </div>

      {/* Type filter */}
      <SelectWrapper className="w-full sm:w-44">
        <select
          value={filterType}
          onChange={(e) => onFilterType(e.target.value as EntryType | "All")}
          className={selectCls}
        >
          <option value="All">All Types</option>
          {ENTRY_TYPES.map((t) => <option key={t} value={t}>{t}s</option>)}
        </select>
      </SelectWrapper>

      {/* Count pill */}
      <div className="inline-flex items-center px-4 py-2.5 text-xs font-normal tracking-normal text-muted-foreground border border-white/10 rounded-xl bg-white/5 whitespace-nowrap tabular-nums">
        {shownCount} / {totalCount} shown
      </div>
    </div>
  );
}

// ─── DB MIGRATION BANNER ──────────────────────────────────────────────────────

function MigrationBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
    >
      <div className="flex items-start gap-3">
        <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-300 mb-1">Database migration required for firm-wide entries</p>
          <p className="text-xs font-normal text-amber-200/70 mb-2">
            Run this once in your Supabase SQL editor to allow entries not linked to any project:
          </p>
          <code className="block bg-black/30 border border-amber-500/20 rounded-lg px-3 py-2 text-xs font-mono text-amber-200 mb-2">
            ALTER TABLE balance_sheet_entries ALTER COLUMN project_id DROP NOT NULL;
          </code>
          <p className="text-xs font-normal text-amber-200/50">
            This is safe — existing project-linked entries are unaffected.
          </p>
        </div>
        <button onClick={onDismiss} className="text-amber-400/60 hover:text-amber-300 transition-colors p-0.5 shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

// ─── POST JOURNAL ENTRY MODAL ─────────────────────────────────────────────────

function PostEntryModal({
  initial,
  onSave,
  onClose,
  loading,
  projects = [],
  showProjectSelector = false,
}: {
  initial:              BSFormData;
  onSave:               (d: BSFormData) => void;
  onClose:              () => void;
  loading:              boolean;
  projects?:            Project[];
  showProjectSelector?: boolean;
}) {
  const [form, setForm] = useState<BSFormData>({ ...initial, entry_date: todayISO() });

  const setField = (k: keyof BSFormData, v: unknown) =>
    setForm((prev) => {
      const next = { ...prev, [k]: v } as BSFormData;
      if (k === "entry_type") {
        const et = v as EntryType;
        next.asset_type     = et === "Asset"     ? "Current Asset"     : null;
        next.liability_type = et === "Liability" ? "Current Liability" : null;
        next.equity_type    = et === "Equity"    ? "Owner's Equity"    : null;
        next.account_name   = "";
        next.amount         = 0;
      }
      return next;
    });

  const subKey     = form.entry_type === "Asset" ? "asset_type" : form.entry_type === "Liability" ? "liability_type" : "equity_type";
  const subVal     = ((form as Record<string, unknown>)[subKey] as string) ?? "";
  const isFirmWide = showProjectSelector && (form.project_id === null || form.project_id === "");

  // ── COA accounts for the chosen entry_type + sub-type ──────────────────────
  const [coaAccounts, setCoaAccounts] = useState<COAAccount[]>([]);
  const [coaLoading, setCoaLoading]   = useState(false);

  useEffect(() => {
    const coaSub = COA_SUBCATEGORY[subVal] ?? subVal;
    if (!coaSub) { setCoaAccounts([]); return; }
    setCoaLoading(true);
    fetchCOAAccounts(form.entry_type, coaSub)
      .then(setCoaAccounts)
      .catch(() => setCoaAccounts([]))
      .finally(() => setCoaLoading(false));
  }, [form.entry_type, subVal]);

  const selectedCOA = coaAccounts.find(a => a.account_name === form.account_name) ?? null;

  // ── Amount sources for the chosen COA account ──────────────────────────────
  const [amountSources, setAmountSources] = useState<AmountSource[]>([]);
  const [amountLoading, setAmountLoading] = useState(false);
  const [amountPick, setAmountPick]       = useState<string>("");

  useEffect(() => {
    setAmountSources([]);
    setAmountPick("");
    if (!selectedCOA) return;
    setAmountLoading(true);
    fetchAccountAmountSources(selectedCOA, form.project_id ?? null)
      .then(setAmountSources)
      .catch(() => setAmountSources([]))
      .finally(() => setAmountLoading(false));
  }, [selectedCOA?.id, form.project_id]);

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
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">Post Journal Entry</h2>
            <p className="text-xs font-normal text-muted-foreground mt-0.5">
              {isFirmWide
                ? "This entry will be posted to the firm-wide balance sheet (not linked to any project)."
                : "Entries are posted today and cannot be back-dated or edited after posting."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/10 ml-4 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">

          {/* ── Linked Project ── only in global modal */}
          {showProjectSelector && (
            <div className="col-span-2">
              <Field label="Linked Project">
                <SelectWrapper>
                  <select
                    value={form.project_id ?? ""}
                    onChange={(e) => setField("project_id", e.target.value === "" ? null : e.target.value)}
                    className={selectCls}
                  >
                    <option value="">— Firm-wide entry (no project) —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.project_number} · {p.title}</option>
                    ))}
                  </select>
                </SelectWrapper>
                <p className="text-[11px] font-normal text-muted-foreground/70 mt-1 leading-relaxed">
                  {isFirmWide
                    ? "This entry will appear only in the consolidated firm balance sheet."
                    : "This entry will appear in both the project balance sheet and the consolidated view."}
                </p>
              </Field>
            </div>
          )}

          {/* ── Entry Type ── */}
          <Field label="Entry Type *">
            <SelectWrapper>
              <select
                value={form.entry_type}
                onChange={(e) => setField("entry_type", e.target.value as EntryType)}
                className={selectCls}
              >
                {ENTRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </SelectWrapper>
          </Field>

          {/* ── Sub-type ── */}
          <Field label={`${form.entry_type} Sub-type *`}>
            <SelectWrapper>
              <select
                value={subVal}
                onChange={(e) => setField(subKey as keyof BSFormData, e.target.value)}
                className={selectCls}
              >
                {SUB_TYPES[form.entry_type].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </SelectWrapper>
          </Field>

          {/* ── Account Name — select from Chart of Accounts ── */}
          <div className="col-span-2">
            <Field label="Account Name *" hint={`From Chart of Accounts (category: ${form.entry_type}, sub-category: ${COA_SUBCATEGORY[subVal] ?? subVal})`}>
              <SelectWrapper>
                <select
                  value={selectedCOA?.account_code ?? ""}
                  onChange={(e) => {
                    const code = e.target.value;
                    const acct = coaAccounts.find(a => a.account_code === code) ?? null;
                    setField("account_name", acct?.account_name ?? "");
                    setField("amount", 0);
                  }}
                  disabled={coaLoading}
                  className={selectCls}
                >
                  <option value="">
                    {coaLoading
                      ? "Loading accounts…"
                      : coaAccounts.length === 0
                        ? "— No active COA accounts for this sub-type —"
                        : "— Select an account —"}
                  </option>
                  {coaAccounts.map(a => (
                    <option key={a.id} value={a.account_code}>
                      {a.account_code} — {a.account_name}
                    </option>
                  ))}
                </select>
              </SelectWrapper>
            </Field>
          </div>

          {/* ── Amount — drop down sourced from real ERP movements on this account ── */}
          <div className="col-span-2">
            <Field
              label="Amount *"
              hint={selectedCOA
                ? (form.project_id
                    ? "Pick a money input from this project. Fixed-asset options use NET BOOK VALUE (cost − accumulated depreciation auto-deducted)."
                    : "Pick a firm-wide money input. Fixed-asset options use NET BOOK VALUE.")
                : "Select an account above to load amount options."
              }
            >
              <div className="flex flex-col gap-2">
                <SelectWrapper>
                  <select
                    value={amountPick}
                    onChange={(e) => {
                      const key = e.target.value;
                      setAmountPick(key);
                      if (key === "" || key === "__custom__") return;
                      const src = amountSources.find(s => s.key === key);
                      if (src) setField("amount", src.amount);
                    }}
                    disabled={!selectedCOA || amountLoading}
                    className={selectCls}
                  >
                    <option value="">
                      {!selectedCOA
                        ? "— Select an account above first —"
                        : amountLoading
                          ? "Loading money inputs…"
                          : amountSources.length === 0
                            ? "— No automatic source for this account; enter a custom amount —"
                            : "— Pick a money input from the database —"}
                    </option>
                    {amountSources.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                    {selectedCOA && (
                      <option value="__custom__">— Custom amount (type below) —</option>
                    )}
                  </select>
                </SelectWrapper>
                <div className="flex items-stretch">
                  <span className="inline-flex items-center px-3 rounded-l-xl text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-r-0 border-emerald-500/20 whitespace-nowrap select-none">
                    KES
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount === 0 ? "0" : form.amount || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setField("amount", val === "" ? "" : parseFloat(val));
                      setAmountPick("__custom__");
                    }}
                    className={
                      "flex-1 px-3 py-2.5 rounded-r-xl " +
                      "text-sm font-normal tracking-normal leading-snug " +
                      "bg-white/5 border border-white/10 border-l-0 " +
                      "text-foreground placeholder-muted-foreground " +
                      "focus:outline-none focus:ring-1 focus:ring-primary/60 focus:border-primary/40 " +
                      "transition-all"
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
            </Field>
          </div>

          {/* ── Posting Date — read-only ── */}
          <Field label="Posting Date">
            <div className={readonlyCls + " flex items-center gap-2"}>
              <svg className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              <span>{fmtDate(form.entry_date)}</span>
              <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground/40 font-medium">Auto</span>
            </div>
          </Field>

          {/* ── Reference Code ── */}
          <Field label="Reference Code">
            <input
              value={form.reference_code ?? ""}
              onChange={(e) => setField("reference_code", e.target.value || null)}
              placeholder="e.g. JE-2024-001"
              className={inputCls}
            />
          </Field>

          {/* ── Description ── */}
          <Field label="Description">
            <input
              value={form.description ?? ""}
              onChange={(e) => setField("description", e.target.value || null)}
              placeholder="Brief description"
              className={inputCls}
            />
          </Field>

          {/* ── Notes ── */}
          <div className="col-span-2">
            <Field label="Notes">
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => setField("notes", e.target.value || null)}
                rows={2}
                placeholder="Additional notes…"
                className={inputCls + " resize-none"}
              />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-normal text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={loading || !form.account_name.trim() || !form.amount}
            className="px-5 py-2 text-sm font-medium rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
          >
            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Post Entry
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DELETE CONFIRM ───────────────────────────────────────────────────────────

function DeleteConfirm({ entry, onConfirm, onClose, loading }: {
  entry: BalanceSheetEntry; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-xl bg-white/10"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
      >
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Reverse Entry</h3>
            <p className="text-sm font-normal text-muted-foreground leading-relaxed">
              Permanently reverse{" "}
              <span className="text-foreground font-medium">{entry.account_name}</span>{" "}
              (<span className="font-mono text-primary text-xs">{fmt(entry.amount)}</span>)?
              {" "}This cannot be undone.
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
            className="px-4 py-2 text-sm font-medium rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Reverse Entry
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
  const statusCls = STATUS_STYLE[status] ?? STATUS_STYLE.planning;

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
          <span className="text-[10px] font-normal text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded-full shrink-0 tabular-nums">
            {entryCount} {entryCount === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      <h3 className="font-semibold text-foreground text-sm mb-1.5 group-hover:text-primary transition-colors leading-snug line-clamp-1">
        {project.title}
      </h3>

      {project.description && (
        <p className="text-xs font-normal text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
          {project.description}
        </p>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-normal text-muted-foreground mb-3">
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
            {fmt(project.budget_numeric, "Kshs")}
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
            <span className="text-[10px] font-normal text-muted-foreground">Progress</span>
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
        <span>Open Balance Sheet</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </div>
    </motion.button>
  );
}

// ─── ENTRIES TABLE ────────────────────────────────────────────────────────────

function EntriesTable({
  entries,
  canEdit,
  onDelete,
  showProjectCol = false,
  projects = [],
}: {
  entries:         BalanceSheetEntry[];
  canEdit:         boolean;
  onDelete:        (e: BalanceSheetEntry) => void;
  showProjectCol?: boolean;
  projects?:       Project[];
}) {
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>(
    Object.fromEntries(ENTRY_TYPES.map((t) => [t, true]))
  );
  const [search,     setSearch]     = useState("");
  const [filterType, setFilterType] = useState<EntryType | "All">("All");

  const filtered = useMemo(() =>
    entries.filter((e) => {
      if (filterType !== "All" && e.entry_type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return e.account_name.toLowerCase().includes(q) ||
          (e.reference_code ?? "").toLowerCase().includes(q) ||
          (e.description   ?? "").toLowerCase().includes(q);
      }
      return true;
    }),
  [entries, filterType, search]);

  const grouped = useMemo(() => {
    const g: Partial<Record<EntryType, BalanceSheetEntry[]>> = {};
    ENTRY_TYPES.forEach((t) => {
      const items = filtered.filter((e) => e.entry_type === t);
      if (items.length) g[t] = items;
    });
    return g;
  }, [filtered]);

  const projectLabel = (pid: string | null) => {
    if (!pid) return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-300 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded">
        Firm-wide
      </span>
    );
    const p = projects.find((pr) => pr.id === pid);
    return p
      ? <span className="font-mono text-[11px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">{p.project_number}</span>
      : <span className="italic font-normal text-muted-foreground/60 text-xs">Unknown</span>;
  };

  // Cols before Amount: Ref | Account Name | Sub-type | Description | Date | [Scope]
  const preAmountCols = showProjectCol ? 6 : 5;

  return (
    <>
      <div className="px-6 pt-2 pb-4">
        <Toolbar
          search={search}
          onSearch={setSearch}
          filterType={filterType}
          onFilterType={setFilterType}
          shownCount={filtered.length}
          totalCount={entries.length}
        />
      </div>

      {Object.keys(grouped).length > 0 && (
        <div className="divide-y divide-white/8">
          {ENTRY_TYPES.filter((t) => grouped[t]).map((entryType) => {
            const s        = TYPE_STYLE[entryType];
            const isOpen   = expanded[entryType];
            const rows     = grouped[entryType]!;
            const subtotal = rows.reduce((sum, e) => sum + Number(e.amount), 0);

            return (
              <div key={entryType}>
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [entryType]: !p[entryType] }))}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                    <span className={`text-xs font-bold uppercase tracking-[0.12em] ${s.accent}`}>{entryType}s</span>
                    <Badge className={`text-xs px-2.5 py-0.5 font-mono border rounded-full ${s.badge}`}>{rows.length}</Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-semibold tabular-nums ${s.accent}`}>{fmt(subtotal)}</span>
                    <svg
                      className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                    >
                      <path d="m6 9 6 6 6-6"/>
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
                      <div className="md:hidden divide-y divide-white/8 px-3 pb-3">
                        {rows.map((entry) => {
                          const subType =
                            entry.entry_type === "Asset"     ? entry.asset_type     :
                            entry.entry_type === "Liability" ? entry.liability_type :
                            entry.equity_type;
                          const meta = [
                            { label: "Sub-type",    node: subType || "—" },
                            { label: "Date",        node: fmtDate(entry.entry_date) },
                            ...(entry.description ? [{ label: "Description", node: entry.description }] : []),
                            ...(showProjectCol ? [{ label: "Scope", node: projectLabel(entry.project_id) }] : []),
                          ];
                          const auto = isAutoEntry(entry);
                          return (
                            <div key={entry.id} className="py-4">
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-foreground text-sm truncate">{entry.account_name}</p>
                                    {auto && (
                                      <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400/80 shrink-0">
                                        AUTO
                                      </span>
                                    )}
                                  </div>
                                  <p className="font-mono text-xs text-primary mt-0.5">{entry.reference_code || "—"}</p>
                                </div>
                                <span className={`text-sm font-bold tabular-nums shrink-0 ${s.accent}`}>{fmt(entry.amount)}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                {meta.map((m, mi) => (
                                  <div key={mi} className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{m.label}</span>
                                    <span className="font-mono text-xs text-muted-foreground/90 truncate text-right">{m.node}</span>
                                  </div>
                                ))}
                              </div>
                              {canEdit && !auto && (
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/8">
                                  <button onClick={() => onDelete(entry)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:bg-rose-500/10 transition-all">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                                    Reverse Entry
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
                                "Ref",
                                "Account Name",
                                "Sub-type",
                                "Description",
                                "Date",
                                ...(showProjectCol ? ["Scope"] : []),
                                "Amount",
                                ...(canEdit ? ["Actions"] : []),
                              ].map((h) => (
                                <th
                                  key={h}
                                  className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((entry, ri) => {
                              const subType =
                                entry.entry_type === "Asset"     ? entry.asset_type     :
                                entry.entry_type === "Liability" ? entry.liability_type :
                                entry.equity_type;
                              const auto = isAutoEntry(entry);
                              return (
                                <motion.tr
                                  key={entry.id}
                                  initial={{ opacity: 0, x: -6 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: ri * 0.02, duration: 0.16 }}
                                  className={`border-b border-white/5 transition-colors ${s.row}`}
                                >
                                  <td className="px-5 py-3.5 whitespace-nowrap">
                                    <span className="font-mono text-xs font-semibold text-primary">{entry.reference_code || "—"}</span>
                                  </td>
                                  <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-foreground">
                                    <span className="inline-flex items-center gap-2">
                                      {entry.account_name}
                                      {auto && (
                                        <span
                                          title="Auto-derived from ERP modules"
                                          className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400/80"
                                        >
                                          AUTO
                                        </span>
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 whitespace-nowrap text-xs font-normal text-muted-foreground">{subType || "—"}</td>
                                  <td className="px-5 py-3.5 text-xs font-normal text-muted-foreground max-w-xs">
                                    <span className="line-clamp-1">{entry.description || "—"}</span>
                                  </td>
                                  <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs font-normal text-muted-foreground">{fmtDate(entry.entry_date)}</td>
                                  {showProjectCol && (
                                    <td className="px-5 py-3.5 whitespace-nowrap">{projectLabel(entry.project_id)}</td>
                                  )}
                                  <td className="px-5 py-3.5 whitespace-nowrap">
                                    <span className={`text-sm font-semibold tabular-nums ${s.accent}`}>{fmt(entry.amount)}</span>
                                  </td>
                                  {canEdit && (
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                      {auto ? (
                                        <span className="text-[10px] font-normal text-muted-foreground/40 italic">read-only</span>
                                      ) : (
                                        <button
                                          onClick={() => onDelete(entry)}
                                          title="Reverse entry"
                                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                            <polyline points="3 6 5 6 21 6"/>
                                            <path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                                          </svg>
                                        </button>
                                      )}
                                    </td>
                                  )}
                                </motion.tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-white/10" style={{ background: "rgba(255,255,255,0.02)" }}>
                              <td
                                colSpan={preAmountCols}
                                className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                              >
                                Total {entryType}s
                              </td>
                              <td className={`px-5 py-2.5 text-sm font-bold tabular-nums ${s.accent}`}>{fmt(subtotal)}</td>
                              {canEdit && <td />}
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
        </div>
      )}
    </>
  );
}

// ─── STAT CARDS ───────────────────────────────────────────────────────────────

function StatCards({
  entries,
  filterType,
  setFilterType,
}: {
  entries:       BalanceSheetEntry[];
  filterType:    EntryType | "All";
  setFilterType: (t: EntryType | "All") => void;
}) {
  const totals = useMemo(
    () => Object.fromEntries(
      ENTRY_TYPES.map((type) => [
        type,
        entries.filter((e) => e.entry_type === type).reduce((s, e) => s + Number(e.amount), 0),
      ])
    ) as Record<EntryType, number>,
    [entries]
  );

  const totalAssets      = totals.Asset     ?? 0;
  const totalLiabilities = totals.Liability ?? 0;
  const totalEquity      = totals.Equity    ?? 0;
  const isBalanced       = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
      className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
    >
      {ENTRY_TYPES.map((type) => {
        const s        = TYPE_STYLE[type];
        const isActive = filterType === type;
        return (
          <button
            key={type}
            onClick={() => setFilterType(isActive ? "All" : type)}
            className={`rounded-2xl border p-4 text-left transition-all duration-200 backdrop-blur-sm bg-white/5 ${
              isActive ? "border-white/20 ring-1 ring-white/20 scale-[1.02]" : "border-white/10 hover:border-white/20 hover:scale-[1.01]"
            }`}
          >
            <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${s.accent}`}>{type}s</div>
            <div className="text-3xl font-bold text-foreground tabular-nums">{fmt(totals[type] ?? 0)}</div>
            <div className="text-xs font-normal text-muted-foreground mt-1">
              {entries.filter((e) => e.entry_type === type).length} entries
            </div>
          </button>
        );
      })}
      <div className={`rounded-2xl border p-4 text-left backdrop-blur-sm ${
        isBalanced ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"
      }`}>
        <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${isBalanced ? "text-emerald-400" : "text-rose-400"}`}>
          A = L + E
        </div>
        <div className={`text-3xl font-bold tabular-nums ${isBalanced ? "text-emerald-400" : "text-rose-400"}`}>
          {isBalanced ? "Balanced" : "Unbalanced"}
        </div>
        <div className="text-xs font-normal text-muted-foreground mt-1">
          {isBalanced ? "Equation checks out" : `Δ ${fmt(Math.abs(totalAssets - (totalLiabilities + totalEquity)))}`}
        </div>
      </div>
    </motion.div>
  );
}

// ─── ACCOUNTING EQUATION BAR ──────────────────────────────────────────────────

function AccountingBar({ entries }: { entries: BalanceSheetEntry[] }) {
  const totalAssets      = entries.filter((e) => e.entry_type === "Asset").reduce((s, e) => s + Number(e.amount), 0);
  const totalLiabilities = entries.filter((e) => e.entry_type === "Liability").reduce((s, e) => s + Number(e.amount), 0);
  const totalEquity      = entries.filter((e) => e.entry_type === "Equity").reduce((s, e) => s + Number(e.amount), 0);
  const isBalanced       = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;
  if (!entries.length) return null;

  return (
    <div className={`px-6 py-4 flex flex-wrap items-center gap-4 font-mono text-xs ${isBalanced ? "bg-emerald-950/20" : "bg-rose-950/20"}`}>
      <span className="text-muted-foreground">Accounting Equation:</span>
      <span className="text-emerald-400">Assets {fmt(totalAssets)}</span>
      <span className="text-muted-foreground">=</span>
      <span className="text-rose-400">Liabilities {fmt(totalLiabilities)}</span>
      <span className="text-muted-foreground">+</span>
      <span className="text-violet-400">Equity {fmt(totalEquity)}</span>
      <span className="text-muted-foreground">=</span>
      <span className={isBalanced ? "text-emerald-400" : "text-rose-400"}>{fmt(totalLiabilities + totalEquity)}</span>
      <Badge className={`ml-auto ${
        isBalanced
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          : "bg-rose-500/10 border-rose-500/30 text-rose-300"
      }`}>
        {isBalanced ? "✓ Balanced" : "⚠ Unbalanced"}
      </Badge>
    </div>
  );
}

// ─── COA ACCOUNT + AMOUNT-SOURCE HELPERS (per-entry pickers) ─────────────────
//
// When the user picks an entry type + sub-type in the Post Journal Entry modal,
// the Account Name field becomes a select sourced from chart_of_accounts so the
// user can only pick a real GL account. Once an account is picked, the Amount
// field becomes a select whose options are the actual money movements that
// flow through that account elsewhere in the ERP:
//
//   10xx (Cash & bank)        → AR receipts + AP payments + Payroll net pay
//   11xx (Receivables)        → AR rows (balance)
//   12xx (Inventory)          → Inventory rows (on-hand value)
//   15xx not 1590 (Fixed)     → Fixed assets at NET BOOK VALUE
//                               (cost − accumulated_depreciation — auto-deducted)
//   1590 (Accum. Depreciation)→ Per-asset accumulated_depreciation
//   20xx (Current liabilities)→ AP rows (balance)
//   25xx (Non-current)        → Loans (latest closing_balance per facility)
//
// Each option still surfaces the raw amount; the user can also leave the
// amount blank and type a custom value if their entry doesn't fit any source.

interface COAAccount {
  id:           number;
  account_code: string;
  account_name: string;
  subcategory:  string;
}

interface AmountSource {
  key:    string;
  label:  string;
  amount: number;
}

async function fetchCOAAccounts(category: EntryType, subcategory: string): Promise<COAAccount[]> {
  const { data } = await supabase
    .from("chart_of_accounts")
    .select("id,account_code,account_name,subcategory")
    .eq("category", category)
    .eq("subcategory", subcategory)
    .eq("active", true)
    .order("account_code", { ascending: true });
  return (data ?? []) as COAAccount[];
}

async function fetchAccountAmountSources(
  acct: COAAccount,
  projectId: string | null,
): Promise<AmountSource[]> {
  const scoped = (q: any) => projectId ? q.eq("project_id", projectId) : q;
  const code = acct.account_code;
  const out: AmountSource[] = [];
  const fmtA = (n: number) => fmt(n, "Kshs");

  // ── Cash & Bank (10xx) ─────────────────────────────────────────────────────
  if (code.startsWith("10")) {
    const [arRes, apRes, payRes] = await Promise.all([
      scoped(supabase.from("accounts_receivable")
        .select("id,client,billing,amount_received,date,account_received")
        .eq("account_received", code).gt("amount_received", 0)),
      scoped(supabase.from("accounts_payable")
        .select("id,vendor_name,invoice_number,paid_amount,date_of_payment,receiving_account_code")
        .eq("receiving_account_code", code).gt("paid_amount", 0)),
      scoped(supabase.from("payroll_entries")
        .select("id,employee_name,net_pay,paid_date,bank_code,payment_status")
        .eq("bank_code", code).eq("payment_status", "Paid")),
    ]);
    (arRes.data ?? []).forEach((r: any) => out.push({
      key:    `ar:${r.id}`,
      label:  `+ AR Receipt · ${r.client ?? "—"}${r.billing ? " · " + r.billing : ""} (${fmtA(Number(r.amount_received) || 0)})`,
      amount: Number(r.amount_received) || 0,
    }));
    (apRes.data ?? []).forEach((r: any) => out.push({
      key:    `ap:${r.id}`,
      label:  `− AP Payment · ${r.vendor_name ?? "—"}${r.invoice_number ? " · " + r.invoice_number : ""} (${fmtA(Number(r.paid_amount) || 0)})`,
      amount: Number(r.paid_amount) || 0,
    }));
    (payRes.data ?? []).forEach((r: any) => out.push({
      key:    `pay:${r.id}`,
      label:  `− Payroll · ${r.employee_name ?? "—"} (${fmtA(Number(r.net_pay) || 0)})`,
      amount: Number(r.net_pay) || 0,
    }));
    return out;
  }

  // ── Receivables (11xx) ─────────────────────────────────────────────────────
  if (code.startsWith("11")) {
    const arRes = await scoped(supabase.from("accounts_receivable")
      .select("id,client,billing,balance,amount_billed,date,status"));
    (arRes.data ?? []).forEach((r: any) => out.push({
      key:    `ar:${r.id}`,
      label:  `AR · ${r.billing ?? r.id} · ${r.client ?? "—"} (outstanding ${fmtA(Number(r.balance) || 0)})`,
      amount: Number(r.balance) || 0,
    }));
    return out;
  }

  // ── Inventory (12xx) ───────────────────────────────────────────────────────
  if (code.startsWith("12")) {
    const invRes = await scoped(supabase.from("inventory")
      .select("id,factorial_code,description,total_value,total_value_used"));
    (invRes.data ?? []).forEach((r: any) => {
      const onHand = Math.max(0, (Number(r.total_value) || 0) - (Number(r.total_value_used) || 0));
      out.push({
        key:    `inv:${r.id}`,
        label:  `Inventory · ${r.factorial_code ?? ""} ${r.description ?? ""} (on hand ${fmtA(onHand)})`,
        amount: onHand,
      });
    });
    return out;
  }

  // ── Fixed Assets at NET BOOK VALUE (15xx, excluding 1590) ──────────────────
  // net_book_value is a generated column = cost − accumulated_depreciation,
  // so depreciation is automatically subtracted from the gross cost.
  if (code.startsWith("15") && code !== "1590") {
    const faRes = await supabase.from("fixed_asset_equipment_depreciation")
      .select("id,assets_number,name,class,cost,accumulated_depreciation,net_book_value");
    (faRes.data ?? []).forEach((r: any) => {
      const cost = Number(r.cost) || 0;
      const dep  = Number(r.accumulated_depreciation) || 0;
      const nbv  = Math.max(0, Number(r.net_book_value) || (cost - dep));
      out.push({
        key:    `fa:${r.id}`,
        label:  `${r.name ?? r.assets_number ?? "—"} · NBV ${fmtA(nbv)} (cost ${fmtA(cost)} − dep ${fmtA(dep)})`,
        amount: nbv,
      });
    });
    return out;
  }

  // ── Accumulated Depreciation contra-asset (1590) ───────────────────────────
  if (code === "1590") {
    const faRes = await supabase.from("fixed_asset_equipment_depreciation")
      .select("id,assets_number,name,accumulated_depreciation");
    (faRes.data ?? []).forEach((r: any) => out.push({
      key:    `fa-dep:${r.id}`,
      label:  `Accumulated dep · ${r.name ?? r.assets_number ?? "—"} (${fmtA(Number(r.accumulated_depreciation) || 0)})`,
      amount: Number(r.accumulated_depreciation) || 0,
    }));
    return out;
  }

  // ── Accounts Payable & current liabilities (20xx) ──────────────────────────
  if (code.startsWith("20")) {
    const apRes = await scoped(supabase.from("accounts_payable")
      .select("id,vendor_name,invoice_number,balance,total_amount,date"));
    (apRes.data ?? []).forEach((r: any) => out.push({
      key:    `ap:${r.id}`,
      label:  `AP · ${r.invoice_number ?? r.id} · ${r.vendor_name ?? "—"} (balance ${fmtA(Number(r.balance) || 0)})`,
      amount: Number(r.balance) || 0,
    }));
    return out;
  }

  // ── Long-term Liabilities — Loans (25xx) ───────────────────────────────────
  if (code.startsWith("25")) {
    const loansRes = await scoped(supabase.from("loans")
      .select("id,facility_ref,lender_name,closing_balance,due_date"));
    const latest: Record<string, any> = {};
    (loansRes.data ?? []).forEach((r: any) => {
      const cur = latest[r.facility_ref];
      if (!cur || (r.due_date ?? "") > (cur.due_date ?? "")) latest[r.facility_ref] = r;
    });
    Object.values(latest).forEach((r: any) => out.push({
      key:    `loan:${r.facility_ref}`,
      label:  `Loan · ${r.facility_ref ?? "—"} · ${r.lender_name ?? "—"} (outstanding ${fmtA(Number(r.closing_balance) || 0)})`,
      amount: Number(r.closing_balance) || 0,
    }));
    return out;
  }

  // ── Equity & other accounts have no automatic source ──────────────────────
  return out;
}


// ─── AUTO-DERIVED CONSOLIDATION (firm-wide ERP rollups) ──────────────────────
//
// The consolidated balance sheet shows the firm's true financial position by
// pulling totals straight from the rest of the ERP — AR, AP, Inventory, WIP,
// Loans, Cash — rather than re-summing per-project journal entries (which
// would double-count or miss whatever the operator never journaled). The
// derived rows are presented as virtual entries with negative ids so they
// can never be deleted and never collide with real balance_sheet_entries.id.

interface DerivedTotals {
  cash:             number;
  ar:               number;
  inventoryOnHand:  number;
  wipUnderbilled:   number;
  ap:               number;
  wipOverbilled:    number;
  loans:            number;
}

const ZERO_TOTALS: DerivedTotals = {
  cash: 0, ar: 0, inventoryOnHand: 0, wipUnderbilled: 0, ap: 0, wipOverbilled: 0, loans: 0,
};

const isAutoEntry = (e: BalanceSheetEntry) => e.id < 0;

async function fetchDerivedTotals(): Promise<DerivedTotals> {
  const safeSum = <T extends Record<string, unknown>>(
    rows: T[] | null | undefined,
    pick: (r: T) => number,
  ) => (rows ?? []).reduce((s, r) => s + (Number(pick(r)) || 0), 0);

  const [
    arRes, apRes, invRes, wipRes, loansRes, cashRes,
  ] = await Promise.all([
    supabase.from("accounts_receivable").select("balance,status")
      .in("status", ["outstanding", "overdue", "partial"]),
    supabase.from("accounts_payable").select("balance,status")
      .in("status", ["open", "overdue", "partial"]),
    supabase.from("inventory").select("total_value,total_value_used"),
    supabase.from("work_in_progress").select("amount,billed_status"),
    supabase.from("loans").select("facility_ref,closing_balance,due_date"),
    supabase.from("cash_flow").select("project_id,year,quarter,month,ending_balance"),
  ]);

  // AR: sum of unpaid balances
  const ar = safeSum(arRes.data as { balance: number }[] | null, (r) => r.balance);

  // AP: sum of unpaid balances
  const ap = safeSum(apRes.data as { balance: number }[] | null, (r) => r.balance);

  // Inventory on hand = total_value − total_value_used (per row, floor 0)
  const inventoryOnHand = (invRes.data as { total_value: number; total_value_used: number }[] | null ?? [])
    .reduce((s, r) => s + Math.max(0, (Number(r.total_value) || 0) - (Number(r.total_value_used) || 0)), 0);

  // WIP: underbilled rows = current-asset CIP; overbilled rows = current liability
  const wipRows = (wipRes.data as { amount: number; billed_status: string }[] | null) ?? [];
  const wipUnderbilled = wipRows.filter((r) => r.billed_status === "underbilled")
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const wipOverbilled  = wipRows.filter((r) => r.billed_status === "overbilled")
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  // Loans: most-recent closing_balance per facility (one row per facility)
  const loansRows = (loansRes.data as { facility_ref: string; closing_balance: number; due_date: string }[] | null) ?? [];
  const latestLoan: Record<string, { closing_balance: number; due_date: string }> = {};
  loansRows.forEach((r) => {
    const cur = latestLoan[r.facility_ref];
    if (!cur || (r.due_date ?? "") > (cur.due_date ?? "")) {
      latestLoan[r.facility_ref] = { closing_balance: Number(r.closing_balance) || 0, due_date: r.due_date };
    }
  });
  const loans = Object.values(latestLoan).reduce((s, x) => s + x.closing_balance, 0);

  // Cash: latest ending_balance per project
  const cashRows = (cashRes.data as { project_id: string; year: number; quarter: string; month: string; ending_balance: number }[] | null) ?? [];
  const qRank = (q: string) => ({ Q1: 1, Q2: 2, Q3: 3, Q4: 4 } as Record<string, number>)[q] ?? 0;
  const mRank = (m: string) => {
    const idx = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      .findIndex((x) => (m ?? "").toLowerCase().startsWith(x.toLowerCase()));
    return idx < 0 ? 0 : idx + 1;
  };
  const latestCash: Record<string, { y: number; q: number; m: number; bal: number }> = {};
  cashRows.forEach((r) => {
    const y = Number(r.year) || 0, q = qRank(r.quarter), m = mRank(r.month);
    const cur = latestCash[r.project_id];
    const newer = !cur || y > cur.y || (y === cur.y && q > cur.q) || (y === cur.y && q === cur.q && m > cur.m);
    if (newer) latestCash[r.project_id] = { y, q, m, bal: Number(r.ending_balance) || 0 };
  });
  const cash = Object.values(latestCash).reduce((s, x) => s + x.bal, 0);

  return { cash, ar, inventoryOnHand, wipUnderbilled, ap, wipOverbilled, loans };
}

function buildDerivedEntries(d: DerivedTotals): BalanceSheetEntry[] {
  let nextId = -1;
  const today = todayISO();
  const mk = (
    entry_type:     EntryType,
    sub:            AssetType | LiabilityType | EquityType,
    account_name:   string,
    amount:         number,
    description:    string,
    reference_code: string,
  ): BalanceSheetEntry => ({
    id:             nextId--,
    project_id:     null,
    entry_type,
    asset_type:     entry_type === "Asset"     ? (sub as AssetType)     : null,
    liability_type: entry_type === "Liability" ? (sub as LiabilityType) : null,
    equity_type:    entry_type === "Equity"    ? (sub as EquityType)    : null,
    account_name,
    description,
    amount,
    entry_date:     today,
    reference_code,
    notes:          "Auto-derived from ERP modules; not editable.",
  });

  const out: BalanceSheetEntry[] = [];
  if (d.cash            > 0) out.push(mk("Asset",     "Current Asset",       "Cash & Bank (consolidated)",          d.cash,            "Sum of the latest period ending_balance per project from cash_flow", "AUTO-CASH"));
  if (d.ar              > 0) out.push(mk("Asset",     "Current Asset",       "Accounts Receivable (consolidated)",  d.ar,              "Sum of unpaid AR balances across every project",                      "AUTO-AR"));
  if (d.inventoryOnHand > 0) out.push(mk("Asset",     "Current Asset",       "Inventory on Hand",                   d.inventoryOnHand, "Sum of (total_value − total_value_used) across the inventory register", "AUTO-INV"));
  if (d.wipUnderbilled  > 0) out.push(mk("Asset",     "Current Asset",       "Construction in Progress",            d.wipUnderbilled,  "Earned revenue not yet billed (under-billed WIP rows)",               "AUTO-CIP"));
  if (d.ap              > 0) out.push(mk("Liability", "Current Liability",   "Accounts Payable (consolidated)",     d.ap,              "Sum of unpaid AP balances across every project",                      "AUTO-AP"));
  if (d.wipOverbilled   > 0) out.push(mk("Liability", "Current Liability",   "Billings in Excess of Costs",         d.wipOverbilled,   "Over-billings across all projects (WIP overbilled rows)",             "AUTO-OBE"));
  if (d.loans           > 0) out.push(mk("Liability", "Long-term Liability", "Loans Outstanding",                   d.loans,           "Latest closing_balance summed per loan facility",                     "AUTO-LOAN"));
  return out;
}

// ─── GLOBAL BALANCE SHEET VIEW ────────────────────────────────────────────────

type GlobalTab = "consolidated" | "firm-wide";

function GlobalBalanceSheetView({ canEdit, projects }: {
  canEdit:  boolean;
  projects: Project[];
}) {
  const [allEntries,    setAllEntries]    = useState<BalanceSheetEntry[]>([]);
  const [derived,       setDerived]       = useState<DerivedTotals>(ZERO_TOTALS);
  const [fetching,      setFetching]      = useState(false);
  const [showModal,     setShowModal]     = useState(false);
  const [deleting,      setDeleting]      = useState<BalanceSheetEntry | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [activeTab,     setActiveTab]     = useState<GlobalTab>("consolidated");
  const [showMigration, setShowMigration] = useState(false);
  const [filterType,    setFilterType]    = useState<EntryType | "All">("All");

  const { toasts, push } = useToast();

  const fetchEntries = useCallback(async () => {
    setFetching(true);
    setAllEntries([]);
    setDerived(ZERO_TOTALS);
    try {
      const [entries, totals] = await Promise.all([api.listAll(), fetchDerivedTotals()]);
      setAllEntries(entries);
      setDerived(totals);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to load entries.", "error");
    } finally {
      setFetching(false);
    }
  }, [push]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleCreate = async (form: BSFormData) => {
    setSaving(true);
    try {
      const row = await api.create(form);
      setAllEntries((p) => [row, ...p]);
      push("Entry posted successfully.");
      setShowModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to post entry.";
      push(msg, "error");
      if (msg.includes("not-null") || msg.includes("migration") || msg.includes("project_id")) {
        setShowMigration(true);
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      setAllEntries((p) => p.filter((e) => e.id !== deleting.id));
      push("Entry reversed.");
      setDeleting(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to reverse entry.", "error");
    } finally { setSaving(false); }
  };

  const firmWideManual = useMemo(
    () => allEntries.filter((e) => e.project_id === null),
    [allEntries],
  );
  const derivedEntries = useMemo(() => buildDerivedEntries(derived), [derived]);

  const consolidatedEntries = useMemo(
    () => [...derivedEntries, ...firmWideManual],
    [derivedEntries, firmWideManual],
  );

  const displayEntries = activeTab === "firm-wide" ? firmWideManual : consolidatedEntries;

  const firmWideCount     = firmWideManual.length;
  const derivedCount      = derivedEntries.length;
  const consolidatedCount = consolidatedEntries.length;

  const tabs: { key: GlobalTab; label: string; count: number; description: string }[] = [
    {
      key: "consolidated", label: "Consolidated", count: consolidatedCount,
      description: "Auto-derived totals from AR, AP, Inventory, WIP, Loans & Cash — plus any firm-wide journal entries not linked to a project.",
    },
    {
      key: "firm-wide", label: "Firm-wide Only", count: firmWideCount,
      description: "Manually-posted journal entries that aren't tied to a specific project.",
    },
  ];

  return (
    <div className="container mx-auto px-4 pb-20">

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg max-w-sm ${
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
        {showModal && (
          <PostEntryModal
            initial={makeEmptyForm(null)}
            onSave={handleCreate}
            onClose={() => setShowModal(false)}
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

      {/* Section heading */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground px-2">Firm Overview</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-2">
          Consolidated{" "}
          <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Balance Sheet</span>
        </h2>
        <p className="text-center text-sm font-normal text-muted-foreground max-w-xl mx-auto">
          Auto-generated from all posted journal entries across every project and firm-wide accounts.
          Post a new entry to update any section of the balance sheet.
        </p>
      </motion.div>

      <AnimatePresence>
        {showMigration && <MigrationBanner onDismiss={() => setShowMigration(false)} />}
      </AnimatePresence>

      <StatCards entries={consolidatedEntries} filterType={filterType} setFilterType={setFilterType} />

      <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-3xl font-bold">All Posted Entries</CardTitle>
              <p className="text-xs font-normal text-muted-foreground mt-1">
                The consolidated view is the authoritative firm-wide balance sheet.
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg shrink-0"
                style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Post Entry
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
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full tabular-nums ${
                  activeTab === tab.key ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"
                }`}>
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
              Loading balance sheet…
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
              <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M3 6h18M3 12h18M3 18h18"/>
              </svg>
              <p className="text-sm font-normal">
                {activeTab === "firm-wide"
                  ? "No firm-wide entries yet. Post an entry without linking a project."
                  : "Nothing to consolidate yet — no ERP activity and no firm-wide journal entries."}
              </p>
              {canEdit && (
                <button onClick={() => setShowModal(true)} className="text-xs text-primary hover:underline">
                  Post first entry
                </button>
              )}
            </div>
          ) : (
            <>
              <EntriesTable
                entries={displayEntries}
                canEdit={canEdit}
                onDelete={setDeleting}
                showProjectCol={activeTab === "consolidated"}
                projects={projects}
              />
              <AccountingBar entries={displayEntries} />
            </>
          )}

          {!fetching && (consolidatedEntries.length > 0 || allEntries.length > 0) && (
            <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs font-normal text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="tabular-nums">{displayEntries.length} shown</span>
                {derivedCount > 0 && activeTab === "consolidated" && (
                  <span className="tabular-nums text-emerald-400/70">{derivedCount} auto-derived</span>
                )}
                {firmWideCount > 0 && (
                  <span className="tabular-nums text-violet-400/70">{firmWideCount} firm-wide</span>
                )}
                <span className="tabular-nums text-primary/70">
                  {allEntries.length - firmWideCount} project-linked (excluded from consolidated)
                </span>
              </div>
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
  );
}

// ─── PROJECT PICKER VIEW ──────────────────────────────────────────────────────

function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects,      setProjects]      = useState<Project[]>([]);
  const [fetching,      setFetching]      = useState(true);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [entryCounts,   setEntryCounts]   = useState<Record<string, number>>({});
  const [firmWideCount, setFirmWideCount] = useState(0);

  const { toasts, push } = useToast();

  useEffect(() => {
    setFetching(true);
    api.projects()
      .then(async (data) => {
        setProjects(data);
        if (data.length > 0) {
          const ids = data.map((p) => p.id);
          const { data: counts } = await supabase
            .from("balance_sheet_entries").select("project_id").in("project_id", ids);
          if (counts) {
            const tally: Record<string, number> = {};
            (counts as { project_id: string }[]).forEach((r) => {
              tally[r.project_id] = (tally[r.project_id] ?? 0) + 1;
            });
            setEntryCounts(tally);
          }
          const { count } = await supabase
            .from("balance_sheet_entries")
            .select("id", { count: "exact", head: true })
            .is("project_id", null);
          setFirmWideCount(count ?? 0);
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

  const totalEntries = Object.values(entryCounts).reduce((a, b) => a + b, 0) + firmWideCount;

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
            >{t.msg}</motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="container mx-auto px-4 py-16">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="mb-12 text-center"
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">Finance Module</p>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
            Balance{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Sheet</span>
          </h1>
          <p className="text-xl md:text-2xl font-normal text-muted-foreground max-w-2xl mx-auto">
            Select a project to view its balance sheet, or scroll down for the firm-wide consolidated view.
          </p>
        </motion.div>

        {/* Summary stat cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: "Total Projects",        value: projects.length,                        sub: "in system",           color: "" },
            { label: "Projects with Entries",  value: Object.keys(entryCounts).length,        sub: "have BS records",     color: "" },
            { label: "Firm-wide Entries",      value: firmWideCount,                          sub: "not project-linked",  color: "text-violet-400" },
            { label: "Total BS Entries",       value: totalEntries,                           sub: "across all accounts", color: "" },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{card.label}</div>
              <div className={`text-3xl font-bold tabular-nums ${card.color || "text-foreground"}`}>{card.value}</div>
              <div className="text-xs font-normal text-muted-foreground mt-1">{card.sub}</div>
            </div>
          ))}
        </motion.div>

        {/* Projects card */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-16">
          <CardHeader className="pb-4">
            <CardTitle className="text-3xl font-bold">Projects</CardTitle>

            {/* Search + Status filter — both use the unified tokens */}
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
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, number or city…"
                  className={inputCls + " pl-9"}
                />
              </div>

              {/* Status filter */}
              <SelectWrapper className="w-full sm:w-52">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={selectCls}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s === "all"
                        ? "All Statuses"
                        : s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </SelectWrapper>

              <div className="inline-flex items-center px-4 py-2.5 text-xs font-normal tracking-normal text-muted-foreground border border-white/10 rounded-xl bg-white/5 whitespace-nowrap tabular-nums">
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
                <p className="text-sm font-normal">No projects found.</p>
                {search && (
                  <button
                    onClick={() => { setSearch(""); setStatusFilter("all"); }}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear filters
                  </button>
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
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs font-normal text-muted-foreground">
                <span className="tabular-nums">
                  {projects.length} total projects · {Object.keys(entryCounts).length} with balance sheet entries
                  {firmWideCount > 0 && ` · ${firmWideCount} firm-wide entries`}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {!fetching && <GlobalBalanceSheetView canEdit={true} projects={projects} />}
      </div>
    </div>
  );
}

// ─── ENTRIES VIEW (per-project) ───────────────────────────────────────────────

function EntriesView({ project, canEdit, onBack }: {
  project: Project; canEdit: boolean; onBack: () => void;
}) {
  const [entries,    setEntries]    = useState<BalanceSheetEntry[]>([]);
  const [fetching,   setFetching]   = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [deleting,   setDeleting]   = useState<BalanceSheetEntry | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [filterType, setFilterType] = useState<EntryType | "All">("All");

  const { toasts, push } = useToast();

  const fetchEntries = useCallback(async () => {
    setFetching(true);
    setEntries([]);
    try { setEntries(await api.list(project.id)); }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed to load entries.", "error"); }
    finally { setFetching(false); }
  }, [project.id, push]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleCreate = async (form: BSFormData) => {
    setSaving(true);
    try {
      const row = await api.create({ ...form, project_id: project.id });
      setEntries((p) => [...p, row]);
      push("Entry posted successfully.");
      setShowModal(false);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to post entry.", "error");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      setEntries((p) => p.filter((e) => e.id !== deleting.id));
      push("Entry reversed.");
      setDeleting(null);
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to reverse entry.", "error");
    } finally { setSaving(false); }
  };

  const status = project.status ?? "planning";

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
            >{t.msg}</motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showModal && (
          <PostEntryModal
            initial={makeEmptyForm(project.id)}
            onSave={handleCreate}
            onClose={() => setShowModal(false)}
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

      <div className="container mx-auto px-4 py-16">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="mb-10"
        >
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-normal text-muted-foreground hover:text-foreground transition-colors mb-6 group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            All Projects
          </button>

          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">Balance Sheet</p>

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
                <p className="text-xl font-normal text-muted-foreground mt-2">
                  {project.site_city}{project.site_country ? `, ${project.site_country}` : ""}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        <StatCards entries={entries} filterType={filterType} setFilterType={setFilterType} />

        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-3xl font-bold">Posted Entries</CardTitle>
                <p className="text-xs font-normal text-muted-foreground mt-1">
                  Balance sheet is auto-generated from posted journal entries. To adjust, post a correcting entry.
                </p>
              </div>
              {canEdit && (
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg shrink-0"
                  style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Post Entry
                </button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-24 gap-3 text-sm text-muted-foreground">
                <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                Loading balance sheet…
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M3 6h18M3 12h18M3 18h18"/>
                </svg>
                <p className="text-sm font-normal">No entries posted yet for this project.</p>
                {canEdit && (
                  <button onClick={() => setShowModal(true)} className="text-xs text-primary hover:underline">
                    Post first entry
                  </button>
                )}
              </div>
            ) : (
              <>
                <EntriesTable entries={entries} canEdit={canEdit} onDelete={setDeleting} showProjectCol={false} />
                <AccountingBar entries={entries} />
              </>
            )}

            {!fetching && entries.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs font-normal text-muted-foreground">
                <span className="tabular-nums">{entries.length} total entries</span>
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

export default function BalanceSheetPage({ projectId, canEdit = true }: Props) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,currency,site_address,site_city,site_country,start_date,expected_completion_date,created_at")
      .eq("id", projectId)
      .single()
      .then(({ data }) => { if (data) setSelectedProject(data as Project); });
  }, [projectId]);

  return (
    <AnimatePresence mode="wait">
      {selectedProject ? (
        <motion.div
          key={selectedProject.id}
          initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}
        >
          <EntriesView
            project={selectedProject}
            canEdit={canEdit}
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