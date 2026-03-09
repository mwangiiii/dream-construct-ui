"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetClass =
  | "Machinery" | "Vehicle" | "Equipment" | "Building" | "Land"
  | "Furniture" | "Computer" | "Intangible" | "Other";

type DepreciationMethod =
  | "Straight Line" | "Declining Balance" | "Double Declining Balance"
  | "Sum of Years Digits" | "Units of Production";

type YrKey = `yr_depreciation_${number}`;

// NOTE: previous_depreciation is intentionally absent — column was dropped.
// accumulated_depreciation and net_book_value are DB-GENERATED (read-only).
interface AssetRecord {
  id: number;
  assets_number: string;
  class: AssetClass;
  name: string;
  description: string;
  location: string;
  cost: number;
  salvage_value: number;
  transaction_code: string;
  transaction_date: string;
  start_date: string;
  useful_life_years: number;
  depreciation_method: DepreciationMethod;
  years: number;
  annual_depreciation: number;
  accumulated_depreciation: number; // GENERATED ALWAYS — never written
  net_book_value: number;           // GENERATED ALWAYS — never written
  year_and_date: string;
  created_at?: string;
  updated_at?: string;
  [key: YrKey]: number | null | undefined;
}

// FormData excludes all generated/auto fields — previous_depreciation intentionally absent
interface FormData {
  assets_number: string;
  class: AssetClass;
  name: string;
  description: string;
  location: string;
  cost: number | "";
  salvage_value: number | "";
  transaction_code: string;
  transaction_date: string;
  start_date: string;
  useful_life_years: number | "";
  depreciation_method: DepreciationMethod;
  years: number | "";
  annual_depreciation: number | "";
  year_and_date: string;
  [key: YrKey]: number | null | "" | undefined;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_CLASSES: AssetClass[] = [
  "Machinery","Vehicle","Equipment","Building","Land",
  "Furniture","Computer","Intangible","Other",
];

const DEPRECIATION_METHODS: DepreciationMethod[] = [
  "Straight Line","Declining Balance","Double Declining Balance",
  "Sum of Years Digits","Units of Production",
];

const CURRENT_YEAR = new Date().getFullYear();
const MAX_YEARS    = 50;
const TABLE        = "fixed_asset_equipment_depreciation";

// ─── Styles ───────────────────────────────────────────────────────────────────

const CLASS_STYLE: Record<AssetClass, { accent: string; badge: string; dot: string; row: string }> = {
  Machinery:  { accent:"text-amber-400",   badge:"bg-amber-500/10   border-amber-500/30   text-amber-300",   dot:"bg-amber-400",   row:"hover:bg-amber-950/30"   },
  Vehicle:    { accent:"text-sky-400",     badge:"bg-sky-500/10     border-sky-500/30     text-sky-300",     dot:"bg-sky-400",     row:"hover:bg-sky-950/30"     },
  Equipment:  { accent:"text-violet-400",  badge:"bg-violet-500/10  border-violet-500/30  text-violet-300",  dot:"bg-violet-400",  row:"hover:bg-violet-950/30"  },
  Building:   { accent:"text-emerald-400", badge:"bg-emerald-500/10 border-emerald-500/30 text-emerald-300", dot:"bg-emerald-400", row:"hover:bg-emerald-950/30" },
  Land:       { accent:"text-lime-400",    badge:"bg-lime-500/10    border-lime-500/30    text-lime-300",    dot:"bg-lime-400",    row:"hover:bg-lime-950/30"    },
  Furniture:  { accent:"text-orange-400",  badge:"bg-orange-500/10  border-orange-500/30  text-orange-300",  dot:"bg-orange-400",  row:"hover:bg-orange-950/30"  },
  Computer:   { accent:"text-cyan-400",    badge:"bg-cyan-500/10    border-cyan-500/30    text-cyan-300",    dot:"bg-cyan-400",    row:"hover:bg-cyan-950/30"    },
  Intangible: { accent:"text-pink-400",    badge:"bg-pink-500/10    border-pink-500/30    text-pink-300",    dot:"bg-pink-400",    row:"hover:bg-pink-950/30"    },
  Other:      { accent:"text-slate-400",   badge:"bg-slate-500/10   border-slate-500/30   text-slate-300",   dot:"bg-slate-400",   row:"hover:bg-slate-950/30"   },
};

const METHOD_STYLE: Record<DepreciationMethod, string> = {
  "Straight Line":            "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  "Declining Balance":        "bg-amber-500/10   border-amber-500/30   text-amber-300",
  "Double Declining Balance": "bg-orange-500/10  border-orange-500/30  text-orange-300",
  "Sum of Years Digits":      "bg-violet-500/10  border-violet-500/30  text-violet-300",
  "Units of Production":      "bg-sky-500/10     border-sky-500/30     text-sky-300",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency", currency: "KES",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v);

const fmtC = (v: number) =>
  new Intl.NumberFormat("en-KE", { notation: "compact", maximumFractionDigits: 1 }).format(v);

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + (d.includes("T") ? "" : "T00:00:00"))
        .toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-KE", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

/** Safely coerce form value to number (empty string / null / undefined → 0) */
const n = (v: number | "" | null | undefined): number =>
  v === "" || v === null || v === undefined ? 0 : Number(v);

function throwSb(error: { message?: string } | null, ctx: string): never {
  throw new Error(error?.message ?? `Supabase error during ${ctx}`);
}

// ─── Empty form factory ───────────────────────────────────────────────────────

function makeEmptyForm(): FormData {
  const base: FormData = {
    assets_number:       "",
    class:               "Machinery",
    name:                "",
    description:         "",
    location:            "",
    cost:                "",
    salvage_value:       "",
    transaction_code:    "",
    transaction_date:    new Date().toISOString().slice(0, 10),
    start_date:          new Date().toISOString().slice(0, 10),
    useful_life_years:   5,
    depreciation_method: "Straight Line",
    years:               1,
    annual_depreciation: "",
    year_and_date:       String(CURRENT_YEAR),
  };
  for (let i = 1; i <= MAX_YEARS; i++) {
    base[`yr_depreciation_${i}` as YrKey] = null;
  }
  return base;
}

// ─── Payload builder ─────────────────────────────────────────────────────────
// IMPORTANT: previous_depreciation is intentionally never included here.
// accumulated_depreciation and net_book_value are DB-generated and also excluded.

function toWritable(form: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    assets_number:       form.assets_number,
    class:               form.class,
    name:                form.name,
    description:         form.description,
    location:            form.location,
    cost:                n(form.cost),
    salvage_value:       n(form.salvage_value),
    transaction_code:    form.transaction_code,
    transaction_date:    form.transaction_date,
    start_date:          form.start_date,
    useful_life_years:   n(form.useful_life_years),
    depreciation_method: form.depreciation_method,
    years:               n(form.years),
    annual_depreciation: n(form.annual_depreciation),
    year_and_date:       form.year_and_date,
    updated_at:          new Date().toISOString(),
  };

  for (let i = 1; i <= MAX_YEARS; i++) {
    const key = `yr_depreciation_${i}` as YrKey;
    const val = form[key];
    payload[key] = (val === "" || val === undefined) ? null : val === null ? null : Number(val);
  }

  return payload;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

async function writeAudit(
  action: "INSERT" | "UPDATE" | "DELETE",
  recordId: number | null,
  oldData: object | null,
  newData: object | null,
  userId: string | null,
) {
  try {
    await supabase.from("audit_logs").insert([{
      table_name: TABLE,
      record_id:  recordId ? String(recordId) : null,
      action,
      old_data:   oldData,
      new_data:   newData,
      changed_by: userId ?? null,
    }]);
  } catch {
    console.warn("Audit log write failed — non-fatal");
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function getUid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

const api = {
  async list(): Promise<AssetRecord[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("year_and_date", { ascending: false })
      .order("assets_number",  { ascending: true });
    if (error) throwSb(error, "list");
    return (data ?? []) as AssetRecord[];
  },

  async create(form: FormData): Promise<AssetRecord> {
    const uid = await getUid();
    const { data, error } = await supabase
      .from(TABLE)
      .insert([toWritable(form)])
      .select()
      .single();
    if (error) throwSb(error, "create");
    const row = data as AssetRecord;
    await writeAudit("INSERT", row.id, null, row, uid);
    return row;
  },

  async update(id: number, form: FormData, prev: AssetRecord): Promise<AssetRecord> {
    const uid = await getUid();
    const { data, error } = await supabase
      .from(TABLE)
      .update(toWritable(form))
      .eq("id", id)
      .select()
      .single();
    if (error) throwSb(error, "update");
    const row = data as AssetRecord;
    await writeAudit("UPDATE", id, prev, row, uid);
    return row;
  },

  async remove(id: number, prev: AssetRecord): Promise<void> {
    const uid = await getUid();
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throwSb(error, "delete");
    await writeAudit("DELETE", id, prev, null, uid);
  },
};

// ─── Toast hook ───────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);
  const push = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);
  return { toasts, push };
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-foreground " +
  "placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 " +
  "focus:border-primary/40 transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function Sel<T extends string>({
  label, value, onChange, options,
}: {
  label: string; value: T; onChange: (v: T) => void; options: T[];
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className={inputCls + " appearance-none pr-10 font-medium tracking-wide text-sm"}
        >
          {options.map((o) => (
            <option key={o} value={o} className="bg-background text-foreground font-medium">{o}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>
    </Field>
  );
}

// ─── Asset Modal ──────────────────────────────────────────────────────────────

function AssetModal({
  initial, onSave, onClose, loading,
}: {
  initial: FormData & { id?: number; updated_at?: string };
  onSave: (d: FormData) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<FormData>({ ...initial });
  const isEdit = Boolean(initial.id);

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm((p) => ({ ...p, [k]: v }));
  const setDyn = (key: string, v: unknown) =>
    setForm((p) => ({ ...p, [key]: v }));

  const lifeYears  = Math.max(1, Math.min(MAX_YEARS, n(form.useful_life_years)));
  const startYear  = form.start_date
    ? new Date(form.start_date + "T00:00:00").getFullYear()
    : CURRENT_YEAR;
  const depBase    = Math.max(0, n(form.cost) - n(form.salvage_value));
  const accumulated = Array.from({ length: MAX_YEARS }, (_, i) => {
    const v = form[`yr_depreciation_${i + 1}` as YrKey];
    return v ? Number(v) : 0;
  }).reduce((s, v) => s + v, 0);
  const liveNBV = Math.max(0, n(form.cost) - accumulated);
  const pct     = n(form.cost) > 0 ? Math.min(100, Math.round((accumulated / n(form.cost)) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-3xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-xl bg-white/10"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            {isEdit ? "Edit Asset Record" : "New Asset Record"}
          </h2>
          {isEdit && initial.updated_at && (
            <span className="text-[10px] text-muted-foreground font-mono mr-auto ml-4">
              Last updated: {fmtDateTime(initial.updated_at)}
            </span>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 grid grid-cols-2 gap-4 max-h-[68vh] overflow-y-auto">

          {/* Core identity */}
          <Field label="Asset Number *">
            <input value={form.assets_number}
              onChange={(e) => set("assets_number", e.target.value)}
              placeholder="e.g. A-001" className={inputCls} />
          </Field>
          <Sel label="Class *" value={form.class} onChange={(v) => set("class", v)} options={ASSET_CLASSES} />

          <div className="col-span-2">
            <Field label="Asset Name *">
              <input value={form.name} onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Excavator" className={inputCls} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Description">
              <input value={form.description} onChange={(e) => set("description", e.target.value)}
                placeholder="Brief description" className={inputCls} />
            </Field>
          </div>

          <Field label="Location">
            <input value={form.location} onChange={(e) => set("location", e.target.value)}
              placeholder="e.g. Site 1" className={inputCls} />
          </Field>
          <Field label="Year / Period *">
            <input value={form.year_and_date} onChange={(e) => set("year_and_date", e.target.value)}
              placeholder="e.g. 2026" className={inputCls} />
          </Field>

          {/* Financials */}
          <Field label="Cost (KES) *">
            <input type="number" step="0.01" min="0"
              value={form.cost === "" ? "" : form.cost}
              onChange={(e) => set("cost", e.target.value === "" ? "" : parseFloat(e.target.value))}
              className={inputCls} />
          </Field>
          <Field label="Salvage Value (KES)">
            <input type="number" step="0.01" min="0"
              value={form.salvage_value === "" ? "" : form.salvage_value}
              onChange={(e) => set("salvage_value", e.target.value === "" ? "" : parseFloat(e.target.value))}
              className={inputCls} />
          </Field>

          <div className="col-span-2">
            <div className="px-4 py-2.5 rounded-xl border bg-white/3 border-white/8 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Depreciable Base
              </span>
              <span className="text-sm font-bold font-mono tabular-nums text-foreground">{fmt(depBase)}</span>
            </div>
          </div>

          {/* Transaction */}
          <Field label="Transaction Code *">
            <input value={form.transaction_code}
              onChange={(e) => set("transaction_code", e.target.value)}
              placeholder="e.g. TX-001" className={inputCls} />
          </Field>
          <Field label="Transaction Date *">
            <input type="date" value={form.transaction_date}
              onChange={(e) => set("transaction_date", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Start Date *">
            <input type="date" value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Useful Life (Years) *">
            <input type="number" min="1"
              value={form.useful_life_years === "" ? "" : form.useful_life_years}
              onChange={(e) => set("useful_life_years", e.target.value === "" ? "" : parseInt(e.target.value))}
              className={inputCls} />
          </Field>

          <Sel label="Depreciation Method *" value={form.depreciation_method}
            onChange={(v) => set("depreciation_method", v)} options={DEPRECIATION_METHODS} />
          <Field label="Years Elapsed">
            <input type="number" min="0"
              value={form.years === "" ? "" : form.years}
              onChange={(e) => set("years", e.target.value === "" ? "" : parseInt(e.target.value))}
              className={inputCls} />
          </Field>

          <Field label="Annual Depreciation (KES)">
            <input type="number" step="0.01" min="0"
              value={form.annual_depreciation === "" ? "" : form.annual_depreciation}
              onChange={(e) => set("annual_depreciation", e.target.value === "" ? "" : parseFloat(e.target.value))}
              className={inputCls} />
          </Field>

          {/* Last Updated — always read-only, auto-stamped on save */}
          <Field label="Last Updated (automatic)">
            <input
              readOnly
              value={isEdit && initial.updated_at ? fmtDateTime(initial.updated_at) : "Set automatically on save"}
              className={inputCls + " opacity-40 cursor-not-allowed select-none"}
            />
          </Field>

          {/* Per-year depreciation inputs */}
          <div className="col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Depreciation by Year
              </span>
              <span className="text-[10px] text-muted-foreground/60">
                ({lifeYears} yr{lifeYears !== 1 ? "s" : ""} · starting {startYear})
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {Array.from({ length: lifeYears }, (_, i) => {
                const yr      = i + 1;
                const key     = `yr_depreciation_${yr}` as YrKey;
                const val     = form[key];
                const calYear = startYear + i;
                return (
                  <Field key={key} label={`Yr ${yr} · ${calYear} (KES)`}>
                    <input
                      type="number" step="0.01" min="0"
                      value={val === null || val === undefined || val === "" ? "" : String(val)}
                      onChange={(e) =>
                        setDyn(key, e.target.value === "" ? null : parseFloat(e.target.value))
                      }
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </Field>
                );
              })}
            </div>
          </div>

          {/* Live summary */}
          <div className="col-span-2 grid grid-cols-3 gap-3">
            <div className="px-3 py-2.5 rounded-xl border bg-white/3 border-white/8 text-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Accumulated</div>
              <div className="text-sm font-bold font-mono tabular-nums text-amber-400">{fmt(accumulated)}</div>
            </div>
            <div className={`px-3 py-2.5 rounded-xl border text-center ${
              liveNBV > 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"
            }`}>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Net Book Value</div>
              <div className={`text-sm font-bold font-mono tabular-nums ${liveNBV > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {fmt(liveNBV)}
              </div>
            </div>
            <div className="px-3 py-2.5 rounded-xl border bg-white/3 border-white/8 text-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">% Depreciated</div>
              <div className="text-sm font-bold font-mono tabular-nums text-primary">{pct}%</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={loading}
            className="px-5 py-2 text-sm font-medium rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
          >
            {loading && (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {isEdit ? "Save Changes" : "Add Asset"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({
  asset, onConfirm, onClose, loading,
}: {
  asset: AssetRecord; onConfirm: () => void; onClose: () => void; loading: boolean;
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
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Delete Asset Record</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Permanently delete{" "}
              <span className="text-foreground font-medium">{asset.name}</span>{" "}
              (<span className="font-mono text-primary text-xs">{asset.assets_number}</span>)?
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
            {loading && (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            Delete Record
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FixedAssetEquipmentDepreciationPage() {
  const [assets,       setAssets]       = useState<AssetRecord[]>([]);
  const [fetching,     setFetching]     = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterClass,  setFilterClass]  = useState<AssetClass | "All">("All");
  const [filterYear,   setFilterYear]   = useState<string | "All">("All");
  const [filterMethod, setFilterMethod] = useState<DepreciationMethod | "All">("All");
  const [expanded,     setExpanded]     = useState<Record<string, boolean>>({});
  const [modal,        setModal]        = useState<null | "create" | "edit">(null);
  const [editing,      setEditing]      = useState<AssetRecord | null>(null);
  const [deleting,     setDeleting]     = useState<AssetRecord | null>(null);
  const [saving,       setSaving]       = useState(false);
  const { toasts, push } = useToast();

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAssets = useCallback(async () => {
    setFetching(true);
    setAssets([]);
    try {
      const data = await api.list();
      setAssets(data);
      const years = [...new Set(data.map((a) => a.year_and_date))];
      setExpanded(Object.fromEntries(years.map((y) => [y, true])));
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to load assets.", "error");
    } finally {
      setFetching(false);
    }
  }, [push]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const handleCreate = async (form: FormData) => {
    setSaving(true);
    try {
      const row = await api.create(form);
      setAssets((p) => [row, ...p]);
      push("Asset record added.");
      setModal(null);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to add record.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: FormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form, editing);
      setAssets((p) => p.map((a) => (a.id === editing.id ? row : a)));
      push("Asset record updated.");
      setModal(null);
      setEditing(null);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to update record.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id, deleting);
      setAssets((p) => p.filter((a) => a.id !== deleting.id));
      push("Asset record deleted.");
      setDeleting(null);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to delete record.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────
  const availableYears = useMemo(
    () => [...new Set(assets.map((a) => a.year_and_date))].sort((a, b) => b.localeCompare(a)),
    [assets],
  );

  const filtered = useMemo(
    () => assets.filter((a) => {
      if (filterClass  !== "All" && a.class               !== filterClass)  return false;
      if (filterYear   !== "All" && a.year_and_date        !== filterYear)   return false;
      if (filterMethod !== "All" && a.depreciation_method  !== filterMethod) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          a.assets_number.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q) ||
          a.transaction_code.toLowerCase().includes(q) ||
          (a.description ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    }),
    [assets, filterClass, filterYear, filterMethod, search],
  );

  const grouped = useMemo(() => {
    const byYear: Record<string, Record<AssetClass, AssetRecord[]>> = {};
    filtered.forEach((a) => {
      if (!byYear[a.year_and_date])          byYear[a.year_and_date] = {} as Record<AssetClass, AssetRecord[]>;
      if (!byYear[a.year_and_date][a.class]) byYear[a.year_and_date][a.class] = [];
      byYear[a.year_and_date][a.class].push(a);
    });
    return byYear;
  }, [filtered]);

  const sortedYears = useMemo(
    () => Object.keys(grouped).sort((a, b) => b.localeCompare(a)),
    [grouped],
  );

  const grandTotals = useMemo(() => ({
    totalCost:   assets.reduce((s, a) => s + Number(a.cost),                    0),
    totalAccum:  assets.reduce((s, a) => s + Number(a.accumulated_depreciation), 0),
    totalNBV:    assets.reduce((s, a) => s + Number(a.net_book_value),           0),
    totalAnnual: assets.reduce((s, a) => s + Number(a.annual_depreciation),      0),
  }), [assets]);

  const classCounts = useMemo(
    () => Object.fromEntries(
      ASSET_CLASSES.map((c) => [c, assets.filter((a) => a.class === c).length])
    ) as Record<AssetClass, number>,
    [assets],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">

      {/* ── Toasts ── */}
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
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {modal === "create" && (
          <AssetModal
            initial={makeEmptyForm()}
            onSave={handleCreate}
            onClose={() => setModal(null)}
            loading={saving}
          />
        )}
        {modal === "edit" && editing && (
          <AssetModal
            initial={{ ...editing } as unknown as FormData & { id: number; updated_at?: string }}
            onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
          />
        )}
        {deleting && (
          <DeleteConfirm
            asset={deleting}
            onConfirm={handleDelete}
            onClose={() => setDeleting(null)}
            loading={saving}
          />
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-16">

        {/* ── Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="mb-12 text-center"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">
            Finance Module
          </p>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
            Fixed Asset{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Depreciation
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Track asset depreciation schedules, methods, and net book values.
          </p>
        </motion.div>

        {/* ── Grand summary cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: "Total Asset Cost",    value: fmtC(grandTotals.totalCost),   full: fmt(grandTotals.totalCost),   color: "text-foreground"  },
            { label: "Accumulated Depr.",   value: fmtC(grandTotals.totalAccum),  full: fmt(grandTotals.totalAccum),  color: "text-amber-400"   },
            { label: "Net Book Value",      value: fmtC(grandTotals.totalNBV),    full: fmt(grandTotals.totalNBV),    color: "text-emerald-400" },
            { label: "Annual Depreciation", value: fmtC(grandTotals.totalAnnual), full: fmt(grandTotals.totalAnnual), color: "text-primary"     },
          ].map((card) => (
            <div key={card.label}
              className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5"
              title={card.full}
            >
              <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">
                {card.label}
              </div>
              <div className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">{card.full}</div>
            </div>
          ))}
        </motion.div>

        {/* ── Class filter chips ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.13 }}
          className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mb-8"
        >
          {ASSET_CLASSES.map((cls) => {
            const s = CLASS_STYLE[cls];
            const isActive = filterClass === cls;
            return (
              <button key={cls}
                onClick={() => setFilterClass(isActive ? "All" : cls)}
                className={`rounded-2xl border p-3 text-left transition-all duration-200 backdrop-blur-sm bg-white/5 ${
                  isActive
                    ? "border-white/20 ring-1 ring-white/20 scale-[1.02]"
                    : "border-white/10 hover:border-white/20 hover:scale-[1.01]"
                }`}
              >
                <div className={`text-[9px] uppercase tracking-widest font-semibold mb-1 ${s.accent}`}>{cls}</div>
                <div className="text-xl font-bold tabular-nums text-foreground">{classCounts[cls] ?? 0}</div>
              </button>
            );
          })}
        </motion.div>

        {/* ── Main register card ── */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-3xl font-bold">Asset Register</CardTitle>
              <button
                onClick={() => setModal("create")}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg"
                style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Asset
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by asset number, name, location or code…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all"
                />
              </div>

              <div className="relative">
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
                  className={inputCls + " appearance-none pr-10 font-medium tracking-wide text-sm min-w-[7.5rem]"}>
                  <option value="All" className="bg-background text-foreground font-medium">All Years</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y} className="bg-background text-foreground font-medium">{y}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
                </span>
              </div>

              <div className="relative">
                <select value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value as DepreciationMethod | "All")}
                  className={inputCls + " appearance-none pr-10 font-medium tracking-wide text-sm min-w-[10rem]"}>
                  <option value="All" className="bg-background text-foreground font-medium">All Methods</option>
                  {DEPRECIATION_METHODS.map((m) => (
                    <option key={m} value={m} className="bg-background text-foreground font-medium">{m}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
                </span>
              </div>

              <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
                {filtered.length} / {assets.length} shown
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
                <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                Loading asset register…
              </div>
            ) : sortedYears.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                <p className="text-sm">No asset records found.</p>
                {(search || filterClass !== "All" || filterYear !== "All" || filterMethod !== "All") && (
                  <button
                    onClick={() => { setSearch(""); setFilterClass("All"); setFilterYear("All"); setFilterMethod("All"); }}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {sortedYears.map((year) => {
                  const isOpen     = expanded[year] ?? true;
                  const yearAssets = ASSET_CLASSES.flatMap((c) => grouped[year]?.[c] ?? []);
                  const yC  = yearAssets.reduce((s, a) => s + Number(a.cost),                    0);
                  const yA  = yearAssets.reduce((s, a) => s + Number(a.accumulated_depreciation), 0);
                  const yN  = yearAssets.reduce((s, a) => s + Number(a.net_book_value),           0);
                  const yAn = yearAssets.reduce((s, a) => s + Number(a.annual_depreciation),      0);

                  return (
                    <div key={year}>
                      {/* Year toggle */}
                      <button
                        onClick={() => setExpanded((p) => ({ ...p, [year]: !p[year] }))}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-primary/70" />
                          <span className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{year}</span>
                          <Badge className="text-xs px-2.5 py-0.5 font-mono border rounded-full bg-primary/10 border-primary/20 text-primary">
                            {yearAssets.length}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-5">
                          <span className="text-xs text-muted-foreground tabular-nums hidden md:block">
                            Cost {fmtC(yC)} · Annual {fmtC(yAn)}
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-emerald-400">NBV {fmtC(yN)}</span>
                          <svg
                            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div key={`y-${year}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            style={{ overflow: "hidden" }}
                          >
                            {ASSET_CLASSES.filter((cls) => grouped[year]?.[cls]?.length > 0).map((cls) => {
                              const s    = CLASS_STYLE[cls];
                              const rows = grouped[year][cls];
                              const cC   = rows.reduce((s, a) => s + Number(a.cost),                    0);
                              const cA   = rows.reduce((s, a) => s + Number(a.accumulated_depreciation), 0);
                              const cN   = rows.reduce((s, a) => s + Number(a.net_book_value),           0);
                              const cAn  = rows.reduce((s, a) => s + Number(a.annual_depreciation),      0);

                              // Yr columns scoped to this class group's max useful life
                              const clsMaxLife = Math.min(
                                rows.reduce((m, a) => Math.max(m, Number(a.useful_life_years) || 0), 0),
                                MAX_YEARS,
                              );

                              return (
                                <div key={cls} className="border-t border-white/5">
                                  {/* Class sub-header */}
                                  <div className="flex items-center justify-between px-8 py-2.5"
                                    style={{ background: "rgba(255,255,255,0.02)" }}>
                                    <div className="flex items-center gap-2">
                                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                      <span className={`text-[11px] font-bold uppercase tracking-widest ${s.accent}`}>{cls}</span>
                                      <Badge className={`text-[10px] px-2 py-0 font-mono border rounded-full ${s.badge}`}>
                                        {rows.length}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs tabular-nums">
                                      <span className="text-muted-foreground hidden md:block">
                                        Cost {fmtC(cC)} · Accum {fmtC(cA)}
                                      </span>
                                      <span className="text-emerald-400 font-semibold">NBV {fmtC(cN)}</span>
                                    </div>
                                  </div>

                                  {/* Table */}
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-y border-white/6"
                                          style={{ background: "rgba(255,255,255,0.03)" }}>
                                          {[
                                            "Asset #", "Name", "Location",
                                            "Cost", "Salvage", "Useful Life", "Method",
                                            "% Depr.", "Yrs", "Annual Depr.",
                                            ...Array.from({ length: clsMaxLife }, (_, i) => {
                                              const sy = rows[0]?.start_date
                                                ? new Date(rows[0].start_date + "T00:00:00").getFullYear()
                                                : CURRENT_YEAR;
                                              return `Yr ${i + 1} (${sy + i})`;
                                            }),
                                            "Accumulated", "Net Book Value",
                                            "Tx Code", "Tx Date", "Start Date", "Last Updated",
                                            "Actions",
                                          ].map((h) => (
                                            <th key={h}
                                              className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                                              {h}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>

                                      <tbody>
                                        {rows.map((asset, ri) => {
                                          const pct = asset.cost > 0
                                            ? Math.min(100, Math.round(
                                                (Number(asset.accumulated_depreciation) / Number(asset.cost)) * 100
                                              ))
                                            : 0;
                                          const assetSY = asset.start_date
                                            ? new Date(asset.start_date + "T00:00:00").getFullYear()
                                            : CURRENT_YEAR;

                                          return (
                                            <motion.tr key={asset.id}
                                              initial={{ opacity: 0, x: -6 }}
                                              animate={{ opacity: 1, x: 0 }}
                                              transition={{ delay: ri * 0.02, duration: 0.16 }}
                                              className={`border-b border-white/5 transition-colors ${s.row}`}
                                            >
                                              <td className="px-4 py-3.5 whitespace-nowrap">
                                                <span className="font-mono text-xs font-semibold text-primary">
                                                  {asset.assets_number}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap font-medium text-foreground">
                                                <div>
                                                  {asset.name}
                                                  {asset.description && (
                                                    <div className="text-xs text-muted-foreground">{asset.description}</div>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                                                {asset.location || "—"}
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap">
                                                <span className="text-sm font-semibold tabular-nums text-foreground font-mono">
                                                  {fmt(Number(asset.cost))}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap">
                                                <span className="text-xs tabular-nums text-muted-foreground font-mono">
                                                  {fmt(Number(asset.salvage_value))}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap text-xs text-center text-muted-foreground">
                                                {asset.useful_life_years}y
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs ${METHOD_STYLE[asset.depreciation_method]}`}>
                                                  {asset.depreciation_method}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap">
                                                <div className="flex flex-col items-start gap-1">
                                                  <span className="text-sm font-semibold tabular-nums text-amber-300">{pct}%</span>
                                                  <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div className="h-full bg-amber-400/70 rounded-full transition-all duration-500"
                                                      style={{ width: `${pct}%` }} />
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap text-xs text-center text-muted-foreground">
                                                {asset.years}
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap">
                                                <span className="text-sm font-semibold tabular-nums text-amber-400 font-mono">
                                                  {fmt(Number(asset.annual_depreciation))}
                                                </span>
                                              </td>

                                              {/* Per-year cells */}
                                              {Array.from({ length: clsMaxLife }, (_, i) => {
                                                const yr  = i + 1;
                                                const key = `yr_depreciation_${yr}` as YrKey;
                                                const val = asset[key];
                                                const hasVal = val !== null && val !== undefined && Number(val) > 0;
                                                return (
                                                  <td key={key} className="px-4 py-3.5 whitespace-nowrap"
                                                    title={`Year ${yr} (${assetSY + i})`}>
                                                    {hasVal
                                                      ? <span className="text-xs tabular-nums text-sky-300 font-mono">{fmt(Number(val))}</span>
                                                      : <span className="text-xs text-white/20">—</span>
                                                    }
                                                  </td>
                                                );
                                              })}

                                              <td className="px-4 py-3.5 whitespace-nowrap">
                                                <span className="text-sm tabular-nums text-amber-400 font-mono font-semibold">
                                                  {fmt(Number(asset.accumulated_depreciation))}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap">
                                                <span className={`text-sm font-bold tabular-nums font-mono ${
                                                  Number(asset.net_book_value) > 0 ? "text-emerald-400" : "text-rose-400"
                                                }`}>
                                                  {fmt(Number(asset.net_book_value))}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap">
                                                <span className="font-mono text-xs text-muted-foreground">
                                                  {asset.transaction_code}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                                                {fmtDate(asset.transaction_date)}
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                                                {fmtDate(asset.start_date)}
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground font-mono">
                                                {fmtDateTime(asset.updated_at)}
                                              </td>
                                              <td className="px-4 py-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                  <button
                                                    onClick={() => { setEditing(asset); setModal("edit"); }}
                                                    title="Edit"
                                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                                                  >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                    </svg>
                                                  </button>
                                                  <button
                                                    onClick={() => setDeleting(asset)}
                                                    title="Delete"
                                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                                  >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                      <polyline points="3 6 5 6 21 6"/>
                                                      <path d="M19 6l-1 14H6L5 6"/>
                                                      <path d="M10 11v6M14 11v6"/>
                                                      <path d="M9 6V4h6v2"/>
                                                    </svg>
                                                  </button>
                                                </div>
                                              </td>
                                            </motion.tr>
                                          );
                                        })}
                                      </tbody>

                                      {/* Class total footer */}
                                      <tfoot>
                                        <tr className="border-t border-white/10"
                                          style={{ background: "rgba(255,255,255,0.02)" }}>
                                          <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground" colSpan={3}>
                                            {cls} Total
                                          </td>
                                          {/* Cost */}
                                          <td className="px-4 py-2.5 text-sm font-bold tabular-nums text-foreground font-mono">
                                            {fmt(cC)}
                                          </td>
                                          {/* salvage + useful life + method + pct% + yrs = 5 cols */}
                                          <td colSpan={5} />
                                          {/* Annual */}
                                          <td className="px-4 py-2.5 text-sm font-bold tabular-nums text-amber-400 font-mono">
                                            {fmt(cAn)}
                                          </td>
                                          {/* Per-year totals */}
                                          {Array.from({ length: clsMaxLife }, (_, i) => {
                                            const yr  = i + 1;
                                            const key = `yr_depreciation_${yr}` as YrKey;
                                            const tot = rows.reduce((s, a) => s + (Number(a[key]) || 0), 0);
                                            return (
                                              <td key={key} className="px-4 py-2.5 text-xs font-bold tabular-nums text-sky-300 font-mono">
                                                {tot > 0 ? fmt(tot) : "—"}
                                              </td>
                                            );
                                          })}
                                          {/* Accumulated */}
                                          <td className="px-4 py-2.5 text-sm font-bold tabular-nums text-amber-400 font-mono">
                                            {fmt(cA)}
                                          </td>
                                          {/* NBV */}
                                          <td className="px-4 py-2.5 text-sm font-bold tabular-nums text-emerald-400 font-mono">
                                            {fmt(cN)}
                                          </td>
                                          {/* tx code + tx date + start date + last updated + actions = 5 cols */}
                                          <td colSpan={5} />
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Year total bar */}
                            <div className="px-6 py-3.5 flex flex-wrap items-center gap-6 text-xs font-mono border-t border-white/8 bg-white/3">
                              <span className="text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wider">
                                {year} Total
                              </span>
                              <span className="text-foreground">Cost {fmt(yC)}</span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-amber-400">Accumulated {fmt(yA)}</span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-emerald-400">NBV {fmt(yN)}</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                {/* Grand total bar */}
                {assets.length > 0 && (
                  <div className="px-6 py-4 flex flex-wrap items-center gap-6 text-xs font-mono bg-emerald-950/20">
                    <span className="text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wider">
                      Grand Total
                    </span>
                    <span className="text-foreground">Cost {fmt(grandTotals.totalCost)}</span>
                    <span className="text-muted-foreground">−</span>
                    <span className="text-amber-400">Accum. {fmt(grandTotals.totalAccum)}</span>
                    <span className="text-muted-foreground">=</span>
                    <span className="text-emerald-400 font-bold">NBV {fmt(grandTotals.totalNBV)}</span>
                    <Badge className="ml-auto bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                      {assets.length} assets · Annual {fmt(grandTotals.totalAnnual)}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            {!fetching && assets.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {assets.length} total assets · {availableYears.length} period{availableYears.length !== 1 ? "s" : ""}
                </span>
                <button onClick={fetchAssets}
                  className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
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