import { motion } from "framer-motion";
import { Calendar, FileText, Image as ImageIcon, MessageSquare, Plus, Upload } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";

const PMDashboard = () => {
  // Mock data
  const projects = [
    {
      id: 1,
      name: "Skyline Tower",
      client: "Acme Corp",
      progress: 45,
      nextMilestone: "Frame Completion",
      dueDate: "Dec 15, 2024",
      recentUpdates: 3,
    },
    {
      id: 2,
      name: "Metro Plaza",
      client: "City Development",
      progress: 20,
      nextMilestone: "Foundation Pouring",
      dueDate: "Jan 8, 2025",
      recentUpdates: 1,
    },
  ];

  const recentActivities = [
    {
      id: 1,
      type: "update",
      message: "Uploaded 12 progress photos for Skyline Tower",
      time: "2 hours ago",
    },
    {
      id: 2,
      type: "milestone",
      message: "Foundation milestone completed for Metro Plaza",
      time: "Yesterday",
    },
    {
      id: 3,
      type: "message",
      message: "New message from Manager: Review needed",
      time: "2 days ago",
    },
  ];

  const stats = [
    { label: "Active Projects", value: "2", icon: FileText },
    { label: "Pending Updates", value: "4", icon: Upload },
    { label: "Upcoming Milestones", value: "3", icon: Calendar },
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
            <h1 className="text-4xl font-bold mb-2">Project Manager</h1>
            <p className="text-muted-foreground">Manage and update your construction projects</p>
          </div>
          <div className="flex gap-3">
            <Link to="/pm/messages">
              <Button variant="outline" size="lg" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Messages
              </Button>
            </Link>
            <Link to="/pm/update/new">
              <Button size="lg" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Update
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Projects */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-bold">Your Projects</h2>
            {projects.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
              >
                <Link to={`/pm/project/${project.id}`}>
                  <GlassCard>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold mb-1">{project.name}</h3>
                        <p className="text-sm text-muted-foreground">{project.client}</p>
                      </div>
                      <Button size="sm" variant="outline" className="gap-2">
                        <ImageIcon className="w-4 h-4" />
                        Upload Photos
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium">Overall Progress</span>
                          <span className="text-primary font-bold">{project.progress}%</span>
                        </div>
                        <Progress value={project.progress} className="h-2" />
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Next Milestone</p>
                          <p className="font-medium">{project.nextMilestone}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                          <p className="font-medium">{project.dueDate}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-border">
                        <span className="text-sm text-muted-foreground">
                          {project.recentUpdates} recent updates
                        </span>
                        <Button variant="ghost" size="sm">
                          Manage Project
                        </Button>
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Recent Activity */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Recent Activity</h2>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <GlassCard>
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="pb-4 last:pb-0 border-b last:border-b-0 border-border"
                    >
                      <p className="text-sm mb-1">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PMDashboard;
