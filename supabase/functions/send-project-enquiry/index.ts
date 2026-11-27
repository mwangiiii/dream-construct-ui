// Admin → Project Manager enquiry email.
//
// The admin writes a message against a specific project; this function
// re-reads the project and its PM from the database with the service role so
// the client cannot dictate who the enquiry is sent to — it only supplies the
// project id and the message text. The caller's role is checked first (admin
// only).
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
const BRAND_SHORT = "REVE CONSTRUCT";
const BRAND_LONG  = "Reve Construct Ltd";
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const ACCENT = "#1e3a8a";

const MAX_SUBJECT_LEN = 180;
const MAX_MESSAGE_LEN = 8000;

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

// Preserve paragraph breaks in the user's message body without letting raw
// HTML through. Each line is HTML-escaped; blank lines become paragraph
// separators, single newlines become <br>.
function renderMessage(message: string): string {
  return message
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 10px 0;">${esc(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

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
  projectId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
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
<title>${esc(opts.subject)}</title>
</head>
<body style="margin:0;background:#f5f7fb;padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
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
        Project Enquiry
      </td>
    </tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 28px 6px;">
    <div style="font-size:19px;font-weight:700;letter-spacing:-0.2px;">
      ${esc(opts.subject)}
    </div>
    <div style="font-size:12px;color:${MUTED};margin-top:5px;">
      Sent ${generated} from the admin console
    </div>
  </td></tr>

  <tr><td style="padding:14px 28px 6px;">
    <div style="font-size:12px;color:${MUTED};margin-bottom:6px;">
      Hello ${esc(opts.managerName || "project manager")},
    </div>
    <div style="font-size:13px;line-height:1.6;color:${INK};">
      ${renderMessage(opts.message)}
    </div>
  </td></tr>

  <tr><td style="padding:14px 28px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${row("Project", `${opts.projectNumber ? opts.projectNumber + " · " : ""}${opts.projectTitle}`)}
    ${row("Sender", `${opts.senderName}${opts.senderEmail ? " · " + opts.senderEmail : ""}`)}
    </table>
  </td></tr>

  ${link ? `
  <tr><td style="padding:12px 28px 18px;">
    <a href="${esc(link)}"
       style="display:inline-block;background:${ACCENT};color:#ffffff;
              font-size:12px;font-weight:600;letter-spacing:0.3px;
              padding:10px 18px;border-radius:3px;text-decoration:none;">
      Open project
    </a>
  </td></tr>` : ""}

  <tr><td style="padding:18px 28px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#f8fafc;border:1px solid ${LINE};">
    <tr><td style="padding:12px 15px;font-size:10px;line-height:1.7;color:${MUTED};">
      You received this enquiry from the admin team at ${esc(BRAND_LONG)}.
      Reply directly to the sender at the email above.
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
  if (req.method !== "POST")   return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing or invalid Authorization header" }, 401);
    }

    if (!EMAIL_USER || !EMAIL_PASS) {
      return json({
        error: "Mail credentials are not configured on this project",
        accepted_secret_names: [
          "EMAIL_USERNAME or SMTP_USER",
          "EMAIL_PASSWORD or SMTP_PASS",
        ],
      }, 500);
    }

    const supabaseUrl    = Deno.env.get("SUPABASE_URL")              ?? "";
    const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")         ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Missing Supabase environment variables" }, 500);
    }

    let body: { projectId?: string; subject?: string; message?: string };
    try { body = await req.json(); }
    catch { return json({ error: "Invalid JSON body" }, 400); }

    const projectId = (body.projectId ?? "").trim();
    const rawSubject = (body.subject ?? "").trim();
    const message = (body.message ?? "").trim();

    if (!projectId) return json({ error: "projectId is required" }, 400);
    if (!message)   return json({ error: "message is required" }, 400);
    if (message.length > MAX_MESSAGE_LEN) {
      return json({ error: `message is too long (max ${MAX_MESSAGE_LEN} chars)` }, 400);
    }
    const subject = rawSubject.length > 0
      ? rawSubject.slice(0, MAX_SUBJECT_LEN)
      : "Project enquiry";

    // User-scoped client: used to verify the caller's role under their JWT.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
    const user = userData.user;

    // Only admins may send enquiries. is_current_user_admin() already exists
    // in this project and runs with SECURITY DEFINER.
    const { data: isAdminFlag, error: adminErr } =
      await userClient.rpc("is_current_user_admin");
    if (adminErr) {
      return json({ error: "Admin check failed", details: adminErr.message }, 500);
    }
    if (!isAdminFlag) {
      return json({ error: "Only admins may send project enquiries" }, 403);
    }

    // Service-role client: used to read project + PM + sender details without
    // depending on RLS, so the client cannot influence the recipient.
    const svc = createClient(supabaseUrl, serviceRoleKey);

    const { data: project, error: projErr } = await svc
      .from("projects")
      .select("id, title, project_number, manager_id")
      .eq("id", projectId)
      .maybeSingle();
    if (projErr) {
      return json({ error: "Project lookup failed", details: projErr.message }, 500);
    }
    if (!project) return json({ error: "Project not found" }, 404);
    if (!project.manager_id) {
      return json({
        error: "This project has no assigned project manager. Assign one from /admin/assignments before sending an enquiry.",
      }, 422);
    }

    // Prefer profiles.email; fall back to auth.users via admin API so a blank
    // profile email does not silently drop the enquiry.
    const { data: pmProfile } = await svc
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", project.manager_id)
      .maybeSingle();

    let recipient = (pmProfile?.email ?? "").trim();
    if (!recipient) {
      const { data: authUser } = await svc.auth.admin.getUserById(project.manager_id);
      recipient = (authUser?.user?.email ?? "").trim();
    }
    if (!recipient) {
      return json({
        error: "Project manager has no email on record. Ask them to set one before sending an enquiry.",
      }, 422);
    }

    const { data: senderProfile } = await svc
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const senderName  = senderProfile?.full_name?.trim() || user.email || "Admin";
    const senderEmail = senderProfile?.email?.trim() || user.email || "";

    const html = buildHtml({
      managerName:   pmProfile?.full_name ?? "",
      projectTitle:  project.title ?? "Untitled project",
      projectNumber: project.project_number ?? "",
      projectId:     project.id,
      senderName,
      senderEmail,
      subject,
      message,
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
        // Replying to the admin sender (if they have an email) is the natural
        // flow — the PM hits Reply and lands in the sender's inbox, not the
        // shared mailbox.
        ...(senderEmail ? { replyTo: senderEmail } : {}),
        subject: `[Enquiry] ${subject}`,
        content: "auto",
        html,
      });
    } finally {
      try { await client.close(); } catch { /* best-effort */ }
    }

    return json({
      success: true,
      project_id: project.id,
      manager_id: project.manager_id,
      recipient,
    });
  } catch (error) {
    return json({ error: (error as Error).message ?? "Internal server error" }, 500);
  }
});
