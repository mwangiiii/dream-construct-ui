
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { Briefcase, Users, FileText, Settings, TrendingUp, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

const adminSections = [
  { label: "Projects", icon: Briefcase, path: "/admin/projects" },
  { label: "Users", icon: Users, path: "/admin/users" },
  { label: "Documents", icon: FileText, path: "/admin/documents" },
  { label: "Reports", icon: BarChart3, path: "/admin/reports" },
  { label: "Settings", icon: Settings, path: "/admin/settings" },
];

const Dashboard = () => {
  return (
    <div className="p-8 min-h-screen bg-gradient-to-br from-background/95 via-background/98 to-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-xl">Welcome back, Admin</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {adminSections.map((section, idx) => (
          <motion.div
            key={section.label}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Link to={section.path} className="focus:outline-none">
              <GlassCard className="flex flex-col items-center justify-center p-10 cursor-pointer hover:shadow-xl hover:border-primary/40 transition-all duration-300 border border-white/10 hover:bg-gradient-to-br hover:from-primary/5 hover:to-accent/5">
                <section.icon className="w-12 h-12 mb-4 text-primary" />
                <span className="text-2xl font-semibold mb-2 tracking-tight" style={{ fontFamily: 'SF Pro Display, Inter, sans-serif' }}>{section.label}</span>
                <span className="text-muted-foreground text-sm">Go to {section.label}</span>
              </GlassCard>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
