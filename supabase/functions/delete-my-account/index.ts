// Permanently deletes the signed-in user's own account.
//
// The caller's identity comes from the JWT only — there is no user id in the
// request body, so this endpoint cannot be pointed at anyone else.
//
// What "everything" means here: the person is removed (auth record, profile,
// role grants, team memberships, notifications, avatar). The company's records
// they authored survive with attribution dropped to NULL — see
// 20261125140000_account_deletion_fk_actions.sql. Deleting six months of site
// attendance because the person who keyed it in left is data loss, not privacy.
//
// Two states block deletion rather than being forced through, because both
// would leave the system inconsistent in a way the user cannot see:
//   * being the last active admin — nobody could administer the system after
//   * being the client on a project — projects.client_id is NOT NULL
//
// Must be STATIC imports with literal URLs: `supabase functions deploy`
// bundles ahead of time, so a dynamic import is invisible to the bundler.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "No token" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: jwtError } =
      await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (jwtError || !user) return json({ error: "Invalid token" }, 401);

    // Typing the exact phrase is the only confirmation. Without it a stray
    // POST to this endpoint from a logged-in session would wipe the account.
    const { confirmation } = await req.json().catch(() => ({ confirmation: null }));
    if (confirmation !== "DELETE MY ACCOUNT") {
      return json({ error: "Confirmation phrase does not match" }, 400);
    }

    const blockers: string[] = [];

    // ── Last administrator ────────────────────────────────────────────────
    const { data: myRoles } = await admin
      .from("user_roles").select("role_name").eq("user_id", user.id);
    const isAdmin = !!myRoles?.some((r: { role_name: string }) => r.role_name === "admin");

    if (isAdmin) {
      const { data: admins } = await admin
        .from("user_roles")
        .select("user_id, profiles!inner(status_id)")
        .eq("role_name", "admin")
        .eq("profiles.status_id", 1);

      const others = new Set(
        (admins ?? [])
          .map((a: { user_id: string }) => a.user_id)
          .filter((id: string) => id !== user.id),
      );
      if (others.size === 0) {
        blockers.push(
          "You are the only active administrator. Promote another administrator first.",
        );
      }
    }

    // ── Client on existing projects ───────────────────────────────────────
    const { data: clientProjects } = await admin
      .from("projects")
      .select("project_number, title")
      .eq("client_id", user.id)
      .limit(20);

    if (clientProjects?.length) {
      const names = clientProjects
        .map((p: { project_number: string; title: string }) =>
          `${p.project_number ?? ""} ${p.title ?? ""}`.trim())
        .join(", ");
      blockers.push(
        `You are the client on ${clientProjects.length} project(s): ${names}. ` +
        `An administrator must reassign or close them first.`,
      );
    }

    if (blockers.length) return json({ error: "blocked", blockers }, 409);

    // ── Remove the person's own files ─────────────────────────────────────
    // Storage is not covered by the FK work: objects would survive as orphans
    // with owner set to NULL, so the avatar is removed explicitly. Failure here
    // must not abort the deletion — a leftover image is recoverable, a
    // half-deleted account is not.
    const removedFiles: string[] = [];
    try {
      const { data: files } = await admin.storage.from("avatars").list(user.id);
      if (files?.length) {
        const paths = files.map((f: { name: string }) => `${user.id}/${f.name}`);
        await admin.storage.from("avatars").remove(paths);
        removedFiles.push(...paths);
      }
    } catch {
      /* best-effort */
    }

    // ── Delete the account ────────────────────────────────────────────────
    // profiles.id, user_roles.user_id and notifications.user_id all cascade
    // from here; authorship columns go NULL.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      // Almost always a FK still set to NO ACTION on a table added after the
      // migration. Surface it verbatim — guessing would hide the real cause.
      return json(
        {
          error: `Could not delete the account: ${deleteError.message}`,
          hint: "A record still references this account. An administrator can clear it.",
        },
        500,
      );
    }

    return json({ success: true, removedFiles: removedFiles.length });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      500,
    );
  }
});
