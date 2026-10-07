// Supabase Edge Function: book
// حماية الزوار: Honeypot + Rate limiting + تحقق Zod + (Turnstile جاهز)
// النشر: supabase functions deploy book
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const bookingSchema = z.object({
  service_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  customer_name: z.string().trim().min(2).max(60),
  customer_lastname: z.string().trim().min(2).max(60),
  phone: z.string().trim().min(6).max(25),
  note: z.string().max(500).nullable().optional(),
  website: z.string().max(10).optional(), // Honeypot
  user_id: z.string().uuid().nullable().optional(),
});

const PHONE_RE = /^(?:\+|00)?213[567]\d{8}$|^0[567]\d{8}$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const payload = await req.json();

    // 1) Honeypot — الروبوتات تملأ الحقل المخفي
    if (payload.website && String(payload.website).length > 0) {
      return json({ error: 'VALIDATION' }, 400);
    }

    // 2) تحقق المدخلات
    const parsed = bookingSchema.safeParse(payload);
    if (!parsed.success) return json({ error: 'VALIDATION' }, 400);
    const input = parsed.data;
    if (!PHONE_RE.test(input.phone.replace(/[\s\-().]/g, ''))) {
      return json({ error: 'INVALID_PHONE' }, 400);
    }

    // 3) Turnstile (جاهز — يُفعَّل عند ضبط TURNSTILE_SECRET_KEY)
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (turnstileSecret && payload.turnstile_token) {
      const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${turnstileSecret}&response=${payload.turnstile_token}`,
      });
      const result = await verify.json();
      if (!result.success) return json({ error: 'VALIDATION' }, 400);
    }

    // 4) Rate limiting (بالهاتف وعنوان IP)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: allowed, error: rlErr } = await admin.rpc('check_rate_limit', {
      p_key: `book:${input.phone}:${ip}`,
      p_max: 5,
      p_window_seconds: 3600,
    });
    if (rlErr) console.error('rate-limit error', rlErr.message);
    if (allowed === false) return json({ error: 'RATE_LIMITED' }, 429);

    // 5) إنشاء الحجز عبر الدالة الآمنة (منع التعارض مضمون في قاعدة البيانات)
    const { data, error } = await admin.rpc('create_appointment', {
      p_service_id: input.service_id,
      p_date: input.date,
      p_time: input.time,
      p_name: input.customer_name,
      p_lastname: input.customer_lastname,
      p_phone: input.phone,
      p_note: input.note ?? null,
      p_user_id: input.user_id ?? null,
    });

    if (error) {
      const msg = error.message.toUpperCase();
      if (msg.includes('SLOT_TAKEN')) return json({ error: 'SLOT_TAKEN' }, 409);
      if (msg.includes('BOOKING_CLOSED')) return json({ error: 'BOOKING_CLOSED' }, 403);
      if (msg.includes('OUT_OF_HOURS') || msg.includes('DAY_CLOSED')) return json({ error: 'OUT_OF_HOURS' }, 400);
      if (msg.includes('PAST_TIME')) return json({ error: 'PAST_TIME' }, 400);
      if (msg.includes('TOO_FAR')) return json({ error: 'TOO_FAR' }, 400);
      if (msg.includes('BLOCKED')) return json({ error: 'BLOCKED' }, 403);
      if (msg.includes('INVALID_PHONE')) return json({ error: 'INVALID_PHONE' }, 400);
      console.error('create_appointment error', error.message);
      return json({ error: 'UNKNOWN' }, 500);
    }

    return json({ data });
  } catch (e) {
    console.error(e);
    return json({ error: 'UNKNOWN' }, 500);
  }
});
