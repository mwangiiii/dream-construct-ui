import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Settings,
  FileText,
  LogOut,
  Menu,
  ScrollText,
} from "lucide-react";
import { useState } from "react";

// Shared sidebar width values
const SIDEBAR_WIDTH = {
  open: {
    base: "w-48",
    sm: "sm:w-64"
  },
  closed: {
    base: "w-16",
    sm: "sm:w-20"
  }
};
const SIDEBAR_MARGIN = {
  open: {
    base: "ml-48",
    sm: "sm:ml-64"
  },
  closed: {
    base: "ml-16",
    sm: "sm:ml-20"
  }
};

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
    { icon: Users, label: "Users", path: "/admin/users" },
    { icon: Briefcase, label: "Projects", path: "/admin/projects" },
    { icon: FileText, label: "Content", path: "/admin/content/media" },
    { icon: Settings, label: "Settings", path: "/admin/settings" },
    { icon: ScrollText, label: "Policies", path: "/policies" },
  ];

  // Determine sidebar width and margin classes
  const sidebarWidthClass = isSidebarOpen
    ? `${SIDEBAR_WIDTH.open.base} ${SIDEBAR_WIDTH.open.sm}`
    : `${SIDEBAR_WIDTH.closed.base} ${SIDEBAR_WIDTH.closed.sm}`;
  const sidebarMarginClass = isSidebarOpen
    ? `${SIDEBAR_MARGIN.open.base} ${SIDEBAR_MARGIN.open.sm}`
    : `${SIDEBAR_MARGIN.closed.base} ${SIDEBAR_MARGIN.closed.sm}`;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className={`${sidebarWidthClass} glass-strong border-r border-border transition-all duration-300 fixed h-screen z-40 flex flex-col`}
      >
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <Link to="/admin" className="flex items-center gap-1 sm:gap-2 mb-6 sm:mb-8">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <span className="text-background font-bold text-base sm:text-xl">DC</span>
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col">
                <span className="font-bold leading-tight text-sm sm:text-base">Admin Panel</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">Reve Construct</span>
              </div>
            )}
          </Link>

          <nav className="space-y-1 sm:space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3 rounded-lg transition-all text-sm sm:text-base ${
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  {isSidebarOpen && <span className="font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="px-3 sm:px-6 pb-3 sm:pb-6">
          <button
            className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3 rounded-lg text-muted-foreground hover:bg-white/5 w-full transition-all text-sm sm:text-base"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            {isSidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className={`flex-1 ${sidebarMarginClass} transition-all duration-300 h-screen overflow-y-auto`}>
        <header className="glass border-b border-border p-3 sm:p-6 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/5 rounded-lg transition-all"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link to="/" className="text-xs sm:text-sm text-muted-foreground hover:text-primary">
                View Site
              </Link>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <span className="text-background font-bold text-base sm:text-xl">RC</span>
              </div>
            </div>
          </div>
        </header>
        <main className="p-2 sm:p-6">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
