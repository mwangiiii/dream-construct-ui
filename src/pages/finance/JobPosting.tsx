"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Props {
  projectId?: string;
  canEdit?: boolean;
}

interface Project {
  id: string;
  project_number: string;
  title: string;
  description?: string;
  status?: string;
  progress_percent?: number;
  budget_numeric?: number;
  currency?: string;
  site_address?: string;
  site_city?: string;
  site_country?: string;
  start_date?: string;
  expected_completion_date?: string;
  created_at?: string;
}

type JobPhase =
  | "Mobilization"
  | "Excavation"
  | "Foundation"
  | "Superstructure"
  | "Roofing"
  | "Finishes"
  | "Handover";

interface JobPosting {
  id: string;
  project_id: string;
  phase: JobPhase;
  stage: string;
  description: string;
  account_code: string;
  etims_code: string;
  budgeted_amount_paid: number | string;
  actual_amount_used: number | string;
  profit_loss: number | string;
  amount: number | string;
  created_at?: string;
  updated_at?: string;
}

interface Milestone {
  id: string;
  title: string;
}

type FormData = Omit<JobPosting, "id" | "profit_loss" | "created_at" | "updated_at">;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const PHASES: JobPhase[] = [
  "Mobilization",
  "Excavation",
  "Foundation",
  "Superstructure",
  "Roofing",
  "Finishes",
  "Handover",
];

// Alias used by JobCostingView
const JOB_COSTING_PHASES = PHASES;

const PHASE_STYLE: Record<JobPhase, { dot: string; accent: string; badge: string; row: string }> = {
  Mobilization:   { dot: "bg-violet-400",  accent: "text-violet-400",  badge: "bg-violet-500/10 border-violet-500/20 text-violet-300",  row: "hover:bg-violet-500/5"  },
  Excavation:     { dot: "bg-amber-400",   accent: "text-amber-400",   badge: "bg-amber-500/10 border-amber-500/20 text-amber-300",     row: "hover:bg-amber-500/5"   },
  Foundation:     { dot: "bg-orange-400",  accent: "text-orange-400",  badge: "bg-orange-500/10 border-orange-500/20 text-orange-300",  row: "hover:bg-orange-500/5"  },
  Superstructure: { dot: "bg-sky-400",     accent: "text-sky-400",     badge: "bg-sky-500/10 border-sky-500/20 text-sky-300",           row: "hover:bg-sky-500/5"     },
  Roofing:        { dot: "bg-teal-400",    accent: "text-teal-400",    badge: "bg-teal-500/10 border-teal-500/20 text-teal-300",        row: "hover:bg-teal-500/5"    },
  Finishes:       { dot: "bg-pink-400",    accent: "text-pink-400",    badge: "bg-pink-500/10 border-pink-500/20 text-pink-300",        row: "hover:bg-pink-500/5"    },
  Handover:       { dot: "bg-emerald-400", accent: "text-emerald-400", badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300", row: "hover:bg-emerald-500/5" },
};

const STATUS_STYLE: Record<string, string> = {
  planning:    "bg-blue-500/10 border-blue-500/20 text-blue-300",
  active:      "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
  on_hold:     "bg-amber-500/10 border-amber-500/20 text-amber-300",
  completed:   "bg-violet-500/10 border-violet-500/20 text-violet-300",
  cancelled:   "bg-rose-500/10 border-rose-500/20 text-rose-300",
};

const inputCls =
  "w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const fmt = (n: number, prefix = "KES") =>
  `${prefix} ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtC = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
};

const fmtSign = (n: number) =>
  `${n >= 0 ? "+" : ""}${fmt(n)}`;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

const makeEmptyForm = (project_id: string): FormData => ({
  project_id,
  phase: "Mobilization",
  stage: "",
  description: "",
  account_code: "",
  etims_code: "",
  budgeted_amount_paid: 0,
  actual_amount_used: 0,
  amount: 0,
});

// ─── API ──────────────────────────────────────────────────────────────────────

const api = {
  projects: async (): Promise<Project[]> => {
    const { data, error } = await supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,currency,site_address,site_city,site_country,start_date,expected_completion_date,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Project[];
  },

  postingCounts: async (ids: string[]): Promise<Record<string, number>> => {
    const { data, error } = await supabase
      .from("job_postings")
      .select("project_id")
      .in("project_id", ids);
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    (data ?? []).forEach((r: { project_id: string }) => {
      counts[r.project_id] = (counts[r.project_id] ?? 0) + 1;
    });
    return counts;
  },

  milestones: async (projectId: string): Promise<Milestone[]> => {
    const { data, error } = await supabase
      .from("project_milestones")
      .select("id,title")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Milestone[];
  },

  list: async (projectId: string): Promise<JobPosting[]> => {
    const { data, error } = await supabase
      .from("job_postings")
      .select("*")
      .eq("project_id", projectId)
      .order("phase")
      .order("stage");
    if (error) throw new Error(error.message);
    return (data ?? []) as JobPosting[];
  },

  create: async (form: FormData): Promise<JobPosting> => {
    const pl = Number(form.budgeted_amount_paid) - Number(form.actual_amount_used);
    const { data, error } = await supabase
      .from("job_postings")
      .insert({ ...form, profit_loss: pl })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as JobPosting;
  },

  update: async (id: string, form: FormData): Promise<JobPosting> => {
    const pl = Number(form.budgeted_amount_paid) - Number(form.actual_amount_used);
    const { data, error } = await supabase
      .from("job_postings")
      .update({ ...form, profit_loss: pl })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as JobPosting;
  },

  remove: async (id: string): Promise<void> => {
    const { error } = await supabase.from("job_postings").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};

// ─── TOAST HOOK ───────────────────────────────────────────────────────────────

interface Toast { id: number; msg: string; type: "success" | "error" }

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, push };
}

// ─── FIELD WRAPPER ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

// ─── POSTING MODAL ────────────────────────────────────────────────────────────

function PostingModal({
  initial, onSave, onClose, loading, milestones,
}: {
  initial: FormData;
  onSave: (f: FormData) => void;
  onClose: () => void;
  loading: boolean;
  milestones: Milestone[];
}) {
  const [form, setForm] = useState<FormData>(initial);
  const isEdit = "id" in initial;

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const livePL = Number(form.budgeted_amount_paid) - Number(form.actual_amount_used);
  const pct = Number(form.budgeted_amount_paid) > 0
    ? Math.min(200, Math.round((Number(form.actual_amount_used) / Number(form.budgeted_amount_paid)) * 100))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl bg-background/90 my-8"
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-foreground">{isEdit ? "Edit Job Posting" : "New Job Posting"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-2 gap-4">

          {/* Phase */}
          <Field label="Phase *">
            <div className="relative">
              <select
                value={form.phase}
                onChange={e => set("phase", e.target.value as JobPhase)}
                className={inputCls + " appearance-none pr-10"}
              >
                {PHASES.map(ph => (
                  <option key={ph} value={ph} className="bg-background">{ph}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </Field>

          {/* Stage / Milestone */}
          <Field label="Stage / Milestone *">
            {milestones.length > 0 ? (
              <div className="relative">
                <select
                  value={form.stage}
                  onChange={e => set("stage", e.target.value)}
                  className={inputCls + " appearance-none pr-10 font-medium text-sm"}
                >
                  <option value="" className="bg-background text-muted-foreground">— Select a milestone —</option>
                  {milestones.map(m => (
                    <option key={m.id} value={m.title} className="bg-background text-foreground font-medium">
                      {m.title}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <input
                  value={form.stage}
                  onChange={e => set("stage", e.target.value)}
                  placeholder="e.g. Excavation"
                  className={inputCls}
                />
                <p className="text-[10px] text-amber-400/80 flex items-center gap-1">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  </svg>
                  No milestones found for this project. Create milestones in the Tasks tab first.
                </p>
              </div>
            )}
          </Field>

          {/* Description */}
          <div className="col-span-2">
            <Field label="Description">
              <input value={form.description} onChange={e => set("description", e.target.value)}
                placeholder="Describe the job costing…" className={inputCls} />
            </Field>
          </div>

          {/* Account Code */}
          <Field label="Account Code *">
            <input value={form.account_code} onChange={e => set("account_code", e.target.value)}
              placeholder="e.g. 2001" className={inputCls} />
          </Field>

          {/* eTIMS Code */}
          <Field label="eTIMS Code">
            <input value={form.etims_code} onChange={e => set("etims_code", e.target.value)}
              placeholder="e.g. ETIMS-88888" className={inputCls} />
          </Field>

          {/* Budgeted Amount */}
          <Field label="Budgeted Amount (Kshs) *">
            <input type="number" step="0.01" min="0" value={form.budgeted_amount_paid}
              onChange={e => set("budgeted_amount_paid", e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} />
          </Field>

          {/* Actual Amount */}
          <Field label="Actual Amount Used (Kshs) *">
            <input type="number" step="0.01" min="0" value={form.actual_amount_used}
              onChange={e => set("actual_amount_used", e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} />
          </Field>

          {/* Amount */}
          <Field label="Amount (Kshs)">
            <input type="number" step="0.01" min="0" value={form.amount}
              onChange={e => set("amount", e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} />
          </Field>

          {/* Live P&L preview */}
          <div className="flex flex-col justify-center gap-2">
            <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
              livePL >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"
            }`}>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profit / Loss</span>
              <span className={`text-sm font-bold font-mono tabular-nums ${livePL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {fmtSign(livePL)}
              </span>
            </div>
          </div>

          {/* Budget utilisation bar */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1.5 text-xs text-muted-foreground">
              <span className="uppercase tracking-wider font-semibold">Budget Utilisation</span>
              <span className={`font-mono tabular-nums font-semibold ${pct > 100 ? "text-rose-400" : "text-emerald-400"}`}>
                {pct}%
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full transition-all duration-300 ${pct > 100 ? "bg-rose-400" : "bg-emerald-400"}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            {pct > 100 && (
              <p className="text-[10px] text-rose-400 mt-1">
                ⚠ Over budget by {fmt(Number(form.actual_amount_used) - Number(form.budgeted_amount_paid))}
              </p>
            )}
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
            {isEdit ? "Save Changes" : "Add Posting"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DELETE CONFIRM ───────────────────────────────────────────────────────────

function DeleteConfirm({ posting, onConfirm, onClose, loading }: {
  posting: JobPosting; onConfirm: () => void; onClose: () => void; loading: boolean;
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
            <h3 className="font-semibold text-foreground mb-1">Delete Job costing</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Permanently delete{" "}
              <span className="text-foreground font-medium">{posting.stage}</span>{" "}
              (<span className="font-mono text-primary text-xs">{posting.account_code}</span>)?{" "}
              This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white transition-all disabled:opacity-50 flex items-center gap-2">
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Delete Posting
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── PROJECT CARD ─────────────────────────────────────────────────────────────

function ProjectCard({ project, onSelect, postingCount }: {
  project: Project; onSelect: (p: Project) => void; postingCount: number;
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
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
            {project.project_number}
          </span>
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusCls}`}>
            {status.replace(/_/g, " ")}
          </span>
        </div>
        {postingCount > 0 && (
          <span className="text-[10px] text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded-full flex-shrink-0 tabular-nums">
            {postingCount} {postingCount === 1 ? "posting" : "postings"}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-foreground text-sm mb-1.5 group-hover:text-primary transition-colors leading-snug line-clamp-1">
        {project.title}
      </h3>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
          {project.description}
        </p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
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

      {/* Progress bar */}
      {project.progress_percent != null && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-muted-foreground">Progress</span>
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

      {/* CTA hint */}
      <div className="flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        <span>Open Job Costings</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </div>
    </motion.button>
  );
}

// ─── PROJECT PICKER VIEW ──────────────────────────────────────────────────────

function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects,      setProjects]      = useState<Project[]>([]);
  const [fetching,      setFetching]      = useState(true);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [postingCounts, setPostingCounts] = useState<Record<string, number>>({});
  const { toasts, push } = useToast();

  useEffect(() => {
    setFetching(true);
    api.projects()
      .then(async (data) => {
        setProjects(data);
        if (data.length > 0) {
          const counts = await api.postingCounts(data.map(p => p.id));
          setPostingCounts(counts);
        }
      })
      .catch((err: unknown) => push(err instanceof Error ? err.message : "Failed to load projects.", "error"))
      .finally(() => setFetching(false));
  }, [push]);

  const statuses = useMemo(() => {
    const s = new Set(projects.map(p => p.status ?? "planning"));
    return ["all", ...Array.from(s)];
  }, [projects]);

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

  const totalPostings = Object.values(postingCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id}
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">Finance Module</p>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
            Job{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Posting
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Select a project to view or manage its job costings.
          </p>
        </motion.div>

        {/* Summary stat cards */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Projects",         value: projects.length,                   sub: "in system"           },
            { label: "Projects with Costings", value: Object.keys(postingCounts).length, sub: "have job costings"   },
            { label: "Total Job Costings",     value: totalPostings,                     sub: "across all projects" },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
              <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">{card.label}</div>
              <div className="text-3xl font-bold text-foreground tabular-nums">{card.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{card.sub}</div>
            </div>
          ))}
        </motion.div>

        {/* Projects card */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-3xl font-bold">Projects</CardTitle>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, number or city…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all">
                {statuses.map(s => (
                  <option key={s} value={s}>
                    {s === "all" ? "All Statuses" : s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
              <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
                {filtered.length} / {projects.length} shown
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
                  <button onClick={() => { setSearch(""); setStatusFilter("all"); }}
                    className="text-xs text-primary hover:underline">Clear filters</button>
                )}
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(p => (
                  <ProjectCard key={p.id} project={p} onSelect={onSelect} postingCount={postingCounts[p.id] ?? 0} />
                ))}
              </div>
            )}

            {!fetching && projects.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {projects.length} total projects · {Object.keys(postingCounts).length} with job ostings
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── POSTINGS VIEW ────────────────────────────────────────────────────────────

function PostingsView({ project, canEdit, onBack }: {
  project: Project; canEdit: boolean; onBack: () => void;
}) {
  const [postings,    setPostings]    = useState<JobPosting[]>([]);
  const [milestones,  setMilestones]  = useState<Milestone[]>([]);
  const [fetching,    setFetching]    = useState(false);
  const [search,      setSearch]      = useState("");
  const [filterPhase, setFilterPhase] = useState<JobPhase | "All">("All");
  const [expanded,    setExpanded]    = useState<Record<string, boolean>>(
    Object.fromEntries(PHASES.map(ph => [ph, true]))
  );
  const [modal,    setModal]    = useState<null | "create" | "edit">(null);
  const [editing,  setEditing]  = useState<JobPosting | null>(null);
  const [deleting, setDeleting] = useState<JobPosting | null>(null);
  const [saving,   setSaving]   = useState(false);

  const { toasts, push } = useToast();

  useEffect(() => {
    api.milestones(project.id)
      .then(setMilestones)
      .catch((e: unknown) =>
        push(e instanceof Error ? e.message : "Failed to load milestones.", "error")
      );
  }, [project.id, push]);

  const fetchPostings = useCallback(async () => {
    setFetching(true); setPostings([]);
    try {
      const data = await api.list(project.id);
      setPostings(data);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to load job postings.", "error");
    } finally { setFetching(false); }
  }, [project.id, push]);

  useEffect(() => { fetchPostings(); }, [fetchPostings]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleCreate = async (form: FormData) => {
    setSaving(true);
    try {
      const row = await api.create({ ...form, project_id: project.id });
      setPostings(p => [...p, row].sort((a, b) => a.phase.localeCompare(b.phase) || a.stage.localeCompare(b.stage)));
      push("Job Costing added."); setModal(null);
    } catch (e: unknown) { push(e instanceof Error ? e.message : "Failed to add posting.", "error"); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (form: FormData) => {
    if (!editing) return; setSaving(true);
    try {
      const row = await api.update(editing.id, form);
      setPostings(p => p.map(x => x.id === editing.id ? row : x));
      push("Job posting updated."); setModal(null); setEditing(null);
    } catch (e: unknown) { push(e instanceof Error ? e.message : "Failed to update posting.", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return; setSaving(true);
    try {
      await api.remove(deleting.id);
      setPostings(p => p.filter(x => x.id !== deleting.id));
      push("Job posting deleted."); setDeleting(null);
    } catch (e: unknown) { push(e instanceof Error ? e.message : "Failed to delete posting.", "error"); }
    finally { setSaving(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    postings.filter(p => {
      if (filterPhase !== "All" && p.phase !== filterPhase) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.stage.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.account_code.toLowerCase().includes(q) ||
          p.etims_code.toLowerCase().includes(q)
        );
      }
      return true;
    }),
  [postings, filterPhase, search]);

  const grouped = useMemo(() => {
    const g: Partial<Record<JobPhase, JobPosting[]>> = {};
    filtered.forEach(p => {
      if (!g[p.phase]) g[p.phase] = [];
      g[p.phase]!.push(p);
    });
    return g;
  }, [filtered]);

  const grandTotals = useMemo(() => ({
    budgeted: postings.reduce((s, p) => s + Number(p.budgeted_amount_paid), 0),
    actual:   postings.reduce((s, p) => s + Number(p.actual_amount_used),   0),
    pl:       postings.reduce((s, p) => s + Number(p.profit_loss),          0),
    amount:   postings.reduce((s, p) => s + Number(p.amount),               0),
  }), [postings]);

  const phaseSummary = useMemo(() =>
    Object.fromEntries(
      PHASES.map(ph => [ph, {
        count:    postings.filter(p => p.phase === ph).length,
        budgeted: postings.filter(p => p.phase === ph).reduce((s, p) => s + Number(p.budgeted_amount_paid), 0),
        actual:   postings.filter(p => p.phase === ph).reduce((s, p) => s + Number(p.actual_amount_used),   0),
        pl:       postings.filter(p => p.phase === ph).reduce((s, p) => s + Number(p.profit_loss),          0),
      }])
    ) as Record<JobPhase, { count: number; budgeted: number; actual: number; pl: number }>,
  [postings]);

  const status  = project.status ?? "planning";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id}
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
        {modal === "create" && (
          <PostingModal
            initial={makeEmptyForm(project.id)}
            onSave={handleCreate}
            onClose={() => setModal(null)}
            loading={saving}
            milestones={milestones}
          />
        )}
        {modal === "edit" && editing && (
          <PostingModal
            initial={(({ id: _id, profit_loss: _pl, created_at: _ca, updated_at: _ua, ...rest }) => rest)(editing)}
            onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
            milestones={milestones}
          />
        )}
        {deleting && (
          <DeleteConfirm posting={deleting} onConfirm={handleDelete}
            onClose={() => setDeleting(null)} loading={saving} />
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-16">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="mb-10">

          {/* Back button */}
          <button onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            All Projects
          </button>

          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">Job Costing</p>

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
                <p className="text-xl text-muted-foreground mt-2">
                  {project.site_city}{project.site_country ? `, ${project.site_country}` : ""}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Grand summary stat cards */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Budgeted", value: fmtC(grandTotals.budgeted), full: fmt(grandTotals.budgeted), color: "text-foreground"  },
            { label: "Total Actual",   value: fmtC(grandTotals.actual),   full: fmt(grandTotals.actual),   color: "text-primary"    },
            { label: "Net P/L",        value: fmtC(Math.abs(grandTotals.pl)), full: fmtSign(grandTotals.pl), color: grandTotals.pl >= 0 ? "text-emerald-400" : "text-rose-400" },
            { label: "Total Amount",   value: fmtC(grandTotals.amount),   full: fmt(grandTotals.amount),   color: "text-sky-400"    },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5" title={card.full}>
              <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">{card.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">{card.full}</div>
            </div>
          ))}
        </motion.div>

        {/* Phase filter pills */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.13 }}
          className="flex flex-wrap gap-2 mb-8">
          {PHASES.filter(ph => (phaseSummary[ph]?.count ?? 0) > 0).map(ph => {
            const s        = PHASE_STYLE[ph];
            const ps       = phaseSummary[ph];
            const isActive = filterPhase === ph;
            return (
              <button key={ph} onClick={() => setFilterPhase(isActive ? "All" : ph)}
                className={`rounded-2xl border px-4 py-3 text-left transition-all duration-200 backdrop-blur-sm bg-white/5 min-w-[9rem] ${
                  isActive ? "border-white/20 ring-1 ring-white/20 scale-[1.02]" : "border-white/10 hover:border-white/20 hover:scale-[1.01]"
                }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                  <span className={`text-[10px] uppercase tracking-widest font-semibold ${s.accent}`}>{ph}</span>
                </div>
                <div className="text-lg font-bold tabular-nums text-foreground">{ps.count}</div>
                <div className={`text-[10px] font-mono mt-0.5 font-semibold ${ps.pl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  P/L {fmtSign(ps.pl)}
                </div>
              </button>
            );
          })}
        </motion.div>

        {/* Main card */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-3xl font-bold">Job Costings</CardTitle>
              {canEdit && (
                <button onClick={() => setModal("create")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg"
                  style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New Posting
                </button>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by stage, description, account code or eTIMS…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all" />
              </div>
              <div className="relative">
                <select value={filterPhase} onChange={e => setFilterPhase(e.target.value as JobPhase | "All")}
                  className={inputCls + " appearance-none pr-10 font-medium text-sm min-w-[9rem]"}>
                  <option value="All" className="bg-background">All Phases</option>
                  {PHASES.map(ph => (
                    <option key={ph} value={ph} className="bg-background">{ph}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </div>
              <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
                {filtered.length} / {postings.length} shown
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
                <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                Loading job costings…
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
                </svg>
                <p className="text-sm">No job costings found for this project.</p>
                {(search || filterPhase !== "All") && (
                  <button onClick={() => { setSearch(""); setFilterPhase("All"); }}
                    className="text-xs text-primary hover:underline">Clear filters</button>
                )}
                {canEdit && !search && filterPhase === "All" && (
                  <button onClick={() => setModal("create")}
                    className="text-xs text-primary hover:underline">Add first posting</button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/8">

                {PHASES.filter(ph => grouped[ph]).map(ph => {
                  const s      = PHASE_STYLE[ph];
                  const rows   = grouped[ph]!;
                  const isOpen = expanded[ph];
                  const phB    = rows.reduce((s, p) => s + Number(p.budgeted_amount_paid), 0);
                  const phA    = rows.reduce((s, p) => s + Number(p.actual_amount_used),   0);
                  const phPL   = rows.reduce((s, p) => s + Number(p.profit_loss),          0);

                  return (
                    <div key={ph}>
                      {/* Phase group header */}
                      <button
                        onClick={() => setExpanded(prev => ({ ...prev, [ph]: !prev[ph] }))}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                          <span className={`text-xs font-bold uppercase tracking-[0.12em] ${s.accent}`}>{ph}</span>
                          <Badge className={`text-xs px-2.5 py-0.5 font-mono border rounded-full ${s.badge}`}>
                            {rows.length}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-5">
                          <span className="text-xs font-mono tabular-nums text-muted-foreground hidden sm:block">
                            Budg. {fmtC(phB)} · Actual {fmtC(phA)}
                          </span>
                          <span className={`text-sm font-bold tabular-nums font-mono ${phPL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {fmtSign(phPL)}
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
                          <motion.div key={`phase-${ph}`}
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
                                    {[
                                      "Stage / Milestone",
                                      "Description",
                                      "Account Code",
                                      "eTIMS Code",
                                      "Budgeted",
                                      "Actual",
                                      "Profit / Loss",
                                      "Amount",
                                      ...(canEdit ? ["Actions"] : []),
                                    ].map(h => (
                                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((posting, ri) => {
                                    const pl  = Number(posting.profit_loss);
                                    const pct = Number(posting.budgeted_amount_paid) > 0
                                      ? Math.min(200, Math.round((Number(posting.actual_amount_used) / Number(posting.budgeted_amount_paid)) * 100))
                                      : 0;
                                    return (
                                      <motion.tr key={posting.id}
                                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: ri * 0.02, duration: 0.16 }}
                                        className={`border-b border-white/5 transition-colors ${s.row}`}
                                      >
                                        {/* Stage */}
                                        <td className="px-5 py-3.5 whitespace-nowrap font-medium text-foreground">
                                          {posting.stage}
                                        </td>
                                        {/* Description */}
                                        <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[180px]">
                                          <span className="line-clamp-1">{posting.description || "—"}</span>
                                        </td>
                                        {/* Account Code */}
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 border border-white/15 text-muted-foreground">
                                            {posting.account_code}
                                          </Badge>
                                        </td>
                                        {/* eTIMS Code */}
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="font-mono text-xs text-muted-foreground">{posting.etims_code || "—"}</span>
                                        </td>
                                        {/* Budgeted */}
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="text-sm tabular-nums text-foreground font-mono">{fmt(Number(posting.budgeted_amount_paid))}</span>
                                        </td>
                                        {/* Actual + utilisation bar */}
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <div>
                                            <span className="text-sm tabular-nums text-foreground font-mono">{fmt(Number(posting.actual_amount_used))}</span>
                                            <div className="mt-1 w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                                              <div
                                                className={`h-full rounded-full transition-all duration-500 ${pct > 100 ? "bg-rose-400/60" : "bg-emerald-400/60"}`}
                                                style={{ width: `${Math.min(pct, 100)}%` }}
                                              />
                                            </div>
                                            <span className={`text-[10px] font-mono ${pct > 100 ? "text-rose-400" : "text-muted-foreground"}`}>{pct}%</span>
                                          </div>
                                        </td>
                                        {/* P&L */}
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className={`text-sm font-bold tabular-nums font-mono ${pl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                            {fmtSign(pl)}
                                          </span>
                                        </td>
                                        {/* Amount */}
                                        <td className="px-5 py-3.5 whitespace-nowrap">
                                          <span className="text-sm tabular-nums text-sky-400 font-mono">{fmt(Number(posting.amount))}</span>
                                        </td>
                                        {/* Actions */}
                                        {canEdit && (
                                          <td className="px-5 py-3.5 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                              <button onClick={() => { setEditing(posting); setModal("edit"); }} title="Edit"
                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                              </button>
                                              <button onClick={() => setDeleting(posting)} title="Delete"
                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                  <polyline points="3 6 5 6 21 6" />
                                                  <path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                                                </svg>
                                              </button>
                                            </div>
                                          </td>
                                        )}
                                      </motion.tr>
                                    );
                                  })}
                                </tbody>
                                {/* Phase subtotal footer */}
                                <tfoot>
                                  <tr className="border-t border-white/10" style={{ background: "rgba(255,255,255,0.02)" }}>
                                    <td className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground" colSpan={4}>
                                      {ph} Total
                                    </td>
                                    <td className="px-5 py-2.5 text-sm font-bold tabular-nums text-foreground font-mono">{fmt(phB)}</td>
                                    <td className="px-5 py-2.5 text-sm font-bold tabular-nums text-foreground font-mono">{fmt(phA)}</td>
                                    <td className={`px-5 py-2.5 text-sm font-bold tabular-nums font-mono ${phPL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      {fmtSign(phPL)}
                                    </td>
                                    <td colSpan={canEdit ? 2 : 1} />
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
                {postings.length > 0 && (
                  <div className="px-6 py-4 flex flex-wrap items-center gap-6 text-xs font-mono bg-emerald-950/20">
                    <span className="text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wider">Grand Total</span>
                    <span className="text-foreground">Budgeted {fmt(grandTotals.budgeted)}</span>
                    <span className="text-muted-foreground">−</span>
                    <span className="text-foreground">Actual {fmt(grandTotals.actual)}</span>
                    <span className="text-muted-foreground">=</span>
                    <span className={`font-bold ${grandTotals.pl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{fmtSign(grandTotals.pl)}</span>
                    <Badge className="ml-auto bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                      {postings.length} posting{postings.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            {!fetching && postings.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">{postings.length} total posting{postings.length !== 1 ? "s" : ""}</span>
                <button onClick={fetchPostings} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
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

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function JobCostingPage({ projectId, canEdit = true }: Props) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,currency,site_address,site_city,site_country,start_date,expected_completion_date,created_at")
      .eq("id", projectId)
      .single()
      .then(({ data }) => { if (data) setSelectedProject(data as Project); })
      .catch(console.error);
  }, [projectId]);

  return (
    <AnimatePresence mode="wait">
      {selectedProject ? (
        <motion.div key={selectedProject.id}
          initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
          <PostingsView
            project={selectedProject}
            canEdit={canEdit}
            onBack={() => { if (!projectId) setSelectedProject(null); }}
          />
        </motion.div>
      ) : (
        <motion.div key="picker"
          initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.25 }}>
          <ProjectPickerView onSelect={setSelectedProject} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Suppress unused import warning for JOB_COSTING_PHASES alias
void JOB_COSTING_PHASES;