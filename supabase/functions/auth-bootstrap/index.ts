// Supabase Edge Function: auth-bootstrap
// يُحدِّد الأدمن من الخادم فقط اعتماداً على ADMIN_EMAIL (لا يُقرأ من الواجهة أبداً)
// النشر: supabase functions deploy auth-bootstrap --set ADMIN_EMAIL=you@gmail.com
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (error || !data?.user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: corsHeaders });
    }

    const adminEmail = (Deno.env.get('ADMIN_EMAIL') ?? '').toLowerCase();
    const userEmail = (data.user.email ?? '').toLowerCase();

    if (adminEmail && userEmail && adminEmail === userEmail) {
      const { error: roleErr } = await admin.from('user_roles').upsert(
        { user_id: data.user.id, role: 'admin', email: data.user.email, full_name: (data.user.user_metadata?.full_name as string) ?? null },
        { onConflict: 'user_id,role' },
      );
      if (roleErr) console.error('role upsert', roleErr.message);

      // اربط طلبات الزائر السابقة برقم هاتف الملف الشخصي إن وُجد
      const phone = (data.user.user_metadata?.phone as string) ?? null;
      if (phone) await admin.rpc('link_guest_bookings', { p_phone: phone });
    }

    return new Response(JSON.stringify({ ok: true, is_admin: adminEmail === userEmail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'UNKNOWN' }), { status: 500, headers: corsHeaders });
  }
});
