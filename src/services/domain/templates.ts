import type { Appointment, SalonSettings } from '@/types/models';
import { SALON_CONFIG } from '@/config/salon';
import { formatDateAr, formatTimeAr, isoDate, isoTime } from '@/lib/time';

export type TemplateKey =
  | 'pending'
  | 'accepted_awaiting_schedule'
  | 'scheduled'
  | 'rescheduled'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'reminder';

export interface TemplateVars {
  name?: string;
  date?: string;
  time?: string;
  service?: string;
  salon?: string;
  address?: string;
  link?: string;
  status?: string;
  phone?: string;
  reason?: string;
}

/** القوالب الافتراضية — قابلة للتعديل من لوحة الحلاق (جدول notification_templates) */
export const DEFAULT_TEMPLATES: Record<TemplateKey, { title: string; body: string }> = {
  pending: {
    title: 'استلمنا طلبك',
    body: 'مرحباً {name}،\nاستلمنا طلبك لخدمة «{service}» يوم {date} على الساعة {time}.\nسنوافق عليه قريباً وسنبلغك عبر واتساب.\n{salon} — {address}',
  },
  accepted_awaiting_schedule: {
    title: 'تم قبول طلبك',
    body: 'مرحباً {name}،\nتم قبول طلبك لخدمة «{service}» يوم {date}.\nسنحدد لك الوقت المناسب قريباً.\n{salon} — {address}\nتتبّع طلبك: {link}',
  },
  scheduled: {
    title: 'تم تأكيد موعدك',
    body: 'مرحباً {name}،\nتم تأكيد موعدك: {service}\nاليوم: {date}\nالوقت: {time}\n{salon} — {address}\nتتبّع طلبك: {link}\nنتمنى لك تجربة رائعة!',
  },
  rescheduled: {
    title: 'تم تعديل موعدك',
    body: 'مرحباً {name}،\nتم تعديل موعدك لخدمة «{service}».\nالموعد الجديد: {date} على الساعة {time}\n{salon} — {address}\nتتبّع طلبك: {link}',
  },
  rejected: {
    title: 'لم نتمكن من تأكيد موعدك',
    body: 'مرحباً {name}،\nعذراً، لم نتمكن من تأكيد موعدك يوم {date}.\nالسبب: {reason}\nيمكنك اختيار وقت آخر متاح.\nتتبّع طلبك: {link}',
  },
  cancelled: {
    title: 'تم إلغاء الموعد',
    body: 'مرحباً {name}،\nتم إلغاء موعدك يوم {date} على الساعة {time}.\nيمكنك الحجز في وقت آخر متى شئت.\n{salon} — {address}',
  },
  completed: {
    title: 'شكراً لزيارتك',
    body: 'مرحباً {name}،\nنتمنى أن تكون إطلالتك جديدة! إذا أعجبك الخدمة شاركناأصدقاءك.\n{salon} — {address}',
  },
  no_show: {
    title: 'لم نرك اليوم',
    body: 'مرحباً {name}،\nلقد تفاجأنا بغيابك عن موعدك يوم {date}.\nتواصل معنا إن كان لديك عذر أو احجز موعداً جديداً.',
  },
  reminder: {
    title: 'تذكير بموعدك',
    body: 'مرحباً {name}،\nتذكير ودّي: موعدك لخدمة «{service}» اليوم {date} على الساعة {time}.\nنتنتظرك في {salon} — {address}',
  },
};

export function buildTrackingLink(token: string, origin = window.location.origin): string {
  return `${origin}/track?t=${token}`;
}

export function fillTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{(\w+)\}/g, (m, key: string) => {
    const v = vars[key as keyof TemplateVars];
    return v === undefined || v === null || v === '' ? m : String(v);
  });
}

export function appointmentVars(appt: Appointment, settings?: Partial<SalonSettings>, link?: string): TemplateVars {
  return {
    name: `${appt.customer_name} ${appt.customer_lastname}`.trim(),
    date: formatDateAr(appt.scheduled_at, { weekday: true }),
    time: formatTimeAr(appt.scheduled_at),
    service: appt.service?.name ?? '',
    salon: settings?.name ?? SALON_CONFIG.name,
    address: settings?.address ?? SALON_CONFIG.address,
    link: link ?? (appt.tracking_token ? buildTrackingLink(appt.tracking_token) : ''),
    status: appt.status,
    phone: appt.phone,
    reason: appt.reject_reason ?? '',
  };
}

export function renderMessage(
  templateBody: string,
  appt: Appointment,
  settings?: Partial<SalonSettings>,
  link?: string,
): string {
  return fillTemplate(templateBody, appointmentVars(appt, settings, link));
}

/** خلاصة نصية للإشعار داخل التطبيق */
export function inAppSummary(appt: Appointment): { title: string; body: string } {
  return {
    title: `${appt.customer_name} — ${isoDate(appt.scheduled_at)}`,
    body: `${appt.service?.name ?? ''} • ${isoTime(appt.scheduled_at)}`,
  };
}
