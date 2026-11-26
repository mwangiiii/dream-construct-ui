import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMAIL_USER = Deno.env.get("EMAIL_USERNAME");
const EMAIL_PASS = Deno.env.get("EMAIL_PASSWORD");

if (!EMAIL_USER || !EMAIL_PASS) {
  console.error("⚠️ EMAIL_USERNAME or EMAIL_PASSWORD is missing in env vars!");
}

// Brand names are the only places the company name is spelled out. If this
// ever changes (rename, rebrand), it changes here and nowhere else. The email
// address itself is read from EMAIL_USERNAME at send time, so swapping the
// Gmail account does not require touching templates.
//
//   BRAND_SHORT — compact, impactful; used in the From line.
//   BRAND_LONG  — longer prose form; used inside the email body (logo bar,
//                 footer, copyright line).
const BRAND_SHORT = "REVE CONSTRUCT";
const BRAND_LONG  = "Reve Construct Ltd";

const sendEmail = async (to: string, subject: string, html: string) => {
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: EMAIL_USER!,
        password: EMAIL_PASS!,
      },
    },
  });

  await client.send({
    from: `${BRAND_SHORT} <${EMAIL_USER}>`,
    to: to,
    subject: subject,
    // `content` is the text/plain alternative, not a second copy of the body.
    // Passing the raw HTML meant any client preferring text/plain rendered
    // visible markup. "auto" makes denomailer derive a readable text version.
    content: "auto",
    html: html,
  });

  await client.close();
};

interface EmailRequest {
  financial_id: number;
  project_id: string;
  milestone_id: string;
  email_type: 'order_request' | 'order_approval' | 'funds_request' | 'funds_sent' | 'funds_received' | 'goods_paid';
  email_data: {
    to: string;
    subject: string;
    body: string;
  };
}

const formatEmailType = (emailType: string): string => {
  return emailType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Check authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      throw new Error("Unauthorized - invalid or expired token");
    }

    console.log("✅ User authenticated:", user.id);

    // 2. Parse request body
    const requestData: EmailRequest = await req.json();
    const { financial_id, project_id, milestone_id, email_type, email_data } = requestData;

    console.log("📧 Email request:", {
      financial_id,
      project_id,
      milestone_id,
      email_type,
      recipient: email_data?.to
    });

    // 3. Validate required fields
    if (!financial_id || !project_id || !milestone_id || !email_type || !email_data) {
      throw new Error(`Missing required fields. Received: ${JSON.stringify({
        financial_id: !!financial_id,
        project_id: !!project_id,
        milestone_id: !!milestone_id,
        email_type: !!email_type,
        email_data: !!email_data
      })}`);
    }

    // 4. Fetch financial record with related data
    console.log(`🔍 Fetching financial record ID: ${financial_id}`);
    
    const { data: financial, error: financialError } = await supabase
      .from("project_financials")
      .select(`
        *,
        tender_company:tender_companies(id, name, contact_email, contact_phone, address),
        milestone:project_milestones(id, title, description),
        project:projects(id, title, description)
      `)
      .eq("id", financial_id)
      .single();

    if (financialError) {
      console.error("❌ Database error fetching financial record:", financialError);
      throw new Error(`Database error: ${financialError.message} (Code: ${financialError.code})`);
    }

    if (!financial) {
      console.error(`❌ No financial record found with ID: ${financial_id}`);
      
      // Try to get more info about what records exist
      const { data: allRecords, error: listError } = await supabase
        .from("project_financials")
        .select("id, material_name, project_id")
        .eq("project_id", project_id)
        .limit(10);
      
      if (!listError && allRecords) {
        console.log(`📋 Available records for project ${project_id}:`, allRecords.map(r => `ID: ${r.id}, Material: ${r.material_name}`));
      }
      
      throw new Error(`Financial record not found with ID: ${financial_id}. Check if the record exists in project_financials table.`);
    }

    console.log("✅ Financial record found:", {
      id: financial.id,
      material: financial.material_name,
      company: financial.tender_company?.name
    });

    // 5. Fetch user profile for sender info
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    // Historically used to populate the From display name; the From line now
    // always reads BRAND_SHORT per company policy. Kept available for the body
    // if a per-user sign-off is added later.
    const senderName = userProfile?.full_name || BRAND_LONG;
    void senderName;

    // 6. Create HTML email with company branding
    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${email_data.subject}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        body {
            margin: 0;
            padding: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            background: #f5f5f5;
        }
        .email-container {
            max-width: 650px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
            color: #ffffff;
            padding: 40px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            color: #ffffff;
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }
        .logo {
            font-size: 28px;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: -0.8px;
            margin-bottom: 12px;
        }
        .badge {
            display: inline-block;
            padding: 6px 16px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 12px;
            background: rgba(255,255,255,0.2);
        }
        .content {
            padding: 40px;
            white-space: pre-wrap;
            font-size: 15px;
            line-height: 1.8;
        }
        .info-box {
            background: #f9fafb;
            border-left: 4px solid #000000;
            padding: 20px;
            margin: 24px 0;
            border-radius: 6px;
        }
        .info-box strong {
            color: #000000;
        }
        .footer {
            padding: 32px 40px;
            background: #f9fafb;
            color: #6b7280;
            font-size: 13px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }
        .footer p {
            margin: 8px 0;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">${BRAND_LONG}</div>
            <h1>${email_data.subject}</h1>
            <span class="badge">${formatEmailType(email_type)}</span>
        </div>
        <div class="content">
${email_data.body}
        </div>
        <div class="info-box">
            <strong>Project:</strong> ${financial.project?.title || 'N/A'}<br>
            <strong>Milestone:</strong> ${financial.milestone?.title || 'N/A'}<br>
            <strong>Reference ID:</strong> #${financial.id}
        </div>
        <div class="footer">
            <p><strong>${BRAND_LONG}</strong></p>
            <p>This is an automated email from the Project Management System.</p>
            <p>&copy; ${new Date().getFullYear()} ${BRAND_LONG}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;

    // 7. Send email via SMTP
    console.log(`📤 Sending email to: ${email_data.to}`);
    
    await sendEmail(
      email_data.to,
      email_data.subject,
      htmlBody,
    );

    console.log(`✅ Email sent successfully to: ${email_data.to} (type: ${email_type})`);

    // 8. Log the email send event
    const { error: logError } = await supabase
      .from("email_logs")
      .insert([{
        financial_id: financial_id,
        project_id: project_id,
        email_type: email_type,
        recipient: email_data.to,
        subject: email_data.subject,
        status: 'sent',
        sent_by: user.id,
      }]);

    if (logError) {
      console.error("⚠️ Failed to log email:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        details: {
          recipient: email_data.to,
          subject: email_data.subject,
          financial_id: financial_id,
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("❌ Error in send-financial-email function:", error);
    console.error("Error stack:", error.stack);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        hint: "Check the function logs for more details: supabase functions logs send-financial-email"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});