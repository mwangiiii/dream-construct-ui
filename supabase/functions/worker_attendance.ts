import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  console.log("=== Request received ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Headers:", Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request");
    return new Response("ok", { 
      status: 200,
      headers: corsHeaders 
    });
  }

  if (req.method !== "POST") {
    console.log("Method not allowed:", req.method);
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), { 
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }

  const authHeader = req.headers.get("authorization");
  console.log("Authorization header present:", !!authHeader);
  
  if (!authHeader) {
    console.log("No authorization header");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }

  try {
    console.log("=== Parsing request body ===");
    const body = await req.json();
    console.log("Request body:", JSON.stringify(body));

    const { date, records } = body;
    console.log("Extracted fields:", { date, recordsCount: records?.length });

    if (!date || !Array.isArray(records) || records.length === 0) {
      console.log("Validation failed: missing date or records");
      return new Response(JSON.stringify({ error: "Date and records array required" }), {
        status: 400,
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        },
      });
    }

    console.log("=== Initializing Supabase client ===");
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    console.log("Supabase client created");

    console.log("=== Preparing attendance records ===");
    const toUpsert = records.map((r: any) => ({
      worker_id: r.worker_id,
      attendance_date: date,
      check_in: r.check_in || null,
      check_out: r.check_out || null,
      status: r.status || "present",
      notes: r.notes || null,
    }));
    console.log("Records to upsert:", JSON.stringify(toUpsert));

    console.log("=== Upserting attendance records ===");
    const { data, error } = await supabase
      .from("worker_attendance")
      .upsert(toUpsert, { onConflict: "worker_id,attendance_date" })
      .select();

    if (error) {
      console.log("Supabase error:", JSON.stringify(error));
      throw error;
    }

    console.log("Attendance records upserted successfully. Count:", data?.length || 0);

    return new Response(JSON.stringify({ records: data }), {
      status: 200,
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json" 
      },
    });
  } catch (err: any) {
    console.error("=== Error occurred ===");
    console.error("Error name:", err.name);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    console.error("Full error:", JSON.stringify(err, Object.getOwnPropertyNames(err)));

    return new Response(JSON.stringify({ 
      error: err.message || "An error occurred",
      details: err.details || null,
      hint: err.hint || null,
      code: err.code || null
    }), {
      status: 400,
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json" 
      },
    });
  }
});
