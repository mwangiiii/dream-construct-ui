"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id:                number;
  factorial_code:    string;
  description:       string;
  serial_number:     string;
  vendor:            string;
  quantity_of_item:  number;
  cost_per_quantity: number;
  total_value:       number; // GENERATED ALWAYS AS (quantity * cost) STORED
  usage:             string;
  date:              string;
  notes:             string;
  created_at?:       string;
  updated_at?:       string;
}

type FormData = Omit<InventoryItem, "id" | "total_value" | "created_at" | "updated_at">;

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

const makeEmptyForm = (): FormData => ({
  factorial_code:    "",
  description:       "",
  serial_number:     "",
  vendor:            "",
  quantity_of_item:  0,
  cost_per_quantity: 0,
  usage:             "Other",
  date:              new Date().toISOString().slice(0, 10),
  notes:             "",
});

const fmt = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 2 }).format(n);
const fmtC = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtQty = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(n);

// ─── API ──────────────────────────────────────────────────────────────────────

function throwSb(error: { message?: string } | null, ctx: string): never {
  throw new Error(error?.message ?? `Supabase error during ${ctx}`);
}

const api = {
  async list(): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("date",           { ascending: false })
      .order("factorial_code", { ascending: true  });
    if (error) throwSb(error, "list");
    return (data ?? []) as InventoryItem[];
  },
  async create(body: FormData): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from("inventory").insert([body]).select().single();
    if (error) throwSb(error, "create");
    return data as InventoryItem;
  },
  async update(id: number, body: FormData): Promise<InventoryItem> {
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

// ─── ITEM MODAL ───────────────────────────────────────────────────────────────

function ItemModal({
  initial, onSave, onClose, loading,
}: {
  initial: FormData & { id?: number };
  onSave:  (d: FormData) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<FormData>({ ...initial });
  const isEdit = Boolean(initial.id);
  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => setForm(p => ({ ...p, [k]: v }));

  const liveTotal = form.quantity_of_item * form.cost_per_quantity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
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
            {isEdit ? "Edit Inventory Item" : "New Inventory Item"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">

          <Field label="Factorial Code *">
            <input value={form.factorial_code} onChange={e => set("factorial_code", e.target.value)}
              placeholder="e.g. F-001" className={inputCls} />
          </Field>

          <Field label="Serial Number">
            <input value={form.serial_number} onChange={e => set("serial_number", e.target.value)}
              placeholder="e.g. SN-1001" className={inputCls} />
          </Field>

          <div className="col-span-2">
            <Field label="Description *">
              <input value={form.description} onChange={e => set("description", e.target.value)}
                placeholder="e.g. Cement Bags" className={inputCls} />
            </Field>
          </div>

          <Field label="Vendor">
            <input value={form.vendor} onChange={e => set("vendor", e.target.value)}
              placeholder="e.g. ABC Supplies" className={inputCls} />
          </Field>

          <Field label="Usage / Category">
            <div className="relative">
              <select value={form.usage} onChange={e => set("usage", e.target.value)}
                className={inputCls + " appearance-none pr-10 font-medium tracking-wide text-sm"}>
                {USAGE_CATEGORIES.map(u => (
                  <option key={u} value={u} className="bg-background text-foreground font-medium">{u}</option>
                ))}
                <option value={form.usage && !USAGE_CATEGORIES.includes(form.usage as UsageCategory) ? form.usage : ""} className="bg-background text-foreground font-medium">
                  {form.usage && !USAGE_CATEGORIES.includes(form.usage as UsageCategory) ? form.usage : "Custom…"}
                </option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
              </span>
            </div>
          </Field>

          <Field label="Quantity *">
            <input type="number" step="0.0001" min="0" value={form.quantity_of_item}
              onChange={e => set("quantity_of_item", parseFloat(e.target.value) || 0)} className={inputCls} />
          </Field>

          <Field label="Cost per Unit (KES) *">
            <input type="number" step="0.0001" min="0" value={form.cost_per_quantity}
              onChange={e => set("cost_per_quantity", parseFloat(e.target.value) || 0)} className={inputCls} />
          </Field>

          {/* Live total value preview */}
          <div className="col-span-2">
            <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
              liveTotal > 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-white/3 border-white/8"
            }`}>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Value Preview
              </span>
              <span className={`text-sm font-bold font-mono tabular-nums ${liveTotal > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                {fmt(liveTotal)}
              </span>
            </div>
          </div>

          <Field label="Date *">
            <input type="date" value={form.date}
              onChange={e => set("date", e.target.value)} className={inputCls} />
          </Field>

          <div className="col-span-2">
            <Field label="Notes">
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                rows={2} placeholder="Additional notes…" className={inputCls + " resize-none"} />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
            Cancel
          </button>
          <button onClick={() => onSave(form)} disabled={loading}
            className="px-5 py-2 text-sm font-medium rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
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
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-xl bg-white/10"
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
              (<span className="font-mono text-primary text-xs">{item.factorial_code}</span>)?{" "}
              This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">Cancel</button>
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

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [items,        setItems]        = useState<InventoryItem[]>([]);
  const [fetching,     setFetching]     = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterUsage,  setFilterUsage]  = useState<string>("All");
  const [filterVendor, setFilterVendor] = useState<string>("All");
  const [expanded,     setExpanded]     = useState<Record<string, boolean>>({});
  const [modal,        setModal]        = useState<null | "create" | "edit">(null);
  const [editing,      setEditing]      = useState<InventoryItem | null>(null);
  const [deleting,     setDeleting]     = useState<InventoryItem | null>(null);
  const [saving,       setSaving]       = useState(false);

  const { toasts, push } = useToast();

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setFetching(true); setItems([]);
    try {
      const data = await api.list();
      setItems(data);
      const usages = [...new Set(data.map(i => i.usage || "Other"))];
      setExpanded(Object.fromEntries(usages.map(u => [u, true])));
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to load inventory.", "error");
    } finally { setFetching(false); }
  }, [push]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleCreate = async (form: FormData) => {
    setSaving(true);
    try {
      const row = await api.create(form);
      setItems(p => [row, ...p]);
      push("Item added successfully."); setModal(null);
    } catch (e: unknown) { push(e instanceof Error ? e.message : "Failed to add item.", "error"); }
    finally { setSaving(false); }
  };
  const handleUpdate = async (form: FormData) => {
    if (!editing) return; setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      setItems(p => p.map(i => i.id === editing.id ? row : i));
      push("Item updated."); setModal(null); setEditing(null);
    } catch (e: unknown) { push(e instanceof Error ? e.message : "Failed to update item.", "error"); }
    finally { setSaving(false); }
  };
  const handleDelete = async () => {
    if (!deleting) return; setSaving(true);
    try {
      await api.remove(deleting.id);
      setItems(p => p.filter(i => i.id !== deleting.id));
      push("Item deleted."); setDeleting(null);
    } catch (e: unknown) { push(e instanceof Error ? e.message : "Failed to delete item.", "error"); }
    finally { setSaving(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const allVendors = useMemo(() =>
    [...new Set(items.map(i => i.vendor).filter(Boolean))].sort(),
  [items]);

  const allUsages = useMemo(() =>
    [...new Set(items.map(i => i.usage || "Other"))].sort(),
  [items]);

  const filtered = useMemo(() =>
    items.filter(i => {
      if (filterUsage  !== "All" && (i.usage || "Other") !== filterUsage)  return false;
      if (filterVendor !== "All" && i.vendor !== filterVendor) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          i.factorial_code.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.serial_number.toLowerCase().includes(q) ||
          i.vendor.toLowerCase().includes(q) ||
          (i.notes ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    }),
  [items, filterUsage, filterVendor, search]);

  // Group by usage category
  const grouped = useMemo(() => {
    const g: Record<string, InventoryItem[]> = {};
    filtered.forEach(i => {
      const key = i.usage || "Other";
      if (!g[key]) g[key] = [];
      g[key].push(i);
    });
    return g;
  }, [filtered]);

  const sortedUsages = useMemo(() =>
    Object.keys(grouped).sort(),
  [grouped]);

  // Grand totals
  const grandTotals = useMemo(() => ({
    totalItems:    items.length,
    totalValue:    items.reduce((s, i) => s + Number(i.total_value), 0),
    totalQty:      items.reduce((s, i) => s + Number(i.quantity_of_item), 0),
    uniqueVendors: new Set(items.map(i => i.vendor).filter(Boolean)).size,
  }), [items]);

  // Usage value totals for filter cards
  const usageTotals = useMemo(() =>
    Object.fromEntries(
      allUsages.map(u => [u, {
        count: items.filter(i => (i.usage || "Other") === u).length,
        value: items.filter(i => (i.usage || "Other") === u).reduce((s, i) => s + Number(i.total_value), 0),
      }])
    ),
  [items, allUsages]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">

      {/* ── Toasts ─────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${
                t.type === "success" ? "bg-emerald-950/80 border-emerald-500/25 text-emerald-300" : "bg-rose-950/80 border-rose-500/25 text-rose-300"
              }`}>{t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal === "create" && (
          <ItemModal initial={makeEmptyForm()} onSave={handleCreate} onClose={() => setModal(null)} loading={saving} />
        )}
        {modal === "edit" && editing && (
          <ItemModal initial={{ ...editing }} onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }} loading={saving} />
        )}
        {deleting && (
          <DeleteConfirm item={deleting} onConfirm={handleDelete}
            onClose={() => setDeleting(null)} loading={saving} />
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-16">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">
            Finance Module
          </p>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
            Inventory{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Tracking
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Monitor inventory items, vendors, quantities, and total values across all usages.
          </p>
        </motion.div>

        {/* ── Grand summary cards ───────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Items",     value: grandTotals.totalItems,                color: "text-foreground",  sub: "inventory lines"       },
            { label: "Total Value",     value: fmtC(grandTotals.totalValue),          color: "text-emerald-400", sub: fmt(grandTotals.totalValue) },
            { label: "Total Qty",       value: fmtC(grandTotals.totalQty),            color: "text-primary",     sub: "units across all items"   },
            { label: "Unique Vendors",  value: grandTotals.uniqueVendors,             color: "text-sky-400",     sub: "active suppliers"          },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">{card.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{card.sub}</div>
            </div>
          ))}
        </motion.div>

        {/* ── Usage category filter cards ───────────────────────────────────── */}
        {allUsages.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.13 }}
            className="flex flex-wrap gap-2 mb-8">
            {allUsages.map(usage => {
              const s        = getUsageStyle(usage);
              const isActive = filterUsage === usage;
              const ut       = usageTotals[usage];
              return (
                <button key={usage}
                  onClick={() => setFilterUsage(isActive ? "All" : usage)}
                  className={`rounded-2xl border px-4 py-3 text-left transition-all duration-200 backdrop-blur-sm bg-white/5 ${
                    isActive ? "border-white/20 ring-1 ring-white/20 scale-[1.02]" : "border-white/10 hover:border-white/20 hover:scale-[1.01]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    <span className={`text-[10px] uppercase tracking-widest font-semibold ${s.accent}`}>{usage}</span>
                  </div>
                  <div className="text-lg font-bold tabular-nums text-foreground">{ut?.count ?? 0}</div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{fmtC(ut?.value ?? 0)}</div>
                </button>
              );
            })}
          </motion.div>
        )}

        {/* ── Main card ────────────────────────────────────────────────────── */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-3xl font-bold">Inventory Register</CardTitle>
              <button onClick={() => setModal("create")}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg"
                style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Item
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by code, description, serial number or vendor…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all" />
              </div>
              {/* Vendor filter */}
              <div className="relative">
                <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
                  className={inputCls + " appearance-none pr-10 font-medium tracking-wide text-sm min-w-[10rem]"}>
                  <option value="All" className="bg-background text-foreground font-medium">All Vendors</option>
                  {allVendors.map(v => (
                    <option key={v} value={v} className="bg-background text-foreground font-medium">{v}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
                </span>
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
                  <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                <p className="text-sm">No inventory items found.</p>
                {(search || filterUsage !== "All" || filterVendor !== "All") && (
                  <button onClick={() => { setSearch(""); setFilterUsage("All"); setFilterVendor("All"); }}
                    className="text-xs text-primary hover:underline">Clear filters</button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {sortedUsages.map(usage => {
                  const s      = getUsageStyle(usage);
                  const isOpen = expanded[usage] ?? true;
                  const rows   = grouped[usage];
                  const gTotal = rows.reduce((sum, i) => sum + Number(i.total_value), 0);
                  const gQty   = rows.reduce((sum, i) => sum + Number(i.quantity_of_item), 0);

                  return (
                    <div key={usage}>
                      {/* Usage group header */}
                      <button onClick={() => setExpanded(p => ({ ...p, [usage]: !p[usage] }))}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                          <span className={`text-xs font-bold uppercase tracking-[0.12em] ${s.accent}`}>{usage}</span>
                          <Badge className={`text-xs px-2.5 py-0.5 font-mono border rounded-full ${s.badge}`}>
                            {rows.length}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-5">
                          <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">
                            Qty {fmtQty(gQty)}
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-emerald-400">
                            {fmt(gTotal)}
                          </span>
                          <svg className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div key={`u-${usage}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{   height: 0,    opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            style={{ overflow: "hidden" }}
                          >
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-y border-white/6" style={{ background: "rgba(255,255,255,0.03)" }}>
                                    {["Code", "Description", "Serial No.", "Vendor", "Quantity", "Cost / Unit", "Total Value", "Date", "Notes", "Actions"].map(h => (
                                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((item, ri) => (
                                    <motion.tr key={item.id}
                                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: ri * 0.02, duration: 0.16 }}
                                      className={`border-b border-white/5 transition-colors ${s.row}`}
                                    >
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="font-mono text-xs font-semibold text-primary">{item.factorial_code}</span>
                                      </td>
                                      <td className="px-5 py-3.5 font-medium text-foreground max-w-[180px]">
                                        <span className="line-clamp-1">{item.description}</span>
                                      </td>
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="font-mono text-xs text-muted-foreground">{item.serial_number || "—"}</span>
                                      </td>
                                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-foreground">
                                        {item.vendor || <span className="text-muted-foreground">—</span>}
                                      </td>
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="text-sm font-semibold tabular-nums text-foreground font-mono">
                                          {fmtQty(Number(item.quantity_of_item))}
                                        </span>
                                      </td>
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="text-sm tabular-nums text-muted-foreground font-mono">
                                          {fmt(Number(item.cost_per_quantity))}
                                        </span>
                                      </td>
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="text-sm font-bold tabular-nums text-emerald-400 font-mono">
                                          {fmt(Number(item.total_value))}
                                        </span>
                                      </td>
                                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                                        {fmtDate(item.date)}
                                      </td>
                                      <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[160px]">
                                        <span className="line-clamp-1">{item.notes || "—"}</span>
                                      </td>
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                          <button onClick={() => { setEditing(item); setModal("edit"); }} title="Edit"
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                          </button>
                                          <button onClick={() => setDeleting(item)} title="Delete"
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                              <polyline points="3 6 5 6 21 6" />
                                              <path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                                            </svg>
                                          </button>
                                        </div>
                                      </td>
                                    </motion.tr>
                                  ))}
                                </tbody>
                                {/* Usage subtotal footer */}
                                <tfoot>
                                  <tr className="border-t border-white/10" style={{ background: "rgba(255,255,255,0.02)" }}>
                                    <td className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground" colSpan={4}>
                                      {usage} Total
                                    </td>
                                    <td className="px-5 py-2.5 text-sm font-bold tabular-nums text-foreground font-mono">
                                      {fmtQty(gQty)}
                                    </td>
                                    <td />
                                    <td className="px-5 py-2.5 text-sm font-bold tabular-nums text-emerald-400 font-mono">
                                      {fmt(gTotal)}
                                    </td>
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

                {/* Grand total bar */}
                {items.length > 0 && (
                  <div className="px-6 py-4 flex flex-wrap items-center gap-6 text-xs font-mono bg-emerald-950/20">
                    <span className="text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wider">Grand Total</span>
                    <span className="text-foreground">{grandTotals.totalItems} items</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-primary">Qty {fmtQty(grandTotals.totalQty)}</span>
                    <span className="text-muted-foreground">=</span>
                    <span className="text-emerald-400 font-bold">{fmt(grandTotals.totalValue)}</span>
                    <Badge className="ml-auto bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                      {grandTotals.uniqueVendors} vendor{grandTotals.uniqueVendors !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            {!fetching && items.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {items.length} total items · {allUsages.length} usage categor{allUsages.length !== 1 ? "ies" : "y"}
                </span>
                <button onClick={fetchItems} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
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