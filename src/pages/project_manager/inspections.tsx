import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";

const mockInspections = [
  {
    date: "2026-01-25",
    item: "Cement Batch #12",
    inspector: "Jane Doe",
    result: "Pass",
    remarks: "Meets quality standards."
  },
  {
    date: "2026-01-26",
    item: "Steel Rods Lot B",
    inspector: "John Smith",
    result: "Fail",
    remarks: "Rust detected on several rods."
  }
];

const resultMap = {
  "Pass": {
    color: "text-green-600",
    icon: CheckCircle,
  },
  "Fail": {
    color: "text-red-600",
    icon: XCircle,
  },
};


const PMInspections = () => (
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
          className="w-full max-w-3xl"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-2 leading-tight">Quality <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Inspections</span></h1>
            <p className="text-base sm:text-lg md:text-2xl text-muted-foreground max-w-xl mx-auto">Log and review inspections of goods, materials, and work quality here.</p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="backdrop-blur-2xl bg-background/95 border border-white/20 rounded-2xl shadow-2xl p-4 sm:p-8"
          >
            {/* New Inspection Request Form (Mock) */}
            <div className="mb-10">
              <h2 className="text-2xl font-bold mb-4 text-primary">Create New Inspection Request</h2>
              <form className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-3">Item/Batch</label>
                  <input type="text" placeholder="e.g. Cement Batch #13" className="w-full px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl text-base font-medium text-foreground placeholder:text-muted-foreground/50" disabled value="" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-3">Inspector</label>
                  <input type="text" placeholder="e.g. Jane Doe" className="w-full px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl text-base font-medium text-foreground placeholder:text-muted-foreground/50" disabled value="" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-3">Date</label>
                  <input type="date" className="w-full px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl text-base font-medium text-foreground placeholder:text-muted-foreground/50" disabled value="" />
                </div>
                <div>
                  <button type="button" className="bg-primary text-background font-semibold px-6 py-2 rounded-xl w-full hover:bg-primary/90 transition" disabled>
                    Submit Request
                  </button>
                </div>
              </form>
              <p className="text-xs text-muted-foreground mt-2">(Demo only: form is disabled)</p>
            </div>
            <div className="overflow-x-auto mb-10">
              <table className="min-w-full bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <thead>
                  <tr className="bg-background/60">
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Date</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Item</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Inspector</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Result</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {mockInspections.map((insp, idx) => {
                    const result = resultMap[insp.result] || resultMap["Fail"];
                    const ResultIcon = result.icon;
                    return (
                      <tr key={idx} className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors">
                        <td className="py-4 px-6 text-foreground">{insp.date}</td>
                        <td className="py-4 px-6 font-medium text-foreground">{insp.item}</td>
                        <td className="py-4 px-6 text-foreground">{insp.inspector}</td>
                        <td className={cn("py-4 px-6 flex items-center gap-2 font-semibold", result.color)}>
                          <ResultIcon className="w-5 h-5" />
                          {insp.result}
                        </td>
                        <td className="py-4 px-6 text-sm text-muted-foreground">{insp.remarks}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Inspection Issues Management Section */}
            <div className="mt-8">
              <h2 className="text-2xl font-bold mb-4 text-primary">Inspection Issues</h2>
              <p className="text-muted-foreground mb-6">Track and resolve issues found during inspections. (Demo data below)</p>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white/10 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                  <thead>
                    <tr className="bg-background/40">
                      <th className="py-3 px-6 text-left font-semibold text-muted-foreground">Issue</th>
                      <th className="py-3 px-6 text-left font-semibold text-muted-foreground">Status</th>
                      <th className="py-3 px-6 text-left font-semibold text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/10 last:border-b-0 hover:bg-background/20 transition-colors">
                      <td className="py-3 px-6 text-foreground">Rust detected on several rods (Steel Rods Lot B)</td>
                      <td className="py-3 px-6 text-red-600 font-semibold">Unresolved</td>
                      <td className="py-3 px-6">
                        <button className="bg-primary text-background px-4 py-1 rounded-xl font-semibold hover:bg-primary/90 transition">Mark Resolved</button>
                      </td>
                    </tr>
                    <tr className="border-b border-white/10 last:border-b-0 hover:bg-background/20 transition-colors">
                      <td className="py-3 px-6 text-foreground">No issues found (Cement Batch #12)</td>
                      <td className="py-3 px-6 text-green-600 font-semibold">Resolved</td>
                      <td className="py-3 px-6">
                        <span className="text-green-600 font-semibold">OK</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  </AnimatePresence>
);

export default PMInspections;
