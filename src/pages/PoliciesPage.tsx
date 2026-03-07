// src/pages/admin/PoliciesPage.tsx
// CRUD restricted to 'admin' role only. All other non-client roles are read-only.
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import {
  FileText, Plus, Edit2, Trash2, X, AlertCircle,
  ChevronDown, ChevronUp, GripVertical, Eye, EyeOff,
  Building2, Users, ShieldCheck, Lock, Tag, Loader2,
  CheckCircle, XCircle, AlertTriangle, Save, ShieldAlert,
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
];

const iconMap: Record<string, React.ElementType> = {
  FileText, Building2, Users, ShieldCheck, Lock, Tag,
};

const CategoryIcon = ({ name, className = "w-5 h-5" }: { name: string; className?: string }) => {
  const Icon = iconMap[name] || FileText;
  return <Icon className={className} />;
};

// ─── Toast ────────────────────────────────────────────────────────────────────

const ToastNotification = ({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) => {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const cfg = {
    success: { icon: <CheckCircle  className="w-5 h-5" />, bg: "bg-green-500/20",  border: "border-green-500/50",  text: "text-green-200"  },
    error:   { icon: <XCircle      className="w-5 h-5" />, bg: "bg-red-500/20",    border: "border-red-500/50",    text: "text-red-200"    },
    warning: { icon: <AlertTriangle className="w-5 h-5" />, bg: "bg-yellow-500/20", border: "border-yellow-500/50", text: "text-yellow-200" },
  }[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className={`flex items-center gap-3 min-w-72 max-w-sm backdrop-blur-xl ${cfg.bg} ${cfg.border} ${cfg.text} border rounded-xl shadow-2xl p-4 cursor-pointer pointer-events-auto`}
      onClick={() => onDismiss(toast.id)}
    >
      {cfg.icon}
      <p className="font-medium text-sm flex-1">{toast.message}</p>
      <X className="w-4 h-4 opacity-60" />
    </motion.div>
  );
};

// ─── Glass Card ───────────────────────────────────────────────────────────────

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 ${className}`}>
    {children}
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PoliciesPage() {
  const [categories, setCategories]   = useState<PolicyCategory[]>([]);
  const [policies, setPolicies]       = useState<Policy[]>([]);
  const [activeTab, setActiveTab]     = useState<string>("");
  const [loading, setLoading]         = useState(true);
  const [isAdmin, setIsAdmin]         = useState(false);   // ← key flag
  const [toasts, setToasts]           = useState<Toast[]>([]);

  // Category modal state
  const [catModal, setCatModal]           = useState<"create" | "edit" | null>(null);
  const [catForm, setCatForm]             = useState({ title: "", slug: "", description: "", icon: "FileText" });
  const [editingCatId, setEditingCatId]   = useState<string | null>(null);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [savingCat, setSavingCat]         = useState(false);

  // Policy state
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

  // ── Check current user role ────────────────────────────────────────────────

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role_name")
        .eq("user_id", user.id)
        .single();
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

  // ── Category CRUD (admin only) ─────────────────────────────────────────────

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
      else { showToast("Tab created!", "success"); setCatModal(null); fetchData(); }
    } else if (editingCatId) {
      const { error } = await supabase.from("policy_categories").update({
        title: catForm.title.trim(), slug,
        description: catForm.description || null,
        icon: catForm.icon,
      }).eq("id", editingCatId);
      if (error) showToast(error.message, "error");
      else { showToast("Tab updated!", "success"); setCatModal(null); fetchData(); }
    }
    setSavingCat(false);
  };

  const deleteCategory = async (id: string) => {
    if (!isAdmin) return showToast("Only admins can manage policies", "error");
    const { error } = await supabase.from("policy_categories").delete().eq("id", id);
    if (error) showToast(error.message, "error");
    else {
      showToast("Tab deleted", "success");
      setDeletingCatId(null);
      if (activeTab === id) setActiveTab(categories.find(c => c.id !== id)?.id || "");
      fetchData();
    }
  };

  // ── Policy CRUD (admin only) ───────────────────────────────────────────────

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
      else { showToast("Policy created!", "success"); setPolicyModal(null); fetchData(); }
    } else if (editingPolicyId) {
      const { error } = await supabase.from("policies").update({
        title: policyForm.title.trim(),
        content: policyForm.content.trim(),
        is_active: policyForm.is_active,
      }).eq("id", editingPolicyId);
      if (error) showToast(error.message, "error");
      else { showToast("Policy updated!", "success"); setPolicyModal(null); fetchData(); }
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

  const activeCategory  = categories.find(c => c.id === activeTab);
  const activePolicies  = policies.filter(p => p.category_id === activeTab);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Policies</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin
                ? "Manage company policies visible to all staff"
                : "View company policies — contact an admin to make changes"}
            </p>
          </div>
          {/* Only admins see the New Tab button */}
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openCreateCat}
              className="flex items-center gap-2 bg-primary text-background font-semibold px-5 py-2.5 rounded-xl hover:bg-primary/90 transition"
            >
              <Plus className="w-4 h-4" />
              New Tab
            </motion.button>
          )}
        </div>

        {/* Read-only banner for non-admins */}
        {!isAdmin && !loading && (
          <div className="flex items-center gap-3 px-4 py-3 backdrop-blur-xl bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-300 text-sm">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>You have read-only access. Only admins can create, edit, or delete policies.</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-10 h-10 animate-spin text-primary/50" />
          </div>
        ) : categories.length === 0 ? (
          <GlassCard className="text-center py-20">
            <FileText className="w-16 h-16 mx-auto mb-4 text-primary/30" />
            <p className="text-xl text-muted-foreground mb-2">No policy tabs yet</p>
            {isAdmin && (
              <p className="text-sm text-muted-foreground">Click "New Tab" to create your first policy category</p>
            )}
          </GlassCard>
        ) : (
          <>
            {/* Floating Tab Bar */}
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <div key={cat.id} className="relative group">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setActiveTab(cat.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all border ${
                      activeTab === cat.id
                        ? "bg-primary text-background border-primary shadow-lg shadow-primary/20"
                        : "backdrop-blur-xl bg-white/10 border-white/20 text-foreground hover:bg-white/20"
                    }`}
                  >
                    <CategoryIcon name={cat.icon} className="w-4 h-4" />
                    {cat.title}
                  </motion.button>

                  {/* Tab quick-edit buttons — admin only */}
                  {isAdmin && (
                    <div className="absolute -top-2 -right-2 hidden group-hover:flex items-center gap-1 z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditCat(cat); }}
                        className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-400 transition"
                        title="Edit tab"
                      >
                        <Edit2 className="w-2.5 h-2.5 text-white" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingCatId(cat.id); }}
                        className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400 transition"
                        title="Delete tab"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Active Category Content */}
            <AnimatePresence mode="wait">
              {activeCategory && (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {/* Category header */}
                  <GlassCard className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <CategoryIcon name={activeCategory.icon} className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">{activeCategory.title}</h2>
                        {activeCategory.description && (
                          <p className="text-sm text-muted-foreground">{activeCategory.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {activePolicies.length} {activePolicies.length === 1 ? "policy" : "policies"} •{" "}
                          {activePolicies.filter(p => p.is_active).length} active
                        </p>
                      </div>
                    </div>

                    {/* Admin-only action buttons */}
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => openEditCat(activeCategory)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl backdrop-blur-xl bg-white/10 border border-white/20 hover:bg-white/20 transition text-sm font-semibold"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit Tab
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={openCreatePolicy}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-background hover:bg-primary/90 transition text-sm font-semibold"
                        >
                          <Plus className="w-4 h-4" />
                          Add Policy
                        </motion.button>
                      </div>
                    )}
                  </GlassCard>

                  {/* Policies list */}
                  {activePolicies.length === 0 ? (
                    <div className="text-center py-16 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                      <p className="text-muted-foreground">No policies in this tab yet</p>
                      {isAdmin && (
                        <p className="text-sm text-muted-foreground mt-1">Click "Add Policy" to get started</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activePolicies.map((pol, idx) => (
                        <motion.div
                          key={pol.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className={`backdrop-blur-xl border rounded-2xl overflow-hidden transition-all ${
                            pol.is_active
                              ? "bg-white/8 border-white/15"
                              : "bg-white/3 border-white/8 opacity-60"
                          }`}
                        >
                          {/* Policy header row */}
                          <div className="flex items-center gap-3 p-4">
                            {isAdmin && (
                              <GripVertical className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                            )}

                            <button
                              onClick={() => setExpandedPolicy(expandedPolicy === pol.id ? null : pol.id)}
                              className="flex-1 flex items-center gap-3 text-left min-w-0"
                            >
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold truncate ${!pol.is_active ? "line-through opacity-50" : ""}`}>
                                  {pol.title}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Updated {new Date(pol.updated_at).toLocaleDateString()}
                                </p>
                              </div>
                              {expandedPolicy === pol.id
                                ? <ChevronUp   className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              }
                            </button>

                            {/* Status badge — admins see all; non-admins only see active (hidden ones filtered by RLS) */}
                            {isAdmin && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                                pol.is_active
                                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                  : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                              }`}>
                                {pol.is_active ? "Active" : "Hidden"}
                              </span>
                            )}

                            {/* Admin-only action buttons */}
                            {isAdmin && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => togglePolicyActive(pol)}
                                  className="p-1.5 rounded-lg hover:bg-white/10 transition"
                                  title={pol.is_active ? "Hide policy" : "Show policy"}
                                >
                                  {pol.is_active
                                    ? <Eye    className="w-4 h-4 text-muted-foreground" />
                                    : <EyeOff className="w-4 h-4 text-muted-foreground" />
                                  }
                                </button>
                                <button
                                  onClick={() => openEditPolicy(pol)}
                                  className="p-1.5 rounded-lg hover:bg-white/10 transition"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                                </button>
                                <button
                                  onClick={() => setDeletingPolicyId(pol.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-500/10 transition"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4 text-red-400" />
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
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="px-6 pb-6 pt-2 border-t border-white/10">
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
          </>
        )}
      </div>

      {/* ── Category Modal (admin only) ─────────────────────────────────────── */}
      <AnimatePresence>
        {catModal && isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setCatModal(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-background border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-6">
                {catModal === "create" ? "New Policy Tab" : "Edit Policy Tab"}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-1.5">Tab Name *</label>
                  <input
                    type="text"
                    value={catForm.title}
                    onChange={e => setCatForm({ ...catForm, title: e.target.value, slug: slugify(e.target.value) })}
                    placeholder="e.g. Health & Safety"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-1.5">Slug (auto-generated)</label>
                  <input
                    type="text"
                    value={catForm.slug}
                    onChange={e => setCatForm({ ...catForm, slug: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-1.5">Description</label>
                  <input
                    type="text"
                    value={catForm.description}
                    onChange={e => setCatForm({ ...catForm, description: e.target.value })}
                    placeholder="Short description (optional)"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-2">Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_OPTIONS.map(({ value, Icon }) => (
                      <button
                        key={value}
                        onClick={() => setCatForm({ ...catForm, icon: value })}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition border ${
                          catForm.icon === value
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                        }`}
                        title={value}
                      >
                        <Icon className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveCategory}
                  disabled={savingCat}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-background font-semibold py-3 rounded-xl hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {savingCat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {catModal === "create" ? "Create Tab" : "Save Changes"}
                </button>
                <button
                  onClick={() => setCatModal(null)}
                  className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition font-semibold"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Policy Modal (admin only) ───────────────────────────────────────── */}
      <AnimatePresence>
        {policyModal && isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setPolicyModal(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-background border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-1">
                {policyModal === "create" ? "New Policy" : "Edit Policy"}
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Under: <span className="text-foreground font-medium">{activeCategory?.title}</span>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-1.5">Policy Title *</label>
                  <input
                    type="text"
                    value={policyForm.title}
                    onChange={e => setPolicyForm({ ...policyForm, title: e.target.value })}
                    placeholder="e.g. Remote Work Policy"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-1.5">Policy Content *</label>
                  <textarea
                    value={policyForm.content}
                    onChange={e => setPolicyForm({ ...policyForm, content: e.target.value })}
                    placeholder="Write the full policy text here..."
                    rows={12}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition text-sm resize-y font-mono"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPolicyForm({ ...policyForm, is_active: !policyForm.is_active })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${policyForm.is_active ? "bg-primary" : "bg-white/20"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${policyForm.is_active ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                  <span className="text-sm font-medium">
                    {policyForm.is_active ? "Visible to staff" : "Hidden from staff"}
                  </span>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={savePolicy}
                  disabled={savingPolicy}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-background font-semibold py-3 rounded-xl hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {savingPolicy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {policyModal === "create" ? "Create Policy" : "Save Changes"}
                </button>
                <button
                  onClick={() => setPolicyModal(null)}
                  className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition font-semibold"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Category Confirm (admin only) ────────────────────────────── */}
      <AnimatePresence>
        {deletingCatId && isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setDeletingCatId(null)}
          >
            <motion.div
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
              className="bg-background border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
                <h2 className="text-lg font-bold">Delete Tab?</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                This will permanently delete the tab and <strong className="text-foreground">all policies inside it</strong>. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => deleteCategory(deletingCatId)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white font-semibold py-2.5 rounded-xl hover:bg-red-600 transition"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button
                  onClick={() => setDeletingCatId(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition font-semibold"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Policy Confirm (admin only) ──────────────────────────────── */}
      <AnimatePresence>
        {deletingPolicyId && isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setDeletingPolicyId(null)}
          >
            <motion.div
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
              className="bg-background border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
                <h2 className="text-lg font-bold">Delete Policy?</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                This policy will be permanently removed and cannot be recovered.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => deletePolicy(deletingPolicyId)}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white font-semibold py-2.5 rounded-xl hover:bg-red-600 transition"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button
                  onClick={() => setDeletingPolicyId(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition font-semibold"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[9999] space-y-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <ToastNotification key={t.id} toast={t} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}