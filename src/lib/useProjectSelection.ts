import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

// Keeps "which project am I looking at" in the URL instead of local state.
//
// ── The bug this fixes ─────────────────────────────────────────────────────
// Every module page held the selection in useState, so the URL stayed at e.g.
// /finance/accounts-payable whether you were on the project picker or inside a
// project. Pressing the browser Back button — the natural way to leave a
// project — therefore left the page entirely and landed on whatever came
// before it, usually the dashboard.
//
// With the id in a `?project=` search param:
//   * selecting a project pushes a history entry, so Back returns to the
//     picker rather than exiting the module
//   * a link like /finance/accounts-payable?project=<id> opens that project
//     directly, and survives a refresh
//   * Back/Forward move between picker and project as a user expects
//
// `fixedProjectId` is for pages embedded inside an already-chosen project
// (passed as a prop). In that mode the URL is not touched and select/clear are
// no-ops, matching the previous `if (!projectId)` guards.
export function useProjectSelection<T extends { id: string }>(
  fixedProjectId: string | undefined,
  fetchProject: (id: string) => Promise<T | null>,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramId = searchParams.get("project");
  const activeId = fixedProjectId ?? paramId;

  const [project, setProject] = useState<T | null>(null);

  // Resolve an id we don't already hold: a direct link, a refresh, or
  // Back/Forward. Selecting from the picker sets the object directly, so this
  // does not refetch in the common path.
  useEffect(() => {
    let cancelled = false;

    if (!activeId) { setProject(null); return; }
    if (project?.id === activeId) return;

    fetchProject(activeId).then((p) => { if (!cancelled) setProject(p); })
      // A bad or stale id in the URL should fall back to the picker, not a
      // blank screen.
      .catch(() => { if (!cancelled) setProject(null); });

    return () => { cancelled = true; };
    // fetchProject is usually an inline closure, so a new identity every
    // render — including it here would refetch on every render. `project` is
    // read only as a cache check and must not retrigger either.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const select = useCallback((p: T) => {
    if (fixedProjectId) return;
    setProject(p);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("project", p.id);
      return next;
    });
  }, [fixedProjectId, setSearchParams]);

  const clear = useCallback(() => {
    if (fixedProjectId) return;
    setProject(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("project");
      return next;
    });
  }, [fixedProjectId, setSearchParams]);

  return { project, select, clear };
}
