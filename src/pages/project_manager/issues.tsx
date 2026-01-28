import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const mockIssues = [
  {
    id: 1,
    title: "Water leakage in basement",
    status: "Open",
    reportedBy: "Alice",
    date: "2026-01-26"
  },
  {
    id: 2,
    title: "Cracked tiles in lobby",
    status: "Resolved",
    reportedBy: "Bob",
    date: "2026-01-25"
  }
];


const PMIssues = () => {
  const [issues] = useState(mockIssues);
  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen flex items-center justify-center bg-background/90 py-12"
      >
        <div className="container mx-auto px-2 sm:px-6 max-w-3xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-2 leading-tight">Problems <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">& Issues</span></h1>
            <p className="text-base sm:text-lg md:text-2xl text-muted-foreground max-w-xl mx-auto">Record, track, and resolve project problems and issues here.</p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="backdrop-blur-2xl bg-background/95 border border-white/20 rounded-2xl shadow-2xl p-4 sm:p-8"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <thead>
                  <tr className="bg-background/60">
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Date</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Title</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Reported By</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => (
                    <tr key={issue.id} className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors">
                      <td className="py-4 px-6 text-foreground">{issue.date}</td>
                      <td className="py-4 px-6 text-foreground">{issue.title}</td>
                      <td className="py-4 px-6 text-foreground">{issue.reportedBy}</td>
                      <td className={cn(
                        "py-4 px-6 font-semibold",
                        issue.status === "Resolved" ? "text-green-600" : "text-yellow-600"
                      )}>{issue.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </motion.section>
    </AnimatePresence>
  );
};

export default PMIssues;
