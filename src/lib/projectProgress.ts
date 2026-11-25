import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Derived project progress — the single source of truth for the percentage.
//
// ── Why this exists ────────────────────────────────────────────────────────
// `projects.progress_percent` is a stored column, but nothing in the app
// writes it: OverviewTab's status Edge Function deliberately omits it, and
// MilestonesTab notes that milestone progress "is NOT stored — always derived
// from tasks at render time". Maintaining it was left to a DB trigger
// (auto_update_project_progress) that is not in this repo. Result: the stored
// number drifts from what the milestones and tasks actually show, and every
// page reading it displays the same stale figure.
//
// So progress is computed here instead, using the EXACT formula MilestonesTab
// already uses, so the project card and the milestones tab can never disagree:
//
//   milestone progress = round(tasks done / total tasks * 100)   (0 if no tasks)
//   project progress   = round(mean of milestone progresses)     (0 if none)
//
// Dates are never part of this. They only drive the milestone status badge.

/** Matches the DB enum value for a finished task. */
const isTaskDone = (status: string): boolean => status === "done";

export function milestoneProgress(taskStatuses: string[]): number {
  if (taskStatuses.length === 0) return 0;
  const done = taskStatuses.filter(isTaskDone).length;
  return Math.round((done / taskStatuses.length) * 100);
}

export function projectProgressFrom(
  milestoneIds: string[],
  statusesByMilestone: Record<string, string[]>,
): number {
  if (milestoneIds.length === 0) return 0;
  const sum = milestoneIds.reduce(
    (acc, id) => acc + milestoneProgress(statusesByMilestone[id] ?? []),
    0,
  );
  return Math.round(sum / milestoneIds.length);
}

/**
 * Progress for many projects in two queries total, regardless of how many
 * projects are passed. Project lists render dozens of cards, so this must not
 * become a per-card fetch.
 *
 * Projects with no milestones are returned as 0 rather than omitted, so
 * callers can rely on the key existing.
 */
export async function fetchProjectProgress(
  projectIds: string[],
): Promise<Record<string, number>> {
  if (projectIds.length === 0) return {};

  const { data: milestones, error: mErr } = await supabase
    .from("project_milestones")
    .select("id,project_id")
    .in("project_id", projectIds);
  if (mErr) throw new Error(mErr.message);

  const result: Record<string, number> = {};
  projectIds.forEach((id) => { result[id] = 0; });

  const rows = (milestones ?? []) as { id: string; project_id: string }[];
  if (rows.length === 0) return result;

  const { data: tasks, error: tErr } = await supabase
    .from("tasks")
    .select("milestone_id,status")
    .in("milestone_id", rows.map((m) => m.id));
  if (tErr) throw new Error(tErr.message);

  const statusesByMilestone: Record<string, string[]> = {};
  ((tasks ?? []) as { milestone_id: string | null; status: string }[]).forEach((t) => {
    if (!t.milestone_id) return;
    (statusesByMilestone[t.milestone_id] ??= []).push(t.status);
  });

  const milestonesByProject: Record<string, string[]> = {};
  rows.forEach((m) => { (milestonesByProject[m.project_id] ??= []).push(m.id); });

  Object.entries(milestonesByProject).forEach(([projectId, ids]) => {
    result[projectId] = projectProgressFrom(ids, statusesByMilestone);
  });

  return result;
}

// ─── Single-project hook with request coalescing ─────────────────────────────
//
// The finance modules render the same project card in a dozen places, each
// holding one project object. Giving each card its own fetch would be a query
// per card; threading a prop down from every list would be twelve files of
// plumbing. So ids requested within the same tick are batched into one query
// and the answers are cached module-wide.
//
// The cache is intentionally process-lifetime: progress changes when tasks
// change, and the pages using this are read-only finance views that remount on
// navigation. Call `invalidateProjectProgress()` after mutating tasks.

const progressCache = new Map<string, number>();
const pendingIds = new Set<string>();
const listeners = new Set<() => void>();
let flushScheduled = false;

function notify() { listeners.forEach((l) => l()); }

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;

  // Microtask-ish batching: every card that mounts in this render pass lands
  // its id before the single query goes out.
  setTimeout(async () => {
    flushScheduled = false;
    const ids = [...pendingIds];
    pendingIds.clear();
    if (ids.length === 0) return;

    try {
      const map = await fetchProjectProgress(ids);
      Object.entries(map).forEach(([id, pct]) => progressCache.set(id, pct));
    } catch {
      // Leave uncached so callers keep using their fallback. Caching a 0 here
      // would turn a transient failure into a permanently wrong number.
    }
    notify();
  }, 0);
}

export function invalidateProjectProgress(projectId?: string) {
  if (projectId) progressCache.delete(projectId);
  else progressCache.clear();
  notify();
}

/**
 * Derived progress for one project, falling back to the stored column until
 * the real figure arrives. Safe to call from inside a card component.
 */
export function useDerivedProgress(
  projectId: string | null | undefined,
  fallback: number | null | undefined,
): number {
  const [, bump] = useState(0);

  useEffect(() => {
    if (!projectId || progressCache.has(projectId)) return;
    const listener = () => bump((n) => n + 1);
    listeners.add(listener);
    pendingIds.add(projectId);
    scheduleFlush();
    return () => { listeners.delete(listener); };
  }, [projectId]);

  if (!projectId) return fallback ?? 0;
  const cached = progressCache.get(projectId);
  return cached ?? fallback ?? 0;
}

/**
 * Hook form. Returns a projectId → percent map, plus a `ready` flag so callers
 * can fall back to the stored column while the derivation is still in flight
 * instead of flashing 0.
 */
export function useProjectProgress(projectIds: string[]) {
  const key = projectIds.slice().sort().join(",");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (projectIds.length === 0) { setProgress({}); setReady(true); return; }

    setReady(false);
    fetchProjectProgress(projectIds)
      .then((m) => { if (!cancelled) { setProgress(m); setReady(true); } })
      // On failure leave the map empty and mark ready, so callers fall back to
      // the stored value rather than rendering nothing.
      .catch(() => { if (!cancelled) setReady(true); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { progress, ready };
}
