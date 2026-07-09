// =============================================================================
//  permanent-delete-project
//
//  Admin-only. Orchestrates a full project purge:
//    1. Verifies the caller is an admin via is_current_user_admin() RPC.
//    2. Recursively lists every file under `<project_id>/` in the
//       `documents-and-images` bucket, then deletes them via the Storage
//       API (chunked). This is the *physical* file cleanup — SQL alone
//       can drop the storage.objects rows but the underlying S3 objects
//       are GC'd asynchronously.
//    3. Calls the permanent_delete_project(pid) SQL RPC which runs the
//       DB-side cascade in one transaction (invoices, contacts, payroll,
//       project + every CASCADE-linked table, workers with zero remaining
//       assignments, notifications with matching project_id).
//
//  Env required:
//    SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
//  POST body:
//    { "project_id": "<uuid>" }
//
//  Response:
//    { success, project_id, storage_files_removed, storage_errors? }
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

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

    let body: { project_id?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const projectId = body.project_id;
    if (!projectId || typeof projectId !== "string") {
      return json({ error: "Missing required field: project_id" }, 400);
    }

    // User-scoped client — runs RPCs as the caller so admin gating applies.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client — needed for recursive storage listing / deletion.
    const svcClient = createClient(supabaseUrl, serviceRoleKey);

    // 1) Admin check.
    const { data: isAdmin, error: adminErr } = await userClient.rpc("is_current_user_admin");
    if (adminErr) {
      return json({ error: "Admin check failed", details: adminErr.message }, 500);
    }
    if (!isAdmin) {
      return json({ error: "Only admins may permanently delete projects" }, 403);
    }

    // 2) Recursively collect every file path under <projectId>/.
    //    Supabase's storage.list() is NOT recursive — items whose `id` is
    //    null represent sub-folders and must be descended into.
    const filesToDelete: string[] = [];
    const storageErrors: string[] = [];

    async function listRecursive(prefix: string): Promise<void> {
      const { data, error } = await svcClient
        .storage
        .from(BUCKET)
        .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
      if (error) {
        storageErrors.push(`list(${prefix}): ${error.message}`);
        return;
      }
      for (const item of data ?? []) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null) {
          await listRecursive(path); // folder
        } else {
          filesToDelete.push(path);
        }
      }
    }
    await listRecursive(projectId);

    // 3) Delete the collected files in chunks (Supabase remove() accepts
    //    an array but very large batches can time out — chunk to 100).
    let storageFilesRemoved = 0;
    if (filesToDelete.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < filesToDelete.length; i += chunkSize) {
        const chunk = filesToDelete.slice(i, i + chunkSize);
        const { error } = await svcClient.storage.from(BUCKET).remove(chunk);
        if (error) {
          storageErrors.push(`remove(chunk ${i / chunkSize}): ${error.message}`);
        } else {
          storageFilesRemoved += chunk.length;
        }
      }
    }

    // 4) DB cascade — user-scoped so the RPC re-verifies admin.
    const { error: rpcErr } = await userClient.rpc("permanent_delete_project", {
      pid: projectId,
    });
    if (rpcErr) {
      return json({
        success: false,
        error:   "DB delete failed",
        details: rpcErr.message,
        storage_files_removed: storageFilesRemoved,
        storage_errors:        storageErrors.length ? storageErrors : undefined,
      }, 500);
    }

    return json({
      success: true,
      project_id: projectId,
      storage_files_removed: storageFilesRemoved,
      storage_errors: storageErrors.length ? storageErrors : undefined,
    });
  } catch (error) {
    return json({ error: (error as Error).message ?? "Internal server error" }, 500);
  }
});
