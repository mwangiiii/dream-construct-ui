"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { VendorSelect } from "@/components/finance/VendorSelect";

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

interface InventoryItem {
  id:                     number;
  project_id:             string;
  factorial_code:         string;
  description:            string;
  serial_number:          string;
  vendor:                 string;
  vendor_id:              string | null;
  quantity_of_item:       number;
  cost_per_quantity:      number;
  total_value:            number;
  quantity_used?:         number;
  total_value_used?:      number;
  projects_used?:         string[];
  usage:                  string;
  quantity_remaining?:    number;
  date:                   string;
  notes:                  string;
  created_at?:            string;
  updated_at?:            string;
}

type FormData = Omit<InventoryItem,
  | "id"
  | "total_value"
  | "total_value_used"
  | "quantity_remaining"
  | "created_at"
  | "updated_at"
> & { quantity_used?: number; projects_used?: string[] };

interface PMLineItem {
  id: number;
  material_name: string;
  material_quantity: number;
  material_unit: string;
  price_per_unit: number;
  total_price: number;
  tender_company_id: string | null;
  company_name: string | null;
  company_id: string | null;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const USAGE_CATEGORIES = [
  "Foundation", "Superstructure", "Formwork", "Roofing",
  "Finishing", "Electrical", "Plumbing", "Glazing", "Other",
] as const;
type UsageCategory = typeof USAGE_CATEGORIES[number];

const USAGE_STYLE: Record<UsageCategory, { badge: string; dot: string; row: string; accent: string }> = {
  Foundation:     { badge: "bg-amber-500/10   border-amber-500/30   text-amber-300",   dot: "bg-amber-400",   row: "hover:bg-amber-950/30",   accent: "text-amber-400"   },
  Superstructure: { badge: "bg-violet-500/10  border-violet-500/30  text-violet-300",  dot: "bg-violet-400",  row: "hover:bg-violet-950/30",  accent: "text-violet-400"  },
  Formwork:       { badge: "bg-orange-500/10  border-orange-500/30  text-orange-300",  dot: "bg-orange-400",  row: "hover:bg-orange-950/30",  accent: "text-orange-400"  },
  Roofing:        { badge: "bg-sky-500/10     border-sky-500/30     text-sky-300",     dot: "bg-sky-400",     row: "hover:bg-sky-950/30",     accent: "text-sky-400"     },
  Finishing:      { badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", dot: "bg-emerald-400", row: "hover:bg-emerald-950/30", accent: "text-emerald-400" },
  Electrical:     { badge: "bg-yellow-500/10  border-yellow-500/30  text-yellow-300",  dot: "bg-yellow-400",  row: "hover:bg-yellow-950/30",  accent: "text-yellow-400"  },
  Plumbing:       { badge: "bg-cyan-500/10    border-cyan-500/30    text-cyan-300",    dot: "bg-cyan-400",    row: "hover:bg-cyan-950/30",    accent: "text-cyan-400"    },
  Glazing:        { badge: "bg-pink-500/10    border-pink-500/30    text-pink-300",    dot: "bg-pink-400",    row: "hover:bg-pink-950/30",    accent: "text-pink-400"    },
  Other:          { badge: "bg-slate-500/10   border-slate-500/30   text-slate-300",   dot: "bg-slate-400",   row: "hover:bg-slate-950/30",   accent: "text-slate-400"   },
};

const getUsageStyle = (usage: string) =>
  USAGE_STYLE[(usage as UsageCategory)] ?? USAGE_STYLE.Other;

const PROJECT_STATUS_STYLE: Record<string, string> = {
  planning:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  on_hold:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const makeEmptyForm = (projectId: string): FormData => ({
  project_id:        projectId,
  factorial_code:    "",
  description:       "",
  serial_number:     "",
  vendor:            "",
  vendor_id:         null,
  quantity_of_item:  0,
  cost_per_quantity: 0,
  quantity_used:     0,
  projects_used:     [],
  usage:             "Other",
  date:              new Date().toISOString().slice(0, 10),
  notes:             "",
});

const fmt = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 2 }).format(n);

const fmtQty = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(n);

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-foreground " +
  "placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 " +
  "focus:border-primary/40 transition-all";

const selectCls =
  "w-full px-3 py-2.5 rounded-xl text-sm border text-foreground focus:outline-none " +
  "focus:ring-1 focus:ring-primary/60 focus:border-primary/40 transition-all " +
  "appearance-none pr-10 cursor-pointer bg-[hsl(var(--background))] border-white/10 " +
  "[&>option]:bg-[hsl(var(--background))] [&>option]:text-foreground [color-scheme:dark]";

const SelectChevron = () => (
  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  </span>
);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground/60 italic">{hint}</span>}
    </div>
  );
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

  async list(projectId: string): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .eq("project_id", projectId)
      .order("date", { ascending: false })
      .order("factorial_code", { ascending: true });
    if (error) throwSb(error, "list");
    return (data ?? []) as InventoryItem[];
  },

  async pmLineItems(projectId: string): Promise<PMLineItem[]> {
    const { data, error } = await supabase
      .from("project_financials")
      .select(`
        id, material_name, material_quantity, material_unit,
        price_per_unit, total_price, tender_company_id,
        tender_company:tender_companies(id, name)
      `)
      .eq("project_id", projectId)
      .not("material_name", "is", null)
      .order("material_name");
    if (error) return [];
    return ((data ?? []) as any[]).map(r => ({
      id:                r.id,
      material_name:     r.material_name,
      material_quantity: Number(r.material_quantity) || 0,
      material_unit:     r.material_unit || "units",
      price_per_unit:    Number(r.price_per_unit) || 0,
      total_price:       Number(r.total_price) || 0,
      tender_company_id: r.tender_company_id,
      company_name:      r.tender_company?.name ?? null,
      company_id:        r.tender_company?.id ?? null,
    }));
  },

  async create(body: Partial<FormData>): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from("inventory").insert([body]).select().single();
    if (error) throwSb(error, "create");
    return data as InventoryItem;
  },

  async update(id: number, body: Partial<FormData>): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from("inventory")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id).select().single();
    if (error) throwSb(error, "update");
    return data as InventoryItem;
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase.from("inventory").delete().eq("id", id);
    if (error) throwSb(error, "delete");
  },
};

// ─── TOAST ────────────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);
  const push = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, push };
}

function ToastStack({ toasts }: { toasts: { id: number; msg: string; type: "success" | "error" }[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id}
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${
              t.type === "success" ? "bg-emerald-950/80 border-emerald-500/25 text-emerald-300" : "bg-rose-950/80 border-rose-500/25 text-rose-300"
            }`}
          >{t.msg}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── ITEM MODAL ───────────────────────────────────────────────────────────────

function ItemModal({
  initial, onSave, onClose, loading, linkedConsumption, project,
}: {
  initial: FormData & { id?: number };
  onSave: (d: Partial<FormData>) => void;
  onClose: () => void;
  loading: boolean;
  linkedConsumption?: { total_used: number; project_count: number } | null;
  project: Project;
}) {
  const [form, setForm] = useState<FormData>({ ...initial });
  const [pmItems, setPMItems] = useState<PMLineItem[]>([]);
  const [selectedPM, setSelectedPM] = useState<string>("");
  const [pmLoading, setPMLoading] = useState(false);
  const isEdit = Boolean(initial.id);

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  // quantity_used is always driven by PM Material Tracking — never manually editable
  const qtyUsed = linkedConsumption?.total_used ?? (form.quantity_used ?? 0);
  const liveTotal          = (form.quantity_of_item || 0) * (form.cost_per_quantity || 0);
  const liveUsedValue      = qtyUsed * (form.cost_per_quantity || 0);
  const liveRemainingQty   = Math.max(0, (form.quantity_of_item || 0) - qtyUsed);
  const liveRemainingValue = liveRemainingQty * (form.cost_per_quantity || 0);

  useEffect(() => {
    if (!project.id) return;
    setPMLoading(true);
    api.pmLineItems(project.id).then(items => {
      setPMItems(items);
      setPMLoading(false);
    });
  }, [project.id]);

  const handlePMImport = (pmId: string) => {
    setSelectedPM(pmId);
    if (!pmId) return;
    const pm = pmItems.find(p => String(p.id) === pmId);
    if (!pm) return;
    setForm(prev => ({
      ...prev,
      description:       pm.material_name || prev.description,
      quantity_of_item:  pm.material_quantity || prev.quantity_of_item,
      cost_per_quantity: pm.price_per_unit || prev.cost_per_quantity,
      vendor:            pm.company_name || prev.vendor,
      vendor_id:         null, // PM uses tender_companies, not companies table
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-3xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-xl bg-[#0d0d0d]/95"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              {isEdit ? "Edit Inventory Item" : "New Inventory Item"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {project.project_number} — {project.title}
            </p>
          </div>
          <button onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 max-h-[68vh] overflow-y-auto space-y-4">

          {/* ── Import from PM ── */}
          {!isEdit && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">
                Import from PM Financials
              </p>
              <div className="relative">
                <select
                  value={selectedPM}
                  onChange={e => handlePMImport(e.target.value)}
                  disabled={pmLoading}
                  className={selectCls}
                >
                  <option value="">
                    {pmLoading ? "Loading PM items…" : `— Select a material from ${project.project_number} —`}
                  </option>
                  {pmItems.map(pm => (
                    <option key={pm.id} value={String(pm.id)}>
                      {pm.material_name}
                      {pm.company_name ? ` (${pm.company_name})` : ""}
                      {" — "}
                      {pm.material_quantity} {pm.material_unit} @ KES {pm.price_per_unit.toLocaleString("en-KE")}
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1.5 italic">
                Selecting a PM item auto-fills description, quantity, cost and vendor below.
              </p>
            </div>
          )}

          {/* ── Form fields ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Factorial Code *">
              <input value={form.factorial_code}
                onChange={e => set("factorial_code", e.target.value)}
                placeholder="e.g. F-001" className={inputCls} required />
            </Field>

            <Field label="Serial Number">
              <input value={form.serial_number ?? ""}
                onChange={e => set("serial_number", e.target.value)}
                placeholder="e.g. SN-1001" className={inputCls} />
            </Field>

            <Field label="Date *">
              <input type="date" value={form.date}
                onChange={e => set("date", e.target.value)}
                className={inputCls + " [color-scheme:dark]"} required />
            </Field>

            <div className="sm:col-span-3">
              <Field label="Description *">
                <input value={form.description}
                  onChange={e => set("description", e.target.value)}
                  placeholder="e.g. 50kg Cement Bag" className={inputCls} required />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <VendorSelect
                value={form.vendor_id ?? null}
                onChange={v => set("vendor_id", v || null)}
                onSelect={c => set("vendor", c?.name ?? "")}
                onPMVendorSelect={fill => {
                  setForm(prev => ({
                    ...prev,
                    vendor:            fill.vendorName,
                    vendor_id:         null,
                    cost_per_quantity: fill.pricePerUnit && fill.pricePerUnit > 0
                      ? fill.pricePerUnit
                      : prev.cost_per_quantity,
                    description: !prev.description && fill.commodityName
                      ? fill.commodityName
                      : prev.description,
                    quantity_of_item: !prev.quantity_of_item && fill.commodityQty
                      ? fill.commodityQty
                      : prev.quantity_of_item,
                  }));
                }}
                projectId={project.id}
                pmOnly
                label="Vendor"
                hint="Shows companies registered in this project's PM $ section"
              />
            </div>

            <Field label="Usage / Category *">
              <div className="relative">
                <select value={form.usage} onChange={e => set("usage", e.target.value)}
                  className={selectCls} required>
                  {USAGE_CATEGORIES.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <SelectChevron />
              </div>
            </Field>

            <Field label="Quantity Received *">
              <input type="number" step="0.0001" min="0"
                value={form.quantity_of_item || ""}
                onChange={e => set("quantity_of_item", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className={inputCls} required />
            </Field>

            <Field label="Cost per Unit (KES) *">
              <input type="number" step="0.01" min="0"
                value={form.cost_per_quantity || ""}
                onChange={e => set("cost_per_quantity", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className={inputCls} required />
            </Field>

            <Field
              label="Quantity Used"
              hint="Auto-linked from PM → Material Tracking. Not editable here."
            >
              <div className={inputCls + " flex items-center justify-between bg-white/3 cursor-not-allowed"}>
                <span className="font-mono tabular-nums text-foreground">{fmtQty(qtyUsed)}</span>
                <span className="text-[9px] uppercase tracking-wider text-emerald-400/70">
                  {linkedConsumption && linkedConsumption.project_count > 0
                    ? `${linkedConsumption.project_count} project${linkedConsumption.project_count !== 1 ? "s" : ""} · PM`
                    : "pm · pending"}
                </span>
              </div>
            </Field>

            {/* Live value previews */}
            <div className="sm:col-span-3 grid grid-cols-3 gap-3">
              {[
                { label: "Total Value",      value: fmt(liveTotal),          color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-950/10" },
                { label: "Value Used",       value: fmt(liveUsedValue),      color: "text-amber-400",   border: "border-amber-500/20",   bg: "bg-amber-950/10"   },
                { label: "Value Remaining",  value: fmt(liveRemainingValue), color: "text-sky-400",     border: "border-sky-500/20",     bg: "bg-sky-950/10"     },
              ].map(c => (
                <div key={c.label} className={`rounded-xl border ${c.border} ${c.bg} px-4 py-3`}>
                  <div className={`text-xs uppercase tracking-wider mb-1 ${c.color} opacity-80`}>{c.label}</div>
                  <div className={`text-base font-bold tabular-nums ${c.color}`}>{c.value}</div>
                </div>
              ))}
            </div>

            <div className="sm:col-span-3">
              <Field label="Notes">
                <textarea value={form.notes ?? ""}
                  onChange={e => set("notes", e.target.value)}
                  rows={2} placeholder="Delivery note, batch, damage, etc…"
                  className={inputCls + " resize-none"} />
              </Field>
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
            onClick={() => {
              const payload = { ...form };
              // quantity_used is always driven by PM Material Tracking — never write it
              delete payload.quantity_used;
              // Never send generated columns
              delete (payload as any).total_value;
              delete (payload as any).quantity_remaining;
              delete (payload as any).total_value_used;
              onSave(payload);
            }}
            disabled={loading || !form.factorial_code || !form.description}
            className="px-5 py-2 text-sm font-medium rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
          >
            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEdit ? "Save Changes" : "Add Item"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DELETE CONFIRM ───────────────────────────────────────────────────────────

function DeleteConfirm({ item, onConfirm, onClose, loading }: {
  item: InventoryItem; onConfirm: () => void; onClose: () => void; loading: boolean;
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
            <h3 className="font-semibold text-foreground mb-1">Delete Inventory Item</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Permanently delete{" "}
              <span className="text-foreground font-medium">{item.description}</span>{" "}
              (<span className="font-mono text-primary text-xs">{item.factorial_code}</span>)?
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
            Delete Item
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── PROJECT CARD ─────────────────────────────────────────────────────────────

function ProjectCard({ project, onSelect, itemCount }: {
  project: Project; onSelect: (p: Project) => void; itemCount: number;
}) {
  const status    = project.status ?? "planning";
  const statusCls = PROJECT_STATUS_STYLE[status] ?? PROJECT_STATUS_STYLE.planning;

  return (
    <motion.button
      onClick={() => onSelect(project)}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
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
        {itemCount > 0 && (
          <span className="text-[10px] text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded-full shrink-0 tabular-nums">
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <h3 className="font-semibold text-foreground text-sm mb-1.5 group-hover:text-primary transition-colors leading-snug line-clamp-1">
        {project.title}
      </h3>
      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{project.description}</p>
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
            {fmt(project.budget_numeric)}
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
            <motion.div className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))" }}
              initial={{ width: 0 }} animate={{ width: `${project.progress_percent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        <span>Open Inventory</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </div>
    </motion.button>
  );
}

// ─── PROJECT PICKER ───────────────────────────────────────────────────────────

function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects,    setProjects]    = useState<Project[]>([]);
  const [itemCounts,  setItemCounts]  = useState<Record<string, number>>({});
  const [fetching,    setFetching]    = useState(true);
  const [search,      setSearch]      = useState("");
  const [statusFilter,setStatusFilter]= useState("all");
  const { toasts, push } = useToast();

  useEffect(() => {
    setFetching(true);
    api.projects()
      .then(async ps => {
        setProjects(ps);
        // Count inventory items per project
        const { data: counts } = await supabase
          .from("inventory")
          .select("project_id")
          .in("project_id", ps.map(p => p.id));
        const c: Record<string, number> = {};
        (counts ?? []).forEach((r: any) => { c[r.project_id] = (c[r.project_id] ?? 0) + 1; });
        setItemCounts(c);
      })
      .catch(e => push(e instanceof Error ? e.message : "Failed to load.", "error"))
      .finally(() => setFetching(false));
  }, []);

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

  const statuses = ["all", "planning", "active", "on_hold", "completed", "cancelled"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <ToastStack toasts={toasts} />
      <div className="container mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-10">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">Inventory</p>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Select Project
            </span>
          </h1>
          <p className="text-xl text-muted-foreground mt-3">
            Choose a project to view and manage its inventory.
          </p>
        </motion.div>

        <Card className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search projects…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all" />
              </div>
              <div className="relative" style={{ minWidth: "9rem" }}>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
                  {statuses.map(s => (
                    <option key={s} value={s}>
                      {s === "all" ? "All Statuses" : s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
                <SelectChevron />
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
                  <button onClick={() => setSearch("")} className="text-xs text-primary hover:underline">Clear search</button>
                )}
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(p => (
                  <ProjectCard key={p.id} project={p} onSelect={onSelect} itemCount={itemCounts[p.id] ?? 0} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── INVENTORY VIEW (per-project) ─────────────────────────────────────────────

interface Consumption { total_used: number; project_count: number }

function InventoryView({ project, onBack }: { project: Project; onBack: () => void }) {
  const [items,       setItems]       = useState<InventoryItem[]>([]);
  const [consumption, setConsumption] = useState<Record<number, Consumption>>({});
  const [fetching,    setFetching]    = useState(true);
  const [search,      setSearch]      = useState("");
  const [filterUsage, setFilterUsage] = useState<string>("All");
  const [filterVendor,setFilterVendor]= useState<string>("All");
  const [expanded,    setExpanded]    = useState<Record<string, boolean>>({});
  const [modal,       setModal]       = useState<null | "create" | "edit">(null);
  const [editing,     setEditing]     = useState<InventoryItem | null>(null);
  const [deleting,    setDeleting]    = useState<InventoryItem | null>(null);
  const [saving,      setSaving]      = useState(false);
  const { toasts, push } = useToast();

  const status    = project.status ?? "planning";
  const statusCls = PROJECT_STATUS_STYLE[status] ?? PROJECT_STATUS_STYLE.planning;

  const fetchItems = useCallback(async () => {
    setFetching(true);
    setItems([]);
    try {
      const data = await api.list(project.id);
      setItems(data);
      const usages = [...new Set(data.map(i => i.usage || "Other"))];
      setExpanded(Object.fromEntries(usages.map(u => [u, true])));
      const { data: cons } = await supabase
        .from("vw_inventory_consumption")
        .select("inventory_id,total_used,project_count");
      const map: Record<number, Consumption> = {};
      (cons ?? []).forEach((c: any) => {
        map[c.inventory_id] = { total_used: Number(c.total_used) || 0, project_count: Number(c.project_count) || 0 };
      });
      setConsumption(map);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to load inventory.", "error");
    } finally {
      setFetching(false);
    }
  }, [project.id, push]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const cleanPayload = (data: Partial<FormData>): Partial<FormData> => {
    const copy = { ...data };
    delete (copy as any).total_value;
    delete (copy as any).quantity_remaining;
    delete (copy as any).total_value_used;
    return copy;
  };

  const handleCreate = async (form: Partial<FormData>) => {
    setSaving(true);
    try {
      const row = await api.create(cleanPayload({ ...form, project_id: project.id }));
      setItems(p => [row, ...p]);
      push("Item added successfully.");
      setModal(null);
    } catch (e: unknown) { push(e instanceof Error ? e.message : "Failed to add item.", "error"); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (form: Partial<FormData>) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, cleanPayload(form));
      setItems(p => p.map(i => i.id === editing.id ? row : i));
      push("Item updated.");
      setModal(null); setEditing(null);
    } catch (e: unknown) { push(e instanceof Error ? e.message : "Failed to update item.", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      setItems(p => p.filter(i => i.id !== deleting.id));
      push("Item deleted.");
      setDeleting(null);
    } catch (e: unknown) { push(e instanceof Error ? e.message : "Failed to delete item.", "error"); }
    finally { setSaving(false); }
  };

  const allVendors = useMemo(() => [...new Set(items.map(i => i.vendor).filter(Boolean))].sort(), [items]);
  const allUsages  = useMemo(() => [...new Set(items.map(i => i.usage || "Other"))].sort(), [items]);

  const filtered = useMemo(() =>
    items.filter(i => {
      if (filterUsage !== "All" && (i.usage || "Other") !== filterUsage) return false;
      if (filterVendor !== "All" && i.vendor !== filterVendor) return false;
      if (search) {
        const q = search.toLowerCase();
        return i.factorial_code.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          (i.serial_number || "").toLowerCase().includes(q) ||
          (i.vendor || "").toLowerCase().includes(q) ||
          (i.notes || "").toLowerCase().includes(q);
      }
      return true;
    }),
  [items, filterUsage, filterVendor, search]);

  const grouped = useMemo(() => {
    const g: Record<string, InventoryItem[]> = {};
    filtered.forEach(i => { const key = i.usage || "Other"; if (!g[key]) g[key] = []; g[key].push(i); });
    return g;
  }, [filtered]);

  const sortedUsages = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  const grandTotals = useMemo(() => ({
    totalItems:     items.length,
    totalValue:     items.reduce((s, i) => s + (i.total_value ?? 0), 0),
    totalQty:       items.reduce((s, i) => s + (i.quantity_of_item ?? 0), 0),
    totalUsed:      items.reduce((s, i) => s + (i.quantity_used ?? 0), 0),
    totalRemaining: items.reduce((s, i) => s + Math.max(0, (i.quantity_of_item ?? 0) - (i.quantity_used ?? 0)), 0),
    uniqueVendors:  new Set(items.map(i => i.vendor).filter(Boolean)).size,
  }), [items]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-background via-background to-primary/5">
      <ToastStack toasts={toasts} />

      {/* Modals */}
      <AnimatePresence>
        {modal === "create" && (
          <ItemModal initial={makeEmptyForm(project.id)} onSave={handleCreate}
            onClose={() => setModal(null)} loading={saving} project={project} />
        )}
        {modal === "edit" && editing && (
          <ItemModal
            initial={{ ...editing }}
            onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
            linkedConsumption={consumption[editing.id] ?? null}
            project={project}
          />
        )}
        {deleting && (
          <DeleteConfirm item={deleting} onConfirm={handleDelete}
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
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">Inventory</p>
          <div className="flex items-center gap-3 mb-2">
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
        </motion.div>

        {/* Stat strip */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Items",     value: String(grandTotals.totalItems),              color: "text-foreground"  },
            { label: "Total Value",     value: fmt(grandTotals.totalValue),                 color: "text-emerald-400" },
            { label: "Qty Remaining",   value: fmtQty(grandTotals.totalRemaining),          color: "text-sky-400"     },
            { label: "Vendors",         value: String(grandTotals.uniqueVendors),           color: "text-primary"     },
          ].map(c => (
            <div key={c.label} className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">{c.label}</div>
              <div className={`text-lg font-bold tabular-nums font-mono ${c.color}`}>{c.value}</div>
            </div>
          ))}
        </motion.div>

        {/* Main card */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-2xl font-bold">Inventory Register</CardTitle>
              <button onClick={() => setModal("create")}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg"
                style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                New Item
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search code, description, vendor…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all" />
              </div>
              <div className="relative" style={{ minWidth: "9rem" }}>
                <select value={filterUsage} onChange={e => setFilterUsage(e.target.value)} className={selectCls}>
                  <option value="All">All Categories</option>
                  {allUsages.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <SelectChevron />
              </div>
              <div className="relative" style={{ minWidth: "9rem" }}>
                <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)} className={selectCls}>
                  <option value="All">All Vendors</option>
                  {allVendors.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <SelectChevron />
              </div>
              <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
                {filtered.length} / {items.length} shown
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
                <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                Loading inventory…
              </div>
            ) : sortedUsages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                <p className="text-sm">No inventory items for this project.</p>
                {(search || filterUsage !== "All" || filterVendor !== "All") && (
                  <button onClick={() => { setSearch(""); setFilterUsage("All"); setFilterVendor("All"); }}
                    className="text-xs text-primary hover:underline">Clear filters</button>
                )}
                <button onClick={() => setModal("create")} className="text-xs text-primary hover:underline">
                  Add first item →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {sortedUsages.map(usage => {
                  const s      = getUsageStyle(usage);
                  const isOpen = expanded[usage] ?? true;
                  const rows   = grouped[usage] ?? [];
                  const gQty          = rows.reduce((s, i) => s + (i.quantity_of_item ?? 0), 0);
                  const gUsed         = rows.reduce((s, i) => s + (i.quantity_used ?? 0), 0);
                  const gRemainingQty = rows.reduce((s, i) => s + Math.max(0, (i.quantity_of_item ?? 0) - (i.quantity_used ?? 0)), 0);
                  const gTotal        = rows.reduce((s, i) => s + (i.total_value ?? 0), 0);
                  const gUsedValue    = rows.reduce((s, i) => s + (i.total_value_used ?? (i.quantity_used ?? 0) * (i.cost_per_quantity ?? 0)), 0);
                  const gRemValue     = rows.reduce((s, i) => s + Math.max(0, (i.quantity_of_item ?? 0) - (i.quantity_used ?? 0)) * (i.cost_per_quantity ?? 0), 0);

                  return (
                    <div key={usage}>
                      <button
                        onClick={() => setExpanded(p => ({ ...p, [usage]: !p[usage] }))}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                          <span className={`text-xs font-bold uppercase tracking-[0.12em] ${s.accent}`}>{usage}</span>
                          <Badge className={`text-xs px-2.5 py-0.5 font-mono border rounded-full ${s.badge}`}>{rows.length}</Badge>
                        </div>
                        <div className="flex items-center gap-5">
                          <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">Qty {fmtQty(gQty)}</span>
                          <span className="text-sm font-semibold tabular-nums text-emerald-400">{fmt(gTotal)}</span>
                          <svg className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="m6 9 6 6 6-6"/>
                          </svg>
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div key={`u-${usage}`}
                            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                            style={{ overflow: "hidden" }}>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-y border-white/6" style={{ background: "rgba(255,255,255,0.03)" }}>
                                    {["Code", "Description", "Serial No.", "Vendor",
                                      "Qty Recv.", "Qty Used", "Qty Rem.", "Cost/Unit",
                                      "Total Value", "Value Used", "Value Rem.", "Date", "Notes", "Actions"
                                    ].map(h => (
                                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((item, ri) => {
                                    const qtyUsed = item.quantity_used ?? 0;
                                    const qtyRem  = Math.max(0, (item.quantity_of_item ?? 0) - qtyUsed);
                                    const valUsed = item.total_value_used ?? (qtyUsed * (item.cost_per_quantity ?? 0));
                                    const valRem  = qtyRem * (item.cost_per_quantity ?? 0);
                                    return (
                                      <motion.tr key={item.id}
                                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: ri * 0.02, duration: 0.16 }}
                                        className={`border-b border-white/5 transition-colors ${getUsageStyle(item.usage).row}`}>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                          <span className="font-mono text-xs font-semibold text-primary">{item.factorial_code}</span>
                                        </td>
                                        <td className="px-4 py-3.5 font-medium max-w-[160px]">
                                          <span className="line-clamp-1">{item.description}</span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                          <span className="font-mono text-xs text-muted-foreground">{item.serial_number || "—"}</span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-xs">{item.vendor || "—"}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap tabular-nums font-mono">{fmtQty(item.quantity_of_item ?? 0)}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap tabular-nums font-mono text-amber-300">
                                          <span className="inline-flex items-center gap-1.5">
                                            {fmtQty(qtyUsed)}
                                            {consumption[item.id]?.project_count > 0 && (
                                              <span title={`Auto-synced from ${consumption[item.id].project_count} project(s)`}
                                                className="text-[8px] uppercase tracking-wider px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400/80">
                                                auto
                                              </span>
                                            )}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap tabular-nums font-mono text-sky-300">{fmtQty(qtyRem)}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap tabular-nums text-muted-foreground">{fmt(item.cost_per_quantity ?? 0)}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap font-bold text-emerald-400">{fmt(item.total_value ?? 0)}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-amber-300 font-medium">{fmt(valUsed)}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-sky-300 font-medium">{fmt(valRem)}</td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground">{fmtDate(item.date)}</td>
                                        <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-[140px]">
                                          <span className="line-clamp-1">{item.notes || "—"}</span>
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                          <div className="flex items-center gap-1.5">
                                            <button onClick={() => { setEditing(item); setModal("edit"); }} title="Edit"
                                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all">
                                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                              </svg>
                                            </button>
                                            <button onClick={() => setDeleting(item)} title="Delete"
                                              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                <polyline points="3 6 5 6 21 6"/>
                                                <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
                                              </svg>
                                            </button>
                                          </div>
                                        </td>
                                      </motion.tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-white/10" style={{ background: "rgba(255,255,255,0.02)" }}>
                                    <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground" colSpan={4}>
                                      {usage} Total
                                    </td>
                                    <td className="px-4 py-2.5 font-bold tabular-nums">{fmtQty(gQty)}</td>
                                    <td className="px-4 py-2.5 font-bold tabular-nums text-amber-300">{fmtQty(gUsed)}</td>
                                    <td className="px-4 py-2.5 font-bold tabular-nums text-sky-300">{fmtQty(gRemainingQty)}</td>
                                    <td />
                                    <td className="px-4 py-2.5 font-bold text-emerald-400">{fmt(gTotal)}</td>
                                    <td className="px-4 py-2.5 font-bold text-amber-300">{fmt(gUsedValue)}</td>
                                    <td className="px-4 py-2.5 font-bold text-sky-300">{fmt(gRemValue)}</td>
                                    <td colSpan={3} />
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

                {items.length > 0 && (
                  <div className="px-6 py-4 flex flex-wrap items-center gap-6 text-xs font-mono bg-emerald-950/20">
                    <span className="text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wider">Grand Total</span>
                    <span className="text-foreground">{grandTotals.totalItems} items</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-primary">Qty {fmtQty(grandTotals.totalQty)}</span>
                    <span className="text-muted-foreground">· Used {fmtQty(grandTotals.totalUsed)}</span>
                    <span className="text-muted-foreground">· Rem {fmtQty(grandTotals.totalRemaining)}</span>
                    <span className="text-muted-foreground">=</span>
                    <span className="text-emerald-400 font-bold">{fmt(grandTotals.totalValue)}</span>
                    <Badge className="ml-auto bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                      {grandTotals.uniqueVendors} vendor{grandTotals.uniqueVendors !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

interface Props { projectId?: string; canEdit?: boolean }

export default function InventoryPage({ projectId }: Props) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,site_city,site_country,expected_completion_date,created_at")
      .eq("id", projectId)
      .single()
      .then(({ data }) => { if (data) setSelectedProject(data as Project); })
      .catch(() => { /* project fetch is best-effort */ });
  }, [projectId]);

  return (
    <AnimatePresence mode="wait">
      {selectedProject ? (
        <motion.div key={selectedProject.id}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <InventoryView
            project={selectedProject}
            onBack={() => { if (!projectId) setSelectedProject(null); }}
          />
        </motion.div>
      ) : (
        <motion.div key="picker"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <ProjectPickerView onSelect={setSelectedProject} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
