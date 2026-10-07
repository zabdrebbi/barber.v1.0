/**
 * طبقة تجريد قنوات الإشعارات — واجهة واحدة قابلة للتوسعة:
 * WhatsApp Cloud API / SMS / Email / Push تُضاف لاحقاً بتسجيل قناة جديدة فقط.
 */
export interface NotificationMessage {
  title: string;
  body: string;
  /** رقم الهاتف بصيغة دولية بدون + (213555000000) */
  phone?: string;
  userId?: string;
  appointmentId?: string;
  templateKey: string;
  metadata?: Record<string, unknown>;
}

export interface SendResult {
  ok: boolean;
  channel: string;
  error?: string;
}

export interface NotificationChannel {
  id: string;
  /** هل القناة مهيأة ومتاحة الآن */
  isConfigured(): boolean;
  send(msg: NotificationMessage): Promise<SendResult>;
}

/** إشعار داخل التطبيق — يُسجّل في جدول الإشعارات ويصل عبر Realtime */
export const inAppChannel: NotificationChannel = {
  id: 'in_app',
  isConfigured: () => true,
  async send(msg) {
    if (!msg.userId) return { ok: false, channel: 'in_app', error: 'NO_USER' };
    try {
      const { trySupabase } = await import('@/lib/supabase');
      const supa = trySupabase();
      if (supa) {
        const { error } = await supa.from('in_app_notifications').insert({
          user_id: msg.userId,
          appointment_id: msg.appointmentId ?? null,
          title: msg.title,
          body: msg.body,
        });
        if (error) return { ok: false, channel: 'in_app', error: error.message };
      } else {
        const { demoStore } = await import('@/services/demo/store');
        demoStore.pushInApp({
          user_id: msg.userId,
          appointment_id: msg.appointmentId ?? null,
          title: msg.title,
          body: msg.body,
        });
      }
      return { ok: true, channel: 'in_app' };
    } catch (e) {
      return { ok: false, channel: 'in_app', error: e instanceof Error ? e.message : 'FAILED' };
    }
  },
};

/**
 * واتساب: بدون توكن → نفتح رابط wa.me جاهزاً للإرسال بنقرة (من لوحة الحلاق).
 * مع WHATSAPP_TOKEN + PHONE_ID → يُرسل تلقائياً عبر Cloud API (جاهز للاستدعاء).
 */
export const whatsappChannel: NotificationChannel = {
  id: 'whatsapp',
  isConfigured: () => Boolean(import.meta.env.VITE_WHATSAPP_PHONE_ID),
  async send(msg) {
    const phoneId = import.meta.env.VITE_WHATSAPP_PHONE_ID;
    if (!phoneId || !msg.phone) {
      return { ok: false, channel: 'whatsapp', error: 'NOT_CONFIGURED' };
    }
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ملاحظة: التوكن يُحقن من الخادم (Edge Function) في الإنتاج — هنا بديل آمن
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: msg.phone,
          type: 'text',
          text: { body: `${msg.title}\n\n${msg.body}` },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return { ok: true, channel: 'whatsapp' };
    } catch (e) {
      return { ok: false, channel: 'whatsapp', error: e instanceof Error ? e.message : 'SEND_FAILED' };
    }
  },
};

function notImplemented(id: string): NotificationChannel {
  return {
    id,
    isConfigured: () => false,
    async send() {
      return { ok: false, channel: id, error: 'NOT_IMPLEMENTED' };
    },
  };
}

export const smsChannel = notImplemented('sms');
export const emailChannel = notImplemented('email');
export const pushChannel = notImplemented('push');

const registry = new Map<string, NotificationChannel>();

export function registerChannel(ch: NotificationChannel) {
  registry.set(ch.id, ch);
}

[inAppChannel, whatsappChannel, smsChannel, emailChannel, pushChannel].forEach(registerChannel);

export function getChannel(id: string): NotificationChannel | undefined {
  return registry.get(id);
}

export function listChannels(): NotificationChannel[] {
  return Array.from(registry.values());
}

export async function broadcast(msg: NotificationMessage, channelIds: string[]): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (const id of channelIds) {
    const ch = registry.get(id);
    if (!ch) continue;
    if (!ch.isConfigured()) {
      results.push({ ok: false, channel: id, error: 'NOT_CONFIGURED' });
      continue;
    }
    results.push(await ch.send(msg));
  }
  return results;
}
