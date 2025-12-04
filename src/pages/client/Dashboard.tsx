import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { Briefcase, CheckCircle2, PauseCircle, TrendingUp, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

// Dummy data for structure; replace with real API calls
const clientName = "Jane Doe";
const stats = [
  { label: "Total Projects", value: 8, icon: Briefcase },
  { label: "Active", value: 3, icon: TrendingUp },
  { label: "Completed", value: 4, icon: CheckCircle2 },
  { label: "On Hold", value: 1, icon: PauseCircle },
];
const quickStats = {
  avgProgress: "72%",
  nextMilestone: "Dec 10, 2025",
};
const recentUpdates = [
  { id: 1, text: "Milestone reached for Project Alpha.", date: "Dec 2, 2025" },
  { id: 2, text: "Project Beta moved to On Hold.", date: "Dec 1, 2025" },
  { id: 3, text: "New document uploaded for Project Gamma.", date: "Nov 29, 2025" },
  { id: 4, text: "Project Delta completed.", date: "Nov 28, 2025" },
  { id: 5, text: "Kickoff meeting for Project Epsilon.", date: "Nov 27, 2025" },
];

export default function ClientDashboard() {
  const navigate = useNavigate();
  // Replace with real client name fetch
  // Replace stats, quickStats, recentUpdates with real API data

  return (
    <div className="p-8 min-h-screen bg-gradient-to-br from-background/95 via-background/98 to-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent tracking-tight">
          Welcome, {clientName}
        </h1>
        <p className="text-muted-foreground text-xl">Your project dashboard</p>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <GlassCard className="flex flex-col items-center justify-center p-10 border border-white/10">
              <stat.icon className="w-12 h-12 mb-4 text-primary" />
              <span className="text-3xl font-bold mb-2 tracking-tight" style={{ fontFamily: 'SF Pro Display, Inter, sans-serif' }}>{stat.value}</span>
              <span className="text-muted-foreground text-lg">{stat.label}</span>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        <GlassCard className="flex flex-col items-center justify-center p-8 border border-white/10">
          <TrendingUp className="w-8 h-8 mb-2 text-primary" />
          <span className="text-xl font-semibold mb-1">Average Progress</span>
          <span className="text-3xl font-bold text-primary mb-2">{quickStats.avgProgress}</span>
        </GlassCard>
        <GlassCard className="flex flex-col items-center justify-center p-8 border border-white/10">
          <CalendarDays className="w-8 h-8 mb-2 text-primary" />
          <span className="text-xl font-semibold mb-1">Next Milestone</span>
          <span className="text-2xl font-bold text-primary mb-2">{quickStats.nextMilestone}</span>
        </GlassCard>
      </div>

      {/* Recent Updates Feed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-10"
      >
        <GlassCard className="p-8 border border-white/10">
          <h2 className="text-2xl font-bold mb-6">Recent Updates</h2>
          <ul className="space-y-4">
            {recentUpdates.map((update) => (
              <li key={update.id} className="flex items-center justify-between">
                <span className="text-lg text-foreground">{update.text}</span>
                <span className="text-sm text-muted-foreground">{update.date}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </motion.div>

      {/* View All Projects Button */}
      <div className="flex justify-end">
        <Button
          className="px-8 py-4 text-lg font-semibold rounded-xl bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
          onClick={() => navigate("/client/projects")}
        >
          View All Projects
        </Button>
      </div>
    </div>
  );
}
