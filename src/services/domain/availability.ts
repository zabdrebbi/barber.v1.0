/**
 * حساب الأوقات المتاحة — منطق خالص قابل للاختبار (بدون اعتماد على قاعدة البيانات).
 * يُستدعى من الواجهة لعرض الأوقات ومن الخادم (Edge/SQL) للتحقق النهائي.
 */
import {
  addDays,
  dayStartUtc,
  hhmmToMinutes,
  isoWeekday,
  minutesToHHMM,
  toWall,
  todayAlgiers,
} from '@/lib/time';

export interface BusyInterval {
  /** ISO UTC */
  start: string;
  end: string;
}

export interface DayHours {
  is_open: boolean;
  open_time: string; // HH:MM
  close_time: string; // HH:MM
  breaks: { start: string; end: string }[];
}

export interface AvailabilityInput {
  /** YYYY-MM-DD بتوقيت الجزائر */
  date: string;
  durationMinutes: number;
  gapMinutes: number;
  /** ساعات يوم الأسبوع هذا (null = لا توجد سجلات → مغلق) */
  dayHours: DayHours | null;
  /** عطل تغطي اليوم (كامل اليوم أو بفترة زمنية) */
  timeOff?: BusyInterval[];
  /** مواعيد محجوزة (UTC) */
  busy?: BusyInterval[];
  maxAdvanceDays: number;
  /** اللحظة الحالية UTC */
  nowUtc?: Date;
  /** تجاهل المواعيد التي بدأت قبل الآن (دائراً افتراضياً) */
  ignorePast?: boolean;
}

export type AvailabilityReason = 'ok' | 'closed_day' | 'past_day' | 'too_far' | 'no_slots';

export interface AvailabilityResult {
  slots: string[]; // ["09:00", ...] بتوقيت الجزائر
  reason: AvailabilityReason;
}

/** دقائق بداية اليوم بتوقيت جزائري لحظة UTC داخل يوم معيّن */
function wallMinutesWithin(isoUtc: string, date: string): number {
  const inst = new Date(isoUtc);
  const base = dayStartUtc(date);
  const w = toWall(inst);
  const b = toWall(base);
  const wallInst = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const wallBase = Date.UTC(b.year, b.month - 1, b.day, b.hour, b.minute, b.second);
  return Math.round((wallInst - wallBase) / 60000);
}

function intersects(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

export function computeSlots(input: AvailabilityInput): AvailabilityResult {
  const now = input.nowUtc ?? new Date();
  const today = todayAlgiers();

  if (input.date < today) return { slots: [], reason: 'past_day' };
  const limit = addDays(today, input.maxAdvanceDays);
  if (input.date > limit) return { slots: [], reason: 'too_far' };

  const wd = isoWeekday(`${input.date}T12:00:00Z`);
  const hours = input.dayHours;
  if (!hours || !hours.is_open) return { slots: [], reason: 'closed_day' };

  // عطل استثنائية تغطي اليوم؟
  for (const off of input.timeOff ?? []) {
    const offStart = wallMinutesWithin(off.start, input.date);
    const offEnd = wallMinutesWithin(off.end, input.date);
    if (offStart <= 0 && offEnd >= 24 * 60) return { slots: [], reason: 'closed_day' };
  }

  const open = hhmmToMinutes(hours.open_time);
  const close = hhmmToMinutes(hours.close_time);
  const step = Math.max(1, input.durationMinutes + input.gapMinutes);
  if (close <= open) return { slots: [], reason: 'closed_day' };

  const dayStart = dayStartUtc(input.date).getTime();
  const nowRelMinutes = Math.floor((now.getTime() - dayStart) / 60000);

  const busyRanges: [number, number][] = (input.busy ?? []).map((b) => [
    wallMinutesWithin(b.start, input.date),
    wallMinutesWithin(b.end, input.date),
  ]);
  for (const off of input.timeOff ?? []) {
    const s = wallMinutesWithin(off.start, input.date);
    const e = wallMinutesWithin(off.end, input.date);
    if (e > 0 && s < 24 * 60) busyRanges.push([Math.max(s, 0), Math.min(e, 24 * 60)]);
  }
  for (const br of hours.breaks ?? []) {
    busyRanges.push([hhmmToMinutes(br.start), hhmmToMinutes(br.end)]);
  }

  const slots: string[] = [];
  for (let start = open; start + input.durationMinutes <= close; start += step) {
    const end = start + input.durationMinutes;
    if (input.ignorePast !== false && start <= nowRelMinutes) continue;
    const clash = busyRanges.some(([bs, be]) => intersects(start, end, bs, be));
    if (!clash) slots.push(minutesToHHMM(start));
  }

  return { slots: slots.length ? slots : [], reason: slots.length ? 'ok' : 'no_slots' };
}

/** تعارض أم لا — يُستخدم للتحقق السريع قبل الإرسال */
export function hasConflict(
  candidate: BusyInterval,
  busy: BusyInterval[],
): boolean {
  const s = new Date(candidate.start).getTime();
  const e = new Date(candidate.end).getTime();
  return busy.some((b) => {
    const bs = new Date(b.start).getTime();
    const be = new Date(b.end).getTime();
    return s < be && bs < e;
  });
}

/** أيام قابلة للحجز ضمن النافذة المسموحة */
export function bookableDays(maxAdvanceDays: number, nowUtc = new Date()): string[] {
  const today = todayAlgiers();
  const out: string[] = [];
  for (let i = 0; i <= maxAdvanceDays; i++) {
    const d = addDays(today, i);
    if (d <= addDays(today, maxAdvanceDays)) out.push(d);
  }
  return out;
}
