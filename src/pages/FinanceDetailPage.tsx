// src/pages/projects/FinanceDetailPage.tsx
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, AuthUser } from "@/lib/auth";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Scale,
  Landmark,
  BarChart3,
  GitMerge,
  Check,
  X,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Clock,
} from "lucide-react";
import AccountsPayablePage    from "@/pages/finance/AccountsPayablePage";
import AccountsReceivablePage from "@/pages/finance/AccountsReceivablePage";
import BalanceSheetPage       from "@/pages/finance/BalanceSheetPage";
import BankReconciliationPage from "@/pages/finance/BankReconciliationPage";
import CashFlowPage           from "@/pages/finance/CashFlowPage";

// ─── Types ────────────────────────────────────────────────────────────────────

type FinanceTab =
  | "accounts-payable"
  | "accounts-receivable"
  | "balance-sheet"
  | "bank-reconciliation"
  | "cash-flow";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
}

// ─── Tab Config ───────────────────────────────────────────────────────────────

const FINANCE_TABS: {
  id: FinanceTab;
  label: string;
  shortLabel: string;
  icon: React.FC<{ className?: string }>;
  description: string;
  color: string;
}[] = [
  {
    id: "accounts-payable",
    label: "Accounts Payable",
    shortLabel: "Payable",
    icon: TrendingDown,
    description: "Vendor invoices & payments",
    color: "text-orange-400",
  },
  {
    id: "accounts-receivable",
    label: "Accounts Receivable",
    shortLabel: "Receivable",
    icon: TrendingUp,
    description: "Client billings & receipts",
    color: "text-green-400",
  },
  {
    id: "balance-sheet",
    label: "Balance Sheet",
    shortLabel: "Balance",
    icon: Scale,
    description: "Assets, liabilities & equity",
    color: "text-blue-400",
  },
  {
    id: "bank-reconciliation",
    label: "Bank Reconciliation",
    shortLabel: "Reconcile",
    icon: GitMerge,
    description: "Match bank & book transactions",
    color: "text-purple-400",
  },
  {
    id: "cash-flow",
    label: "Cash Flow",
    shortLabel: "Cash Flow",
    icon: BarChart3,
    description: "Inflows, outflows & net position",
    color: "text-primary",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const ToastNotification: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const config = {
    success: {
      icon: <Check className="w-5 h-5" />,
      bg: "bg-green-500/20",
      border: "border-green-500/50",
      text: "text-green-200",
    },
    error: {
      icon: <XCircle className="w-5 h-5" />,
      bg: "bg-red-500/20",
      border: "border-red-500/50",
      text: "text-red-200",
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5" />,
      bg: "bg-yellow-500/20",
      border: "border-yellow-500/50",
      text: "text-yellow-200",
    },
  }[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`flex items-center gap-3 min-w-80 max-w-md backdrop-blur-xl ${config.bg} ${config.border} ${config.text} border rounded-xl shadow-2xl p-4 cursor-pointer hover:opacity-90 transition-all pointer-events-auto`}
      onClick={() => onDismiss(toast.id)}
    >
      <div className="p-2 bg-white/20 rounded-lg">{config.icon}</div>
      <p className="font-medium text-sm flex-1">{toast.message}</p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        className="opacity-70 hover:opacity-100"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab]     = useState<FinanceTab>("accounts-payable");
  const [project, setProject]         = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [toasts, setToasts]           = useState<Toast[]>([]);

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: Toast["type"] = "success") => {
    const tid = Date.now().toString();
    setToasts((prev) => [...prev, { id: tid, message, type }]);
  }, []);

  const dismissToast = useCallback((tid: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== tid));
  }, []);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!id) {
        navigate("/projects");
        return;
      }

      try {
        setLoading(true);

        // 1. Auth
        const user = await getCurrentUser();
        if (!mounted) return;

        if (!user) {
          navigate("/login");
          return;
        }

        if (!user.status.is_active) {
          showToast("Your account is not active. Contact admin.", "error");
          setTimeout(() => navigate("/"), 2000);
          return;
        }

        setCurrentUser(user);

        // 2. Role check — only finance-related roles + admin/manager
        const allowedRoles = ["admin", "manager", "project_manager", "finance"];
        const hasAccess = user.roles.some((r: any) => allowedRoles.includes(r.role_name));

        if (!hasAccess) {
          showToast("You do not have permission to access the finance module.", "error");
          setTimeout(() => navigate("/projects"), 2000);
          return;
        }

        // 3. Fetch project header info
        const { data: proj, error: projErr } = await supabase
          .from("projects")
          .select(`
            id, name, site_address, status,
            client:profiles!projects_client_id_fkey(id, full_name, companies(name)),
            manager:profiles!projects_manager_id_fkey(id, full_name)
          `)
          .eq("id", id)
          .single();

        if (!mounted) return;

        if (projErr || !proj) {
          showToast("Project not found.", "error");
          setTimeout(() => navigate("/projects"), 2000);
          return;
        }

        // 4. Verify project-level access
        const isAdmin          = user.roles.some((r: any) => r.role_name === "admin");
        const isGeneralManager = user.roles.some((r: any) => r.role_name === "manager");
        const isFinance        = user.roles.some((r: any) => r.role_name === "finance");
        const isAssignedPM     = proj.manager?.id === user.profile?.id;

        if (!isAdmin && !isGeneralManager && !isFinance && !isAssignedPM) {
          showToast("You are not authorized to view this project's finances.", "error");
          setTimeout(() => navigate("/projects"), 2000);
          return;
        }

        setProject(proj);
      } catch (err) {
        console.error("[FinanceDetailPage] Init error:", err);
        if (mounted) {
          showToast("Error loading finance module.", "error");
          setTimeout(() => navigate("/projects"), 2000);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();
    return () => { mounted = false; };
  }, [id, navigate, showToast]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const canEdit = currentUser?.roles.some((r: any) =>
    ["admin", "manager", "project_manager", "finance"].includes(r.role_name)
  ) ?? false;

  const activeTabConfig = FINANCE_TABS.find((t) => t.id === activeTab)!;
  const ActiveTabIcon   = activeTabConfig.icon;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-6" />
          <p className="text-xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Loading finance module...
          </p>
        </motion.div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
          <p className="text-3xl font-bold mb-4">Project Not Found</p>
          <button
            onClick={() => navigate("/projects")}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-background rounded-xl font-semibold mx-auto"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Projects
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">

      {/* ── Page Header ── */}
      <div className="bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 border-b border-white/10">
        <div className="container mx-auto px-3 sm:px-6 py-6 sm:py-10">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

            {/* Top row — back + title */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
              <div className="flex items-start gap-3 w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.05, x: -4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/projects/${id}`)}
                  className="backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 p-2.5 rounded-xl transition-all flex-shrink-0"
                  title="Back to project"
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>

                <div className="flex-1 min-w-0">
                  {/* Module pill */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/25 text-primary text-xs font-bold uppercase tracking-widest mb-2">
                    <DollarSign className="w-3 h-3" />
                    Finance Module
                  </div>
                  <h1 className="text-2xl sm:text-4xl font-bold truncate leading-tight">
                    {project.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                    {project.site_address && (
                      <span className="truncate">{project.site_address}</span>
                    )}
                    {project.client?.companies?.name && (
                      <span className="hidden sm:inline">·</span>
                    )}
                    {project.client?.companies?.name && (
                      <span className="truncate">{project.client.companies.name}</span>
                    )}
                    {project.manager?.full_name && (
                      <>
                        <span className="hidden sm:inline">·</span>
                        <span className="truncate">PM: {project.manager.full_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Active tab indicator — desktop */}
              <div className="hidden lg:flex items-center gap-3 ml-auto flex-shrink-0 backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl px-5 py-3">
                <div className={`p-2 rounded-xl bg-white/10 ${activeTabConfig.color}`}>
                  <ActiveTabIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{activeTabConfig.description}</p>
                  <p className="font-bold text-sm text-foreground">{activeTabConfig.label}</p>
                </div>
              </div>
            </div>

            {/* ── Tab Navigation ── */}
            <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-1.5">
              <div className="flex overflow-x-auto gap-1 scrollbar-hide">
                {FINANCE_TABS.map((tab) => {
                  const Icon     = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <motion.button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative flex items-center gap-2 px-3 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap flex-shrink-0 ${
                        isActive
                          ? "bg-primary text-background shadow-lg shadow-primary/20"
                          : "hover:bg-white/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${isActive ? "" : tab.color}`} />
                      {/* Full label on md+, short label on sm */}
                      <span className="hidden md:inline">{tab.label}</span>
                      <span className="inline md:hidden">{tab.shortLabel}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Tab Content ── */}
      {/*
        Each finance page manages its own padding/layout internally,
        so we pass through with minimal wrapper here — just like
        ProjectDetailPage delegates to TasksTab, Stages, etc.
      */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
        >
          {activeTab === "accounts-payable" && (
            <AccountsPayablePage
              projectId={id!}
              canEdit={canEdit}
            />
          )}

          {activeTab === "accounts-receivable" && (
            <AccountsReceivablePage
              projectId={id!}
              canEdit={canEdit}
            />
          )}

          {activeTab === "balance-sheet" && (
            <BalanceSheetPage
              projectId={id!}
              canEdit={canEdit}
            />
          )}

          {activeTab === "bank-reconciliation" && (
            <BankReconciliationPage
              projectId={id!}
              canEdit={canEdit}
            />
          )}

          {activeTab === "cash-flow" && (
            <CashFlowPage
              projectId={id!}
              canEdit={canEdit}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Floating Toasts ── */}
      <div className="fixed bottom-6 right-6 z-[9999] space-y-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastNotification key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}