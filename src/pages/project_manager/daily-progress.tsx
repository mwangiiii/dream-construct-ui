import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, CheckCircle, Clock, XCircle, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

const mockProgress = [
  {
    date: "2026-01-27",
    project: "Site A Foundation",
    tasks: [
      { name: "Excavation", status: "Completed" },
      { name: "Concrete Pouring", status: "In Progress" },
    ],
    notes: "Concrete pouring delayed by rain."
  },
  {
    date: "2026-01-27",
    project: "Site B Plumbing",
    tasks: [
      { name: "Pipe Laying", status: "Completed" },
      { name: "Inspection", status: "Pending" },
    ],
    notes: "Inspection scheduled for tomorrow."
  }
];

const statusMap = {
  "Completed": {
    color: "text-green-600",
    icon: CheckCircle,
  },
  "In Progress": {
    color: "text-yellow-600",
    icon: TrendingUp,
  },
  "Pending": {
    color: "text-gray-500",
    icon: Clock,
  },
  "Issue": {
    color: "text-red-600",
    icon: XCircle,
  },
};

const summaryStats = [
  {
    icon: ListChecks,
    value: "2",
    label: "Projects Updated Today",
  },
  {
    icon: CheckCircle,
    value: "3",
    label: "Tasks Completed",
  },
  {
    icon: TrendingUp,
    value: "2",
    label: "Tasks In Progress",
  },
  {
    icon: Clock,
    value: "1",
    label: "Tasks Pending",
  },
];


const PMDailyProgress = () => {
  const [progress] = useState(mockProgress);
  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background/90"
      >
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/70 to-background/60 z-10" />
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10 z-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23ffffff\" fill-opacity=\"0.7\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
        </div>
        <div className="container mx-auto px-2 sm:px-6 z-20 relative flex items-center justify-center h-full py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-2 leading-tight">Daily <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Progress</span></h1>
              <p className="text-base sm:text-lg md:text-2xl text-muted-foreground max-w-xl mx-auto">View and log daily progress for all ongoing projects and tasks.</p>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="backdrop-blur-2xl bg-background/95 border border-white/20 rounded-2xl shadow-2xl p-4 sm:p-8"
            >
              {/* Stats Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
                {summaryStats.map((stat, idx) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * idx }}
                    className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl shadow-lg text-center px-6 py-6"
                  >
                    <stat.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                    <div className="text-2xl font-bold mb-1 text-primary font-display">{stat.value}</div>
                    <div className="text-xs text-muted-foreground font-medium">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
              {/* Progress Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                  <thead>
                    <tr className="bg-background/60">
                      <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Project</th>
                      <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Date</th>
                      <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Tasks</th>
                      <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Notes</th>
                      <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.map((entry, idx) => (
                      <tr key={idx} className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors">
                        <td className="py-4 px-6 font-medium text-foreground">{entry.project}</td>
                        <td className="py-4 px-6 text-foreground">{entry.date}</td>
                        <td className="py-4 px-6">
                          <ul className="space-y-1">
                            {entry.tasks.map((task, tIdx) => {
                              const status = statusMap[task.status] || statusMap["Pending"];
                              const StatusIcon = status.icon;
                              return (
                                <li key={tIdx} className="flex items-center gap-2">
                                  <StatusIcon className={cn("w-4 h-4", status.color)} />
                                  <span className="w-32 inline-block text-foreground">{task.name}</span>
                                  <span className={cn("font-semibold", status.color)}>{task.status}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </td>
                        <td className="py-4 px-6 text-sm text-muted-foreground">{entry.notes}</td>
                        <td className="py-4 px-6">
                          <Button size="sm" variant="outline" className="rounded-xl">View Log</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>
    </AnimatePresence>
  );
};

export default PMDailyProgress;
