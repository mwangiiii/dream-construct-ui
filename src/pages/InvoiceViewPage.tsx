// src/pages/InvoiceViewPage.tsx
// Route: /invoices/:id
// Authenticated users can view a specific invoice in full detail.
// Matches the dark glass-morphism theme of the system (see WorkersTab for reference).

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  User,
  Calendar,
  Clock,
  CreditCard,
  FileText,
  CheckCircle,
  AlertTriangle,
  Printer,
  Send,
  Download,
  Copy,
  MapPin,
  Phone,
  Mail,
  Hash,
  Tag,
  TrendingUp,
  Layers,
  Hammer,
  Package,
  MoreHorizontal,
  X,
  Check,
  Wallet,
  ChevronDown,
  ChevronUp,
  Info,
  DollarSign,
  ReceiptText,
  Loader2,
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

// ─── Shared Glass Card (same as WorkersTab) ───────────────────────────────────
const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-4 sm:p-6 hover:bg-white/15 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

// ─── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; dot: string }> = {
  draft:     { label: 'Draft',     bg: 'bg-slate-500/20',  border: 'border-slate-500/50',  text: 'text-slate-300',  dot: 'bg-slate-400' },
  sent:      { label: 'Sent',      bg: 'bg-blue-500/20',   border: 'border-blue-500/50',   text: 'text-blue-300',   dot: 'bg-blue-400' },
  paid:      { label: 'Paid',      bg: 'bg-green-500/20',  border: 'border-green-500/50',  text: 'text-green-300',  dot: 'bg-green-400' },
  partial:   { label: 'Partial',   bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-300', dot: 'bg-yellow-400' },
  overdue:   { label: 'Overdue',   bg: 'bg-red-500/20',    border: 'border-red-500/50',    text: 'text-red-300',    dot: 'bg-red-400' },
  cancelled: { label: 'Cancelled', bg: 'bg-zinc-500/20',   border: 'border-zinc-500/50',   text: 'text-zinc-300',   dot: 'bg-zinc-400' },
};

// ─── Section Badge ─────────────────────────────────────────────────────────────
const SectionBadge = ({ icon: Icon, label, color }: { icon: any; label: string; color: string }) => (
  <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${color} mb-3`}>
    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${color.replace('text-', 'bg-').replace('300', '500/20')}`}>
      <Icon className="w-3.5 h-3.5" />
    </div>
    {label}
  </div>
);

// ─── Line Items Table ──────────────────────────────────────────────────────────
const LineItemsTable = ({
  items,
  isLabor,
  label,
  icon,
  color,
}: {
  items: LineItem[];
  isLabor: boolean;
  label: string;
  icon: any;
  color: string;
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const filtered = items.filter(i => String(i.description ?? '').trim() || safeNum(i.amount) > 0);
  if (filtered.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/15 overflow-hidden"
    >
      {/* Section Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-3 bg-white/5 hover:bg-white/8 transition-all"
      >
        <SectionBadge icon={icon} label={label} color={color} />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-semibold">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
          {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-background/40 border-b border-white/10">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">{isLabor ? 'Hours' : 'Qty'}</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unit Price</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => (
                    <tr key={idx} className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3.5 text-foreground font-medium">{item.description || '—'}</td>
                      <td className="px-5 py-3.5 text-muted-foreground text-right font-mono">
                        {safeNum(isLabor ? item.hours : item.qty)}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-right font-mono">{fmtKES(item.unit_price)}</td>
                      <td className="px-5 py-3.5 text-foreground font-bold text-right font-mono">{fmtKES(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onDismiss }: { message: string; type: 'success' | 'error'; onDismiss: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 80 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 80 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl min-w-72 ${
        type === 'success'
          ? 'bg-green-500/20 border-green-500/50 text-green-200'
          : 'bg-red-500/20 border-red-500/50 text-red-200'
      }`}
    >
      {type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <X className="w-4 h-4 flex-shrink-0" />}
      <p className="text-sm font-medium flex-1">{message}</p>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </motion.div>
  );
};

// ─── Info Row ──────────────────────────────────────────────────────────────────
const InfoRow = ({ icon: Icon, label, value, mono = false }: { icon: any; label: string; value: string | null | undefined; mono?: boolean }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/8 last:border-b-0">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">{label}</p>
        <p className={`text-sm text-foreground font-medium break-words ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
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
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  // ── Fetch invoice ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) { setError('No invoice ID provided.'); setLoading(false); return; }
    const fetchInvoice = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single();
      if (error || !data) {
        setError(error?.message || 'Invoice not found.');
        setLoading(false);
        return;
      }
      setInvoice(data as Invoice);
      setLoading(false);
    };
    fetchInvoice();
  }, [id]);

  // ── Send email ───────────────────────────────────────────────────────────────
  const handleSendEmail = async () => {
    if (!invoice || sending) return;
    if (!invoice.client_email && !invoice.company_email) {
      setToast({ message: 'No email address on this invoice.', type: 'error' });
      return;
    }
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) { setToast({ message: 'Not authenticated.', type: 'error' }); return; }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ action: 'send_email', id: invoice.id }),
      });
      const result = await res.json();
      if (!res.ok) {
        setToast({ message: result.error || 'Failed to send email.', type: 'error' });
      } else {
        setToast({ message: `Invoice sent to ${invoice.client_email || invoice.company_email}`, type: 'success' });
      }
    } catch (e: any) {
      setToast({ message: e.message || 'Network error.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  // ── Copy link ────────────────────────────────────────────────────────────────
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  };

  // ── Print ────────────────────────────────────────────────────────────────────
  const handlePrint = () => window.print();

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GlassCard className="text-center py-16 px-20">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-6" />
            <div className="text-xl font-semibold">Loading invoice...</div>
            <p className="text-sm text-muted-foreground mt-2">Fetching invoice details</p>
          </motion.div>
        </GlassCard>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <GlassCard className="text-center py-16 px-12 max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h3 className="text-2xl font-bold mb-4 text-red-400">Invoice Not Found</h3>
          <p className="text-muted-foreground mb-8">{error || 'This invoice does not exist or you do not have permission to view it.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-background rounded-xl font-semibold mx-auto transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </GlassCard>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.draft;
  const hasDiscount = safeNum(invoice.discount_amount) > 0;
  const hasTax = safeNum(invoice.total_tax) > 0;
  const isOverdue = invoice.status === 'overdue';

  const allItems = [
    ...(Array.isArray(invoice.labor_items) ? invoice.labor_items : []),
    ...(Array.isArray(invoice.material_items) ? invoice.material_items : []),
    ...(Array.isArray(invoice.other_items) ? invoice.other_items : []),
  ];
  const hasLineItems = allItems.some(i => String(i.description ?? '').trim() || safeNum(i.amount) > 0);

  return (
    <>
      <div className="min-h-screen space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">

        {/* ── Top Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Invoice</h1>
                <span className="font-mono text-primary text-lg font-semibold">{invoice.invoice_number}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Created {fmtDate(invoice.created_at)} · Last updated {fmtDate(invoice.updated_at || invoice.created_at)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-medium transition-all"
            >
              {copyDone ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              {copyDone ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-medium transition-all"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSendEmail}
              disabled={sending}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold text-sm transition-all hover:shadow-lg hover:shadow-primary/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending...' : 'Send Email'}
            </motion.button>
          </div>
        </motion.div>

        {/* ── Status Banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border ${statusCfg.bg} ${statusCfg.border}`}
        >
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse ${statusCfg.dot}`} />
          <span className={`font-bold text-sm tracking-wide ${statusCfg.text}`}>
            Status: {statusCfg.label}
          </span>
          {isOverdue && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-red-300 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              Payment overdue since {fmtDate(invoice.due_date)}
            </span>
          )}
        </motion.div>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left Column (2/3) ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Company + Client Header Card */}
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <GlassCard>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Company */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">From</p>
                    <div className="p-4 rounded-xl bg-background/40 border border-white/10 space-y-1">
                      <p className="text-lg font-bold text-foreground">{invoice.company_name}</p>
                      {invoice.company_address && <p className="text-sm text-muted-foreground">{invoice.company_address}</p>}
                      {invoice.company_city_state_zip && <p className="text-sm text-muted-foreground">{invoice.company_city_state_zip}</p>}
                      {invoice.company_phone && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <Phone className="w-3.5 h-3.5 text-primary" />
                          <span className="text-sm">{invoice.company_phone}</span>
                        </div>
                      )}
                      {invoice.company_email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-primary" />
                          <span className="text-sm">{invoice.company_email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Client */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-accent mb-3">Bill To</p>
                    <div className="p-4 rounded-xl bg-background/40 border border-white/10 space-y-1">
                      <p className="text-lg font-bold text-foreground">{invoice.client_company_name}</p>
                      {invoice.client_contact_name && <p className="text-sm text-muted-foreground">Attn: {invoice.client_contact_name}</p>}
                      {invoice.client_address && <p className="text-sm text-muted-foreground">{invoice.client_address}</p>}
                      {invoice.client_phone && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <Phone className="w-3.5 h-3.5 text-accent" />
                          <span className="text-sm">{invoice.client_phone}</span>
                        </div>
                      )}
                      {invoice.client_email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-accent" />
                          <span className="text-sm">{invoice.client_email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* Dates Row */}
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Invoice Date', value: fmtDate(invoice.invoice_date), icon: Calendar, color: 'text-blue-400' },
                  { label: 'Due Date', value: fmtDate(invoice.due_date), icon: Clock, color: isOverdue ? 'text-red-400' : 'text-foreground' },
                  { label: 'Project Start', value: fmtDate(invoice.project_start_date), icon: Calendar, color: 'text-green-400' },
                  { label: 'Project End', value: fmtDate(invoice.project_end_date), icon: Calendar, color: 'text-purple-400' },
                ].map(item => (
                  <GlassCard key={item.label} className="!p-4 text-center">
                    <item.icon className={`w-5 h-5 mx-auto mb-2 ${item.color}`} />
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">{item.label}</p>
                    <p className={`text-sm font-bold font-mono ${item.color}`}>{item.value}</p>
                  </GlassCard>
                ))}
              </div>
            </motion.div>

            {/* Project Info */}
            {(invoice.project_location || invoice.project_client_ref) && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                <GlassCard className="!p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Project Details
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {invoice.project_location && (
                      <div><span className="text-muted-foreground">Location: </span><span className="font-semibold">{invoice.project_location}</span></div>
                    )}
                    {invoice.project_client_ref && (
                      <div><span className="text-muted-foreground">Client Ref: </span><span className="font-semibold font-mono">{invoice.project_client_ref}</span></div>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            )}

            {/* Line Items */}
            {hasLineItems && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <GlassCard>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2 border-b border-primary/20 pb-3">
                    <Layers className="w-4 h-4" />
                    Line Items
                  </p>
                  <div className="space-y-3">
                    <LineItemsTable
                      items={Array.isArray(invoice.labor_items) ? invoice.labor_items : []}
                      isLabor
                      label="Labor"
                      icon={Hammer}
                      color="text-blue-400"
                    />
                    <LineItemsTable
                      items={Array.isArray(invoice.material_items) ? invoice.material_items : []}
                      isLabor={false}
                      label="Materials"
                      icon={Package}
                      color="text-purple-400"
                    />
                    <LineItemsTable
                      items={Array.isArray(invoice.other_items) ? invoice.other_items : []}
                      isLabor={false}
                      label="Other"
                      icon={MoreHorizontal}
                      color="text-orange-400"
                    />
                  </div>
                </GlassCard>
              </motion.div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <GlassCard className="!p-4 border-amber-500/20 bg-amber-500/5">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Notes
                  </p>
                  <p className="text-sm text-amber-200/80 leading-relaxed">{invoice.notes}</p>
                </GlassCard>
              </motion.div>
            )}
          </div>

          {/* ── Right Column (1/3) ── */}
          <div className="space-y-6">

            {/* Totals Card */}
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <GlassCard>
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2 border-b border-primary/20 pb-3">
                  <ReceiptText className="w-4 h-4" />
                  Summary
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono font-semibold text-foreground">{fmtKES(invoice.subtotal)}</span>
                  </div>
                  {hasDiscount && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-red-400">Discount</span>
                      <span className="font-mono font-semibold text-red-400">− {fmtKES(invoice.discount_amount)}</span>
                    </div>
                  )}
                  {hasTax && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-amber-400">VAT/Tax ({invoice.tax_rate}%)</span>
                      <span className="font-mono font-semibold text-amber-400">{fmtKES(invoice.total_tax)}</span>
                    </div>
                  )}
                  <div className="h-px bg-white/15 my-2" />
                  {/* Total */}
                  <div className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-r from-primary/15 to-accent/15 border border-primary/20">
                    <span className="font-bold text-base text-foreground">Total Due</span>
                    <span className="font-mono font-bold text-xl text-primary">{fmtKES(invoice.total)}</span>
                  </div>

                  {/* Payroll-style status pill (bonus if paid) */}
                  {invoice.status === 'paid' && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/30 mt-2">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <p className="text-xs font-semibold text-green-300">Payment received — Invoice closed</p>
                    </div>
                  )}
                </div>
              </GlassCard>
            </motion.div>

            {/* Payment Info */}
            {(invoice.payment_terms || invoice.bank_name || invoice.account_number) && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <GlassCard>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                    <Wallet className="w-4 h-4 text-primary" />
                    Payment Details
                  </p>
                  <InfoRow icon={Tag} label="Payment Terms" value={invoice.payment_terms} />
                  <InfoRow icon={Building2} label="Bank" value={invoice.bank_name} />
                  <InfoRow icon={Hash} label="Account Number" value={invoice.account_number} mono />
                </GlassCard>
              </motion.div>
            )}

            {/* Invoice Meta */}
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <GlassCard>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                  <FileText className="w-4 h-4 text-primary" />
                  Invoice Meta
                </p>
                <InfoRow icon={Hash} label="Invoice Number" value={invoice.invoice_number} mono />
                <InfoRow icon={Calendar} label="Created" value={fmtDate(invoice.created_at)} />
                <InfoRow icon={Clock} label="Last Updated" value={fmtDate(invoice.updated_at || invoice.created_at)} />
                <InfoRow icon={Hash} label="Invoice ID" value={invoice.id} mono />
              </GlassCard>
            </motion.div>

            {/* Quick Stats */}
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: 'Labor Lines',
                    value: (Array.isArray(invoice.labor_items) ? invoice.labor_items : []).filter(i => String(i.description ?? '').trim()).length,
                    icon: Hammer,
                    color: 'text-blue-400',
                  },
                  {
                    label: 'Material Lines',
                    value: (Array.isArray(invoice.material_items) ? invoice.material_items : []).filter(i => String(i.description ?? '').trim()).length,
                    icon: Package,
                    color: 'text-purple-400',
                  },
                ].map(stat => (
                  <GlassCard key={stat.label} className="!p-4 text-center">
                    <stat.icon className={`w-5 h-5 mx-auto mb-1.5 ${stat.color}`} />
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                  </GlassCard>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className="fixed bottom-6 right-6 z-[9999] pointer-events-none">
        <AnimatePresence>
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onDismiss={() => setToast(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  );
};

export default InvoiceViewPage;