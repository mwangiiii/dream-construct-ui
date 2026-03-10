// src/pages/InvoiceViewPage.tsx
// Route: /invoices/:id
// Read-only, client-facing invoice view — mirrors the printInvoice() HTML output
// in React, using the system's dark glass-morphism design language.
// NO management controls. Pure invoice display.

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  AlertTriangle,
  Printer,
  Building2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  Hash,
  Tag,
  Hammer,
  Package,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Wallet,
  CheckCircle,
  FileText,
  Layers,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LineItem {
  id?: string;
  description?: string;
  hours?: number | string | null;
  qty?: number | string | null;
  unit_price?: number | string | null;
  amount?: number | string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  company_name: string;
  company_address: string | null;
  company_city_state_zip: string | null;
  company_phone: string | null;
  company_email: string | null;
  client_company_name: string;
  client_contact_name: string | null;
  client_address: string | null;
  client_phone: string | null;
  client_email: string | null;
  project_start_date: string | null;
  project_end_date: string | null;
  project_location: string | null;
  project_client_ref: string | null;
  invoice_date: string;
  due_date: string;
  labor_items: LineItem[];
  material_items: LineItem[];
  other_items: LineItem[];
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  total_tax: number;
  total: number;
  payment_terms: string | null;
  bank_name: string | null;
  account_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  project_id: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtKES = (n: number | string | null | undefined): string => {
  const num = Number(n) || 0;
  return `KES ${new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2 }).format(num)}`;
};

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const safeNum = (v: unknown): number => {
  const n = Number(v);
  return isFinite(n) && !isNaN(n) ? n : 0;
};

// ─── Design Tokens ────────────────────────────────────────────────────────────
const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 transition-all duration-300 ${className}`}
  >
    {children}
  </div>
);

// ─── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; dot: string }> = {
  draft:     { label: 'Draft',     bg: 'bg-slate-500/20',  border: 'border-slate-500/40',  text: 'text-slate-300',  dot: 'bg-slate-400' },
  sent:      { label: 'Sent',      bg: 'bg-sky-500/20',    border: 'border-sky-500/40',    text: 'text-sky-300',    dot: 'bg-sky-400' },
  paid:      { label: 'Paid',      bg: 'bg-emerald-500/20',border: 'border-emerald-500/40',text: 'text-emerald-300',dot: 'bg-emerald-400' },
  partial:   { label: 'Partial',   bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-300', dot: 'bg-yellow-400' },
  overdue:   { label: 'Overdue',   bg: 'bg-rose-500/20',   border: 'border-rose-500/40',   text: 'text-rose-300',   dot: 'bg-rose-400' },
  cancelled: { label: 'Cancelled', bg: 'bg-zinc-500/20',   border: 'border-zinc-500/40',   text: 'text-zinc-400',   dot: 'bg-zinc-400' },
};

// ─── Collapsible Line Items Section ────────────────────────────────────────────
const LineSection = ({
  items,
  isLabor,
  label,
  icon: Icon,
  color,
}: {
  items: LineItem[];
  isLabor: boolean;
  label: string;
  icon: React.ElementType;
  color: string;
}) => {
  const [open, setOpen] = useState(true);
  const filtered = items.filter(i => String(i.description ?? '').trim() || safeNum(i.amount) > 0);
  if (filtered.length === 0) return null;

  const sectionTotal = filtered.reduce((s, i) => s + safeNum(i.amount), 0);

  return (
    <div className="rounded-xl border border-white/12 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-white/5 hover:bg-white/8 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${color}`}>{label}</span>
          <span className="text-[10px] text-muted-foreground">({filtered.length} item{filtered.length !== 1 ? 's' : ''})</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono text-xs font-bold tabular-nums ${color}`}>{fmtKES(sectionTotal)}</span>
          {open
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          }
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Description</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-20">{isLabor ? 'Hrs' : 'Qty'}</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-32">Unit Price</th>
                    <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-32">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => (
                    <tr key={idx} className="border-b border-white/6 last:border-b-0 hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-3 text-foreground font-medium">{item.description || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground text-xs">
                        {safeNum(isLabor ? item.hours : item.qty)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground text-xs">{fmtKES(item.unit_price)}</td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-foreground text-xs">{fmtKES(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const InvoiceViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) { setError('No invoice ID provided.'); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single();
      if (err || !data) {
        setError(err?.message || 'Invoice not found.');
      } else {
        setInvoice(data as Invoice);
      }
      setLoading(false);
    })();
  }, [id]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-background to-slate-900">
        <GlassCard className="text-center py-16 px-20">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="w-14 h-14 border-4 border-primary/25 border-t-primary rounded-full animate-spin mx-auto mb-5" />
            <p className="text-base font-semibold text-foreground">Loading invoice…</p>
            <p className="text-sm text-muted-foreground mt-1.5">Just a moment</p>
          </motion.div>
        </GlassCard>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-background to-slate-900">
        <GlassCard className="text-center py-14 px-12 max-w-sm">
          <AlertTriangle className="w-14 h-14 text-rose-400 mx-auto mb-5" />
          <h3 className="text-xl font-bold mb-3 text-rose-300">Invoice Not Found</h3>
          <p className="text-sm text-muted-foreground mb-7 leading-relaxed">
            {error || 'This invoice does not exist or you do not have permission to view it.'}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-accent text-background rounded-xl font-semibold text-sm transition-all hover:opacity-90"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </GlassCard>
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const statusCfg          = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.draft;
  const hasDiscount        = safeNum(invoice.discount_amount) > 0;
  const hasTax             = safeNum(invoice.total_tax) > 0;
  const isOverdue          = invoice.status === 'overdue';
  const subtotalVal        = safeNum(invoice.subtotal);
  const discountVal        = safeNum(invoice.discount_amount);
  const subtotalLessDisc   = subtotalVal - discountVal;

  const laborItems    = Array.isArray(invoice.labor_items)    ? invoice.labor_items    : [];
  const materialItems = Array.isArray(invoice.material_items) ? invoice.material_items : [];
  const otherItems    = Array.isArray(invoice.other_items)    ? invoice.other_items    : [];
  const hasLineItems  = [...laborItems, ...materialItems, ...otherItems].some(
    i => String(i.description ?? '').trim() || safeNum(i.amount) > 0
  );

  const hasProjectInfo = invoice.project_location || invoice.project_client_ref || invoice.project_start_date || invoice.project_end_date;
  const hasPaymentInfo = invoice.payment_terms || invoice.bank_name || invoice.account_number;

  const enter = (delay: number) => ({
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay },
  });

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-7">

        {/* ── Top Bar ── */}
        <motion.div {...enter(0)} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Invoice</h1>
                <span className="font-mono text-primary text-base sm:text-lg font-semibold">{invoice.invoice_number}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Issued {fmtDate(invoice.invoice_date)} · Due {fmtDate(invoice.due_date)}
              </p>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-medium transition-all print:hidden"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
        </motion.div>

        {/* ── Header Band ── mirrors printInvoice() dark #0f172a band ── */}
        <motion.div {...enter(0.04)}>
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0f172a' }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 px-7 py-7">
              {/* Company */}
              <div>
                <p className="text-xl font-extrabold tracking-tight text-white mb-2">
                  {invoice.company_name || 'Your Company'}
                </p>
                <div className="text-sm text-slate-400 leading-relaxed space-y-0.5">
                  {invoice.company_address && <p>{invoice.company_address}</p>}
                  {invoice.company_city_state_zip && <p>{invoice.company_city_state_zip}</p>}
                  {invoice.company_phone && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Phone className="w-3 h-3 text-slate-500" />
                      <span>{invoice.company_phone}</span>
                    </div>
                  )}
                  {invoice.company_email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-slate-500" />
                      <span>{invoice.company_email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice meta */}
              <div className="text-left sm:text-right shrink-0">
                <p className="text-4xl font-black uppercase tracking-tighter text-white mb-2">Invoice</p>
                <div className="font-mono text-sm bg-purple-500/20 border border-purple-500/40 text-purple-300 px-3 py-1 rounded-lg mb-3 inline-block">
                  {invoice.invoice_number}
                </div>
                <br />
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border ${statusCfg.bg} ${statusCfg.border} ${statusCfg.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${statusCfg.dot}`} />
                  {statusCfg.label}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Overdue Banner ── */}
        <AnimatePresence>
          {isOverdue && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-sm font-semibold text-rose-300">
                Payment overdue — this invoice was due on {fmtDate(invoice.due_date)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Info Row: From + Bill To + Dates ── */}
        <motion.div {...enter(0.08)}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* From */}
            <GlassCard className="!p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">From</p>
              </div>
              <div className="px-5 py-4 space-y-1">
                <p className="font-bold text-foreground">{invoice.company_name}</p>
                {invoice.company_address && <p className="text-sm text-muted-foreground">{invoice.company_address}</p>}
                {invoice.company_city_state_zip && <p className="text-sm text-muted-foreground">{invoice.company_city_state_zip}</p>}
                {invoice.company_phone && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <Phone className="w-3 h-3 text-primary" />
                    <span className="text-xs text-muted-foreground">{invoice.company_phone}</span>
                  </div>
                )}
                {invoice.company_email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-primary" />
                    <span className="text-xs text-muted-foreground">{invoice.company_email}</span>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Bill To */}
            <GlassCard className="!p-0 overflow-hidden border-accent/25">
              <div className="px-5 py-3 border-b border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Bill To</p>
              </div>
              <div className="px-5 py-4 space-y-1">
                <p className="font-bold text-foreground">{invoice.client_company_name}</p>
                {invoice.client_contact_name && <p className="text-sm text-muted-foreground">Attn: {invoice.client_contact_name}</p>}
                {invoice.client_address && <p className="text-sm text-muted-foreground">{invoice.client_address}</p>}
                {invoice.client_phone && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <Phone className="w-3 h-3 text-accent" />
                    <span className="text-xs text-muted-foreground">{invoice.client_phone}</span>
                  </div>
                )}
                {invoice.client_email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-accent" />
                    <span className="text-xs text-muted-foreground">{invoice.client_email}</span>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Dates */}
            <div className="flex flex-col gap-3">
              <GlassCard className="!p-4 flex items-center gap-3 flex-1">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Invoice Date</p>
                  <p className="font-mono font-bold text-sm text-blue-300 mt-0.5">{fmtDate(invoice.invoice_date)}</p>
                </div>
              </GlassCard>

              <GlassCard className={`!p-4 flex items-center gap-3 flex-1 ${isOverdue ? 'border-rose-500/30 bg-rose-500/10' : ''}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isOverdue ? 'bg-rose-500/20 border border-rose-500/30' : 'bg-amber-500/15 border border-amber-500/25'}`}>
                  <Clock className={`w-4 h-4 ${isOverdue ? 'text-rose-400' : 'text-amber-400'}`} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Due Date</p>
                  <p className={`font-mono font-bold text-sm mt-0.5 ${isOverdue ? 'text-rose-300' : 'text-amber-300'}`}>{fmtDate(invoice.due_date)}</p>
                </div>
              </GlassCard>
            </div>
          </div>
        </motion.div>

        {/* ── Project Info ── */}
        {hasProjectInfo && (
          <motion.div {...enter(0.12)}>
            <GlassCard className="!p-5">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-primary" />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Project Information</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 text-sm">
                {invoice.project_location && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Location</p>
                    <p className="font-semibold text-foreground">{invoice.project_location}</p>
                  </div>
                )}
                {invoice.project_client_ref && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Client Ref</p>
                    <p className="font-mono font-semibold text-foreground">{invoice.project_client_ref}</p>
                  </div>
                )}
                {invoice.project_start_date && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Start Date</p>
                    <p className="font-mono font-semibold text-green-400">{fmtDate(invoice.project_start_date)}</p>
                  </div>
                )}
                {invoice.project_end_date && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">End Date</p>
                    <p className="font-mono font-semibold text-purple-400">{fmtDate(invoice.project_end_date)}</p>
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* ── Line Items ── */}
        {hasLineItems && (
          <motion.div {...enter(0.16)}>
            <GlassCard>
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/10">
                <Layers className="w-4 h-4 text-primary" />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Line Items</p>
              </div>
              <div className="space-y-3">
                <LineSection items={laborItems}    isLabor       label="Labor"     icon={Hammer}        color="text-blue-400" />
                <LineSection items={materialItems} isLabor={false} label="Materials" icon={Package}      color="text-purple-400" />
                <LineSection items={otherItems}    isLabor={false} label="Other"     icon={MoreHorizontal} color="text-orange-400" />
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* ── Totals + Payment / Notes ── */}
        <motion.div {...enter(0.2)}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Totals — mirrors printInvoice() totals-table exactly */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/10">
                <FileText className="w-4 h-4 text-primary" />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Invoice Totals</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm py-1">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono font-semibold text-foreground tabular-nums">{fmtKES(subtotalVal)}</span>
                </div>
                {hasDiscount && (
                  <>
                    <div className="flex justify-between items-center text-sm py-1">
                      <span className="text-rose-400">Discount</span>
                      <span className="font-mono font-semibold text-rose-400 tabular-nums">− {fmtKES(discountVal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm py-1">
                      <span className="text-muted-foreground">After Discount</span>
                      <span className="font-mono font-semibold text-foreground tabular-nums">{fmtKES(subtotalLessDisc)}</span>
                    </div>
                  </>
                )}
                {hasTax && (
                  <div className="flex justify-between items-center text-sm py-1">
                    <span className="text-amber-400">VAT / Tax ({invoice.tax_rate}%)</span>
                    <span className="font-mono font-semibold text-amber-400 tabular-nums">{fmtKES(invoice.total_tax)}</span>
                  </div>
                )}

                {/* Grand Total band — same #0f172a as header */}
                <div className="pt-3 mt-1 border-t border-white/15">
                  <div className="flex justify-between items-center px-5 py-4 rounded-xl" style={{ background: '#0f172a' }}>
                    <span className="font-bold text-base text-white">Total Due</span>
                    <span className="font-mono font-black text-2xl text-purple-300 tabular-nums">{fmtKES(invoice.total)}</span>
                  </div>
                </div>

                {invoice.status === 'paid' && (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <p className="text-xs font-semibold text-emerald-300">Payment received — Invoice closed</p>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Payment details + Notes */}
            <div className="space-y-4">
              {hasPaymentInfo && (
                <GlassCard>
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                    <Wallet className="w-4 h-4 text-primary" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Payment Details</p>
                  </div>
                  <div className="space-y-3.5">
                    {invoice.payment_terms && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          <Tag className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">Terms</p>
                          <p className="text-sm font-semibold text-foreground">{invoice.payment_terms}</p>
                        </div>
                      </div>
                    )}
                    {invoice.bank_name && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">Bank</p>
                          <p className="text-sm font-semibold text-foreground">{invoice.bank_name}</p>
                        </div>
                      </div>
                    )}
                    {invoice.account_number && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          <Hash className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">Account Number</p>
                          <p className="text-sm font-bold font-mono text-foreground tracking-widest">{invoice.account_number}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </GlassCard>
              )}

              {invoice.notes && (
                <GlassCard className="border-amber-500/25 bg-amber-500/[0.04]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400 mb-3">Notes</p>
                  <p className="text-sm text-amber-200/80 leading-relaxed whitespace-pre-line">{invoice.notes}</p>
                </GlassCard>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Footer — mirrors printInvoice() footer ── */}
        <motion.div {...enter(0.24)}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-5 border-t border-white/10 text-xs text-muted-foreground print:hidden">
            <p>
              {invoice.company_name}
              {invoice.company_email ? ` · ${invoice.company_email}` : ''}
              {invoice.company_phone ? ` · ${invoice.company_phone}` : ''}
            </p>
            <div className="text-right">
              <span className="font-mono text-primary font-semibold">{invoice.invoice_number}</span>
              <span className="mx-2">·</span>
              <span>Thank you for your business.</span>
            </div>
          </div>
        </motion.div>

      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default InvoiceViewPage;