"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList, Plus, Edit2, Trash2, Search, X, Loader2, Save, ArrowLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, type AuthUser } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Project {
  id: string;
  project_number: string;
  title: string;
  status: string | null;
}

interface Milestone {
  id: string;
  title: string;
}

interface BoQItem {
  id: number;
  project_id: string;
  milestone_id: string | null;
  item_number: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

type FormData = {
  item_number: string;
  description: string;
  unit: string;
  quantity: number | string;
  rate: number | string;
  milestone_id: string | null;
  notes: string;
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const UNITS = ["m", "m²", "m³", "kg", "tonnes", "no", "sum", "hours", "days", "units"] as const;

const inputCls =
  "w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all [color-scheme:dark] [&>option]:bg-[hsl(var(--background))] [&>option]:text-foreground";

const makeEmpty = (): FormData => ({
  item_number:  "",
  description:  "",
  unit:         "no",
  quantity:     0,
  rate:         0,
  milestone_id: null,
  notes:        "",
});

// ─── PAGE ────────────────────────────────────────────────────────────────────
export default function QSBillOfQuantities() {
  const [user, setUser]                 = useState<AuthUser | null>(null);
  const [projects, setProjects]         = useState<Project[]>([]);
  const [projectId, setProjectId]       = useState<string>("");
  const [milestones, setMilestones]     = useState<Milestone[]>([]);
  const [items, setItems]               = useState<BoQItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [fetching, setFetching]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [search, setSearch]             = useState("");
  const [modal, setModal]               = useState<null | "create" | "edit">(null);
  const [editing, setEditing]           = useState<BoQItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BoQItem | null>(null);

  // ── Load current user + projects ────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [current, projRes] = await Promise.all([
        getCurrentUser(),
        supabase.from("projects").select("id,project_number,title,status").order("created_at", { ascending: false }),
      ]);
      setUser(current);
      setProjects((projRes.data ?? []) as Project[]);
      setLoading(false);
    })();
  }, []);

  // ── Load milestones + BoQ items when project changes ────────────────────
  useEffect(() => {
    if (!projectId) { setItems([]); setMilestones([]); return; }
    setFetching(true);
    (async () => {
      const [msRes, itRes] = await Promise.all([
        supabase.from("project_milestones").select("id,title").eq("project_id", projectId).order("sort_order"),
        supabase.from("bill_of_quantities").select("*").eq("project_id", projectId).order("item_number").order("id"),
      ]);
      setMilestones((msRes.data ?? []) as Milestone[]);
      setItems((itRes.data ?? []) as BoQItem[]);
      setFetching(false);
    })();
  }, [projectId]);

  // ── Filter + group ──────────────────────────────────────────────────────
  const filtered = useMemo(() => items.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return i.item_number.toLowerCase().includes(q)
        || i.description.toLowerCase().includes(q);
  }), [items, search]);

  const grouped = useMemo(() => {
    const g: Record<string, BoQItem[]> = { unassigned: [] };
    milestones.forEach(m => { g[m.id] = []; });
    filtered.forEach(i => {
      const key = i.milestone_id ?? "unassigned";
      if (!g[key]) g[key] = [];
      g[key].push(i);
    });
    return g;
  }, [filtered, milestones]);

  const totals = useMemo(() => ({
    itemCount: items.length,
    grandTotal: items.reduce((s, i) => s + Number(i.amount), 0),
  }), [items]);

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const handleCreate = useCallback(async (form: FormData) => {
    setSaving(true);
    const { data, error } = await supabase.from("bill_of_quantities").insert({
      project_id:   projectId,
      milestone_id: form.milestone_id,
      item_number:  form.item_number.trim(),
      description:  form.description.trim(),
      unit:         form.unit,
      quantity:     Number(form.quantity) || 0,
      rate:         Number(form.rate) || 0,
      notes:        form.notes.trim() || null,
      created_by:   user?.profile.id ?? null,
    }).select().single();
    setSaving(false);
    if (error) { toast({ title: "Failed to add BoQ item", description: error.message, variant: "destructive" }); return; }
    setItems(prev => [...prev, data as BoQItem]);
    setModal(null);
    toast({ title: "BoQ item added." });
  }, [projectId, user]);

  const handleUpdate = useCallback(async (form: FormData) => {
    if (!editing) return;
    setSaving(true);
    const { data, error } = await supabase.from("bill_of_quantities").update({
      milestone_id: form.milestone_id,
      item_number:  form.item_number.trim(),
      description:  form.description.trim(),
      unit:         form.unit,
      quantity:     Number(form.quantity) || 0,
      rate:         Number(form.rate) || 0,
      notes:        form.notes.trim() || null,
    }).eq("id", editing.id).select().single();
    setSaving(false);
    if (error) { toast({ title: "Failed to update BoQ item", description: error.message, variant: "destructive" }); return; }
    setItems(prev => prev.map(i => i.id === editing.id ? (data as BoQItem) : i));
    setModal(null);
    setEditing(null);
    toast({ title: "BoQ item updated." });
  }, [editing]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    setSaving(true);
    const { error } = await supabase.from("bill_of_quantities").delete().eq("id", confirmDelete.id);
    setSaving(false);
    if (error) { toast({ title: "Failed to delete", description: error.message, variant: "destructive" }); return; }
    setItems(prev => prev.filter(i => i.id !== confirmDelete.id));
    setConfirmDelete(null);
    toast({ title: "BoQ item deleted." });
  }, [confirmDelete]);

  const canEdit = Boolean(user?.roles.some(r =>
    ["admin", "manager", "quantity_surveyor"].includes(r.role_name)
  ));

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-full">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold mb-2 text-foreground">Bill of Quantities</h1>
        <p className="text-base text-muted-foreground">
          Priced schedule of works per project. amount = quantity × rate.
        </p>
      </motion.div>

      {/* Project + search bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className={inputCls + " appearance-none pr-10"}
          >
            <option value="">— Select project —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>
            ))}
          </select>
        </div>
        {projectId && (
          <>
            <div className="relative sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search items…"
                className={inputCls + " pl-10"}
              />
            </div>
            {canEdit && (
              <button
                onClick={() => { setEditing(null); setModal("create"); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-background font-semibold hover:bg-primary/90 transition-all"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            )}
          </>
        )}
      </div>

      {/* Totals bar */}
      {projectId && items.length > 0 && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 flex flex-wrap gap-6 items-center text-sm">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Grand Total</span>
          <span className="text-foreground font-mono">{totals.itemCount} items</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-lg font-bold text-primary font-mono tabular-nums">{fmt(totals.grandTotal)}</span>
        </div>
      )}

      {/* Content */}
      {!projectId ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <ClipboardList className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Select a project to view or create its Bill of Quantities.</p>
        </div>
      ) : fetching ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading BoQ…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="text-muted-foreground mb-4">No BoQ items yet for this project.</p>
          {canEdit && (
            <button
              onClick={() => { setEditing(null); setModal("create"); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-background font-semibold hover:bg-primary/90 transition-all"
            >
              <Plus className="w-4 h-4" /> Add First Item
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Milestone groups */}
          {milestones.map(m => grouped[m.id]?.length ? (
            <BoQGroup
              key={m.id}
              title={m.title}
              items={grouped[m.id]}
              canEdit={canEdit}
              onEdit={i => { setEditing(i); setModal("edit"); }}
              onDelete={setConfirmDelete}
            />
          ) : null)}
          {/* Unassigned (no milestone) */}
          {grouped.unassigned?.length ? (
            <BoQGroup
              title="Unassigned to a milestone"
              items={grouped.unassigned}
              canEdit={canEdit}
              onEdit={i => { setEditing(i); setModal("edit"); }}
              onDelete={setConfirmDelete}
            />
          ) : null}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {modal === "create" && (
          <ItemModal
            initial={makeEmpty()}
            milestones={milestones}
            onSave={handleCreate}
            onClose={() => setModal(null)}
            saving={saving}
            title="New BoQ Item"
          />
        )}
        {modal === "edit" && editing && (
          <ItemModal
            initial={{
              item_number:  editing.item_number,
              description:  editing.description,
              unit:         editing.unit,
              quantity:     editing.quantity,
              rate:         editing.rate,
              milestone_id: editing.milestone_id,
              notes:        editing.notes ?? "",
            }}
            milestones={milestones}
            onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }}
            saving={saving}
            title="Edit BoQ Item"
          />
        )}
        {confirmDelete && (
          <ConfirmDelete
            item={confirmDelete}
            onConfirm={handleDelete}
            onClose={() => setConfirmDelete(null)}
            saving={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SUBCOMPONENTS ────────────────────────────────────────────────────────────
function BoQGroup({ title, items, canEdit, onEdit, onDelete }: {
  title: string;
  items: BoQItem[];
  canEdit: boolean;
  onEdit: (i: BoQItem) => void;
  onDelete: (i: BoQItem) => void;
}) {
  const subtotal = items.reduce((s, i) => s + Number(i.amount), 0);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="px-6 py-3 border-b border-white/10 bg-white/[0.03] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold uppercase tracking-wider text-primary">{title}</span>
          <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
        </div>
        <span className="text-sm font-mono tabular-nums text-foreground">{`KES ${subtotal.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-white/5">
              <th className="px-5 py-2.5">Item #</th>
              <th className="px-5 py-2.5">Description</th>
              <th className="px-5 py-2.5">Unit</th>
              <th className="px-5 py-2.5 text-right">Qty</th>
              <th className="px-5 py-2.5 text-right">Rate</th>
              <th className="px-5 py-2.5 text-right">Amount</th>
              {canEdit && <th className="px-5 py-2.5 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{i.item_number || "—"}</td>
                <td className="px-5 py-3 text-foreground">{i.description}</td>
                <td className="px-5 py-3 text-xs text-muted-foreground">{i.unit}</td>
                <td className="px-5 py-3 text-right font-mono tabular-nums text-foreground">{Number(i.quantity).toLocaleString("en-KE", { maximumFractionDigits: 3 })}</td>
                <td className="px-5 py-3 text-right font-mono tabular-nums text-foreground">{Number(i.rate).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td>
                <td className="px-5 py-3 text-right font-mono tabular-nums text-primary font-semibold">{Number(i.amount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td>
                {canEdit && (
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => onEdit(i)} title="Edit" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(i)} title="Delete" className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ItemModal({ initial, milestones, onSave, onClose, saving, title }: {
  initial: FormData;
  milestones: Milestone[];
  onSave: (f: FormData) => void;
  onClose: () => void;
  saving: boolean;
  title: string;
}) {
  const [form, setForm] = useState<FormData>(initial);
  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => setForm(p => ({ ...p, [k]: v }));
  const liveAmount = (Number(form.quantity) || 0) * (Number(form.rate) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl bg-background/90 my-8"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Item # (e.g. 1.1.1)">
            <input value={form.item_number} onChange={e => set("item_number", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Milestone">
            <select value={form.milestone_id ?? ""} onChange={e => set("milestone_id", e.target.value || null)} className={inputCls + " appearance-none pr-10"}>
              <option value="">— Unassigned —</option>
              {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </Field>
          <Field label="Description *" className="sm:col-span-2">
            <textarea rows={2} value={form.description} onChange={e => set("description", e.target.value)} className={inputCls} required />
          </Field>
          <Field label="Unit *">
            <select value={form.unit} onChange={e => set("unit", e.target.value)} className={inputCls + " appearance-none pr-10"}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Quantity *">
            <input type="number" step="0.001" min="0" value={form.quantity} onChange={e => set("quantity", e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} required />
          </Field>
          <Field label="Rate (KES) *">
            <input type="number" step="0.01" min="0" value={form.rate} onChange={e => set("rate", e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} required />
          </Field>
          <Field label="Amount (computed)">
            <div className={inputCls + " flex items-center justify-end font-mono tabular-nums text-primary font-semibold"}>
              {fmt(liveAmount)}
            </div>
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.description.trim() || Number(form.quantity) <= 0 || Number(form.rate) < 0}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-background font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ConfirmDelete({ item, onConfirm, onClose, saving }: {
  item: BoQItem;
  onConfirm: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-md rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl bg-background/90"
      >
        <div className="px-6 py-5">
          <h2 className="text-lg font-bold text-foreground mb-2">Delete BoQ item?</h2>
          <p className="text-sm text-muted-foreground mb-1">{item.item_number ? `${item.item_number} · ` : ""}{item.description}</p>
          <p className="text-xs text-rose-300/80">All measurements against this item will also be deleted (cascade).</p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 font-semibold hover:bg-rose-500/25 disabled:opacity-50 transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={"flex flex-col gap-1.5 " + className}>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="relative">{children}</div>
    </div>
  );
}

// suppress unused
void ArrowLeft;
