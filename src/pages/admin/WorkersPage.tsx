// Admin / manager top-level Workers page.
//
// Reuses the same component that powers /project_manager/workers. The only
// difference is scoping: admin picks a project here, and the shared component
// filters workers, assignments and attendance to that project client-side.
// If no project is picked yet, the page shows a small guidance panel instead
// of an empty table (an empty table reads like a bug).

import { useEffect, useMemo, useState } from "react";
import { Briefcase, HardHat, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PMWorkers from "@/pages/project_manager/workers";

type ProjectOption = {
  id: string;
  project_number: string | null;
  title: string | null;
  archived_at: string | null;
  deep_archived_at: string | null;
};

export default function AdminWorkersPage() {
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
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardHat className="w-6 h-6 text-primary" />
            Workers
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Pick a project to see its workers, attendance, task assignments and
            performance. Workers themselves are per-project — selecting a
            different project shows a different list.
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Project
            </label>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-lg border border-white/10 bg-background/40 px-3 py-2">
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
          </div>
        </div>

        {loadError && (
          <p className="mt-3 text-xs text-rose-400">
            Failed to load projects: {loadError}
          </p>
        )}
      </div>

      {!selected ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10 mb-4">
            <Briefcase className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Select a project</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Admin view is per-project. Pick a project above to load its
            workers, attendance, assignments and performance.
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
            </div>
          )}
          <PMWorkers projectId={selected} />
        </div>
      )}
    </div>
  );
}
