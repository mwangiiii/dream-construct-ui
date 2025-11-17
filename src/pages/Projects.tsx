import { motion } from "framer-motion";
import { CheckCircle2, Clock, AlertCircle, TrendingUp } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { Progress } from "@/components/ui/progress";

const Projects = () => {
  const projectProgress = {
    name: "Skyline Commercial Center",
    client: "Metro Developments Inc.",
    status: "In Progress",
    completion: 65,
    startDate: "Jan 2024",
    estimatedCompletion: "Dec 2024",
  };

  const milestones = [
    {
      phase: "Foundation & Site Preparation",
      status: "completed",
      completion: 100,
      date: "Feb 2024",
    },
    {
      phase: "Structural Framework",
      status: "completed",
      completion: 100,
      date: "Apr 2024",
    },
    {
      phase: "Exterior Construction",
      status: "in-progress",
      completion: 75,
      date: "Ongoing",
    },
    {
      phase: "Interior Work",
      status: "in-progress",
      completion: 45,
      date: "Ongoing",
    },
    {
      phase: "MEP Systems Installation",
      status: "upcoming",
      completion: 20,
      date: "Aug 2024",
    },
    {
      phase: "Finishing & Details",
      status: "upcoming",
      completion: 0,
      date: "Oct 2024",
    },
  ];

  const updates = [
    {
      date: "May 15, 2024",
      title: "Exterior Cladding Complete",
      description: "Successfully completed the installation of premium glass and aluminum cladding on the north and east facades.",
    },
    {
      date: "May 8, 2024",
      title: "HVAC Systems Installed",
      description: "Major HVAC equipment installed on all floors. System testing scheduled for next week.",
    },
    {
      date: "May 1, 2024",
      title: "Interior Drywall 60% Complete",
      description: "Drywall installation progressing ahead of schedule across floors 3-8.",
    },
  ];

  const statusConfig = {
    completed: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/20" },
    "in-progress": { icon: Clock, color: "text-primary", bg: "bg-primary/20" },
    upcoming: { icon: AlertCircle, color: "text-muted-foreground", bg: "bg-muted" },
  };

  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-6">
        <SectionHeading
          title="Project Progress"
          subtitle="Real-time insights into your construction project"
          className="mb-16"
        />

        {/* Project Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <GlassCard className="p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold mb-2">{projectProgress.name}</h2>
                <p className="text-muted-foreground">Client: {projectProgress.client}</p>
              </div>
              <div className="mt-4 lg:mt-0 flex items-center space-x-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{projectProgress.completion}%</div>
                  <div className="text-sm text-muted-foreground">Complete</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className="font-medium">{projectProgress.completion}%</span>
                </div>
                <Progress value={projectProgress.completion} className="h-3" />
              </div>

              <div className="grid md:grid-cols-3 gap-4 pt-4">
                <div className="glass rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Start Date</div>
                  <div className="font-semibold">{projectProgress.startDate}</div>
                </div>
                <div className="glass rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Est. Completion</div>
                  <div className="font-semibold">{projectProgress.estimatedCompletion}</div>
                </div>
                <div className="glass rounded-lg p-4">
                  <div className="text-sm text-muted-foreground mb-1">Status</div>
                  <div className="font-semibold text-primary">{projectProgress.status}</div>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Milestones Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <h3 className="text-2xl font-bold mb-6">Project Milestones</h3>
          <div className="space-y-4">
            {milestones.map((milestone, idx) => {
              const config = statusConfig[milestone.status as keyof typeof statusConfig];
              const StatusIcon = config.icon;

              return (
                <motion.div
                  key={milestone.phase}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <GlassCard className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                        <StatusIcon className={`w-6 h-6 ${config.color}`} />
                      </div>
                      <div className="flex-grow">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3">
                          <h4 className="text-lg font-semibold">{milestone.phase}</h4>
                          <span className="text-sm text-muted-foreground mt-1 md:mt-0">
                            {milestone.date}
                          </span>
                        </div>
                        <Progress value={milestone.completion} className="h-2 mb-2" />
                        <div className="text-sm text-muted-foreground">
                          {milestone.completion}% Complete
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Recent Updates */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h3 className="text-2xl font-bold mb-6">Recent Updates</h3>
          <div className="space-y-4">
            {updates.map((update, idx) => (
              <motion.div
                key={update.date}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <GlassCard className="p-6">
                  <div className="flex items-start gap-4">
                    <TrendingUp className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
                        <h4 className="font-semibold">{update.title}</h4>
                        <span className="text-sm text-muted-foreground mt-1 md:mt-0">
                          {update.date}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{update.description}</p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Projects;
