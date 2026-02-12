import React, { useState, useEffect } from "react";
import { 
  Award, TrendingUp, CheckCircle, Clock, XCircle, Plus, Edit2, Trash2, Save, X, 
  Send, DollarSign, Package, Truck, Building2, AlertCircle, Check, Mail, ChevronDown, ChevronUp
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
  
  // Column 1-2: Materials (Quantity Surveyor only)
  material_name: string;
  material_quantity: number;
  material_unit: string;
  
  // Column 3-5: Tender Companies and Pricing
  tender_company_id: string | null;
  price_per_unit: number;
  total_price: number;
  
  // Column 6-8: Delivery
  expected_delivery_date: string | null;
  delivery_option: string;
  delivery_price: number;
  
  // Column 9-10: Order Request (Finance team only)
  order_requested: boolean;
  order_requested_at: string | null;
  order_requested_by: string | null;
  order_approved: boolean | null;
  order_approved_at: string | null;
  
  // Column 11-13: Funds (Finance team only)
  funds_requested: boolean;
  funds_requested_at: string | null;
  funds_requested_by: string | null;
  funds_sent: boolean;
  funds_sent_at: string | null;
  funds_received: boolean;
  funds_received_at: string | null;
  
  // Column 14: Payment
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
  };
};

type TenderCompany = {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
};

type CompanyPrice = {
  company_id: string;
  company_name: string;
  price_per_unit: number;
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
  // Confirmation modal state
  const [confirmDelete, setConfirmDelete] = useState<{ milestoneId: string; idx: number } | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");
  const [companyPrices, setCompanyPrices] = useState<CompanyPrice[]>([]);

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
      // Auto-expand first 3 milestones
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
        tender_company:tender_companies(id, name)
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    
    if (!error && data) {
      // Group by milestone_id
      const grouped = data.reduce((acc, item) => {
        const milestoneId = item.milestone_id || "unassigned";
        if (!acc[milestoneId]) {
          acc[milestoneId] = [];
        }
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
    
    if (!error && data) {
      setTenderCompanies(data);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const calculateTotalPrice = () => {
    const quantity = Number(form.material_quantity) || 0;
    const pricePerUnit = Number(form.price_per_unit) || 0;
    return quantity * pricePerUnit;
  };

  const toggleMilestone = (milestoneId: string) => {
    setExpandedMilestones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(milestoneId)) {
        newSet.delete(milestoneId);
      } else {
        newSet.add(milestoneId);
      }
      return newSet;
    });
  };

  const openAddForm = (milestoneId: string) => {
    resetForm();
    setForm(prev => ({ ...prev, milestone_id: milestoneId }));
    setShowFormForMilestone(milestoneId);
    // Auto-expand the milestone
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
      .insert([
        {
          project_id: projectId,
          milestone_id: form.milestone_id,
          
          // Add these required fields
          category: 'Materials',           // NEW
          stage: 'Procurement',            // NEW
          
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
        },
      ])
      .select(`
        *,
        tender_company:tender_companies(id, name)
      `);
    
    if (!error && data) {
      setFinancials(prev => ({
        ...prev,
        [form.milestone_id]: [...(prev[form.milestone_id] || []), data[0]]
      }));
      resetForm();
      alert("Material added successfully!");
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
      .select(`
        *,
        tender_company:tender_companies(id, name)
      `);
      
    if (!error && data) {
      // Update local state
      const milestoneId = form.milestone_id;
      const items = financials[milestoneId] || [];
      const updated = [...items];
      updated[editIdx] = data[0];
      
      setFinancials(prev => ({
        ...prev,
        [milestoneId]: updated
      }));
      
      resetForm();
      alert("Material updated successfully!");
    } else {
      alert("Error updating material: " + error?.message);
    }
    setLoading(false);
  };

  const deleteMaterial = async (milestoneId: string, idx: number) => {
    const items = financials[milestoneId] || [];
    const itemToDelete = items[idx];
    const id = itemToDelete.id;
    
    console.log("Attempting to delete material with ID:", id);
    console.log("Material details:", itemToDelete);
    
    setLoading(true);
    
    try {
      // First, verify the record exists
      const { data: existingData, error: checkError } = await supabase
        .from("project_financials")
        .select("*")
        .eq("id", id)
        .single();
      
      if (checkError || !existingData) {
        console.error("Record not found in database:", checkError);
        alert("Material record not found in database. It may have been deleted already.");
        // Remove from local state anyway
        setFinancials(prev => ({
          ...prev,
          [milestoneId]: items.filter((_, i) => i !== idx)
        }));
        setLoading(false);
        setConfirmDelete(null);
        return;
      }
      
      console.log("Found existing record:", existingData);
      
      // Now delete it
      const { error, data } = await supabase
        .from("project_financials")
        .delete()
        .eq("id", id)
        .select();
      
      if (error) {
        console.error("Delete error:", error);
        alert("Error deleting material: " + error.message);
        setLoading(false);
        setConfirmDelete(null);
        return;
      }
      
      console.log("Delete response data:", data);
      
      // Check if something was actually deleted
      if (!data || data.length === 0) {
        console.warn("No rows returned from delete operation");
        alert("Delete operation completed but no confirmation received. Refreshing data...");
        await fetchFinancials(); // Refresh from database
        setLoading(false);
        setConfirmDelete(null);
        return;
      }
      
      // Successfully deleted - update local state
      setFinancials(prev => ({
        ...prev,
        [milestoneId]: items.filter((_, i) => i !== idx)
      }));
      
      // Clear edit form if we're editing the deleted item
      if (editId === id) {
        resetForm();
      }
      
      alert("Material deleted successfully!");
      
    } catch (err: any) {
      console.error("Unexpected error during deletion:", err);
      alert("Unexpected error: " + err.message);
    } finally {
      setLoading(false);
      setConfirmDelete(null);
    }
  };

  const handleDelete = (milestoneId: string, idx: number) => {
    setConfirmDelete({ milestoneId, idx });
  };

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

  const handleRequestOrder = async (milestoneId: string, idx: number) => {
    if (!isFinanceTeam) {
      alert("Only finance team can request orders");
      return;
    }

    const items = financials[milestoneId] || [];
    const item = items[idx];
    
    if (!item.tender_company_id) {
      alert("Please select a tender company first");
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/request-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          financial_id: item.id,
          project_id: projectId,
          milestone_id: milestoneId
        })
      });

      if (response.ok) {
        await fetchFinancials();
        alert("Order request sent successfully!");
      } else {
        const error = await response.json();
        alert("Error requesting order: " + error.message);
      }
    } catch (error: any) {
      alert("Error requesting order: " + error.message);
    }
    
    setLoading(false);
  };

  const handleToggleOrderApproval = async (milestoneId: string, idx: number, approved: boolean) => {
    if (!isFinanceTeam) {
      alert("Only finance team can update order approval");
      return;
    }

    const items = financials[milestoneId] || [];
    const item = items[idx];
    
    if (!item.order_requested) {
      alert("Order must be requested first");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("project_financials")
      .update({
        order_approved: approved,
        order_approved_at: approved ? new Date().toISOString() : null
      })
      .eq("id", item.id)
      .select(`*, tender_company:tender_companies(id, name)`);

    if (!error && data) {
      const updated = [...items];
      updated[idx] = data[0];
      setFinancials(prev => ({
        ...prev,
        [milestoneId]: updated
      }));
    }
    setLoading(false);
  };

  const handleRequestFunds = async (milestoneId: string, idx: number) => {
    if (!isFinanceTeam) {
      alert("Only finance team can request funds");
      return;
    }

    const items = financials[milestoneId] || [];
    const item = items[idx];
    
    if (!item.order_approved) {
      alert("Order must be approved before requesting funds");
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/request-funds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          financial_id: item.id,
          project_id: projectId,
          milestone_id: milestoneId
        })
      });

      if (response.ok) {
        await fetchFinancials();
        alert("Funds request sent successfully!");
      } else {
        const error = await response.json();
        alert("Error requesting funds: " + error.message);
      }
    } catch (error: any) {
      alert("Error requesting funds: " + error.message);
    }
    
    setLoading(false);
  };

  const handleToggleFundsSent = async (milestoneId: string, idx: number, sent: boolean) => {
    if (!isFinanceTeam) {
      alert("Only finance team can mark funds as sent");
      return;
    }

    const items = financials[milestoneId] || [];
    const item = items[idx];
    
    if (!item.funds_requested) {
      alert("Funds must be requested first");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("project_financials")
      .update({
        funds_sent: sent,
        funds_sent_at: sent ? new Date().toISOString() : null
      })
      .eq("id", item.id)
      .select(`*, tender_company:tender_companies(id, name)`);

    if (!error && data) {
      const updated = [...items];
      updated[idx] = data[0];
      setFinancials(prev => ({
        ...prev,
        [milestoneId]: updated
      }));
    }
    setLoading(false);
  };

  const handleToggleFundsReceived = async (milestoneId: string, idx: number, received: boolean) => {
    const items = financials[milestoneId] || [];
    const item = items[idx];
    
    if (!item.funds_sent) {
      alert("Funds must be sent first");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("project_financials")
      .update({
        funds_received: received,
        funds_received_at: received ? new Date().toISOString() : null
      })
      .eq("id", item.id)
      .select(`*, tender_company:tender_companies(id, name)`);

    if (!error && data) {
      const updated = [...items];
      updated[idx] = data[0];
      setFinancials(prev => ({
        ...prev,
        [milestoneId]: updated
      }));
    }
    setLoading(false);
  };

  const handleToggleGoodsPaid = async (milestoneId: string, idx: number, paid: boolean) => {
    if (!isFinanceTeam) {
      alert("Only finance team can mark goods as paid");
      return;
    }

    const items = financials[milestoneId] || [];
    const item = items[idx];
    
    if (!item.funds_received) {
      alert("Funds must be received before marking goods as paid");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("project_financials")
      .update({
        goods_paid: paid,
        goods_paid_at: paid ? new Date().toISOString() : null,
        goods_paid_by: paid ? currentUser?.profile?.id : null
      })
      .eq("id", item.id)
      .select(`*, tender_company:tender_companies(id, name)`);

    if (!error && data) {
      const updated = [...items];
      updated[idx] = data[0];
      setFinancials(prev => ({
        ...prev,
        [milestoneId]: updated
      }));
    }
    setLoading(false);
  };

  const handleViewPrices = async (materialName: string) => {
    setSelectedMaterial(materialName);
    setLoading(true);
    
    // Mock prices - In production, fetch from materials_pricing table
    const mockPrices: CompanyPrice[] = tenderCompanies.map(company => ({
      company_id: company.id,
      company_name: company.name,
      price_per_unit: Math.floor(Math.random() * 1000) + 100
    }));
    
    setCompanyPrices(mockPrices);
    setShowPriceModal(true);
    setLoading(false);
  };

  const calculateMilestoneTotals = (milestoneId: string) => {
    const items = financials[milestoneId] || [];
    const materialsCost = items.reduce((sum, f) => sum + f.total_price, 0);
    const deliveryCost = items.reduce((sum, f) => sum + f.delivery_price, 0);
    return { materialsCost, deliveryCost, total: materialsCost + deliveryCost };
  };

  const calculateGrandTotals = () => {
    let totalMaterials = 0;
    let totalDelivery = 0;
    let totalPaid = 0;
    let totalItems = 0;
    
    Object.values(financials).forEach(items => {
      items.forEach(item => {
        totalMaterials += item.total_price;
        totalDelivery += item.delivery_price;
        if (item.goods_paid) totalPaid++;
        totalItems++;
      });
    });
    
    return {
      totalMaterials,
      totalDelivery,
      grandTotal: totalMaterials + totalDelivery,
      totalPaid,
      totalItems
    };
  };

  const grandTotals = calculateGrandTotals();

  const summaryStats = [
    { icon: Package, value: `KES ${grandTotals.totalMaterials.toLocaleString()}`, label: "Materials Cost" },
    { icon: Truck, value: `KES ${grandTotals.totalDelivery.toLocaleString()}`, label: "Delivery Cost" },
    { icon: DollarSign, value: `KES ${grandTotals.grandTotal.toLocaleString()}`, label: "Total Cost" },
    { icon: CheckCircle, value: `${grandTotals.totalPaid} / ${grandTotals.totalItems}`, label: "Goods Paid" },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-background/90 py-8 sm:py-12 md:py-16 flex flex-col"
      >
        <div className="container mx-auto px-2 sm:px-6 flex-1 flex flex-col">
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
                              onClick={() => {
                                if (showingForm) {
                                  resetForm();
                                } else {
                                  openAddForm(milestone.id);
                                }
                              }}
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
                                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Tender Company</label>
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
                                      {item.remarks && (
                                        <div className="text-xs text-muted-foreground">{item.remarks}</div>
                                      )}
                                    </td>
                                    
                                    <td className="py-3 px-3 whitespace-nowrap">{item.material_quantity} {item.material_unit}</td>
                                    
                                    <td className="py-3 px-3">
                                      <div className="flex flex-col gap-1">
                                        <span>{item.tender_company?.name || "-"}</span>
                                        {item.material_name && (
                                          <button
                                            onClick={() => handleViewPrices(item.material_name)}
                                            className="text-primary hover:text-primary/80 text-xs underline text-left"
                                          >
                                            Compare Prices
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    
                                    <td className="py-3 px-3 text-right">KSH {item.price_per_unit.toLocaleString()}</td>
                                    
                                    <td className="py-3 px-3 text-right font-bold text-primary">KSH {item.total_price.toLocaleString()}</td>
                                    
                                    <td className="py-3 px-3 text-xs">
                                      {item.expected_delivery_date 
                                        ? new Date(item.expected_delivery_date).toLocaleDateString()
                                        : "-"
                                      }
                                    </td>
                                    
                                    <td className="py-3 px-3 text-xs">{item.delivery_option}</td>
                                    
                                    <td className="py-3 px-3 text-right text-xs text-muted-foreground">
                                      KSH {item.delivery_price.toLocaleString()}
                                    </td>
                                    
                                    <td className="py-3 px-3 text-center">
                                      {!item.order_requested ? (
                                        isFinanceTeam && !isClient ? (
                                          <button
                                            onClick={() => handleRequestOrder(milestone.id, idx)}
                                            disabled={loading}
                                            className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Request order"
                                          >
                                            <Mail className="w-4 h-4" />
                                          </button>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">-</span>
                                        )
                                      ) : (
                                        <div className="flex items-center justify-center gap-1">
                                          <Check className="w-4 h-4 text-green-600" />
                                          <span className="text-xs text-muted-foreground">
                                            {item.order_requested_at && new Date(item.order_requested_at).toLocaleDateString()}
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                    
                                    <td className="py-3 px-3 text-center">
                                      {item.order_requested ? (
                                        isFinanceTeam && !isClient ? (
                                          <div className="flex gap-2 justify-center">
                                            <button
                                              onClick={() => handleToggleOrderApproval(milestone.id, idx, true)}
                                              disabled={loading || item.order_approved === true}
                                              className={cn(
                                                "p-1.5 rounded transition",
                                                item.order_approved === true 
                                                  ? "bg-green-500 text-white" 
                                                  : "bg-white/5 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                              )}
                                              title="Approve order"
                                            >
                                              <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() => handleToggleOrderApproval(milestone.id, idx, false)}
                                              disabled={loading || item.order_approved === false}
                                              className={cn(
                                                "p-1.5 rounded transition",
                                                item.order_approved === false 
                                                  ? "bg-red-500 text-white" 
                                                  : "bg-white/5 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                              )}
                                              title="Reject order"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="text-xs">
                                            {item.order_approved === true && <Check className="w-4 h-4 text-green-600 mx-auto" />}
                                            {item.order_approved === false && <X className="w-4 h-4 text-red-600 mx-auto" />}
                                            {item.order_approved === null && <span className="text-muted-foreground">-</span>}
                                          </span>
                                        )
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </td>
                                    
                                    <td className="py-3 px-3 text-center">
                                      {item.order_approved === true && !item.funds_requested ? (
                                        isFinanceTeam && !isClient ? (
                                          <button
                                            onClick={() => handleRequestFunds(milestone.id, idx)}
                                            disabled={loading}
                                            className="bg-purple-500 text-white p-2 rounded-lg hover:bg-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Request funds"
                                          >
                                            <Mail className="w-4 h-4" />
                                          </button>
                                        ) : (
                                          <span className="text-muted-foreground text-xs">-</span>
                                        )
                                      ) : item.funds_requested ? (
                                        <Check className="w-4 h-4 text-purple-600 mx-auto" />
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </td>
                                    
                                    <td className="py-3 px-3 text-center">
                                      {item.funds_requested ? (
                                        isFinanceTeam && !isClient ? (
                                          <button
                                            onClick={() => handleToggleFundsSent(milestone.id, idx, !item.funds_sent)}
                                            disabled={loading}
                                            className={cn(
                                              "p-1.5 rounded transition",
                                              item.funds_sent 
                                                ? "bg-green-500 text-white" 
                                                : "bg-white/5 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                            )}
                                            title={item.funds_sent ? "Funds sent" : "Mark as sent"}
                                          >
                                            <Check className="w-4 h-4" />
                                          </button>
                                        ) : (
                                          <span>
                                            {item.funds_sent ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                                          </span>
                                        )
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </td>
                                    
                                    <td className="py-3 px-3 text-center">
                                      {item.funds_sent ? (
                                        !isClient ? (
                                          <div className="flex gap-2 justify-center">
                                            <button
                                              onClick={() => handleToggleFundsReceived(milestone.id, idx, true)}
                                              disabled={loading || item.funds_received}
                                              className={cn(
                                                "p-1.5 rounded transition",
                                                item.funds_received 
                                                  ? "bg-green-500 text-white" 
                                                  : "bg-white/5 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                              )}
                                              title="Confirm receipt"
                                            >
                                              <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() => handleToggleFundsReceived(milestone.id, idx, false)}
                                              disabled={loading || !item.funds_received}
                                              className={cn(
                                                "p-1.5 rounded transition",
                                                !item.funds_received && item.funds_sent
                                                  ? "bg-white/5 hover:bg-red-500/20" 
                                                  : "bg-white/5 opacity-50 cursor-not-allowed"
                                              )}
                                              title="Not received"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ) : (
                                          <span>
                                            {item.funds_received ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                                          </span>
                                        )
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </td>
                                    
                                    <td className="py-3 px-3 text-center">
                                      {item.funds_received ? (
                                        isFinanceTeam && !isClient ? (
                                          <div className="flex gap-2 justify-center">
                                            <button
                                              onClick={() => handleToggleGoodsPaid(milestone.id, idx, true)}
                                              disabled={loading || item.goods_paid}
                                              className={cn(
                                                "p-1.5 rounded transition",
                                                item.goods_paid 
                                                  ? "bg-green-500 text-white" 
                                                  : "bg-white/5 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                              )}
                                              title="Mark as paid"
                                            >
                                              <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() => handleToggleGoodsPaid(milestone.id, idx, false)}
                                              disabled={loading || !item.goods_paid}
                                              className={cn(
                                                "p-1.5 rounded transition",
                                                "bg-white/5 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                              )}
                                              title="Mark as unpaid"
                                            >
                                              <X className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ) : (
                                          <span>
                                            {item.goods_paid ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                                          </span>
                                        )
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </td>
                                    
                                    {(isQuantitySurveyor && !isClient) && (
                                      <td className="py-3 px-3">
                                        <div className="flex gap-2 justify-center">
                                          <button
                                            onClick={() => handleEdit(milestone.id, idx)}
                                            className="bg-accent text-background p-2 rounded-lg hover:bg-accent/90 transition"
                                            disabled={loading}
                                            title="Edit"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => handleDelete(milestone.id, idx)}
                                            className="bg-red-500 text-background p-2 rounded-lg hover:bg-red-600 transition"
                                            disabled={loading}
                                            title="Delete"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
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

          {/* Price Comparison Modal */}
          <AnimatePresence>
            {showPriceModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={() => setShowPriceModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.9 }}
                  className="bg-background border border-white/20 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold">Price Comparison: {selectedMaterial}</h3>
                    <button 
                      onClick={() => setShowPriceModal(false)} 
                      className="p-2 hover:bg-white/10 rounded-lg transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {companyPrices.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No pricing data available</p>
                    ) : (
                      companyPrices.map((cp) => (
                        <div key={cp.company_id} className="flex justify-between items-center p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition">
                          <div className="flex items-center gap-3">
                            <Building2 className="w-5 h-5 text-primary" />
                            <span className="font-medium">{cp.company_name}</span>
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

          {/* Confirmation Modal for Delete */}
          {confirmDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-2 text-primary">Delete Material Entry</h2>
                <p className="mb-4 text-muted-foreground">Are you sure you want to delete this material entry? This action cannot be undone.</p>
                <div className="flex justify-end gap-3">
                  <button
                    className="px-4 py-2 rounded bg-muted-foreground text-white hover:bg-muted transition"
                    onClick={() => setConfirmDelete(null)}
                    disabled={loading}
                  >Cancel</button>
                  <button
                    className="px-4 py-2 rounded bg-destructive text-white hover:bg-destructive/80 transition"
                    onClick={() => deleteMaterial(confirmDelete.milestoneId, confirmDelete.idx)}
                    disabled={loading}
                  >Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Financials;