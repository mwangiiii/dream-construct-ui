import { ReactNode } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut,
  Menu,
  ChevronRight,
  TrendingUp,
  BookOpen,
  LayoutGrid,
  Droplets,
  FileText,
  Landmark,
  CreditCard,
  ReceiptText,
  HardHat,
  GitPullRequestArrow,
  Package,
  Wrench,
  Banknote,
  Receipt,
  Briefcase,
  ClipboardList,
  CalendarCheck,
  LayoutDashboard,
  ScrollText,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";

interface FinanceLayoutProps {
  children: ReactNode;
}

const financeRoutes = [
  {
    group: "Overview",
    items: [
      {
        label: "Dashboard",
        path: "/finance/dashboard",
        short: "Home",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    group: "Accounting",
    items: [
      { label: "Chart of Accounts",    short: "CoA",  path: "/finance/chart-of-accounts",                  icon: BookOpen            },
      { label: "Balance Sheet",        short: "BS",   path: "/finance/balance-sheet",                       icon: LayoutGrid          },
      { label: "Income Statement",     short: "IS",   path: "/finance/income-statement",                    icon: TrendingUp          },
      { label: "Cash Flow",            short: "CF",   path: "/finance/cash-flow",                           icon: Droplets            },
      { label: "Statement of Account", short: "SA",   path: "/finance/statement-of-account",                icon: FileText            },
      { label: "Bank Reconciliation",  short: "BR",   path: "/finance/bank-reconciliation",                 icon: Landmark            },
    ],
  },
  {
    group: "Operations",
    items: [
      { label: "Accounts Payable",     short: "AP",   path: "/finance/accounts-payable",                    icon: CreditCard          },
      { label: "Accounts Receivable",  short: "AR",   path: "/finance/accounts-received",                   icon: ReceiptText         },
      { label: "Work in Progress",     short: "WIP",  path: "/finance/work-in-progress",                    icon: HardHat             },
      { label: "Change Orders",        short: "CO",   path: "/finance/change-orders-tracking",              icon: GitPullRequestArrow },
      { label: "Inventory",            short: "INV",  path: "/finance/inventory",                           icon: Package             },
      { label: "Invoices",             short: "INV",  path: "/finance/invoices",                            icon: Receipt             },
    ],
  },
  {
    group: "Assets & Tax",
    items: [
      { label: "Fixed Assets",         short: "FA",   path: "/finance/fixed-asset-equipment-depreciation",  icon: Wrench              },
      { label: "Loans",                short: "LN",   path: "/finance/loans",                               icon: Banknote            },
      { label: "Taxes",                short: "TAX",  path: "/finance/taxes",                               icon: Receipt             },
    ],
  },
  {
    group: "Payroll",
    items: [
      { label: "Job Costing",          short: "JC",   path: "/finance/job-costing",                         icon: Briefcase           },
      { label: "Payroll Checklist",    short: "PC",   path: "/finance/payroll-checklist",                   icon: ClipboardList       },
    ],
  },
  {
    group: "Closing",
    items: [
      { label: "Month-End Checklist",  short: "MEC",  path: "/finance/end-month-close-checklist",           icon: CalendarCheck       },
    ],
  },
];

const allItems = financeRoutes.flatMap((g) => g.items);

const FinanceLayout = ({ children }: FinanceLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) setMobileOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const activeItem = allItems.find((item) => location.pathname === item.path);

  // ─── Sidebar nav content (shared between desktop + mobile drawer) ───────────
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">

      {/* ── Brand ── */}
      <div className="px-4 py-5 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <Link
            to="/finance/dashboard"
            className="flex items-center gap-3 group"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
              <TrendingUp className="w-5 h-5 text-background" />
            </div>
            {(sidebarOpen || isMobile) && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col overflow-hidden"
              >
                <span className="font-bold text-sm leading-tight text-foreground">
                  Accounts
                </span>
                <span className="text-xs text-muted-foreground">
                  Reve Construct
                </span>
              </motion.div>
            )}
          </Link>

          {/* Close button — mobile drawer only */}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3">
        {financeRoutes.map((group) => (
          <div key={group.group}>

            {/* Group label — expanded desktop or any mobile */}
            {(sidebarOpen || isMobile) && (
              <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/40 px-3 mb-1 mt-1">
                {group.group}
              </p>
            )}

            {/* Divider when collapsed desktop (non-Overview) */}
            {!sidebarOpen && !isMobile && group.group !== "Overview" && (
              <div className="mx-3 my-2 h-px bg-border/50" />
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                const collapsed = !sidebarOpen && !isMobile;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      relative flex items-center gap-3 rounded-lg transition-all duration-200 group
                      ${collapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2.5"}
                      ${isActive
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      }
                    `}
                  >
                    {/* Active left bar */}
                    {isActive && (
                      <motion.div
                        layoutId={isMobile ? "mobileActiveBar" : "financeActiveBar"}
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full"
                      />
                    )}

                    {/* Collapsed desktop: icon + tooltip only */}
                    {collapsed ? (
                      <span
                        title={item.label}
                        className={`
                          w-8 h-8 flex items-center justify-center rounded-md transition-all
                          ${isActive
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground group-hover:text-foreground group-hover:bg-white/8"
                          }
                        `}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                    ) : (
                      <>
                        {/* Icon badge */}
                        <span
                          className={`
                            w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md transition-all
                            ${isActive
                              ? "bg-primary/20 text-primary"
                              : "bg-white/5 text-muted-foreground group-hover:bg-white/10 group-hover:text-foreground"
                            }
                          `}
                        >
                          <Icon className="w-4 h-4" />
                        </span>

                        {/* Label */}
                        <span className="text-sm font-medium truncate flex-1">
                          {item.label}
                        </span>

                        {/* Active chevron */}
                        {isActive && (
                          <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="px-2 py-3 border-t border-border flex-shrink-0 space-y-0.5">
        <Link
          to="/"
          className={`
            flex items-center gap-3 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all text-sm
            ${!sidebarOpen && !isMobile ? "px-2 py-2.5 justify-center" : "px-3 py-2.5"}
          `}
        >
          <span
            title="View Site"
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md bg-white/5 text-xs font-bold"
          >
            ↗
          </span>
          {(sidebarOpen || isMobile) && <span className="font-medium">View Site</span>}
        </Link>

        <Link
          to="/policies"
          className={`
            flex items-center gap-3 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all text-sm
            ${!sidebarOpen && !isMobile ? "px-2 py-2.5 justify-center" : "px-3 py-2.5"}
          `}
        >
          <span
            title="Policies"
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md bg-white/5"
          >
            <ScrollText className="w-4 h-4" />
          </span>
          {(sidebarOpen || isMobile) && <span className="font-medium">Policies</span>}
        </Link>

        <button
          onClick={handleLogout}
          className={`
            w-full flex items-center gap-3 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all text-sm
            ${!sidebarOpen && !isMobile ? "px-2 py-2.5 justify-center" : "px-3 py-2.5"}
          `}
        >
          <span
            title="Logout"
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md bg-white/5"
          >
            <LogOut className="w-4 h-4" />
          </span>
          {(sidebarOpen || isMobile) && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">

      {/* ════════════════════════════════════════
          DESKTOP SIDEBAR  (lg+)
      ════════════════════════════════════════ */}
      <motion.aside
        animate={{ width: sidebarOpen ? 240 : 72 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="hidden lg:flex flex-col fixed left-0 top-0 h-screen z-40 glass-strong border-r border-border overflow-hidden flex-shrink-0"
        style={{ minWidth: sidebarOpen ? 240 : 72 }}
      >
        <SidebarContent />
      </motion.aside>

      {/* ════════════════════════════════════════
          MOBILE OVERLAY + FULL DRAWER  (< lg)
      ════════════════════════════════════════ */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer — full expanded with labels, never collapsed */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed left-0 top-0 h-screen w-72 max-w-[85vw] z-50 glass-strong border-r border-border lg:hidden flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <SidebarContent isMobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════
          DESKTOP MAIN CONTENT  (lg+)
      ════════════════════════════════════════ */}
      <motion.div
        animate={{ marginLeft: sidebarOpen ? 240 : 72 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="hidden lg:flex flex-col flex-1 min-h-screen overflow-hidden"
      >
        {/* Topbar */}
        <header className="glass border-b border-border px-6 h-14 flex items-center flex-shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4 w-full">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-muted-foreground flex-shrink-0">Accounts</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
              <span className="text-foreground font-medium truncate">
                {activeItem?.label ?? "Dashboard"}
              </span>
            </div>

            {/* Right */}
            <div className="ml-auto flex items-center gap-4 flex-shrink-0">
              <Link
                to="/"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                View Site
              </Link>
              <div className="w-9 h-9 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-background font-bold text-sm">RC</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            {children}
          </motion.div>
        </main>
      </motion.div>

      {/* ════════════════════════════════════════
          MOBILE LAYOUT  (< lg)
      ════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col flex-1 min-h-screen w-full overflow-hidden">

        {/* Mobile topbar */}
        <header className="glass border-b border-border px-4 h-14 flex items-center flex-shrink-0 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground mr-3 flex-shrink-0"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb — truncates cleanly */}
          <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
            <span className="text-muted-foreground flex-shrink-0 text-xs">Accounts</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
            <span className="text-foreground font-medium truncate text-sm">
              {activeItem?.label ?? "Dashboard"}
            </span>
          </div>

          <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
            <span className="text-background font-bold text-xs">RC</span>
          </div>
        </header>

        {/* ── Mobile horizontal tab strip ──
            Scrollable pill row; uses native scroll for zero-jank feel on iOS */}
        <div
          id="mobile-nav"
          className="glass border-b border-border flex-shrink-0"
          style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
        >
          <div
            className="flex gap-1.5 px-4 py-2"
            style={{ minWidth: "max-content" }}
          >
            {allItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-semibold
                    transition-all duration-150 select-none
                    ${isActive
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                    }
                  `}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {item.short}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Mobile page content */}
        <main className="flex-1 overflow-y-auto p-4 w-full">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default FinanceLayout;