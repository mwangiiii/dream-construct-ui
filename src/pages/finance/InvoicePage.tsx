"use client";
import React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";

// ─── All mutations go through the Edge Function at /functions/v1/invoices ────
// The Edge Function handles: JWT auth, server-side validation, audit logging,
// and all DB writes. The frontend only reads directly from Supabase (SELECT).

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

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled" | "partial";

interface LineItem {
  id: string;           // client-side uuid
  description: string;
  hours?: number | null;
  qty?: number | null;
  unit_price: number;
  amount: number;
}

interface Invoice {
  id: string;
  project_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  // Company
  company_name: string;
  company_address: string | null;
  company_city_state_zip: string | null;
  company_phone: string | null;
  company_email: string | null;
  // Bill To
  client_company_name: string;
  client_contact_name: string | null;
  client_address: string | null;
  client_phone: string | null;
  client_email: string | null;
  // Project Info
  project_start_date: string | null;
  project_end_date: string | null;
  project_location: string | null;
  project_client_ref: string | null;
  // Dates
  invoice_date: string;
  due_date: string;
  // Line items (stored as JSONB)
  labor_items: LineItem[];
  material_items: LineItem[];
  other_items: LineItem[];
  // Financials
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  total_tax: number;
  total: number;
  // Payment
  payment_terms: string | null;
  bank_name: string | null;
  account_number: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

type InvoiceFormData = Omit<Invoice, "id" | "subtotal" | "total_tax" | "total" | "created_at" | "updated_at">;

interface Props {
  projectId?: string;
  canEdit?: boolean;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "partial", "overdue", "cancelled"];

const STATUS_STYLE: Record<InvoiceStatus, { badge: string; row: string }> = {
  draft:     { badge: "bg-slate-500/10 border-slate-500/30 text-slate-300",       row: "hover:bg-slate-950/20"   },
  sent:      { badge: "bg-sky-500/10 border-sky-500/30 text-sky-300",             row: "hover:bg-sky-950/20"     },
  paid:      { badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", row: "hover:bg-emerald-950/20" },
  partial:   { badge: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",    row: "hover:bg-yellow-950/20"  },
  overdue:   { badge: "bg-rose-500/10 border-rose-500/30 text-rose-300",          row: "hover:bg-rose-950/20"    },
  cancelled: { badge: "bg-zinc-500/10 border-zinc-500/30 text-zinc-400",          row: "hover:bg-zinc-950/20"    },
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft", sent: "Sent", paid: "Paid",
  partial: "Partial", overdue: "Overdue", cancelled: "Cancelled",
};

const PROJECT_STATUS_STYLE: Record<string, string> = {
  planning:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  on_hold:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const newLineItem = (): LineItem => ({
  id: crypto.randomUUID(),
  description: "",
  hours: null,
  qty: null,
  unit_price: 0,
  amount: 0,
});

const makeEmpty = (projectId: string | null): InvoiceFormData => ({
  project_id:             projectId,
  invoice_number:         "",
  status:                 "draft",
  company_name:           "",
  company_address:        null,
  company_city_state_zip: null,
  company_phone:          null,
  company_email:          null,
  client_company_name:    "",
  client_contact_name:    null,
  client_address:         null,
  client_phone:           null,
  client_email:           null,
  project_start_date:     null,
  project_end_date:       null,
  project_location:       null,
  project_client_ref:     null,
  invoice_date:           new Date().toISOString().split("T")[0],
  due_date:               "",
  labor_items:            [newLineItem()],
  material_items:         [newLineItem()],
  other_items:            [newLineItem()],
  discount_amount:        0,
  tax_rate:               5,
  payment_terms:          null,
  bank_name:              null,
  account_number:         null,
  notes:                  null,
});

// ─── FORMATTERS ───────────────────────────────────────────────────────────────
const fmtKES = (n: number) =>
  `KES ${new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2 }).format(Number(n) || 0)}`;

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ─── DERIVED TOTALS ───────────────────────────────────────────────────────────
function computeTotals(form: InvoiceFormData) {
  const allItems = [...form.labor_items, ...form.material_items, ...form.other_items];
  const subtotal = allItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const subtotalLessDiscount = subtotal - (Number(form.discount_amount) || 0);
  const totalTax = subtotalLessDiscount * ((Number(form.tax_rate) || 0) / 100);
  const total = subtotalLessDiscount + totalTax;
  return { subtotal, subtotalLessDiscount, totalTax, total };
}

// ─── EDGE FUNCTION API ────────────────────────────────────────────────────────
// Derive the project URL from the already-initialised supabase client so
// process.env is never referenced at browser runtime.
const SUPABASE_PROJECT_URL: string =
  (supabase as unknown as { supabaseUrl?: string }).supabaseUrl ?? "";
const EDGE_BASE = `${SUPABASE_PROJECT_URL}/functions/v1/invoices`;

async function edgeRequest(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated.");
  const res = await fetch(EDGE_BASE, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

const api = {
  async projects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,site_city,site_country,expected_completion_date,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Project[];
  },

  async list(projectId: string): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("project_id", projectId)
      .order("invoice_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Invoice[];
  },

  async listAll(): Promise<Invoice[]> {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("invoice_date", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Invoice[];
  },

  async create(form: InvoiceFormData): Promise<Invoice> {
    const { subtotal, subtotalLessDiscount, totalTax, total } = computeTotals(form);
    const json = await edgeRequest("POST", {
      action: "create",
      payload: { ...form, subtotal, subtotal_less_discount: subtotalLessDiscount, total_tax: totalTax, total },
    });
    return json.data as Invoice;
  },

  async update(id: string, form: InvoiceFormData): Promise<Invoice> {
    const { subtotal, subtotalLessDiscount, totalTax, total } = computeTotals(form);
    const json = await edgeRequest("PATCH", {
      action: "update",
      id,
      payload: { ...form, subtotal, subtotal_less_discount: subtotalLessDiscount, total_tax: totalTax, total },
    });
    return json.data as Invoice;
  },

  async remove(id: string): Promise<void> {
    await edgeRequest("DELETE", { action: "delete", id });
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

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const inputCls =
  "w-full px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 text-foreground " +
  "placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60 " +
  "focus:border-primary/40 transition-all";

const selectCls =
  "w-full px-3 py-2 rounded-xl text-sm border text-foreground focus:outline-none " +
  "focus:ring-1 focus:ring-primary/60 focus:border-primary/40 transition-all " +
  "appearance-none pr-10 font-medium bg-[#111318] border-white/10 [color-scheme:dark]";

const SelectChevron = () => (
  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  </span>
);

function Field({ label, hint, children, span2 }: {
  label: string; hint?: string; children: React.ReactNode; span2?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${span2 ? "col-span-2" : ""}`}>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground/60 italic">{hint}</span>}
    </div>
  );
}

function NumericInput({ value, onChange, step = "0.01", min = "0", max, placeholder }: {
  value: number; onChange: (n: number) => void;
  step?: string; min?: string; max?: string; placeholder?: string;
}) {
  const [display, setDisplay] = useState(value === 0 ? "" : String(value));
  useEffect(() => { setDisplay(value === 0 ? "" : String(value)); }, [value]);
  return (
    <input type="number" step={step} min={min} max={max}
      value={display} placeholder={placeholder ?? "0"}
      className={inputCls}
      onChange={e => { setDisplay(e.target.value); onChange(parseFloat(e.target.value) || 0); }}
      onBlur={() => { const s = parseFloat(display) || 0; onChange(s); setDisplay(s === 0 ? "" : String(s)); }}
    />
  );
}

function ToastStack({ toasts }: { toasts: { id: number; msg: string; type: "success" | "error" }[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id}
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium border backdrop-blur-xl shadow-lg ${
              t.type === "success"
                ? "bg-emerald-950/80 border-emerald-500/25 text-emerald-300"
                : "bg-rose-950/80 border-rose-500/25 text-rose-300"
            }`}>{t.msg}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── LINE ITEMS SECTION ───────────────────────────────────────────────────────
function LineItemsSection({
  title, items, type, onChange,
}: {
  title: string;
  items: LineItem[];
  type: "labor" | "material" | "other";
  onChange: (items: LineItem[]) => void;
}) {
  const isLabor = type === "labor";

  const update = (id: string, field: keyof LineItem, val: unknown) => {
    onChange(items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: val };
      // Recompute amount
      if (isLabor) {
        updated.amount = (Number(updated.hours) || 0) * (Number(updated.unit_price) || 0);
      } else {
        updated.amount = (Number(updated.qty) || 0) * (Number(updated.unit_price) || 0);
      }
      return updated;
    }));
  };

  const add = () => onChange([...items, newLineItem()]);
  const remove = (id: string) => onChange(items.filter(i => i.id !== id));

  return (
    <div className="mb-2">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-primary px-2">{title}</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {/* Header row */}
      <div className={`grid gap-2 mb-2 px-1 ${isLabor ? "grid-cols-[2fr_1fr_1fr_1fr_auto]" : "grid-cols-[2fr_1fr_1fr_1fr_auto]"}`}>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Description</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{isLabor ? "Hours" : "Qty"}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{isLabor ? "Rate" : "Unit Price"}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Amount</span>
        <span />
      </div>

      {items.map((item, ri) => (
        <motion.div key={item.id}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ri * 0.03 }}
          className="grid gap-2 mb-2 items-center"
          style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr auto" }}
        >
          <input value={item.description}
            onChange={e => update(item.id, "description", e.target.value)}
            placeholder={isLabor ? "e.g. Site supervision" : "e.g. Steel bars"}
            className={inputCls} />
          <NumericInput
            value={isLabor ? (item.hours ?? 0) : (item.qty ?? 0)}
            onChange={v => update(item.id, isLabor ? "hours" : "qty", v)}
            step="1" placeholder="0"
          />
          <NumericInput
            value={item.unit_price}
            onChange={v => update(item.id, "unit_price", v)}
            placeholder="0.00"
          />
          {/* Amount — read-only computed */}
          <div className="px-3 py-2 rounded-xl text-sm bg-white/[0.03] border border-white/[0.06] text-emerald-400 font-mono font-semibold tabular-nums cursor-not-allowed select-none">
            {fmtKES(item.amount)}
          </div>
          <button onClick={() => remove(item.id)}
            disabled={items.length === 1}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </motion.div>
      ))}

      <button onClick={add}
        className="mt-1 inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add {title} line
      </button>
    </div>
  );
}

// ─── INVOICE MODAL ────────────────────────────────────────────────────────────
function InvoiceModal({
  initial, onSave, onClose, loading, projects = [], showProjectSelector = false,
}: {
  initial: InvoiceFormData & { id?: string };
  onSave: (d: InvoiceFormData) => void;
  onClose: () => void;
  loading: boolean;
  projects?: Project[];
  showProjectSelector?: boolean;
}) {
  const [form, setForm] = useState<InvoiceFormData>({ ...initial });
  const isEdit = Boolean(initial.id);
  const [tab, setTab] = useState<"details" | "items" | "payment">("details");

  const set = <K extends keyof InvoiceFormData>(k: K, v: InvoiceFormData[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const { subtotal, subtotalLessDiscount, totalTax, total } = computeTotals(form);
  const isStandalone = showProjectSelector && (!form.project_id || form.project_id === "");

  const tabs = [
    { key: "details"  as const, label: "Details"  },
    { key: "items"    as const, label: "Line Items" },
    { key: "payment"  as const, label: "Payment"  },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} />
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
              {isEdit ? "Edit Invoice" : "New Invoice"}
            </h2>
            {isStandalone && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Not linked to any project — appears in the firm-wide register only.
              </p>
            )}
          </div>
          <button onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-white/10">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-white/10 pb-0">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-widest rounded-t-lg transition-all ${
                tab === t.key
                  ? "bg-white/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 max-h-[62vh] overflow-y-auto">

          {/* ── TAB: Details ── */}
          {tab === "details" && (
            <div className="space-y-5">

              {/* Project selector */}
              {showProjectSelector && (
                <div>
                  <Field label="Linked Project" hint="Leave blank for standalone / firm-wide invoice">
                    <div className="relative">
                      <select value={form.project_id ?? ""}
                        onChange={e => set("project_id", e.target.value || null)}
                        className={selectCls}>
                        <option value="">— No project (firm-wide / standalone) —</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.project_number} — {p.title}</option>
                        ))}
                      </select>
                      <SelectChevron />
                    </div>
                  </Field>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Invoice Number *">
                  <input value={form.invoice_number}
                    onChange={e => set("invoice_number", e.target.value)}
                    placeholder="e.g. INV-2026-001" className={inputCls} />
                </Field>
                <Field label="Status *">
                  <div className="relative">
                    <select value={form.status}
                      onChange={e => set("status", e.target.value as InvoiceStatus)}
                      className={selectCls}>
                      {INVOICE_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                    <SelectChevron />
                  </div>
                </Field>
                <Field label="Invoice Date *">
                  <input type="date" value={form.invoice_date}
                    onChange={e => set("invoice_date", e.target.value)}
                    className={inputCls + " [color-scheme:dark]"} />
                </Field>
                <Field label="Due Date *">
                  <input type="date" value={form.due_date}
                    onChange={e => set("due_date", e.target.value)}
                    className={inputCls + " [color-scheme:dark]"} />
                </Field>
              </div>

              {/* Company info */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary mb-3">Your Company</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Company Name *">
                    <input value={form.company_name}
                      onChange={e => set("company_name", e.target.value)}
                      placeholder="e.g. Acme Builders Ltd" className={inputCls} />
                  </Field>
                  <Field label="Street Address">
                    <input value={form.company_address ?? ""}
                      onChange={e => set("company_address", e.target.value || null)}
                      placeholder="123 Main St" className={inputCls} />
                  </Field>
                  <Field label="City / State / ZIP">
                    <input value={form.company_city_state_zip ?? ""}
                      onChange={e => set("company_city_state_zip", e.target.value || null)}
                      placeholder="Nairobi, Kenya" className={inputCls} />
                  </Field>
                  <Field label="Phone">
                    <input value={form.company_phone ?? ""}
                      onChange={e => set("company_phone", e.target.value || null)}
                      placeholder="+254 7XX XXX XXX" className={inputCls} />
                  </Field>
                  <Field label="Email" span2>
                    <input type="email" value={form.company_email ?? ""}
                      onChange={e => set("company_email", e.target.value || null)}
                      placeholder="info@company.com" className={inputCls} />
                  </Field>
                </div>
              </div>

              {/* Bill To */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary mb-3">Bill To</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Client Company *">
                    <input value={form.client_company_name}
                      onChange={e => set("client_company_name", e.target.value)}
                      placeholder="Client Co. Ltd" className={inputCls} />
                  </Field>
                  <Field label="Contact Name">
                    <input value={form.client_contact_name ?? ""}
                      onChange={e => set("client_contact_name", e.target.value || null)}
                      placeholder="John Doe" className={inputCls} />
                  </Field>
                  <Field label="Address" span2>
                    <input value={form.client_address ?? ""}
                      onChange={e => set("client_address", e.target.value || null)}
                      placeholder="Client street address" className={inputCls} />
                  </Field>
                  <Field label="Phone">
                    <input value={form.client_phone ?? ""}
                      onChange={e => set("client_phone", e.target.value || null)}
                      placeholder="+254 7XX XXX XXX" className={inputCls} />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={form.client_email ?? ""}
                      onChange={e => set("client_email", e.target.value || null)}
                      placeholder="client@company.com" className={inputCls} />
                  </Field>
                </div>
              </div>

              {/* Project Info */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary mb-3">Project Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start Date">
                    <input type="date" value={form.project_start_date ?? ""}
                      onChange={e => set("project_start_date", e.target.value || null)}
                      className={inputCls + " [color-scheme:dark]"} />
                  </Field>
                  <Field label="End Date">
                    <input type="date" value={form.project_end_date ?? ""}
                      onChange={e => set("project_end_date", e.target.value || null)}
                      className={inputCls + " [color-scheme:dark]"} />
                  </Field>
                  <Field label="Location">
                    <input value={form.project_location ?? ""}
                      onChange={e => set("project_location", e.target.value || null)}
                      placeholder="e.g. Westlands, Nairobi" className={inputCls} />
                  </Field>
                  <Field label="Client Reference">
                    <input value={form.project_client_ref ?? ""}
                      onChange={e => set("project_client_ref", e.target.value || null)}
                      placeholder="e.g. PO-2026-009" className={inputCls} />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Line Items ── */}
          {tab === "items" && (
            <div className="space-y-6">
              <LineItemsSection title="Labor" items={form.labor_items} type="labor"
                onChange={items => set("labor_items", items)} />
              <LineItemsSection title="Material" items={form.material_items} type="material"
                onChange={items => set("material_items", items)} />
              <LineItemsSection title="Other" items={form.other_items} type="other"
                onChange={items => set("other_items", items)} />

              {/* Totals preview */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">Totals Preview</p>
                {[
                  { label: "Subtotal",              val: fmtKES(subtotal),              color: "text-foreground" },
                  { label: "Discount",              val: fmtKES(Number(form.discount_amount)), color: "text-rose-400" },
                  { label: "Subtotal less Discount",val: fmtKES(subtotalLessDiscount),  color: "text-foreground" },
                  { label: `Tax (${form.tax_rate}%)`, val: fmtKES(totalTax),            color: "text-amber-400" },
                ].map(r => (
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className={`font-mono tabular-nums ${r.color}`}>{r.val}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
                  <span className="text-foreground">Total</span>
                  <span className="font-mono tabular-nums text-primary text-base">{fmtKES(total)}</span>
                </div>

                {/* Discount + Tax inputs inline */}
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/10">
                  <Field label="Discount (KES)">
                    <NumericInput value={Number(form.discount_amount)} onChange={v => set("discount_amount", v)} placeholder="0.00" />
                  </Field>
                  <Field label="Tax Rate (%)">
                    <NumericInput value={Number(form.tax_rate)} onChange={v => set("tax_rate", v)} step="0.01" max="100" placeholder="5" />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Payment ── */}
          {tab === "payment" && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Payment Terms" span2>
                <input value={form.payment_terms ?? ""}
                  onChange={e => set("payment_terms", e.target.value || null)}
                  placeholder="e.g. Net 30, On receipt" className={inputCls} />
              </Field>
              <Field label="Bank Name">
                <input value={form.bank_name ?? ""}
                  onChange={e => set("bank_name", e.target.value || null)}
                  placeholder="e.g. KCB Bank" className={inputCls} />
              </Field>
              <Field label="Account Number">
                <input value={form.account_number ?? ""}
                  onChange={e => set("account_number", e.target.value || null)}
                  placeholder="e.g. 1234567890" className={inputCls} />
              </Field>
              <Field label="Notes" span2>
                <textarea value={form.notes ?? ""} rows={4}
                  onChange={e => set("notes", e.target.value || null)}
                  placeholder="Thank you for your business!"
                  className={inputCls + " resize-none"} />
              </Field>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          <div className="flex gap-1">
            {tabs.map(t => (
              <span key={t.key}
                className={`w-1.5 h-1.5 rounded-full transition-all ${tab === t.key ? "bg-primary" : "bg-white/20"}`} />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-white/5">
              Cancel
            </button>
            <button
              onClick={() => onSave(form)}
              disabled={loading || !form.invoice_number.trim() || !form.company_name.trim() || !form.client_company_name.trim() || !form.invoice_date || !form.due_date}
              className="px-5 py-2 text-sm font-medium rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {isEdit ? "Save Changes" : "Create Invoice"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── DELETE CONFIRM ───────────────────────────────────────────────────────────
function DeleteConfirm({ invoice, onConfirm, onClose, loading }: {
  invoice: Invoice; onConfirm: () => void; onClose: () => void; loading: boolean;
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
            <h3 className="font-semibold text-foreground mb-1">Delete Invoice</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Permanently delete invoice{" "}
              <span className="text-foreground font-medium">{invoice.invoice_number}</span>{" "}
              for <span className="font-mono text-primary text-xs">{invoice.client_company_name}</span>?{" "}
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
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── PROJECT CARD ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onSelect, invoiceCount }: {
  project: Project; onSelect: (p: Project) => void; invoiceCount: number;
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
        {invoiceCount > 0 && (
          <span className="text-[10px] text-muted-foreground bg-white/5 border border-white/10 px-2 py-0.5 rounded-full shrink-0 tabular-nums">
            {invoiceCount} {invoiceCount === 1 ? "invoice" : "invoices"}
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
            {fmtKES(project.budget_numeric)}
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
        <span>Open Invoices</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </div>
    </motion.button>
  );
}

// ─── STAT CARDS ───────────────────────────────────────────────────────────────
function StatCards({ invoices }: { invoices: Invoice[] }) {
  const total        = invoices.reduce((a, i) => a + Number(i.total), 0);
  const paid         = invoices.filter(i => i.status === "paid").reduce((a, i) => a + Number(i.total), 0);
  const outstanding  = invoices.filter(i => !["paid", "cancelled"].includes(i.status)).reduce((a, i) => a + Number(i.total), 0);
  const overdueCount = invoices.filter(i => i.status === "overdue").length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.08 }}
      className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {[
        { label: "Total Invoiced",  value: fmtKES(total),       color: "text-foreground",  sub: `${invoices.length} invoices` },
        { label: "Paid",            value: fmtKES(paid),        color: "text-emerald-400", sub: `${invoices.filter(i => i.status === "paid").length} settled` },
        { label: "Outstanding",     value: fmtKES(outstanding), color: outstanding > 0 ? "text-rose-400" : "text-emerald-400", sub: "unpaid balance" },
        { label: "Overdue",         value: String(overdueCount), color: overdueCount > 0 ? "text-rose-400" : "text-muted-foreground", sub: "invoices overdue" },
      ].map(c => (
        <div key={c.label} className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
          <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 text-muted-foreground">{c.label}</div>
          <div className={`text-lg font-bold tabular-nums font-mono ${c.color}`}>{c.value}</div>
          <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
        </div>
      ))}
    </motion.div>
  );
}

// ─── STATUS PILLS ─────────────────────────────────────────────────────────────
function StatusPills({ invoices, filterStatus, setFilterStatus }: {
  invoices: Invoice[];
  filterStatus: InvoiceStatus | "All";
  setFilterStatus: (s: InvoiceStatus | "All") => void;
}) {
  const counts = useMemo(() => {
    const c: Partial<Record<InvoiceStatus, number>> = {};
    invoices.forEach(i => { c[i.status] = (c[i.status] ?? 0) + 1; });
    return c;
  }, [invoices]);
  if (!invoices.length) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12 }}
      className="flex flex-wrap gap-2 mb-8">
      {INVOICE_STATUSES.filter(s => counts[s]).map(s => {
        const ss = STATUS_STYLE[s];
        const isActive = filterStatus === s;
        return (
          <button key={s}
            onClick={() => setFilterStatus(isActive ? "All" : s)}
            className={`rounded-2xl border px-4 py-3 text-left transition-all duration-200 backdrop-blur-sm bg-white/5 min-w-[7rem] ${
              isActive ? "border-white/20 ring-1 ring-white/20 scale-[1.02]" : "border-white/10 hover:border-white/20 hover:scale-[1.01]"
            }`}>
            <div className="text-[10px] uppercase tracking-widest font-semibold mb-1.5">{STATUS_LABEL[s]}</div>
            <div className="text-lg font-bold tabular-nums text-foreground">{counts[s]}</div>
            <Badge className={`text-[9px] px-1.5 py-0 border rounded-full mt-1 ${ss.badge}`}>
              {fmtKES(invoices.filter(i => i.status === s).reduce((a, i) => a + Number(i.total), 0))}
            </Badge>
          </button>
        );
      })}
    </motion.div>
  );
}

// ─── INVOICE TABLE ────────────────────────────────────────────────────────────
function InvoiceTable({
  invoices, filtered, canEdit, fetching,
  search, filterStatus, setSearch, setFilterStatus,
  onEdit, onDelete, onCreate,
  showProjectCol = false,
  projects = [],
  emptyLabel = "No invoices found.",
}: {
  invoices: Invoice[];
  filtered: Invoice[];
  canEdit: boolean; fetching: boolean;
  search: string; filterStatus: InvoiceStatus | "All";
  setSearch: (v: string) => void;
  setFilterStatus: (v: InvoiceStatus | "All") => void;
  onEdit: (i: Invoice) => void;
  onDelete: (i: Invoice) => void;
  onCreate: () => void;
  showProjectCol?: boolean;
  projects?: Project[];
  emptyLabel?: string;
}) {
  const projectLabel = (pid: string | null) => {
    if (!pid) return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide text-violet-300 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded">
        Standalone
      </span>
    );
    const p = projects.find(pr => pr.id === pid);
    return p
      ? <span className="font-mono text-[11px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">{p.project_number}</span>
      : <span className="italic text-muted-foreground/60 text-xs">Unknown</span>;
  };

  const headers = [
    "Invoice #", "Client", "Invoice Date", "Due Date",
    "Subtotal", "Discount", "Tax", "Total",
    "Status", "Payment Terms",
    ...(showProjectCol ? ["Scope"] : []),
    ...(canEdit ? ["Actions"] : []),
  ];

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mt-5 px-6 pb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by invoice #, client, payment terms…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all" />
        </div>
        <div className="relative" style={{ minWidth: "9rem" }}>
          <select value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as InvoiceStatus | "All")}
            className={selectCls}>
            <option value="All">All Statuses</option>
            {INVOICE_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <SelectChevron />
        </div>
        <div className="flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/8 rounded-xl bg-white/3 whitespace-nowrap tabular-nums">
          {filtered.length} / {invoices.length} shown
        </div>
      </div>

      <CardContent className="p-0">
        {fetching ? (
          <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground text-sm">
            <span className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <p className="text-sm">{emptyLabel}</p>
            {(search || filterStatus !== "All") && (
              <button onClick={() => { setSearch(""); setFilterStatus("All"); }}
                className="text-xs text-primary hover:underline">Clear filters</button>
            )}
            {canEdit && !search && filterStatus === "All" && (
              <button onClick={onCreate} className="text-xs text-primary hover:underline">Create first invoice</button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-white/6" style={{ background: "rgba(255,255,255,0.03)" }}>
                    {headers.map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv, ri) => {
                    const ss = STATUS_STYLE[inv.status];
                    return (
                      <motion.tr key={inv.id}
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: ri * 0.02, duration: 0.16 }}
                        className={`border-b border-white/5 transition-colors ${ss.row}`}>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-mono text-xs font-semibold text-primary">{inv.invoice_number}</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-medium text-foreground text-xs">{inv.client_company_name}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground font-mono">{fmtDate(inv.invoice_date)}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-mono">
                          <span className={inv.status === "overdue" ? "text-rose-400 font-semibold" : "text-muted-foreground"}>
                            {fmtDate(inv.due_date)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-foreground">{fmtKES(Number(inv.subtotal))}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-rose-400/80">
                          {Number(inv.discount_amount) > 0 ? fmtKES(Number(inv.discount_amount)) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs text-amber-400">{fmtKES(Number(inv.total_tax))}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs font-bold text-primary">{fmtKES(Number(inv.total))}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Badge className={`text-[10px] px-2 py-0.5 border rounded-full font-semibold ${ss.badge}`}>
                            {STATUS_LABEL[inv.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{inv.payment_terms || "—"}</td>
                        {showProjectCol && (
                          <td className="px-4 py-3.5 whitespace-nowrap">{projectLabel(inv.project_id)}</td>
                        )}
                        {canEdit && (
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => onEdit(inv)} title="Edit"
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                              <button onClick={() => onDelete(inv)} title="Delete"
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6l-1 14H6L5 6"/>
                                  <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        )}
                      </motion.tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Subtotal ({filtered.length})
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-foreground">
                      {fmtKES(filtered.reduce((a, i) => a + Number(i.subtotal), 0))}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-rose-400/80">
                      {fmtKES(filtered.reduce((a, i) => a + Number(i.discount_amount), 0))}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-amber-400">
                      {fmtKES(filtered.reduce((a, i) => a + Number(i.total_tax), 0))}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-primary">
                      {fmtKES(filtered.reduce((a, i) => a + Number(i.total), 0))}
                    </td>
                    <td colSpan={showProjectCol ? (canEdit ? 4 : 3) : (canEdit ? 3 : 2)} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Grand total bar */}
            <div className="px-6 py-4 flex flex-wrap items-center gap-5 text-xs font-mono bg-primary/5 border-t border-primary/10">
              <span className="text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wider">Grand Total</span>
              <span className="text-foreground">Invoiced {fmtKES(invoices.reduce((a, i) => a + Number(i.total), 0))}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-emerald-400">Paid {fmtKES(invoices.filter(i => i.status === "paid").reduce((a, i) => a + Number(i.total), 0))}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-rose-400">Outstanding {fmtKES(invoices.filter(i => !["paid","cancelled"].includes(i.status)).reduce((a, i) => a + Number(i.total), 0))}</span>
              <Badge className="ml-auto bg-primary/10 border-primary/20 text-primary">
                {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </>
  );
}

// ─── CRUD HOOK ────────────────────────────────────────────────────────────────
function useInvoiceCrud(push: (msg: string, type?: "success" | "error") => void) {
  const [saving, setSaving] = useState(false);

  const handleCreate = useCallback(async (
    form: InvoiceFormData,
    onSuccess: (inv: Invoice) => void,
    onDone: () => void,
  ) => {
    setSaving(true);
    try {
      const inv = await api.create(form);
      onSuccess(inv);
      push("Invoice created.");
      onDone();
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to create invoice.", "error");
    } finally { setSaving(false); }
  }, [push]);

  const handleUpdate = useCallback(async (
    id: string,
    form: InvoiceFormData,
    onSuccess: (inv: Invoice) => void,
    onDone: () => void,
  ) => {
    setSaving(true);
    try {
      const inv = await api.update(id, form);
      onSuccess(inv);
      push("Invoice updated.");
      onDone();
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to update invoice.", "error");
    } finally { setSaving(false); }
  }, [push]);

  const handleDelete = useCallback(async (
    id: string,
    onSuccess: () => void,
    onDone: () => void,
  ) => {
    setSaving(true);
    try {
      await api.remove(id);
      onSuccess();
      push("Invoice deleted.");
      onDone();
    } catch (err: unknown) {
      push(err instanceof Error ? err.message : "Failed to delete invoice.", "error");
    } finally { setSaving(false); }
  }, [push]);

  return { saving, handleCreate, handleUpdate, handleDelete };
}

// ─── PER-PROJECT INVOICE VIEW ─────────────────────────────────────────────────
function ProjectInvoiceView({ project, canEdit, onBack }: {
  project: Project; canEdit: boolean; onBack: () => void;
}) {
  const [invoices,     setInvoices]     = useState<Invoice[]>([]);
  const [fetching,     setFetching]     = useState(false);
  const [modal,        setModal]        = useState<null | "create" | "edit">(null);
  const [editing,      setEditing]      = useState<Invoice | null>(null);
  const [deleting,     setDeleting]     = useState<Invoice | null>(null);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | "All">("All");
  const { toasts, push }               = useToast();
  const { saving, handleCreate, handleUpdate, handleDelete } = useInvoiceCrud(push);

  const fetchInvoices = useCallback(async () => {
    setFetching(true);
    setInvoices([]);
    try { setInvoices(await api.list(project.id)); }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed to load.", "error"); }
    finally { setFetching(false); }
  }, [project.id, push]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const filtered = useMemo(() =>
    invoices.filter(i => {
      if (filterStatus !== "All" && i.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return i.invoice_number.toLowerCase().includes(q) ||
          i.client_company_name.toLowerCase().includes(q) ||
          (i.payment_terms ?? "").toLowerCase().includes(q);
      }
      return true;
    }),
  [invoices, filterStatus, search]);

  const status    = project.status ?? "planning";
  const statusCls = PROJECT_STATUS_STYLE[status] ?? PROJECT_STATUS_STYLE.planning;

  // Strip computed fields for edit
  const toForm = (inv: Invoice): InvoiceFormData & { id: string } => {
    const { id, subtotal: _s, total_tax: _tt, total: _t, created_at: _ca, updated_at: _ua, ...rest } = inv;
    return { ...rest, id } as InvoiceFormData & { id: string };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <ToastStack toasts={toasts} />

      <AnimatePresence>
        {modal === "create" && (
          <InvoiceModal
            initial={makeEmpty(project.id)}
            onSave={form => handleCreate(
              { ...form, project_id: project.id },
              inv => setInvoices(p => [inv, ...p]),
              () => setModal(null),
            )}
            onClose={() => setModal(null)}
            loading={saving}
            showProjectSelector={false}
          />
        )}
        {modal === "edit" && editing && (
          <InvoiceModal
            initial={toForm(editing)}
            onSave={form => handleUpdate(
              editing.id, form,
              inv => setInvoices(p => p.map(i => i.id === editing.id ? inv : i)),
              () => { setModal(null); setEditing(null); },
            )}
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
            showProjectSelector={false}
          />
        )}
        {deleting && (
          <DeleteConfirm
            invoice={deleting}
            onConfirm={() => handleDelete(
              deleting.id,
              () => setInvoices(p => p.filter(i => i.id !== deleting.id)),
              () => setDeleting(null),
            )}
            onClose={() => setDeleting(null)}
            loading={saving}
          />
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-10">
          <button onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            All Projects
          </button>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">Invoicing</p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
                  {project.project_number}
                </span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusCls}`}>
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

        <StatCards invoices={invoices} />
        <StatusPills invoices={invoices} filterStatus={filterStatus} setFilterStatus={setFilterStatus} />

        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
          <CardHeader className="pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-3xl font-bold">Invoice Register</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">All invoices linked to this project.</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={fetchInvoices}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-white/10 rounded-xl hover:bg-white/5 transition-all">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  Refresh
                </button>
                {canEdit && (
                  <button onClick={() => setModal("create")}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg"
                    style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    New Invoice
                  </button>
                )}
              </div>
            </div>
          </CardHeader>

          <InvoiceTable
            invoices={invoices} filtered={filtered}
            canEdit={canEdit} fetching={fetching}
            search={search} filterStatus={filterStatus}
            setSearch={setSearch} setFilterStatus={setFilterStatus}
            onEdit={inv => { setEditing(inv); setModal("edit"); }}
            onDelete={setDeleting}
            onCreate={() => setModal("create")}
            showProjectCol={false}
          />

          {!fetching && invoices.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
              <span className="tabular-nums">{invoices.length} total invoice{invoices.length !== 1 ? "s" : ""}</span>
              <button onClick={fetchInvoices} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Refresh
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── GLOBAL INVOICE VIEW ──────────────────────────────────────────────────────
type GlobalTab = "consolidated" | "standalone";

function GlobalInvoiceView({ canEdit, projects }: { canEdit: boolean; projects: Project[] }) {
  const [allInvoices,  setAllInvoices]  = useState<Invoice[]>([]);
  const [fetching,     setFetching]     = useState(false);
  const [modal,        setModal]        = useState<null | "create" | "edit">(null);
  const [editing,      setEditing]      = useState<Invoice | null>(null);
  const [deleting,     setDeleting]     = useState<Invoice | null>(null);
  const [activeTab,    setActiveTab]    = useState<GlobalTab>("consolidated");
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | "All">("All");
  const { toasts, push }               = useToast();
  const { saving, handleCreate, handleUpdate, handleDelete } = useInvoiceCrud(push);

  const fetchAll = useCallback(async () => {
    setFetching(true);
    setAllInvoices([]);
    try { setAllInvoices(await api.listAll()); }
    catch (err: unknown) { push(err instanceof Error ? err.message : "Failed to load.", "error"); }
    finally { setFetching(false); }
  }, [push]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const displayInvoices = useMemo(
    () => activeTab === "standalone" ? allInvoices.filter(i => i.project_id === null) : allInvoices,
    [allInvoices, activeTab]
  );

  const filtered = useMemo(() =>
    displayInvoices.filter(i => {
      if (filterStatus !== "All" && i.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return i.invoice_number.toLowerCase().includes(q) ||
          i.client_company_name.toLowerCase().includes(q) ||
          (i.payment_terms ?? "").toLowerCase().includes(q);
      }
      return true;
    }),
  [displayInvoices, filterStatus, search]);

  const standaloneCount   = allInvoices.filter(i => i.project_id === null).length;
  const consolidatedCount = allInvoices.length;

  const tabs = [
    { key: "consolidated" as GlobalTab, label: "Consolidated",    count: consolidatedCount, description: "All invoices across every project plus standalone firm-wide invoices" },
    { key: "standalone"   as GlobalTab, label: "Standalone Only", count: standaloneCount,   description: "Invoices not linked to any specific project" },
  ];

  const toForm = (inv: Invoice): InvoiceFormData & { id: string } => {
    const { id, subtotal: _s, total_tax: _tt, total: _t, created_at: _ca, updated_at: _ua, ...rest } = inv;
    return { ...rest, id } as InvoiceFormData & { id: string };
  };

  return (
    <div className="container mx-auto px-4 pb-20">
      <ToastStack toasts={toasts} />

      <AnimatePresence>
        {modal === "create" && (
          <InvoiceModal
            initial={makeEmpty(null)}
            onSave={form => handleCreate(
              { ...form, project_id: form.project_id || null },
              inv => setAllInvoices(p => [inv, ...p]),
              () => setModal(null),
            )}
            onClose={() => setModal(null)}
            loading={saving}
            projects={projects}
            showProjectSelector={true}
          />
        )}
        {modal === "edit" && editing && (
          <InvoiceModal
            initial={toForm(editing)}
            onSave={form => handleUpdate(
              editing.id, form,
              inv => setAllInvoices(p => p.map(i => i.id === editing.id ? inv : i)),
              () => { setModal(null); setEditing(null); },
            )}
            onClose={() => { setModal(null); setEditing(null); }}
            loading={saving}
            projects={projects}
            showProjectSelector={true}
          />
        )}
        {deleting && (
          <DeleteConfirm
            invoice={deleting}
            onConfirm={() => handleDelete(
              deleting.id,
              () => setAllInvoices(p => p.filter(i => i.id !== deleting.id)),
              () => setDeleting(null),
            )}
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
          Global{" "}
          <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Invoice Register
          </span>
        </h2>
        <p className="text-center text-sm text-muted-foreground max-w-xl mx-auto">
          Consolidated view of all invoices across every project and standalone firm-wide records.
          Project linking is optional — leave blank for a firm-level invoice.
        </p>
      </motion.div>

      <StatCards invoices={displayInvoices} />
      <StatusPills invoices={displayInvoices} filterStatus={filterStatus} setFilterStatus={setFilterStatus} />

      <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg">
        <CardHeader className="pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-3xl font-bold">All Invoices</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">The consolidated view is the authoritative firm-wide invoice register.</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={fetchAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-white/10 rounded-xl hover:bg-white/5 transition-all">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Refresh
              </button>
              {canEdit && (
                <button onClick={() => setModal("create")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-lg shrink-0"
                  style={{ background: "linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))" }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  New Invoice
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium tracking-normal transition-all ${
                  activeTab === tab.key
                    ? "bg-white/10 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                {tab.label}
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full tabular-nums ${
                  activeTab === tab.key ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2 mb-1">
            {tabs.find(t => t.key === activeTab)?.description}
          </p>
        </CardHeader>

        <InvoiceTable
          invoices={displayInvoices} filtered={filtered}
          canEdit={canEdit} fetching={fetching}
          search={search} filterStatus={filterStatus}
          setSearch={setSearch} setFilterStatus={setFilterStatus}
          onEdit={inv => { setEditing(inv); setModal("edit"); }}
          onDelete={setDeleting}
          onCreate={() => setModal("create")}
          showProjectCol={activeTab === "consolidated"}
          projects={projects}
          emptyLabel={
            activeTab === "standalone"
              ? "No standalone invoices yet. Create an invoice without linking a project."
              : "No invoices created yet."
          }
        />

        {!fetching && allInvoices.length > 0 && (
          <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="tabular-nums">{allInvoices.length} total invoices</span>
              {standaloneCount > 0 && <span className="tabular-nums text-violet-400/70">{standaloneCount} standalone</span>}
              <span className="tabular-nums text-primary/70">{allInvoices.length - standaloneCount} project-linked</span>
            </div>
            <button onClick={fetchAll} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── PROJECT PICKER VIEW ──────────────────────────────────────────────────────
function ProjectPickerView({ onSelect }: { onSelect: (p: Project) => void }) {
  const [projects,       setProjects]       = useState<Project[]>([]);
  const [fetching,       setFetching]       = useState(true);
  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [invoiceCounts,  setInvoiceCounts]  = useState<Record<string, number>>({});
  const [standaloneCount,setStandaloneCount]= useState(0);
  const { toasts, push } = useToast();

  useEffect(() => {
    setFetching(true);
    api.projects()
      .then(async data => {
        setProjects(data);
        if (data.length > 0) {
          const ids = data.map(p => p.id);
          const { data: counts } = await supabase
            .from("invoices").select("project_id").in("project_id", ids);
          if (counts) {
            const tally: Record<string, number> = {};
            (counts as { project_id: string }[]).forEach(r => {
              tally[r.project_id] = (tally[r.project_id] ?? 0) + 1;
            });
            setInvoiceCounts(tally);
          }
          const { count } = await supabase
            .from("invoices").select("id", { count: "exact", head: true }).is("project_id", null);
          setStandaloneCount(count ?? 0);
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

  const totalInvoices = Object.values(invoiceCounts).reduce((a, b) => a + b, 0) + standaloneCount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <ToastStack toasts={toasts} />
      <div className="container mx-auto px-4 py-16">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-12 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">Finance Module</p>
          <h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
            Invoice{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Management
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Select a project to manage its invoices, or scroll down for the firm-wide consolidated view.
          </p>
        </motion.div>

        {/* Summary stats */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Projects",          value: projects.length,                   sub: "in system",           color: "" },
            { label: "Projects with Invoices",  value: Object.keys(invoiceCounts).length, sub: "have invoice records", color: "" },
            { label: "Standalone Invoices",     value: standaloneCount,                   sub: "not project-linked",   color: "text-violet-400" },
            { label: "Total Invoices",          value: totalInvoices,                     sub: "across all projects",  color: "" },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border border-white/10 p-4 backdrop-blur-sm bg-white/5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{card.label}</div>
              <div className={`text-3xl font-bold tabular-nums ${card.color || "text-foreground"}`}>{card.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{card.sub}</div>
            </div>
          ))}
        </motion.div>

        {/* Projects card */}
        <Card className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-lg mb-16">
          <CardHeader className="pb-4">
            <CardTitle className="text-3xl font-bold">Projects</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <div className="relative flex-1">
                <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, number or city…"
                  className={inputCls + " pl-9"} />
              </div>
              <div className="relative w-full sm:w-52">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
                  {statuses.map(s => (
                    <option key={s} value={s}>
                      {s === "all" ? "All Statuses" : s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>
              <div className="inline-flex items-center px-4 py-2.5 text-xs text-muted-foreground border border-white/10 rounded-xl bg-white/5 whitespace-nowrap tabular-nums">
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
                <p className="text-sm">No projects found.</p>
                {search && (
                  <button onClick={() => { setSearch(""); setStatusFilter("all"); }}
                    className="text-xs text-primary hover:underline">Clear filters</button>
                )}
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(p => (
                  <ProjectCard key={p.id} project={p} onSelect={onSelect} invoiceCount={invoiceCounts[p.id] ?? 0} />
                ))}
              </div>
            )}
            {!fetching && projects.length > 0 && (
              <div className="flex flex-wrap gap-6 items-center justify-between px-6 py-4 border-t border-white/10 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {projects.length} total projects · {Object.keys(invoiceCounts).length} with invoices
                  {standaloneCount > 0 && ` · ${standaloneCount} standalone invoices`}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Global invoice section */}
        {!fetching && <GlobalInvoiceView canEdit={true} projects={projects} />}
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function InvoicePage({ projectId, canEdit = true }: Props) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("projects")
      .select("id,project_number,title,description,status,progress_percent,budget_numeric,site_city,site_country,expected_completion_date,created_at")
      .eq("id", projectId)
      .single()
      .then(({ data }) => { if (data) setSelectedProject(data as Project); });
  }, [projectId]);

  return (
    <AnimatePresence mode="wait">
      {selectedProject ? (
        <motion.div key={selectedProject.id}
          initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
          <ProjectInvoiceView
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