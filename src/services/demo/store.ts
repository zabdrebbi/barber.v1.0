/**
 * متجر تجريبي محلي — يعمل التطبيق كاملاً بدون Supabase (وضع العرض).
 * عند إعداد المفاتيح في .env تنتقل الطبقة تلقائياً إلى Supabase.
 */
import { DEFAULT_SERVICES, SALON_CONFIG } from '@/config/salon';
import type {
  Appointment,
  AppointmentStatus,
  Customer,
  NotificationLog,
  NotificationTemplate,
  SalonSettings,
  Service,
  StatusHistoryEntry,
  TimeOff,
  WorkingHour,
} from '@/types/models';
import { DEFAULT_TEMPLATES } from '@/services/domain/templates';
import { canTransition, assertTransition } from '@/services/domain/state-machine';
import { wallToIso, isoDate, isoTime, addDays, todayAlgiers, dayStartUtc } from '@/lib/time';
import { randomToken } from '@/lib/utils';
import { hasConflict } from '@/services/domain/availability';

const KEY = 'salon_demo_v1';

interface DemoState {
  services: Service[];
  appointments: Appointment[];
  history: StatusHistoryEntry[];
  customers: Customer[];
  workingHours: WorkingHour[];
  timeOff: TimeOff[];
  settings: SalonSettings;
  templates: NotificationTemplate[];
  logs: NotificationLog[];
  inApp: Array<{
    id: string;
    user_id: string;
    appointment_id: string | null;
    title: string;
    body: string;
    read_at: string | null;
    created_at: string;
  }>;
}

function id(prefix: string): string {
  return `${prefix}_${randomToken(8)}`;
}

function seedWorkingHours(): WorkingHour[] {
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const cfg = SALON_CONFIG.workingHours[weekday];
    return {
      id: `wh_${weekday}`,
      weekday,
      is_open: Boolean(cfg),
      open_time: cfg?.open ?? '09:00',
      close_time: cfg?.close ?? '20:00',
      breaks: cfg ? SALON_CONFIG.breaks.map((b) => ({ ...b })) : [],
    };
  });
}

function seedState(): DemoState {
  const today = todayAlgiers();
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const services: Service[] = DEFAULT_SERVICES.map((s, i) => ({
    ...s,
    id: `svc_${i + 1}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const mk = (
    n: number,
    dateStr: string,
    time: string,
    status: AppointmentStatus,
    name: string,
    lastname: string,
    phone: string,
    svcId: string,
    isGuest = false,
  ): Appointment => {
    const svc = services.find((s) => s.id === svcId)!;
    const start = wallToIso(dateStr, time);
    const end = new Date(new Date(start).getTime() + svc.duration_minutes * 60000).toISOString();
    return {
      id: `ap_${n}`,
      tracking_token: randomToken(32),
      user_id: isGuest ? null : 'demo-customer',
      customer_name: name,
      customer_lastname: lastname,
      phone,
      service_id: svcId,
      scheduled_at: start,
      ends_at: end,
      original_scheduled_at: null,
      status,
      note: null,
      reject_reason: null,
      is_guest: isGuest,
      customer_id: `cus_${phone}`,
      staff_id: null,
      branch_id: null,
      source: isGuest ? 'web' : 'web',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      service: svc,
    };
  };

  const appointments: Appointment[] = [
    mk(1, yesterday, '10:00', 'completed', 'أمين', 'بوعلام', '0555111222', 'svc_1'),
    mk(2, yesterday, '16:00', 'no_show', 'ياسين', 'حمداني', '0666333444', 'svc_2'),
    mk(3, today, '09:30', 'completed', 'كريم', 'زروقي', '0777555666', 'svc_3'),
    mk(4, today, '11:00', 'scheduled', 'سفيان', 'مرابط', '0555999888', 'svc_1'),
    mk(5, today, '15:00', 'scheduled', 'إلياس', 'بلقاسم', '0666222111', 'svc_3'),
    mk(6, tomorrow, '10:00', 'pending', 'رضا', 'شريف', '0777444555', 'svc_1', true),
    mk(7, tomorrow, '12:00', 'pending', 'محمد الأمين', 'سعداوي', '0555777333', 'svc_4'),
    mk(8, addDays(today, 2), '14:00', 'scheduled', 'عمر', 'لعمامرة', '0666888999', 'svc_3'),
  ];

  const history: StatusHistoryEntry[] = appointments.map((a) => ({
    id: id('hist'),
    appointment_id: a.id,
    from_status: null,
    to_status: a.status,
    changed_by: null,
    actor_role: a.status === 'pending' ? 'guest' : 'admin',
    reason: null,
    from_scheduled_at: null,
    to_scheduled_at: a.scheduled_at,
    created_at: a.created_at,
  }));

  const customers: Customer[] = appointments.reduce<Customer[]>((acc, a) => {
    const found = acc.find((c) => c.phone === a.phone);
    if (!found) {
      acc.push({
        id: `cus_${a.phone}`,
        phone: a.phone,
        full_name: `${a.customer_name} ${a.customer_lastname}`,
        visits: a.status === 'completed' ? 1 : 0,
        no_shows: a.status === 'no_show' ? 1 : 0,
        last_visit_at: a.status === 'completed' ? a.scheduled_at : null,
        notes: null,
        vip: false,
        blocked: false,
        user_id: a.user_id,
        created_at: a.created_at,
        updated_at: a.created_at,
      });
    } else if (a.status === 'completed') {
      found.visits += 1;
      found.last_visit_at = a.scheduled_at;
    } else if (a.status === 'no_show') {
      found.no_shows += 1;
    }
    return acc;
  }, []);

  const templates: NotificationTemplate[] = Object.entries(DEFAULT_TEMPLATES).flatMap(([key, v]) => [
    {
      id: id('tpl'),
      key,
      channel: 'whatsapp' as const,
      title: v.title,
      body: v.body,
      active: true,
      updated_at: new Date().toISOString(),
    },
    {
      id: id('tpl'),
      key,
      channel: 'in_app' as const,
      title: v.title,
      body: v.body,
      active: true,
      updated_at: new Date().toISOString(),
    },
  ]);

  return {
    services,
    appointments,
    history,
    customers,
    workingHours: seedWorkingHours(),
    timeOff: [],
    settings: {
      id: 'main',
      name: SALON_CONFIG.name,
      phone: SALON_CONFIG.phone,
      address: SALON_CONFIG.address,
      map_link: SALON_CONFIG.mapLink,
      logo_url: null,
      booking_closed: SALON_CONFIG.bookingClosed,
      default_duration_minutes: SALON_CONFIG.defaultDurationMinutes,
      gap_minutes: SALON_CONFIG.defaultGapMinutes,
      max_advance_days: SALON_CONFIG.maxAdvanceDays,
      theme: 'dark',
      updated_at: new Date().toISOString(),
    },
    templates,
    logs: [],
    inApp: [],
  };
}

let state: DemoState | null = null;

function load(): DemoState {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw) as DemoState;
      return state;
    }
  } catch {
    /* ignore */
  }
  state = seedState();
  persist();
  return state;
}

function persist() {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function resetDemo() {
  state = seedState();
  persist();
}

export const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

export const demoStore = {
  get services() {
    return load().services;
  },
  get appointments() {
    return load().appointments;
  },
  get history() {
    return load().history;
  },
  get customers() {
    return load().customers;
  },
  get workingHours() {
    return load().workingHours;
  },
  get timeOff() {
    return load().timeOff;
  },
  get settings() {
    return load().settings;
  },
  get templates() {
    return load().templates;
  },
  get logs() {
    return load().logs;
  },
  get inApp() {
    return load().inApp;
  },
  save() {
    persist();
  },
  mutate(fn: (s: DemoState) => void) {
    const s = load();
    fn(s);
    persist();
  },
  activeBusy(serviceId: string, ignoreId?: string) {
    return load()
      .appointments.filter(
        (a) =>
          a.id !== ignoreId &&
          !a.deleted_at &&
          ['pending', 'accepted_awaiting_schedule', 'scheduled'].includes(a.status),
      )
      .map((a) => ({ start: a.scheduled_at, end: a.ends_at }));
  },
  /** إنشاء حجز تجريبي مع منع التعارض */
  createAppointment(input: {
    service_id: string;
    date: string;
    time: string;
    customer_name: string;
    customer_lastname: string;
    phone: string;
    note?: string | null;
    user_id?: string | null;
  }): { appointment?: Appointment; error?: string } {
    const s = load();
    const svc = s.services.find((x) => x.id === input.service_id && x.active);
    if (!svc) return { error: 'NOT_FOUND' };
    if (s.settings.booking_closed) return { error: 'BOOKING_CLOSED' };

    const start = wallToIso(input.date, input.time);
    const end = new Date(new Date(start).getTime() + svc.duration_minutes * 60000).toISOString();
    const busy = s.appointments
      .filter((a) => !a.deleted_at && ['pending', 'accepted_awaiting_schedule', 'scheduled'].includes(a.status))
      .map((a) => ({ start: a.scheduled_at, end: a.ends_at }));

    if (hasConflict({ start, end }, busy)) return { error: 'SLOT_TAKEN' };

    const appt: Appointment = {
      id: id('ap'),
      tracking_token: randomToken(32),
      user_id: input.user_id ?? null,
      customer_name: input.customer_name,
      customer_lastname: input.customer_lastname,
      phone: input.phone,
      service_id: svc.id,
      scheduled_at: start,
      ends_at: end,
      original_scheduled_at: null,
      status: 'pending',
      note: input.note ?? null,
      reject_reason: null,
      is_guest: !input.user_id,
      customer_id: `cus_${input.phone}`,
      staff_id: null,
      branch_id: null,
      source: 'web',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      service: svc,
    };

    s.appointments.push(appt);
    s.history.push({
      id: id('hist'),
      appointment_id: appt.id,
      from_status: null,
      to_status: 'pending',
      changed_by: input.user_id ?? null,
      actor_role: input.user_id ? 'customer' : 'guest',
      reason: null,
      from_scheduled_at: null,
      to_scheduled_at: start,
      created_at: new Date().toISOString(),
    });
    const existing = s.customers.find((c) => c.phone === input.phone);
    if (!existing) {
      s.customers.push({
        id: `cus_${input.phone}`,
        phone: input.phone,
        full_name: `${input.customer_name} ${input.customer_lastname}`,
        visits: 0,
        no_shows: 0,
        last_visit_at: null,
        notes: null,
        vip: false,
        blocked: false,
        user_id: input.user_id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    persist();
    return { appointment: appt };
  },
  transition(
    apptId: string,
    to: AppointmentStatus,
    opts: { reason?: string | null; newStart?: string; actor?: 'admin' | 'customer' | 'guest' } = {},
  ): { appointment?: Appointment; error?: string } {
    const s = load();
    const a = s.appointments.find((x) => x.id === apptId);
    if (!a) return { error: 'NOT_FOUND' };
    if (!canTransition(a.status, to)) return { error: `INVALID_TRANSITION:${a.status}->${to}` };
    assertTransition(a.status, to);

    const from = a.status;
    const prevStart = a.scheduled_at;
    if (opts.newStart) {
      const svc = s.services.find((x) => x.id === a.service_id);
      const busy = s.appointments
        .filter(
          (x) =>
            x.id !== a.id &&
            !x.deleted_at &&
            ['pending', 'accepted_awaiting_schedule', 'scheduled'].includes(x.status),
        )
        .map((x) => ({ start: x.scheduled_at, end: x.ends_at }));
      const end = new Date(new Date(opts.newStart).getTime() + (svc?.duration_minutes ?? 30) * 60000).toISOString();
      if (hasConflict({ start: opts.newStart, end }, busy)) return { error: 'SLOT_TAKEN' };
      a.scheduled_at = opts.newStart;
      a.ends_at = end;
      if (!a.original_scheduled_at) a.original_scheduled_at = prevStart;
    }
    a.status = to;
    if (to === 'rejected') a.reject_reason = opts.reason ?? null;
    a.updated_at = new Date().toISOString();

    s.history.push({
      id: id('hist'),
      appointment_id: a.id,
      from_status: from,
      to_status: to,
      changed_by: null,
      actor_role: opts.actor ?? 'admin',
      reason: opts.reason ?? null,
      from_scheduled_at: opts.newStart ? prevStart : null,
      to_scheduled_at: opts.newStart ?? a.scheduled_at,
      created_at: new Date().toISOString(),
    });
    persist();
    return { appointment: a };
  },
  addLog(log: Omit<NotificationLog, 'id' | 'created_at'>) {
    const s = load();
    s.logs.unshift({ ...log, id: id('log'), created_at: new Date().toISOString() });
    s.logs = s.logs.slice(0, 300);
    persist();
  },
  pushInApp(n: { user_id: string; appointment_id: string | null; title: string; body: string }) {
    const s = load();
    s.inApp.unshift({
      id: id('ntf'),
      user_id: n.user_id,
      appointment_id: n.appointment_id,
      title: n.title,
      body: n.body,
      read_at: null,
      created_at: new Date().toISOString(),
    });
    persist();
  },
};

/** المواعيد القادمة لليوم (للجداول التجريبية) */
export function demoDayAppointments(dateStr: string): Appointment[] {
  return demoStore.appointments
    .filter((a) => !a.deleted_at && isoDate(a.scheduled_at) === dateStr)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
}

export function demoDayStart(dateStr: string) {
  return dayStartUtc(dateStr);
}

export function demoNowIso() {
  return new Date().toISOString();
}

export function demoIsoTime(iso: string) {
  return isoTime(iso);
}
