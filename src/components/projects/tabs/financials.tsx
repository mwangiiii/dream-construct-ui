import React, { useState, useEffect, useCallback } from "react";
import {
  Award, TrendingUp, CheckCircle, Clock, XCircle, Plus, Edit2, Trash2, Save, X,
  Send, DollarSign, Package, Truck, Building2, AlertCircle, Check, Mail,
  ChevronDown, ChevronUp, Tag, Search, Sparkles, ShoppingCart, Zap,
  ChevronRight, ArrowRight, ShoppingBag, Layers, Star, Hash
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/auth";
import { toast as globalToast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────
// MIGRATION REQUIRED – run once in Supabase SQL editor:
//
//   CREATE TABLE IF NOT EXISTS public.company_price_catalog (
//     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     company_id  uuid NOT NULL REFERENCES tender_companies(id) ON DELETE CASCADE,
//     item_name   text NOT NULL,
//     unit        text NOT NULL DEFAULT 'units',
//     price       numeric NOT NULL DEFAULT 0,
//     created_at  timestamptz NOT NULL DEFAULT now(),
//     updated_at  timestamptz NOT NULL DEFAULT now(),
//     UNIQUE (company_id, item_name)
//   );
//   CREATE INDEX IF NOT EXISTS idx_catalog_company ON public.company_price_catalog(company_id);
//   CREATE INDEX IF NOT EXISTS idx_catalog_item    ON public.company_price_catalog(item_name);
// ─────────────────────────────────────────────────────────────

interface FinancialsProps {
  projectId: string;
}

type Milestone = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  progress_percent: number;
  sort_order: number;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
};

type Financial = {
  id: number;
  project_id: string;
  milestone_id: string;
  category: string;
  stage: string;
  material_name: string;
  material_quantity: number;
  material_unit: string;
  tender_company_id: string | null;
  price_per_unit: number;
  total_price: number;
  expected_delivery_date: string | null;
  delivery_option: string;
  delivery_price: number;
  order_requested: boolean;
  order_requested_at: string | null;
  order_requested_by: string | null;
  order_approved: boolean | null;
  order_approved_at: string | null;
  funds_requested: boolean;
  funds_requested_at: string | null;
  funds_requested_by: string | null;
  funds_sent: boolean;
  funds_sent_at: string | null;
  funds_received: boolean;
  funds_received_at: string | null;
  goods_paid: boolean;
  goods_paid_at: string | null;
  goods_paid_by: string | null;
  remarks: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  tender_company?: {
    id: string;
    name: string;
    contact_email: string;
    contact_phone: string;
  };
};

type TenderCompany = {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
};

type CatalogItem = {
  id: string;
  company_id: string;
  item_name: string;
  unit: string;
  price: number;
};

type CompanyPrice = {
  company_id: string;
  company_name: string;
  price_per_unit: number;
  unit: string;
};

type EmailModalData = {
  type: 'order_request' | 'order_approval' | 'funds_request' | 'funds_sent' | 'funds_received' | 'goods_paid';
  financial: Financial;
  milestoneId: string;
  itemIdx: number;
};

// New: step-based form state
type FormStep = 'company' | 'product' | 'details';

const materialUnits = ["kg", "tonnes", "pieces", "meters", "liters", "bags", "boxes", "units", "m²", "m³"];
const deliveryOptions = ["Pickup", "Standard Delivery", "Express Delivery", "Drop-off"];

// ═══════════════════════════════════════════════════════════
// STEP INDICATOR
// ═══════════════════════════════════════════════════════════
const StepIndicator = ({ currentStep }: { currentStep: FormStep }) => {
  const steps: { key: FormStep; label: string; icon: React.ReactNode }[] = [
    { key: 'company', label: 'Supplier', icon: <Building2 className="w-4 h-4" /> },
    { key: 'product', label: 'Product', icon: <ShoppingBag className="w-4 h-4" /> },
    { key: 'details', label: 'Details', icon: <Layers className="w-4 h-4" /> },
  ];
  const stepIndex = { company: 0, product: 1, details: 2 };

  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, i) => {
        const done = stepIndex[currentStep] > i;
        const active = currentStep === s.key;
        return (
          <React.Fragment key={s.key}>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
              active ? "bg-primary text-background shadow-lg shadow-primary/30 scale-105" :
              done ? "bg-green-500/20 text-green-400" :
              "bg-white/5 text-muted-foreground"
            )}>
              {done ? <Check className="w-3.5 h-3.5" /> : s.icon}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-px mx-1 max-w-[32px]", done ? "bg-green-500/40" : "bg-white/10")} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// COMPANY PICKER STEP
// ═══════════════════════════════════════════════════════════
const CompanyPickerStep = ({
  companies, catalog, selectedId, onSelect
}: {
  companies: TenderCompany[];
  catalog: CatalogItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) => {
  const [search, setSearch] = useState("");
  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search supplier…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition"
          autoFocus
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No suppliers found</p>
          <p className="text-xs mt-1">Add companies in Manage Companies first</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
          {filtered.map((company, i) => {
            const itemCount = catalog.filter(c => c.company_id === company.id).length;
            const isSelected = selectedId === company.id;
            return (
              <motion.button
                key={company.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onSelect(company.id)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border text-left transition-all group",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                    : "border-white/10 bg-white/5 hover:border-primary/40 hover:bg-white/10"
                )}
              >
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm",
                  isSelected ? "bg-primary text-background" : "bg-white/10 text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                )}>
                  {company.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{company.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {itemCount > 0 ? (
                      <span className="text-primary font-medium">{itemCount} products</span>
                    ) : (
                      <span className="text-amber-400">No catalog items</span>
                    )}
                  </p>
                </div>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// PRODUCT PICKER STEP
// ═══════════════════════════════════════════════════════════
const ProductPickerStep = ({
  companyName, items, selectedItemName, onSelect
}: {
  companyName: string;
  items: CatalogItem[];
  selectedItemName: string;
  onSelect: (item: CatalogItem) => void;
}) => {
  const [search, setSearch] = useState("");
  const filtered = items.filter(i =>
    i.item_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl">
        <Building2 className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-primary">{companyName}</span>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No catalog items for this supplier</p>
          <p className="text-xs mt-1">Add items in Manage Companies → select company → Pricing Catalog</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition"
              autoFocus
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">No products match your search</p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 max-h-64 overflow-y-auto pr-1">
              {filtered.map((item, i) => {
                const isSelected = selectedItemName === item.item_name;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => onSelect(item)}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all group",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                        : "border-white/10 bg-white/5 hover:border-primary/40 hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        isSelected ? "bg-primary/20" : "bg-white/10 group-hover:bg-primary/10"
                      )}>
                        <Package className={cn("w-4 h-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div>
                        <p className={cn("font-semibold text-sm", isSelected && "text-primary")}>{item.item_name}</p>
                        <p className="text-xs text-muted-foreground">per {item.unit}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn("font-bold text-sm", isSelected ? "text-primary" : "text-foreground")}>
                        KSH {item.price.toLocaleString()}
                      </span>
                      {isSelected
                        ? <Check className="w-4 h-4 text-primary" />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary/60 transition" />
                      }
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// DETAILS STEP
// ═══════════════════════════════════════════════════════════
const DetailsStep = ({
  form, onFormChange, loading, companyName, allCompanies, allCatalog, onCompanyChange
}: {
  form: any;
  onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  loading: boolean;
  companyName: string;
  allCompanies: TenderCompany[];
  allCatalog: CatalogItem[];
  onCompanyChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) => {
  const qty = Number(form.material_quantity) || 0;
  const ppu = Number(form.price_per_unit) || 0;
  const total = qty * ppu;
  const delivery = Number(form.delivery_price) || 0;
  const grandTotal = total + delivery;

  return (
    <div className="space-y-4">
      {/* Selected product summary banner */}
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <ShoppingBag className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{form.material_name}</p>
          <p className="text-xs text-muted-foreground">{companyName} · KSH {ppu.toLocaleString()}/{form.material_unit}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Unit Price</p>
          <p className="font-bold text-primary text-sm">KSH {ppu.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Quantity */}
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Quantity *</label>
          <div className="flex gap-2">
            <input
              name="material_quantity"
              type="number"
              min="0"
              step="0.01"
              value={form.material_quantity}
              onChange={onFormChange}
              placeholder="0"
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition text-base font-semibold"
              required
              disabled={loading}
            />
            <div className="px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl text-primary font-bold text-sm flex items-center whitespace-nowrap">
              {form.material_unit}
            </div>
          </div>
        </div>

        {/* Price per unit (editable override) */}
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
            Price / Unit (KSH) *
            <span className="ml-2 text-green-400 normal-case font-normal text-xs flex items-center gap-1 inline-flex">
              <Zap className="w-3 h-3" /> auto-filled
            </span>
          </label>
          <input
            name="price_per_unit"
            type="number"
            min="0"
            step="0.01"
            value={form.price_per_unit}
            onChange={onFormChange}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition text-base font-semibold"
            required
            disabled={loading}
          />
        </div>
      </div>

      {/* Live calculation card */}
      {qty > 0 && ppu > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-2"
        >
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
            <p className="text-xs text-muted-foreground mb-1">Materials</p>
            <p className="font-bold text-sm">KSH {total.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
            <p className="text-xs text-muted-foreground mb-1">Delivery</p>
            <p className="font-bold text-sm">KSH {delivery.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-center">
            <p className="text-xs text-primary mb-1">Grand Total</p>
            <p className="font-bold text-primary text-sm">KSH {grandTotal.toLocaleString()}</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Expected delivery date */}
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Expected Delivery</label>
          <input
            name="expected_delivery_date"
            type="date"
            value={form.expected_delivery_date}
            onChange={onFormChange}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition text-sm"
            disabled={loading}
          />
        </div>

        {/* Delivery option */}
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Delivery Option</label>
          <select
            name="delivery_option"
            value={form.delivery_option}
            onChange={onFormChange}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition text-sm"
            disabled={loading}
          >
            {deliveryOptions.map(o => <option key={o} value={o} className="bg-background">{o}</option>)}
          </select>
        </div>

        {/* Delivery price */}
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Delivery Price (KSH)</label>
          <input
            name="delivery_price"
            type="number"
            min="0"
            step="0.01"
            value={form.delivery_price}
            onChange={onFormChange}
            placeholder="0"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition text-sm font-medium"
            disabled={loading}
          />
        </div>
      </div>

      {/* Remarks */}
      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Remarks</label>
        <textarea
          name="remarks"
          value={form.remarks}
          onChange={onFormChange}
          rows={2}
          placeholder="Any additional notes…"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition text-sm resize-none"
          disabled={loading}
        />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
const Financials: React.FC<FinancialsProps> = ({ projectId }) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [financials, setFinancials] = useState<Record<string, Financial[]>>({});
  const [tenderCompanies, setTenderCompanies] = useState<TenderCompany[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [showFormForMilestone, setShowFormForMilestone] = useState<string | null>(null);

  // ── Wizard form state ──────────────────────────────────────
  const [formStep, setFormStep] = useState<FormStep>('company');
  const [form, setForm] = useState({
    milestone_id: "",
    material_name: "",
    material_quantity: "",
    material_unit: materialUnits[0],
    tender_company_id: "",
    price_per_unit: "",
    expected_delivery_date: "",
    delivery_option: deliveryOptions[0],
    delivery_price: "",
    remarks: ""
  });

  const [editIdx, setEditIdx] = useState(-1);
  const [editId, setEditId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ milestoneId: string; idx: number } | null>(null);

  // Price comparison modal
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");
  const [companyPrices, setCompanyPrices] = useState<CompanyPrice[]>([]);

  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Email
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailModalData, setEmailModalData] = useState<EmailModalData | null>(null);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", body: "" });
  const [sendingEmail, setSendingEmail] = useState(false);

  // Company modal
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [companyForm, setCompanyForm] = useState({ id: "", name: "", contact_email: "", contact_phone: "", address: "" });
  const [editingCompany, setEditingCompany] = useState(false);
  const [confirmDeleteCompany, setConfirmDeleteCompany] = useState<string | null>(null);

  // Catalog / pricing panel
  const [activeCatalogCompanyId, setActiveCatalogCompanyId] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogForm, setCatalogForm] = useState({ item_name: "", unit: materialUnits[0], price: "" });
  const [editingCatalogItem, setEditingCatalogItem] = useState<CatalogItem | null>(null);
  const [confirmDeleteCatalog, setConfirmDeleteCatalog] = useState<CatalogItem | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // ══════════════════════════════════════════════════════════
  // Init
  // ══════════════════════════════════════════════════════════
  useEffect(() => {
    initializeData();
  }, [projectId]);

  const initializeData = async () => {
    await Promise.all([
      fetchMilestones(),
      fetchFinancials(),
      fetchTenderCompanies(),
      fetchCurrentUser(),
      fetchCatalog(),
    ]);
  };

  const fetchCurrentUser = async () => setCurrentUser(await getCurrentUser());

  const fetchMilestones = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_milestones")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });
    if (!error && data) {
      setMilestones(data);
      setExpandedMilestones(new Set(data.slice(0, 3).map((m: Milestone) => m.id)));
    }
    setLoading(false);
  };

  const fetchFinancials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_financials")
      .select(`*, tender_company:tender_companies(id, name, contact_email, contact_phone)`)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (!error && data) {
      const grouped = data.reduce((acc: Record<string, Financial[]>, item: Financial) => {
        const key = item.milestone_id || "unassigned";
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {});
      setFinancials(grouped);
    }
    setLoading(false);
  };

  const fetchTenderCompanies = async () => {
    const { data, error } = await supabase
      .from("tender_companies")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (!error && data) setTenderCompanies(data);
  };

  const fetchCatalog = async () => {
    const { data, error } = await supabase
      .from("company_price_catalog")
      .select("*")
      .order("item_name", { ascending: true });
    if (!error && data) setCatalog(data as CatalogItem[]);
  };

  // ══════════════════════════════════════════════════════════
  // Catalog helpers
  // ══════════════════════════════════════════════════════════
  const catalogForCompany = (companyId: string) =>
    catalog.filter(c => c.company_id === companyId);

  const getPricesForItem = (itemName: string): CompanyPrice[] => {
    if (!itemName.trim()) return [];
    const norm = itemName.trim().toLowerCase();
    return catalog
      .filter(c => c.item_name.toLowerCase() === norm)
      .map(c => ({
        company_id: c.company_id,
        company_name: tenderCompanies.find(t => t.id === c.company_id)?.name || "Unknown",
        price_per_unit: c.price,
        unit: c.unit,
      }))
      .sort((a, b) => a.price_per_unit - b.price_per_unit);
  };

  // ══════════════════════════════════════════════════════════
  // Wizard step handlers
  // ══════════════════════════════════════════════════════════
  const handleCompanySelect = (companyId: string) => {
    setForm(prev => ({
      ...prev,
      tender_company_id: companyId,
      // reset product when changing company
      material_name: "",
      price_per_unit: "",
      material_unit: materialUnits[0],
    }));
    setFormStep('product');
  };

  const handleProductSelect = (item: CatalogItem) => {
    setForm(prev => ({
      ...prev,
      material_name: item.item_name,
      price_per_unit: item.price.toString(),
      material_unit: item.unit,
    }));
    setFormStep('details');
  };

  // When editing, jump straight to details with all fields pre-filled
  const handleEdit = (milestoneId: string, idx: number) => {
    const f = (financials[milestoneId] || [])[idx];
    setEditIdx(idx);
    setEditId(f.id);
    setForm({
      milestone_id: milestoneId,
      material_name: f.material_name,
      material_quantity: f.material_quantity.toString(),
      material_unit: f.material_unit,
      tender_company_id: f.tender_company_id || "",
      price_per_unit: f.price_per_unit.toString(),
      expected_delivery_date: f.expected_delivery_date || "",
      delivery_option: f.delivery_option,
      delivery_price: f.delivery_price.toString(),
      remarks: f.remarks,
    });
    setFormStep('details'); // editing goes straight to details
    setShowFormForMilestone(milestoneId);
    setExpandedMilestones(prev => new Set([...prev, milestoneId]));
  };

  // ══════════════════════════════════════════════════════════
  // Roles
  // ══════════════════════════════════════════════════════════
  const isAdmin = currentUser?.roles?.some((r: any) => r.role_name === "admin");
  const isQuantitySurveyor = currentUser?.roles?.some((r: any) =>
    ["admin", "quantity_surveyor", "manager", "project_manager"].includes(r.role_name)
  );
  const isFinanceTeam = currentUser?.roles?.some((r: any) =>
    ["admin", "finance", "manager", "project_manager"].includes(r.role_name)
  );
  const isClient = currentUser?.roles?.some((r: any) => r.role_name === "client");
  const canEdit = !isClient && (isQuantitySurveyor || isFinanceTeam || isAdmin);
  const canDelete = currentUser?.roles?.some((r: any) =>
    ["admin", "project_manager", "manager"].includes(r.role_name)
  );

  // ══════════════════════════════════════════════════════════
  // Main form handlers
  // ══════════════════════════════════════════════════════════
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const calculateTotalPrice = (qty?: string, ppu?: string) => {
    const q = Number(qty ?? form.material_quantity) || 0;
    const p = Number(ppu ?? form.price_per_unit) || 0;
    return q * p;
  };

  const toggleMilestone = (id: string) =>
    setExpandedMilestones(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const openAddForm = (milestoneId: string) => {
    resetForm();
    setForm(prev => ({ ...prev, milestone_id: milestoneId }));
    setFormStep('company');
    setShowFormForMilestone(milestoneId);
    setExpandedMilestones(prev => new Set([...prev, milestoneId]));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.milestone_id || !form.material_name.trim()) {
      globalToast({ title: "Please complete all steps", variant: "destructive" });
      return;
    }
    setLoading(true);
    const totalPrice = calculateTotalPrice();
    const { data, error } = await supabase
      .from("project_financials")
      .insert([{
        project_id: projectId,
        milestone_id: form.milestone_id,
        category: "Materials",
        stage: "Procurement",
        material_name: form.material_name,
        material_quantity: Number(form.material_quantity) || 0,
        material_unit: form.material_unit,
        tender_company_id: form.tender_company_id || null,
        price_per_unit: Number(form.price_per_unit) || 0,
        total_price: totalPrice,
        expected_delivery_date: form.expected_delivery_date || null,
        delivery_option: form.delivery_option,
        delivery_price: Number(form.delivery_price) || 0,
        order_requested: false,
        order_approved: null,
        funds_requested: false,
        funds_sent: false,
        funds_received: false,
        goods_paid: false,
        remarks: form.remarks,
        created_by: currentUser?.profile?.id,
      }])
      .select(`*, tender_company:tender_companies(id, name, contact_email, contact_phone)`);

    if (!error && data) {
      setFinancials(prev => ({ ...prev, [form.milestone_id]: [...(prev[form.milestone_id] || []), data[0]] }));
      resetForm();
      toast("Material added successfully!");
    } else {
      globalToast({ title: "Error adding material", description: error?.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId === null) return;
    setLoading(true);
    const totalPrice = calculateTotalPrice();
    const { data, error } = await supabase
      .from("project_financials")
      .update({
        material_name: form.material_name,
        material_quantity: Number(form.material_quantity) || 0,
        material_unit: form.material_unit,
        tender_company_id: form.tender_company_id || null,
        price_per_unit: Number(form.price_per_unit) || 0,
        total_price: totalPrice,
        expected_delivery_date: form.expected_delivery_date || null,
        delivery_option: form.delivery_option,
        delivery_price: Number(form.delivery_price) || 0,
        remarks: form.remarks,
      })
      .eq("id", editId)
      .select(`*, tender_company:tender_companies(id, name, contact_email, contact_phone)`);

    if (!error && data) {
      const items = [...(financials[form.milestone_id] || [])];
      items[editIdx] = data[0];
      setFinancials(prev => ({ ...prev, [form.milestone_id]: items }));
      resetForm();
      toast("Material updated successfully!");
    } else {
      globalToast({ title: "Error updating material", description: error?.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const deleteMaterial = async (milestoneId: string, idx: number) => {
    const items = financials[milestoneId] || [];
    const id = items[idx].id;
    setLoading(true);
    try {
      const { error } = await supabase.from("project_financials").delete().eq("id", id);
      if (error) { globalToast({ title: "Error deleting", description: error.message, variant: "destructive" }); return; }
      setFinancials(prev => ({ ...prev, [milestoneId]: items.filter((_, i) => i !== idx) }));
      if (editId === id) resetForm();
      toast("Material deleted successfully!");
    } catch (err: any) {
      globalToast({ title: "Unexpected error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setConfirmDelete(null);
    }
  };

  const resetForm = () => {
    setEditIdx(-1);
    setEditId(null);
    setForm({ milestone_id: "", material_name: "", material_quantity: "", material_unit: materialUnits[0], tender_company_id: "", price_per_unit: "", expected_delivery_date: "", delivery_option: deliveryOptions[0], delivery_price: "", remarks: "" });
    setShowFormForMilestone(null);
    setFormStep('company');
  };

  // ══════════════════════════════════════════════════════════
  // Compare prices
  // ══════════════════════════════════════════════════════════
  const handleViewPrices = (materialName: string) => {
    setSelectedMaterial(materialName);
    setCompanyPrices(getPricesForItem(materialName));
    setShowPriceModal(true);
  };

  const applyPriceFromModal = (cp: CompanyPrice) => {
    setForm(prev => ({
      ...prev,
      tender_company_id: cp.company_id,
      price_per_unit: cp.price_per_unit.toString(),
      material_unit: cp.unit,
    }));
    setShowPriceModal(false);
    toast("Price applied!");
  };

  // ══════════════════════════════════════════════════════════
  // Email helpers
  // ══════════════════════════════════════════════════════════
  const generateEmailTemplate = (type: EmailModalData['type'], financial: Financial, milestoneName: string) => {
    const company = financial.tender_company;
    const templates: Record<string, { subject: string; body: string }> = {
      order_request: {
        subject: `Order Request – ${financial.material_name} for ${milestoneName}`,
        body: `Dear ${company?.name || 'Supplier'},\n\nWe would like to request an order for:\n\nMaterial: ${financial.material_name}\nQuantity: ${financial.material_quantity} ${financial.material_unit}\nPrice/Unit: KSH ${financial.price_per_unit.toLocaleString()}\nTotal: KSH ${financial.total_price.toLocaleString()}\nDelivery: ${financial.delivery_option} – KSH ${financial.delivery_price.toLocaleString()}\nExpected: ${financial.expected_delivery_date ? new Date(financial.expected_delivery_date).toLocaleDateString() : 'TBD'}\n\nGRAND TOTAL: KSH ${(financial.total_price + financial.delivery_price).toLocaleString()}\n\nPlease confirm receipt and provide delivery timeline.\n\nBest regards,\nProject Finance Team`,
      },
      order_approval: {
        subject: `Order ${financial.order_approved ? 'Approved' : 'Rejected'} – ${financial.material_name}`,
        body: `Dear ${company?.name || 'Supplier'},\n\nYour order for ${financial.material_name} has been ${financial.order_approved ? 'APPROVED' : 'REJECTED'}.\n\nTotal: KSH ${financial.total_price.toLocaleString()}\n\n${financial.order_approved ? 'Please proceed with order preparation.\n\nExpected Delivery: ' + (financial.expected_delivery_date ? new Date(financial.expected_delivery_date).toLocaleDateString() : 'TBD') : 'We cannot proceed with this order at this time.'}\n\nBest regards,\nProject Finance Team`,
      },
      funds_request: {
        subject: `Funds Request – ${financial.material_name} Payment`,
        body: `Dear Finance Department,\n\nFunds requested for:\n\nSupplier: ${company?.name || 'N/A'}\nMaterial: ${financial.material_name}\nMaterial Cost: KSH ${financial.total_price.toLocaleString()}\nDelivery Cost: KSH ${financial.delivery_price.toLocaleString()}\n\nTOTAL REQUESTED: KSH ${(financial.total_price + financial.delivery_price).toLocaleString()}\n\nBest regards,\nProject Team`,
      },
      funds_sent: {
        subject: `Payment Sent – ${financial.material_name}`,
        body: `Dear ${company?.name || 'Supplier'},\n\nPayment of KSH ${(financial.total_price + financial.delivery_price).toLocaleString()} has been sent.\n\nPlease confirm receipt and proceed with delivery.\n\nExpected Delivery: ${financial.expected_delivery_date ? new Date(financial.expected_delivery_date).toLocaleDateString() : 'TBD'}\n\nBest regards,\nProject Finance Team`,
      },
      funds_received: {
        subject: `Payment Received – ${financial.material_name}`,
        body: `Dear Project Team,\n\nPayment of KSH ${(financial.total_price + financial.delivery_price).toLocaleString()} received from ${company?.name || 'Supplier'}.\n\nOrder preparation will commence immediately.\n\nBest regards,\n${company?.name || 'Supplier'}`,
      },
      goods_paid: {
        subject: `Final Payment Confirmation – ${financial.material_name}`,
        body: `Dear ${company?.name || 'Supplier'},\n\nFinal payment of KSH ${(financial.total_price + financial.delivery_price).toLocaleString()} has been processed for delivered goods.\n\nThank you for your excellent service.\n\nBest regards,\nProject Finance Team`,
      },
    };
    return templates[type];
  };

  const openEmailModal = (type: EmailModalData['type'], milestoneId: string, idx: number) => {
    const financial = (financials[milestoneId] || [])[idx];
    if (!financial?.tender_company_id || !financial?.tender_company?.contact_email) {
      globalToast({ title: "No email address found", description: "Please update company details.", variant: "destructive" });
      return;
    }
    const milestone = milestones.find(m => m.id === milestoneId);
    const tpl = generateEmailTemplate(type, financial, milestone?.title || "Project");
    setEmailModalData({ type, financial, milestoneId, itemIdx: idx });
    setEmailForm({ to: financial.tender_company.contact_email, subject: tpl.subject, body: tpl.body });
    setShowEmailModal(true);
  };

  const closeEmailModal = () => { setShowEmailModal(false); setEmailModalData(null); setEmailForm({ to: "", subject: "", body: "" }); };

  const sendEmail = async () => {
    if (!emailModalData) return;
    setSendingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = (supabase as any).supabaseUrl ||
        (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SUPABASE_URL);
      if (!supabaseUrl) throw new Error("Supabase URL not configured.");

      const res = await fetch(`${supabaseUrl}/functions/v1/send-financial-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          financial_id: emailModalData.financial.id,
          project_id: projectId,
          milestone_id: emailModalData.milestoneId,
          email_type: emailModalData.type,
          email_data: emailForm,
        }),
      });

      if (res.ok) {
        await updateFinancialAfterEmail(emailModalData.type, emailModalData.milestoneId, emailModalData.itemIdx);
        toast("Email sent successfully!");
        closeEmailModal();
        await fetchFinancials();
      } else {
        const err = await res.json();
        globalToast({ title: "Error sending email", description: err.message || "Unknown error", variant: "destructive" });
      }
    } catch (err: any) {
      globalToast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const updateFinancialAfterEmail = async (type: EmailModalData['type'], milestoneId: string, idx: number) => {
    const items = financials[milestoneId] || [];
    const item = items[idx];
    const map: Record<string, any> = {
      order_request: { order_requested: true, order_requested_at: new Date().toISOString(), order_requested_by: currentUser?.profile?.id },
      funds_request: { funds_requested: true, funds_requested_at: new Date().toISOString(), funds_requested_by: currentUser?.profile?.id },
      funds_sent: { funds_sent: true, funds_sent_at: new Date().toISOString() },
      funds_received: { funds_received: true, funds_received_at: new Date().toISOString() },
      goods_paid: { goods_paid: true, goods_paid_at: new Date().toISOString(), goods_paid_by: currentUser?.profile?.id },
    };
    const updateData = map[type];
    if (updateData) {
      const { data, error } = await supabase
        .from("project_financials")
        .update(updateData)
        .eq("id", item.id)
        .select(`*, tender_company:tender_companies(id, name, contact_email, contact_phone)`);
      if (!error && data) {
        const updated = [...items];
        updated[idx] = data[0];
        setFinancials(prev => ({ ...prev, [milestoneId]: updated }));
      }
    }
  };

  // ══════════════════════════════════════════════════════════
  // Finance action handlers
  // ══════════════════════════════════════════════════════════
  const handleToggleOrderApproval = async (milestoneId: string, idx: number, approved: boolean) => {
    if (!isFinanceTeam) { globalToast({ title: "Only finance team can update order approval", variant: "destructive" }); return; }
    const items = financials[milestoneId] || [];
    const item = items[idx];
    if (!item.order_requested) { globalToast({ title: "Order must be requested first", variant: "destructive" }); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("project_financials")
      .update({ order_approved: approved, order_approved_at: approved ? new Date().toISOString() : null })
      .eq("id", item.id)
      .select(`*, tender_company:tender_companies(id, name, contact_email, contact_phone)`);
    if (!error && data) {
      const updated = [...items]; updated[idx] = data[0];
      setFinancials(prev => ({ ...prev, [milestoneId]: updated }));
      if (approved) openEmailModal("order_approval", milestoneId, idx);
    }
    setLoading(false);
  };

  const handleToggleFundsSent = async (milestoneId: string, idx: number, sent: boolean) => {
    if (!isFinanceTeam) { globalToast({ title: "Only finance team can mark funds as sent", variant: "destructive" }); return; }
    const items = financials[milestoneId] || [];
    if (!items[idx].funds_requested) { globalToast({ title: "Funds must be requested first", variant: "destructive" }); return; }
    if (sent) { openEmailModal("funds_sent", milestoneId, idx); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("project_financials")
      .update({ funds_sent: sent, funds_sent_at: sent ? new Date().toISOString() : null })
      .eq("id", items[idx].id)
      .select(`*, tender_company:tender_companies(id, name, contact_email, contact_phone)`);
    if (!error && data) { const u = [...items]; u[idx] = data[0]; setFinancials(prev => ({ ...prev, [milestoneId]: u })); }
    setLoading(false);
  };

  const handleToggleFundsReceived = async (milestoneId: string, idx: number, received: boolean) => {
    const items = financials[milestoneId] || [];
    if (!items[idx].funds_sent) { globalToast({ title: "Funds must be sent first", variant: "destructive" }); return; }
    if (received) { openEmailModal("funds_received", milestoneId, idx); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("project_financials")
      .update({ funds_received: received, funds_received_at: received ? new Date().toISOString() : null })
      .eq("id", items[idx].id)
      .select(`*, tender_company:tender_companies(id, name, contact_email, contact_phone)`);
    if (!error && data) { const u = [...items]; u[idx] = data[0]; setFinancials(prev => ({ ...prev, [milestoneId]: u })); }
    setLoading(false);
  };

  const handleToggleGoodsPaid = async (milestoneId: string, idx: number, paid: boolean) => {
    if (!isFinanceTeam) { globalToast({ title: "Only finance team can mark goods as paid", variant: "destructive" }); return; }
    const items = financials[milestoneId] || [];
    if (!items[idx].funds_received) { globalToast({ title: "Funds must be received first", variant: "destructive" }); return; }
    if (paid) { openEmailModal("goods_paid", milestoneId, idx); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("project_financials")
      .update({ goods_paid: paid, goods_paid_at: paid ? new Date().toISOString() : null, goods_paid_by: paid ? currentUser?.profile?.id : null })
      .eq("id", items[idx].id)
      .select(`*, tender_company:tender_companies(id, name, contact_email, contact_phone)`);
    if (!error && data) { const u = [...items]; u[idx] = data[0]; setFinancials(prev => ({ ...prev, [milestoneId]: u })); }
    setLoading(false);
  };

  // ══════════════════════════════════════════════════════════
  // Company CRUD
  // ══════════════════════════════════════════════════════════
  const openCompanyForm = (company?: TenderCompany) => {
    setCompanyForm(company
      ? { id: company.id, name: company.name, contact_email: company.contact_email, contact_phone: company.contact_phone, address: company.address }
      : { id: "", name: "", contact_email: "", contact_phone: "", address: "" }
    );
    setEditingCompany(!!company);
    if (company) setActiveCatalogCompanyId(company.id);
    setShowCompanyForm(true);
  };

  const closeCompanyForm = () => {
    setShowCompanyForm(false);
    setCompanyForm({ id: "", name: "", contact_email: "", contact_phone: "", address: "" });
    setEditingCompany(false);
    resetCatalogForm();
    setCatalogSearch("");
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCompanyForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.name.trim()) { globalToast({ title: "Company name required", variant: "destructive" }); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("tender_companies")
      .insert([{ name: companyForm.name, contact_email: companyForm.contact_email, contact_phone: companyForm.contact_phone, address: companyForm.address, is_active: true }])
      .select().single();
    if (!error && data) {
      setTenderCompanies(prev => [...prev, data as TenderCompany]);
      setActiveCatalogCompanyId((data as TenderCompany).id);
      toast("Company added!");
    } else { globalToast({ title: "Error", description: error?.message, variant: "destructive" }); }
    setLoading(false);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.name.trim()) { globalToast({ title: "Company name required", variant: "destructive" }); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("tender_companies")
      .update({ name: companyForm.name, contact_email: companyForm.contact_email, contact_phone: companyForm.contact_phone, address: companyForm.address })
      .eq("id", companyForm.id).select().single();
    if (!error && data) {
      setTenderCompanies(prev => prev.map(c => c.id === companyForm.id ? data as TenderCompany : c));
      toast("Company updated!");
    } else { globalToast({ title: "Error", description: error?.message, variant: "destructive" }); }
    setLoading(false);
  };

  const deleteCompany = async (companyId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("tender_companies").update({ is_active: false }).eq("id", companyId);
      if (error) { globalToast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      setTenderCompanies(prev => prev.filter(c => c.id !== companyId));
      toast("Company deleted!");
    } catch (err: any) { globalToast({ title: "Error", description: err.message, variant: "destructive" }); }
    finally { setLoading(false); setConfirmDeleteCompany(null); }
  };

  // ══════════════════════════════════════════════════════════
  // Catalog CRUD
  // ══════════════════════════════════════════════════════════
  const handleSaveCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCatalogCompanyId || !catalogForm.item_name.trim() || !catalogForm.price) return;
    setCatalogLoading(true);

    const payload = {
      company_id: activeCatalogCompanyId,
      item_name: catalogForm.item_name.trim(),
      unit: catalogForm.unit,
      price: Number(catalogForm.price),
    };

    if (editingCatalogItem) {
      const { data, error } = await supabase
        .from("company_price_catalog")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingCatalogItem.id)
        .select()
        .single();
      if (!error && data) {
        setCatalog(prev => prev.map(c => c.id === editingCatalogItem.id ? data as CatalogItem : c));
        toast("Price updated!");
      } else { globalToast({ title: "Error", description: error?.message, variant: "destructive" }); }
    } else {
      const { data, error } = await supabase
        .from("company_price_catalog")
        .insert([payload])
        .select()
        .single();
      if (!error && data) {
        setCatalog(prev => [...prev, data as CatalogItem]);
        toast("Price added!");
      } else { globalToast({ title: "Error", description: error?.message, variant: "destructive" }); }
    }

    resetCatalogForm();
    setCatalogLoading(false);
  };

  const handleDeleteCatalogItem = async (item: CatalogItem) => {
    setCatalogLoading(true);
    const { error } = await supabase.from("company_price_catalog").delete().eq("id", item.id);
    if (!error) {
      setCatalog(prev => prev.filter(c => c.id !== item.id));
      toast("Price entry deleted!");
    } else { globalToast({ title: "Error", description: error.message, variant: "destructive" }); }
    setConfirmDeleteCatalog(null);
    setCatalogLoading(false);
  };

  const resetCatalogForm = () => {
    setCatalogForm({ item_name: "", unit: materialUnits[0], price: "" });
    setEditingCatalogItem(null);
  };

  const startEditCatalog = (item: CatalogItem) => {
    setEditingCatalogItem(item);
    setCatalogForm({ item_name: item.item_name, unit: item.unit, price: item.price.toString() });
  };

  const filteredCatalog = activeCatalogCompanyId
    ? catalogForCompany(activeCatalogCompanyId).filter(c =>
        c.item_name.toLowerCase().includes(catalogSearch.toLowerCase())
      )
    : [];

  // ══════════════════════════════════════════════════════════
  // Utility
  // ══════════════════════════════════════════════════════════
  const toast = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const calculateGrandTotals = () => {
    let totalMaterials = 0, totalDelivery = 0, totalPaid = 0, totalItems = 0;
    Object.values(financials).forEach(items => items.forEach(item => {
      totalMaterials += item.total_price;
      totalDelivery += item.delivery_price;
      if (item.goods_paid) totalPaid++;
      totalItems++;
    }));
    return { totalMaterials, totalDelivery, grandTotal: totalMaterials + totalDelivery, totalPaid, totalItems };
  };

  const grandTotals = calculateGrandTotals();
  const selectedCompanyName = tenderCompanies.find(c => c.id === form.tender_company_id)?.name || "";
  const selectedCompanyCatalog = form.tender_company_id ? catalogForCompany(form.tender_company_id) : [];

  // Step titles for the form header
  const stepMeta: Record<FormStep, { title: string; subtitle: string }> = {
    company: { title: "Choose Supplier", subtitle: "Who is supplying this material?" },
    product: { title: "Select Product", subtitle: selectedCompanyName ? `From ${selectedCompanyName}'s catalog` : "Choose from catalog" },
    details: { title: editIdx === -1 ? "Order Details" : "Edit Details", subtitle: form.material_name ? `Configuring: ${form.material_name}` : "Fill in quantities and logistics" },
  };

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen bg-background/90 py-8 sm:py-12 md:py-16 flex flex-col">
        <div className="container mx-auto px-2 sm:px-6 flex-1 flex flex-col">

          {/* ── Top bar ── */}
          {(isAdmin || canEdit) && (
            <div className="mb-6 flex justify-end">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setShowCompanyModal(true)}
                className="bg-primary text-background font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition flex items-center gap-2 shadow-lg" disabled={loading}>
                <Building2 className="w-5 h-5" /> Manage Companies
              </motion.button>
            </div>
          )}

          {/* ── Grand Totals ── */}
          {grandTotals.totalItems > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Materials", value: `KSH ${grandTotals.totalMaterials.toLocaleString()}`, color: "from-blue-500/20 to-blue-600/10", icon: Package },
                { label: "Total Delivery", value: `KSH ${grandTotals.totalDelivery.toLocaleString()}`, color: "from-purple-500/20 to-purple-600/10", icon: Truck },
                { label: "Grand Total", value: `KSH ${grandTotals.grandTotal.toLocaleString()}`, color: "from-primary/20 to-primary/10", icon: DollarSign },
                { label: "Items Paid", value: `${grandTotals.totalPaid} / ${grandTotals.totalItems}`, color: "from-green-500/20 to-green-600/10", icon: CheckCircle },
              ].map((s) => (
                <div key={s.label} className={`rounded-2xl bg-gradient-to-br ${s.color} border border-white/10 p-4`}>
                  <div className="flex items-center gap-2 mb-1"><s.icon className="w-4 h-4 text-muted-foreground" /><p className="text-xs text-muted-foreground font-medium">{s.label}</p></div>
                  <p className="text-lg font-bold">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Milestones ── */}
          {milestones.map(milestone => {
            const milestoneFinancials = financials[milestone.id] || [];
            const showingForm = showFormForMilestone === milestone.id;

            return (
              <div key={milestone.id} className="mb-8 rounded-xl overflow-hidden border border-white/10">
                <button onClick={() => toggleMilestone(milestone.id)} className="w-full flex items-center justify-between p-5 bg-background/60 hover:bg-background/80 transition">
                  <div>
                    <h3 className="text-lg font-bold">{milestone.title}</h3>
                    {milestone.description && <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>}
                  </div>
                  {expandedMilestones.has(milestone.id) ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </button>

                <AnimatePresence>
                  {expandedMilestones.has(milestone.id) && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                      <div className="p-6">
                        {isQuantitySurveyor && !isClient && (
                          <div className="mb-6">
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                              onClick={() => { if (showingForm && editIdx === -1) resetForm(); else openAddForm(milestone.id); }}
                              className="bg-primary text-background font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition flex items-center gap-2" disabled={loading}>
                              {showingForm && editIdx === -1 ? <><X className="w-5 h-5" /> Cancel</> : <><Plus className="w-5 h-5" /> Add Material</>}
                            </motion.button>
                          </div>
                        )}

                        {/* ── Wizard Add/Edit Form ── */}
                        <AnimatePresence>
                          {showingForm && isQuantitySurveyor && !isClient && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden mb-8"
                            >
                              <div className="backdrop-blur-2xl bg-background/95 border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
                                {/* Form Header */}
                                <div className="bg-gradient-to-r from-primary/10 to-transparent border-b border-white/10 px-6 py-4">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <h4 className="text-lg font-bold">{stepMeta[formStep].title}</h4>
                                      <p className="text-sm text-muted-foreground mt-0.5">{stepMeta[formStep].subtitle}</p>
                                    </div>
                                    <button type="button" onClick={resetForm}
                                      className="p-2 hover:bg-white/10 rounded-lg transition text-muted-foreground hover:text-foreground">
                                      <X className="w-5 h-5" />
                                    </button>
                                  </div>

                                  {/* Step indicator — only on add mode */}
                                  {editIdx === -1 && (
                                    <div className="mt-4">
                                      <StepIndicator currentStep={formStep} />
                                    </div>
                                  )}
                                </div>

                                <div className="p-6">
                                  <form onSubmit={editIdx === -1 ? handleAdd : handleUpdate}>

                                    {/* STEP 1: Company picker */}
                                    <AnimatePresence mode="wait">
                                      {formStep === 'company' && (
                                        <motion.div key="company" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                          <CompanyPickerStep
                                            companies={tenderCompanies}
                                            catalog={catalog}
                                            selectedId={form.tender_company_id}
                                            onSelect={handleCompanySelect}
                                          />
                                          <div className="mt-4 flex justify-between items-center pt-4 border-t border-white/10">
                                            <p className="text-xs text-muted-foreground">
                                              {tenderCompanies.length === 0 ? (
                                                <span className="text-amber-400">No suppliers yet — add one in Manage Companies</span>
                                              ) : "Select a supplier to continue"}
                                            </p>
                                            {form.tender_company_id && (
                                              <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                onClick={() => setFormStep('product')}
                                                className="flex items-center gap-2 bg-primary text-background px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition">
                                                Next: Products <ArrowRight className="w-4 h-4" />
                                              </motion.button>
                                            )}
                                          </div>
                                        </motion.div>
                                      )}

                                      {/* STEP 2: Product picker */}
                                      {formStep === 'product' && (
                                        <motion.div key="product" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                          <ProductPickerStep
                                            companyName={selectedCompanyName}
                                            items={selectedCompanyCatalog}
                                            selectedItemName={form.material_name}
                                            onSelect={handleProductSelect}
                                          />
                                          <div className="mt-4 flex justify-between items-center pt-4 border-t border-white/10">
                                            <button type="button" onClick={() => setFormStep('company')}
                                              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition px-3 py-2 rounded-lg hover:bg-white/5">
                                              <ChevronDown className="w-4 h-4 rotate-90" /> Back
                                            </button>
                                            {form.material_name && (
                                              <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                onClick={() => setFormStep('details')}
                                                className="flex items-center gap-2 bg-primary text-background px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition">
                                                Next: Details <ArrowRight className="w-4 h-4" />
                                              </motion.button>
                                            )}
                                          </div>
                                        </motion.div>
                                      )}

                                      {/* STEP 3: Details */}
                                      {formStep === 'details' && (
                                        <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                          <DetailsStep
                                            form={form}
                                            onFormChange={handleChange}
                                            loading={loading}
                                            companyName={selectedCompanyName}
                                            allCompanies={tenderCompanies}
                                            allCatalog={catalog}
                                            onCompanyChange={(e) => setForm(prev => ({ ...prev, tender_company_id: e.target.value }))}
                                          />
                                          <div className="mt-6 flex gap-3 pt-4 border-t border-white/10">
                                            {editIdx === -1 && (
                                              <button type="button" onClick={() => setFormStep('product')}
                                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition px-3 py-2.5 rounded-xl hover:bg-white/5">
                                                <ChevronDown className="w-4 h-4 rotate-90" /> Back
                                              </button>
                                            )}
                                            <motion.button type="submit" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                                              className="flex-1 bg-primary text-background font-bold px-8 py-3 rounded-xl hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                                              disabled={loading || !form.material_quantity || !form.price_per_unit}>
                                              {loading
                                                ? <><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />{editIdx === -1 ? "Adding…" : "Updating…"}</>
                                                : <><Save className="w-4 h-4" />{editIdx === -1 ? "Add Material" : "Update Material"}</>
                                              }
                                            </motion.button>
                                            <button type="button" onClick={resetForm}
                                              className="px-5 py-2.5 bg-white/5 border border-white/10 font-semibold rounded-xl hover:bg-white/10 transition text-sm flex items-center gap-2" disabled={loading}>
                                              <X className="w-4 h-4" /> Cancel
                                            </button>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </form>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* ── Table ── */}
                        {milestoneFinancials.length === 0 ? (
                          <div className="text-center py-8 bg-white/5 border border-white/10 rounded-xl">
                            <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground">No materials added for this milestone yet.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="bg-background/60 border-b border-white/10">
                                  {["1. Material","2. Qty","3. Company","4. Price/Unit","5. Total","6. Exp. Delivery","7. Delivery","8. Del. Price","9. Req Order","10. Order","11. Req $","12. Sent $","13. Rec $","14. Paid"].map(h => (
                                    <th key={h} className="py-3 px-3 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                                  ))}
                                  {isQuantitySurveyor && !isClient && <th className="py-3 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Actions</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {milestoneFinancials.map((item, idx) => (
                                  <tr key={item.id} className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors">
                                    <td className="py-3 px-3">
                                      <div className="font-bold">{item.material_name}</div>
                                      {item.remarks && <div className="text-xs text-muted-foreground">{item.remarks}</div>}
                                    </td>
                                    <td className="py-3 px-3 whitespace-nowrap">{item.material_quantity} {item.material_unit}</td>
                                    <td className="py-3 px-3">
                                      <div className="flex flex-col gap-1">
                                        <span>{item.tender_company?.name || "-"}</span>
                                        {item.material_name && (
                                          <button onClick={() => handleViewPrices(item.material_name)}
                                            className="text-primary hover:text-primary/80 text-xs underline text-left flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3" /> Compare Prices
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 text-right">KSH {item.price_per_unit.toLocaleString()}</td>
                                    <td className="py-3 px-3 text-right font-bold text-primary">KSH {item.total_price.toLocaleString()}</td>
                                    <td className="py-3 px-3 text-xs">{item.expected_delivery_date ? new Date(item.expected_delivery_date).toLocaleDateString() : "-"}</td>
                                    <td className="py-3 px-3 text-xs">{item.delivery_option}</td>
                                    <td className="py-3 px-3 text-right text-xs text-muted-foreground">KSH {item.delivery_price.toLocaleString()}</td>

                                    <td className="py-3 px-3 text-center">
                                      {!item.order_requested ? (
                                        isFinanceTeam && !isClient && item.tender_company_id ? (
                                          <button onClick={() => openEmailModal("order_request", milestone.id, idx)} disabled={loading}
                                            className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition disabled:opacity-50" title="Request order via email">
                                            <Mail className="w-4 h-4" />
                                          </button>
                                        ) : <span className="text-muted-foreground text-xs">-</span>
                                      ) : (
                                        <div className="flex items-center justify-center gap-1">
                                          <Check className="w-4 h-4 text-green-600" />
                                          <span className="text-xs text-muted-foreground">{item.order_requested_at && new Date(item.order_requested_at).toLocaleDateString()}</span>
                                        </div>
                                      )}
                                    </td>

                                    <td className="py-3 px-3 text-center">
                                      {item.order_requested ? (
                                        isFinanceTeam && !isClient ? (
                                          <div className="flex gap-2 justify-center">
                                            <button onClick={() => handleToggleOrderApproval(milestone.id, idx, true)} disabled={loading || item.order_approved === true}
                                              className={cn("p-1.5 rounded transition", item.order_approved === true ? "bg-green-500 text-white" : "bg-white/5 hover:bg-green-500/20 disabled:opacity-50")} title="Approve">
                                              <Check className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleToggleOrderApproval(milestone.id, idx, false)} disabled={loading || item.order_approved === false}
                                              className={cn("p-1.5 rounded transition", item.order_approved === false ? "bg-red-500 text-white" : "bg-white/5 hover:bg-red-500/20 disabled:opacity-50")} title="Reject">
                                              <X className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ) : (
                                          <span>{item.order_approved === true && <Check className="w-4 h-4 text-green-600 mx-auto" />}{item.order_approved === false && <X className="w-4 h-4 text-red-600 mx-auto" />}{item.order_approved === null && <span className="text-muted-foreground">-</span>}</span>
                                        )
                                      ) : <span className="text-muted-foreground">-</span>}
                                    </td>

                                    <td className="py-3 px-3 text-center">
                                      {item.order_approved === true && !item.funds_requested ? (
                                        isFinanceTeam && !isClient ? (
                                          <button onClick={() => openEmailModal("funds_request", milestone.id, idx)} disabled={loading}
                                            className="bg-purple-500 text-white p-2 rounded-lg hover:bg-purple-600 transition disabled:opacity-50" title="Request funds">
                                            <Mail className="w-4 h-4" />
                                          </button>
                                        ) : <span className="text-muted-foreground text-xs">-</span>
                                      ) : item.funds_requested ? <Check className="w-4 h-4 text-purple-600 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                                    </td>

                                    <td className="py-3 px-3 text-center">
                                      {item.funds_requested ? (
                                        isFinanceTeam && !isClient ? (
                                          <button onClick={() => handleToggleFundsSent(milestone.id, idx, !item.funds_sent)} disabled={loading || item.funds_sent}
                                            className={cn("p-1.5 rounded transition", item.funds_sent ? "bg-green-500 text-white" : "bg-white/5 hover:bg-green-500/20 disabled:opacity-50")} title={item.funds_sent ? "Funds sent" : "Mark as sent"}>
                                            <Check className="w-4 h-4" />
                                          </button>
                                        ) : <span>{item.funds_sent ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground">-</span>}</span>
                                      ) : <span className="text-muted-foreground">-</span>}
                                    </td>

                                    <td className="py-3 px-3 text-center">
                                      {item.funds_sent ? (
                                        !isClient ? (
                                          <button onClick={() => handleToggleFundsReceived(milestone.id, idx, true)} disabled={loading || item.funds_received}
                                            className={cn("p-1.5 rounded transition", item.funds_received ? "bg-green-500 text-white" : "bg-white/5 hover:bg-green-500/20 disabled:opacity-50")} title="Confirm receipt">
                                            <Check className="w-4 h-4" />
                                          </button>
                                        ) : <span>{item.funds_received ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground">-</span>}</span>
                                      ) : <span className="text-muted-foreground">-</span>}
                                    </td>

                                    <td className="py-3 px-3 text-center">
                                      {item.funds_received ? (
                                        isFinanceTeam && !isClient ? (
                                          <button onClick={() => handleToggleGoodsPaid(milestone.id, idx, true)} disabled={loading || item.goods_paid}
                                            className={cn("p-1.5 rounded transition", item.goods_paid ? "bg-green-500 text-white" : "bg-white/5 hover:bg-green-500/20 disabled:opacity-50")} title="Mark as paid">
                                            <Check className="w-4 h-4" />
                                          </button>
                                        ) : <span>{item.goods_paid ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground">-</span>}</span>
                                      ) : <span className="text-muted-foreground">-</span>}
                                    </td>

                                    {isQuantitySurveyor && !isClient && (
                                      <td className="py-3 px-3">
                                        <div className="flex gap-2 justify-center">
                                          <button onClick={() => handleEdit(milestone.id, idx)} className="bg-accent text-background p-2 rounded-lg hover:bg-accent/90 transition" disabled={loading} title="Edit"><Edit2 className="w-4 h-4" /></button>
                                          {canDelete && (
                                            <button onClick={() => setConfirmDelete({ milestoneId: milestone.id, idx })} className="bg-red-500 text-background p-2 rounded-lg hover:bg-red-600 transition" disabled={loading} title="Delete"><Trash2 className="w-4 h-4" /></button>
                                          )}
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* ══════════════════════════════════════════════════
              PRICE COMPARISON MODAL
          ══════════════════════════════════════════════════ */}
          <AnimatePresence>
            {showPriceModal && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={() => setShowPriceModal(false)}>
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                  className="bg-background border border-white/20 rounded-2xl p-6 max-w-xl w-full max-h-[80vh] overflow-y-auto"
                  onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <h3 className="text-2xl font-bold">Price Comparison</h3>
                      <p className="text-sm text-muted-foreground mt-1">"{selectedMaterial}" across all companies in catalog</p>
                    </div>
                    <button onClick={() => setShowPriceModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                  </div>

                  {companyPrices.length === 0 ? (
                    <div className="text-center py-12">
                      <Tag className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground font-medium">No catalog prices found for "{selectedMaterial}"</p>
                      <p className="text-sm text-muted-foreground mt-2">Add prices in Manage Companies → select a company → Pricing Catalog</p>
                    </div>
                  ) : (
                    <div className="space-y-3 mt-4">
                      {companyPrices.map((cp, i) => (
                        <motion.button key={cp.company_id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                          onClick={() => applyPriceFromModal(cp)}
                          className={cn(
                            "w-full flex items-center justify-between p-4 border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition group text-left",
                            i === 0 ? "border-green-500/40 bg-green-500/5" : "border-white/10 bg-white/5"
                          )}>
                          <div className="flex items-center gap-3">
                            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm", i === 0 ? "bg-green-500/20 text-green-400" : "bg-white/10 text-muted-foreground")}>
                              #{i + 1}
                            </div>
                            <div>
                              <span className="font-semibold">{cp.company_name}</span>
                              {i === 0 && <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-semibold">Lowest</span>}
                              <p className="text-xs text-muted-foreground">per {cp.unit}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={cn("text-xl font-bold", i === 0 ? "text-green-400" : "text-foreground")}>KSH {cp.price_per_unit.toLocaleString()}</span>
                            <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition font-semibold">Apply →</span>
                          </div>
                        </motion.button>
                      ))}
                      <p className="text-xs text-center text-muted-foreground pt-2">Click a row to apply that company and price to the current form</p>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ══════════════════════════════════════════════════
              EMAIL MODAL
          ══════════════════════════════════════════════════ */}
          <AnimatePresence>
            {showEmailModal && emailModalData && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeEmailModal}>
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                  className="bg-background border border-white/20 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"><Mail className="w-5 h-5 text-primary" /></div>
                      <div>
                        <h3 className="text-2xl font-bold">Compose Email</h3>
                        <p className="text-sm text-muted-foreground">{emailModalData.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</p>
                      </div>
                    </div>
                    <button onClick={closeEmailModal} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">To</label>
                      <input name="to" type="email" value={emailForm.to} onChange={e => setEmailForm(p => ({ ...p, to: e.target.value }))}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-base font-medium" required disabled={sendingEmail} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Subject</label>
                      <input name="subject" type="text" value={emailForm.subject} onChange={e => setEmailForm(p => ({ ...p, subject: e.target.value }))}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-base font-medium" required disabled={sendingEmail} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Message</label>
                      <textarea name="body" value={emailForm.body} onChange={e => setEmailForm(p => ({ ...p, body: e.target.value }))} rows={16}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-base font-medium resize-none font-mono" required disabled={sendingEmail} />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button onClick={sendEmail}
                        className="flex-1 bg-primary text-background font-semibold px-8 py-3 rounded-xl hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2" disabled={sendingEmail}>
                        {sendingEmail ? <><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />Sending...</> : <><Send className="w-5 h-5" />Send Email</>}
                      </button>
                      <button onClick={closeEmailModal}
                        className="flex-1 bg-muted text-foreground font-semibold px-8 py-3 rounded-xl hover:bg-muted/80 transition flex items-center justify-center gap-2" disabled={sendingEmail}>
                        <X className="w-5 h-5" /> Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Delete material confirm */}
          <AnimatePresence>
            {confirmDelete && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-background border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center"><AlertCircle className="w-6 h-6 text-red-500" /></div>
                    <div><h2 className="text-xl font-bold">Delete Material Entry</h2><p className="text-sm text-muted-foreground">This action cannot be undone</p></div>
                  </div>
                  <p className="mb-6 text-muted-foreground">Are you sure you want to delete <span className="font-semibold text-foreground">{financials[confirmDelete.milestoneId]?.[confirmDelete.idx]?.material_name}</span>?</p>
                  <div className="flex justify-end gap-3">
                    <button className="px-6 py-3 rounded-xl bg-background/60 border border-white/10 font-semibold hover:bg-background/80 transition" onClick={() => setConfirmDelete(null)} disabled={loading}>Cancel</button>
                    <button className="px-6 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2"
                      onClick={() => deleteMaterial(confirmDelete.milestoneId, confirmDelete.idx)} disabled={loading}>
                      {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</> : <><Trash2 className="w-4 h-4" />Delete</>}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ══════════════════════════════════════════════════
              COMPANY MANAGEMENT MODAL
          ══════════════════════════════════════════════════ */}
          <AnimatePresence>
            {showCompanyModal && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCompanyModal(false)}>
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-background border border-white/20 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

                  <div className="flex justify-between items-center p-6 border-b border-white/10">
                    <div>
                      <h2 className="text-2xl font-bold flex items-center gap-3"><Building2 className="w-6 h-6 text-primary" />Tender Companies</h2>
                      <p className="text-sm text-muted-foreground mt-1">Manage companies and their item pricing catalogs</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => { setActiveCatalogCompanyId(null); openCompanyForm(); }}
                        className="bg-primary text-background font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition flex items-center gap-2" disabled={loading}>
                        <Plus className="w-5 h-5" /> Add Company
                      </motion.button>
                      <button onClick={() => setShowCompanyModal(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden flex">
                    <div className="w-full md:w-2/5 border-r border-white/10 overflow-y-auto p-4 space-y-2">
                      {tenderCompanies.length === 0 ? (
                        <div className="text-center py-16">
                          <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                          <p className="text-muted-foreground">No companies yet</p>
                          <p className="text-xs text-muted-foreground mt-1">Click "Add Company" to get started</p>
                        </div>
                      ) : (
                        tenderCompanies.map((company, idx) => {
                          const isActive = activeCatalogCompanyId === company.id;
                          const itemCount = catalogForCompany(company.id).length;
                          return (
                            <motion.div key={company.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                              className={cn("rounded-xl border p-4 cursor-pointer transition-all", isActive ? "border-primary/60 bg-primary/10" : "border-white/10 bg-white/5 hover:bg-white/10")}
                              onClick={() => { setActiveCatalogCompanyId(company.id); resetCatalogForm(); setCatalogSearch(""); }}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold truncate">{company.name}</div>
                                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{company.contact_email || "—"}</div>
                                  <div className="flex items-center gap-3 mt-2">
                                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", itemCount > 0 ? "bg-primary/20 text-primary" : "bg-white/10 text-muted-foreground")}>
                                      {itemCount} {itemCount === 1 ? "item" : "items"} in catalog
                                    </span>
                                  </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={e => { e.stopPropagation(); setActiveCatalogCompanyId(company.id); openCompanyForm(company); }}
                                    className="p-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition" disabled={loading} title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button onClick={e => { e.stopPropagation(); setConfirmDeleteCompany(company.id); }}
                                    className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition" disabled={loading} title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </div>

                    <div className="hidden md:flex flex-1 flex-col overflow-hidden">
                      {!activeCatalogCompanyId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                          <Tag className="w-14 h-14 mb-4 opacity-30" />
                          <p className="font-semibold text-lg">Select a Company</p>
                          <p className="text-sm mt-2 max-w-xs">Click a company on the left to manage its product pricing catalog</p>
                        </div>
                      ) : (() => {
                        const activeCompany = tenderCompanies.find(c => c.id === activeCatalogCompanyId);
                        return (
                          <div className="flex flex-col h-full overflow-hidden">
                            <div className="p-4 border-b border-white/10 bg-background/30">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <h3 className="font-bold text-lg flex items-center gap-2">
                                    <Tag className="w-5 h-5 text-primary" />
                                    {activeCompany?.name} – Pricing Catalog
                                  </h3>
                                  <p className="text-xs text-muted-foreground mt-0.5">Prices here auto-populate the financial form</p>
                                </div>
                              </div>

                              <form onSubmit={handleSaveCatalogItem} className="flex flex-wrap gap-2 items-end">
                                <div className="flex-1 min-w-[140px]">
                                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Item Name *</label>
                                  <input type="text" value={catalogForm.item_name} onChange={e => setCatalogForm(p => ({ ...p, item_name: e.target.value }))}
                                    placeholder="e.g., Cement" required
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition" disabled={catalogLoading} />
                                </div>
                                <div className="w-28">
                                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Unit *</label>
                                  <select value={catalogForm.unit} onChange={e => setCatalogForm(p => ({ ...p, unit: e.target.value }))}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition" disabled={catalogLoading}>
                                    {materialUnits.map(u => <option key={u} value={u} className="bg-background">{u}</option>)}
                                  </select>
                                </div>
                                <div className="w-36">
                                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Price (KSH) *</label>
                                  <input type="number" min="0" step="0.01" value={catalogForm.price} onChange={e => setCatalogForm(p => ({ ...p, price: e.target.value }))}
                                    placeholder="0.00" required
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition" disabled={catalogLoading} />
                                </div>
                                <div className="flex gap-2">
                                  <button type="submit"
                                    className="px-4 py-2 bg-primary text-background rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-1.5" disabled={catalogLoading}>
                                    <Save className="w-4 h-4" />{editingCatalogItem ? "Update" : "Add"}
                                  </button>
                                  {editingCatalogItem && (
                                    <button type="button" onClick={resetCatalogForm}
                                      className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition" disabled={catalogLoading}>
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </form>
                            </div>

                            <div className="p-3 border-b border-white/10">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input type="text" placeholder="Search catalog items…" value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
                                  className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition" />
                              </div>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                              {filteredCatalog.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                                  <Package className="w-10 h-10 mb-3 opacity-30" />
                                  <p className="text-sm font-medium">{catalogSearch ? "No items match your search" : "No catalog items yet"}</p>
                                  <p className="text-xs mt-1">{catalogSearch ? "" : "Use the form above to add prices"}</p>
                                </div>
                              ) : (
                                <table className="min-w-full text-sm">
                                  <thead className="sticky top-0 bg-background/90 backdrop-blur-sm">
                                    <tr className="border-b border-white/10">
                                      <th className="py-2 px-4 text-left text-xs font-semibold text-muted-foreground">Item</th>
                                      <th className="py-2 px-4 text-left text-xs font-semibold text-muted-foreground">Unit</th>
                                      <th className="py-2 px-4 text-right text-xs font-semibold text-muted-foreground">Price (KSH)</th>
                                      <th className="py-2 px-4 text-center text-xs font-semibold text-muted-foreground">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredCatalog.map((item, i) => (
                                      <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                                        className={cn("border-b border-white/5 hover:bg-white/5 transition-colors", editingCatalogItem?.id === item.id && "bg-primary/5 border-primary/20")}>
                                        <td className="py-2.5 px-4 font-medium">{item.item_name}</td>
                                        <td className="py-2.5 px-4 text-muted-foreground">{item.unit}</td>
                                        <td className="py-2.5 px-4 text-right font-bold text-primary">{item.price.toLocaleString()}</td>
                                        <td className="py-2.5 px-4">
                                          <div className="flex gap-1 justify-center">
                                            <button onClick={() => startEditCatalog(item)}
                                              className="p-1.5 bg-accent/10 text-accent rounded hover:bg-accent/20 transition" title="Edit"><Edit2 className="w-3 h-3" /></button>
                                            <button onClick={() => setConfirmDeleteCatalog(item)}
                                              className="p-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition" title="Delete"><Trash2 className="w-3 h-3" /></button>
                                          </div>
                                        </td>
                                      </motion.tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="p-4 border-t border-white/10 bg-background/60">
                    <p className="text-sm text-muted-foreground text-center">
                      <span className="font-semibold text-foreground">{tenderCompanies.length}</span> {tenderCompanies.length === 1 ? "company" : "companies"} &nbsp;·&nbsp;
                      <span className="font-semibold text-foreground">{catalog.length}</span> total catalog entries
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add / Edit Company Form */}
          <AnimatePresence>
            {showCompanyForm && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={closeCompanyForm}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-background border border-white/20 rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold flex items-center gap-3"><Building2 className="w-6 h-6 text-primary" />{editingCompany ? "Edit Company" : "Add New Company"}</h3>
                    <button onClick={closeCompanyForm} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
                  </div>
                  <form onSubmit={editingCompany ? handleUpdateCompany : handleAddCompany} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Company Name *</label>
                      <input name="name" type="text" value={companyForm.name} onChange={handleCompanyChange} placeholder="e.g., ABC Supplies Ltd"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-base font-medium focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition" required disabled={loading} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Contact Email *</label>
                      <input name="contact_email" type="email" value={companyForm.contact_email} onChange={handleCompanyChange} placeholder="contact@company.com"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-base font-medium focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition" required disabled={loading} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Contact Phone</label>
                      <input name="contact_phone" type="tel" value={companyForm.contact_phone} onChange={handleCompanyChange} placeholder="+254 123 456 789"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-base font-medium focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition" disabled={loading} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Address</label>
                      <textarea name="address" value={companyForm.address} onChange={handleCompanyChange} placeholder="Company address" rows={3}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-base font-medium focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition resize-none" disabled={loading} />
                    </div>
                    <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl text-sm text-blue-400 flex items-start gap-2">
                      <Tag className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>After {editingCompany ? "saving" : "adding"} the company, select it from the list to add its item prices. Prices will auto-populate in the financial form.</span>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="submit"
                        className="flex-1 bg-primary text-background font-semibold px-8 py-3 rounded-xl hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2" disabled={loading}>
                        {loading ? <><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />{editingCompany ? "Updating…" : "Adding…"}</> : <><Save className="w-5 h-5" />{editingCompany ? "Update Company" : "Add Company"}</>}
                      </button>
                      <button type="button" onClick={closeCompanyForm}
                        className="flex-1 bg-muted text-foreground font-semibold px-8 py-3 rounded-xl hover:bg-muted/80 transition flex items-center justify-center gap-2" disabled={loading}>
                        <X className="w-5 h-5" /> Cancel
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Delete company confirm */}
          <AnimatePresence>
            {confirmDeleteCompany && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDeleteCompany(null)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-background border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center"><AlertCircle className="w-6 h-6 text-red-500" /></div>
                    <div><h2 className="text-xl font-bold">Delete Company</h2><p className="text-sm text-muted-foreground">This will also delete all its catalog prices</p></div>
                  </div>
                  <p className="mb-6 text-muted-foreground">Are you sure you want to delete <span className="font-semibold text-foreground">{tenderCompanies.find(c => c.id === confirmDeleteCompany)?.name}</span>?</p>
                  <div className="flex justify-end gap-3">
                    <button className="px-6 py-3 rounded-xl bg-background/60 border border-white/10 font-semibold hover:bg-background/80 transition" onClick={() => setConfirmDeleteCompany(null)} disabled={loading}>Cancel</button>
                    <button className="px-6 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2"
                      onClick={() => deleteCompany(confirmDeleteCompany)} disabled={loading}>
                      {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting…</> : <><Trash2 className="w-4 h-4" />Delete</>}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Delete catalog item confirm */}
          <AnimatePresence>
            {confirmDeleteCatalog && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDeleteCatalog(null)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-background border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center"><AlertCircle className="w-6 h-6 text-red-500" /></div>
                    <div><h2 className="text-xl font-bold">Delete Price Entry</h2><p className="text-sm text-muted-foreground">This action cannot be undone</p></div>
                  </div>
                  <p className="mb-6 text-muted-foreground">Remove <span className="font-semibold text-foreground">{confirmDeleteCatalog.item_name}</span> (KSH {confirmDeleteCatalog.price.toLocaleString()}/{confirmDeleteCatalog.unit}) from this company's catalog?</p>
                  <div className="flex justify-end gap-3">
                    <button className="px-6 py-3 rounded-xl bg-background/60 border border-white/10 font-semibold hover:bg-background/80 transition" onClick={() => setConfirmDeleteCatalog(null)} disabled={catalogLoading}>Cancel</button>
                    <button className="px-6 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2"
                      onClick={() => handleDeleteCatalogItem(confirmDeleteCatalog)} disabled={catalogLoading}>
                      {catalogLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting…</> : <><Trash2 className="w-4 h-4" />Delete</>}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Success Toast ── */}
          <AnimatePresence>
            {showSuccessToast && (
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-8 right-8 z-50 bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">{successMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Financials;