// Admin / manager top-level Workers page.
//
// Two modes, same pattern AR/AP use for firm-wide vs project records:
//
//   Firm Workers    — workers.project_id IS NULL. Admin has full CRUD.
//                     Roles are chosen manually from the worker_role enum
//                     (these are trade roles like 'mason', 'electrician' —
//                     entirely separate from the app_role user-system roles).
//
//   Project Workers — workers.project_id = <selected project>. Admin can
//                     only view and delete; add / edit / assign-task /
//                     mark-attendance are gated off. The PM at
//                     /project_manager/workers keeps full control of these.
//
// Writes go directly through the Supabase client — admin passes
// security.is_manager_or_up() in the workers_write RLS policy, so no edge
// function is needed for the firm-workers CRUD.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  HardHat,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PMWorkers from "@/pages/project_manager/workers";

type ProjectOption = {
  id: string;
  project_number: string | null;
  title: string | null;
  archived_at: string | null;
  deep_archived_at: string | null;
};

type FirmWorker = {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  id_number: string | null;
  address: string | null;
  status: "active" | "inactive";
  created_at: string;
};

type Mode = "firm" | "project";

// Common trade roles from the worker_role enum, kept as a short list for the
// datalist. Admin can type any valid enum value; the DB will reject anything
// not in the live enum, with a clear error surfaced in the form.
const ROLE_SUGGESTIONS = [
  "mason", "carpenter", "electrician", "plumber", "painter", "welder",
  "laborer", "supervisor", "foreman", "engineer", "site_manager",
  "safety_officer", "quality_inspector", "heavy_equipment_operator",
  "concrete_finisher", "steel_worker", "scaffolder", "roofer", "glazier",
  "insulator", "drywaller", "flooring_installer", "landscaper",
  "demolition_worker", "crane_operator", "pipefitter", "hvac_technician",
  "tile_setter", "cost_estimator",
];

const emptyForm = {
  full_name: "",
  role: "",
  phone: "",
  id_number: "",
  address: "",
  status: "active" as "active" | "inactive",
};

export default function AdminWorkersPage() {
  const [mode, setMode] = useState<Mode>("firm");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HardHat className="w-6 h-6 text-primary" />
          Workers
        </h1>
        {/* <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Firm Workers are not tied to any single project (overhead staff,
          office crew, floating tradespeople). Project Workers are the
          project-level team records managed by the project's own PM — admin
          can view them and remove them, but editing is left to the PM.
        </p> */}
      </header>

      <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
        <button
          onClick={() => setMode("firm")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            mode === "firm"
              ? "bg-primary text-background shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Firm Workers
        </button>
        <button
          onClick={() => setMode("project")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            mode === "project"
              ? "bg-primary text-background shadow"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Project Workers
        </button>
      </div>

      {mode === "firm" ? <FirmWorkersSection /> : <ProjectWorkersSection />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRM WORKERS — full CRUD
// ─────────────────────────────────────────────────────────────────────────────

function FirmWorkersSection() {
  const [workers, setWorkers] = useState<FirmWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FirmWorker | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<FirmWorker | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("workers")
      .select("id, full_name, role, phone, id_number, address, status, created_at")
      .is("project_id", null)
      .order("full_name", { ascending: true });
    if (error) setLoadError(error.message);
    else setWorkers((data ?? []) as FirmWorker[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter((w) =>
      w.full_name.toLowerCase().includes(q) ||
      w.role.toLowerCase().includes(q) ||
      (w.phone ?? "").toLowerCase().includes(q) ||
      (w.id_number ?? "").toLowerCase().includes(q)
    );
  }, [workers, search]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (w: FirmWorker) => {
    setEditing(w);
    setForm({
      full_name: w.full_name,
      role: w.role,
      phone: w.phone ?? "",
      id_number: w.id_number ?? "",
      address: w.address ?? "",
      status: w.status,
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSave = async () => {
    const name = form.full_name.trim();
    const role = form.role.trim();
    if (!name) { setFormError("Full name is required."); return; }
    if (!role) { setFormError("Role is required."); return; }

    setSaving(true);
    setFormError(null);

    const payload = {
      full_name: name,
      role,
      phone: form.phone.trim() || null,
      id_number: form.id_number.trim() || null,
      address: form.address.trim() || null,
      status: form.status,
      // Firm workers are explicitly not tied to a project. The RLS policy
      // allows admin/manager to write workers regardless of project_id.
      project_id: null,
    };

    try {
      if (editing) {
        const { error } = await supabase
          .from("workers")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("workers").insert(payload);
        if (error) throw error;
      }
      await load();
      closeForm();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save worker.";
      // Common error surfaces from the DB: enum mismatch, unique-constraint.
      setFormError(
        msg.includes("invalid input value for enum")
          ? "That role isn't recognised. Use one of the trade roles listed below (mason, carpenter, electrician, …)."
          : msg.includes("workers_phone_key") || msg.includes("unique_workers_phone")
          ? "A worker with that phone number already exists."
          : msg.includes("workers_id_number_key") || msg.includes("unique_workers_id_number")
          ? "A worker with that ID number already exists."
          : msg,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { error } = await supabase
        .from("workers")
        .delete()
        .eq("id", confirmDelete.id);
      if (error) throw error;
      await load();
      setConfirmDelete(null);
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete worker.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md rounded-lg border border-white/10 bg-background/40 px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, role, phone or ID…"
            className="bg-transparent outline-none text-sm flex-1 min-w-0"
          />
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-background text-sm font-semibold hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Add firm worker
        </button>
      </div>

      {loadError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Could not load firm workers: {loadError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading firm workers…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center">
          <Users className="w-10 h-10 text-primary/70 mx-auto mb-3" />
          <p className="text-sm font-semibold">
            {search ? "No workers match that search" : "No firm workers yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {search
              ? "Clear the search or add a new worker."
              : "Firm workers live outside any specific project — office crew, floating tradespeople, overhead staff."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Role</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Phone</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">ID Number</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr key={w.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-foreground">{w.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {w.role.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{w.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.id_number ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                      w.status === "active"
                        ? "bg-green-500/15 text-green-300 border border-green-500/25"
                        : "bg-zinc-500/15 text-zinc-300 border border-zinc-500/25"
                    }`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEdit(w)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => { setConfirmDelete(w); setDeleteError(null); }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-rose-300 hover:bg-rose-500/10 ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Add / Edit modal ───────────────────────────────────────────── */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !saving && closeForm()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-background/95 backdrop-blur-xl p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold">
                  {editing ? "Edit firm worker" : "Add firm worker"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Not tied to any specific project. Role is a trade role (e.g.
                  mason) — not a system login role.
                </p>
              </div>
              <button
                onClick={closeForm}
                disabled={saving}
                className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Full name
                </label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Role
                </label>
                <input
                  type="text"
                  list="firm-worker-role-suggestions"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                  placeholder="e.g. mason"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  disabled={saving}
                />
                <datalist id="firm-worker-role-suggestions">
                  {ROLE_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
                </datalist>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Type a trade role. Suggestions are common values; any role
                  recognised by the system will work.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    ID Number
                  </label>
                  <input
                    type="text"
                    value={form.id_number}
                    onChange={(e) => setForm((f) => ({ ...f, id_number: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    disabled={saving}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "active" | "inactive" }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  disabled={saving}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {formError && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={closeForm}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-white/10 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-background text-sm font-semibold disabled:opacity-50"
                >
                  {saving
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                    : editing ? "Save changes" : "Add worker"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete confirmation ─────────────────────────────────────────── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !deleting && setConfirmDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-background/95 backdrop-blur-xl p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-400" />
              Delete worker
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              Permanently remove <span className="text-foreground font-semibold">{confirmDelete.full_name}</span>? This also removes their attendance records and any project assignments (via cascade).
            </p>
            {deleteError && (
              <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {deleting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting…</>
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT WORKERS — view + delete, reuses the PM component in readOnly mode
// ─────────────────────────────────────────────────────────────────────────────

function ProjectWorkersSection() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_number, title, archived_at, deep_archived_at")
        .order("project_number", { ascending: true });
      if (error) setLoadError(error.message);
      else setProjects((data ?? []) as ProjectOption[]);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) =>
      (p.title ?? "").toLowerCase().includes(q) ||
      (p.project_number ?? "").toLowerCase().includes(q)
    );
  }, [projects, search]);

  const selectedProject = projects.find((p) => p.id === selected) ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Project
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[220px] flex items-center gap-2 rounded-lg border border-white/10 bg-background/40 px-3 py-2">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects by title or number…"
              className="bg-transparent outline-none text-sm flex-1 min-w-0"
            />
          </div>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-lg border border-white/10 bg-background/40 px-3 py-2 text-sm min-w-[260px]"
            disabled={loading || !!loadError}
          >
            <option value="">
              {loading ? "Loading projects…" : "— Select a project —"}
            </option>
            {filtered.map((p) => {
              const label = `${p.project_number ?? "—"} · ${p.title ?? "Untitled"}`;
              const tag = p.deep_archived_at
                ? " (deep archived)"
                : p.archived_at
                ? " (archived)"
                : "";
              return (
                <option key={p.id} value={p.id}>
                  {label}{tag}
                </option>
              );
            })}
          </select>
        </div>
        {loadError && (
          <p className="mt-3 text-xs text-rose-400">
            Failed to load projects: {loadError}
          </p>
        )}
      </div>

      {!selected ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center">
          <Briefcase className="w-10 h-10 text-primary/70 mx-auto mb-3" />
          <h2 className="text-lg font-semibold">Select a project</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Pick a project above to view its workers, attendance and
            assignments. Admin can view and remove workers here; editing is
            left to the project's own project manager.
          </p>
        </div>
      ) : (
        <div>
          {selectedProject && (
            <div className="mb-4 text-xs text-muted-foreground">
              Showing data for{" "}
              <span className="text-foreground font-semibold">
                {selectedProject.project_number ?? "—"} · {selectedProject.title ?? "Untitled"}
              </span>
              <span className="ml-2 px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 text-[10px] font-semibold uppercase tracking-wider">
                View only
              </span>
            </div>
          )}
          <PMWorkers projectId={selected} readOnly />
        </div>
      )}
    </div>
  );
}
