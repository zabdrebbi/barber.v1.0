/**
 * خدمة الإشعارات — تربط القوالب بالقنوات (واجهة واحدة قابلة للتبديل).
 * - مسجّل: إشعار داخل التطبيق لحظي + (واتساب إن كان مهيأً)
 * - زائر: رسالة واتساب عربية معبّأة (تُرسل من لوحة الحلاق بنقرة أو تلقائياً عند تفعيل Cloud API)
 */
import type { Appointment } from '@/types/models';
import { SALON_CONFIG } from '@/config/salon';
import { phoneToWaMe } from '@/lib/phone';
import {
  DEFAULT_TEMPLATES,
  appointmentVars,
  buildTrackingLink,
  fillTemplate,
  type TemplateKey,
} from '@/services/domain/templates';
import { broadcast, inAppChannel, whatsappChannel } from '@/services/abstractions/notification-channels';
import { trySupabase } from '@/lib/supabase';
import { demoStore } from '@/services/demo/store';

let settingsCache: { name: string; address: string; phone: string } | null = null;

async function getSettings() {
  if (settingsCache) return settingsCache;
  try {
    const { fetchSettings } = await import('@/services/api/catalog');
    const s = (await fetchSettings()).data;
    if (s) settingsCache = { name: s.name, address: s.address, phone: s.phone };
  } catch {
    /* fallback */
  }
  return settingsCache ?? { name: SALON_CONFIG.name, address: SALON_CONFIG.address, phone: SALON_CONFIG.phone };
}

async function getTemplate(key: TemplateKey, channel: 'whatsapp' | 'in_app'): Promise<{ title: string; body: string }> {
  try {
    const { fetchTemplates } = await import('@/services/api/notifications');
    const res = await fetchTemplates();
    const tpl = res.data?.find((t) => t.key === key && t.channel === channel && t.active);
    if (tpl) return { title: tpl.title, body: tpl.body };
  } catch {
    /* fallback */
  }
  return DEFAULT_TEMPLATES[key] ?? { title: key, body: '' };
}

export function buildWhatsAppUrl(phone: string, text: string): string {
  return `https://wa.me/${phoneToWaMe(phone)}?text=${encodeURIComponent(text)}`;
}

async function log(
  appointment: Appointment | null,
  channel: string,
  templateKey: string,
  status: 'queued' | 'sent' | 'failed',
  payload: Record<string, unknown>,
  error?: string,
) {
  const supa = trySupabase();
  if (supa) {
    await supa.from('notification_logs').insert({
      appointment_id: appointment?.id ?? null,
      channel,
      template_key: templateKey,
      to_phone: appointment?.phone ?? null,
      to_user_id: appointment?.user_id ?? null,
      payload,
      status,
      error: error ?? null,
    });
  } else {
    demoStore.addLog({
      appointment_id: appointment?.id ?? null,
      channel,
      template_key: templateKey,
      to_phone: appointment?.phone ?? null,
      to_user_id: appointment?.user_id ?? null,
      payload,
      status,
      error: error ?? null,
    });
  }
}

/** إشعار داخل التطبيق للمسجّل */
async function pushInAppFor(appointment: Appointment, key: TemplateKey) {
  if (!appointment.user_id) return;
  const settings = await getSettings();
  const tpl = await getTemplate(key, 'in_app');
  const vars = appointmentVars(appointment, settings, buildTrackingLink(appointment.tracking_token));
  const msg = { title: fillTemplate(tpl.title, vars), body: fillTemplate(tpl.body, vars) };
  const supa = trySupabase();
  if (supa) {
    await supa.from('in_app_notifications').insert({
      user_id: appointment.user_id,
      appointment_id: appointment.id,
      title: msg.title,
      body: msg.body,
    });
  } else {
    demoStore.pushInApp({
      user_id: appointment.user_id,
      appointment_id: appointment.id,
      title: msg.title,
      body: msg.body,
    });
  }
}

/**
 * عند إنشاء طلب جديد:
 * - للمسجّل: إشعار داخلي فوري
 * - للزائر: نجهّز رسالة واتساب (تظهر للحلاق كزر جاهز، أو تُرسل تلقائياً إن كان Cloud API مفعّلاً)
 */
export async function notifyAppointmentCreated(appointment: Appointment) {
  try {
    const key: TemplateKey = 'pending';
    if (appointment.user_id) await pushInAppFor(appointment, key);
    const settings = await getSettings();
    const tpl = await getTemplate(key, 'whatsapp');
    const vars = appointmentVars(appointment, settings, buildTrackingLink(appointment.tracking_token));
    const text = fillTemplate(tpl.body, vars);
    const results = await broadcast(
      {
        title: fillTemplate(tpl.title, vars),
        body: text,
        phone: appointment.phone,
        appointmentId: appointment.id,
        templateKey: key,
      },
      ['whatsapp'],
    );
    const wa = results.find((r) => r.channel === 'whatsapp');
    await log(appointment, 'whatsapp', key, wa?.ok ? 'sent' : 'queued', { text }, wa?.error);
  } catch {
    /* لا نعطل الحجز بسبب فشل إشعار */
  }
}

const KEY_BY_STATUS: Partial<Record<Appointment['status'], TemplateKey>> = {
  pending: 'pending',
  accepted_awaiting_schedule: 'accepted_awaiting_schedule',
  scheduled: 'scheduled',
  rejected: 'rejected',
  cancelled: 'cancelled',
  completed: 'completed',
  no_show: 'no_show',
};

export async function notifyAppointmentChanged(appointment: Appointment) {
  try {
    const isRescheduled =
      appointment.status === 'scheduled' && Boolean(appointment.original_scheduled_at);
    const key: TemplateKey =
      isRescheduled && appointment.original_scheduled_at !== appointment.scheduled_at
        ? 'rescheduled'
        : (KEY_BY_STATUS[appointment.status] ?? 'scheduled');

    if (appointment.user_id) await pushInAppFor(appointment, key);

    const settings = await getSettings();
    const tpl = await getTemplate(key, 'whatsapp');
    const vars = appointmentVars(appointment, settings, buildTrackingLink(appointment.tracking_token));
    const text = fillTemplate(tpl.body, vars);
    const results = await broadcast(
      {
        title: fillTemplate(tpl.title, vars),
        body: text,
        phone: appointment.phone,
        appointmentId: appointment.id,
        templateKey: key,
      },
      ['whatsapp'],
    );
    const wa = results.find((r) => r.channel === 'whatsapp');
    await log(appointment, 'whatsapp', key, wa?.ok ? 'sent' : 'queued', { text }, wa?.error);
  } catch {
    /* تجاهل */
  }
}

/** تذكير — يُستدعى من مهمة مجدولة (Edge Function Cron في الإنتاج) */
export async function notifyReminder(appointment: Appointment) {
  try {
    const settings = await getSettings();
    const tpl = await getTemplate('reminder', 'whatsapp');
    const vars = appointmentVars(appointment, settings, buildTrackingLink(appointment.tracking_token));
    const text = fillTemplate(tpl.body, vars);
    if (appointment.user_id) await pushInAppFor(appointment, 'reminder');
    const results = await broadcast(
      {
        title: fillTemplate(tpl.title, vars),
        body: text,
        phone: appointment.phone,
        appointmentId: appointment.id,
        templateKey: 'reminder',
      },
      ['whatsapp'],
    );
    const wa = results.find((r) => r.channel === 'whatsapp');
    await log(appointment, 'whatsapp', 'reminder', wa?.ok ? 'sent' : 'queued', { text }, wa?.error);
  } catch {
    /* تجاهل */
  }
}

export { inAppChannel, whatsappChannel };
