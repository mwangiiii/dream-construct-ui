import { motion } from "framer-motion";
import { Bell, CheckCircle, Clock, FileText, Plus, Users, XCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

const ManagerDashboard = () => {
  // Mock data
  const projects = [
    {
      id: 1,
      name: "Skyline Tower",
      client: "Acme Corp",
      pm: "John Smith",
      progress: 45,
      status: "Active",
      pendingUpdates: 2,
    },
    {
      id: 2,
      name: "Harbor Bridge",
      client: "City Council",
      pm: "Sarah Johnson",
      progress: 78,
      status: "Active",
      pendingUpdates: 0,
    },
    {
      id: 3,
      name: "Tech Campus",
      client: "Innovation Labs",
      pm: "Mike Chen",
      progress: 92,
      status: "Near Completion",
      pendingUpdates: 1,
    },
  ];

  const pendingApprovals = [
    {
      id: 1,
      project: "Skyline Tower",
      update: "Foundation Complete - Phase 2",
      submittedBy: "John Smith",
      date: "2 hours ago",
    },
    {
      id: 2,
      project: "Tech Campus",
      update: "Electrical Installation Progress",
      submittedBy: "Mike Chen",
      date: "5 hours ago",
    },
  ];

  const stats = [
    { label: "Active Projects", value: "8", icon: FileText },
    { label: "Team Members", value: "24", icon: Users },
    { label: "Pending Approvals", value: "3", icon: Clock },
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
            <h1 className="text-4xl font-bold mb-2">Manager Dashboard</h1>
            <p className="text-muted-foreground">Oversee projects and approve updates</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="gap-2 relative">
              <Bell className="w-4 h-4" />
              Notifications
              <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center">
                3
              </Badge>
            </Button>
            <Link to="/manager/progress/add">
              <Button size="lg" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Progress
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
              <GlassCard>
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

        {/* Pending Approvals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold mb-4">Pending Approvals</h2>
          <GlassCard>
            <div className="space-y-4">
              {pendingApprovals.map((approval) => (
                <div
                  key={approval.id}
                  className="flex items-center justify-between p-4 glass rounded-lg"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{approval.update}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{approval.project}</span>
                      <span>•</span>
                      <span>By {approval.submittedBy}</span>
                      <span>•</span>
                      <span>{approval.date}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2 text-destructive">
                      <XCircle className="w-4 h-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* Projects Grid */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Your Projects</h2>
          <div className="grid gap-4">
            {projects.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + idx * 0.1 }}
              >
                <Link to={`/manager/project/${project.id}`}>
                  <GlassCard>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold">{project.name}</h3>
                          {project.pendingUpdates > 0 && (
                            <Badge variant="secondary">
                              {project.pendingUpdates} pending
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span>Client: {project.client}</span>
                          <span>•</span>
                          <span>PM: {project.pm}</span>
                        </div>
                        <div className="max-w-md">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="font-medium">Progress</span>
                            <span className="text-primary font-bold">{project.progress}%</span>
                          </div>
                          <Progress value={project.progress} className="h-2" />
                        </div>
                      </div>
                      <Button variant="ghost">View Details</Button>
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

export default ManagerDashboard;
