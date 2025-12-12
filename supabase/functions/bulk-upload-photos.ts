// supabase/functions/bulk-upload-photos.ts
// Supabase Edge Function for bulk photo upload and audit logging
import { serve } from 'std/server';

serve(async (req) => {
  try {
    const { project_id, milestone_id, photos } = await req.json();
    if (!project_id || !Array.isArray(photos) || photos.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Missing project_id or photos' }), { status: 400 });
    }

    // Insert audit log for each photo
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    const auditRows = photos.map(photo => ({
      project_id,
      action: 'photo_upload',
      details: JSON.stringify({ file_path: photo.file_path, name: photo.name, size: photo.file_size || null, milestone_id }),
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('audit_logs').insert(auditRows);
    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Unknown error' }), { status: 500 });
  }
});
