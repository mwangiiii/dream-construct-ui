import { motion } from "framer-motion";
import { Building2, Calendar, Clock, Image as ImageIcon, MessageSquare, Settings, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";

const ClientDashboard = () => {
  // Mock data - replace with API calls
  const projects = [
    {
      id: 1,
      name: "Luxury Residential Complex",
      progress: 65,
      status: "In Progress",
      timeline: "Expected: Dec 2025",
      stage: "Foundation Complete",
      image: "/placeholder.svg",
    },
    {
      id: 2,
      name: "Downtown Office Building",
      progress: 35,
      status: "In Progress",
      timeline: "Expected: Mar 2026",
      stage: "Structural Work",
      image: "/placeholder.svg",
    },
    {
      id: 3,
      name: "Retail Shopping Mall",
      progress: 90,
      status: "Near Completion",
      timeline: "Expected: Jan 2025",
      stage: "Interior Finishing",
      image: "/placeholder.svg",
    },
  ];

  const stats = [
    { label: "Active Projects", value: "3", icon: Building2 },
    { label: "Avg. Progress", value: "63%", icon: TrendingUp },
    { label: "Next Milestone", value: "5 days", icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">My Projects</h1>
            <p className="text-muted-foreground">Track your construction projects in real-time</p>
          </div>
          <div className="flex gap-3">
            <Link to="/client/messages">
              <Button variant="outline" size="lg" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Messages
              </Button>
            </Link>
            <Link to="/client/settings">
              <Button variant="outline" size="lg" className="gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <GlassCard className="h-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <stat.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Projects Grid */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Your Projects</h2>
          <div className="grid lg:grid-cols-2 gap-6">
            {projects.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
              >
                <Link to={`/client/project/${project.id}`}>
                  <GlassCard className="overflow-hidden">
                    <div className="aspect-video bg-muted rounded-lg mb-4 flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-muted-foreground" />
                    </div>
                    
                    <h3 className="text-xl font-bold mb-2">{project.name}</h3>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Clock className="w-4 h-4" />
                      {project.timeline}
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">{project.stage}</span>
                        <span className="text-primary font-bold">{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} className="h-2" />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        project.status === "In Progress" 
                          ? "bg-primary/10 text-primary" 
                          : "bg-green-500/10 text-green-500"
                      }`}>
                        {project.status}
                      </span>
                      <Button variant="ghost" size="sm" className="gap-2">
                        View Details
                      </Button>
                    </div>
                  </GlassCard>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ClientDashboard;
