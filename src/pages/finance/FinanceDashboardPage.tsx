import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  BookOpen,
  LayoutGrid,
  TrendingUp,
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
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeading } from "@/components/ui/SectionHeading";

// ─── Route definitions with icons, groups, and accent colours ─────────────────
const financeGroups = [
  {
    group: "Accounting",
    description: "Core financial statements and ledger management",
    items: [
      {
        label: "Chart of Accounts",
        short: "CoA",
        path: "/finance/chart-of-accounts",
        icon: BookOpen,
        accent: "from-primary/30 to-accent/20",
        iconColor: "text-primary",
        desc: "Manage your full ledger structure",
      },
      {
        label: "Balance Sheet",
        short: "BS",
        path: "/finance/balance-sheet",
        icon: LayoutGrid,
        accent: "from-primary/30 to-accent/20",
        iconColor: "text-primary",
        desc: "Assets, liabilities & equity snapshot",
      },
      {
        label: "Income Statement",
        short: "IS",
        path: "/finance/income-statement",
        icon: TrendingUp,
        accent: "from-primary/30 to-accent/20",
        iconColor: "text-primary",
        desc: "Revenue and expense overview",
      },
      {
        label: "Cash Flow",
        short: "CF",
        path: "/finance/cash-flow",
        icon: Droplets,
        accent: "from-primary/30 to-accent/20",
        iconColor: "text-primary",
        desc: "Track cash movements in & out",
      },
      {
        label: "Statement of Account",
        short: "SA",
        path: "/finance/statement-of-account",
        icon: FileText,
        accent: "from-primary/30 to-accent/20",
        iconColor: "text-primary",
        desc: "Client account transaction history",
      },
      {
        label: "Bank Reconciliation",
        short: "BR",
        path: "/finance/bank-reconciliation",
        icon: Landmark,
        accent: "from-primary/30 to-accent/20",
        iconColor: "text-primary",
        desc: "Match bank records to books",
      },
    ],
  },
  {
    group: "Operations",
    description: "Day-to-day financial operations and project tracking",
    items: [
      {
        label: "Accounts Payable",
        short: "AP",
        path: "/finance/accounts-payable",
        icon: CreditCard,
        accent: "from-accent/30 to-primary/20",
        iconColor: "text-accent",
        desc: "Manage vendor bills & payments",
      },
      {
        label: "Accounts Receivable",
        short: "AR",
        path: "/finance/accounts-received",
        icon: ReceiptText,
        accent: "from-accent/30 to-primary/20",
        iconColor: "text-accent",
        desc: "Track client invoices & receipts",
      },
      {
        label: "Invoices",
        short: "INV",
        path: "/finance/invoices",
        icon: Receipt,
        accent: "from-accent/30 to-primary/20",
        iconColor: "text-accent",
        desc: "Project invoices & billing",
      },
      {
        label: "Work in Progress",
        short: "WIP",
        path: "/finance/work-in-progress",
        icon: HardHat,
        accent: "from-accent/30 to-primary/20",
        iconColor: "text-accent",
        desc: "Monitor active project financials",
      },
      {
        label: "Change Orders",
        short: "CO",
        path: "/finance/change-orders-tracking",
        icon: GitPullRequestArrow,
        accent: "from-accent/30 to-primary/20",
        iconColor: "text-accent",
        desc: "Track scope & cost changes",
      },
      {
        label: "Inventory",
        short: "INV",
        path: "/finance/inventory",
        icon: Package,
        accent: "from-accent/30 to-primary/20",
        iconColor: "text-accent",
        desc: "Materials & stock management",
      },
    ],
  },
  {
    group: "Assets & Tax",
    description: "Long-term asset management and tax obligations",
    items: [
      {
        label: "Fixed Assets",
        short: "FA",
        path: "/finance/fixed-asset-equipment-depreciation",
        icon: Wrench,
        accent: "from-primary/20 to-accent/30",
        iconColor: "text-primary",
        desc: "Equipment & depreciation schedules",
      },
      {
        label: "Loans",
        short: "LN",
        path: "/finance/loans",
        icon: Banknote,
        accent: "from-primary/20 to-accent/30",
        iconColor: "text-primary",
        desc: "Loan schedules & repayments",
      },
      {
        label: "Taxes",
        short: "TAX",
        path: "/finance/taxes",
        icon: Receipt,
        accent: "from-primary/20 to-accent/30",
        iconColor: "text-primary",
        desc: "Tax filings & obligations",
      },
    ],
  },
  {
    group: "Payroll",
    description: "Workforce compensation and job management",
    items: [
      {
        label: "Job Posting",
        short: "JP",
        path: "/finance/job-posting",
        icon: Briefcase,
        accent: "from-accent/20 to-primary/30",
        iconColor: "text-accent",
        desc: "Post and manage open positions",
      },
      {
        label: "Payroll Checklist",
        short: "PC",
        path: "/finance/payroll-checklist",
        icon: ClipboardList,
        accent: "from-accent/20 to-primary/30",
        iconColor: "text-accent",
        desc: "Run payroll with confidence",
      },
    ],
  },
  {
    group: "Closing",
    description: "Period-end procedures and financial close",
    items: [
      {
        label: "Month-End Checklist",
        short: "MEC",
        path: "/finance/end-month-close-checklist",
        icon: CalendarCheck,
        accent: "from-primary/30 to-accent/20",
        iconColor: "text-primary",
        desc: "Complete your monthly close tasks",
      },
    ],
  },
];

// All short tags in order for the footer bar
const allTags = financeGroups.flatMap((g) => g.items.map((i) => i.short));
const highlightedTags = ["CoA", "BS", "IS", "CF", "AP", "AR", "WIP"];

// ─── Stagger animation variants ───────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

// ─── Single tile component ─────────────────────────────────────────────────────
const FinanceTile = ({
  item,
}: {
  item: (typeof financeGroups)[0]["items"][0];
}) => {
  const Icon = item.icon;

  return (
    <motion.div variants={cardVariants}>
      <Link to={item.path} className="block h-full group">
        <div
          className={`
            relative h-full p-6 border border-border rounded-2xl
            bg-gradient-to-br ${item.accent}
            backdrop-blur-sm overflow-hidden
            transition-all duration-300
            hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10
            hover:-translate-y-1 hover:scale-[1.02]
            cursor-pointer
          `}
        >
          {/* Subtle corner glow */}
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-primary/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Short badge */}
          <span className="absolute top-4 right-4 text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50 group-hover:text-primary/60 transition-colors">
            {item.short}
          </span>

          {/* Icon */}
          <div
            className={`
              w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20
              flex items-center justify-center mb-4
              group-hover:scale-110 transition-transform duration-300
            `}
          >
            <Icon className={`w-6 h-6 ${item.iconColor}`} />
          </div>

          {/* Label */}
          <h3 className="font-bold text-base leading-tight mb-1 text-foreground group-hover:text-primary transition-colors">
            {item.label}
          </h3>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {item.desc}
          </p>

          {/* Bottom arrow indicator */}
          <div className="mt-4 flex items-center gap-1 text-primary/0 group-hover:text-primary/70 transition-all duration-300 translate-x-0 group-hover:translate-x-1">
            <span className="text-xs font-medium">Open</span>
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

// ─── Main Dashboard Page ───────────────────────────────────────────────────────
const FinanceDashboardPage = () => {
  const totalModules = financeGroups.reduce(
    (acc, g) => acc + g.items.length,
    0
  );

  return (
    <div className="min-h-screen pb-20">
      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-12"
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-2">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground/60 mb-2">
              Reve Construct Accounts
            </p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Accounts{" "}
              <span className="text-primary">Dashboard</span>
            </h1>
          </div>

          {/* Quick stats pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-white/5 text-sm">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-muted-foreground">
                <span className="text-foreground font-semibold">{totalModules}</span> modules
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-white/5 text-sm">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-muted-foreground">
                <span className="text-foreground font-semibold">{financeGroups.length}</span> groups
              </span>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground max-w-xl mt-3">
          Select a module below to navigate directly to that section of your
          financial management system.
        </p>

        {/* Decorative divider */}
        <div className="mt-6 h-px bg-gradient-to-r from-primary/40 via-accent/20 to-transparent" />
      </motion.div>

      {/* ── Groups ── */}
      <div className="space-y-14">
        {financeGroups.map((group, groupIdx) => (
          <motion.section
            key={group.group}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: groupIdx * 0.05 }}
          >
            {/* Group heading */}
            <div className="flex items-baseline gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {group.group}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {group.description}
                </p>
              </div>
              <div className="ml-auto flex-shrink-0 px-3 py-1 rounded-full border border-border bg-white/5 text-xs text-muted-foreground">
                {group.items.length}{" "}
                {group.items.length === 1 ? "module" : "modules"}
              </div>
            </div>

            {/* Tiles grid */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
            >
              {group.items.map((item) => (
                <FinanceTile key={item.path} item={item} />
              ))}
            </motion.div>
          </motion.section>
        ))}
      </div>

      {/* ── Footer strip ── */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="mt-16 pt-8 border-t border-border"
      >
        {/* Info row inside GlassCard — no scrollable content here so overflow:hidden is safe */}
        <GlassCard className="p-6 mb-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Accounts Overview</p>
              <p className="text-sm text-muted-foreground">
                All {totalModules} financial modules • Reve Construct Limited
              </p>
            </div>
          </div>
        </GlassCard>

        {/*
          ── Tags bar ──
          Lives OUTSIDE GlassCard so no parent overflow:hidden can clip it.
          Uses fully hardcoded inline styles (no CSS variables) so colors are
          guaranteed to render visibly on every screen size and theme.
        */}
        <div
          style={{
            display: "flex",
            flexWrap: "nowrap",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "8px",
            WebkitOverflowScrolling: "touch",
            msOverflowStyle: "none",
          }}
        >
          {allTags.map((tag) => {
            const isHighlighted = highlightedTags.includes(tag);
            return (
              <span
                key={tag}
                style={{
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                  padding: "4px 12px",
                  borderRadius: "9999px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  border: isHighlighted
                    ? "1px solid rgba(234, 179, 8, 0.6)"
                    : "1px solid rgba(148, 163, 184, 0.3)",
                  backgroundColor: isHighlighted
                    ? "rgba(234, 179, 8, 0.15)"
                    : "rgba(148, 163, 184, 0.08)",
                  color: isHighlighted
                    ? "#eab308"
                    : "#94a3b8",
                  display: "inline-block",
                }}
              >
                {tag}
              </span>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default FinanceDashboardPage;