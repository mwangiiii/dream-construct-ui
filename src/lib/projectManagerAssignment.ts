import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Single implementation of "who manages this project".
//
// This used to be written out three times — the admin dashboard panel, the
// project detail header and the new-project modal — each with its own copy of
// the update and its own query for the manager list. They drifted.
//
// projects.manager_id is the only record of the assignment: security.
// manages_project() reads it directly, so there is deliberately no project_team
// write here.

export interface ProjectManagerOption {
  id: string;
  full_name: string;
}

// Active project managers only. A suspended account must not be assignable, so
// the status filter is part of the shared query rather than each caller's job.
export async function fetchProjectManagers(): Promise<ProjectManagerOption[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, profiles!inner(id, full_name, status_id)")
    .eq("role_name", "project_manager")
    .eq("profiles.status_id", 1);

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const options: ProjectManagerOption[] = [];
  for (const row of (data ?? []) as any[]) {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    options.push({ id: p.id, full_name: p.full_name ?? "Unnamed user" });
  }
  return options.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export function useProjectManagerOptions() {
  const [managers, setManagers] = useState<ProjectManagerOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProjectManagers()
      .then((m) => { if (!cancelled) setManagers(m); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  return { managers, error };
}

export interface AssignResult {
  manager: ProjectManagerOption | null;
  /** False when the assignment saved but the notification email did not send. */
  notified: boolean;
  notifyError?: string;
}

/**
 * Assigns (or clears, with an empty managerId) the project manager.
 *
 * The notification is intentionally not allowed to fail the assignment — the
 * database write is the thing that matters, and a bounced mail server should
 * not leave the caller thinking the change was rejected. The caller gets
 * `notified` so it can say so.
 */
export async function assignProjectManager(
  projectId: string,
  managerId: string,
  managers: ProjectManagerOption[],
): Promise<AssignResult> {
  // `.select()` is what makes this verifiable. The projects_update policy is
  // USING (security.can_write_project(id)), and a USING failure is not an
  // error — Postgres simply matches no rows and reports success. Without
  // reading the row back, a silently rejected assignment is indistinguishable
  // from a successful one, which is exactly how an assignment can appear to
  // work and not persist.
  const { data, error } = await supabase
    .from("projects")
    .update({ manager_id: managerId || null })
    .eq("id", projectId)
    .select("id, manager_id");

  if (error) throw new Error(error.message);

  if (!data || data.length === 0) {
    throw new Error(
      "The database did not apply this change. You do not have write access to " +
      "this project — only an administrator, or the project's current manager, " +
      "can reassign it.",
    );
  }

  const saved = (data[0] as { manager_id: string | null }).manager_id;
  const expected = managerId || null;
  if (saved !== expected) {
    throw new Error(
      `The project manager did not change — the database still has ` +
      `${saved ? "a different manager" : "no manager"} on this project.`,
    );
  }

  const manager = managers.find((m) => m.id === managerId) ?? null;
  if (!manager) return { manager: null, notified: false };

  try {
    const { data, error: fnError } = await supabase.functions.invoke(
      "notify-project-assignment",
      { body: { projectId, managerId } },
    );
    if (fnError) throw new Error(fnError.message);
    if (data?.error) throw new Error(data.error);
    return { manager, notified: true };
  } catch (e: unknown) {
    return {
      manager,
      notified: false,
      notifyError: e instanceof Error ? e.message : "Notification failed",
    };
  }
}
