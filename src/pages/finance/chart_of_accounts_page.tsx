"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type AccountType = "Receivable" | "Payable" | "N/A";
type Category    = "Asset" | "Liability" | "Equity" | "Income" | "Expense";
type Subcategory =
  | "Current Asset" | "Non-Current Asset"
  | "Current Liability" | "Non-Current Liability"
  | "Owner's Equity" | "Retained Earnings"
  | "Direct Income" | "Indirect Income"
  | "Cost of Goods Sold" | "Operating Expense" | "Non-Operating Expense";

interface Account {
  id: number;
  account_type: AccountType;
  category: Category;
  subcategory: Subcategory;
  account_code: string;
  account_name: string;
  description: string;
  bank_name: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

type FormData = Omit<Account, "id" | "created_at" | "updated_at">;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CATEGORY_ORDER: Category[] = ["Asset", "Liability", "Equity", "Income", "Expense"];

const SUBCATEGORIES: Record<Category, Subcategory[]> = {
  Asset:     ["Current Asset", "Non-Current Asset"],
  Liability: ["Current Liability", "Non-Current Liability"],
  Equity:    ["Owner's Equity", "Retained Earnings"],
  Income:    ["Direct Income", "Indirect Income"],
  Expense:   ["Cost of Goods Sold", "Operating Expense", "Non-Operating Expense"],
};

const CATEGORY_STYLE: Record<Category, { accent: string; badge: string; dot: string; row: string }> = {
  Asset:     { accent: "text-emerald-400", badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", dot: "bg-emerald-400", row: "hover:bg-emerald-950/30" },
  Liability: { accent: "text-rose-400",    badge: "bg-rose-500/10    border-rose-500/30    text-rose-300",    dot: "bg-rose-400",    row: "hover:bg-rose-950/30" },
  Equity:    { accent: "text-violet-400",  badge: "bg-violet-500/10  border-violet-500/30  text-violet-300",  dot: "bg-violet-400",  row: "hover:bg-violet-950/30" },
  Income:    { accent: "text-sky-400",     badge: "bg-sky-500/10     border-sky-500/30     text-sky-300",     dot: "bg-sky-400",     row: "hover:bg-sky-950/30" },
  Expense:   { accent: "text-amber-400",   badge: "bg-amber-500/10   border-amber-500/30   text-amber-300",   dot: "bg-amber-400",   row: "hover:bg-amber-950/30" },
};

const TYPE_STYLE: Record<AccountType, string> = {
  Receivable: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
  Payable:    "bg-orange-500/10 border-orange-500/30 text-orange-300",
  "N/A":      "bg-slate-500/10 border-slate-500/30 text-slate-400",
};

const EMPTY_FORM: FormData = {
  account_type: "N/A",
  category:     "Asset",
  subcategory:  "Current Asset",
  account_code: "",
  account_name: "",
  description:  "",
  bank_name:    "N/A",
  active:       true,
};

// ─── API — uses Supabase JS client directly against PostgREST (/rest/v1/) ────
// This bypasses the edge function entirely in the browser, eliminating the
// CORS preflight problem. The edge function is still useful for server-side
// or third-party integrations, but the browser talks directly to PostgREST.

function throwSb(error: { message?: string } | null, ctx: string): never {
  throw new Error(error?.message ?? `Supabase error during ${ctx}`);
}

const api = {
  async list(): Promise<{ data: Account[] }> {
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .order("account_code", { ascending: true });
    if (error) throwSb(error, "list");
    return { data: (data ?? []) as Account[] };
  },

  async create(body: FormData): Promise<{ data: Account }> {
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .insert([body])
      .select()
      .single();
    if (error) throwSb(error, "create");
    return { data: data as Account };
  },

  async update(id: number, body: FormData): Promise<{ data: Account }> {
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throwSb(error, "update");
    return { data: data as Account };
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from("chart_of_accounts")
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

// ─── SHARED INPUT STYLE ───────────────────────────────────────────────────────

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

// ─── ACCOUNT MODAL ────────────────────────────────────────────────────────────

function AccountModal({
  initial, onSave, onClose, loading,
}: {
  initial: FormData & { id?: number };
  onSave: (d: FormData) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM, ...initial });
  const isEdit = Boolean(initial.id);

  const set = (k: keyof FormData, v: unknown) =>
    setForm((p) => {
      const next = { ...p, [k]: v } as FormData;
      if (k === "category") next.subcategory = SUBCATEGORIES[v as Category][0];
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
        className="relative w-full max-w-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-xl bg-white/10"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            {isEdit ? "Edit Account" : "New Account"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
          <Field label="Account Code *">
            <input value={form.account_code} onChange={(e) => set("account_code", e.target.value)} placeholder="e.g. 1010" className={inputCls} />
          </Field>

          <Field label="Account Type *">
            <div className="relative">
              <select
                value={form.account_type}
                onChange={(e) => set("account_type", e.target.value as AccountType)}
                className={
                  inputCls +
                  " appearance-none pr-10 font-medium tracking-wide text-sm focus:ring-2 focus:ring-primary/60 focus:border-primary/40 transition-all"
                }
              >
                {(["Receivable", "Payable", "N/A"] as AccountType[]).map((t) => (
                  <option key={t} value={t} className="bg-background text-foreground font-medium">
                    {t}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </Field>

          <Field label="Category *">
            <div className="relative">
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value as Category)}
                className={
                  inputCls +
                  " appearance-none pr-10 font-medium tracking-wide text-sm focus:ring-2 focus:ring-primary/60 focus:border-primary/40 transition-all"
                }
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c} className="bg-background text-foreground font-medium">
                    {c}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </Field>

          <Field label="Subcategory *">
            <div className="relative">
              <select
                value={form.subcategory}
                onChange={(e) => set("subcategory", e.target.value as Subcategory)}
                className={
                  inputCls +
                  " appearance-none pr-10 font-medium tracking-wide text-sm focus:ring-2 focus:ring-primary/60 focus:border-primary/40 transition-all"
                }
              >
                {SUBCATEGORIES[form.category].map((s) => (
                  <option key={s} value={s} className="bg-background text-foreground font-medium">
                    {s}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </Field>

          <div className="col-span-2">
            <Field label="Account Name *">
              <input value={form.account_name} onChange={(e) => set("account_name", e.target.value)} placeholder="e.g. Cash – Operating Account" className={inputCls} />
            </Field>
          </div>

          <div className="col-span-2">
            <Field label="Description">
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Brief description of this account" className={inputCls + " resize-none"} />
            </Field>
          </div>

          <Field label="Bank Name">
            <input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} placeholder="N/A or bank name" className={inputCls} />
          </Field>

          <Field label="Status">
            <div className="relative">
              <select
                value={form.active ? "true" : "false"}
                onChange={(e) => set("active", e.target.value === "true")}
                className={
                  inputCls +
                  " appearance-none pr-10 font-medium tracking-wide text-sm focus:ring-2 focus:ring-primary/60 focus:border-primary/40 transition-all"
                }
              >
                <option value="true" className="bg-background text-foreground font-medium">Active</option>
                <option value="false" className="bg-background text-foreground font-medium">Inactive</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={loading}
            className="px-5 py-2 text-sm font-medium rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center gap-2"
            style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
          >
            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isEdit ? "Save Changes" : "Create Account"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DELETE CONFIRM ───────────────────────────────────────────────────────────

function DeleteConfirm({ account, onConfirm, onClose, loading }: {
  account: Account; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl backdrop-blur-xl bg-white/10"
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18 }}
      >
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Delete Account</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Permanently delete <span className="text-foreground font-medium">{account.account_name}</span>{" "}
              <span className="font-mono text-primary text-xs">({account.account_code})</span>? This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">Cancel</button>
          <button
            onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Delete Account
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts]         = useState<Account[]>([]);
  const [fetching, setFetching]         = useState(true);
  const [search, setSearch]             = useState("");
  const [filterCat, setFilterCat]       = useState<Category | "All">("All");
  const [filterStatus, setFilterStatus] = useState<"All" | "Active" | "Inactive">("All");
  const [expanded, setExpanded]         = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORY_ORDER.map((c) => [c, true]))
  );
  const [modal, setModal]       = useState<null | "create" | "edit">(null);
  const [editing, setEditing]   = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [saving, setSaving]     = useState(false);

  const { toasts, push } = useToast();

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchAccounts = useCallback(async () => {
    setFetching(true);
    try {
      const res = await api.list();
      setAccounts(res.data ?? []);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to load accounts.", "error");
    } finally {
      setFetching(false);
    }
  }, [push]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  // ── Create ───────────────────────────────────────────────────────────────
  const handleCreate = async (form: FormData) => {
    setSaving(true);
    try {
      const res = await api.create(form);
      setAccounts((p) =>
        [...p, res.data].sort((a, b) => a.account_code.localeCompare(b.account_code))
      );
      push("Account created successfully.");
      setModal(null);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to create account.", "error");
    } finally { setSaving(false); }
  };

  // ── Update ───────────────────────────────────────────────────────────────
  const handleUpdate = async (form: FormData) => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await api.update(editing.id, form);
      setAccounts((p) => p.map((a) => (a.id === editing.id ? res.data : a)));
      push("Account updated successfully.");
      setModal(null);
      setEditing(null);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to update account.", "error");
    } finally { setSaving(false); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.remove(deleting.id);
      setAccounts((p) => p.filter((a) => a.id !== deleting.id));
      push("Account deleted.");
      setDeleting(null);
    } catch (e: unknown) {
      push(e instanceof Error ? e.message : "Failed to delete account.", "error");
    } finally { setSaving(false); }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => accounts.filter((a) => {
    if (filterCat !== "All" && a.category !== filterCat) return false;
    if (filterStatus === "Active"   && !a.active) return false;
    if (filterStatus === "Inactive" &&  a.active) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.account_name.toLowerCase().includes(q) ||
        a.account_code.includes(q) ||
        (a.description ?? "").toLowerCase().includes(q) ||
        a.subcategory.toLowerCase().includes(q)
      );
    }
    return true;
  }), [accounts, filterCat, filterStatus, search]);

  const grouped = useMemo(() => {
    const g: Partial<Record<Category, Account[]>> = {};
    CATEGORY_ORDER.forEach((cat) => {
      const items = filtered.filter((a) => a.category === cat);
      if (items.length) g[cat] = items;
    });
    return g;
  }, [filtered]);

  const totals = useMemo(() =>
    Object.fromEntries(CATEGORY_ORDER.map((c) => [c, accounts.filter((a) => a.category === c).length])),
  [accounts]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">

      {/* ── Toasts ── */}
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

      {/* ── Modals ── */}
      <AnimatePresence>
        {modal === "create" && (
          <AccountModal initial={{ ...EMPTY_FORM }} onSave={handleCreate} onClose={() => setModal(null)} loading={saving} />
        )}
        {modal === "edit" && editing && (
          <AccountModal
            initial={{ ...editing }}
            onSave={handleUpdate}
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
          />
        )}
        {deleting && (
          <DeleteConfirm account={deleting} onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={saving} />
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-16">

        {/* ── Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="mb-12 text-center"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 font-medium">General Ledger</p>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
            Chart of{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Accounts
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Master ledger for all financial accounts — classified by type, category, and subcategory.
          </p>
        </motion.div>

        {/* ── Category stat cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8"
        >
          {CATEGORY_ORDER.map((cat) => {
            const s = CATEGORY_STYLE[cat];
            const isActive = filterCat === cat;
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(isActive ? "All" : cat)}
                className={`rounded-2xl border p-4 text-left transition-all duration-200 backdrop-blur-sm ${
                  isActive
                    ? "bg-white/10 border-white/20 ring-1 ring-white/15"
                    : "bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/15"
                }`}
              >
                <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2 ${s.accent}`}>{cat}</div>
                <div className="text-3xl font-bold text-foreground tabular-nums">{totals[cat] ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-0.5">accounts</div>
              </button>
            );
          })}
        </motion.div>

        {/* ── Main card ── */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-3xl font-bold">Accounts Register</CardTitle>
              <button
                onClick={() => setModal("create")}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg"
                style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Account
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, code, or description…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all"
                />
              </div>
              <select
                value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="px-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
                {filtered.length} / {accounts.length} shown
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {fetching ? (
              <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
                <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                Loading accounts…
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
                <p className="text-sm">No accounts match your filters.</p>
                <button
                  onClick={() => { setSearch(""); setFilterCat("All"); setFilterStatus("All"); }}
                  className="text-xs text-primary hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/8">
                {CATEGORY_ORDER.filter((c) => grouped[c]).map((category) => {
                  const s      = CATEGORY_STYLE[category];
                  const isOpen = expanded[category];
                  const rows   = grouped[category]!;

                  return (
                    <div key={category}>
                      {/* Group toggle */}
                      <button
                        onClick={() => setExpanded((p) => ({ ...p, [category]: !p[category] }))}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                          <span className={`text-xs font-bold uppercase tracking-[0.12em] ${s.accent}`}>{category}</span>
                          <Badge className={`text-xs px-2.5 py-0.5 font-mono border rounded-full ${s.badge}`}>
                            {rows.length}
                          </Badge>
                        </div>
                        <svg
                          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>

                      {/* Rows */}
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
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-y border-white/6" style={{ background: "rgba(255,255,255,0.03)" }}>
                                    {["Code", "Account Name", "Type", "Subcategory", "Description", "Bank", "Status", "Actions"].map((h) => (
                                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((acc, ri) => (
                                    <motion.tr
                                      key={acc.id}
                                      initial={{ opacity: 0, x: -6 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: ri * 0.02, duration: 0.16 }}
                                      className={`border-b border-white/5 transition-colors ${s.row} ${!acc.active ? "opacity-40" : ""}`}
                                    >
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className="font-mono text-xs font-semibold text-primary">{acc.account_code}</span>
                                      </td>
                                      <td className="px-5 py-3.5 whitespace-nowrap font-medium text-foreground">
                                        {acc.account_name}
                                      </td>
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-mono ${TYPE_STYLE[acc.account_type]}`}>
                                          {acc.account_type}
                                        </span>
                                      </td>
                                      <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                                        {acc.subcategory}
                                      </td>
                                      <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-xs">
                                        <span className="line-clamp-1">{acc.description || "—"}</span>
                                      </td>
                                      <td className="px-5 py-3.5 whitespace-nowrap text-xs font-mono text-muted-foreground">
                                        {acc.bank_name !== "N/A"
                                          ? <span className="text-foreground/70">{acc.bank_name}</span>
                                          : <span className="text-white/20">—</span>
                                        }
                                      </td>
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        {acc.active ? (
                                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                                            <span className="w-1 h-1 rounded-full bg-emerald-400" />Active
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-500 text-xs">
                                            <span className="w-1 h-1 rounded-full bg-slate-500" />Inactive
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-5 py-3.5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            onClick={() => { setEditing(acc); setModal("edit"); }}
                                            title="Edit"
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                          </button>
                                          <button
                                            onClick={() => setDeleting(acc)}
                                            title="Delete"
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                              <polyline points="3 6 5 6 21 6" />
                                              <path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
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
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            {!fetching && accounts.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {accounts.length} total &middot; {accounts.filter((a) => a.active).length} active &middot; {accounts.filter((a) => !a.active).length} inactive
                </span>
                <button onClick={fetchAccounts} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
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