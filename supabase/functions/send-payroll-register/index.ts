// supabase/functions/send-payroll-register/index.ts
//
// Emails a payroll register as an inline HTML table.
//
// Shape follows send-financial-email / manage-user: Bearer JWT in, role check
// against user_roles, service-role client for the privileged work.
//
// ── Why the client only sends IDs ───────────────────────────────────────────
// The request carries payroll_ids, not amounts. Wages are re-read here with
// the service role and formatted server-side, so a tampered request cannot
// email fabricated figures over the company's SMTP identity. The client-side
// filters (search / status / tab) decide WHICH ids are sent; this function
// decides what the numbers are.
//
// Secrets (Edge Functions → Secrets):
//   EMAIL_USERNAME   required — mailbox to authenticate and send as.
//                               SMTP_USER accepted as an alias.
//   EMAIL_PASSWORD   required — Gmail App Password, not the account password.
//                               SMTP_PASS accepted as an alias.
//   SMTP_HOST        optional — defaults to smtp.gmail.com
//   SMTP_PORT        optional — defaults to 465 (implicit TLS)
//   SMTP_FROM        optional — defaults to EMAIL_USERNAME
//   SMTP_FROM_NAME   optional — defaults to BRAND_SHORT ("REVE CONSTRUCT")

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Must be a STATIC import with a literal URL. `supabase functions deploy`
// resolves and bundles dependencies ahead of time, so a dynamic
// `import(someVariable)` is invisible to the bundler and fails at runtime with
// "Module not found" even though the URL is perfectly valid. 1.6.0 is the
// current denomailer release and mod.ts is its entry point.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface PayrollRow {
  id: number;
  employee_name: string | null;
  job_id: string | null;
  gross_pay: number | null;
  nssf_total: number | null;
  shif: number | null;
  housing_levy: number | null;
  paye_net: number | null;
  total_deductions: number | null;
  net_pay: number | null;
  due_date: string | null;
  payment_status: string | null;
  project_id: string | null;
  // Payslip mode only — the register does not show this level of detail.
  nssf_tier1: number | null;
  nssf_tier2: number | null;
  pension: number | null;
  taxable_income: number | null;
  personal_relief: number | null;
  insurance_relief: number | null;
  rate: number | null;
  rate_type: string | null;
  time_worked: string | null;
  paid_date: string | null;
  bank_code: string | null;
  etims_code: string | null;
  serial_no: string | null;
  notes: string | null;
}

const PAYROLL_COLUMNS =
  "id,employee_name,job_id,gross_pay,nssf_total,shif,housing_levy,paye_net," +
  "total_deductions,net_pay,due_date,payment_status,project_id,nssf_tier1," +
  "nssf_tier2,pension,taxable_income,personal_relief,insurance_relief,rate," +
  "rate_type,time_worked,paid_date,bank_code,etims_code,serial_no,notes";

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const n0 = (v: number | null | undefined): number =>
  typeof v === "number" && isFinite(v) ? v : 0;

const kes = (v: number | null | undefined): string =>
  `KES ${n0(v).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortDate = (d: string | null): string =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-KE",
    { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ─── CORPORATE EMAIL SHELL ────────────────────────────────────────────────────
// Email HTML is not web HTML. Gmail strips <style> blocks, flexbox and CSS
// grid, so everything here is nested tables with inline styles only — the one
// layout approach that renders consistently across Gmail, Outlook and Apple
// Mail. Keep it that way.

// Brand names are the only places the company name is spelled out. If this
// ever changes (rename, rebrand), it changes here and nowhere else. The email
// address itself is read from EMAIL_USERNAME/SMTP_USER at send time, so
// swapping the Gmail account does not require touching templates.
//
//   BRAND_SHORT — compact, impactful; used in the From line (and the
//                 SMTP_FROM_NAME env override, if unset).
//   BRAND_LONG  — longer prose form; used inside the email body (letterhead,
//                 footer disclaimer, sign-off fallback).
const BRAND_SHORT = "REVE CONSTRUCT";
const BRAND_LONG  = "Reve Construct Ltd";
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const ACCENT = "#1e3a8a";

interface Sender { name: string; email: string }

// Collapses whitespace between tags before sending.
//
// This is not cosmetic. denomailer encodes the body as quoted-printable, which
// must escape any space that falls at the end of a line — it emits "=20".
// Indented template literals produce exactly that, and clients that do not
// decode soft line breaks render the literal "=20" through the document. The
// stray markers in the payslip and register output were all this.
//
// Text content is protected: message newlines are converted to <br> before
// this runs, so collapsing whitespace cannot destroy intended line breaks.
const compact = (html: string): string =>
  html
    .replace(/\n\s*/g, "")   // drop newlines and their indentation
    .replace(/\s{2,}/g, " ") // squeeze any remaining runs
    .trim();

// Preserve author line breaks without relying on white-space:pre-wrap, which
// Outlook ignores.
const nl2br = (s: string): string => esc(s).replace(/\r?\n/g, "<br>");

function shell(opts: {
  docType: string;
  heading: string;
  subheading: string;
  message: string;
  bodyHtml: string;
  sender: Sender;
}): string {
  const { docType, heading, subheading, message, bodyHtml, sender } = opts;

  const generated = new Date().toLocaleDateString("en-KE", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return compact(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="max-width:880px;background:#ffffff;border:1px solid ${LINE};
              border-radius:4px;overflow:hidden;
              font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">

  <!-- Letterhead -->
  <tr><td style="background:${ACCENT};padding:18px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="font-size:15px;font-weight:700;letter-spacing:1.4px;color:#ffffff;">
        ${esc(BRAND_LONG)}
      </td>
      <td align="right"
          style="font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#c7d2fe;">
        ${esc(docType)}
      </td>
    </tr>
    </table>
  </td></tr>

  <!-- Title block -->
  <tr><td style="padding:26px 28px 14px;">
    <div style="font-size:21px;font-weight:700;letter-spacing:-0.3px;">${esc(heading)}</div>
    <div style="font-size:12px;color:${MUTED};margin-top:5px;">${esc(subheading)}</div>
    <div style="font-size:11px;color:${MUTED};margin-top:2px;">Generated ${generated}</div>
  </td></tr>

  ${message.trim() ? `
  <tr><td style="padding:0 28px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#f8fafc;border-left:3px solid ${ACCENT};">
    <tr><td style="padding:13px 15px;font-size:13px;line-height:1.55;">${nl2br(message)}</td></tr>
    </table>
  </td></tr>` : ""}

  <!-- Document body -->
  <tr><td style="padding:0 28px 8px;">${bodyHtml}</td></tr>

  <!-- Sign-off -->
  <tr><td style="padding:20px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border-top:1px solid ${LINE};">
    <tr><td style="padding-top:14px;font-size:12px;line-height:1.6;">
      <div style="color:${MUTED};">Prepared and sent by</div>
      <div style="font-weight:700;">${esc(sender.name)}</div>
      ${sender.email
        ? `<div><a href="mailto:${esc(sender.email)}"
              style="color:${ACCENT};text-decoration:none;">${esc(sender.email)}</a></div>`
        : ""}
    </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:18px 28px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#f8fafc;border:1px solid ${LINE};">
    <tr><td style="padding:12px 15px;font-size:10px;line-height:1.7;color:${MUTED};">
      <strong style="color:#b91c1c;">CONFIDENTIAL</strong> — contains employee
      compensation data. Intended solely for the named recipient. If you received
      this in error, delete it and notify the sender.<br>
      Computed per KRA / NSSF / SHIF / Affordable Housing Levy rules, 2026 rates.
      &nbsp;·&nbsp; ${esc(BRAND_LONG)}
    </td></tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`);
}

// Shared cell styles — repeated inline because email clients ignore classes.
const TD = `padding:9px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;`;
const TD_R = TD + `text-align:right;font-family:'Courier New',monospace;`;
const TH = `padding:9px 10px;text-align:left;font-size:9px;text-transform:uppercase;` +
            `letter-spacing:0.8px;color:${MUTED};font-weight:700;` +
            `background:#f8fafc;border-bottom:2px solid #cbd5e1;`;
const TH_R = TH + `text-align:right;`;
const TF = `padding:11px 10px;border-top:2px solid ${INK};font-weight:700;font-size:12px;`;
const TF_R = TF + `text-align:right;font-family:'Courier New',monospace;`;

function buildHtml(opts: {
  rows: PayrollRow[];
  scope: string;
  message: string;
  sender: Sender;
  projectNames: Record<string, string>;
}): string {
  const { rows, scope, message, sender, projectNames } = opts;

  const sum = (f: (r: PayrollRow) => number) => rows.reduce((a, r) => a + f(r), 0);

  const body = rows.map((r) => `
    <tr>
      <td style="${TD}">${esc(r.employee_name) || "—"}</td>
      <td style="${TD}font-family:'Courier New',monospace;font-size:11px;">${esc(r.job_id) || "—"}</td>
      <td style="${TD}font-size:11px;color:${MUTED};">${
        r.project_id ? esc(projectNames[r.project_id] ?? "Project") : "Company-wide"
      }</td>
      <td style="${TD_R}">${kes(r.gross_pay)}</td>
      <td style="${TD_R}">${kes(r.total_deductions)}</td>
      <td style="${TD_R}font-weight:700;">${kes(r.net_pay)}</td>
      <td style="${TD}font-size:11px;">${shortDate(r.due_date)}</td>
      <td style="${TD}font-size:11px;">${esc(r.payment_status) || "—"}</td>
    </tr>`).join("");

  const statutory: Array<[string, number]> = [
    ["NSSF", sum((r) => n0(r.nssf_total))],
    ["SHIF", sum((r) => n0(r.shif))],
    ["AHL", sum((r) => n0(r.housing_levy))],
    ["PAYE", sum((r) => n0(r.paye_net))],
  ];

  const bodyHtml = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border-collapse:collapse;border:1px solid ${LINE};">
    <tr>
      <th style="${TH}">Employee</th>
      <th style="${TH}">Job ID</th>
      <th style="${TH}">Scope</th>
      <th style="${TH_R}">Gross</th>
      <th style="${TH_R}">Deductions</th>
      <th style="${TH_R}">Net Pay</th>
      <th style="${TH}">Due</th>
      <th style="${TH}">Status</th>
    </tr>
    ${body}
    <tr>
      <td style="${TF}" colspan="3">TOTAL &nbsp;(${rows.length})</td>
      <td style="${TF_R}">${kes(sum((r) => n0(r.gross_pay)))}</td>
      <td style="${TF_R}">${kes(sum((r) => n0(r.total_deductions)))}</td>
      <td style="${TF_R}">${kes(sum((r) => n0(r.net_pay)))}</td>
      <td style="${TF}" colspan="2"></td>
    </tr>
  </table>

  <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;
              color:${MUTED};font-weight:700;margin:22px 0 8px;">
    Statutory Breakdown
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border-collapse:collapse;">
  <tr>
    ${statutory.map(([k, v]) => `
      <td width="25%" style="padding:11px 12px;background:#f8fafc;border:1px solid ${LINE};">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.8px;
                    color:${MUTED};font-weight:700;">${esc(k)}</div>
        <div style="font-size:13px;font-weight:700;font-family:'Courier New',monospace;
                    margin-top:3px;">${kes(v)}</div>
      </td>`).join("")}
  </tr>
  </table>`;

  return shell({
    docType: "Payroll Register",
    heading: "Payroll Register",
    subheading: `${scope} · ${rows.length} record${rows.length === 1 ? "" : "s"}`,
    message,
    bodyHtml,
    sender,
  });
}

// Single-employee payslip: earnings, itemised statutory deductions, reliefs,
// net pay. Used when mode === "payslip".
function buildPayslipHtml(opts: {
  row: PayrollRow;
  scope: string;
  message: string;
  sender: Sender;
}): string {
  const { row, scope, message, sender } = opts;

  const deductions: Array<[string, number]> = [
    ["NSSF Tier I", n0(row.nssf_tier1)],
    ["NSSF Tier II", n0(row.nssf_tier2)],
    ["SHIF", n0(row.shif)],
    ["Affordable Housing Levy", n0(row.housing_levy)],
    ["Pension", n0(row.pension)],
    ["PAYE (net of relief)", n0(row.paye_net)],
  ];

  const line = (k: string, v: string, bold = false) =>
    `<tr>` +
      `<td style="${TD}${bold ? "font-weight:700;" : ""}">${esc(k)}</td>` +
      `<td style="${TD_R}${bold ? "font-weight:700;" : ""}">${v}</td>` +
    `</tr>`;

  const sec = (t: string) =>
    `<tr><td colspan="2" style="padding:7px 10px;background:#f8fafc;font-size:9px;` +
    `text-transform:uppercase;letter-spacing:1px;font-weight:700;color:${MUTED};` +
    `border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};">${esc(t)}</td></tr>`;

  // Each detail pair is a full <tr> with its own label and value cells. The
  // previous version emitted bare <td>s from a helper and relied on the caller
  // to wrap them, which is what pushed labels onto their own lines.
  const detail = (pairs: Array<[string, string]>) =>
    pairs.map(([k, v]) =>
      `<tr>` +
        `<td width="30%" style="padding:8px 10px;border-bottom:1px solid #f1f5f9;` +
          `font-size:9px;text-transform:uppercase;letter-spacing:0.7px;` +
          `color:${MUTED};font-weight:700;">${esc(k)}</td>` +
        `<td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;` +
          `font-weight:600;">${v}</td>` +
      `</tr>`).join("");

  const bodyHtml = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border-collapse:collapse;border:1px solid ${LINE};margin-bottom:20px;">
    ${detail([
      ["Employee", esc(row.employee_name) || "—"],
      ["Job ID", esc(row.job_id) || "—"],
      ["Rate", `${kes(row.rate)} / ${esc(row.rate_type) || "—"}`],
      ["Time Worked", esc(row.time_worked) || "—"],
      ["Due Date", shortDate(row.due_date)],
      ["Paid Date", shortDate(row.paid_date)],
      ["Status", esc(row.payment_status) || "—"],
      ["Bank Code", esc(row.bank_code) || "—"],
      ["eTIMS", esc(row.etims_code) || "—"],
    ])}
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border-collapse:collapse;border:1px solid ${LINE};">
    ${sec("Earnings")}
    ${line("Gross Pay", kes(row.gross_pay), true)}
    ${sec("Statutory Deductions")}
    ${deductions.filter(([, v]) => v > 0).map(([k, v]) => line(k, kes(v))).join("")}
    ${sec("Tax Computation")}
    ${line("Taxable Income", kes(row.taxable_income))}
    ${line("Personal Relief", `(${kes(row.personal_relief)})`)}
    ${n0(row.insurance_relief) > 0
      ? line("Insurance Relief", `(${kes(row.insurance_relief)})`) : ""}
    ${line("Total Deductions", kes(row.total_deductions), true)}
    <tr>
      <td style="padding:13px 10px;border-top:2px solid ${INK};font-weight:700;
                 font-size:14px;">NET PAY</td>
      <td style="padding:13px 10px;border-top:2px solid ${INK};text-align:right;
                 font-family:'Courier New',monospace;font-weight:700;font-size:14px;">
        ${kes(row.net_pay)}
      </td>
    </tr>
  </table>

  ${row.notes ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="margin-top:18px;background:#f8fafc;border:1px solid ${LINE};">
  <tr><td style="padding:12px 14px;font-size:11px;line-height:1.6;color:#334155;">
    <strong style="font-size:9px;text-transform:uppercase;letter-spacing:0.8px;
                   color:${MUTED};">Notes</strong><br>${nl2br(row.notes)}
  </td></tr>
  </table>` : ""}

  <div style="margin-top:16px;font-size:10px;color:${MUTED};">
    Reference: <strong>${esc(row.serial_no) || `PR-${row.id}`}</strong>
  </div>`;

  return shell({
    docType: "Employee Payslip",
    heading: "Payslip",
    // shell() escapes this — pass raw.
    subheading: `${row.employee_name ?? "—"} · ${scope}`,
    message,
    bodyHtml,
    sender,
  });
}

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

    // Payroll is compensation data — finance and up only, matching the
    // payroll_write RLS policy.
    const { data: roles } = await admin
      .from("user_roles").select("role_name").eq("user_id", user.id);
    const allowed = ["finance", "manager", "admin"];
    if (!roles?.some((r: { role_name: string }) => allowed.includes(r.role_name))) {
      return json({ error: "Finance, manager or admin access required" }, 403);
    }

    const { to, cc, subject, message, scope, payroll_ids, mode } = await req.json();
    const isPayslip = mode === "payslip";

    if (!to || typeof to !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())) {
      return json({ error: "A valid recipient email is required" }, 400);
    }
    if (!Array.isArray(payroll_ids) || payroll_ids.length === 0) {
      return json({ error: "No payroll entries selected" }, 400);
    }

    // Authoritative figures — never trust amounts from the client.
    const { data: rows, error: rowErr } = await admin
      .from("payroll_checklist")
      .select(PAYROLL_COLUMNS)
      .in("id", payroll_ids)
      .order("employee_name");
    if (rowErr) return json({ error: `Could not read payroll: ${rowErr.message}` }, 500);
    if (!rows?.length) return json({ error: "No matching payroll entries" }, 404);

    const projectIds = [...new Set(
      (rows as PayrollRow[]).map((r) => r.project_id).filter((v): v is string => Boolean(v)),
    )];
    const projectNames: Record<string, string> = {};
    if (projectIds.length) {
      const { data: projs } = await admin
        .from("projects").select("id,project_number,title").in("id", projectIds);
      (projs ?? []).forEach((p: { id: string; project_number: string; title: string }) => {
        projectNames[p.id] = `${p.project_number} — ${p.title}`;
      });
    }

    // Sender identity for the sign-off. profiles.full_name is the display name
    // used elsewhere in the app; fall back through the JWT so the block is
    // never blank.
    const { data: profile } = await admin
      .from("profiles").select("full_name,email").eq("id", user.id).maybeSingle();

    const sender: Sender = {
      name: profile?.full_name?.trim() || user.email || BRAND_LONG,
      email: profile?.email ?? user.email ?? "",
    };

    // This project stores credentials as EMAIL_USERNAME / EMAIL_PASSWORD (the
    // names the other mail functions use). SMTP_USER / SMTP_PASS are accepted
    // as aliases so either convention works.
    const username = Deno.env.get("EMAIL_USERNAME") ?? Deno.env.get("SMTP_USER");
    const password = Deno.env.get("EMAIL_PASSWORD") ?? Deno.env.get("SMTP_PASS");

    // No host/port secret exists on this project, so default to Gmail. 465 is
    // implicit TLS, which denomailer handles more reliably than STARTTLS on
    // 587. Both are overridable with SMTP_HOST / SMTP_PORT secrets.
    //
    // EMAIL_PASSWORD must be a Google App Password (16 chars, no spaces).
    // Gmail has rejected ordinary account passwords for SMTP since May 2022,
    // and fails with "Username and Password not accepted" / 535.
    const host = Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com";
    const port = Number(Deno.env.get("SMTP_PORT") ?? 465);

    if (!username || !password) {
      // Report WHICH names are missing (never values) so a naming mismatch is
      // obvious from the response instead of needing dashboard access.
      return json({
        error: "Mail credentials are not configured on this project",
        accepted_secret_names: [
          "EMAIL_USERNAME or SMTP_USER",
          "EMAIL_PASSWORD or SMTP_PASS",
          "SMTP_HOST (optional, defaults to smtp.gmail.com)",
          "SMTP_PORT (optional, defaults to 465)",
        ],
        present: {
          EMAIL_USERNAME: Boolean(Deno.env.get("EMAIL_USERNAME")),
          EMAIL_PASSWORD: Boolean(Deno.env.get("EMAIL_PASSWORD")),
          SMTP_USER:      Boolean(Deno.env.get("SMTP_USER")),
          SMTP_PASS:      Boolean(Deno.env.get("SMTP_PASS")),
        },
      }, 500);
    }

    const client = new SMTPClient({
      connection: {
        hostname: host,
        port,
        // Implicit TLS on 465; STARTTLS is negotiated on 587.
        tls: port === 465,
        auth: { username, password },
      },
    });

    // Must be the authenticated mailbox — Gmail rewrites or rejects a From
    // that is not the logged-in account (or a verified alias).
    const fromAddress = Deno.env.get("SMTP_FROM") ?? username;
    const fromName    = Deno.env.get("SMTP_FROM_NAME") ?? BRAND_SHORT;
    const safeScope = typeof scope === "string" && scope.trim()
      ? scope
      : (isPayslip ? "Payslip" : "Payroll register");
    const safeMessage = typeof message === "string" ? message : "";

    const html = isPayslip
      ? buildPayslipHtml({
          row: (rows as PayrollRow[])[0],
          scope: safeScope,
          message: safeMessage,
          sender,
        })
      : buildHtml({
          rows: rows as PayrollRow[],
          scope: safeScope,
          message: safeMessage,
          sender,
          projectNames,
        });

    try {
      await client.send({
        from: `${fromName} <${fromAddress}>`,
        to: to.trim(),
        ...(typeof cc === "string" && cc.trim() ? { cc: cc.trim() } : {}),
        replyTo: user.email ?? fromAddress,
        subject: (typeof subject === "string" && subject.trim())
          ? subject.trim()
          : isPayslip
            ? `Payslip — ${(rows as PayrollRow[])[0].employee_name ?? "employee"}`
            : `Payroll Register — ${safeScope}`,
        html,
        // Plain-text fallback for clients that refuse HTML.
        content: (isPayslip
          ? `Payslip for ${(rows as PayrollRow[])[0].employee_name ?? "employee"} — ` +
            `net pay ${kes((rows as PayrollRow[])[0].net_pay)}.`
          : `Payroll register (${rows.length} records) — ${safeScope}.`) +
          `\n\n${safeMessage}\n\n` +
          `This email contains an HTML table; please view it in an HTML-capable client.`,
      });
    } finally {
      await client.close();
    }

    // Best-effort audit. A logging failure must not make a sent email look
    // like it failed, so this never throws.
    try {
      await admin.from("audit_logs").insert([{
        table_name: "payroll_checklist",
        record_id: null,
        action: "UPDATE",
        old_data: null,
        new_data: {
          action_type: isPayslip ? "PAYSLIP_EMAIL" : "PAYROLL_REGISTER_EMAIL",
          sent_to: to.trim(),
          cc: typeof cc === "string" && cc.trim() ? cc.trim() : null,
          scope: safeScope,
          record_count: rows.length,
          payroll_ids,
          sent_at: new Date().toISOString(),
        },
        changed_by: user.id,
        changed_at: new Date().toISOString(),
      }]);
    } catch { /* audit is best-effort */ }

    return json({ success: true, sent_to: to.trim(), count: rows.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
