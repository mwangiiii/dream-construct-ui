import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users, Search, Loader2, AlertCircle, CheckCircle2, Mail, MailX,
  ExternalLink, ArrowRight, UserX,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  assignProjectManager,
  useProjectManagerOptions,
  type AssignResult,
} from "@/lib/projectManagerAssignment";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Admin → Project Assignments.
//
// THE place a project is allocated to a project manager. The dashboard panel
// and the project detail header used to each carry their own copy of this
// control, which is how they drifted: the dashboard never had an authoritative
// manager_id at all, only an embedded manager object, so its dropdown could
// show "Unassigned" for a project that had a manager. Both are now read-only
// and link here.
//
// manager_id is read straight off projects — no PostgREST embed — so what the
// dropdown shows is what the database holds.

interface Row {
  id: string;
  project_number: string | null;
  title: string | null;
  status: string | null;
  manager_id: string | null;
  client_id: string | null;
  archived_at: string | null;
  deep_archived_at: string | null;
}

type Pending = { project: Row; managerId: string } | null;

const STATUS_TONE: Record<string, string> = {
  planning:         "bg-sky-500/15 text-sky-300 border-sky-500/25",
  pre_construction: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  in_construction:  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  inspections:      "bg-purple-500/15 text-purple-300 border-purple-500/25",
  completed:        "bg-green-500/15 text-green-300 border-green-500/25",
  on_hold:          "bg-zinc-500/15 text-zinc-300 border-zinc-500/25",
  cancelled:        "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

export default function ProjectAssignments() {
  const { managers, error: managersError } = useProjectManagerOptions();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("projects")
      .select("id, project_number, title, status, manager_id, client_id, archived_at, deep_archived_at")
      .order("project_number", { ascending: true });

    if (error) setLoadError(error.message);
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const nameOf = useCallback(
    (id: string | null) => managers.find((m) => m.id === id)?.full_name ?? null,
    [managers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyUnassigned && r.manager_id) return false;
      if (!q) return true;
      return (
        (r.title ?? "").toLowerCase().includes(q) ||
        (r.project_number ?? "").toLowerCase().includes(q) ||
        (nameOf(r.manager_id) ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, onlyUnassigned, nameOf]);

  const unassignedCount = rows.filter((r) => !r.manager_id).length;

  const confirm = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      const result: AssignResult = await assignProjectManager(
        pending.project.id, pending.managerId, managers,
      );

      // Trust the row that came back, not the optimistic value.
      setRows((prev) => prev.map((r) =>
        r.id === pending.project.id
          ? { ...r, manager_id: result.manager?.id ?? null }
          : r));

      if (!result.manager) {
        toast({ title: "Project manager removed" });
      } else if (result.notified) {
        toast({
          title: `${result.manager.full_name} assigned`,
          description: "Notified by email.",
        });
      } else {
        toast({
          title: `${result.manager.full_name} assigned`,
          description: `Email not sent: ${result.notifyError ?? "unknown error"}`,
          variant: "destructive",
        });
      }
      setPending(null);
    } catch (e: unknown) {
      // assignProjectManager throws when the write did not land, so this is a
      // real failure and must not be reported as a save.
      toast({
        title: "Assignment failed",
        description: e instanceof Error ? e.message : "Could not update the project.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const targetName = pending
    ? managers.find((m) => m.id === pending.managerId)?.full_name ?? null
    : null;

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Project Assignments</h1>
        </div>
        <p className="text-muted-foreground mt-2.5 max-w-2xl">
          Allocate projects to project managers. This is the only place an
          assignment is made — the assigned manager is notified by email and
          gains manager access to the project.
        </p>
      </div>

      {managersError && (
        <GlassCard className="p-4 border-destructive/30">
          <div className="flex items-start gap-2.5 text-sm">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <span className="text-destructive">
              Could not load project managers: {managersError}
            </span>
          </div>
        </GlassCard>
      )}

      {/* ── Summary + controls ──────────────────────────────────────────── */}
      <GlassCard className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-6 shrink-0">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Projects</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5">{rows.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Unassigned</p>
              <p className={`text-2xl font-bold tabular-nums mt-0.5 ${
                unassignedCount > 0 ? "text-amber-400" : "text-green-400"
              }`}>
                {unassignedCount}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Managers</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5">{managers.length}</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row gap-3 lg:justify-end">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search project or manager…"
                className="w-full pl-9 pr-3 py-2.5 bg-muted/40 border border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 rounded-xl text-sm outline-none transition"
              />
            </div>
            <button
              onClick={() => setOnlyUnassigned((v) => !v)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium border whitespace-nowrap transition ${
                onlyUnassigned
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "border-white/10 text-muted-foreground hover:text-foreground hover:border-white/25"
              }`}
            >
              Unassigned only
            </button>
          </div>
        </div>
      </GlassCard>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-24 text-sm text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          Loading projects…
        </div>
      ) : loadError ? (
        <GlassCard className="text-center py-16">
          <AlertCircle className="w-10 h-10 text-destructive/70 mx-auto mb-3" />
          <p className="text-sm text-destructive">{loadError}</p>
          <button onClick={load} className="mt-4 text-sm text-primary hover:underline">
            Try again
          </button>
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard className="text-center py-16">
          <Users className="w-12 h-12 text-primary/40 mx-auto mb-4" />
          <p className="font-semibold">No projects match</p>
          <p className="text-sm text-muted-foreground mt-1.5">
            {rows.length === 0
              ? "No projects exist yet."
              : "Adjust the search or clear the unassigned filter."}
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background/40">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-4 px-5 font-semibold">Project</th>
                  <th className="py-4 px-5 font-semibold">Status</th>
                  <th className="py-4 px-5 font-semibold">Current manager</th>
                  <th className="py-4 px-5 font-semibold w-64">Assign to</th>
                  <th className="py-4 px-5 font-semibold w-12" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const current = nameOf(r.manager_id);
                  return (
                    <motion.tr
                      key={r.id}
                      layout
                      className="border-t border-white/10 hover:bg-background/30 transition-colors"
                    >
                      <td className="py-4 px-5">
                        <p className="font-medium text-foreground">{r.title ?? "Untitled"}</p>
                        {r.project_number && (
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                            {r.project_number}
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border capitalize whitespace-nowrap ${
                            STATUS_TONE[r.status ?? ""] ?? "bg-white/5 text-muted-foreground border-white/10"
                          }`}>
                            {(r.status ?? "unknown").replace(/_/g, " ")}
                          </span>
                          {/* Archived (regular) — PM still sees it in their list.
                              Deep-archived — hidden even from the assigned PM.
                              Shown as distinct chips so the admin can tell them
                              apart before assigning. */}
                          {r.archived_at && !r.deep_archived_at && (
                            <span className="px-2 py-1 rounded-md text-xs font-semibold border bg-rose-500/15 text-rose-300 border-rose-500/25 whitespace-nowrap">
                              Archived
                            </span>
                          )}
                          {r.deep_archived_at && (
                            <span className="px-2 py-1 rounded-md text-xs font-semibold border bg-rose-500/25 text-rose-200 border-rose-500/40 whitespace-nowrap">
                              Deep Archive
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        {r.manager_id ? (
                          current ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                              {current}
                            </span>
                          ) : (
                            // Assigned to somebody who is not an active PM —
                            // worth surfacing rather than rendering blank.
                            <span className="inline-flex items-center gap-1.5 text-sm text-amber-400">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              Inactive or non-PM user
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <UserX className="w-3.5 h-3.5 shrink-0" />
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5">
                        <select
                          aria-label={`Assign a manager to ${r.title ?? "project"}`}
                          value={r.manager_id ?? ""}
                          onChange={(e) => {
                            if (e.target.value === (r.manager_id ?? "")) return;
                            setPending({ project: r, managerId: e.target.value });
                          }}
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition"
                        >
                          <option value="">Unassigned</option>
                          {managers.map((m) => (
                            <option key={m.id} value={m.id}>{m.full_name}</option>
                          ))}
                        </select>
                      </td>

                      <td className="py-4 px-5">
                        <Link
                          to={`/projects/${r.id}`}
                          title="Open project"
                          className="inline-flex p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* ── Confirmation ────────────────────────────────────────────────── */}
      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open && !saving) setPending(null); }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {targetName ? "Assign project manager" : "Remove project manager"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {targetName ? (
                <>
                  Assign <strong className="text-foreground">{targetName}</strong> to{" "}
                  <strong className="text-foreground">{pending?.project.title}</strong>?
                </>
              ) : (
                <>
                  Remove the manager from{" "}
                  <strong className="text-foreground">{pending?.project.title}</strong>?
                  They lose manager access to it.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Deep-archived projects are hidden even from the assigned PM.
              Regular archived projects remain visible in the PM's list, so no
              warning is needed for those. Say so before the write, not after. */}
          {pending?.project.deep_archived_at && targetName && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs space-y-1">
              <p className="flex items-center gap-2 font-semibold text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                This project is deep-archived
              </p>
              <p className="text-amber-200/80 leading-relaxed">
                {targetName} will be assigned and emailed, but deep-archived
                projects are hidden from project managers — so it will not
                appear in their project list until it is moved back to regular
                archive or restored. Change the archive level from the
                project's Overview tab.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-background/40 px-3.5 py-3 text-xs text-muted-foreground space-y-1.5">
            <p className="flex items-center gap-2">
              {targetName
                ? <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                : <MailX className="w-3.5 h-3.5 shrink-0" />}
              {targetName
                ? "They will receive an email notification."
                : "No email is sent when removing a manager."}
            </p>
            <p className="flex items-center gap-2">
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              Manager access to this project changes immediately.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirm(); }}
              disabled={saving}
            >
              {saving ? "Saving…" : targetName ? "Assign & notify" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
