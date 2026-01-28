
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const mockReports = [
  {
    type: "Daily",
    date: "2026-01-27",
    summary: "Foundation work completed at Site A."
  },
  {
    type: "Weekly",
    date: "2026-01-25",
    summary: "Plumbing and electrical setup started at Site B."
  },
  {
    type: "Monthly",
    date: "2026-01-01",
    summary: "10% overall project progress achieved."
  }
];


const PMReports = () => (
  <AnimatePresence>
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center bg-background/90 py-12"
    >
      <div className="container mx-auto px-2 sm:px-6 max-w-3xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-2 leading-tight">Project <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Reports</span></h1>
          <p className="text-base sm:text-lg md:text-2xl text-muted-foreground max-w-xl mx-auto">Generate and view daily, weekly, monthly, and yearly project reports and audit trails.</p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {mockReports.map((report, idx) => (
            <div
              key={idx}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl shadow-lg px-6 py-6"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between mb-2 gap-2">
                <span className="font-semibold text-lg text-primary">{report.type} Report</span>
                <span className="text-muted-foreground text-base">{report.date}</span>
              </div>
              <div className="text-foreground text-base font-medium">{report.summary}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  </AnimatePresence>
);

export default PMReports;
