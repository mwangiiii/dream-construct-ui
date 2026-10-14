// supabase/functions/manage-user/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({
        success: false,
        error: "No token"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const { data: { user }, error: jwtError } = await supabaseAdmin.auth.getUser(token);
    if (jwtError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid token"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const { data: roles, error: roleError } = await supabaseAdmin.from("user_roles").select("role_name").eq("user_id", user.id);
    if (roleError || !roles?.some((r)=>[
        "admin",
        "manager"
      ].includes(r.role_name))) {
      return new Response(JSON.stringify({
        success: false,
        error: "Admin or Manager access required"
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const isAdmin = roles?.some((r)=>r.role_name === "admin");
    const body = await req.json();
    const { action, userId, updates } = body;
    console.log("REQUEST BODY:", JSON.stringify({
      action,
      userId,
      updates
    }));
    if (action === "list-emails") {
      return await handleListEmails(supabaseAdmin);
    }
    if (!action || !userId) {
      return new Response(JSON.stringify({
        success: false,
        error: "Action and userId required"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    switch(action){
      case "update":
        return await handleUpdate(supabaseAdmin, userId, updates, user.id, isAdmin);
      case "delete":
        return await handleDelete(supabaseAdmin, userId, user.id, isAdmin, authHeader);
      case "soft-delete":
        return await handleSoftDelete(supabaseAdmin, userId, updates?.statusId || 3, user.id, isAdmin);
      case "restore":
        return await handleRestore(supabaseAdmin, userId, user.id, isAdmin);
      case "change-status":
        return await handleStatusChange(supabaseAdmin, userId, updates.status_id, user.id, isAdmin);
      case "change-role":
        return await handleRoleChange(supabaseAdmin, userId, updates.role, user.id, isAdmin);
      case "reset-password":
        return await handlePasswordReset(supabaseAdmin, userId, updates.password, isAdmin);
      default:
        return new Response(JSON.stringify({
          success: false,
          error: `Unknown action: ${action}`
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
    }
  } catch (err) {
    console.error("Fatal error:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || "Internal server error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
// ─── Allowed roles — must stay in sync with frontend ROLES object ─────────────
const ALLOWED_ROLES = [
  "admin",
  "manager",
  "client",
  "finance",
  "surveyor",
  "project_manager"
];
// === LIST EMAILS ===
async function handleListEmails(supabase) {
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      perPage: 1000
    });
    if (error) throw error;
    const emails = {};
    for (const u of users){
      emails[u.id] = u.email ?? "";
    }
    return new Response(JSON.stringify({
      success: true,
      emails
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("List emails error:", err);
    throw err;
  }
}
// === UPDATE USER ===
async function handleUpdate(supabase, userId, updates, callerId, isAdmin) {
  try {
    if (!isAdmin) {
      const { data: targetRoles } = await supabase.from("user_roles").select("role_name").eq("user_id", userId);
      if (targetRoles?.some((r)=>r.role_name === "admin")) {
        return new Response(JSON.stringify({
          success: false,
          error: "Cannot modify admin users"
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
    }
    if (userId === callerId && updates.role && updates.role !== "admin") {
      return new Response(JSON.stringify({
        success: false,
        error: "Cannot change your own role"
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const profileUpdates = {};
    if (updates.full_name !== undefined) profileUpdates.full_name = updates.full_name.trim();
    if (updates.phone !== undefined) profileUpdates.phone = updates.phone.trim() || null;
    if (updates.company_name !== undefined) profileUpdates.company_name = updates.company_name.trim() || null;
    if (updates.job_title !== undefined) profileUpdates.job_title = updates.job_title.trim() || null;
    if (updates.status_id !== undefined) profileUpdates.status_id = updates.status_id;
    // show_on_team_page is a strict boolean — only write it when explicitly sent.
    // We check typeof to distinguish "not sent" (undefined) from a deliberate false.
    if (typeof updates.show_on_team_page === "boolean") {
      profileUpdates.show_on_team_page = updates.show_on_team_page;
    }
    if (Object.keys(profileUpdates).length > 0) {
      profileUpdates.updated_at = new Date().toISOString();
      const { error: profileError } = await supabase.from("profiles").update(profileUpdates).eq("id", userId);
      if (profileError) throw profileError;
    }
    if (updates.email && updates.email.trim()) {
      const { error: emailError } = await supabase.auth.admin.updateUserById(userId, {
        email: updates.email.trim().toLowerCase()
      });
      if (emailError) throw emailError;
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          full_name: updates.full_name || undefined
        }
      });
    }
    // Only validate and update role when explicitly provided in the payload.
    if (updates.role !== undefined && updates.role !== null && updates.role !== "") {
      if (!ALLOWED_ROLES.includes(updates.role)) {
        return new Response(JSON.stringify({
          success: false,
          error: `Invalid role: ${updates.role}`
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      if (updates.role === "admin" && !isAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: "Only admins can assign admin role"
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: userId,
        role_name: updates.role,
        assigned_by: callerId
      });
      if (roleError) throw roleError;
    }
    return new Response(JSON.stringify({
      success: true,
      message: "User updated successfully"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Update error:", err);
    throw err;
  }
}
// === SOFT DELETE USER (Suspend) ===
async function handleSoftDelete(supabase, userId, statusId, callerId, isAdmin) {
  try {
    if (userId === callerId) {
      return new Response(JSON.stringify({
        success: false,
        error: "Cannot suspend your own account"
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (!isAdmin) {
      const { data: targetRoles } = await supabase.from("user_roles").select("role_name").eq("user_id", userId);
      if (targetRoles?.some((r)=>r.role_name === "admin")) {
        return new Response(JSON.stringify({
          success: false,
          error: "Cannot suspend admin users"
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
    }
    const { error: statusError } = await supabase.from("profiles").update({
      status_id: statusId,
      updated_at: new Date().toISOString()
    }).eq("id", userId);
    if (statusError) throw statusError;
    return new Response(JSON.stringify({
      success: true,
      message: "User suspended successfully"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Soft delete error:", err);
    throw err;
  }
}
// === RESTORE USER ===
async function handleRestore(supabase, userId, callerId, isAdmin) {
  try {
    if (!isAdmin) {
      const { data: targetRoles } = await supabase.from("user_roles").select("role_name").eq("user_id", userId);
      if (targetRoles?.some((r)=>r.role_name === "admin")) {
        return new Response(JSON.stringify({
          success: false,
          error: "Cannot restore admin users"
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
    }
    const { error: statusError } = await supabase.from("profiles").update({
      status_id: 1,
      updated_at: new Date().toISOString()
    }).eq("id", userId);
    if (statusError) throw statusError;
    return new Response(JSON.stringify({
      success: true,
      message: "User restored to active status"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Restore error:", err);
    throw err;
  }
}
// === DELETE USER (HARD DELETE - PERMANENT) ===
async function handleDelete(supabase, userId, callerId, isAdmin, authHeader) {
  try {
    if (userId === callerId) {
      return new Response(JSON.stringify({
        success: false,
        error: "Cannot delete your own account"
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({
        success: false,
        error: "Admin access required to delete users"
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const { data: targetRoles } = await supabase.from("user_roles").select("role_name").eq("user_id", userId);
    const targetIsAdmin = targetRoles?.some((r)=>r.role_name === "admin");

    // Admin can delete any role (including other admins) EXCEPT the last
    // active admin. Count other active admins to make sure there's at least
    // one left after this delete.
    if (targetIsAdmin) {
      const { count: otherActiveAdminCount, error: countErr } = await supabase
        .from("user_roles")
        .select("user_id, profiles!inner(status_id, user_statuses!inner(is_active))", { count: "exact", head: true })
        .eq("role_name", "admin")
        .eq("profiles.user_statuses.is_active", true)
        .neq("user_id", userId);
      if (countErr) {
        return new Response(JSON.stringify({
          success: false,
          error: "Could not verify remaining admin count: " + countErr.message
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if ((otherActiveAdminCount ?? 0) < 1) {
        return new Response(JSON.stringify({
          success: false,
          error: "Cannot delete the last active admin. Promote another user to admin first."
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // If the target is a client (or anyone) who owns projects, cascade-delete
    // each project via the project-lifecycle Edge Function so storage + sub-
    // tables are cleaned up through the already-tested path. Pure DB CASCADE
    // would skip storage. Projects where the user is only the manager survive
    // automatically — projects.manager_id is ON DELETE SET NULL.
    const { data: ownedProjects, error: ownedErr } = await supabase
      .from("projects")
      .select("id")
      .eq("client_id", userId);
    if (ownedErr) {
      return new Response(JSON.stringify({
        success: false,
        error: "Could not list user's projects: " + ownedErr.message
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if ((ownedProjects?.length ?? 0) > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      for (const p of ownedProjects!) {
        // Forward the caller's bearer token so project-lifecycle's admin
        // RPC resolves to the same admin that invoked manage-user.
        const resp = await fetch(`${supabaseUrl}/functions/v1/project-lifecycle`, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "apikey":        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            "Content-Type":  "application/json",
          },
          body: JSON.stringify({ action: "permanent_delete", project_id: p.id }),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to delete owned project ${p.id}: ${text || resp.statusText}`
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }
    const { error: e1 } = await supabase.from("user_roles").update({
      assigned_by: null
    }).eq("assigned_by", userId);
    if (e1) console.warn("Could not nullify user_roles.assigned_by:", e1.message);
    const { error: e2 } = await supabase.from("projects").update({
      created_by: null
    }).eq("created_by", userId);
    if (e2) console.warn("Could not nullify projects.created_by:", e2.message);
    const { error: e3 } = await supabase.from("project_milestones").update({
      created_by: null
    }).eq("created_by", userId);
    if (e3) console.warn("Could not nullify project_milestones.created_by:", e3.message);
    const { error: e4 } = await supabase.from("project_updates").update({
      posted_by: null
    }).eq("posted_by", userId);
    if (e4) console.warn("Could not nullify project_updates.posted_by:", e4.message);
    const { error: e5 } = await supabase.from("project_updates").update({
      deleted_by: null
    }).eq("deleted_by", userId);
    if (e5) console.warn("Could not nullify project_updates.deleted_by:", e5.message);
    const { error: e6 } = await supabase.from("project_approvals").update({
      requested_by: null
    }).eq("requested_by", userId);
    if (e6) console.warn("Could not nullify project_approvals.requested_by:", e6.message);
    const { error: e7 } = await supabase.from("project_approvals").update({
      approved_by: null
    }).eq("approved_by", userId);
    if (e7) console.warn("Could not nullify project_approvals.approved_by:", e7.message);
    const { error: e8 } = await supabase.from("tasks").update({
      created_by: null
    }).eq("created_by", userId);
    if (e8) console.warn("Could not nullify tasks.created_by:", e8.message);
    const { error: e9 } = await supabase.from("documents").update({
      uploaded_by: null
    }).eq("uploaded_by", userId);
    if (e9) console.warn("Could not nullify documents.uploaded_by:", e9.message);
    const { error: e10 } = await supabase.from("audit_logs").update({
      changed_by: null
    }).eq("changed_by", userId);
    if (e10) console.warn("Could not nullify audit_logs.changed_by:", e10.message);
    const { error: e11 } = await supabase.from("contacts").update({
      created_by: null
    }).eq("created_by", userId);
    if (e11) console.warn("Could not nullify contacts.created_by:", e11.message);
    const { error: e12 } = await supabase.from("media_posts").update({
      uploaded_by: null
    }).eq("uploaded_by", userId);
    if (e12) console.warn("Could not nullify media_posts.uploaded_by:", e12.message);
    const { error: e13 } = await supabase.from("workers").update({
      created_by: null
    }).eq("created_by", userId);
    if (e13) console.warn("Could not nullify workers.created_by:", e13.message);
    const { error: e14 } = await supabase.from("worker_attendance").update({
      created_by: null
    }).eq("created_by", userId);
    if (e14) console.warn("Could not nullify worker_attendance.created_by:", e14.message);
    const { error: e15 } = await supabase.from("worker_assignments").update({
      created_by: null
    }).eq("created_by", userId);
    if (e15) console.warn("Could not nullify worker_assignments.created_by:", e15.message);
    const { error: rolesError } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (rolesError) throw new Error(`Failed to delete user roles: ${rolesError.message}`);
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;
    return new Response(JSON.stringify({
      success: true,
      message: "User permanently deleted"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Delete error:", err);
    throw err;
  }
}
// === CHANGE STATUS ===
async function handleStatusChange(supabase, userId, statusId, callerId, isAdmin) {
  try {
    const validStatuses = [
      1,
      2,
      3,
      4,
      5
    ];
    if (!validStatuses.includes(statusId)) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid status ID"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (!isAdmin) {
      const { data: targetRoles } = await supabase.from("user_roles").select("role_name").eq("user_id", userId);
      if (targetRoles?.some((r)=>r.role_name === "admin")) {
        return new Response(JSON.stringify({
          success: false,
          error: "Cannot modify admin status"
        }), {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
    }
    const { error: statusError } = await supabase.from("profiles").update({
      status_id: statusId,
      updated_at: new Date().toISOString()
    }).eq("id", userId);
    if (statusError) throw statusError;
    return new Response(JSON.stringify({
      success: true,
      message: "Status updated successfully"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Status change error:", err);
    throw err;
  }
}
// === CHANGE ROLE ===
async function handleRoleChange(supabase, userId, newRole, callerId, isAdmin) {
  try {
    if (!ALLOWED_ROLES.includes(newRole)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid role: ${newRole}`
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (newRole === "admin" && !isAdmin) {
      return new Response(JSON.stringify({
        success: false,
        error: "Only admins can assign admin role"
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (userId === callerId && newRole !== "admin") {
      return new Response(JSON.stringify({
        success: false,
        error: "Cannot change your own role"
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      role_name: newRole,
      assigned_by: callerId
    });
    if (roleError) throw roleError;
    return new Response(JSON.stringify({
      success: true,
      message: "Role updated successfully"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Role change error:", err);
    throw err;
  }
}
// === RESET PASSWORD ===
async function handlePasswordReset(supabase, userId, newPassword, isAdmin) {
  try {
    if (!isAdmin) {
      return new Response(JSON.stringify({
        success: false,
        error: "Admin access required to reset passwords"
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (!newPassword || newPassword.length < 6) {
      return new Response(JSON.stringify({
        success: false,
        error: "Password must be at least 6 characters"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const { error: passwordError } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword
    });
    if (passwordError) throw passwordError;
    return new Response(JSON.stringify({
      success: true,
      message: "Password reset successfully"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Password reset error:", err);
    throw err;
  }
}
