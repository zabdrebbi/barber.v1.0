/**
 * إعدادات الصالون المركزية — عدّل هنا بدل التفرع في الكود.
 * القيم الافتراضية مذكورة في المواصفات وقابلة للتعديل.
 */
import type { AppointmentStatus, Service } from '@/types/models';

export const SALON_CONFIG = {
  name: 'صالون الأناقة',
  phone: '+213 555 00 00 00',
  phoneRaw: '0555000000',
  address: 'الشارع الرئيسي',
  mapLink: '',
  timezone: 'Africa/Algiers',
  locale: 'ar',
  currency: { code: 'DZD', symbol: 'د.ج', decimals: 0 },
  defaultDurationMinutes: 30,
  defaultGapMinutes: 0,
  maxAdvanceDays: 30,
  /** أيام عمل الأسبوع: 1=الاثنين … 7=الأحد (ISO). الجمعة = 5 عطلة */
  closedWeekdays: [5] as number[],
  workingHours: {
    /** 1..7 ISO weekday -> { open, close } بتوقيت الجزائر أو null إذا مغلق */
    1: { open: '09:00', close: '20:00' },
    2: { open: '09:00', close: '20:00' },
    3: { open: '09:00', close: '20:00' },
    4: { open: '09:00', close: '20:00' },
    5: null,
    6: { open: '09:00', close: '20:00' },
    7: { open: '09:00', close: '20:00' },
  } as Record<number, { open: string; close: string } | null>,
  breaks: [{ start: '13:00', end: '14:00' }],
  /** إغلاق الحجز مؤقتاً (تُدار أيضاً من لوحة الحلاق) */
  bookingClosed: false,
  /** نافذة القبول الفوري للطلبات الجديدة (دقيقة) — للتنبيه الصوتي */
  requestAlertWindowMinutes: 5,
} as const;

export const DEFAULT_SERVICES: Omit<Service, 'id' | 'created_at' | 'updated_at'>[] = [
  { name: 'قص شعر', name_en: 'Haircut', price: 800, duration_minutes: 30, active: true, sort_order: 1 },
  { name: 'حلاقة لحية', name_en: 'Beard trim', price: 500, duration_minutes: 20, active: true, sort_order: 2 },
  { name: 'قص + لحية', name_en: 'Cut & beard', price: 1200, duration_minutes: 45, active: true, sort_order: 3 },
  { name: 'حلاقة رأس', name_en: 'Head shave', price: 600, duration_minutes: 20, active: true, sort_order: 4 },
  { name: 'قص أطفال', name_en: 'Kids haircut', price: 600, duration_minutes: 30, active: true, sort_order: 5 },
];

export const STATUS_ORDER: AppointmentStatus[] = [
  'pending',
  'accepted_awaiting_schedule',
  'scheduled',
  'rejected',
  'cancelled',
  'completed',
  'no_show',
];

/** روابط/مسارات التطبيق */
export const ROUTES = {
  home: '/',
  book: '/book',
  track: '/track',
  myAppointments: '/my-appointments',
  login: '/login',
  admin: '/admin',
} as const;

export const PWA = {
  name: SALON_CONFIG.name,
  shortName: 'صالون الأناقة',
  themeColor: '#0b0b0f',
  backgroundColor: '#0b0b0f',
} as const;
