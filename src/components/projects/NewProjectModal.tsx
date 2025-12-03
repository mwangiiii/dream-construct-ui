// src/components/projects/NewProjectModal.tsx
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import {
  X,
  Building2,
  User,
  Calendar,
  DollarSign,
  MapPin,
  Hash,
  Loader2,
  Sparkles,
  FileText,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

interface Client {
  id: string;
  full_name: string;
  company_id: string | null;
  companies?: {
    name: string;
  } | null;
}

interface Manager {
  id: string;
  full_name: string;
}

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Reusable themed dropdown component (glass-style).
 * - items: array of { value, label }
 * - value: selected value
 * - onChange: called with new value
 * - placeholder: text when nothing selected
 * - label: label shown above control
 */
function GlassDropdown<T extends { value: string; label: string }>({
  label,
  items,
  value,
  placeholder,
  onChange,
  className = "",
}: {
  label?: string;
  items: T[];
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const selected = items.find((it) => it.value === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && <label className="block text-sm font-semibold text-muted-foreground mb-3">{label}</label>}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((s) => !s)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setOpen((s) => !s);
        }}
        className="flex items-center justify-between gap-3 px-6 py-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl cursor-pointer text-foreground"
      >
        <div className={`truncate ${selected ? "" : "text-muted-foreground"}`}>
          {selected ? selected.label : placeholder || "Select..."}
        </div>
        <ChevronDown className={`w-5 h-5 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.14 }}
            className="absolute z-50 mt-2 w-full rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            <div className="max-h-56 overflow-auto">
              {items.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">No options</div>
              ) : (
                items.map((it) => (
                  <div
                    key={it.value}
                    onClick={() => {
                      onChange(it.value);
                      setOpen(false);
                    }}
                    className="px-4 py-3 text-foreground hover:bg-white/10 transition cursor-pointer select-none truncate"
                  >
                    {it.label}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NewProjectModal({ isOpen, onClose, onSuccess }: NewProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [nextProjectNumber, setNextProjectNumber] = useState("");
  const [dateError, setDateError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    client_id: "",
    manager_id: "",
    start_date: "",
    expected_completion_date: "",
    budget_numeric: "",
    currency: "KES",
    site_address: "",
    site_city: "",
    site_state: "",
    site_zip: "",
    site_country: "Kenya",
  });

  // keep a ref for resetting when closed
  useEffect(() => {
    if (isOpen) {
      fetchClientsAndManagers();
      generateNextProjectNumber();
      setDateError("");
    }
  }, [isOpen]);

  // enforce end date > start date
  useEffect(() => {
    if (formData.start_date && formData.expected_completion_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.expected_completion_date);
      // normalize
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      if (end <= start) {
        setDateError("Expected completion date must be at least one day after the start date.");
      } else {
        setDateError("");
      }
    } else {
      setDateError("");
    }
  }, [formData.start_date, formData.expected_completion_date]);

  const fetchClientsAndManagers = async () => {
    try {
      const { data: clientData, error: clientError } = await supabase
        .from("profiles")
        .select(`
          id, 
          full_name, 
          company_id,
          companies(name),
          user_roles!inner(role_name),
          user_statuses!inner(status_name, is_active)
        `)
        .eq("user_roles.role_name", "client")
        .eq("user_statuses.is_active", true)
        .order("full_name");

      if (clientError) throw clientError;
      setClients(clientData || []);

      const { data: managerData, error: managerError } = await supabase
        .from("profiles")
        .select(`
          id, 
          full_name,
          user_roles!inner(role_name),
          user_statuses!inner(status_name, is_active)
        `)
        .in("user_roles.role_name", ["manager", "project_manager"])
        .eq("user_statuses.is_active", true)
        .order("full_name");

      if (managerError) throw managerError;
      setManagers(managerData || []);
    } catch (error) {
      console.error("[NewProjectModal] Error fetching data:", error);
    }
  };

  const generateNextProjectNumber = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from("projects")
        .select("project_number")
        .like("project_number", `PRJ-${currentYear}-%`)
        .order("project_number", { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNum = 1;
      if (data && data.length > 0) {
        const last = data[0].project_number;
        const parts = last.split("-");
        if (parts.length === 3) {
          const parsed = parseInt(parts[2], 10);
          if (!Number.isNaN(parsed)) nextNum = parsed + 1;
        }
      }

      const padded = String(nextNum).padStart(3, "0");
      setNextProjectNumber(`PRJ-${currentYear}-${padded}`);
    } catch (error) {
      console.error("[NewProjectModal] Error generating project number:", error);
      setNextProjectNumber("PRJ-2025-001");
    }
  };

  const handleSubmit = async () => {
    if (!formData.client_id) return alert("Please select a client");
    if (!formData.title.trim()) return alert("Please enter a project title");
    if (dateError) return alert(dateError);

    setLoading(true);

    try {
      const { error } = await supabase.from("projects").insert({
        project_number: nextProjectNumber,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        client_id: formData.client_id,
        manager_id: formData.manager_id || null,
        start_date: formData.start_date || null,
        expected_completion_date: formData.expected_completion_date || null,
        budget_numeric: formData.budget_numeric ? parseFloat(formData.budget_numeric) : null,
        currency: formData.currency,
        site_address: formData.site_address || null,
        site_city: formData.site_city || null,
        site_state: formData.site_state || null,
        site_zip: formData.site_zip || null,
        site_country: formData.site_country,
        status: "planning",
        progress_percent: 0,
      });

      if (error) throw error;

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error("[NewProjectModal] Error creating project:", error);
      alert("Error creating project: " + (error?.message || String(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        title: "",
        description: "",
        client_id: "",
        manager_id: "",
        start_date: "",
        expected_completion_date: "",
        budget_numeric: "",
        currency: "KES",
        site_address: "",
        site_city: "",
        site_state: "",
        site_zip: "",
        site_country: "Kenya",
      });
      setDateError("");
      onClose();
    }
  };

  // helper: give min date for expected completion (start_date + 1)
  const getMinExpectedDate = () => {
    if (!formData.start_date) return undefined;
    const next = new Date(formData.start_date);
    next.setDate(next.getDate() + 1);
    return next.toISOString().split("T")[0];
  };

  // build dropdown items
  const clientItems = clients.map((c) => ({
    value: c.id,
    label: c.companies?.name ? `${c.full_name} — ${c.companies.name}` : c.full_name,
  }));

  const managerItems = managers.map((m) => ({
    value: m.id,
    label: m.full_name,
  }));

  const currencyItems = [
    { value: "KES", label: "KES" },
    { value: "USD", label: "USD" },
    { value: "EUR", label: "EUR" },
    { value: "GBP", label: "GBP" },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative backdrop-blur-2xl bg-background/95 border border-white/20 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-8 py-6 border-b border-white/10">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Create New Project
                  </h2>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleClose}
                  disabled={loading}
                  className="p-2 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
                  aria-label="Close modal"
                >
                  <X className="w-6 h-6" />
                </motion.button>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 space-y-8 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Project Number */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <label className="block text-sm font-semibold text-muted-foreground mb-3">
                  <Hash className="w-4 h-4 inline mr-2" />
                  Project Number
                </label>
                <div className="px-6 py-4 backdrop-blur-xl bg-primary/10 border border-primary/20 rounded-xl">
                  <div className="font-mono text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {nextProjectNumber || "Generating..."}
                  </div>
                </div>
              </motion.div>

              {/* Title */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <label className="block text-sm font-semibold text-muted-foreground mb-3">
                  Project Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-6 py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50"
                  placeholder="e.g., Luxury Villa at Palm Heights"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </motion.div>

              {/* Description */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                <label className="block text-sm font-semibold text-muted-foreground mb-3">
                  <FileText className="w-4 h-4 inline mr-2" />
                  Project Description (Optional)
                </label>
                <textarea
                  rows={4}
                  className="w-full px-6 py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50 resize-none"
                  placeholder="Brief overview of the project scope, objectives, and key deliverables..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </motion.div>

              {/* Client (custom dropdown) */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <GlassDropdown
                  label={
                    <>
                      <Building2 className="w-4 h-4 inline mr-2" />
                      Client <span className="text-red-400">*</span>
                    </>
                  }
                  items={clientItems}
                  value={formData.client_id}
                  placeholder="Select a client"
                  onChange={(v) => setFormData({ ...formData, client_id: v })}
                />
                {clients.length === 0 && <p className="text-sm text-muted-foreground mt-3">No active clients found.</p>}
              </motion.div>

              {/* Manager (custom dropdown) */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <GlassDropdown
                  label={
                    <>
                      <User className="w-4 h-4 inline mr-2" />
                      Project Manager (Optional)
                    </>
                  }
                  items={[{ value: "", label: "No manager assigned" }, ...managerItems]}
                  value={formData.manager_id}
                  placeholder="No manager assigned"
                  onChange={(v) => setFormData({ ...formData, manager_id: v })}
                />
              </motion.div>

              {/* Dates */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-muted-foreground mb-3">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      Start Date
                    </label>
                    <input
                      type="date"
                      className="w-full px-6 py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl text-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                      value={formData.start_date}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        setFormData((prev) => {
                          // if end is empty or end <= newStart then auto bump end to newStart + 1
                          let expected = prev.expected_completion_date;
                          if (!newStart) {
                            expected = "";
                          } else {
                            const next = new Date(newStart);
                            next.setDate(next.getDate() + 1);
                            const min = next.toISOString().split("T")[0];
                            if (!expected || expected <= newStart) expected = min;
                          }
                          return { ...prev, start_date: newStart, expected_completion_date: expected };
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-muted-foreground mb-3">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      Expected Completion
                    </label>
                    <input
                      type="date"
                      min={getMinExpectedDate()}
                      className={`w-full px-6 py-4 backdrop-blur-xl bg-white/5 border rounded-xl text-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all ${dateError ? "border-red-500" : "border-white/10"}`}
                      value={formData.expected_completion_date}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        // prevent setting end same as or before start
                        if (formData.start_date) {
                          const s = new Date(formData.start_date);
                          s.setHours(0, 0, 0, 0);
                          const eDate = new Date(newEnd);
                          eDate.setHours(0, 0, 0, 0);
                          if (eDate <= s) {
                            // ignore or set to min
                            const next = new Date(formData.start_date);
                            next.setDate(next.getDate() + 1);
                            const min = next.toISOString().split("T")[0];
                            setFormData({ ...formData, expected_completion_date: min });
                            setDateError("Expected completion date must be at least one day after the start date.");
                            return;
                          }
                        }
                        setFormData({ ...formData, expected_completion_date: newEnd });
                      }}
                    />
                  </div>
                </div>

                {dateError && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 px-6 py-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 font-medium">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{dateError}</span>
                  </motion.div>
                )}
              </motion.div>

              {/* Budget */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <label className="block text-sm font-semibold text-muted-foreground mb-3">
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  Budget
                </label>
                <div className="flex gap-4">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="flex-1 px-6 py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50"
                    value={formData.budget_numeric}
                    onChange={(e) => setFormData({ ...formData, budget_numeric: e.target.value })}
                  />

                  <div className="w-40">
                    <GlassDropdown
                      label={undefined}
                      items={currencyItems}
                      value={formData.currency}
                      placeholder="Currency"
                      onChange={(v) => setFormData({ ...formData, currency: v })}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Site Address */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <label className="block text-sm font-semibold text-muted-foreground mb-3">
                  <MapPin className="w-4 h-4 inline mr-2" />
                  Site Address (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Street address"
                  className="w-full px-6 py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50 mb-4"
                  value={formData.site_address}
                  onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {["City", "State/County", "ZIP/Postal Code", "Country"].map((label, i) => (
                    <input
                      key={label}
                      type="text"
                      placeholder={label}
                      className="px-6 py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50"
                      value={
                        i === 0
                          ? formData.site_city
                          : i === 1
                          ? formData.site_state
                          : i === 2
                          ? formData.site_zip
                          : formData.site_country
                      }
                      onChange={(e) => {
                        const key = i === 0 ? "site_city" : i === 1 ? "site_state" : i === 2 ? "site_zip" : "site_country";
                        setFormData({ ...formData, [key]: e.target.value });
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-white/10 backdrop-blur-xl bg-background/50">
              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 px-8 py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50 font-semibold text-base"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={loading || !formData.client_id || !formData.title.trim() || !!dateError}
                  className="flex-1 px-8 py-4 bg-gradient-to-r from-primary to-accent text-background rounded-xl hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all font-semibold text-base"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Create Project
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
