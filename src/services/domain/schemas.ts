import { z } from 'zod';
import { parseAlgerianPhone } from '@/lib/phone';
import { isValidIsoDate, isValidTime } from '@/lib/time';
import { SALON_CONFIG } from '@/config/salon';

export const phoneZod = z
  .string()
  .trim()
  .min(1, 'INVALID_PHONE')
  .refine((v) => parseAlgerianPhone(v).valid, 'INVALID_PHONE');

export const nameZod = z.string().trim().min(2, 'TOO_SHORT').max(60);

export const bookingSchema = z.object({
  service_id: z.string().uuid('REQUIRED'),
  date: z.string().refine(isValidIsoDate, 'INVALID_DATE'),
  time: z.string().refine(isValidTime, 'INVALID_TIME'),
  customer_name: nameZod,
  customer_lastname: nameZod,
  phone: phoneZod,
  note: z.string().trim().max(500).optional().nullable(),
  /** حقل الفخ (Honeypot) — يجب أن يكون فارغاً */
  website: z.string().max(0).optional().default(''),
  user_id: z.string().uuid().optional().nullable(),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export const trackSchema = z.object({
  token: z.string().trim().min(16).max(200),
});

export const serviceZod = z.object({
  name: z.string().trim().min(2).max(80),
  name_en: z.string().trim().max(80).optional().nullable(),
  price: z.number().int().min(0).max(1_000_000),
  duration_minutes: z.number().int().min(5).max(480),
  active: z.boolean(),
  sort_order: z.number().int().min(0).max(999),
});

export const workingHourZod = z.object({
  weekday: z.number().int().min(1).max(7),
  is_open: z.boolean(),
  open_time: z.string().refine(isValidTime),
  close_time: z.string().refine(isValidTime),
  breaks: z.array(z.object({ start: z.string().refine(isValidTime), end: z.string().refine(isValidTime) })),
});

export const settingsZod = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30),
  address: z.string().trim().max(200),
  map_link: z.string().trim().max(500).optional().or(z.literal('')),
  logo_url: z.string().trim().max(500).optional().nullable(),
  booking_closed: z.boolean(),
  default_duration_minutes: z.number().int().min(5).max(480),
  gap_minutes: z.number().int().min(0).max(120),
  max_advance_days: z.number().int().min(1).max(365),
  theme: z.enum(['dark', 'light']),
});

export const templateZod = z.object({
  key: z.string().min(1),
  channel: z.enum(['whatsapp', 'in_app', 'sms', 'email']),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  active: z.boolean(),
});

export const customerZod = z.object({
  notes: z.string().trim().max(1000).optional().nullable(),
  vip: z.boolean(),
  blocked: z.boolean(),
});

export const timeOffZod = z.object({
  starts_at: z.string().refine(isValidIsoDate),
  ends_at: z.string().refine(isValidIsoDate),
  reason: z.string().trim().max(200).optional().nullable(),
  all_day: z.boolean().default(true),
});

export function maxAllowedDate(today = new Date()): string {
  const t = new Date(today.getTime());
  const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + SALON_CONFIG.maxAdvanceDays);
  return d.toISOString().slice(0, 10);
}
