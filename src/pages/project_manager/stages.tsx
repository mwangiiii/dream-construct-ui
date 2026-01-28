import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Edit, Trash2, Plus, X } from "lucide-react";


const initialStages = [
  { id: 1, name: "Foundation", description: "Groundwork and base construction." },
  { id: 2, name: "Framing", description: "Structural framework setup." },
  { id: 3, name: "Finishing", description: "Final touches and completion." },
];

const PMStages = () => {
  const [stages, setStages] = useState(initialStages);
  const [form, setForm] = useState({ name: "", description: "" });
  const [editIdx, setEditIdx] = useState(-1);
  const [showForm, setShowForm] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setStages([
      ...stages,
      {
        id: Date.now(),
        name: form.name,
        description: form.description,
      },
    ]);
    setForm({ name: "", description: "" });
    setShowForm(false);
  };

  const handleEdit = (idx) => {
    setEditIdx(idx);
    setForm({ name: stages[idx].name, description: stages[idx].description });
    setShowForm(true);
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    if (editIdx < 0) return;
    const updated = [...stages];
    updated[editIdx] = { ...updated[editIdx], name: form.name, description: form.description };
    setStages(updated);
    setEditIdx(-1);
    setForm({ name: "", description: "" });
    setShowForm(false);
  };

  const handleDelete = (idx) => {
    setStages(stages.filter((_, i) => i !== idx));
    if (editIdx === idx) setEditIdx(-1);
  };

  const handleCancel = () => {
    setEditIdx(-1);
    setForm({ name: "", description: "" });
    setShowForm(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-accent/5 p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center w-full max-w-3xl"
      >
        <div className="mb-6">
          <Layers className="w-16 h-16 text-primary mx-auto" />
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-3 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent text-center">
          Project Stages
        </h1>
        <p className="text-lg text-muted-foreground text-center max-w-xl mb-8">
          Define, view, and manage the stages of your construction projects.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="backdrop-blur-2xl bg-background/95 border border-white/20 rounded-2xl shadow-2xl p-4 sm:p-8 w-full"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-primary">Stages List</h2>
            <button
              onClick={() => { setShowForm(true); setEditIdx(-1); setForm({ name: "", description: "" }); }}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 group"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              Add Stage
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border-2 border-white/10 bg-white/5 shadow-2xl mb-8">
            <table className="min-w-full bg-transparent border-none rounded-2xl overflow-hidden">
              <thead>
                <tr className="bg-background/60">
                  <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Name</th>
                  <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Description</th>
                  <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage, idx) => (
                  <tr key={stage.id} className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors">
                    <td className="py-4 px-6 text-foreground font-medium">{stage.name}</td>
                    <td className="py-4 px-6 text-foreground">{stage.description}</td>
                    <td className="py-4 px-6 flex gap-2">
                      <button
                        onClick={() => handleEdit(idx)}
                        className="bg-accent text-background px-4 py-1 rounded-xl font-semibold hover:bg-accent/90 transition flex items-center gap-1"
                      >
                        <Edit className="w-4 h-4" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(idx)}
                        className="bg-red-500 text-background px-4 py-1 rounded-xl font-semibold hover:bg-red-600 transition flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={handleCancel}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="relative bg-gradient-to-br from-background to-accent/5 rounded-3xl border-2 border-white/10 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="sticky top-0 z-10 bg-gradient-to-r from-primary/10 to-accent/10 backdrop-blur-xl border-b-2 border-white/10 p-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      {editIdx === -1 ? "Add Stage" : "Edit Stage"}
                    </h2>
                    <button onClick={handleCancel} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <form onSubmit={editIdx === -1 ? handleAdd : handleUpdate} className="p-6 space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-3">Stage Name</label>
                      <input
                        name="name"
                        type="text"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="e.g. Roofing"
                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-3">Description</label>
                      <textarea
                        name="description"
                        rows={3}
                        value={form.description}
                        onChange={handleChange}
                        placeholder="Describe this stage..."
                        className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50 resize-none"
                      />
                    </div>
                    <div className="flex gap-4 justify-end">
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-6 py-2 border-2 border-white/10 rounded-xl font-semibold hover:bg-white/5 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 group"
                      >
                        {editIdx === -1 ? <Plus className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                        {editIdx === -1 ? "Add Stage" : "Update Stage"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default PMStages;
