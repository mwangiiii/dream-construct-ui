    import { useState } from "react";
    import { motion, AnimatePresence } from "framer-motion";
    import { cn } from "@/lib/utils";

    const initialMaterials = [
      { name: "Cement", used: 120, wastage: 5, inventory: 30, unit: "bags" },
      { name: "Steel Rods", used: 200, wastage: 2, inventory: 50, unit: "pieces" },
      { name: "Bricks", used: 1500, wastage: 50, inventory: 500, unit: "pcs" },
    ];

    const units = ["bags", "pieces", "pcs", "tons", "liters"];


const PMMaterials = () => {
  const [materials, setMaterials] = useState(initialMaterials);
  const [form, setForm] = useState({ name: "", used: "", wastage: "", inventory: "", unit: units[0] });
  const [editIdx, setEditIdx] = useState(-1);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setMaterials([
      ...materials,
      {
        name: form.name,
        used: Number(form.used) || 0,
        wastage: Number(form.wastage) || 0,
        inventory: Number(form.inventory) || 0,
        unit: form.unit,
      },
    ]);
    setForm({ name: "", used: "", wastage: "", inventory: "", unit: units[0] });
  };

  const handleEdit = (idx) => {
    setEditIdx(idx);
    const mat = materials[idx];
    setForm({
      name: mat.name,
      used: mat.used.toString(),
      wastage: mat.wastage.toString(),
      inventory: mat.inventory.toString(),
      unit: mat.unit,
    });
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    if (editIdx < 0) return;
    const updated = [...materials];
    updated[editIdx] = {
      name: form.name,
      used: Number(form.used) || 0,
      wastage: Number(form.wastage) || 0,
      inventory: Number(form.inventory) || 0,
      unit: form.unit,
    };
    setMaterials(updated);
    setEditIdx(-1);
    setForm({ name: "", used: "", wastage: "", inventory: "", unit: units[0] });
  };

  const handleDelete = (idx) => {
    setMaterials(materials.filter((_, i) => i !== idx));
    if (editIdx === idx) setEditIdx(-1);
  };

  const handleCancel = () => {
    setEditIdx(-1);
    setForm({ name: "", used: "", wastage: "", inventory: "", unit: units[0] });
  };

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background/90"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/70 to-background/60 z-10" />
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
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-2 leading-tight">Material <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Tracking</span></h1>
              <p className="text-base sm:text-lg md:text-2xl text-muted-foreground max-w-xl mx-auto">Track material usage, wastage, and inventory for each project stage.</p>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="backdrop-blur-2xl bg-background/95 border border-white/20 rounded-2xl shadow-2xl p-4 sm:p-8 mb-8"
            >
              <form onSubmit={editIdx === -1 ? handleAdd : handleUpdate} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-3">Material</label>
                  <input
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Sand"
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-3">Used</label>
                  <input
                    name="used"
                    type="number"
                    min="0"
                    value={form.used}
                    onChange={handleChange}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-3">Wastage</label>
                  <input
                    name="wastage"
                    type="number"
                    min="0"
                    value={form.wastage}
                    onChange={handleChange}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-3">Inventory</label>
                  <input
                    name="inventory"
                    type="number"
                    min="0"
                    value={form.inventory}
                    onChange={handleChange}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground placeholder:text-muted-foreground/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-3">Unit</label>
                  <select
                    name="unit"
                    value={form.unit}
                    onChange={handleChange}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-base font-medium text-foreground"
                  >
                    {units.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-5 flex gap-2 mt-2">
                  <button
                    type="submit"
                    className="bg-primary text-background font-semibold px-6 py-2 rounded-xl hover:bg-primary/90 transition disabled:opacity-50"
                  >
                    {editIdx === -1 ? "Add Material" : "Update Material"}
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
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="overflow-x-auto"
            >
              <table className="min-w-full bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <thead>
                  <tr className="bg-background/60">
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Material</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Used</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Wastage</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Inventory</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Unit</th>
                    <th className="py-4 px-6 text-left font-semibold text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((mat, idx) => (
                    <tr key={idx} className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors">
                      <td className="py-4 px-6 font-medium text-foreground">{mat.name}</td>
                      <td className="py-4 px-6 text-foreground">{mat.used}</td>
                      <td className="py-4 px-6 text-foreground">{mat.wastage}</td>
                      <td className="py-4 px-6 text-foreground">{mat.inventory}</td>
                      <td className="py-4 px-6 text-foreground">{mat.unit}</td>
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
                  ))}
                </tbody>
              </table>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>
    </AnimatePresence>
  );
};

export default PMMaterials;
