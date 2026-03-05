import React, { useState, useEffect } from "react";
import { 
  Award, TrendingUp, CheckCircle, Clock, XCircle, Plus, Edit2, Trash2, Save, X, 
  Send, DollarSign, Package, Truck, Building2, AlertCircle, Check, Mail, ChevronDown, ChevronUp,
  Tag, List
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/auth";

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

// New type for company material prices
type CompanyMaterialPrice = {
  id: string;
  company_id: string;
  material_name: string;
  price_per_unit: number;
  unit: string;
  delivery_price: number;
  delivery_option: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
};

type CompanyPrice = {
  company_id: string;
  company_name: string;
  price_per_unit: number;
  delivery_price?: number;
  delivery_option?: string;
  price_id?: string;
};

type EmailModalData = {
  type: 'order_request' | 'order_approval' | 'funds_request' | 'funds_sent' | 'funds_received' | 'goods_paid';
  financial: Financial;
  milestoneId: string;
  itemIdx: number;
};

const materialUnits = ["kg", "tonnes", "pieces", "meters", "liters", "bags", "boxes", "units", "m²", "m³"];
const deliveryOptions = ["Pickup", "Standard Delivery", "Express Delivery", "Drop-off"];

const Financials: React.FC<FinancialsProps> = ({ projectId }) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [financials, setFinancials] = useState<Record<string, Financial[]>>({});
  const [tenderCompanies, setTenderCompanies] = useState<TenderCompany[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [showFormForMilestone, setShowFormForMilestone] = useState<string | null>(null);
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
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");
  const [companyPrices, setCompanyPrices] = useState<CompanyPrice[]>([]);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  // Email Modal States
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailModalData, setEmailModalData] = useState<EmailModalData | null>(null);
  const [emailForm, setEmailForm] = useState({
    to: "",
    subject: "",
    body: ""
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Tender Company CRUD states
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    id: "",
    name: "",
    contact_email: "",
    contact_phone: "",
    address: ""
  });
  const [editingCompany, setEditingCompany] = useState(false);
  const [confirmDeleteCompany, setConfirmDeleteCompany] = useState<string | null>(null);

  // Company Material Prices states
  const [showPricesForCompany, setShowPricesForCompany] = useState<string | null>(null);
  const [companyMaterialPrices, setCompanyMaterialPrices] = useState<Record<string, CompanyMaterialPrice[]>>({});
  const [showPriceForm, setShowPriceForm] = useState(false);
  const [editingPrice, setEditingPrice] = useState<CompanyMaterialPrice | null>(null);
  const [priceForm, setPriceForm] = useState({
    material_name: "",
    price_per_unit: "",
    unit: materialUnits[0],
    delivery_price: "",
    delivery_option: deliveryOptions[0],
    notes: ""
  });
  const [confirmDeletePrice, setConfirmDeletePrice] = useState<string | null>(null);

  useEffect(() => {
    initializeData();
  }, [projectId]);

  const initializeData = async () => {
    await Promise.all([
      fetchMilestones(),
      fetchFinancials(),
      fetchTenderCompanies(),
      fetchCurrentUser()
    ]);
  };

  const fetchCurrentUser = async () => {
    const user = await getCurrentUser();
    setCurrentUser(user);
  };

  const fetchMilestones = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_milestones")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });
    
    if (!error && data) {
      setMilestones(data);
      const firstThree = new Set(data.slice(0, 3).map(m => m.id));
      setExpandedMilestones(firstThree);
    }
    setLoading(false);
  };

  const fetchFinancials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_financials")
      .select(`
        *,
        tender_company:tender_companies(id, name, contact_email, contact_phone)
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    
    if (!error && data) {
      const grouped = data.reduce((acc, item) => {
        const milestoneId = item.milestone_id || "unassigned";
        if (!acc[milestoneId]) acc[milestoneId] = [];
        acc[milestoneId].push(item);
        return acc;
      }, {} as Record<string, Financial[]>);
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

  // ─── Company Material Prices ───────────────────────────────────────────────

  const fetchCompanyMaterialPrices = async (companyId: string) => {
    const { data, error } = await supabase
      .from("company_material_prices")
      .select("*")
      .eq("company_id", companyId)
      .order("material_name", { ascending: true });
    
    if (!error && data) {
      setCompanyMaterialPrices(prev => ({ ...prev, [companyId]: data }));
    }
    return data || [];
  };

  const handleOpenCompanyPrices = async (companyId: string) => {
    setShowPricesForCompany(companyId);
    await fetchCompanyMaterialPrices(companyId);
  };

  const openPriceForm = (price?: CompanyMaterialPrice) => {
    if (price) {
      setEditingPrice(price);
      setPriceForm({
        material_name: price.material_name,
        price_per_unit: price.price_per_unit.toString(),
        unit: price.unit,
        delivery_price: price.delivery_price.toString(),
        delivery_option: price.delivery_option,
        notes: price.notes || ""
      });
    } else {
      setEditingPrice(null);
      setPriceForm({
        material_name: "",
        price_per_unit: "",
        unit: materialUnits[0],
        delivery_price: "",
        delivery_option: deliveryOptions[0],
        notes: ""
      });
    }
    setShowPriceForm(true);
  };

  const closePriceForm = () => {
    setShowPriceForm(false);
    setEditingPrice(null);
    setPriceForm({
      material_name: "",
      price_per_unit: "",
      unit: materialUnits[0],
      delivery_price: "",
      delivery_option: deliveryOptions[0],
      notes: ""
    });
  };

  const handlePriceFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPriceForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPricesForCompany || !priceForm.material_name.trim()) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("company_material_prices")
      .insert([{
        company_id: showPricesForCompany,
        material_name: priceForm.material_name.trim(),
        price_per_unit: Number(priceForm.price_per_unit) || 0,
        unit: priceForm.unit,
        delivery_price: Number(priceForm.delivery_price) || 0,
        delivery_option: priceForm.delivery_option,
        notes: priceForm.notes
      }])
      .select();

    if (!error && data) {
      setCompanyMaterialPrices(prev => ({
        ...prev,
        [showPricesForCompany]: [...(prev[showPricesForCompany] || []), data[0]]
      }));
      closePriceForm();
      setSuccessMessage("Price added successfully!");
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } else {
      alert("Error adding price: " + error?.message);
    }
    setLoading(false);
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrice || !showPricesForCompany) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("company_material_prices")
      .update({
        material_name: priceForm.material_name.trim(),
        price_per_unit: Number(priceForm.price_per_unit) || 0,
        unit: priceForm.unit,
        delivery_price: Number(priceForm.delivery_price) || 0,
        delivery_option: priceForm.delivery_option,
        notes: priceForm.notes
      })
      .eq("id", editingPrice.id)
      .select();

    if (!error && data) {
      setCompanyMaterialPrices(prev => ({
        ...prev,
        [showPricesForCompany]: (prev[showPricesForCompany] || []).map(p =>
          p.id === editingPrice.id ? data[0] : p
        )
      }));
      closePriceForm();
      setSuccessMessage("Price updated successfully!");
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } else {
      alert("Error updating price: " + error?.message);
    }
    setLoading(false);
  };

  const deletePrice = async (priceId: string) => {
    if (!showPricesForCompany) return;
    setLoading(true);
    const { error } = await supabase
      .from("company_material_prices")
      .delete()
      .eq("id", priceId);

    if (!error) {
      setCompanyMaterialPrices(prev => ({
        ...prev,
        [showPricesForCompany]: (prev[showPricesForCompany] || []).filter(p => p.id !== priceId)
      }));
      setSuccessMessage("Price deleted successfully!");
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } else {
      alert("Error deleting price: " + error.message);
    }
    setLoading(false);
    setConfirmDeletePrice(null);
  };

  // ─── Auto-fill price when company + material name is set ──────────────────

  const autoFillPriceFromCompany = async (companyId: string, materialName: string) => {
    if (!companyId || !materialName.trim()) return;

    const { data } = await supabase
      .from("company_material_prices")
      .select("*")
      .eq("company_id", companyId)
      .ilike("material_name", materialName.trim())
      .maybeSingle();

    if (data) {
      setForm(prev => ({
        ...prev,
        price_per_unit: data.price_per_unit.toString(),
        material_unit: data.unit || prev.material_unit,
        delivery_price: data.delivery_price.toString(),
        delivery_option: data.delivery_option || prev.delivery_option
      }));
    }
  };

  // ─── Form Handlers ─────────────────────────────────────────────────────────

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: value };
      return updated;
    });

    // Auto-fill price when company changes
    if (name === "tender_company_id" && value) {
      await autoFillPriceFromCompany(value, form.material_name);
    }

    // Auto-fill price when material name changes (on blur is better, but onChange also works)
    if (name === "material_name" && form.tender_company_id) {
      await autoFillPriceFromCompany(form.tender_company_id, value);
    }
  };

  const handleMaterialNameBlur = async () => {
    if (form.tender_company_id && form.material_name.trim()) {
      await autoFillPriceFromCompany(form.tender_company_id, form.material_name);
    }
  };

  const calculateTotalPrice = () => {
    const quantity = Number(form.material_quantity) || 0;
    const pricePerUnit = Number(form.price_per_unit) || 0;
    return quantity * pricePerUnit;
  };

  const toggleMilestone = (milestoneId: string) => {
    setExpandedMilestones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(milestoneId)) newSet.delete(milestoneId);
      else newSet.add(milestoneId);
      return newSet;
    });
  };

  const openAddForm = (milestoneId: string) => {
    resetForm();
    setForm(prev => ({ ...prev, milestone_id: milestoneId }));
    setShowFormForMilestone(milestoneId);
    setExpandedMilestones(prev => new Set([...prev, milestoneId]));
  };

  const isAdmin = currentUser?.roles?.some((r: any) => r.role_name === "admin");
  const isQuantitySurveyor = currentUser?.roles?.some((r: any) => 
    ["admin", "surveyor", "manager", "project_manager"].includes(r.role_name)
  );
  const isFinanceTeam = currentUser?.roles?.some((r: any) => 
    ["admin", "finance", "manager", "project_manager"].includes(r.role_name)
  );
  const isClient = currentUser?.roles?.some((r: any) => r.role_name === "client");
  const canEdit = !isClient && (isQuantitySurveyor || isFinanceTeam || isAdmin);
  const canDelete = currentUser?.roles?.some((r: any) => 
    ["admin", "project_manager", "manager"].includes(r.role_name)
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.milestone_id || !form.material_name.trim()) {
      alert("Please fill in all required fields");
      return;
    }
    setLoading(true);
    const totalPrice = calculateTotalPrice();
    const { data, error } = await supabase
      .from("project_financials")
      .insert([{
        project_id: projectId,
        milestone_id: form.milestone_id,
        category: 'Materials',
        stage: 'Procurement',
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
        created_by: currentUser?.profile?.id
      }])
      .select(`*, tender_company:tender_companies(id, name, contact_email, contact_phone)`);
    
    if (!error && data) {
      setFinancials(prev => ({
        ...prev,
        [form.milestone_id]: [...(prev[form.milestone_id] || []), data[0]]
      }));
      resetForm();
      setSuccessMessage("Material added successfully!");
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } else {
      alert("Error adding material: " + error?.message);
    }
    setLoading(false);
  };

  const handleEdit = (milestoneId: string, idx: number) => {
    const items = financials[milestoneId] || [];
    const f = items[idx];
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
    setShowFormForMilestone(milestoneId);
    setExpandedMilestones(prev => new Set([...prev, milestoneId]));
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
      const milestoneId = form.milestone_id;
      const items = financials[milestoneId] || [];
      const updated = [...items];
      updated[editIdx] = data[0];
      setFinancials(prev => ({ ...prev, [milestoneId]: updated }));
      resetForm();
      setSuccessMessage("Material updated successfully!");
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } else {
      alert("Error updating material: " + error?.message);
    }
    setLoading(false);
  };

  const deleteMaterial = async (milestoneId: string, idx: number) => {
    const items = financials[milestoneId] || [];
    const id = items[idx].id;
    setLoading(true);
    try {
      const { error } = await supabase.from("project_financials").delete().eq("id", id);
      if (error) { alert("Error deleting material: " + error.message); return; }
      const { data: checkData } = await supabase.from("project_financials").select("id").eq("id", id).maybeSingle();
      if (checkData) { alert("Failed to delete material. Please check your permissions or contact support."); return; }
      setFinancials(prev => ({ ...prev, [milestoneId]: items.filter((_, i) => i !== idx) }));
      if (editId === id) resetForm();
      setSuccessMessage("Material deleted successfully!");
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (err: any) {
      alert("Unexpected error: " + err.message);
    } finally {
      setLoading(false);
      setConfirmDelete(null);
    }
  };

  const handleDelete = (milestoneId: string, idx: number) => setConfirmDelete({ milestoneId, idx });

  const resetForm = () => {
    setEditIdx(-1);
    setEditId(null);
    setForm({
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
    setShowFormForMilestone(null);
  };

  // ─── Email Templates ───────────────────────────────────────────────────────

  const generateEmailTemplate = (type: EmailModalData['type'], financial: Financial, milestoneName: string) => {
    const company = financial.tender_company;
    const templates = {
      order_request: {
        subject: `Order Request - ${financial.material_name} for ${milestoneName}`,
        body: `Dear ${company?.name || 'Supplier'},\n\nWe would like to request an order for the following materials:\n\nORDER DETAILS:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nMaterial: ${financial.material_name}\nQuantity: ${financial.material_quantity} ${financial.material_unit}\nPrice per Unit: KSH ${financial.price_per_unit.toLocaleString()}\nTotal Amount: KSH ${financial.total_price.toLocaleString()}\n\nDELIVERY INFORMATION:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nExpected Delivery Date: ${financial.expected_delivery_date ? new Date(financial.expected_delivery_date).toLocaleDateString() : 'TBD'}\nDelivery Option: ${financial.delivery_option}\nDelivery Cost: KSH ${financial.delivery_price.toLocaleString()}\n\nPROJECT INFORMATION:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nMilestone: ${milestoneName}\n${financial.remarks ? `Additional Notes: ${financial.remarks}` : ''}\n\nTOTAL ORDER VALUE: KSH ${(financial.total_price + financial.delivery_price).toLocaleString()}\n\nPlease confirm receipt of this order request and provide an estimated delivery timeline.\n\nBest regards,\nProject Finance Team`
      },
      order_approval: {
        subject: `Order ${financial.order_approved ? 'Approved' : 'Rejected'} - ${financial.material_name}`,
        body: `Dear ${company?.name || 'Supplier'},\n\nThis is to inform you that your order has been ${financial.order_approved ? 'APPROVED' : 'REJECTED'}.\n\nORDER REFERENCE:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nMaterial: ${financial.material_name}\nQuantity: ${financial.material_quantity} ${financial.material_unit}\nTotal Amount: KSH ${financial.total_price.toLocaleString()}\nStatus: ${financial.order_approved ? '✓ APPROVED' : '✗ REJECTED'}\n\n${financial.order_approved ? `Please proceed with the order preparation. We will initiate the payment process shortly.\n\nExpected Delivery: ${financial.expected_delivery_date ? new Date(financial.expected_delivery_date).toLocaleDateString() : 'TBD'}\nDelivery Method: ${financial.delivery_option}` : `We regret to inform you that we cannot proceed with this order at this time.`}\n\nBest regards,\nProject Finance Team`
      },
      funds_request: {
        subject: `Funds Request - ${financial.material_name} Payment`,
        body: `Dear Finance Department,\n\nWe are requesting funds for the following approved order:\n\nPAYMENT REQUEST:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSupplier: ${company?.name || 'N/A'}\nMaterial: ${financial.material_name}\nQuantity: ${financial.material_quantity} ${financial.material_unit}\nMaterial Cost: KSH ${financial.total_price.toLocaleString()}\nDelivery Cost: KSH ${financial.delivery_price.toLocaleString()}\n\nTOTAL AMOUNT REQUESTED: KSH ${(financial.total_price + financial.delivery_price).toLocaleString()}\n\nPROJECT DETAILS:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nMilestone: ${milestoneName}\nExpected Delivery: ${financial.expected_delivery_date ? new Date(financial.expected_delivery_date).toLocaleDateString() : 'TBD'}\n\nPlease approve and transfer the funds at your earliest convenience.\n\nBest regards,\nProject Team`
      },
      funds_sent: {
        subject: `Payment Sent - ${financial.material_name}`,
        body: `Dear ${company?.name || 'Supplier'},\n\nThis is to confirm that payment has been sent for your order.\n\nPAYMENT CONFIRMATION:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nMaterial: ${financial.material_name}\nQuantity: ${financial.material_quantity} ${financial.material_unit}\nAmount Sent: KSH ${(financial.total_price + financial.delivery_price).toLocaleString()}\nDate Sent: ${financial.funds_sent_at ? new Date(financial.funds_sent_at).toLocaleDateString() : new Date().toLocaleDateString()}\n\nPlease confirm receipt of payment and proceed with order preparation and delivery.\n\nExpected Delivery Date: ${financial.expected_delivery_date ? new Date(financial.expected_delivery_date).toLocaleDateString() : 'TBD'}\nDelivery Method: ${financial.delivery_option}\n\nThank you for your service.\n\nBest regards,\nProject Finance Team`
      },
      funds_received: {
        subject: `Payment Received Confirmation - ${financial.material_name}`,
        body: `Dear Project Team,\n\nThis is to confirm that we have received payment for the following order:\n\nPAYMENT RECEIVED:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nFrom: ${company?.name || 'Supplier'}\nMaterial: ${financial.material_name}\nQuantity: ${financial.material_quantity} ${financial.material_unit}\nAmount: KSH ${(financial.total_price + financial.delivery_price).toLocaleString()}\nDate Received: ${financial.funds_received_at ? new Date(financial.funds_received_at).toLocaleDateString() : new Date().toLocaleDateString()}\n\nOrder preparation will commence immediately.\n\nBest regards,\n${company?.name || 'Supplier'}`
      },
      goods_paid: {
        subject: `Final Payment Confirmation - ${financial.material_name}`,
        body: `Dear ${company?.name || 'Supplier'},\n\nThis is to confirm that final payment has been processed for the delivered goods.\n\nFINAL PAYMENT DETAILS:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nMaterial: ${financial.material_name}\nQuantity Delivered: ${financial.material_quantity} ${financial.material_unit}\nFinal Amount Paid: KSH ${(financial.total_price + financial.delivery_price).toLocaleString()}\nPayment Date: ${financial.goods_paid_at ? new Date(financial.goods_paid_at).toLocaleDateString() : new Date().toLocaleDateString()}\n\nThank you for your excellent service. This transaction is now complete.\n\nWe look forward to future business opportunities.\n\nBest regards,\nProject Finance Team`
      }
    };
    return templates[type];
  };

  const openEmailModal = (type: EmailModalData['type'], milestoneId: string, idx: number) => {
    const items = financials[milestoneId] || [];
    const financial = items[idx];
    if (!financial.tender_company_id || !financial.tender_company?.contact_email) {
      alert("No email address found for this company. Please update company details.");
      return;
    }
    const milestone = milestones.find(m => m.id === milestoneId);
    const template = generateEmailTemplate(type, financial, milestone?.title || 'Project');
    setEmailModalData({ type, financial, milestoneId, itemIdx: idx });
    setEmailForm({ to: financial.tender_company.contact_email, subject: template.subject, body: template.body });
    setShowEmailModal(true);
  };

  const closeEmailModal = () => {
    setShowEmailModal(false);
    setEmailModalData(null);
    setEmailForm({ to: "", subject: "", body: "" });
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEmailForm(prev => ({ ...prev, [name]: value }));
  };

  const sendEmail = async () => {
    if (!emailModalData) return;
    setSendingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const getSupabaseUrl = () => {
        if (supabase && (supabase as any).supabaseUrl) return (supabase as any).supabaseUrl;
        if (typeof window !== 'undefined' && (window as any).SUPABASE_URL) return (window as any).SUPABASE_URL;
        const envUrl = 
          (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
          (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
          (typeof process !== 'undefined' && process.env?.REACT_APP_SUPABASE_URL);
        if (envUrl) return envUrl;
        return null;
      };
      const supabaseUrl = getSupabaseUrl();
      if (!supabaseUrl) throw new Error('Supabase URL not configured. Please check your environment variables.');
      const response = await fetch(`${supabaseUrl}/functions/v1/send-financial-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          financial_id: emailModalData.financial.id,
          project_id: projectId,
          milestone_id: emailModalData.milestoneId,
          email_type: emailModalData.type,
          email_data: { to: emailForm.to, subject: emailForm.subject, body: emailForm.body }
        })
      });
      if (response.ok) {
        await updateFinancialAfterEmail(emailModalData.type, emailModalData.milestoneId, emailModalData.itemIdx);
        setSuccessMessage("Email sent successfully!");
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 3000);
        closeEmailModal();
        await fetchFinancials();
      } else {
        const error = await response.json();
        alert("Error sending email: " + (error.message || 'Unknown error'));
      }
    } catch (error: any) {
      alert("Error sending email: " + error.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const updateFinancialAfterEmail = async (type: EmailModalData['type'], milestoneId: string, idx: number) => {
    const items = financials[milestoneId] || [];
    const item = items[idx];
    let updateData: any = {};
    switch(type) {
      case 'order_request': updateData = { order_requested: true, order_requested_at: new Date().toISOString(), order_requested_by: currentUser?.profile?.id }; break;
      case 'funds_request': updateData = { funds_requested: true, funds_requested_at: new Date().toISOString(), funds_requested_by: currentUser?.profile?.id }; break;
      case 'funds_sent': updateData = { funds_sent: true, funds_sent_at: new Date().toISOString() }; break;
      case 'funds_received': updateData = { funds_received: true, funds_received_at: new Date().toISOString() }; break;
      case 'goods_paid': updateData = { goods_paid: true, goods_paid_at: new Date().toISOString(), goods_paid_by: currentUser?.profile?.id }; break;
    }
    if (Object.keys(updateData).length > 0) {
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

  const handleToggleOrderApproval = async (milestoneId: string, idx: number, approved: boolean) => {
    if (!isFinanceTeam) { alert("Only finance team can update order approval"); return; }
    const items = financials[milestoneId] || [];
    const item = items[idx];
    if (!item.order_requested) { alert("Order must be requested first"); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("project_financials")
      .update({ order_approved: approved, order_approved_at: approved ? new Date().toISOString() : null })
      .eq("id", item.id)
      .select(`*, tender_company:tender_companies(id, name, contact_email, contact_phone)`);
    if (!error && data) {
      const updated = [...items];
      updated[idx] = data[0];
      setFinancials(prev => ({ ...prev, [milestoneId]: updated }));
      if (approved) openEmailModal('order_approval', milestoneId, idx);
    }
    setLoading(false);
  };

  const handleToggleFundsSent = async (milestoneId: string, idx: number, sent: boolean) => {
    if (!isFinanceTeam) { alert("Only finance team can mark funds as sent"); return; }
    const items = financials[milestoneId] || [];
    const item = items[idx];
    if (!item.funds_requested) { alert("Funds must be requested first"); return; }
    if (sent) { openEmailModal('funds_sent', milestoneId, idx); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("project_financials")
      .update({ funds_sent: sent, funds_sent_at: sent ? new Date().toISOString() : null })
      .eq("id", item.id)
      .select(`*, tender_company:tender_companies(id, name, contact_email, contact_phone)`);
    if (!error && data) {
      const updated = [...items]; updated[idx] = data[0];
      setFinancials(prev => ({ ...prev, [milestoneId]: updated }));
    }
    setLoading(false);
  };

  const handleToggleFundsReceived = async (milestoneId: string, idx: number, received: boolean) => {
    const items = financials[milestoneId] || [];
    const item = items[idx];
    if (!item.funds_sent) { alert("Funds must be sent first"); return; }
    if (received) { openEmailModal('funds_received', milestoneId, idx); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("project_financials")
      .update({ funds_received: received, funds_received_at: received ? new Date().toISOString() : null })
      .eq("id", item.id)
      .select(`*, tender_company:tender_companies(id, name, contact_email, contact_phone)`);
    if (!error && data) {
      const updated = [...items]; updated[idx] = data[0];
      setFinancials(prev => ({ ...prev, [milestoneId]: updated }));
    }
    setLoading(false);
  };

  const handleToggleGoodsPaid = async (milestoneId: string, idx: number, paid: boolean) => {
    if (!isFinanceTeam) { alert("Only finance team can mark goods as paid"); return; }
    const items = financials[milestoneId] || [];
    const item = items[idx];
    if (!item.funds_received) { alert("Funds must be received before marking goods as paid"); return; }
    if (paid) { openEmailModal('goods_paid', milestoneId, idx); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("project_financials")
      .update({ goods_paid: paid, goods_paid_at: paid ? new Date().toISOString() : null, goods_paid_by: paid ? currentUser?.profile?.id : null })
      .eq("id", item.id)
      .select(`*, tender_company:tender_companies(id, name, contact_email, contact_phone)`);
    if (!error && data) {
      const updated = [...items]; updated[idx] = data[0];
      setFinancials(prev => ({ ...prev, [milestoneId]: updated }));
    }
    setLoading(false);
  };

  // ─── Compare Prices (now fetches from DB) ──────────────────────────────────

  const handleViewPrices = async (materialName: string) => {
    setSelectedMaterial(materialName);
    setLoading(true);

    // Fetch real prices from all companies for this material
    const { data, error } = await supabase
      .from("company_material_prices")
      .select(`
        id,
        company_id,
        price_per_unit,
        delivery_price,
        delivery_option,
        unit,
        tender_companies:company_id (name)
      `)
      .ilike("material_name", materialName);

    if (!error && data && data.length > 0) {
      const prices: CompanyPrice[] = data.map((row: any) => ({
        company_id: row.company_id,
        company_name: row.tender_companies?.name || "Unknown",
        price_per_unit: row.price_per_unit,
        delivery_price: row.delivery_price,
        delivery_option: row.delivery_option,
        price_id: row.id
      }));
      setCompanyPrices(prices);
    } else {
      setCompanyPrices([]);
    }

    setShowPriceModal(true);
    setLoading(false);
  };

  // ─── Tender Company CRUD ───────────────────────────────────────────────────

  const openCompanyForm = (company?: TenderCompany) => {
    if (company) {
      setCompanyForm({ id: company.id, name: company.name, contact_email: company.contact_email, contact_phone: company.contact_phone, address: company.address });
      setEditingCompany(true);
    } else {
      setCompanyForm({ id: "", name: "", contact_email: "", contact_phone: "", address: "" });
      setEditingCompany(false);
    }
    setShowCompanyForm(true);
  };

  const closeCompanyForm = () => {
    setShowCompanyForm(false);
    setCompanyForm({ id: "", name: "", contact_email: "", contact_phone: "", address: "" });
    setEditingCompany(false);
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCompanyForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.name.trim()) { alert("Please enter company name"); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("tender_companies")
      .insert([{ name: companyForm.name, contact_email: companyForm.contact_email, contact_phone: companyForm.contact_phone, address: companyForm.address, is_active: true }])
      .select();
    if (!error && data) {
      setTenderCompanies(prev => [...prev, data[0]]);
      closeCompanyForm();
      setSuccessMessage("Company added successfully!");
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } else {
      alert("Error adding company: " + error?.message);
    }
    setLoading(false);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.name.trim()) { alert("Please enter company name"); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("tender_companies")
      .update({ name: companyForm.name, contact_email: companyForm.contact_email, contact_phone: companyForm.contact_phone, address: companyForm.address })
      .eq("id", companyForm.id)
      .select();
    if (!error && data) {
      setTenderCompanies(prev => prev.map(c => c.id === companyForm.id ? data[0] : c));
      closeCompanyForm();
      setSuccessMessage("Company updated successfully!");
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } else {
      alert("Error updating company: " + error?.message);
    }
    setLoading(false);
  };

  const deleteCompany = async (companyId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("tender_companies").update({ is_active: false }).eq("id", companyId).select();
      if (error) { alert("Error deleting company: " + error.message); return; }
      setTenderCompanies(prev => prev.filter(c => c.id !== companyId));
      setSuccessMessage("Company deleted successfully!");
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
      setConfirmDeleteCompany(null);
    }
  };

  const calculateGrandTotals = () => {
    let totalMaterials = 0, totalDelivery = 0, totalPaid = 0, totalItems = 0;
    Object.values(financials).forEach(items => {
      items.forEach(item => {
        totalMaterials += item.total_price;
        totalDelivery += item.delivery_price;
        if (item.goods_paid) totalPaid++;
        totalItems++;
      });
    });
    return { totalMaterials, totalDelivery, grandTotal: totalMaterials + totalDelivery, totalPaid, totalItems };
  };

  const grandTotals = calculateGrandTotals();

  // ─── SQL helper note displayed to user ────────────────────────────────────
  // Required table: company_material_prices
  // CREATE TABLE company_material_prices (
  //   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  //   company_id uuid REFERENCES tender_companies(id) ON DELETE CASCADE,
  //   material_name text NOT NULL,
  //   price_per_unit numeric DEFAULT 0,
  //   unit text DEFAULT 'units',
  //   delivery_price numeric DEFAULT 0,
  //   delivery_option text DEFAULT 'Pickup',
  //   notes text DEFAULT '',
  //   created_at timestamptz DEFAULT now(),
  //   updated_at timestamptz DEFAULT now()
  // );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-background/90 py-8 sm:py-12 md:py-16 flex flex-col"
      >
        <div className="container mx-auto px-2 sm:px-6 flex-1 flex flex-col">

          {/* Tender Companies Button */}
          {(isAdmin || canEdit) && (
            <div className="mb-6 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCompanyModal(true)}
                className="bg-primary text-background font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition flex items-center gap-2 shadow-lg"
                disabled={loading}
              >
                <Building2 className="w-5 h-5" />
                Manage Companies
              </motion.button>
            </div>
          )}

          {/* Milestones and Financials */}
          {milestones.map((milestone) => {
            const milestoneFinancials = financials[milestone.id] || [];
            const showingForm = showFormForMilestone === milestone.id;

            return (
              <div key={milestone.id} className="mb-8 rounded-xl overflow-hidden border border-white/10">
                <button
                  onClick={() => toggleMilestone(milestone.id)}
                  className="w-full flex items-center justify-between p-5 bg-background/60 hover:bg-background/80 transition"
                >
                  <div>
                    <h3 className="text-lg font-bold">{milestone.title}</h3>
                    {milestone.description && (
                      <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                    )}
                  </div>
                  {expandedMilestones.has(milestone.id) ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </button>

                <AnimatePresence>
                  {expandedMilestones.has(milestone.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="p-6">
                        {isQuantitySurveyor && !isClient && (
                          <div className="mb-6">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => { if (showingForm) resetForm(); else openAddForm(milestone.id); }}
                              className="bg-primary text-background font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition flex items-center gap-2"
                              disabled={loading}
                            >
                              {showingForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                              {showingForm ? "Cancel" : "Add Material"}
                            </motion.button>
                          </div>
                        )}

                        <AnimatePresence>
                          {showingForm && isQuantitySurveyor && !isClient && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden mb-8"
                            >
                              <div className="backdrop-blur-2xl bg-background/95 border border-white/20 rounded-2xl shadow-2xl p-6">
                                <h4 className="text-xl font-bold mb-6">
                                  {editIdx === -1 ? "Add New Material" : "Edit Material"}
                                </h4>
                                <form onSubmit={editIdx === -1 ? handleAdd : handleUpdate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div>
                                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Material Name *</label>
                                    <input
                                      name="material_name"
                                      type="text"
                                      value={form.material_name}
                                      onChange={handleChange}
                                      onBlur={handleMaterialNameBlur}
                                      placeholder="e.g., Cement"
                                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50"
                                      required
                                      disabled={loading}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Quantity *</label>
                                    <input
                                      name="material_quantity"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={form.material_quantity}
                                      onChange={handleChange}
                                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                      required
                                      disabled={loading}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Unit *</label>
                                    <select
                                      name="material_unit"
                                      value={form.material_unit}
                                      onChange={handleChange}
                                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                      required
                                      disabled={loading}
                                    >
                                      {materialUnits.map((unit) => (
                                        <option key={unit} value={unit} className="bg-background text-foreground">{unit}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-semibold text-muted-foreground mb-2">
                                      Tender Company
                                      {form.tender_company_id && form.material_name && (
                                        <span className="ml-2 text-xs text-primary font-normal">(price auto-fills from company catalogue)</span>
                                      )}
                                    </label>
                                    <select
                                      name="tender_company_id"
                                      value={form.tender_company_id}
                                      onChange={handleChange}
                                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                      disabled={loading}
                                    >
                                      <option value="">Select Company</option>
                                      {tenderCompanies.map((company) => (
                                        <option key={company.id} value={company.id} className="bg-background text-foreground">{company.name}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Price Per Unit (KSH) *</label>
                                    <input
                                      name="price_per_unit"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={form.price_per_unit}
                                      onChange={handleChange}
                                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                      required
                                      disabled={loading}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Total Price</label>
                                    <div className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl text-base font-bold text-primary">
                                      KSH {calculateTotalPrice().toLocaleString()}
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Expected Delivery Date</label>
                                    <input
                                      name="expected_delivery_date"
                                      type="date"
                                      value={form.expected_delivery_date}
                                      onChange={handleChange}
                                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                      disabled={loading}
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Delivery Option</label>
                                    <select
                                      name="delivery_option"
                                      value={form.delivery_option}
                                      onChange={handleChange}
                                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                      disabled={loading}
                                    >
                                      {deliveryOptions.map((option) => (
                                        <option key={option} value={option} className="bg-background text-foreground">{option}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Delivery Price (KSH)</label>
                                    <input
                                      name="delivery_price"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={form.delivery_price}
                                      onChange={handleChange}
                                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                                      disabled={loading}
                                    />
                                  </div>

                                  <div className="md:col-span-2 lg:col-span-3">
                                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Remarks</label>
                                    <textarea
                                      name="remarks"
                                      value={form.remarks}
                                      onChange={handleChange}
                                      rows={2}
                                      className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground resize-none"
                                      disabled={loading}
                                    />
                                  </div>

                                  <div className="md:col-span-2 lg:col-span-3 flex gap-3 mt-2">
                                    <button
                                      type="submit"
                                      className="bg-primary text-background font-semibold px-8 py-3 rounded-xl hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-2"
                                      disabled={loading}
                                    >
                                      <Save className="w-5 h-5" />
                                      {editIdx === -1 ? "Add Material" : "Update Material"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={resetForm}
                                      className="bg-muted text-foreground font-semibold px-8 py-3 rounded-xl hover:bg-muted/80 transition flex items-center gap-2"
                                      disabled={loading}
                                    >
                                      <X className="w-5 h-5" />
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {milestoneFinancials.length === 0 ? (
                          <div className="text-center py-8 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl">
                            <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground">No materials added for this milestone yet.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="bg-background/60 border-b border-white/10">
                                  <th className="py-3 px-3 text-left font-semibold text-muted-foreground whitespace-nowrap">1. Material</th>
                                  <th className="py-3 px-3 text-left font-semibold text-muted-foreground whitespace-nowrap">2. Qty</th>
                                  <th className="py-3 px-3 text-left font-semibold text-muted-foreground whitespace-nowrap">3. Company</th>
                                  <th className="py-3 px-3 text-right font-semibold text-muted-foreground whitespace-nowrap">4. Price/Unit</th>
                                  <th className="py-3 px-3 text-right font-semibold text-muted-foreground whitespace-nowrap">5. Total</th>
                                  <th className="py-3 px-3 text-left font-semibold text-muted-foreground whitespace-nowrap">6. Exp. Delivery</th>
                                  <th className="py-3 px-3 text-left font-semibold text-muted-foreground whitespace-nowrap">7. Delivery</th>
                                  <th className="py-3 px-3 text-right font-semibold text-muted-foreground whitespace-nowrap">8. Del. Price</th>
                                  <th className="py-3 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">9. Req Order</th>
                                  <th className="py-3 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">10. Order</th>
                                  <th className="py-3 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">11. Req $</th>
                                  <th className="py-3 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">12. Sent $</th>
                                  <th className="py-3 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">13. Rec $</th>
                                  <th className="py-3 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">14. Paid</th>
                                  {(isQuantitySurveyor && !isClient) && <th className="py-3 px-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Actions</th>}
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
                                          <button onClick={() => handleViewPrices(item.material_name)} className="text-primary hover:text-primary/80 text-xs underline text-left">
                                            Compare Prices
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 text-right">KSH {item.price_per_unit.toLocaleString()}</td>
                                    <td className="py-3 px-3 text-right font-bold text-primary">KSH {item.total_price.toLocaleString()}</td>
                                    <td className="py-3 px-3 text-xs">
                                      {item.expected_delivery_date ? new Date(item.expected_delivery_date).toLocaleDateString() : "-"}
                                    </td>
                                    <td className="py-3 px-3 text-xs">{item.delivery_option}</td>
                                    <td className="py-3 px-3 text-right text-xs text-muted-foreground">KSH {item.delivery_price.toLocaleString()}</td>

                                    {/* Column 9: Request Order */}
                                    <td className="py-3 px-3 text-center">
                                      {!item.order_requested ? (
                                        isFinanceTeam && !isClient && item.tender_company_id ? (
                                          <button onClick={() => openEmailModal('order_request', milestone.id, idx)} disabled={loading} className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition disabled:opacity-50" title="Request order via email">
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

                                    {/* Column 10: Order Approval */}
                                    <td className="py-3 px-3 text-center">
                                      {item.order_requested ? (
                                        isFinanceTeam && !isClient ? (
                                          <div className="flex gap-2 justify-center">
                                            <button onClick={() => handleToggleOrderApproval(milestone.id, idx, true)} disabled={loading || item.order_approved === true} className={cn("p-1.5 rounded transition", item.order_approved === true ? "bg-green-500 text-white" : "bg-white/5 hover:bg-green-500/20 disabled:opacity-50")} title="Approve order"><Check className="w-4 h-4" /></button>
                                            <button onClick={() => handleToggleOrderApproval(milestone.id, idx, false)} disabled={loading || item.order_approved === false} className={cn("p-1.5 rounded transition", item.order_approved === false ? "bg-red-500 text-white" : "bg-white/5 hover:bg-red-500/20 disabled:opacity-50")} title="Reject order"><X className="w-4 h-4" /></button>
                                          </div>
                                        ) : (
                                          <span className="text-xs">
                                            {item.order_approved === true && <Check className="w-4 h-4 text-green-600 mx-auto" />}
                                            {item.order_approved === false && <X className="w-4 h-4 text-red-600 mx-auto" />}
                                            {item.order_approved === null && <span className="text-muted-foreground">-</span>}
                                          </span>
                                        )
                                      ) : <span className="text-muted-foreground">-</span>}
                                    </td>

                                    {/* Column 11: Request Funds */}
                                    <td className="py-3 px-3 text-center">
                                      {item.order_approved === true && !item.funds_requested ? (
                                        isFinanceTeam && !isClient ? (
                                          <button onClick={() => openEmailModal('funds_request', milestone.id, idx)} disabled={loading} className="bg-purple-500 text-white p-2 rounded-lg hover:bg-purple-600 transition disabled:opacity-50" title="Request funds via email"><Mail className="w-4 h-4" /></button>
                                        ) : <span className="text-muted-foreground text-xs">-</span>
                                      ) : item.funds_requested ? <Check className="w-4 h-4 text-purple-600 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                                    </td>

                                    {/* Column 12: Funds Sent */}
                                    <td className="py-3 px-3 text-center">
                                      {item.funds_requested ? (
                                        isFinanceTeam && !isClient ? (
                                          <button onClick={() => handleToggleFundsSent(milestone.id, idx, !item.funds_sent)} disabled={loading || item.funds_sent} className={cn("p-1.5 rounded transition", item.funds_sent ? "bg-green-500 text-white" : "bg-white/5 hover:bg-green-500/20 disabled:opacity-50")} title={item.funds_sent ? "Funds sent" : "Mark as sent"}><Check className="w-4 h-4" /></button>
                                        ) : (
                                          <span>{item.funds_sent ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground">-</span>}</span>
                                        )
                                      ) : <span className="text-muted-foreground">-</span>}
                                    </td>

                                    {/* Column 13: Funds Received */}
                                    <td className="py-3 px-3 text-center">
                                      {item.funds_sent ? (
                                        !isClient ? (
                                          <button onClick={() => handleToggleFundsReceived(milestone.id, idx, true)} disabled={loading || item.funds_received} className={cn("p-1.5 rounded transition", item.funds_received ? "bg-green-500 text-white" : "bg-white/5 hover:bg-green-500/20 disabled:opacity-50")} title="Confirm receipt"><Check className="w-4 h-4" /></button>
                                        ) : (
                                          <span>{item.funds_received ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground">-</span>}</span>
                                        )
                                      ) : <span className="text-muted-foreground">-</span>}
                                    </td>

                                    {/* Column 14: Goods Paid */}
                                    <td className="py-3 px-3 text-center">
                                      {item.funds_received ? (
                                        isFinanceTeam && !isClient ? (
                                          <button onClick={() => handleToggleGoodsPaid(milestone.id, idx, true)} disabled={loading || item.goods_paid} className={cn("p-1.5 rounded transition", item.goods_paid ? "bg-green-500 text-white" : "bg-white/5 hover:bg-green-500/20 disabled:opacity-50")} title="Mark as paid"><Check className="w-4 h-4" /></button>
                                        ) : (
                                          <span>{item.goods_paid ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground">-</span>}</span>
                                        )
                                      ) : <span className="text-muted-foreground">-</span>}
                                    </td>

                                    {(isQuantitySurveyor && !isClient) && (
                                      <td className="py-3 px-3">
                                        <div className="flex gap-2 justify-center">
                                          <button onClick={() => handleEdit(milestone.id, idx)} className="bg-accent text-background p-2 rounded-lg hover:bg-accent/90 transition" disabled={loading} title="Edit"><Edit2 className="w-4 h-4" /></button>
                                          {canDelete && (
                                            <button onClick={() => handleDelete(milestone.id, idx)} className="bg-red-500 text-background p-2 rounded-lg hover:bg-red-600 transition" disabled={loading} title="Delete"><Trash2 className="w-4 h-4" /></button>
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

          {/* ─── Email Modal ─────────────────────────────────────────────────── */}
          <AnimatePresence>
            {showEmailModal && emailModalData && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeEmailModal}>
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-background border border-white/20 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"><Mail className="w-5 h-5 text-primary" /></div>
                      <div>
                        <h3 className="text-2xl font-bold">Compose Email</h3>
                        <p className="text-sm text-muted-foreground">{emailModalData.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                      </div>
                    </div>
                    <button onClick={closeEmailModal} className="p-2 hover:bg-white/10 rounded-lg transition"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">To</label>
                      <input name="to" type="email" value={emailForm.to} onChange={handleEmailChange} className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground" required disabled={sendingEmail} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Subject</label>
                      <input name="subject" type="text" value={emailForm.subject} onChange={handleEmailChange} className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground" required disabled={sendingEmail} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Message</label>
                      <textarea name="body" value={emailForm.body} onChange={handleEmailChange} rows={16} className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground resize-none font-mono" required disabled={sendingEmail} />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button onClick={sendEmail} className="flex-1 bg-primary text-background font-semibold px-8 py-3 rounded-xl hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2" disabled={sendingEmail}>
                        {sendingEmail ? <><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"></div>Sending...</> : <><Send className="w-5 h-5" />Send Email</>}
                      </button>
                      <button onClick={closeEmailModal} className="flex-1 bg-muted text-foreground font-semibold px-8 py-3 rounded-xl hover:bg-muted/80 transition flex items-center justify-center gap-2" disabled={sendingEmail}><X className="w-5 h-5" />Cancel</button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Price Comparison Modal (now shows real DB prices) ────────────── */}
          <AnimatePresence>
            {showPriceModal && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPriceModal(false)}>
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-background border border-white/20 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold">Price Comparison: {selectedMaterial}</h3>
                    <button onClick={() => setShowPriceModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="space-y-3">
                    {companyPrices.length === 0 ? (
                      <div className="text-center py-8">
                        <Tag className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                        <p className="text-center text-muted-foreground">No pricing data available for this material.</p>
                        <p className="text-xs text-muted-foreground mt-2">Add prices via Manage Companies → Set Prices.</p>
                      </div>
                    ) : (
                      companyPrices
                        .sort((a, b) => a.price_per_unit - b.price_per_unit)
                        .map((cp, i) => (
                          <div key={cp.company_id} className={cn("flex justify-between items-center p-4 border rounded-xl transition", i === 0 ? "bg-primary/10 border-primary/30" : "bg-white/5 border-white/10 hover:bg-white/10")}>
                            <div className="flex items-center gap-3">
                              <Building2 className={cn("w-5 h-5", i === 0 ? "text-primary" : "text-muted-foreground")} />
                              <div>
                                <span className="font-medium">{cp.company_name}</span>
                                {cp.delivery_option && <div className="text-xs text-muted-foreground">{cp.delivery_option} · Del: KSH {(cp.delivery_price || 0).toLocaleString()}</div>}
                              </div>
                              {i === 0 && <span className="text-xs bg-primary text-background px-2 py-0.5 rounded-full font-semibold ml-2">Lowest</span>}
                            </div>
                            <div className="text-xl font-bold text-primary">KSH {cp.price_per_unit.toLocaleString()}/unit</div>
                          </div>
                        ))
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Delete Material Confirmation ─────────────────────────────────── */}
          <AnimatePresence>
            {confirmDelete && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-background border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center"><AlertCircle className="w-6 h-6 text-red-500" /></div>
                    <div><h2 className="text-xl font-bold text-foreground">Delete Material Entry</h2><p className="text-sm text-muted-foreground">This action cannot be undone</p></div>
                  </div>
                  <p className="mb-6 text-muted-foreground">Are you sure you want to delete <span className="font-semibold text-foreground">{financials[confirmDelete.milestoneId]?.[confirmDelete.idx]?.material_name}</span>?</p>
                  <div className="flex justify-end gap-3">
                    <button className="px-6 py-3 rounded-xl bg-background/60 border border-white/10 text-foreground font-semibold hover:bg-background/80 transition" onClick={() => setConfirmDelete(null)} disabled={loading}>Cancel</button>
                    <button className="px-6 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2" onClick={() => deleteMaterial(confirmDelete.milestoneId, confirmDelete.idx)} disabled={loading}>
                      {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Deleting...</> : <><Trash2 className="w-4 h-4" />Delete</>}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Success Toast ─────────────────────────────────────────────────── */}
          <AnimatePresence>
            {showSuccessToast && (
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-8 right-8 z-50 bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">{successMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Company Management Modal ──────────────────────────────────────── */}
          <AnimatePresence>
            {showCompanyModal && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowCompanyModal(false); setShowPricesForCompany(null); }}>
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-background border border-white/20 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center p-6 border-b border-white/10">
                    <div>
                      <h2 className="text-2xl font-bold flex items-center gap-3"><Building2 className="w-6 h-6 text-primary" />Tender Companies</h2>
                      <p className="text-sm text-muted-foreground mt-1">Manage companies and their material price catalogues</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => openCompanyForm()} className="bg-primary text-background font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition flex items-center gap-2" disabled={loading}>
                        <Plus className="w-5 h-5" />Add Company
                      </motion.button>
                      <button onClick={() => { setShowCompanyModal(false); setShowPricesForCompany(null); }} className="p-2 hover:bg-white/10 rounded-lg transition"><X className="w-5 h-5" /></button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    {tenderCompanies.length === 0 ? (
                      <div className="text-center py-16 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl">
                        <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-lg text-muted-foreground mb-2">No tender companies added yet</p>
                        <p className="text-sm text-muted-foreground">Click "Add Company" to get started</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tenderCompanies.map((company, idx) => (
                          <motion.div key={company.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="border border-white/10 rounded-xl overflow-hidden">
                            {/* Company Row */}
                            <div className="flex items-center justify-between p-4 bg-white/3 hover:bg-white/5 transition">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                  <Building2 className="w-4 h-4 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-foreground">{company.name}</div>
                                  <div className="text-sm text-muted-foreground flex flex-wrap gap-3 mt-0.5">
                                    {company.contact_email && <span>{company.contact_email}</span>}
                                    {company.contact_phone && <span>{company.contact_phone}</span>}
                                    {company.address && <span className="truncate max-w-xs">{company.address}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2 flex-shrink-0 ml-4">
                                <button
                                  onClick={() => {
                                    if (showPricesForCompany === company.id) {
                                      setShowPricesForCompany(null);
                                    } else {
                                      handleOpenCompanyPrices(company.id);
                                    }
                                  }}
                                  className={cn(
                                    "px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5",
                                    showPricesForCompany === company.id
                                      ? "bg-primary text-background"
                                      : "bg-white/10 hover:bg-primary/20 text-foreground"
                                  )}
                                  disabled={loading}
                                  title="Manage material prices"
                                >
                                  <Tag className="w-4 h-4" />
                                  Set Prices
                                  {showPricesForCompany === company.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                                <button onClick={() => openCompanyForm(company)} className="bg-accent text-background p-2 rounded-lg hover:bg-accent/90 transition" disabled={loading} title="Edit"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => setConfirmDeleteCompany(company.id)} className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition" disabled={loading} title="Delete"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </div>

                            {/* ── Inline Price Catalogue Panel ── */}
                            <AnimatePresence>
                              {showPricesForCompany === company.id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25 }}
                                  className="overflow-hidden border-t border-white/10"
                                >
                                  <div className="p-4 bg-background/40">
                                    <div className="flex items-center justify-between mb-4">
                                      <h4 className="font-semibold text-sm flex items-center gap-2">
                                        <List className="w-4 h-4 text-primary" />
                                        Material Price Catalogue
                                        <span className="text-xs text-muted-foreground font-normal">(auto-fills material form when selected)</span>
                                      </h4>
                                      <button
                                        onClick={() => openPriceForm()}
                                        className="bg-primary/20 hover:bg-primary/30 text-primary text-xs font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                                        disabled={loading}
                                      >
                                        <Plus className="w-3 h-3" />
                                        Add Price
                                      </button>
                                    </div>

                                    {/* Price Form */}
                                    <AnimatePresence>
                                      {showPriceForm && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                                          <form onSubmit={editingPrice ? handleUpdatePrice : handleAddPrice} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                                            <div className="col-span-2 md:col-span-1 lg:col-span-1">
                                              <label className="block text-xs font-semibold text-muted-foreground mb-1">Material Name *</label>
                                              <input name="material_name" type="text" value={priceForm.material_name} onChange={handlePriceFormChange} placeholder="e.g., Cement" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition text-foreground placeholder:text-muted-foreground/50" required disabled={loading} />
                                            </div>
                                            <div>
                                              <label className="block text-xs font-semibold text-muted-foreground mb-1">Unit</label>
                                              <select name="unit" value={priceForm.unit} onChange={handlePriceFormChange} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:border-primary/50 text-foreground" disabled={loading}>
                                                {materialUnits.map(u => <option key={u} value={u} className="bg-background">{u}</option>)}
                                              </select>
                                            </div>
                                            <div>
                                              <label className="block text-xs font-semibold text-muted-foreground mb-1">Price/Unit (KSH) *</label>
                                              <input name="price_per_unit" type="number" min="0" step="0.01" value={priceForm.price_per_unit} onChange={handlePriceFormChange} placeholder="0" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition text-foreground" required disabled={loading} />
                                            </div>
                                            <div>
                                              <label className="block text-xs font-semibold text-muted-foreground mb-1">Delivery Option</label>
                                              <select name="delivery_option" value={priceForm.delivery_option} onChange={handlePriceFormChange} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:border-primary/50 text-foreground" disabled={loading}>
                                                {deliveryOptions.map(o => <option key={o} value={o} className="bg-background">{o}</option>)}
                                              </select>
                                            </div>
                                            <div>
                                              <label className="block text-xs font-semibold text-muted-foreground mb-1">Delivery Price (KSH)</label>
                                              <input name="delivery_price" type="number" min="0" step="0.01" value={priceForm.delivery_price} onChange={handlePriceFormChange} placeholder="0" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition text-foreground" disabled={loading} />
                                            </div>
                                            <div className="col-span-2 md:col-span-3 lg:col-span-6 flex gap-2 mt-1">
                                              <button type="submit" className="bg-primary text-background text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition flex items-center gap-1.5 disabled:opacity-50" disabled={loading}>
                                                <Save className="w-3 h-3" />{editingPrice ? "Update" : "Save"}
                                              </button>
                                              <button type="button" onClick={closePriceForm} className="bg-muted text-foreground text-xs font-semibold px-4 py-2 rounded-lg hover:bg-muted/80 transition flex items-center gap-1.5" disabled={loading}>
                                                <X className="w-3 h-3" />Cancel
                                              </button>
                                            </div>
                                          </form>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>

                                    {/* Price List */}
                                    {(companyMaterialPrices[company.id] || []).length === 0 ? (
                                      <div className="text-center py-6 bg-white/3 rounded-xl border border-white/5">
                                        <Tag className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                                        <p className="text-sm text-muted-foreground">No prices set yet.</p>
                                        <p className="text-xs text-muted-foreground mt-1">Click "Add Price" to add material prices for this company.</p>
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="border-b border-white/10">
                                              <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Material</th>
                                              <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Unit</th>
                                              <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Price/Unit (KSH)</th>
                                              <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Delivery</th>
                                              <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Del. Price (KSH)</th>
                                              <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground">Actions</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(companyMaterialPrices[company.id] || []).map((price) => (
                                              <tr key={price.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                                                <td className="py-2 px-3 font-medium">{price.material_name}</td>
                                                <td className="py-2 px-3 text-muted-foreground">{price.unit}</td>
                                                <td className="py-2 px-3 text-right font-bold text-primary">{price.price_per_unit.toLocaleString()}</td>
                                                <td className="py-2 px-3 text-muted-foreground text-xs">{price.delivery_option}</td>
                                                <td className="py-2 px-3 text-right text-muted-foreground">{price.delivery_price.toLocaleString()}</td>
                                                <td className="py-2 px-3">
                                                  <div className="flex gap-1.5 justify-center">
                                                    <button onClick={() => openPriceForm(price)} className="bg-accent/80 text-background p-1.5 rounded-lg hover:bg-accent transition" disabled={loading} title="Edit"><Edit2 className="w-3 h-3" /></button>
                                                    <button onClick={() => setConfirmDeletePrice(price.id)} className="bg-red-500/80 text-white p-1.5 rounded-lg hover:bg-red-500 transition" disabled={loading} title="Delete"><Trash2 className="w-3 h-3" /></button>
                                                  </div>
                                                </td>
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
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t border-white/10 bg-background/60">
                    <p className="text-sm text-muted-foreground text-center">
                      Total: <span className="font-semibold text-foreground">{tenderCompanies.length}</span> {tenderCompanies.length === 1 ? 'company' : 'companies'}
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Company Add/Edit Form Modal ──────────────────────────────────── */}
          <AnimatePresence>
            {showCompanyForm && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={closeCompanyForm}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-background border border-white/20 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold flex items-center gap-3"><Building2 className="w-6 h-6 text-primary" />{editingCompany ? "Edit Company" : "Add New Company"}</h3>
                    <button onClick={closeCompanyForm} className="p-2 hover:bg-white/10 rounded-lg transition"><X className="w-5 h-5" /></button>
                  </div>
                  <form onSubmit={editingCompany ? handleUpdateCompany : handleAddCompany} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Company Name *</label>
                      <input name="name" type="text" value={companyForm.name} onChange={handleCompanyChange} placeholder="e.g., ABC Supplies Ltd" className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50" required disabled={loading} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Contact Email *</label>
                      <input name="contact_email" type="email" value={companyForm.contact_email} onChange={handleCompanyChange} placeholder="contact@company.com" className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50" required disabled={loading} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Contact Phone</label>
                      <input name="contact_phone" type="tel" value={companyForm.contact_phone} onChange={handleCompanyChange} placeholder="+254 123 456 789" className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50" disabled={loading} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Address</label>
                      <textarea name="address" value={companyForm.address} onChange={handleCompanyChange} placeholder="Company address" rows={3} className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50 resize-none" disabled={loading} />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button type="submit" className="flex-1 bg-primary text-background font-semibold px-8 py-3 rounded-xl hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2" disabled={loading}>
                        {loading ? <><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"></div>{editingCompany ? "Updating..." : "Adding..."}</> : <><Save className="w-5 h-5" />{editingCompany ? "Update Company" : "Add Company"}</>}
                      </button>
                      <button type="button" onClick={closeCompanyForm} className="flex-1 bg-muted text-foreground font-semibold px-8 py-3 rounded-xl hover:bg-muted/80 transition flex items-center justify-center gap-2" disabled={loading}><X className="w-5 h-5" />Cancel</button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Company Delete Confirmation ──────────────────────────────────── */}
          <AnimatePresence>
            {confirmDeleteCompany && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDeleteCompany(null)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-background border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center"><AlertCircle className="w-6 h-6 text-red-500" /></div>
                    <div><h2 className="text-xl font-bold text-foreground">Delete Company</h2><p className="text-sm text-muted-foreground">This action cannot be undone</p></div>
                  </div>
                  <p className="mb-6 text-muted-foreground">Are you sure you want to delete <span className="font-semibold text-foreground">{tenderCompanies.find(c => c.id === confirmDeleteCompany)?.name}</span>? This company may be referenced in existing materials.</p>
                  <div className="flex justify-end gap-3">
                    <button className="px-6 py-3 rounded-xl bg-background/60 border border-white/10 text-foreground font-semibold hover:bg-background/80 transition" onClick={() => setConfirmDeleteCompany(null)} disabled={loading}>Cancel</button>
                    <button className="px-6 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2" onClick={() => deleteCompany(confirmDeleteCompany)} disabled={loading}>
                      {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Deleting...</> : <><Trash2 className="w-4 h-4" />Delete</>}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Price Delete Confirmation ─────────────────────────────────────── */}
          <AnimatePresence>
            {confirmDeletePrice && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDeletePrice(null)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-background border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center"><AlertCircle className="w-6 h-6 text-red-500" /></div>
                    <div><h2 className="text-xl font-bold text-foreground">Delete Price Entry</h2><p className="text-sm text-muted-foreground">This action cannot be undone</p></div>
                  </div>
                  <p className="mb-6 text-muted-foreground">Are you sure you want to remove this material price from the catalogue?</p>
                  <div className="flex justify-end gap-3">
                    <button className="px-6 py-3 rounded-xl bg-background/60 border border-white/10 text-foreground font-semibold hover:bg-background/80 transition" onClick={() => setConfirmDeletePrice(null)} disabled={loading}>Cancel</button>
                    <button className="px-6 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2" onClick={() => deletePrice(confirmDeletePrice)} disabled={loading}>
                      {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Deleting...</> : <><Trash2 className="w-4 h-4" />Delete</>}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Financials;