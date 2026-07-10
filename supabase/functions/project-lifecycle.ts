// =============================================================================
//  project-lifecycle
//
//  Single admin-only endpoint for all destructive / reversible project
//  state changes:
//
//    action = "archive"           → soft delete (sets archived_at)
//    action = "restore"           → undo archive (clears archived_at)
//    action = "permanent_delete"  → hard delete of the project and every
//                                   record it produced, including files
//                                   under `<project_id>/` in the
//                                   documents-and-images bucket
//
//  All three verify the caller is an admin via the is_current_user_admin()
//  RPC. Only `permanent_delete` touches storage; archive / restore are
//  pure DB toggles.
//
//  Env required:
//    SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
//  POST body:
//    { "action": "archive" | "restore" | "permanent_delete",
//      "project_id": "<uuid>" }
//
//  Response (success):
//    archive / restore:  { success: true, action, project_id }
//    permanent_delete:   { success: true, action, project_id,
//                          storage_files_removed, storage_errors? }
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type Action = "archive" | "restore" | "permanent_delete";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "documents-and-images";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function purgeProjectStorage(
  svcClient: SupabaseClient,
  projectId: string,
): Promise<{ removed: number; errors: string[] }> {
  const filesToDelete: string[] = [];
  const errors: string[] = [];

  // Supabase's storage.list() is not recursive — items whose `id` is null
  // are sub-folders and must be descended into manually.
  async function listRecursive(prefix: string): Promise<void> {
    const { data, error } = await svcClient
      .storage
      .from(BUCKET)
      .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
    if (error) {
      errors.push(`list(${prefix}): ${error.message}`);
      return;
    }
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) await listRecursive(path);
      else filesToDelete.push(path);
    }
  }
  await listRecursive(projectId);

  let removed = 0;
  if (filesToDelete.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < filesToDelete.length; i += chunkSize) {
      const chunk = filesToDelete.slice(i, i + chunkSize);
      const { error } = await svcClient.storage.from(BUCKET).remove(chunk);
      if (error) errors.push(`remove(chunk ${i / chunkSize}): ${error.message}`);
      else removed += chunk.length;
    }
  }
  return { removed, errors };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")   return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing or invalid Authorization header" }, 401);
    }

    const supabaseUrl    = Deno.env.get("SUPABASE_URL")              ?? "";
    const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")         ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Missing Supabase environment variables" }, 500);
    }

    let body: { action?: Action; project_id?: string };
    try { body = await req.json(); }
    catch { return json({ error: "Invalid JSON body" }, 400); }

    const action    = body.action;
    const projectId = body.project_id;

    if (!action || !["archive", "restore", "permanent_delete"].includes(action)) {
      return json({ error: "Invalid or missing action. Expected archive | restore | permanent_delete" }, 400);
    }
    if (!projectId || typeof projectId !== "string") {
      return json({ error: "Missing required field: project_id" }, 400);
    }

    // User-scoped client — runs RPCs as the caller so admin gating in the
    // SQL functions applies to their identity.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin check. Every action is admin-only.
    const { data: isAdmin, error: adminErr } = await userClient.rpc("is_current_user_admin");
    if (adminErr) return json({ error: "Admin check failed", details: adminErr.message }, 500);
    if (!isAdmin) return json({ error: `Only admins may ${action.replace("_", " ")} projects` }, 403);

    // ── Archive ─────────────────────────────────────────────────────────────
    if (action === "archive") {
      const { error } = await userClient.rpc("archive_project", { pid: projectId });
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, action, project_id: projectId });
    }

    // ── Restore ─────────────────────────────────────────────────────────────
    if (action === "restore") {
      const { error } = await userClient.rpc("restore_project", { pid: projectId });
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, action, project_id: projectId });
    }

    // ── Permanent delete ────────────────────────────────────────────────────
    // Storage cleanup runs BEFORE the DB delete so if it fails halfway we
    // don't end up with a phantom project row referencing files that no
    // longer exist. If storage cleanup fully fails we still proceed with
    // the DB delete because the SQL function's storage.objects cleanup
    // (from the hardening migration) will drop the DB references, and the
    // physical files will be orphaned but Supabase's storage GC will
    // eventually clean them up. Per-chunk errors are surfaced in the
    // response so an operator can retry manually.
    const svcClient = createClient(supabaseUrl, serviceRoleKey);
    const { removed: storageFilesRemoved, errors: storageErrors } =
      await purgeProjectStorage(svcClient, projectId);

    const { error: rpcErr } = await userClient.rpc("permanent_delete_project", { pid: projectId });
    if (rpcErr) {
      return json({
        success: false,
        action,
        error:   "DB delete failed",
        details: rpcErr.message,
        storage_files_removed: storageFilesRemoved,
        storage_errors:        storageErrors.length ? storageErrors : undefined,
      }, 500);
    }

    return json({
      success: true,
      action,
      project_id: projectId,
      storage_files_removed: storageFilesRemoved,
      storage_errors: storageErrors.length ? storageErrors : undefined,
    });
  } catch (error) {
    return json({ error: (error as Error).message ?? "Internal server error" }, 500);
  }
});
