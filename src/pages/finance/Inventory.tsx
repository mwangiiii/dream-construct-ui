"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id:                     number;
  factorial_code:         string;
  description:            string;
  serial_number:          string;
  vendor:                 string;
  quantity_of_item:       number;
  cost_per_quantity:      number;
  total_value:            number;           // GENERATED
  quantity_used:          number;
  total_value_used:       number;           // GENERATED
  projects_used:          string[];         // or string if comma-separated
  usage:                  string;
  quantity_remaining:     number;           // GENERATED
  total_value_remaining:  number;           // GENERATED
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
  | "total_value_remaining"
  | "created_at"
  | "updated_at"
> & {
  projects_used?: string[]; // or string if you store as comma-separated
};

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
  quantity_used:     0,
  projects_used:     [],
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

  const liveTotal         = form.quantity_of_item * form.cost_per_quantity;
  const liveUsedValue     = form.quantity_used * form.cost_per_quantity;
  const liveRemainingQty  = Math.max(0, form.quantity_of_item - form.quantity_used);
  const liveRemainingValue = liveRemainingQty * form.cost_per_quantity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-3xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-xl bg-white/10"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.96,  y: 8  }}
        transition={{ duration: 0.2 }}
      >
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

        <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[65vh] overflow-y-auto">
          {/* Form fields – unchanged from previous version */}
          <Field label="Factorial Code *">
            <input value={form.factorial_code} onChange={e => set("factorial_code", e.target.value)}
              placeholder="e.g. F-001" className={inputCls} required />
          </Field>

          <Field label="Serial Number">
            <input value={form.serial_number ?? ""} onChange={e => set("serial_number", e.target.value)}
              placeholder="e.g. SN-1001" className={inputCls} />
          </Field>

          <div className="col-span-2 sm:col-span-3">
            <Field label="Description *">
              <input value={form.description} onChange={e => set("description", e.target.value)}
                placeholder="e.g. 50kg Cement Bag" className={inputCls} required />
            </Field>
          </div>

          <Field label="Vendor">
            <input value={form.vendor ?? ""} onChange={e => set("vendor", e.target.value)}
              placeholder="e.g. Bamburi / Eastmatt" className={inputCls} />
          </Field>

          <Field label="Usage / Category *">
            <div className="relative">
              <select value={form.usage} onChange={e => set("usage", e.target.value)}
                className={inputCls + " appearance-none pr-10 font-medium tracking-wide text-sm"} required>
                {USAGE_CATEGORIES.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
              </span>
            </div>
          </Field>

          <Field label="Projects Used">
            <input type="text" value={form.projects_used?.join(", ") ?? ""}
              onChange={e => set("projects_used", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
              placeholder="Proj A, Proj B, ..." className={inputCls} />
          </Field>

          <Field label="Quantity Received *">
            <input type="number" step="0.0001" min="0" value={form.quantity_of_item}
              onChange={e => set("quantity_of_item", parseFloat(e.target.value) || 0)} className={inputCls} required />
          </Field>

          <Field label="Cost per Unit (KES) *">
            <input type="number" step="0.01" min="0" value={form.cost_per_quantity}
              onChange={e => set("cost_per_quantity", parseFloat(e.target.value) || 0)} className={inputCls} required />
          </Field>

          <Field label="Quantity Used">
            <input type="number" step="0.0001" min="0" max={form.quantity_of_item}
              value={form.quantity_used}
              onChange={e => set("quantity_used", Math.min(parseFloat(e.target.value) || 0, form.quantity_of_item))}
              className={inputCls} />
          </Field>

          <div className="col-span-2 sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            <div className="rounded-xl border bg-emerald-950/10 border-emerald-500/20 px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-emerald-300/80 mb-1">Total Value</div>
              <div className="text-lg font-bold text-emerald-400">{fmt(liveTotal)}</div>
            </div>
            <div className="rounded-xl border bg-amber-950/10 border-amber-500/20 px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-amber-300/80 mb-1">Value Used</div>
              <div className="text-lg font-bold text-amber-400">{fmt(liveUsedValue)}</div>
            </div>
            <div className="rounded-xl border bg-sky-950/10 border-sky-500/20 px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-sky-300/80 mb-1">Value Remaining</div>
              <div className="text-lg font-bold text-sky-400">{fmt(liveRemainingValue)}</div>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-3">
            <Field label="Notes">
              <textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value)}
                rows={2} placeholder="Delivery note, batch, damage, etc…" className={inputCls + " resize-none"} />
            </Field>
          </div>

          <Field label="Date *">
            <input type="date" value={form.date} onChange={e => set("date", e.target.value)} className={inputCls} required />
          </Field>
        </div>

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

// DeleteConfirm component (omitted for brevity – copy from your original if needed)

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUsage, setFilterUsage] = useState<string>("All");
  const [filterVendor, setFilterVendor] = useState<string>("All");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<null | "create" | "edit">(null);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);

  const { toasts, push } = useToast();

  const fetchItems = useCallback(async () => {
    setFetching(true);
    setItems([]);
    try {
      const data = await api.list();
      setItems(data);
      const usages = [...new Set(data.map(i => i.usage || "Other"))];
      setExpanded(Object.fromEntries(usages.map(u => [u, true])));
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to load inventory.", "error");
    } finally {
      setFetching(false);
    }
  }, [push]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleCreate = async (form: FormData) => {
    setSaving(true);
    try {
      const row = await api.create(form);
      setItems(p => [row, ...p]);
      push("Item added successfully.");
      setModal(null);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to add item.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: FormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      setItems(p => p.map(i => i.id === editing.id ? row : i));
      push("Item updated.");
      setModal(null);
      setEditing(null);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to update item.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      setItems(p => p.filter(i => i.id !== deleting.id));
      push("Item deleted.");
      setDeleting(null);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to delete item.", "error");
    } finally {
      setSaving(false);
    }
  };

  const allVendors = useMemo(() =>
    [...new Set(items.map(i => i.vendor).filter(Boolean))].sort(),
  [items]);

  const allUsages = useMemo(() =>
    [...new Set(items.map(i => i.usage || "Other"))].sort(),
  [items]);

  const filtered = useMemo(() =>
    items.filter(i => {
      if (filterUsage !== "All" && (i.usage || "Other") !== filterUsage) return false;
      if (filterVendor !== "All" && i.vendor !== filterVendor) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          i.factorial_code.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          (i.serial_number || "").toLowerCase().includes(q) ||
          (i.vendor || "").toLowerCase().includes(q) ||
          (i.notes || "").toLowerCase().includes(q) ||
          (i.projects_used?.join(" ").toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    }),
  [items, filterUsage, filterVendor, search]);

  const grouped = useMemo(() => {
    const g: Record<string, InventoryItem[]> = {};
    filtered.forEach(i => {
      const key = i.usage || "Other";
      if (!g[key]) g[key] = [];
      g[key].push(i);
    });
    return g;
  }, [filtered]);

  const sortedUsages = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  const grandTotals = useMemo(() => ({
    totalItems:    items.length,
    totalValue:    items.reduce((s, i) => s + Number(i.total_value), 0),
    totalQty:      items.reduce((s, i) => s + Number(i.quantity_of_item), 0),
    totalUsed:     items.reduce((s, i) => s + Number(i.quantity_used), 0),
    totalRemaining: items.reduce((s, i) => s + Number(i.quantity_remaining), 0),
    uniqueVendors: new Set(items.map(i => i.vendor).filter(Boolean)).size,
  }), [items]);

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
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${
                t.type === "success" ? "bg-emerald-950/80 border-emerald-500/25 text-emerald-300" : "bg-rose-950/80 border-rose-500/25 text-rose-300"
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
          <ItemModal initial={makeEmptyForm()} onSave={handleCreate} onClose={() => setModal(null)} loading={saving} />
        )}
        {modal === "edit" && editing && (
          <ItemModal
            initial={{ ...editing }}
            onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
          />
        )}
        {deleting && (
          // DeleteConfirm component here – add your original DeleteConfirm if needed
          <div>Delete confirmation modal placeholder</div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-16">
        {/* Hero section, grand totals cards, usage filter cards – add them back from your original code if needed */}

        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-3xl font-bold">Inventory Register</CardTitle>
              <button
                onClick={() => setModal("create")}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg"
                style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Item
              </button>
            </div>

            {/* Search + filters toolbar – copy from original if needed */}
          </CardHeader>

          <CardContent className="p-0">
            {fetching && (
              <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
                <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                Loading inventory…
              </div>
            )}

            {!fetching && sortedUsages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                <p className="text-sm">No inventory items found.</p>
                {(search || filterUsage !== "All" || filterVendor !== "All") && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setFilterUsage("All");
                      setFilterVendor("All");
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {!fetching && sortedUsages.length > 0 && (
              <div className="divide-y divide-white/8">
                {sortedUsages.map(usage => {
                  const s = getUsageStyle(usage);
                  const isOpen = expanded[usage] ?? true;
                  const rows = grouped[usage] ?? [];

                  const gQty = rows.reduce((sum, i) => sum + Number(i.quantity_of_item), 0);
                  const gUsed = rows.reduce((sum, i) => sum + Number(i.quantity_used), 0);
                  const gRemaining = rows.reduce((sum, i) => sum + Number(i.quantity_remaining), 0);
                  const gTotal = rows.reduce((sum, i) => sum + Number(i.total_value), 0);
                  const gUsedValue = rows.reduce((sum, i) => sum + Number(i.total_value_used), 0);
                  const gRemValue = rows.reduce((sum, i) => sum + Number(i.total_value_remaining), 0);

                  return (
                    <div key={usage}>
                      <button
                        onClick={() => setExpanded(p => ({ ...p, [usage]: !p[usage] }))}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors text-left"
                      >
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
                          <motion.div
                            key={`u-${usage}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            style={{ overflow: "hidden" }}
                          >
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-y border-white/6" style={{ background: "rgba(255,255,255,0.03)" }}>
                                    {[
                                      "Code", "Description", "Serial No.", "Vendor", "Projects", "Usage",
                                      "Qty Received", "Qty Used", "Qty Rem.", "Cost/Unit",
                                      "Total Value", "Value Used", "Value Rem.", "Date", "Notes", "Actions"
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
                                  {rows.map((item, ri) => (
                                    <motion.tr
                                      key={item.id}
                                      initial={{ opacity: 0, x: -6 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: ri * 0.02, duration: 0.16 }}
                                      className={`border-b border-white/5 transition-colors ${s.row}`}
                                    >
                                      <td className="px-4 py-3.5 whitespace-nowrap">
                                        <span className="font-mono text-xs font-semibold text-primary">{item.factorial_code}</span>
                                      </td>
                                      <td className="px-4 py-3.5 font-medium max-w-[160px]">
                                        <span className="line-clamp-1">{item.description}</span>
                                      </td>
                                      <td className="px-4 py-3.5 whitespace-nowrap">
                                        <span className="font-mono text-xs text-muted-foreground">{item.serial_number || "—"}</span>
                                      </td>
                                      <td className="px-4 py-3.5 whitespace-nowrap">{item.vendor || "—"}</td>
                                      <td className="px-4 py-3.5 max-w-[140px]">
                                        <span className="text-xs text-muted-foreground line-clamp-1">
                                          {item.projects_used?.join(", ") || "—"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3.5">
                                        <Badge variant="outline" className={`${getUsageStyle(item.usage).badge} text-xs px-2 py-0`}>
                                          {item.usage}
                                        </Badge>
                                      </td>
                                      <td className="px-4 py-3.5 whitespace-nowrap tabular-nums font-mono">
                                        {fmtQty(Number(item.quantity_of_item))}
                                      </td>
                                      <td className="px-4 py-3.5 whitespace-nowrap tabular-nums font-mono text-amber-300">
                                        {fmtQty(Number(item.quantity_used))}
                                      </td>
                                      <td className="px-4 py-3.5 whitespace-nowrap tabular-nums font-mono text-sky-300">
                                        {fmtQty(Number(item.quantity_remaining))}
                                      </td>
                                      <td className="px-4 py-3.5 whitespace-nowrap tabular-nums text-muted-foreground">
                                        {fmt(Number(item.cost_per_quantity))}
                                      </td>
                                      <td className="px-4 py-3.5 whitespace-nowrap font-bold text-emerald-400">
                                        {fmt(Number(item.total_value))}
                                      </td>
                                      <td className="px-4 py-3.5 whitespace-nowrap text-amber-300 font-medium">
                                        {fmt(Number(item.total_value_used))}
                                      </td>
                                      <td className="px-4 py-3.5 whitespace-nowrap text-sky-300 font-medium">
                                        {fmt(Number(item.total_value_remaining))}
                                      </td>
                                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                                        {fmtDate(item.date)}
                                      </td>
                                      <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-[140px]">
                                        <span className="line-clamp-1">{item.notes || "—"}</span>
                                      </td>
                                      <td className="px-4 py-3.5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            onClick={() => { setEditing(item); setModal("edit"); }}
                                            title="Edit"
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                          </button>
                                          <button
                                            onClick={() => setDeleting(item)}
                                            title="Delete"
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                              <polyline points="3 6 5 6 21 6" />
                                              <path d="M19 6l-1 14H6L5 6" />
                                              <path d="M10 11v6M14 11v6" />
                                              <path d="M9 6V4h6v2" />
                                            </svg>
                                          </button>
                                        </div>
                                      </td>
                                    </motion.tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t border-white/10" style={{ background: "rgba(255,255,255,0.02)" }}>
                                    <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground" colSpan={5}>
                                      {usage} Total
                                    </td>
                                    <td className="px-4 py-2.5" />
                                    <td className="px-4 py-2.5 font-bold tabular-nums">{fmtQty(gQty)}</td>
                                    <td className="px-4 py-2.5 font-bold tabular-nums text-amber-300">{fmtQty(gUsed)}</td>
                                    <td className="px-4 py-2.5 font-bold tabular-nums text-sky-300">{fmtQty(gRemaining)}</td>
                                    <td />
                                    <td className="px-4 py-2.5 font-bold text-emerald-400">{fmt(gTotal)}</td>
                                    <td className="px-4 py-2.5 font-bold text-amber-300">{fmt(gUsedValue)}</td>
                                    <td className="px-4 py-2.5 font-bold text-sky-300">{fmt(gRemValue)}</td>
                                    <td colSpan={4} />
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
                    <span className="text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wider">
                      Grand Total
                    </span>
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