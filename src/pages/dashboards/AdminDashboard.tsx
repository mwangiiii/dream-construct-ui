import { motion } from "framer-motion";
import { 
  BarChart3, 
  Building2, 
  FileText, 
  Image as ImageIcon, 
  MessageSquare, 
  Settings, 
  Shield, 
  Users 
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const stats = [
    { label: "Total Users", value: "247", change: "+12%", icon: Users },
    { label: "Active Projects", value: "24", change: "+8%", icon: Building2 },
    { label: "Pending Inquiries", value: "8", change: "-3%", icon: MessageSquare },
    { label: "Revenue (MTD)", value: "$2.4M", change: "+23%", icon: BarChart3 },
  ];

  const quickActions = [
    {
      title: "User Management",
      description: "Manage clients, managers, and PMs",
      icon: Users,
      link: "/admin/users",
      color: "bg-blue-500/10 text-blue-500",
    },
    {
      title: "Projects",
      description: "Create and assign projects",
      icon: Building2,
      link: "/admin/projects",
      color: "bg-green-500/10 text-green-500",
    },
    {
      title: "Hero Slider",
      description: "Manage homepage images",
      icon: ImageIcon,
      link: "/admin/hero",
      color: "bg-purple-500/10 text-purple-500",
    },
    {
      title: "Services",
      description: "Edit company services",
      icon: Settings,
      link: "/admin/services",
      color: "bg-orange-500/10 text-orange-500",
    },
    {
      title: "Team Members",
      description: "Manage team profiles",
      icon: Shield,
      link: "/admin/team",
      color: "bg-pink-500/10 text-pink-500",
    },
    {
      title: "Company Info",
      description: "Update mission, vision, values",
      icon: FileText,
      link: "/admin/company",
      color: "bg-cyan-500/10 text-cyan-500",
    },
    {
      title: "Inquiries",
      description: "View and respond to inquiries",
      icon: MessageSquare,
      link: "/admin/inquiries",
      color: "bg-amber-500/10 text-amber-500",
    },
    {
      title: "Audit Logs",
      description: "View system activity",
      icon: BarChart3,
      link: "/admin/audit",
      color: "bg-red-500/10 text-red-500",
    },
  ];

  const recentActivities = [
    { user: "John Smith (PM)", action: "uploaded 5 photos", project: "Skyline Tower", time: "10 min ago" },
    { user: "Sarah Johnson (Manager)", action: "approved progress update", project: "Harbor Bridge", time: "1 hour ago" },
    { user: "Mike Chen (Client)", action: "sent an inquiry", project: "Tech Campus", time: "2 hours ago" },
  ];

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Comprehensive system management and oversight</p>
        </div>

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
                  <span className={`text-sm font-medium ${
                    stat.change.startsWith('+') ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {stat.change}
                  </span>
                </div>
                <div className="text-3xl font-bold mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, idx) => (
              <motion.div
                key={action.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + idx * 0.05 }}
              >
                <Link to={action.link}>
                  <GlassCard className="h-full">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${action.color}`}>
                      <action.icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold mb-1">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </GlassCard>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h2 className="text-2xl font-bold mb-6">Recent Activity</h2>
          <GlassCard>
            <div className="space-y-4">
              {recentActivities.map((activity, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 glass rounded-lg"
                >
                  <div>
                    <div className="font-semibold mb-1">
                      {activity.user} {activity.action}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {activity.project}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {activity.time}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
