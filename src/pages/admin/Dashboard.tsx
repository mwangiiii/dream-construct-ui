import { motion } from "framer-motion";
import { BarChart3, Users, Briefcase, Settings, FileText, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

const Dashboard = () => {
  const stats = [
    { label: "Active Projects", value: "24", change: "+12%", icon: Briefcase },
    { label: "Total Users", value: "1,247", change: "+8%", icon: Users },
    { label: "Revenue", value: "$2.4M", change: "+23%", icon: TrendingUp },
    { label: "Completion Rate", value: "94%", change: "+5%", icon: BarChart3 },
  ];

  const recentProjects = [
    { name: "Skyline Tower", status: "In Progress", progress: 65 },
    { name: "Metro Plaza", status: "Planning", progress: 20 },
    { name: "Harbor Bridge", status: "In Progress", progress: 45 },
    { name: "Tech Campus", status: "Review", progress: 85 },
  ];

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, Admin</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <GlassCard>
              <div className="flex items-start justify-between mb-4">
                <stat.icon className="w-8 h-8 text-primary" />
                <span className="text-sm text-green-500">{stat.change}</span>
              </div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Recent Projects */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <GlassCard className="p-6">
          <h2 className="text-2xl font-bold mb-6">Recent Projects</h2>
          <div className="space-y-4">
            {recentProjects.map((project) => (
              <div key={project.name} className="flex items-center justify-between p-4 glass rounded-lg">
                <div>
                  <div className="font-semibold">{project.name}</div>
                  <div className="text-sm text-muted-foreground">{project.status}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{project.progress}%</div>
                  <div className="w-24 h-2 bg-muted rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default Dashboard;
