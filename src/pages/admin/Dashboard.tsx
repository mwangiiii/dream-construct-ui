
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { Briefcase, Users, FileText, Settings, TrendingUp, BarChart3, BookText } from "lucide-react";
import { Link } from "react-router-dom";

const adminSections = [
  { label: "Users", icon: Users, path: "/admin/users" },
  { label: "Projects", icon: Briefcase, path: "/admin/projects" },
    // { label: "Documents", icon: FileText, path: "/admin/documents" },
  // { label: "Reports", icon: BarChart3, path: "/admin/reports" },
  { label: "Content", icon: BookText, path: "/admin/content" },
  { label: "Settings", icon: Settings, path: "/admin/settings" },
  
];

const Dashboard = () => {
  return (
    <div className="px-2 sm:px-4 md:px-8 py-6 min-h-screen bg-gradient-to-br from-background/95 via-background/98 to-background flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 sm:mb-10 md:mb-12"
      >
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-base sm:text-lg md:text-xl">Welcome back, Admin</p>
      </motion.div>

      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8 w-full max-w-7xl mx-auto">
        {adminSections.map((section, idx) => (
          <motion.div
            key={section.label}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Link to={section.path} className="focus:outline-none w-full block">
              <GlassCard className="flex flex-col items-center justify-center w-full h-full p-6 sm:p-8 md:p-10 cursor-pointer hover:shadow-xl hover:border-primary/40 transition-all duration-300 border border-white/10 hover:bg-gradient-to-br hover:from-primary/5 hover:to-accent/5">
                <section.icon className="w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-4 text-primary" />
                <span className="text-lg sm:text-xl md:text-2xl font-semibold mb-1 sm:mb-2 tracking-tight" style={{ fontFamily: 'SF Pro Display, Inter, sans-serif' }}>{section.label}</span>
                <span className="text-muted-foreground text-xs sm:text-sm">Go to {section.label}</span>
              </GlassCard>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
