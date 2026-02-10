import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  description: string;
  project_id: string;
}

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-2xl", className)}>
    {children}
  </div>
);

const Stages: React.FC<{ projectId?: string }> = ({ projectId }) => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [form, setForm] = useState({ name: "", description: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch stages from Supabase
  const fetchStages = async () => {
    if (!projectId) {
      setLoading(false);
      setError("No project ID provided");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("stages")
        .select("id, name, description, project_id")
        .eq("project_id", projectId);

      if (fetchError) {
        console.error("Fetch error:", fetchError);
        throw fetchError;
      }

      setStages(data || []);
      setError(null);
    } catch (err: any) {
      console.error("Error in fetchStages:", err);
      setError(err.message || "Failed to load stages.");
      setStages([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (projectId) {
      fetchStages();
    } else {
      setLoading(false);
      setError("No project selected");
    }
  }, [projectId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !projectId) return;

    try {
      const { data, error: insertError } = await supabase
        .from("stages")
        .insert([{ name: form.name, description: form.description, project_id: projectId }])
        .select();

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }

      setForm({ name: "", description: "" });
      setShowForm(false);
      await fetchStages();
    } catch (err: any) {
      console.error("Error in handleAdd:", err);
      setError(err.message || "Failed to add stage.");
    }
  };

  const handleEdit = (id: string) => {
    const stage = stages.find(s => s.id === id);
    if (!stage) return;
    setEditId(id);
    setForm({ name: stage.name, description: stage.description });
    setShowForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;

    try {
      const { error: updateError } = await supabase
        .from("stages")
        .update({ name: form.name, description: form.description })
        .eq("id", editId);

      if (updateError) {
        console.error("Update error:", updateError);
        throw updateError;
      }

      setEditId(null);
      setForm({ name: "", description: "" });
      setShowForm(false);
      await fetchStages();
    } catch (err: any) {
      console.error("Error in handleUpdate:", err);
      setError(err.message || "Failed to update stage.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this stage?")) return;

    try {
      const { error: deleteError } = await supabase
        .from("stages")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        throw deleteError;
      }

      await fetchStages();
    } catch (err: any) {
      console.error("Error in handleDelete:", err);
      setError(err.message || "Failed to delete stage.");
    }

    if (editId === id) {
      setEditId(null);
      setForm({ name: "", description: "" });
    }
  };

  const handleCancel = () => {
    setEditId(null);
    setForm({ name: "", description: "" });
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading stages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Error loading stages</h3>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => fetchStages()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
      <div className="container mx-auto px-2 sm:px-6 z-20 relative flex items-center justify-center h-full py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <Layers className="w-16 h-16 text-primary mx-auto mb-6" />
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-2 leading-tight">
              Project <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Stages</span>
            </h1>
            <p className="text-base sm:text-lg md:text-2xl text-muted-foreground max-w-xl mx-auto">
              Define, view, and manage the stages of your construction projects.
            </p>
          </div>

          <GlassCard className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-primary">Stages List</h2>
              <Button
                onClick={() => {
                  setShowForm(true);
                  setEditId(null);
                  setForm({ name: "", description: "" });
                }}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-background rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 group"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                Add Stage
              </Button>
            </div>

            {stages.length === 0 ? (
              <div className="text-center py-12">
                <Layers className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No stages yet</h3>
                <p className="text-muted-foreground mb-6">Get started by adding your first project stage.</p>
                <Button
                  onClick={() => {
                    setShowForm(true);
                    setEditId(null);
                    setForm({ name: "", description: "" });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Stage
                </Button>
              </div>
            ) : (
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
                    {stages.map((stage) => (
                      <tr key={stage.id} className="border-b border-white/10 last:border-b-0 hover:bg-background/30 transition-colors">
                        <td className="py-4 px-6 text-foreground font-medium">{stage.name}</td>
                        <td className="py-4 px-6 text-foreground">{stage.description || "—"}</td>
                        <td className="py-4 px-6 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(stage.id)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(stage.id)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

          <AnimatePresence>
            {showForm && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleCancel}>
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="relative bg-gradient-to-br from-background to-accent/5 rounded-3xl border-2 border-white/10 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="sticky top-0 z-10 bg-gradient-to-r from-primary/10 to-accent/10 backdrop-blur-xl border-b-2 border-white/10 p-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      {editId === null ? "Add Stage" : "Edit Stage"}
                    </h2>
                    <button onClick={handleCancel} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <form onSubmit={editId === null ? handleAdd : handleUpdate} className="p-6 space-y-6">
                    <div>
                      <Label className="mb-2 block">Stage Name *</Label>
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
                      <Label className="mb-2 block">Description</Label>
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
                      <Button type="submit" className="px-6 py-3 bg-primary hover:bg-primary/90 text-background font-semibold rounded-xl transition-all">
                        {editId === null ? "Add Stage" : "Update Stage"}
                      </Button>
                      <Button type="button" variant="outline" onClick={handleCancel} className="px-6 py-3 rounded-xl">
                        Cancel
                      </Button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default Stages;