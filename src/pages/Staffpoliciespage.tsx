// src/pages/policies/StaffPoliciesPage.tsx
// Visible to authenticated users who are NOT clients (enforced by RLS + ProtectedRoute)
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import {
  FileText, ChevronDown, ChevronUp, Loader2, Search, X,
  Building2, Users, ShieldCheck, Lock, Tag,
} from "lucide-react";

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
  updated_at: string;
}

const iconMap: Record<string, React.ElementType> = {
  FileText, Building2, Users, ShieldCheck, Lock, Tag,
};
const CategoryIcon = ({ name, className = "w-5 h-5" }: { name: string; className?: string }) => {
  const Icon = iconMap[name] || FileText;
  return <Icon className={className} />;
};

export default function StaffPoliciesPage() {
  const [categories, setCategories] = useState<PolicyCategory[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [catRes, polRes] = await Promise.all([
      supabase.from("policy_categories").select("*").order("sort_order"),
      supabase.from("policies").select("*").eq("is_active", true).order("sort_order"),
    ]);
    const cats: PolicyCategory[] = catRes.data || [];
    const pols: Policy[] = polRes.data || [];
    setCategories(cats);
    setPolicies(pols);
    if (cats.length && !activeTab) setActiveTab(cats[0].id);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeCategory = categories.find(c => c.id === activeTab);
  const filtered = policies.filter(p => {
    if (p.category_id !== activeTab) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold">Company Policies</h1>
          <p className="text-muted-foreground mt-2">
            Internal policies and guidelines for all staff members
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-32">
            <FileText className="w-16 h-16 mx-auto mb-4 text-primary/20" />
            <p className="text-muted-foreground">No policies published yet</p>
          </div>
        ) : (
          <>
            {/* Floating Tab Bar */}
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <motion.button
                  key={cat.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setActiveTab(cat.id); setSearch(""); setExpandedPolicy(null); }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all border ${
                    activeTab === cat.id
                      ? "bg-primary text-background border-primary shadow-lg shadow-primary/20"
                      : "backdrop-blur-xl bg-white/10 border-white/20 hover:bg-white/20"
                  }`}
                >
                  <CategoryIcon name={cat.icon} className="w-4 h-4" />
                  {cat.title}
                </motion.button>
              ))}
            </div>

            {/* Active section */}
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
                  {/* Category description */}
                  {activeCategory.description && (
                    <div className="backdrop-blur-xl bg-white/8 border border-white/15 rounded-2xl px-5 py-4 flex items-center gap-3">
                      <CategoryIcon name={activeCategory.icon} className="w-5 h-5 text-primary flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">{activeCategory.description}</p>
                    </div>
                  )}

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder={`Search in ${activeCategory.title}...`}
                      className="w-full pl-10 pr-10 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition text-sm"
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2">
                        <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>

                  {/* Policies */}
                  {filtered.length === 0 ? (
                    <div className="text-center py-16 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="text-muted-foreground">
                        {search ? "No policies match your search" : "No policies in this section"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filtered.map((pol, idx) => (
                        <motion.div
                          key={pol.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="backdrop-blur-xl bg-white/8 border border-white/15 rounded-2xl overflow-hidden"
                        >
                          <button
                            onClick={() => setExpandedPolicy(expandedPolicy === pol.id ? null : pol.id)}
                            className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/5 transition"
                          >
                            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold">{pol.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Last updated {new Date(pol.updated_at).toLocaleDateString("en-GB", {
                                  day: "numeric", month: "long", year: "numeric",
                                })}
                              </p>
                            </div>
                            {expandedPolicy === pol.id
                              ? <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                              : <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                            }
                          </button>

                          <AnimatePresence>
                            {expandedPolicy === pol.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="px-6 pb-6 pt-1 border-t border-white/10">
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
    </div>
  );
}