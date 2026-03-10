// src/App.tsx
import { useEffect, useState, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  Outlet,
} from "react-router-dom";
import {
  Volume2,
  VolumeX,
  Volume1,
  UserPlus,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/auth";

// ─── Layouts ──────────────────────────────────────────────────────────────────
import MainLayout from "./components/layout/MainLayout";
import AdminLayout from "./components/layout/AdminLayout";
import ClientLayout from "./components/layout/ClientLayout";
import ProjectManagerLayout from "./components/layout/ProjectManagerLayout";
import FinanceLayout from "./components/layout/FinanceLayout";

// ─── Admin Pages ──────────────────────────────────────────────────────────────
import AdminSettingsPage from "./pages/admin/settings";
import ClientSettingsPage from "./pages/client/settings";
import MediaManagement from "./pages/admin/mediaManagement";
import AdminUserCreate from "./pages/admin/UserCreate";
import UserManagement from "./pages/admin/UserManagement";
import ReviewsManagement from "./pages/admin/ReviewsManagement";
import Dashboard from "./pages/admin/Dashboard";
import MediaCreate from "./pages/admin/multimedia/mediaCreate";

// ─── Project Manager Pages ────────────────────────────────────────────────────
import ProjectManagerProjectManagement from "./pages/project_manager/Projects/ProjectDetailPage.tsx";
import PMsProjectDetailPage from "./pages/project_manager/projects.tsx";
import ProjectManagerDashboard from "./pages/project_manager/dashboard";
import PMStages from "./pages/project_manager/stages";
import PMWorkers from "./pages/project_manager/workers";
import PMDailyProgress from "./pages/project_manager/daily-progress";
import PMMaterials from "./pages/project_manager/materials";
import PMFinancials from "./pages/project_manager/financials";
import PMIssues from "./pages/project_manager/issues";
import PMReports from "./pages/project_manager/reports";
import PMSettings from "./pages/project_manager/settings";

// ─── Finance Pages ────────────────────────────────────────────────────────────
import WorkInProgressPage from "./pages/finance/Work_in_progress";
import ChangeOrdersTrackingPage from "./pages/finance/Change_orders_tracking";
import InventoryPage from "./pages/finance/Inventory";
import EndMonthCloseChecklistPage from "./pages/finance/End_month_close_checklist";
import BankReconciliationPage from "./pages/finance/BankReconciliationPage.tsx";
import FixedAssetEquipmentDepreciationPage from "./pages/finance/Fixed_Asset_Equipment_Depreciation";
import BalanceSheetPage from "./pages/finance/BalanceSheetPage.tsx";
import StatementOfAccountPage from "./pages/finance/Statement_of_Account";
import IncomeStatementPage from "./pages/finance/Income_Statement";
import InvoicePage from "./pages/finance/InvoicePage.tsx";
import TaxesPage from "./pages/finance/Taxes";
import LoansPage from "./pages/finance/Loans";
import AccountsPayablePage from "./pages/finance/AccountsPayablePage.tsx";
import AccountsReceivedPage from "./pages/finance/AccountsReceivablePage.tsx";
import CashFlowPage from "./pages/finance/CashFlowPage.tsx";
import ChartOfAccountsPage from "./pages/finance/chart_of_accounts_page";
import JobPostingPage from "./pages/finance/JobPosting";
import PayrollChecklistPage from "./pages/finance/Payroll_checkList";
import FinanceDashboardPage from "./pages/finance/FinanceDashboardPage";
import FinanceDetailPage from "./pages/FinanceDetailPage.tsx";

// ─── Project Pages ────────────────────────────────────────────────────────────
import ProjectManagementDashboard from "./components/dashboard/ProjectManagementDashboard";
import ProjectDetailPage from "./pages/projects/ProjectDetailPage";

// ─── Client Pages ─────────────────────────────────────────────────────────────
import ClientDashboard from "./pages/client/Dashboard";
import ClientProjects from "./pages/client/projects";
import ClientNotifications from "./pages/client/clientNotifications";

// ─── Public Pages ─────────────────────────────────────────────────────────────
import Index from "./pages/Index";
import Services from "./pages/Services";
import Projects from "./pages/Projects";
import Team from "./pages/Team";
import Contact from "./pages/contact";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Reviews from "./pages/Reviews";
import MediaGalleryPage from "./pages/MediaGalleryPage";
import PoliciesPage from "./pages/PoliciesPage";
import StaffPoliciesPage from "./pages/Staffpoliciespage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// ─── Invoice View Page (deep-link from email) ─────────────────────────────────
import InvoiceViewPage from "./pages/InvoiceViewPage";

const queryClient = new QueryClient();

// ─────────────────────────────────────────────────────────────────────────────
// ROLES REFERENCE
//   1 → admin
//   2 → manager
//   3 → project_manager
//   4 → client
//   5 → finance
//   6 → surveyor
//
// Finance routes are accessible to: admin, manager, finance
// Admin routes:           admin
// Project manager routes: admin, manager, project_manager
// Client routes:          client
// Staff policies:         admin, manager, project_manager, finance, surveyor
// ─────────────────────────────────────────────────────────────────────────────

// ─── Role groups (single source of truth) ────────────────────────────────────
const ROLES = {
  ADMIN_ONLY:      ["admin"],
  ADMIN_MANAGER:   ["admin", "manager"],
  FINANCE:         ["admin", "manager", "finance"],
  PROJECT_MGMT:    ["admin", "manager", "project_manager"],
  CLIENT:          ["client"],
  STAFF:           ["admin", "manager", "project_manager", "finance", "surveyor"],
  ALL_INTERNAL:    ["admin", "manager", "project_manager", "finance", "surveyor"],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED ROUTE — authentication + optional role check
// ─────────────────────────────────────────────────────────────────────────────
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiredRoles?: readonly string[] | string[];
}> = ({ children, requiredRoles }) => {
  const [status, setStatus] = useState<"loading" | "authorized" | "unauthorized">("loading");
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        // 1. Must have a valid Supabase session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (!cancelled) setStatus("unauthorized");
          return;
        }

        // 2. No role restriction → any authenticated user passes
        if (!requiredRoles || requiredRoles.length === 0) {
          if (!cancelled) setStatus("authorized");
          return;
        }

        // 3. Role check
        const user = await getCurrentUser();
        if (!user) {
          if (!cancelled) setStatus("unauthorized");
          return;
        }

        const hasRole = user.roles.some((r: { role_name: string }) =>
          (requiredRoles as string[]).includes(r.role_name)
        );

        if (!cancelled) setStatus(hasRole ? "authorized" : "unauthorized");
      } catch (err) {
        console.error("[ProtectedRoute] auth check failed:", err);
        if (!cancelled) setStatus("unauthorized");
      }
    };

    check();
    return () => { cancelled = true; };
  }, [location.pathname]);               // re-check on navigation

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white/70 text-sm tracking-wide">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (status === "unauthorized") {
    // Preserve the attempted URL so login can redirect back
    const redirectTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }

  return <>{children}</>;
};

// ─────────────────────────────────────────────────────────────────────────────
// FINANCE LAYOUT GUARD — wraps every /finance/* route
// Single place to change who can access the entire finance module.
// ─────────────────────────────────────────────────────────────────────────────
const FinanceGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requiredRoles={ROLES.FINANCE}>
    <FinanceLayout>{children}</FinanceLayout>
  </ProtectedRoute>
);

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT MANAGEMENT (nested tabs)
// ─────────────────────────────────────────────────────────────────────────────
const ContentManagement = () => {
  const location = useLocation();
  const tabs = [
    { name: "Overview",  path: "/admin/content"        },
    { name: "Reviews",   path: "/admin/content/reviews" },
    { name: "Media",     path: "/admin/content/media"   },
    { name: "Pages",     path: "/admin/content/pages"   },
  ];
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-4xl font-bold">Content Management</h1>
        <p className="text-muted-foreground mt-2">Update website content and media</p>
      </div>
      <div className="border-b border-border mb-6">
        <nav className="flex space-x-8">
          {tabs.map(tab => {
            const isActive = location.pathname === tab.path;
            return (
              <Link key={tab.path} to={tab.path}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}>
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
};

const ContentOverview = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Link to="/admin/content/reviews">
        <div className="p-6 border rounded-lg hover:border-primary transition-colors cursor-pointer">
          <h3 className="text-xl font-semibold mb-2">Reviews Management</h3>
          <p className="text-muted-foreground">Manage customer reviews and testimonials</p>
        </div>
      </Link>
      <Link to="/admin/content/media" className="block">
        <div className="p-6 border rounded-xl hover:border-primary/50 hover:bg-accent/5 transition-all duration-300 cursor-pointer group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
              Media Library
            </h3>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <ImageIcon className="w-6 h-6 text-primary" />
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            Upload and organize images, videos, and more • Manage drafts, published & archived content
          </p>
          <div className="mt-4 flex items-center text-primary text-sm font-medium">
            Open Library
            <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>
      <Link to="/admin/content/pages">
        <div className="p-6 border rounded-lg hover:border-primary transition-colors cursor-pointer">
          <h3 className="text-xl font-semibold mb-2">Pages Content</h3>
          <p className="text-muted-foreground">Edit homepage, services, and other pages</p>
        </div>
      </Link>
    </div>
  </div>
);

const MediaLibraryTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const tabs = [
    { name: "Library",      path: "/admin/content/media"        },
    { name: "Create Media", path: "/admin/content/media/create" },
  ];
  const isCreatePage = location.pathname === "/admin/content/media/create";
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold">Media Library</h2>
        <p className="text-muted-foreground mt-2">Manage and upload advertisements, images, and videos</p>
      </div>
      <div className="border-b border-border mb-6">
        <nav className="flex space-x-8">
          {tabs.map(tab => {
            const isActive = location.pathname === tab.path;
            return (
              <button key={tab.path} onClick={() => navigate(tab.path)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}>
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>
      {isCreatePage ? <MediaCreate /> : <MediaManagement />}
    </div>
  );
};

const MediaLibrary = MediaLibraryTabs;
const PagesContent = () => (
  <div className="text-center py-12">
    <h2 className="text-2xl font-semibold mb-4">Pages Content</h2>
    <p className="text-muted-foreground">Page content editor coming soon…</p>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
const App = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted]   = useState(false);
  const [volume, setVolume]     = useState(0.2);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    const play = async () => {
      try { await audio.play(); } catch { /* autoplay blocked */ }
    };
    const onInteraction = () => {
      play();
      document.removeEventListener("click",      onInteraction);
      document.removeEventListener("touchstart", onInteraction);
      document.removeEventListener("keydown",    onInteraction);
    };
    document.addEventListener("click",      onInteraction, { once: true });
    document.addEventListener("touchstart", onInteraction, { once: true });
    document.addEventListener("keydown",    onInteraction, { once: true });
    return () => {
      document.removeEventListener("click",      onInteraction);
      document.removeEventListener("touchstart", onInteraction);
      document.removeEventListener("keydown",    onInteraction);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted  = isMuted;
    }
  }, [volume, isMuted]);

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="w-5 h-5" />;
    if (volume < 0.5)            return <Volume1 className="w-5 h-5" />;
    return <Volume2 className="w-5 h-5" />;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />

        {/* Background Music */}
        <audio ref={audioRef} loop preload="auto" style={{ display: "none" }}>
          <source src="/Ravz.mp3" type="audio/mpeg" />
        </audio>

        {/* Floating Volume Control */}
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setIsMuted(m => !m)}
            className="bg-black/80 hover:bg-black text-white p-4 rounded-full shadow-lg backdrop-blur-sm transition-all hover:scale-110"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {getVolumeIcon()}
          </button>
        </div>

        <BrowserRouter>
          <Routes>

            {/* ══════════════════════════════════════════════════════════════
                INVOICE DEEP-LINK ROUTE
                Accessible by all authenticated internal staff + finance.
                Used when a recipient clicks "View Invoice Online" in email.
                URL pattern: /invoices/:id
                e.g. https://reveconstruct.vercel.app/invoices/02265aa3-06f9-4eeb-81c5-86f89b4fb244
            ══════════════════════════════════════════════════════════════ */}
            <Route
              path="/invoices/:id"
              element={
                <ProtectedRoute requiredRoles={ROLES.FINANCE}>
                  <FinanceLayout>
                    <InvoiceViewPage />
                  </FinanceLayout>
                </ProtectedRoute>
              }
            />

            {/* ══════════════════════════════════════════════════════════════
                FINANCE ROUTES
                Protected by FinanceGuard → requires auth + finance role
                Accessible by: admin (1), manager (2), finance (5)
            ══════════════════════════════════════════════════════════════ */}
            <Route path="/finance/dashboard"
              element={<FinanceGuard><FinanceDashboardPage /></FinanceGuard>} />

            <Route path="/finance/work-in-progress"
              element={<FinanceGuard><WorkInProgressPage /></FinanceGuard>} />

            <Route path="/finance/change-orders-tracking"
              element={<FinanceGuard><ChangeOrdersTrackingPage /></FinanceGuard>} />

            <Route path="/finance/inventory"
              element={<FinanceGuard><InventoryPage /></FinanceGuard>} />

            <Route path="/finance/end-month-close-checklist"
              element={<FinanceGuard><EndMonthCloseChecklistPage /></FinanceGuard>} />

            <Route path="/finance/bank-reconciliation"
              element={<FinanceGuard><BankReconciliationPage /></FinanceGuard>} />

            <Route path="/finance/fixed-asset-equipment-depreciation"
              element={<FinanceGuard><FixedAssetEquipmentDepreciationPage /></FinanceGuard>} />

            <Route path="/finance/balance-sheet"
              element={<FinanceGuard><BalanceSheetPage /></FinanceGuard>} />

            <Route path="/finance/statement-of-account"
              element={<FinanceGuard><StatementOfAccountPage /></FinanceGuard>} />

            <Route path="/finance/invoices"
              element={<FinanceGuard><InvoicePage /></FinanceGuard>} />

            <Route path="/finance/income-statement"
              element={<FinanceGuard><IncomeStatementPage /></FinanceGuard>} />

            <Route path="/finance/taxes"
              element={<FinanceGuard><TaxesPage /></FinanceGuard>} />

            <Route path="/finance/loans"
              element={<FinanceGuard><LoansPage /></FinanceGuard>} />

            <Route path="/finance/accounts-payable"
              element={<FinanceGuard><AccountsPayablePage /></FinanceGuard>} />

            <Route path="/finance/accounts-received"
              element={<FinanceGuard><AccountsReceivedPage /></FinanceGuard>} />

            <Route path="/finance/cash-flow"
              element={<FinanceGuard><CashFlowPage /></FinanceGuard>} />

            <Route path="/finance/chart-of-accounts"
              element={<FinanceGuard><ChartOfAccountsPage /></FinanceGuard>} />

            <Route path="/finance/job-posting"
              element={<FinanceGuard><JobPostingPage /></FinanceGuard>} />

            <Route path="/finance/payroll-checklist"
              element={<FinanceGuard><PayrollChecklistPage /></FinanceGuard>} />

            {/* Finance index/detail — admin + manager only (sensitive overview) */}
            <Route path="/finance/"
              element={
                <ProtectedRoute requiredRoles={ROLES.FINANCE}>
                  <ProjectManagerLayout>
                    <FinanceDetailPage />
                  </ProjectManagerLayout>
                </ProtectedRoute>
              }
            />

            {/* ══════════════════════════════════════════════════════════════
                PUBLIC ROUTES — no auth required
            ══════════════════════════════════════════════════════════════ */}
            <Route path="/"         element={<MainLayout><Index /></MainLayout>} />
            <Route path="/services" element={<MainLayout><Services /></MainLayout>} />
            <Route path="/projects" element={<MainLayout><Projects /></MainLayout>} />
            <Route path="/team"     element={<MainLayout><Team /></MainLayout>} />
            <Route path="/contact"  element={<MainLayout><Contact /></MainLayout>} />
            <Route path="/reviews"  element={<MainLayout><Reviews /></MainLayout>} />
            <Route path="/media"    element={<MainLayout><MediaGalleryPage /></MainLayout>} />
            <Route path="/policies" element={<PoliciesPage />} />

            {/* ══════════════════════════════════════════════════════════════
                AUTH ROUTES
            ══════════════════════════════════════════════════════════════ */}
            <Route path="/login"           element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />
            {/* <Route path="/register" element={<Register />} /> */}

            {/* ══════════════════════════════════════════════════════════════
                ADMIN ROUTES — admin only
            ══════════════════════════════════════════════════════════════ */}
            <Route path="/admin"
              element={
                <ProtectedRoute requiredRoles={ROLES.ADMIN_ONLY}>
                  <AdminLayout><Dashboard /></AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* User Management */}
            <Route path="/admin/users"
              element={
                <ProtectedRoute requiredRoles={ROLES.ADMIN_ONLY}>
                  <AdminLayout>
                    <div className="p-8">
                      <div className="flex justify-between items-center mb-6">
                        <div />
                        <Link to="/admin/users/create">
                          <Button className="bg-primary hover:bg-primary/90">
                            <UserPlus className="w-4 h-4 mr-2" />
                            Create New User
                          </Button>
                        </Link>
                      </div>
                      <UserManagement />
                    </div>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/admin/users/create"
              element={
                <ProtectedRoute requiredRoles={ROLES.ADMIN_ONLY}>
                  <AdminLayout><AdminUserCreate /></AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* Project Management */}
            <Route path="/admin/projects"
              element={
                <ProtectedRoute requiredRoles={ROLES.PROJECT_MGMT}>
                  <AdminLayout><ProjectManagementDashboard /></AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/admin/projects/:id"
              element={
                <ProtectedRoute requiredRoles={ROLES.PROJECT_MGMT}>
                  <AdminLayout><ProjectDetailPage /></AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* Content Management — nested routes */}
            <Route path="/admin/content"
              element={
                <ProtectedRoute requiredRoles={ROLES.ADMIN_MANAGER}>
                  <AdminLayout><ContentManagement /></AdminLayout>
                </ProtectedRoute>
              }
            >
              <Route index element={<ContentOverview />} />
              <Route path="reviews" element={<ReviewsManagement />} />
              <Route path="pages"   element={<PagesContent />} />
            </Route>

            <Route path="/admin/content/media"
              element={
                <ProtectedRoute requiredRoles={ROLES.ADMIN_MANAGER}>
                  <AdminLayout>
                    <div className="p-8"><MediaLibrary /></div>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/admin/content/media/create"
              element={
                <ProtectedRoute requiredRoles={ROLES.ADMIN_MANAGER}>
                  <AdminLayout>
                    <div className="p-8"><MediaLibrary /></div>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* Admin Settings — any authenticated user */}
            <Route path="/admin/settings"
              element={
                <ProtectedRoute>
                  <AdminLayout><AdminSettingsPage /></AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* ══════════════════════════════════════════════════════════════
                CLIENT ROUTES — client only
            ══════════════════════════════════════════════════════════════ */}
            <Route path="/client/dashboard"
              element={
                <ProtectedRoute requiredRoles={ROLES.CLIENT}>
                  <ClientLayout><ClientDashboard /></ClientLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/client/projects"
              element={
                <ProtectedRoute requiredRoles={ROLES.CLIENT}>
                  <ClientLayout><ClientProjects /></ClientLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/client/projects/:id"
              element={
                <ProtectedRoute requiredRoles={ROLES.CLIENT}>
                  <ClientLayout><ProjectDetailPage /></ClientLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/client/notifications"
              element={
                <ProtectedRoute requiredRoles={ROLES.CLIENT}>
                  <ClientLayout><ClientNotifications /></ClientLayout>
                </ProtectedRoute>
              }
            />

            {/* Client Settings — any authenticated user */}
            <Route path="/client/settings"
              element={
                <ProtectedRoute>
                  <ClientLayout><ClientSettingsPage /></ClientLayout>
                </ProtectedRoute>
              }
            />

            {/* ══════════════════════════════════════════════════════════════
                PROJECT MANAGER ROUTES
                Accessible by: admin (1), manager (2), project_manager (3)
            ══════════════════════════════════════════════════════════════ */}
            <Route path="/pm/dashboard"
              element={
                <ProtectedRoute requiredRoles={ROLES.PROJECT_MGMT}>
                  <ProjectManagerLayout><ProjectManagerDashboard /></ProjectManagerLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/project_manager/stages"
              element={
                <ProtectedRoute requiredRoles={ROLES.PROJECT_MGMT}>
                  <ProjectManagerLayout><PMStages /></ProjectManagerLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/project_manager/workers"
              element={
                <ProtectedRoute requiredRoles={ROLES.PROJECT_MGMT}>
                  <ProjectManagerLayout><PMWorkers /></ProjectManagerLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/project_manager/daily-progress"
              element={
                <ProtectedRoute requiredRoles={ROLES.PROJECT_MGMT}>
                  <ProjectManagerLayout><PMDailyProgress /></ProjectManagerLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/project_manager/materials"
              element={
                <ProtectedRoute requiredRoles={ROLES.PROJECT_MGMT}>
                  <ProjectManagerLayout><PMMaterials /></ProjectManagerLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/project_manager/financials"
              element={
                <ProtectedRoute requiredRoles={ROLES.PROJECT_MGMT}>
                  <ProjectManagerLayout><PMFinancials /></ProjectManagerLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/project_manager/issues"
              element={
                <ProtectedRoute requiredRoles={ROLES.PROJECT_MGMT}>
                  <ProjectManagerLayout><PMIssues /></ProjectManagerLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/project_manager/reports"
              element={
                <ProtectedRoute requiredRoles={ROLES.PROJECT_MGMT}>
                  <ProjectManagerLayout><PMReports /></ProjectManagerLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/project_manager/settings"
              element={
                <ProtectedRoute requiredRoles={ROLES.PROJECT_MGMT}>
                  <ProjectManagerLayout><PMSettings /></ProjectManagerLayout>
                </ProtectedRoute>
              }
            />

            {/* Projects list — no role restriction beyond auth */}
            <Route path="/project_manager/projects"
              element={
                <ProtectedRoute requiredRoles={ROLES.PROJECT_MGMT}>
                  <ProjectManagerLayout><PMsProjectDetailPage /></ProjectManagerLayout>
                </ProtectedRoute>
              }
            />

            <Route path="/project_manager/projects/:id"
              element={
                <ProtectedRoute requiredRoles={ROLES.PROJECT_MGMT}>
                  <ProjectManagerLayout>
                    <ProjectManagerProjectManagement />
                  </ProjectManagerLayout>
                </ProtectedRoute>
              }
            />

            {/* ══════════════════════════════════════════════════════════════
                STAFF POLICIES — all internal staff roles
                Accessible by: admin, manager, project_manager, finance, surveyor
            ══════════════════════════════════════════════════════════════ */}
            <Route path="/staff-policies"
              element={
                <ProtectedRoute requiredRoles={ROLES.STAFF}>
                  <StaffPoliciesPage />
                </ProtectedRoute>
              }
            />

            {/* ══════════════════════════════════════════════════════════════
                404
            ══════════════════════════════════════════════════════════════ */}
            <Route path="*" element={<NotFound />} />

          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;