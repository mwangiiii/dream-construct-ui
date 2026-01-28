import { useState } from "react";
import { Award, TrendingUp, CheckCircle, Clock, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const initialFinancials = [
  {
    stage: "Foundation",
    budget: 15000,
    spent: 12000,
    status: "Pending Approval",
    lastUpdated: "2026-01-27",
    remarks: "Awaiting quality inspection."
  },
  {
    stage: "Plumbing",
    budget: 8000,
    spent: 8000,
    status: "Approved",
    lastUpdated: "2026-01-25",
    remarks: "Payment released."
  },
  {
    stage: "Roofing",
    budget: 12000,
    spent: 10000,
    status: "Awaiting Payment",
    lastUpdated: "2026-01-24",
    remarks: "Pending invoice submission."
  }
];

const statusMap = {
  "Approved": {
    color: "text-green-600",
    icon: CheckCircle,
  },
  "Pending Approval": {
    color: "text-yellow-600",
    icon: Clock,
  },
  "Awaiting Payment": {
    color: "text-blue-600",
    icon: Award,
  },
  "Rejected": {
    color: "text-red-600",
    icon: XCircle,
  },
};


const PMFinancials = () => {
  const [financials, setFinancials] = useState(initialFinancials);
  const [form, setForm] = useState({ stage: "", budget: "", spent: "", status: "Pending Approval", lastUpdated: "", remarks: "" });
  const [editIdx, setEditIdx] = useState(-1);

  // Summary stats
  const totalBudget = financials.reduce((sum, f) => sum + (Number(f.budget) || 0), 0);
  const totalSpent = financials.reduce((sum, f) => sum + (Number(f.spent) || 0), 0);
  const stagesApproved = financials.filter(f => f.status === "Approved").length;
  const pendingStages = financials.filter(f => f.status === "Pending Approval").length;
  const summaryStats = [
    { icon: Award, value: `$${totalBudget.toLocaleString()}`, label: "Total Budget" },
    { icon: TrendingUp, value: `$${totalSpent.toLocaleString()}`, label: "Total Spent" },
    { icon: CheckCircle, value: stagesApproved.toString(), label: "Stages Approved" },
    { icon: Clock, value: pendingStages.toString(), label: "Pending Stages" },
  ];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.stage.trim()) return;
    setFinancials([
      ...financials,
      {
        stage: form.stage,
        budget: Number(form.budget) || 0,
        spent: Number(form.spent) || 0,
        status: form.status,
        lastUpdated: form.lastUpdated || new Date().toISOString().slice(0, 10),
        remarks: form.remarks,
      },
    ]);
    setForm({ stage: "", budget: "", spent: "", status: "Pending Approval", lastUpdated: "", remarks: "" });
  };

  const handleEdit = (idx) => {
    setEditIdx(idx);
    const f = financials[idx];
    setForm({
      stage: f.stage,
      budget: f.budget.toString(),
      spent: f.spent.toString(),
      status: f.status,
      lastUpdated: f.lastUpdated,
      remarks: f.remarks,
    });
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    if (editIdx < 0) return;
    const updated = [...financials];
    updated[editIdx] = {
      stage: form.stage,
      budget: Number(form.budget) || 0,
      spent: Number(form.spent) || 0,
      status: form.status,
      lastUpdated: form.lastUpdated || new Date().toISOString().slice(0, 10),
      remarks: form.remarks,
    };
    setFinancials(updated);
    setEditIdx(-1);
    setForm({ stage: "", budget: "", spent: "", status: "Pending Approval", lastUpdated: "", remarks: "" });
  };

  const handleDelete = (idx) => {
    setFinancials(financials.filter((_, i) => i !== idx));
    if (editIdx === idx) setEditIdx(-1);
  };

  const handleCancel = () => {
    setEditIdx(-1);
    setForm({ stage: "", budget: "", spent: "", status: "Pending Approval", lastUpdated: "", remarks: "" });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-background/90 py-8 sm:py-12 md:py-16 flex flex-col"
      >
        <div className="container mx-auto px-2 sm:px-6 flex-1 flex flex-col">
          <div className="text-center mb-10 sm:mb-14 md:mb-20">
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold mb-4 leading-tight break-words">
              Project <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Financials</span>
            </h1>
            <p className="text-base sm:text-lg md:text-2xl text-muted-foreground max-w-xl sm:max-w-2xl md:max-w-3xl mx-auto">
              Review costs, budgets, and authorize payments for each project stage. Simulated data for demonstration.
            </p>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
            {summaryStats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * idx }}
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl shadow-lg text-center px-6 py-8"
              >
                <stat.icon className="w-10 h-10 mx-auto mb-4 text-primary" />
                <div className="text-4xl font-bold mb-2 text-primary font-display">{stat.value}</div>
                <div className="text-sm text-muted-foreground font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* CRUD Form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="backdrop-blur-2xl bg-background/95 border border-white/20 rounded-2xl shadow-2xl p-4 sm:p-8 mb-8"
          >
            <form onSubmit={editIdx === -1 ? handleAdd : handleUpdate} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-3">Stage</label>
                <input
                  name="stage"
                  type="text"
                  value={form.stage}
                  onChange={handleChange}
                  placeholder="e.g. Electrical"
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-3">Budget</label>
                <input
                  name="budget"
                  type="number"
                  min="0"
                  value={form.budget}
                  onChange={handleChange}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-3">Spent</label>
                <input
                  name="spent"
                  type="number"
                  min="0"
                  value={form.spent}
                  onChange={handleChange}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-3">Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                >
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Approved">Approved</option>
                  <option value="Awaiting Payment">Awaiting Payment</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-3">Last Updated</label>
                <input
                  name="lastUpdated"
                  type="date"
                  value={form.lastUpdated}
                  onChange={handleChange}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-3">Remarks</label>
                <input
                  name="remarks"
                  type="text"
                  value={form.remarks}
                  onChange={handleChange}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="md:col-span-6 flex gap-2 mt-2">
                <button
                  type="submit"
                  className="bg-primary text-background font-semibold px-6 py-2 rounded-xl hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {editIdx === -1 ? "Add Stage" : "Update Stage"}
                </button>
                {editIdx !== -1 && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="bg-muted text-foreground font-semibold px-6 py-2 rounded-xl hover:bg-muted/80 transition"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </motion.div>

          {/* Financial Table */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="overflow-x-auto"
          >
            <table className="min-w-full bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <thead>
                <tr className="bg-background/60">
                  <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Stage</th>
                  <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Budget (USD)</th>
                  <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Spent (USD)</th>
                  <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Status</th>
                  <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Last Updated</th>
                  <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Remarks</th>
                  <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {financials.map((item, idx) => {
                  const status = statusMap[item.status] || statusMap["Pending Approval"];
                  const StatusIcon = status.icon;
                  return (
                    <tr
                      key={idx}
                      className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors"
                    >
                      <td className="py-4 px-6 font-medium text-foreground">{item.stage}</td>
                      <td className="py-4 px-6 text-foreground">${item.budget.toLocaleString()}</td>
                      <td className="py-4 px-6 text-foreground">${item.spent.toLocaleString()}</td>
                      <td className={cn("py-4 px-6 flex items-center gap-2 font-semibold", status.color)}>
                        <StatusIcon className="w-5 h-5" />
                        {item.status}
                      </td>
                      <td className="py-4 px-6 text-foreground">{item.lastUpdated}</td>
                      <td className="py-4 px-6 text-sm text-muted-foreground">{item.remarks}</td>
                      <td className="py-4 px-6 flex gap-2">
                        <button
                          onClick={() => handleEdit(idx)}
                          className="bg-accent text-background px-4 py-1 rounded-xl font-semibold hover:bg-accent/90 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(idx)}
                          className="bg-red-500 text-background px-4 py-1 rounded-xl font-semibold hover:bg-red-600 transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PMFinancials;
