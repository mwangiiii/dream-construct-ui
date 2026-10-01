"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ruler, Plus, X, Loader2, Save, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, type AuthUser } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Project {
  id: string;
  project_number: string;
  title: string;
}

// One row per BoQ item, joined with progress totals from vw_boq_progress.
interface BoQProgress {
  bq_item_id:           number;
  project_id:           string;
  milestone_id:         string | null;
  item_number:          string;
  description:          string;
  unit:                 string;
  boq_quantity:         number;
  boq_rate:             number;
  boq_amount:           number;
  measured_quantity:    number;
  progress_percent:     number;
  value_earned:         number;
  measurement_count:    number;
  last_measurement_date: string | null;
}

interface Measurement {
  id:                number;
  bq_item_id:        number;
  measurement_date:  string;
  measured_quantity: number;
  location:          string;
  notes:             string | null;
  measured_by:       string | null;
  created_at?:       string;
}

type FormData = {
  measurement_date:  string;
  measured_quantity: number | string;
  location:          string;
  notes:             string;
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (s: string) =>
  new Date(s + "T00:00:00").toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });

const inputCls =
  "w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all [color-scheme:dark] [&>option]:bg-[hsl(var(--background))] [&>option]:text-foreground";

const makeEmpty = (): FormData => ({
  measurement_date:  new Date().toISOString().split("T")[0],
  measured_quantity: 0,
  location:          "",
  notes:             "",
});

// ─── PAGE ────────────────────────────────────────────────────────────────────
export default function QSMeasurements() {
  const [user, setUser]                 = useState<AuthUser | null>(null);
  const [projects, setProjects]         = useState<Project[]>([]);
  const [projectId, setProjectId]       = useState<string>("");
  const [rows, setRows]                 = useState<BoQProgress[]>([]);
  const [loading, setLoading]           = useState(true);
  const [fetching, setFetching]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [expanded, setExpanded]         = useState<Record<number, boolean>>({});
  const [measurements, setMeasurements] = useState<Record<number, Measurement[]>>({});
  const [addFor, setAddFor]             = useState<BoQProgress | null>(null);

  useEffect(() => {
    (async () => {
      const [current, projRes] = await Promise.all([
        getCurrentUser(),
        supabase.from("projects").select("id,project_number,title").order("created_at", { ascending: false }),
      ]);
      setUser(current);
      setProjects((projRes.data ?? []) as Project[]);
      setLoading(false);
    })();
  }, []);

  const loadProgress = useCallback(async (pid: string) => {
    setFetching(true);
    const { data } = await supabase
      .from("vw_boq_progress")
      .select("*")
      .eq("project_id", pid)
      .order("item_number");
    setRows((data ?? []) as BoQProgress[]);
    setFetching(false);
  }, []);

  useEffect(() => {
    if (!projectId) { setRows([]); setMeasurements({}); setExpanded({}); return; }
    loadProgress(projectId);
  }, [projectId, loadProgress]);

  const toggle = useCallback(async (item: BoQProgress) => {
    const isOpen = expanded[item.bq_item_id];
    setExpanded(prev => ({ ...prev, [item.bq_item_id]: !isOpen }));
    if (!isOpen && !measurements[item.bq_item_id]) {
      const { data } = await supabase
        .from("bq_measurements")
        .select("*")
        .eq("bq_item_id", item.bq_item_id)
        .order("measurement_date", { ascending: false });
      setMeasurements(prev => ({ ...prev, [item.bq_item_id]: (data ?? []) as Measurement[] }));
    }
  }, [expanded, measurements]);

  const handleAdd = useCallback(async (form: FormData) => {
    if (!addFor) return;
    setSaving(true);
    const { data, error } = await supabase.from("bq_measurements").insert({
      bq_item_id:        addFor.bq_item_id,
      measurement_date:  form.measurement_date,
      measured_quantity: Number(form.measured_quantity) || 0,
      location:          form.location.trim(),
      notes:             form.notes.trim() || null,
      measured_by:       user?.profile.id ?? null,
    }).select().single();
    setSaving(false);
    if (error) { toast({ title: "Failed to record measurement", description: error.message, variant: "destructive" }); return; }
    setMeasurements(prev => ({
      ...prev,
      [addFor.bq_item_id]: [data as Measurement, ...(prev[addFor.bq_item_id] ?? [])],
    }));
    setAddFor(null);
    toast({ title: "Measurement recorded." });
    // Refresh progress totals so the header bar reflects the new sum.
    loadProgress(projectId);
  }, [addFor, user, loadProgress, projectId]);

  const handleDeleteMeasurement = useCallback(async (m: Measurement) => {
    if (!confirm("Delete this measurement?")) return;
    const { error } = await supabase.from("bq_measurements").delete().eq("id", m.id);
    if (error) { toast({ title: "Failed to delete", description: error.message, variant: "destructive" }); return; }
    setMeasurements(prev => ({
      ...prev,
      [m.bq_item_id]: (prev[m.bq_item_id] ?? []).filter(x => x.id !== m.id),
    }));
    toast({ title: "Measurement deleted." });
    loadProgress(projectId);
  }, [loadProgress, projectId]);

  const totals = useMemo(() => ({
    contract:  rows.reduce((s, r) => s + Number(r.boq_amount),   0),
    earned:    rows.reduce((s, r) => s + Number(r.value_earned), 0),
    pending:   rows.filter(r => Number(r.progress_percent) < 100).length,
    completed: rows.filter(r => Number(r.progress_percent) >= 100).length,
  }), [rows]);

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
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold mb-2 text-foreground">Measurements</h1>
        <p className="text-base text-muted-foreground">
          Record measured quantities against each BoQ item. Value earned = min(1, measured / boq) × amount.
        </p>
      </motion.div>

      {/* Project picker */}
      <div className="mb-6">
        <select
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          className={inputCls + " sm:max-w-md appearance-none pr-10"}
        >
          <option value="">— Select project —</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>
          ))}
        </select>
      </div>

      {projectId && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatTile label="Contract value" value={fmt(totals.contract)} />
          <StatTile label="Earned to date" value={fmt(totals.earned)} accent="text-primary" />
          <StatTile label="Items in progress" value={String(totals.pending)} />
          <StatTile label="Items completed" value={String(totals.completed)} accent="text-emerald-400" />
        </div>
      )}

      {!projectId ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <Ruler className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Select a project to view its BoQ items and record measurements.</p>
        </div>
      ) : fetching ? (
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading progress…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="text-muted-foreground">This project has no BoQ items yet.</p>
          <p className="text-xs text-muted-foreground/70 mt-2">Create BoQ items first in <span className="text-primary">Bill of Quantities</span>.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const pct = Number(r.progress_percent);
            const isOpen = expanded[r.bq_item_id];
            const mList = measurements[r.bq_item_id];
            return (
              <div key={r.bq_item_id} className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => toggle(r)}
                  className="w-full text-left px-6 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="font-mono text-xs text-muted-foreground">{r.item_number || "—"}</span>
                        <span className="font-medium text-foreground truncate">{r.description}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Number(r.boq_quantity).toLocaleString("en-KE", { maximumFractionDigits: 3 })} {r.unit} @ KES {Number(r.boq_rate).toLocaleString("en-KE")}/unit
                        {r.last_measurement_date && (
                          <>
                            <span className="mx-2 text-muted-foreground/40">·</span>
                            <span>Last measured {fmtDate(r.last_measurement_date)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Progress</div>
                      <div className={`text-lg font-bold font-mono tabular-nums ${pct >= 100 ? "text-emerald-400" : "text-primary"}`}>{pct}%</div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${pct >= 100 ? "bg-emerald-400/70" : "bg-primary/70"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Measured: <span className="text-foreground font-mono tabular-nums">{Number(r.measured_quantity).toLocaleString("en-KE", { maximumFractionDigits: 3 })} {r.unit}</span></span>
                    <span className="text-muted-foreground">Earned: <span className="text-primary font-mono tabular-nums font-semibold">{fmt(Number(r.value_earned))}</span></span>
                    <span className="text-muted-foreground">Records: <span className="text-foreground font-mono">{r.measurement_count}</span></span>
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-white/8"
                    >
                      <div className="px-6 py-4 bg-black/20">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Measurement records</span>
                          {canEdit && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setAddFor(r); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/25 transition-all"
                            >
                              <Plus className="w-3.5 h-3.5" /> Record
                            </button>
                          )}
                        </div>
                        {mList === undefined ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading records…
                          </div>
                        ) : mList.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-3">No measurements recorded yet.</p>
                        ) : (
                          <div className="divide-y divide-white/5">
                            {mList.map(m => (
                              <div key={m.id} className="flex items-center justify-between gap-4 py-2 text-xs">
                                <div className="flex items-center gap-3 min-w-0">
                                  <Calendar className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                                  <span className="text-muted-foreground shrink-0">{fmtDate(m.measurement_date)}</span>
                                  {m.location && <span className="text-foreground truncate">{m.location}</span>}
                                  {m.notes && <span className="text-muted-foreground/70 truncate italic">{m.notes}</span>}
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="font-mono tabular-nums text-foreground">
                                    {Number(m.measured_quantity).toLocaleString("en-KE", { maximumFractionDigits: 3 })} {r.unit}
                                  </span>
                                  {canEdit && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeleteMeasurement(m); }}
                                      className="p-1 rounded text-muted-foreground/60 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {addFor && (
          <RecordModal
            item={addFor}
            onSave={handleAdd}
            onClose={() => setAddFor(null)}
            saving={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatTile({ label, value, accent = "text-foreground" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}

function RecordModal({ item, onSave, onClose, saving }: {
  item: BoQProgress;
  onSave: (f: FormData) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormData>(makeEmpty());
  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => setForm(p => ({ ...p, [k]: v }));

  const remaining = Math.max(0, Number(item.boq_quantity) - Number(item.measured_quantity));
  const q = Number(form.measured_quantity) || 0;
  const wouldExceed = q > remaining;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl bg-background/90"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-foreground">Record measurement</h2>
            <p className="text-xs text-muted-foreground truncate max-w-md">
              {item.item_number && <span className="font-mono">{item.item_number} · </span>}
              {item.description}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Date *">
            <input type="date" value={form.measurement_date} onChange={e => set("measurement_date", e.target.value)} className={inputCls} required />
          </Field>
          <Field label={`Quantity (${item.unit}) *`}>
            <input type="number" step="0.001" min="0" value={form.measured_quantity} onChange={e => set("measured_quantity", e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} required />
            <p className={`text-[10px] mt-1 ${wouldExceed ? "text-amber-400" : "text-muted-foreground/70"}`}>
              Remaining to BoQ: {remaining.toLocaleString("en-KE", { maximumFractionDigits: 3 })} {item.unit}
              {wouldExceed && " · will over-measure"}
            </p>
          </Field>
          <Field label="Location (chainage / grid ref)" className="sm:col-span-2">
            <input value={form.location} onChange={e => set("location", e.target.value)} placeholder="e.g. Grid A1-A3, Level 2" className={inputCls} />
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
            disabled={saving || q <= 0}
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

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={"flex flex-col gap-1.5 " + className}>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="relative">{children}</div>
    </div>
  );
}
