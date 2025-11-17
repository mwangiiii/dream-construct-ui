import { ReactNode } from "react";
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
} from "lucide-react";
import { useState } from "react";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
    { icon: Users, label: "Users", path: "/admin/users" },
    { icon: Briefcase, label: "Projects", path: "/admin/projects" },
    { icon: FileText, label: "Content", path: "/admin/content" },
    { icon: Settings, label: "Settings", path: "/admin/settings" },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className={`${
          isSidebarOpen ? "w-64" : "w-20"
        } glass-strong border-r border-border transition-all duration-300 fixed h-full z-40`}
      >
        <div className="p-6">
          <Link to="/admin" className="flex items-center space-x-2 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <span className="text-background font-bold text-xl">DC</span>
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col">
                <span className="font-bold leading-tight">Admin Panel</span>
                <span className="text-xs text-muted-foreground">Dream Construct</span>
              </div>
            )}
          </Link>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {isSidebarOpen && <span className="font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="absolute bottom-6 left-0 right-0 px-6">
          <button className="flex items-center space-x-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-white/5 w-full transition-all">
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className={`flex-1 ${isSidebarOpen ? "ml-64" : "ml-20"} transition-all duration-300`}>
        <header className="glass border-b border-border p-6 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/5 rounded-lg transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
                View Site
              </Link>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30" />
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
