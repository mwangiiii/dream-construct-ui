// src/pages/PoliciesPage.tsx
// CRUD restricted to 'admin' role only. All other non-client roles are read-only.
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import {
  FileText, Plus, Edit2, Trash2, X, AlertCircle,
  ChevronDown, ChevronUp, Eye, EyeOff,
  Building2, Users, ShieldCheck, Lock, Tag, Loader2,
  CheckCircle, XCircle, AlertTriangle, Save, ShieldAlert,
  ScrollText, ChevronRight, Search,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PolicyCategory {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  icon: string;
  sort_order: number;
}

interface Policy {
  id: string;
  category_id: string;
  title: string;
  content: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
}

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_OPTIONS = [
  { value: "FileText",    Icon: FileText    },
  { value: "Building2",   Icon: Building2   },
  { value: "Users",       Icon: Users       },
  { value: "ShieldCheck", Icon: ShieldCheck },
  { value: "Lock",        Icon: Lock        },
  { value: "Tag",         Icon: Tag         },
  { value: "ScrollText",  Icon: ScrollText  },
];

const iconMap: Record<string, React.ElementType> = {
  FileText, Building2, Users, ShieldCheck, Lock, Tag, ScrollText,
};

const CategoryIcon = ({ name, className = "w-5 h-5" }: { name: string; className?: string }) => {
  const Icon = iconMap[name] || FileText;
  return <Icon className={className} />;
};

// ─── Toast ────────────────────────────────────────────────────────────────────

const ToastNotification = ({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) => {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const cfg = {
    success: { icon: <CheckCircle   className="w-4 h-4" />, bg: "bg-green-500/15",  border: "border-green-500/40",  text: "text-green-300"  },
    error:   { icon: <XCircle       className="w-4 h-4" />, bg: "bg-red-500/15",    border: "border-red-500/40",    text: "text-red-300"    },
    warning: { icon: <AlertTriangle className="w-4 h-4" />, bg: "bg-yellow-500/15", border: "border-yellow-500/40", text: "text-yellow-300" },
  }[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 60, y: 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      className={`flex items-center gap-3 min-w-64 max-w-xs backdrop-blur-xl ${cfg.bg} ${cfg.border} ${cfg.text} border rounded-xl shadow-2xl p-3.5 cursor-pointer pointer-events-auto`}
      onClick={() => onDismiss(toast.id)}
    >
      {cfg.icon}
      <p className="font-medium text-sm flex-1">{toast.message}</p>
      <X className="w-3.5 h-3.5 opacity-50" />
    </motion.div>
  );
};

// ─── Modal wrapper ────────────────────────────────────────────────────────────

const Modal = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 8 }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="bg-background border border-border rounded-2xl shadow-2xl w-full"
          onClick={e => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PoliciesPage() {
  const [categories, setCategories] = useState<PolicyCategory[]>([]);
  const [policies, setPolicies]     = useState<Policy[]>([]);
  const [activeTab, setActiveTab]   = useState<string>("");
  const [loading, setLoading]       = useState(true);
  const [isAdmin, setIsAdmin]       = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toasts, setToasts]         = useState<Toast[]>([]);

  // Category modal
  const [catModal, setCatModal]         = useState<"create" | "edit" | null>(null);
  const [catForm, setCatForm]           = useState({ title: "", slug: "", description: "", icon: "FileText" });
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [savingCat, setSavingCat]       = useState(false);

  // Policy modal
  const [expandedPolicy, setExpandedPolicy]       = useState<string | null>(null);
  const [policyModal, setPolicyModal]             = useState<"create" | "edit" | null>(null);
  const [policyForm, setPolicyForm]               = useState({ title: "", content: "", is_active: true });
  const [editingPolicyId, setEditingPolicyId]     = useState<string | null>(null);
  const [deletingPolicyId, setDeletingPolicyId]   = useState<string | null>(null);
  const [savingPolicy, setSavingPolicy]           = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const showToast = (message: string, type: Toast["type"] = "success") =>
    setToasts(p => [...p, { id: Date.now().toString(), message, type }]);

  const dismissToast = (id: string) => setToasts(p => p.filter(t => t.id !== id));

  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  // ── Role check ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsAdmin(data?.role_name === "admin");
    };
    checkRole();
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [catRes, polRes] = await Promise.all([
      supabase.from("policy_categories").select("*").order("sort_order"),
      supabase.from("policies").select("*").order("sort_order"),
    ]);
    if (catRes.error) showToast(catRes.error.message, "error");
    else {
      setCategories(catRes.data || []);
      if (!activeTab && catRes.data?.length) setActiveTab(catRes.data[0].id);
    }
    if (polRes.error) showToast(polRes.error.message, "error");
    else setPolicies(polRes.data || []);
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { fetchData(); }, []);

  // ── Category CRUD ──────────────────────────────────────────────────────────

  const openCreateCat = () => {
    if (!isAdmin) return;
    setCatForm({ title: "", slug: "", description: "", icon: "FileText" });
    setEditingCatId(null);
    setCatModal("create");
  };

  const openEditCat = (cat: PolicyCategory) => {
    if (!isAdmin) return;
    setCatForm({ title: cat.title, slug: cat.slug, description: cat.description || "", icon: cat.icon });
    setEditingCatId(cat.id);
    setCatModal("edit");
  };

  const saveCategory = async () => {
    if (!isAdmin) return showToast("Only admins can manage policies", "error");
    if (!catForm.title.trim()) return showToast("Title is required", "warning");
    setSavingCat(true);
    const slug = catForm.slug || slugify(catForm.title);
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0);

    if (catModal === "create") {
      const { error } = await supabase.from("policy_categories").insert({
        title: catForm.title.trim(), slug,
        description: catForm.description || null,
        icon: catForm.icon, sort_order: maxOrder + 1,
      });
      if (error) showToast(error.message, "error");
      else { showToast("Category created", "success"); setCatModal(null); fetchData(); }
    } else if (editingCatId) {
      const { error } = await supabase.from("policy_categories").update({
        title: catForm.title.trim(), slug,
        description: catForm.description || null,
        icon: catForm.icon,
      }).eq("id", editingCatId);
      if (error) showToast(error.message, "error");
      else { showToast("Category updated", "success"); setCatModal(null); fetchData(); }
    }
    setSavingCat(false);
  };

  const deleteCategory = async (id: string) => {
    if (!isAdmin) return showToast("Only admins can manage policies", "error");
    const { error } = await supabase.from("policy_categories").delete().eq("id", id);
    if (error) showToast(error.message, "error");
    else {
      showToast("Category deleted", "success");
      setDeletingCatId(null);
      if (activeTab === id) setActiveTab(categories.find(c => c.id !== id)?.id || "");
      fetchData();
    }
  };

  // ── Policy CRUD ────────────────────────────────────────────────────────────

  const openCreatePolicy = () => {
    if (!isAdmin) return;
    setPolicyForm({ title: "", content: "", is_active: true });
    setEditingPolicyId(null);
    setPolicyModal("create");
  };

  const openEditPolicy = (pol: Policy) => {
    if (!isAdmin) return;
    setPolicyForm({ title: pol.title, content: pol.content, is_active: pol.is_active });
    setEditingPolicyId(pol.id);
    setPolicyModal("edit");
  };

  const savePolicy = async () => {
    if (!isAdmin) return showToast("Only admins can manage policies", "error");
    if (!policyForm.title.trim()) return showToast("Title is required", "warning");
    if (!policyForm.content.trim()) return showToast("Content is required", "warning");
    setSavingPolicy(true);
    const catPolicies = policies.filter(p => p.category_id === activeTab);
    const maxOrder = catPolicies.reduce((m, p) => Math.max(m, p.sort_order), 0);

    if (policyModal === "create") {
      const { error } = await supabase.from("policies").insert({
        category_id: activeTab,
        title: policyForm.title.trim(),
        content: policyForm.content.trim(),
        is_active: policyForm.is_active,
        sort_order: maxOrder + 1,
      });
      if (error) showToast(error.message, "error");
      else { showToast("Policy created", "success"); setPolicyModal(null); fetchData(); }
    } else if (editingPolicyId) {
      const { error } = await supabase.from("policies").update({
        title: policyForm.title.trim(),
        content: policyForm.content.trim(),
        is_active: policyForm.is_active,
      }).eq("id", editingPolicyId);
      if (error) showToast(error.message, "error");
      else { showToast("Policy updated", "success"); setPolicyModal(null); fetchData(); }
    }
    setSavingPolicy(false);
  };

  const togglePolicyActive = async (pol: Policy) => {
    if (!isAdmin) return showToast("Only admins can manage policies", "error");
    const { error } = await supabase.from("policies").update({ is_active: !pol.is_active }).eq("id", pol.id);
    if (error) showToast(error.message, "error");
    else fetchData();
  };

  const deletePolicy = async (id: string) => {
    if (!isAdmin) return showToast("Only admins can manage policies", "error");
    const { error } = await supabase.from("policies").delete().eq("id", id);
    if (error) showToast(error.message, "error");
    else { showToast("Policy deleted", "success"); setDeletingPolicyId(null); fetchData(); }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeCategory = categories.find(c => c.id === activeTab);
  const activePolicies = policies
    .filter(p => p.category_id === activeTab)
    .filter(p => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.content.toLowerCase().includes(searchQuery.toLowerCase()));

  const totalActive = policies.filter(p => p.is_active).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">

        {/* ── Page Header ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <ScrollText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Company Policies</h1>
              {/* <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? "Manage and publish company-wide policies"
                  : "Official policies — contact an admin to request changes"}
              </p> */}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={openCreateCat}
                className="flex items-center gap-2 bg-primary text-background font-semibold px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New Category
              </motion.button>
            )}
          </div>
        </div>

        {/* ── Stats strip ───────────────────────────────────────────────────── */}
        {!loading && categories.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Categories",      value: categories.length,  color: "text-primary"      },
              { label: "Total Policies",  value: policies.length,    color: "text-foreground"   },
              { label: "Active Policies", value: totalActive,        color: "text-green-400"    },
            ].map(stat => (
              <div key={stat.label} className="glass border border-border rounded-xl px-4 py-3">
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Read-only banner ──────────────────────────────────────────────── */}
        {!isAdmin && !loading && (
          <div className="flex items-center gap-3 px-4 py-3 glass border border-yellow-500/25 rounded-xl text-yellow-400 text-sm">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>Read-only view — only admins can create, edit, or delete policies.</span>
          </div>
        )}

        {/* ── Main content ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-9 h-9 animate-spin text-primary/40" />
          </div>
        ) : categories.length === 0 ? (
          <div className="glass border border-border rounded-2xl text-center py-20">
            <ScrollText className="w-14 h-14 mx-auto mb-4 text-primary/25" />
            <p className="text-lg font-semibold">No policy categories yet</p>
            {isAdmin && (
              <p className="text-sm text-muted-foreground mt-1">Click "New Category" to get started</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">

            {/* ── Left: Category sidebar ──────────────────────────────────── */}
            <div className="glass border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categories</p>
              </div>
              <nav className="p-2 space-y-0.5">
                {categories.map(cat => {
                  const isActive = activeTab === cat.id;
                  const count = policies.filter(p => p.category_id === cat.id).length;
                  return (
                    <div key={cat.id} className="group relative">
                      <button
                        onClick={() => { setActiveTab(cat.id); setSearchQuery(""); setExpandedPolicy(null); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="catActiveBar"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-full"
                          />
                        )}
                        <span className={`w-7 h-7 flex items-center justify-center rounded-md flex-shrink-0 transition-all ${
                          isActive ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground group-hover:bg-white/10"
                        }`}>
                          <CategoryIcon name={cat.icon} className="w-3.5 h-3.5" />
                        </span>
                        <span className="flex-1 text-sm font-medium truncate">{cat.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                          isActive ? "bg-primary/20 text-primary" : "bg-white/8 text-muted-foreground"
                        }`}>
                          {count}
                        </span>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                      </button>

                      {/* Admin inline controls */}
                      {isAdmin && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 z-10 bg-background/80 backdrop-blur-sm rounded-md px-0.5">
                          <button
                            onClick={e => { e.stopPropagation(); openEditCat(cat); }}
                            className="p-1 rounded hover:bg-blue-500/20 text-muted-foreground hover:text-blue-400 transition"
                            title="Edit"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setDeletingCatId(cat.id); }}
                            className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* ── Right: Content panel ────────────────────────────────────── */}
            <AnimatePresence mode="wait">
              {activeCategory && (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  {/* Content header */}
                  <div className="glass border border-border rounded-2xl p-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                          <CategoryIcon name={activeCategory.icon} className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="text-base font-bold">{activeCategory.title}</h2>
                          {activeCategory.description && (
                            <p className="text-sm text-muted-foreground">{activeCategory.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {activePolicies.length} {activePolicies.length === 1 ? "policy" : "policies"}
                            </span>
                            <span className="text-xs text-green-400">
                              {activePolicies.filter(p => p.is_active).length} active
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search policies..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-8 pr-3 py-2 text-sm bg-white/5 border border-border rounded-lg focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition w-44"
                          />
                        </div>
                        {isAdmin && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={openCreatePolicy}
                            className="flex items-center gap-2 bg-primary text-background font-semibold px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition shadow-sm flex-shrink-0"
                          >
                            <Plus className="w-4 h-4" />
                            Add Policy
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Policies list */}
                  {activePolicies.length === 0 ? (
                    <div className="glass border border-border rounded-2xl text-center py-14">
                      <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground font-medium">
                        {searchQuery ? "No policies match your search" : "No policies in this category yet"}
                      </p>
                      {isAdmin && !searchQuery && (
                        <p className="text-xs text-muted-foreground mt-1">Click "Add Policy" to create the first one</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activePolicies.map((pol, idx) => (
                        <motion.div
                          key={pol.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.035 }}
                          className={`glass border rounded-xl overflow-hidden transition-all ${
                            pol.is_active
                              ? "border-border hover:border-border/80"
                              : "border-border/40 opacity-55"
                          }`}
                        >
                          {/* Policy row */}
                          <div className="flex items-center gap-3 px-4 py-3">
                            <button
                              onClick={() => setExpandedPolicy(expandedPolicy === pol.id ? null : pol.id)}
                              className="flex-1 flex items-center gap-3 text-left min-w-0"
                            >
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pol.is_active ? "bg-green-400" : "bg-muted-foreground/40"}`} />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold truncate ${!pol.is_active ? "line-through opacity-50" : ""}`}>
                                  {pol.title}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Updated {new Date(pol.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                </p>
                              </div>
                              {expandedPolicy === pol.id
                                ? <ChevronUp   className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
                                : <ChevronDown className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
                              }
                            </button>

                            {/* Status badge */}
                            {isAdmin && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 border ${
                                pol.is_active
                                  ? "bg-green-500/15 text-green-400 border-green-500/25"
                                  : "bg-muted/30 text-muted-foreground border-border"
                              }`}>
                                {pol.is_active ? "Active" : "Hidden"}
                              </span>
                            )}

                            {/* Admin actions */}
                            {isAdmin && (
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button
                                  onClick={() => togglePolicyActive(pol)}
                                  className="p-1.5 rounded-md hover:bg-white/8 transition text-muted-foreground hover:text-foreground"
                                  title={pol.is_active ? "Hide" : "Show"}
                                >
                                  {pol.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => openEditPolicy(pol)}
                                  className="p-1.5 rounded-md hover:bg-blue-500/15 transition text-muted-foreground hover:text-blue-400"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeletingPolicyId(pol.id)}
                                  className="p-1.5 rounded-md hover:bg-red-500/15 transition text-muted-foreground hover:text-red-400"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Expanded content */}
                          <AnimatePresence>
                            {expandedPolicy === pol.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22 }}
                                className="overflow-hidden"
                              >
                                <div className="px-5 pb-5 pt-3 border-t border-border/50">
                                  <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground leading-relaxed">
                                    {pol.content}
                                  </pre>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Category Modal ─────────────────────────────────────────────────────── */}
      <Modal open={!!catModal && isAdmin} onClose={() => setCatModal(null)}>
        <div className="p-6 max-w-md">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold">{catModal === "create" ? "New Category" : "Edit Category"}</h2>
            <button onClick={() => setCatModal(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Category Name *</label>
              <input
                type="text"
                value={catForm.title}
                onChange={e => setCatForm({ ...catForm, title: e.target.value, slug: slugify(e.target.value) })}
                placeholder="e.g. Health & Safety"
                className="w-full px-3.5 py-2.5 bg-white/5 border border-border rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Slug</label>
              <input
                type="text"
                value={catForm.slug}
                onChange={e => setCatForm({ ...catForm, slug: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white/5 border border-border rounded-xl text-sm text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Description</label>
              <input
                type="text"
                value={catForm.description}
                onChange={e => setCatForm({ ...catForm, description: e.target.value })}
                placeholder="Short description (optional)"
                className="w-full px-3.5 py-2.5 bg-white/5 border border-border rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map(({ value, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setCatForm({ ...catForm, icon: value })}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition border ${
                      catForm.icon === value
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-white/5 border-border text-muted-foreground hover:bg-white/10 hover:text-foreground"
                    }`}
                    title={value}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={saveCategory}
              disabled={savingCat}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-background font-semibold py-2.5 rounded-xl hover:bg-primary/90 transition disabled:opacity-50 text-sm"
            >
              {savingCat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {catModal === "create" ? "Create Category" : "Save Changes"}
            </button>
            <button
              onClick={() => setCatModal(null)}
              className="px-5 py-2.5 rounded-xl bg-white/5 border border-border hover:bg-white/10 transition font-semibold text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Policy Modal ───────────────────────────────────────────────────────── */}
      <Modal open={!!policyModal && isAdmin} onClose={() => setPolicyModal(null)}>
        <div className="p-6 max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold">{policyModal === "create" ? "New Policy" : "Edit Policy"}</h2>
            <button onClick={() => setPolicyModal(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Category: <span className="text-foreground font-medium">{activeCategory?.title}</span>
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Policy Title *</label>
              <input
                type="text"
                value={policyForm.title}
                onChange={e => setPolicyForm({ ...policyForm, title: e.target.value })}
                placeholder="e.g. Remote Work Policy"
                className="w-full px-3.5 py-2.5 bg-white/5 border border-border rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Policy Content *</label>
              <textarea
                value={policyForm.content}
                onChange={e => setPolicyForm({ ...policyForm, content: e.target.value })}
                placeholder="Write the full policy text here..."
                rows={12}
                className="w-full px-3.5 py-2.5 bg-white/5 border border-border rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition text-sm resize-y font-mono"
              />
            </div>
            <div className="flex items-center gap-3 p-3.5 glass border border-border rounded-xl">
              <button
                onClick={() => setPolicyForm({ ...policyForm, is_active: !policyForm.is_active })}
                className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${policyForm.is_active ? "bg-primary" : "bg-white/20"}`}
                style={{ height: "22px", width: "40px" }}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${policyForm.is_active ? "translate-x-[18px]" : "translate-x-0"}`} />
              </button>
              <div>
                <p className="text-sm font-medium">{policyForm.is_active ? "Visible to staff" : "Hidden from staff"}</p>
                <p className="text-xs text-muted-foreground">{policyForm.is_active ? "This policy will appear in the staff view" : "Only admins can see this policy"}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={savePolicy}
              disabled={savingPolicy}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-background font-semibold py-2.5 rounded-xl hover:bg-primary/90 transition disabled:opacity-50 text-sm"
            >
              {savingPolicy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {policyModal === "create" ? "Create Policy" : "Save Changes"}
            </button>
            <button
              onClick={() => setPolicyModal(null)}
              className="px-5 py-2.5 rounded-xl bg-white/5 border border-border hover:bg-white/10 transition font-semibold text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Category Confirm ────────────────────────────────────────────── */}
      <Modal open={!!deletingCatId && isAdmin} onClose={() => setDeletingCatId(null)}>
        <div className="p-6 max-w-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4.5 h-4.5 text-red-500" style={{ width: "18px", height: "18px" }} />
            </div>
            <h2 className="text-base font-bold">Delete Category?</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            This will permanently delete the category and <strong className="text-foreground">all policies inside it</strong>. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => deletingCatId && deleteCategory(deletingCatId)}
              className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white font-semibold py-2.5 rounded-xl hover:bg-red-600 transition text-sm"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button
              onClick={() => setDeletingCatId(null)}
              className="flex-1 py-2.5 rounded-xl bg-white/5 border border-border hover:bg-white/10 transition font-semibold text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Policy Confirm ──────────────────────────────────────────────── */}
      <Modal open={!!deletingPolicyId && isAdmin} onClose={() => setDeletingPolicyId(null)}>
        <div className="p-6 max-w-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4.5 h-4.5 text-red-500" style={{ width: "18px", height: "18px" }} />
            </div>
            <h2 className="text-base font-bold">Delete Policy?</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            This policy will be permanently removed and cannot be recovered.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => deletingPolicyId && deletePolicy(deletingPolicyId)}
              className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white font-semibold py-2.5 rounded-xl hover:bg-red-600 transition text-sm"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button
              onClick={() => setDeletingPolicyId(null)}
              className="flex-1 py-2.5 rounded-xl bg-white/5 border border-border hover:bg-white/10 transition font-semibold text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Toasts ─────────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-[9999] space-y-2.5 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => <ToastNotification key={t.id} toast={t} onDismiss={dismissToast} />)}
        </AnimatePresence>
      </div>
    </>
  );
}
