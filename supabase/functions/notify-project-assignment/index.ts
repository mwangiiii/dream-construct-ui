// Notifies a project manager that a project has been assigned to them.
//
// Everything in the email is re-read from the database using the service role,
// so the client cannot dictate the recipient or the project details — it only
// supplies two ids. The caller's own role is checked first.
//
// Must be STATIC imports with literal URLs: `supabase functions deploy`
// resolves and bundles dependencies ahead of time, so a dynamic
// `import(someVariable)` is invisible to the bundler and fails at runtime.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_USER = Deno.env.get("EMAIL_USERNAME") ?? Deno.env.get("SMTP_USER");
const EMAIL_PASS = Deno.env.get("EMAIL_PASSWORD") ?? Deno.env.get("SMTP_PASS");
const APP_URL = Deno.env.get("APP_URL") ?? "";

// Brand names are the only places the company name is spelled out. If this
// ever changes (rename, rebrand), it changes here and nowhere else. The email
// address itself is read from EMAIL_USERNAME/SMTP_USER at send time, so
// swapping the Gmail account does not require touching templates.
//
//   BRAND_SHORT — compact, impactful; used in the From line.
//   BRAND_LONG  — longer prose form; used inside the email body (letterhead,
//                 footer disclaimer, sign-off fallback).
const BRAND_SHORT = "REVE CONSTRUCT";
const BRAND_LONG  = "Reve Construct Ltd";
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const ACCENT = "#1e3a8a";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// denomailer encodes the body as quoted-printable, which escapes any space at
// the end of a line as "=20". Indented template literals produce exactly that,
// and clients that don't decode soft line breaks render the literal marker.
const compact = (html: string): string =>
  html.replace(/\n\s*/g, "").replace(/\s{2,}/g, " ").trim();

const DT = `padding:7px 0;font-size:11px;text-transform:uppercase;` +
           `letter-spacing:0.7px;color:${MUTED};font-weight:700;width:38%;` +
           `vertical-align:top;border-bottom:1px solid #f1f5f9;`;
const DD = `padding:7px 0;font-size:13px;color:${INK};` +
           `vertical-align:top;border-bottom:1px solid #f1f5f9;`;

function row(label: string, value: string): string {
  if (!value) return "";
  return `<tr><td style="${DT}">${esc(label)}</td><td style="${DD}">${esc(value)}</td></tr>`;
}

function buildHtml(opts: {
  managerName: string;
  projectTitle: string;
  projectNumber: string;
  client: string;
  startDate: string;
  endDate: string;
  status: string;
  projectId: string;
  senderName: string;
  senderEmail: string;
}): string {
  const generated = new Date().toLocaleDateString("en-KE", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const link = APP_URL
    ? `${APP_URL.replace(/\/$/, "")}/project_manager/projects/${opts.projectId}`
    : "";

  return compact(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Project Assignment</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="max-width:640px;background:#ffffff;border:1px solid ${LINE};
              border-radius:4px;overflow:hidden;
              font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">

  <tr><td style="background:${ACCENT};padding:18px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="font-size:15px;font-weight:700;letter-spacing:1.4px;color:#ffffff;">
        ${esc(BRAND_LONG)}
      </td>
      <td align="right"
          style="font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#c7d2fe;">
        Project Assignment
      </td>
    </tr>
    </table>
  </td></tr>

  <tr><td style="padding:26px 28px 14px;">
    <div style="font-size:21px;font-weight:700;letter-spacing:-0.3px;">
      You have been assigned a project
    </div>
    <div style="font-size:12px;color:${MUTED};margin-top:5px;">
      ${esc(opts.managerName)} · Project Manager
    </div>
    <div style="font-size:11px;color:${MUTED};margin-top:2px;">Generated ${generated}</div>
  </td></tr>

  <tr><td style="padding:0 28px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#f8fafc;border-left:3px solid ${ACCENT};">
    <tr><td style="padding:13px 15px;font-size:13px;line-height:1.55;">
      You are now the project manager for
      <strong>${esc(opts.projectTitle)}</strong>.
      You have manager access to its milestones, tasks, workers and reports.
    </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 28px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row("Project", opts.projectTitle)}
      ${row("Project no.", opts.projectNumber)}
      ${row("Client", opts.client)}
      ${row("Status", opts.status)}
      ${row("Start date", opts.startDate)}
      ${row("Target completion", opts.endDate)}
    </table>
  </td></tr>

  ${link ? `
  <tr><td style="padding:20px 28px 0;">
    <a href="${esc(link)}"
       style="display:inline-block;background:${ACCENT};color:#ffffff;
              text-decoration:none;font-size:13px;font-weight:700;
              padding:11px 20px;border-radius:3px;">Open project</a>
  </td></tr>` : ""}

  <tr><td style="padding:20px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border-top:1px solid ${LINE};">
    <tr><td style="padding-top:14px;font-size:12px;line-height:1.6;">
      <div style="color:${MUTED};">Assigned by</div>
      <div style="font-weight:700;">${esc(opts.senderName)}</div>
      ${opts.senderEmail
        ? `<div><a href="mailto:${esc(opts.senderEmail)}"
              style="color:${ACCENT};text-decoration:none;">${esc(opts.senderEmail)}</a></div>`
        : ""}
    </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:18px 28px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#f8fafc;border:1px solid ${LINE};">
    <tr><td style="padding:12px 15px;font-size:10px;line-height:1.7;color:${MUTED};">
      This is an automated notification from ${esc(BRAND_LONG)}. If you believe this
      assignment was made in error, contact the sender above.
    </td></tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!EMAIL_USER || !EMAIL_PASS) {
      return json({ error: "Mail transport is not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "No token" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: jwtError } =
      await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (jwtError || !user) return json({ error: "Invalid token" }, 401);

    // Only the roles that can reassign a project may announce it.
    const { data: roles } = await admin
      .from("user_roles").select("role_name").eq("user_id", user.id);
    const allowed = ["manager", "admin"];
    if (!roles?.some((r: { role_name: string }) => allowed.includes(r.role_name))) {
      return json({ error: "Manager or admin access required" }, 403);
    }

    const { projectId, managerId } = await req.json();
    if (!projectId || !managerId) {
      return json({ error: "projectId and managerId are required" }, 400);
    }

    const { data: project, error: projErr } = await admin
      .from("projects")
      .select("id, project_number, title, status, start_date, expected_completion_date, manager_id, client_id")
      .eq("id", projectId)
      .maybeSingle();
    if (projErr) return json({ error: `Could not read project: ${projErr.message}` }, 500);
    if (!project) return json({ error: "Project not found" }, 404);

    // Guards against a stale or spoofed call announcing an assignment that was
    // never actually saved.
    if (project.manager_id !== managerId) {
      return json({ error: "That manager is not assigned to this project" }, 409);
    }

    const { data: manager } = await admin
      .from("profiles").select("full_name, email").eq("id", managerId).maybeSingle();

    // profiles.email can lag; auth.users is authoritative for delivery.
    let recipient = manager?.email?.trim() ?? "";
    if (!recipient) {
      const { data: authUser } = await admin.auth.admin.getUserById(managerId);
      recipient = authUser?.user?.email ?? "";
    }
    if (!recipient) return json({ error: "That manager has no email address on file" }, 422);

    let clientName = "";
    if (project.client_id) {
      const { data: client } = await admin
        .from("profiles").select("full_name").eq("id", project.client_id).maybeSingle();
      clientName = client?.full_name ?? "";
    }

    const { data: senderProfile } = await admin
      .from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();

    const html = buildHtml({
      managerName: manager?.full_name ?? "Project Manager",
      projectTitle: project.title ?? "Untitled project",
      projectNumber: project.project_number ?? "",
      client: clientName,
      startDate: project.start_date ?? "",
      endDate: project.expected_completion_date ?? "",
      status: project.status ?? "",
      projectId: project.id,
      senderName: senderProfile?.full_name?.trim() || user.email || BRAND_LONG,
      senderEmail: senderProfile?.email?.trim() || user.email || "",
    });

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: EMAIL_USER, password: EMAIL_PASS },
      },
    });

    try {
      await client.send({
        from: `${BRAND_SHORT} <${EMAIL_USER}>`,
        to: recipient,
        subject: `Project assigned: ${project.title ?? "Untitled project"}`,
        // text/plain alternative, not a second copy of the body.
        content: "auto",
        html,
      });
    } finally {
      await client.close();
    }

    return json({ success: true, notified: recipient });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      500,
    );
  }
});
