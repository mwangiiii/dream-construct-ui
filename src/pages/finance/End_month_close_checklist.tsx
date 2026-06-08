"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type TaskStatus  = "Pending" | "In Progress" | "Completed" | "Blocked" | "Skipped";
type Quarter     = "Q1" | "Q2" | "Q3" | "Q4";
type Month       =
  | "January" | "February" | "March"    | "April"
  | "May"     | "June"     | "July"     | "August"
  | "September" | "October" | "November" | "December";

interface ChecklistTask {
  id:          number;
  year:        number;
  quarter:     Quarter;
  month:       Month;
  task_number: string;
  description: string;
  assignee:    string;
  due_date:    string | null;
  status:      TaskStatus;
  notes:       string;
  last_update: string;
  created_at?: string;
  updated_at?: string;
}

type FormData = Omit<ChecklistTask, "id" | "created_at" | "updated_at">;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];
const MONTHS: Month[] = [
  "January", "February", "March",    "April",
  "May",     "June",     "July",     "August",
  "September", "October", "November", "December",
];
const STATUSES: TaskStatus[] = ["Pending", "In Progress", "Completed", "Blocked", "Skipped"];

const QUARTER_OF_MONTH: Record<Month, Quarter> = {
  January: "Q1", February: "Q1", March:     "Q1",
  April:   "Q2", May:      "Q2", June:      "Q2",
  July:    "Q3", August:   "Q3", September: "Q3",
  October: "Q4", November: "Q4", December:  "Q4",
};

const QUARTER_STYLE: Record<Quarter, { accent: string; badge: string; dot: string; row: string }> = {
  Q1: { accent: "text-sky-400",     badge: "bg-sky-500/10     border-sky-500/30     text-sky-300",     dot: "bg-sky-400",     row: "hover:bg-sky-950/30"     },
  Q2: { accent: "text-violet-400",  badge: "bg-violet-500/10  border-violet-500/30  text-violet-300",  dot: "bg-violet-400",  row: "hover:bg-violet-950/30"  },
  Q3: { accent: "text-amber-400",   badge: "bg-amber-500/10   border-amber-500/30   text-amber-300",   dot: "bg-amber-400",   row: "hover:bg-amber-950/30"   },
  Q4: { accent: "text-emerald-400", badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", dot: "bg-emerald-400", row: "hover:bg-emerald-950/30" },
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  "Completed":   "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  "In Progress": "bg-sky-500/10     border-sky-500/30     text-sky-300",
  "Pending":     "bg-yellow-500/10  border-yellow-500/30  text-yellow-300",
  "Blocked":     "bg-rose-500/10    border-rose-500/30    text-rose-400",
  "Skipped":     "bg-slate-500/10   border-slate-500/30   text-slate-400",
};

const STATUS_DOT: Record<TaskStatus, string> = {
  "Completed":   "bg-emerald-400",
  "In Progress": "bg-sky-400",
  "Pending":     "bg-yellow-400",
  "Blocked":     "bg-rose-400",
  "Skipped":     "bg-slate-500",
};

const CURRENT_YEAR = new Date().getFullYear();

const makeEmptyForm = (): FormData => ({
  year:        CURRENT_YEAR,
  quarter:     "Q1",
  month:       "January",
  task_number: "",
  description: "",
  assignee:    "",
  due_date:    null,
  status:      "Pending",
  notes:       "",
  last_update: new Date().toISOString().slice(0, 10),
});

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ─── API ──────────────────────────────────────────────────────────────────────

function throwSb(error: { message?: string } | null, ctx: string): never {
  throw new Error(error?.message ?? `Supabase error during ${ctx}`);
}

const api = {
  async list(): Promise<ChecklistTask[]> {
    const { data, error } = await supabase
      .from("end_month_close_checklist")
      .select("*")
      .order("year",        { ascending: false })
      .order("quarter",     { ascending: false })
      .order("month",       { ascending: false })
      .order("task_number", { ascending: true  });
    if (error) throwSb(error, "list");
    return (data ?? []) as ChecklistTask[];
  },

  async create(body: FormData): Promise<ChecklistTask> {
    const { data, error } = await supabase
      .from("end_month_close_checklist")
      .insert([body])
      .select()
      .single();
    if (error) throwSb(error, "create");
    return data as ChecklistTask;
  },

  async update(id: number, body: FormData): Promise<ChecklistTask> {
    const { data, error } = await supabase
      .from("end_month_close_checklist")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throwSb(error, "update");
    return data as ChecklistTask;
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from("end_month_close_checklist")
      .delete()
      .eq("id", id);
    if (error) throwSb(error, "delete");
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

// ─── TASK MODAL ───────────────────────────────────────────────────────────────

function TaskModal({
  initial, onSave, onClose, loading,
}: {
  initial: FormData & { id?: number };
  onSave:  (d: FormData) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<FormData>({ ...initial });
  const isEdit = Boolean(initial.id);

  const setField = (k: keyof FormData, v: unknown) =>
    setForm((prev) => {
      const next = { ...prev, [k]: v } as FormData;
      if (k === "month") next.quarter = QUARTER_OF_MONTH[v as Month];
      return next;
    });

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
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            {isEdit ? "Edit Task" : "New Checklist Task"}
          </h2>
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
        <div className="px-6 py-5 grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">

          <Field label="Year *">
            <input
              type="number" min={2000} max={2100} value={form.year}
              onChange={(e) => setField("year", parseInt(e.target.value) || CURRENT_YEAR)}
              className={inputCls}
            />
          </Field>

          <Field label="Month *">
            <div className="relative">
              <select
                value={form.month}
                onChange={(e) => setField("month", e.target.value as Month)}
                className={inputCls + " appearance-none pr-10 font-medium tracking-wide text-sm"}
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m} className="bg-background text-foreground font-medium">{m}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </Field>

          <Field label="Quarter">
            <div className="relative">
              <select
                value={form.quarter}
                onChange={(e) => setField("quarter", e.target.value as Quarter)}
                className={inputCls + " appearance-none pr-10 font-medium tracking-wide text-sm"}
              >
                {QUARTERS.map((q) => (
                  <option key={q} value={q} className="bg-background text-foreground font-medium">{q}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </Field>

          <Field label="Task Number *">
            <input
              value={form.task_number}
              onChange={(e) => setField("task_number", e.target.value)}
              placeholder="e.g. T-001"
              className={inputCls}
            />
          </Field>

          <div className="col-span-2">
            <Field label="Description *">
              <input
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Describe the closing task…"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Assignee">
            <input
              value={form.assignee}
              onChange={(e) => setField("assignee", e.target.value)}
              placeholder="e.g. John Doe"
              className={inputCls}
            />
          </Field>

          <Field label="Status *">
            <div className="relative">
              <select
                value={form.status}
                onChange={(e) => setField("status", e.target.value as TaskStatus)}
                className={inputCls + " appearance-none pr-10 font-medium tracking-wide text-sm"}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s} className="bg-background text-foreground font-medium">{s}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </Field>

          <Field label="Due Date">
            <input
              type="date"
              value={form.due_date ?? ""}
              onChange={(e) => setField("due_date", e.target.value || null)}
              className={inputCls}
            />
          </Field>

          <Field label="Last Update">
            <input
              type="date"
              value={form.last_update}
              onChange={(e) => setField("last_update", e.target.value || new Date().toISOString().slice(0, 10))}
              className={inputCls}
            />
          </Field>

          <div className="col-span-2">
            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={2}
                placeholder="Additional notes or blockers…"
                className={inputCls + " resize-none"}
              />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5"
          >
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
            {isEdit ? "Save Changes" : "Add Task"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DELETE CONFIRM ───────────────────────────────────────────────────────────

function DeleteConfirm({
  task, onConfirm, onClose, loading,
}: {
  task:      ChecklistTask;
  onConfirm: () => void;
  onClose:   () => void;
  loading:   boolean;
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1   }}
        exit={{   opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18 }}
      >
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Delete Task</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Permanently delete{" "}
              <span className="text-foreground font-medium">{task.description}</span>{" "}
              (<span className="font-mono text-primary text-xs">{task.task_number}</span>)?{" "}
              This cannot be undone.
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
            className="px-4 py-2 text-sm font-medium rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            Delete Task
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function EndMonthCloseChecklistPage() {
  const [tasks,        setTasks]        = useState<ChecklistTask[]>([]);
  const [fetching,     setFetching]     = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterYear,   setFilterYear]   = useState<number | "All">("All");
  const [filterQ,      setFilterQ]      = useState<Quarter | "All">("All");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "All">("All");
  const [expanded,     setExpanded]     = useState<Record<string, boolean>>({});
  const [modal,        setModal]        = useState<null | "create" | "edit">(null);
  const [editing,      setEditing]      = useState<ChecklistTask | null>(null);
  const [deleting,     setDeleting]     = useState<ChecklistTask | null>(null);
  const [saving,       setSaving]       = useState(false);

  const { toasts, push } = useToast();

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    setFetching(true);
    setTasks([]);
    try {
      const data = await api.list();
      setTasks(data);
      // Default-expand all year groups
      const years = [...new Set(data.map((t) => t.year))];
      setExpanded(Object.fromEntries(years.map((y) => [y, true])));
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to load tasks.", "error");
    } finally { setFetching(false); }
  }, [push]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async (form: FormData) => {
    setSaving(true);
    try {
      const row = await api.create(form);
      setTasks((p) => [row, ...p]);
      push("Task added successfully.");
      setModal(null);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to add task.", "error");
    } finally { setSaving(false); }
  };

  // ── Update ────────────────────────────────────────────────────────────────
  const handleUpdate = async (form: FormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      setTasks((p) => p.map((t) => (t.id === editing.id ? row : t)));
      push("Task updated successfully.");
      setModal(null); setEditing(null);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to update task.", "error");
    } finally { setSaving(false); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      setTasks((p) => p.filter((t) => t.id !== deleting.id));
      push("Task deleted.");
      setDeleting(null);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to delete task.", "error");
    } finally { setSaving(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const availableYears = useMemo(() =>
    [...new Set(tasks.map((t) => t.year))].sort((a, b) => b - a),
  [tasks]);

  const filtered = useMemo(() =>
    tasks.filter((t) => {
      if (filterYear   !== "All" && t.year    !== filterYear)   return false;
      if (filterQ      !== "All" && t.quarter !== filterQ)      return false;
      if (filterStatus !== "All" && t.status  !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.task_number.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.assignee.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    }),
  [tasks, filterYear, filterQ, filterStatus, search]);

  // Group by year → quarter → month
  const grouped = useMemo(() => {
    const byYear: Record<number, Record<Quarter, Record<Month, ChecklistTask[]>>> = {};
    filtered.forEach((t) => {
      if (!byYear[t.year])              byYear[t.year] = { Q1: {} as Record<Month, ChecklistTask[]>, Q2: {} as Record<Month, ChecklistTask[]>, Q3: {} as Record<Month, ChecklistTask[]>, Q4: {} as Record<Month, ChecklistTask[]> };
      if (!byYear[t.year][t.quarter])   byYear[t.year][t.quarter] = {} as Record<Month, ChecklistTask[]>;
      if (!byYear[t.year][t.quarter][t.month]) byYear[t.year][t.quarter][t.month] = [];
      byYear[t.year][t.quarter][t.month].push(t);
    });
    return byYear;
  }, [filtered]);

  const sortedYears = useMemo(() =>
    Object.keys(grouped).map(Number).sort((a, b) => b - a),
  [grouped]);

  // Grand status counts from ALL tasks
  const statusCounts = useMemo(() =>
    Object.fromEntries(
      STATUSES.map((s) => [s, tasks.filter((t) => t.status === s).length])
    ) as Record<TaskStatus, number>,
  [tasks]);

  // Quarter task counts
  const quarterCounts = useMemo(() =>
    Object.fromEntries(
      QUARTERS.map((q) => [q, tasks.filter((t) => t.quarter === q).length])
    ) as Record<Quarter, number>,
  [tasks]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">

      {/* ── Toasts ──────────────────────────────────────────────────────────── */}
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
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal === "create" && (
          <TaskModal
            initial={makeEmptyForm()}
            onSave={handleCreate}
            onClose={() => setModal(null)}
            loading={saving}
          />
        )}
        {modal === "edit" && editing && (
          <TaskModal
            initial={{ ...editing }}
            onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
          />
        )}
        {deleting && (
          <DeleteConfirm
            task={deleting}
            onConfirm={handleDelete}
            onClose={() => setDeleting(null)}
            loading={saving}
          />
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-16">

        {/* ── Hero ────────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="mb-12 text-center"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">
            Finance Module
          </p>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
            End Month{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Close
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Track month-end closing tasks, assignees, and completion status.
          </p>
        </motion.div>

        {/* ── Summary stat cards ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
        >
          {[
            { label: "Total Tasks",     value: tasks.length,                        sub: "across all periods"       },
            { label: "Completed",       value: statusCounts["Completed"] ?? 0,      sub: "tasks signed off"         },
            { label: "Open Tasks",      value: (statusCounts["Pending"] ?? 0) + (statusCounts["In Progress"] ?? 0) + (statusCounts["Blocked"] ?? 0), sub: "pending, in progress, or blocked" },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">
                {card.label}
              </div>
              <div className="text-3xl font-bold text-foreground tabular-nums">{card.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{card.sub}</div>
            </div>
          ))}
        </motion.div>

        {/* ── Quarter stat cards — clickable filters ───────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }}
          className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8"
        >
          {QUARTERS.map((q) => {
            const s        = QUARTER_STYLE[q];
            const isActive = filterQ === q;
            return (
              <button
                key={q}
                onClick={() => setFilterQ(isActive ? "All" : q)}
                className={`rounded-2xl border p-4 text-left transition-all duration-200 backdrop-blur-sm bg-white/5 ${
                  isActive ? "border-white/20 ring-1 ring-white/20 scale-[1.02]" : "border-white/10 hover:border-white/20 hover:scale-[1.01]"
                }`}
              >
                <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${s.accent}`}>{q}</div>
                <div className="text-2xl font-bold tabular-nums text-foreground">{quarterCounts[q] ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-1">tasks</div>
              </button>
            );
          })}

          {/* Status breakdown card */}
          <div className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
            <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">
              By Status
            </div>
            <div className="flex flex-col gap-1 mt-1">
              {STATUSES.filter((s) => (statusCounts[s] ?? 0) > 0).map((s) => (
                <div key={s} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[s]}`} />
                    {s}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-foreground">{statusCounts[s]}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Main card ────────────────────────────────────────────────────────── */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-3xl font-bold">Checklist Tasks</CardTitle>
              <button
                onClick={() => setModal("create")}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg"
                style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Task
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by task number, description or assignee…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all"
                />
              </div>
              {/* Year filter */}
              <div className="relative">
                <select
                  value={filterYear === "All" ? "All" : String(filterYear)}
                  onChange={(e) => setFilterYear(e.target.value === "All" ? "All" : Number(e.target.value))}
                  className={inputCls + " appearance-none pr-10 font-medium tracking-wide text-sm min-w-[7.5rem]"}
                >
                  <option value="All" className="bg-background text-foreground font-medium">All Years</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y} className="bg-background text-foreground font-medium">{y}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </div>
              {/* Status filter */}
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as TaskStatus | "All")}
                  className={inputCls + " appearance-none pr-10 font-medium tracking-wide text-sm min-w-[9rem]"}
                >
                  <option value="All" className="bg-background text-foreground font-medium">All Statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-background text-foreground font-medium">{s}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </div>
              <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
                {filtered.length} / {tasks.length} shown
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
                <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                Loading checklist…
              </div>
            ) : sortedYears.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" />
                </svg>
                <p className="text-sm">No checklist tasks found.</p>
                {(search || filterQ !== "All" || filterStatus !== "All") && (
                  <button
                    onClick={() => { setSearch(""); setFilterQ("All"); setFilterStatus("All"); setFilterYear("All"); }}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {sortedYears.map((year) => {
                  const isYearOpen  = expanded[year] ?? true;
                  const yearTasks   = QUARTERS.flatMap((q) =>
                    Object.values(grouped[year]?.[q] ?? {}).flat()
                  );
                  const yearDone    = yearTasks.filter((t) => t.status === "Completed").length;
                  const yearPct     = yearTasks.length > 0 ? Math.round((yearDone / yearTasks.length) * 100) : 0;

                  return (
                    <div key={year}>
                      {/* Year group header */}
                      <button
                        onClick={() => setExpanded((p) => ({ ...p, [year]: !p[year] }))}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-primary/70" />
                          <span className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{year}</span>
                          <Badge className="text-xs px-2.5 py-0.5 font-mono border rounded-full bg-primary/10 border-primary/20 text-primary">
                            {yearTasks.length}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Progress bar */}
                          <div className="hidden sm:flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: "linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))" }}
                                initial={{ width: 0 }}
                                animate={{ width: `${yearPct}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                              />
                            </div>
                            <span className="text-xs font-mono tabular-nums text-primary">{yearPct}%</span>
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">
                            {yearDone} / {yearTasks.length} complete
                          </span>
                          <svg
                            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isYearOpen ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                          >
                            <path d="m6 9 6 6 6-6" />
                          </svg>
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isYearOpen && (
                          <motion.div
                            key={`year-${year}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{   height: 0,    opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            style={{ overflow: "hidden" }}
                          >
                            {/* Quarter sub-groups */}
                            {QUARTERS.filter((q) => grouped[year]?.[q] && Object.keys(grouped[year][q]).length > 0).map((q) => {
                              const s          = QUARTER_STYLE[q];
                              const qMonths    = grouped[year][q];
                              const qAllTasks  = Object.values(qMonths).flat();
                              const qDone      = qAllTasks.filter((t) => t.status === "Completed").length;

                              return (
                                <div key={q} className="border-t border-white/5">
                                  {/* Quarter sub-header */}
                                  <div
                                    className="flex items-center justify-between px-8 py-2.5"
                                    style={{ background: "rgba(255,255,255,0.02)" }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                      <span className={`text-[11px] font-bold uppercase tracking-widest ${s.accent}`}>{q}</span>
                                      <Badge className={`text-[10px] px-2 py-0 font-mono border rounded-full ${s.badge}`}>
                                        {qAllTasks.length}
                                      </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                      {qDone} / {qAllTasks.length} complete
                                    </span>
                                  </div>

                                  {/* Month sub-groups */}
                                  {MONTHS.filter((m) => qMonths[m]?.length > 0).map((month) => {
                                    const mTasks = qMonths[month];
                                    const mDone  = mTasks.filter((t) => t.status === "Completed").length;
                                    const mPct   = mTasks.length > 0 ? Math.round((mDone / mTasks.length) * 100) : 0;

                                    return (
                                      <div key={month} className="border-t border-white/4">
                                        {/* Month label */}
                                        <div
                                          className="flex items-center justify-between px-10 py-2"
                                          style={{ background: "rgba(255,255,255,0.01)" }}
                                        >
                                          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                                            {month}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                                              <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                  width: `${mPct}%`,
                                                  background: "linear-gradient(90deg,hsl(var(--primary)),hsl(var(--accent)))"
                                                }}
                                              />
                                            </div>
                                            <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                                              {mDone}/{mTasks.length}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Tasks table */}
                                        {/* Mobile card list — no horizontal scroll */}
                                        <div className="md:hidden divide-y divide-white/8 px-3 pb-3">
                                          {mTasks.map((task) => {
                                            const meta = [
                                              { label: "Assignee",    node: task.assignee || "—" },
                                              { label: "Due Date",    node: fmtDate(task.due_date) },
                                              { label: "Last Update", node: fmtDate(task.last_update) },
                                              ...(task.notes ? [{ label: "Notes", node: task.notes }] : []),
                                            ];
                                            return (
                                              <div key={task.id} className={`py-4 ${task.status === "Completed" ? "opacity-60" : ""}`}>
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                  <div className="min-w-0">
                                                    <p className="font-medium text-foreground text-sm line-clamp-2">{task.description}</p>
                                                    <p className="font-mono text-xs text-primary mt-0.5">{task.task_number}</p>
                                                  </div>
                                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${STATUS_STYLE[task.status]}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[task.status]}`} />
                                                    {task.status}
                                                  </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                                  {meta.map((m, mi) => (
                                                    <div key={mi} className="flex items-center justify-between gap-2">
                                                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{m.label}</span>
                                                      <span className="font-mono text-xs text-muted-foreground/90 truncate text-right">{m.node}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/8">
                                                  <button onClick={() => { setEditing(task); setModal("edit"); }}
                                                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground border border-white/10 hover:bg-white/5 transition-all">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    Edit
                                                  </button>
                                                  <button onClick={() => setDeleting(task)}
                                                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:bg-rose-500/10 transition-all">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                                                    Delete
                                                  </button>
                                                </div>
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
                                                  "Task #", "Description", "Assignee",
                                                  "Due Date", "Status", "Last Update", "Notes", "Actions"
                                                ].map((h) => (
                                                  <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                                                    {h}
                                                  </th>
                                                ))}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {mTasks.map((task, ri) => (
                                                <motion.tr
                                                  key={task.id}
                                                  initial={{ opacity: 0, x: -6 }}
                                                  animate={{ opacity: 1, x:  0 }}
                                                  transition={{ delay: ri * 0.02, duration: 0.16 }}
                                                  className={`border-b border-white/5 transition-colors ${s.row} ${task.status === "Completed" ? "opacity-60" : ""}`}
                                                >
                                                  <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <span className="font-mono text-xs font-semibold text-primary">
                                                      {task.task_number}
                                                    </span>
                                                  </td>
                                                  <td className="px-5 py-3.5 font-medium text-foreground max-w-xs">
                                                    <div className="flex items-center gap-2">
                                                      {task.status === "Completed" && (
                                                        <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                                          <path d="m5 13 4 4L19 7" />
                                                        </svg>
                                                      )}
                                                      <span className="line-clamp-1">{task.description}</span>
                                                    </div>
                                                  </td>
                                                  <td className="px-5 py-3.5 whitespace-nowrap text-sm text-foreground">
                                                    {task.assignee || <span className="text-muted-foreground">—</span>}
                                                  </td>
                                                  <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                                                    {fmtDate(task.due_date)}
                                                  </td>
                                                  <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${STATUS_STYLE[task.status]}`}>
                                                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[task.status]}`} />
                                                      {task.status}
                                                    </span>
                                                  </td>
                                                  <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                                                    {fmtDate(task.last_update)}
                                                  </td>
                                                  <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-xs">
                                                    <span className="line-clamp-1">{task.notes || "—"}</span>
                                                  </td>
                                                  <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                      <button
                                                        onClick={() => { setEditing(task); setModal("edit"); }}
                                                        title="Edit"
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                                                      >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                        </svg>
                                                      </button>
                                                      <button
                                                        onClick={() => setDeleting(task)}
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
                                          </table>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            {!fetching && tasks.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {tasks.length} total tasks &middot; {availableYears.length} year{availableYears.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={fetchTasks}
                  className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
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