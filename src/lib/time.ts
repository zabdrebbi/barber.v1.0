/** أدوات التوقيت: تخزين UTC دائماً، وعرض بتوقيت Africa/Algiers */
export const ALGIERS_TZ = 'Africa/Algiers';

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: ALGIERS_TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function wallClockMs(instant: Date): number {
  const p = partsFmt.formatToParts(instant);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  const hour = get('hour') === 24 ? 0 : get('hour');
  return Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
}

/** فرق التوقيت (ms) بين توقيت الجزائر والـ UTC للحظة المعطاة */
export function algiersOffsetMs(instant: Date): number {
  return wallClockMs(instant) - instant.getTime();
}

/** تحويل لحظة UTC إلى جدار أوقات بتوقيت الجزائر */
export function toWall(instant: Date): Required<WallParts> {
  const ms = wallClockMs(instant);
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

export interface WallParts {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}

/** جدار أوقات الجزائر (كسلسلة ISO أو رقم) إلى لحظة UTC */
export function fromWall(w: WallParts): Date {
  const naive = Date.UTC(
    w.year,
    (w.month ?? 1) - 1,
    w.day ?? 1,
    w.hour ?? 0,
    w.minute ?? 0,
    w.second ?? 0,
  );
  // مرّتان لضمان الدقة عند تغيّر التوقيت الموسمية
  let guess = naive - algiersOffsetMs(new Date(naive));
  guess = naive - algiersOffsetMs(new Date(guess));
  return new Date(guess);
}

/** "YYYY-MM-DD" بتوقيت الجزائر */
export function isoDate(instant: Date | string): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  const w = toWall(d);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** "HH:MM" بتوقيت الجزائر */
export function isoTime(instant: Date | string): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  const w = toWall(d);
  return `${pad(w.hour)}:${pad(w.minute)}`;
}

export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** يوم الأسبوع ISO (1=الاثنين .. 7=الأحد) بتوقيت الجزائر */
export function isoWeekday(instant: Date | string): number {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  const w = toWall(d);
  const jsDay = new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay(); // 0=أحد
  return jsDay === 0 ? 7 : jsDay;
}

/** تاريخ "YYYY-MM-DD" → لحظة بداية اليوم بتوقيت الجزائر */
export function dayStartUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return fromWall({ year: y, month: m, day: d, hour: 0, minute: 0 });
}

export function dayEndUtc(dateStr: string): Date {
  const start = dayStartUtc(dateStr);
  return new Date(start.getTime() + 24 * 3600 * 1000 - 1000);
}

/** "YYYY-MM-DD" + "HH:MM" (جدار جزائري) → ISO UTC */
export function wallToIso(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return fromWall({ year: y, month: m, day: d, hour: hh, minute: mm }).toISOString();
}

export function addDays(dateStr: string, days: number): string {
  const t = dayStartUtc(dateStr).getTime() + days * 24 * 3600 * 1000;
  return isoDate(new Date(t));
}

export function todayAlgiers(): string {
  return isoDate(new Date());
}

export function hhmmToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${pad(h)}:${pad(m)}`;
}

const AR_MONTHS = [
  'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان',
  'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function formatDateAr(value: Date | string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = typeof value === 'string' ? (value.length === 10 ? dayStartUtc(value) : new Date(value)) : value;
  const w = toWall(d);
  const day = `${w.day} ${AR_MONTHS[w.month - 1]}`;
  const y = opts.year ? ` ${w.year}` : '';
  const wd = opts.weekday ? `${AR_DAYS[jsDayIndex(w)]}، ` : '';
  return `${wd}${day}${y}`;
}

export function formatTimeAr(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const t = isoTime(d);
  const [h, m] = t.split(':').map(Number);
  const period = h < 12 ? 'ص' : 'م';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${period}`;
}

export function formatDateTimeAr(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${formatDateAr(d)} — ${formatTimeAr(d)}`;
}

function jsDayIndex(w: { year: number; month: number; day: number }): number {
  const js = new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay(); // 0=أحد
  return js;
}

export function isSameDayIso(a: string | Date, b: string | Date): boolean {
  return isoDate(a) === isoDate(b);
}

export function startOfWeekIso(dateStr: string): string {
  // بداية الأسبوع: السبت (الجزائري)
  const wd = isoWeekday(dateStr); // 1..7
  const backToSat = (wd + 1) % 7; // السبت=6 → 0
  return addDays(dateStr, -backToSat);
}

export function endOfWeekIso(dateStr: string): string {
  return addDays(startOfWeekIso(dateStr), 6);
}

export function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dayStartUtc(s).getTime());
}

export function isValidTime(s: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(s)) return false;
  const [h, m] = s.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}
