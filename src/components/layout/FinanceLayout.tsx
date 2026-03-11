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
} from "lucide-react";
import { useState } from "react";

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
      { label: "Chart of Accounts",    short: "CoA",  path: "/finance/chart-of-accounts",               icon: BookOpen            },
      { label: "Balance Sheet",        short: "BS",   path: "/finance/balance-sheet",                    icon: LayoutGrid          },
      { label: "Income Statement",     short: "IS",   path: "/finance/income-statement",                 icon: TrendingUp          },
      { label: "Cash Flow",            short: "CF",   path: "/finance/cash-flow",                        icon: Droplets            },
      { label: "Statement of Account", short: "SA",   path: "/finance/statement-of-account",             icon: FileText            },
      { label: "Bank Reconciliation",  short: "BR",   path: "/finance/bank-reconciliation",              icon: Landmark            },
    ],
  },
  {
    group: "Operations",
    items: [
      { label: "Accounts Payable",     short: "AP",   path: "/finance/accounts-payable",                 icon: CreditCard          },
      { label: "Accounts Receivable",  short: "AR",   path: "/finance/accounts-received",                icon: ReceiptText         },
      { label: "Work in Progress",     short: "WIP",  path: "/finance/work-in-progress",                 icon: HardHat             },
      { label: "Change Orders",        short: "CO",   path: "/finance/change-orders-tracking",           icon: GitPullRequestArrow },
      { label: "Inventory",            short: "INV",  path: "/finance/inventory",                        icon: Package             },
      {label: "invoices",              short: "INV",  path: "/finance/invoices",                         icon: Receipt             },
    ],
  },
  {
    group: "Assets & Tax",
    items: [
      { label: "Fixed Assets",         short: "FA",   path: "/finance/fixed-asset-equipment-depreciation", icon: Wrench            },
      { label: "Loans",                short: "LN",   path: "/finance/loans",                            icon: Banknote            },
      { label: "Taxes",                short: "TAX",  path: "/finance/taxes",                            icon: Receipt             },
    ],
  },
  {
    group: "Payroll",
    items: [
      { label: "Job Costing",          short: "JC",   path: "/finance/job-posting",                      icon: Briefcase           },
      { label: "Payroll Checklist",    short: "PC",   path: "/finance/payroll-checklist",                icon: ClipboardList       },
    ],
  },
  {
    group: "Closing",
    items: [
      { label: "Month-End Checklist",  short: "MEC",  path: "/finance/end-month-close-checklist",        icon: CalendarCheck       },
    ],
  },
];

const allItems = financeRoutes.flatMap((g) => g.items);

const FinanceLayout = ({ children }: FinanceLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const activeItem = allItems.find((item) => location.pathname === item.path);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">

      {/* ── Brand ── */}
      <div className="px-4 py-5 border-b border-border flex-shrink-0">
        <Link
          to="/finance/dashboard"
          className="flex items-center gap-3 group"
          onClick={() => setMobileOpen(false)}
        >
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
            <TrendingUp className="w-5 h-5 text-background" />
          </div>
          {sidebarOpen && (
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
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3">
        {financeRoutes.map((group) => (
          <div key={group.group}>

            {/* Group label — only when expanded */}
            {sidebarOpen && (
              <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/40 px-3 mb-1 mt-1">
                {group.group}
              </p>
            )}

            {/* Divider when collapsed, skip Overview group */}
            {!sidebarOpen && group.group !== "Overview" && (
              <div className="mx-3 my-2 h-px bg-border/50" />
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      relative flex items-center gap-3 rounded-lg transition-all duration-200 group
                      ${sidebarOpen ? "px-3 py-2.5" : "px-2 py-2.5 justify-center"}
                      ${isActive
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      }
                    `}
                  >
                    {/* Active left bar */}
                    {isActive && (
                      <motion.div
                        layoutId="financeActiveBar"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full"
                      />
                    )}

                    {/* Collapsed: icon only with tooltip */}
                    {!sidebarOpen ? (
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
            ${sidebarOpen ? "px-3 py-2.5" : "px-2 py-2.5 justify-center"}
          `}
        >
          <span
            title="View Site"
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md bg-white/5 text-xs font-bold"
          >
            ↗
          </span>
          {sidebarOpen && <span className="font-medium">View Site</span>}
        </Link>

        <Link
          to="/policies"
          className={`
            flex items-center gap-3 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all text-sm
            ${sidebarOpen ? "px-3 py-2.5" : "px-2 py-2.5 justify-center"}
          `}
        >
          <span
            title="Policies"
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md bg-white/5"
          >
            <ScrollText className="w-4 h-4" />
          </span>
          {sidebarOpen && <span className="font-medium">Policies</span>}
        </Link>

        <button
          onClick={handleLogout}
          className={`
            w-full flex items-center gap-3 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all text-sm
            ${sidebarOpen ? "px-3 py-2.5" : "px-2 py-2.5 justify-center"}
          `}
        >
          <span
            title="Logout"
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md bg-white/5"
          >
            <LogOut className="w-4 h-4" />
          </span>
          {sidebarOpen && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">

      {/* ════════════════════════════════════════
          DESKTOP SIDEBAR
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
          MOBILE OVERLAY + DRAWER
      ════════════════════════════════════════ */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed left-0 top-0 h-screen w-64 z-50 glass-strong border-r border-border lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════
          DESKTOP MAIN CONTENT
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
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Accounts</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
              <span className="text-foreground font-medium">
                {activeItem?.label ?? "Dashboard"}
              </span>
            </div>

            {/* Right */}
            <div className="ml-auto flex items-center gap-4">
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
          MOBILE LAYOUT
      ════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col flex-1 min-h-screen">
        {/* Mobile topbar */}
        <header className="glass border-b border-border px-4 h-14 flex items-center flex-shrink-0 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-white/5 transition-all text-muted-foreground hover:text-foreground mr-3"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
            <span className="text-muted-foreground flex-shrink-0">Accounts</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
            <span className="text-foreground font-medium truncate">
              {activeItem?.label ?? "Dashboard"}
            </span>
          </div>

          <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
            <span className="text-background font-bold text-xs">RC</span>
          </div>
        </header>

        {/* ── Mobile tab strip ── */}
        {/* overflow-x-auto on the outer div, min-w-max on inner so pills never wrap or disappear */}
        <div className="glass border-b border-border" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ display: "flex", gap: "4px", padding: "8px 16px", minWidth: "max-content" }}>
            {allItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    textDecoration: "none",
                    transition: "all 0.15s",
                    border: isActive ? "1px solid rgba(var(--primary), 0.3)" : "1px solid transparent",
                    backgroundColor: isActive ? "rgba(var(--primary), 0.15)" : "transparent",
                    color: isActive ? "rgb(var(--primary))" : "#94a3b8",
                  }}
                >
                  {item.short}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Mobile page */}
        <main className="flex-1 overflow-y-auto p-4">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default FinanceLayout;