import { bookingSchema, type BookingInput } from '@/services/domain/schemas';
import { trySupabase } from '@/lib/supabase';
import { demoStore, delay } from '@/services/demo/store';
import { randomToken } from '@/lib/utils';
import { isoDate, wallToIso } from '@/lib/time';
import { hasConflict } from '@/services/domain/availability';
import type { Appointment, AppointmentStatus, StatusHistoryEntry } from '@/types/models';
import { assertActorTransition, type Actor } from '@/services/domain/state-machine';

export interface ActionResult<T = undefined> {
  data?: T;
  error?: string;
}

export async function createBooking(raw: BookingInput): Promise<ActionResult<Appointment>> {
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.code === 'custom' ? parsed.error.issues[0].message : 'VALIDATION' };
  }
  const input = parsed.data;

  const supa = trySupabase();
  if (!supa) {
    await delay(500);
    const { appointment, error } = demoStore.createAppointment(input);
    if (error || !appointment) return { error: error ?? 'UNKNOWN' };
    const { notifyAppointmentCreated } = await import('@/services/notification-service');
    void notifyAppointmentCreated(appointment);
    return { data: appointment };
  }

  // 1) محاولة عبر Edge Function (Honeypot + Rate limiting + Turnstile جاهز)
  const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/book`;
  try {
    const res = await fetch(functionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: Appointment; error?: string };
      if (json.error) return { error: json.error };
      if (json.data) {
        const { notifyAppointmentCreated } = await import('@/services/notification-service');
        void notifyAppointmentCreated(json.data);
        return { data: json.data };
      }
    }
    if (res.status !== 404 && res.status !== 405) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (json.error) return { error: json.error };
    }
  } catch {
    // نكمل عبر RPC مباشرة (الوظيفة غير منشورة بعد)
  }

  // 2) بديل: دالة آمنة create_appointment (منع التعارض على مستوى قاعدة البيانات)
  const { data, error } = await supa.rpc('create_appointment', {
    p_service_id: input.service_id,
    p_date: input.date,
    p_time: input.time,
    p_name: input.customer_name,
    p_lastname: input.customer_lastname,
    p_phone: input.phone,
    p_note: input.note ?? null,
    p_user_id: input.user_id ?? null,
  });
  if (error) return { error: mapDbError(error.message) };
  const row = (Array.isArray(data) ? data[0] : data) as Appointment | undefined;
  if (!row) return { error: 'UNKNOWN' };
  const { notifyAppointmentCreated } = await import('@/services/notification-service');
  void notifyAppointmentCreated(row);
  return { data: row };
}

export interface AppointmentFilter {
  status?: AppointmentStatus | 'active';
  from?: string;
  to?: string;
  q?: string;
}

/** كل المواعيد (للحلاق — RLS يسمح) */
export async function fetchAppointments(filter: AppointmentFilter = {}): Promise<ActionResult<Appointment[]>> {
  const supa = trySupabase();
  if (!supa) {
    await delay();
    let rows = demoStore.appointments.filter((a) => !a.deleted_at);
    if (filter.status && filter.status !== 'active') rows = rows.filter((a) => a.status === filter.status);
    if (filter.status === 'active')
      rows = rows.filter((a) => ['pending', 'accepted_awaiting_schedule', 'scheduled'].includes(a.status));
    if (filter.from) rows = rows.filter((a) => isoDate(a.scheduled_at) >= filter.from!);
    if (filter.to) rows = rows.filter((a) => isoDate(a.scheduled_at) <= filter.to!);
    if (filter.q) {
      const q = filter.q.trim();
      rows = rows.filter((a) => `${a.customer_name} ${a.customer_lastname} ${a.phone}`.includes(q));
    }
    rows.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    return { data: rows };
  }

  let q = supa.from('appointments').select('*, service:services(*)').is('deleted_at', null);
  if (filter.status && filter.status !== 'active') q = q.eq('status', filter.status);
  if (filter.status === 'active') q = q.in('status', ['pending', 'accepted_awaiting_schedule', 'scheduled']);
  if (filter.from) q = q.gte('scheduled_at', `${filter.from}T00:00:00+01:00`);
  if (filter.to) q = q.lte('scheduled_at', `${filter.to}T23:59:59+01:00`);
  q = q.order('scheduled_at', { ascending: true }).limit(1000);
  const { data, error } = await q;
  if (error) return { error: mapDbError(error.message) };
  let rows = (data ?? []) as unknown as Appointment[];
  if (filter.q) {
    const qq = filter.q.trim();
    rows = rows.filter((a) => `${a.customer_name} ${a.customer_lastname} ${a.phone}`.includes(qq));
  }
  return { data: rows };
}

export async function fetchUserAppointments(userId: string): Promise<ActionResult<Appointment[]>> {
  const supa = trySupabase();
  if (!supa) {
    await delay();
    const rows = demoStore.appointments
      .filter((a) => a.user_id === userId && !a.deleted_at)
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
    return { data: rows };
  }
  const { data, error } = await supa
    .from('appointments')
    .select('*, service:services(*)')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: false })
    .limit(200);
  if (error) return { error: mapDbError(error.message) };
  return { data: (data ?? []) as unknown as Appointment[] };
}

export async function fetchByTrackingToken(token: string): Promise<ActionResult<Appointment>> {
  const t = token.trim();
  if (t.length < 16) return { error: 'NOT_FOUND' };
  const supa = trySupabase();
  if (!supa) {
    await delay();
    const row = demoStore.appointments.find((a) => a.tracking_token === t);
    return row ? { data: row } : { error: 'NOT_FOUND' };
  }
  const { data, error } = await supa.rpc('get_appointment_by_token', { p_token: t });
  if (error) return { error: mapDbError(error.message) };
  const row = (Array.isArray(data) ? data[0] : data) as Appointment | undefined;
  if (!row) return { error: 'NOT_FOUND' };
  if (!row.service) {
    const { data: svc } = await supa.from('services').select('*').eq('id', row.service_id).maybeSingle();
    row.service = (svc as Appointment['service']) ?? null;
  }
  return { data: row };
}

export interface TransitionOptions {
  actor?: Actor;
  reason?: string | null;
  newStart?: string;
}

/** تحويل حالة (منطق واحد للواجهة والخادم) */
export async function transitionAppointment(
  id: string,
  to: AppointmentStatus,
  opts: TransitionOptions = {},
): Promise<ActionResult<Appointment>> {
  const actor: Actor = opts.actor ?? 'admin';

  const supa = trySupabase();
  if (!supa) {
    await delay(350);
    const current = demoStore.appointments.find((a) => a.id === id);
    if (!current) return { error: 'NOT_FOUND' };
    assertActorTransition(actor, current.status, to);
    const { appointment, error } = demoStore.transition(id, to, {
      reason: opts.reason,
      newStart: opts.newStart,
      actor: actor === 'system' ? 'admin' : actor,
    });
    if (error) return { error: mapDbError(error) };
    const { notifyAppointmentChanged } = await import('@/services/notification-service');
    void notifyAppointmentChanged(appointment!);
    return { data: appointment };
  }

  const { data, error } = await supa.rpc('update_appointment_status', {
    p_id: id,
    p_to: to,
    p_reason: opts.reason ?? null,
    p_new_start: opts.newStart ?? null,
  });
  if (error) return { error: mapDbError(error.message) };
  const row = (Array.isArray(data) ? data[0] : data) as Appointment | undefined;
  if (!row) return { error: 'UNKNOWN' };
  const { notifyAppointmentChanged } = await import('@/services/notification-service');
  void notifyAppointmentChanged(row);
  return { data: row };
}

/** إلغاء برابط التتبّع (للزائر) */
export async function cancelByToken(token: string): Promise<ActionResult<Appointment>> {
  const supa = trySupabase();
  if (!supa) {
    await delay(300);
    const row = demoStore.appointments.find((a) => a.tracking_token === token);
    if (!row) return { error: 'NOT_FOUND' };
    return transitionAppointment(row.id, 'cancelled', { actor: 'guest' });
  }
  const { data, error } = await supa.rpc('cancel_appointment_by_token', { p_token: token });
  if (error) return { error: mapDbError(error.message) };
  const row = (Array.isArray(data) ? data[0] : data) as Appointment | undefined;
  if (!row) return { error: 'NOT_FOUND' };
  const { notifyAppointmentChanged } = await import('@/services/notification-service');
  void notifyAppointmentChanged(row);
  return { data: row };
}

/** طلب تغيير موعد (مسجّل) — يسجّل السبب ويبلّغ الحلاق */
export async function requestChange(id: string, note: string): Promise<ActionResult> {
  const supa = trySupabase();
  if (!supa) {
    await delay(300);
    demoStore.mutate((s) => {
      const a = s.appointments.find((x) => x.id === id);
      if (a) {
        a.note = note;
        a.updated_at = new Date().toISOString();
        s.history.push({
          id: `hist_${randomToken(6)}`,
          appointment_id: a.id,
          from_status: a.status,
          to_status: a.status,
          changed_by: a.user_id,
          actor_role: 'customer',
          reason: note,
          from_scheduled_at: null,
          to_scheduled_at: null,
          created_at: new Date().toISOString(),
        });
      }
    });
    return {};
  }
  const { error } = await supa.rpc('request_appointment_change', { p_id: id, p_note: note });
  if (error) return { error: mapDbError(error.message) };
  return {};
}

/** ربط طلبات الزائر السابقة بحساب المسجّل (عبر رقم الهاتف) */
export async function linkGuestBookings(phone: string): Promise<ActionResult<number>> {
  const supa = trySupabase();
  if (!supa) {
    await delay();
    let n = 0;
    demoStore.mutate((s) => {
      const me = s.appointments.find((a) => a.user_id === 'demo-admin');
      const userId = me?.user_id ?? 'demo-admin';
      s.appointments.forEach((a) => {
        if (a.phone === phone && !a.user_id) {
          a.user_id = userId;
          a.is_guest = false;
          n += 1;
        }
      });
    });
    return { data: n };
  }
  const { data, error } = await supa.rpc('link_guest_bookings', { p_phone: phone });
  if (error) return { error: mapDbError(error.message) };
  return { data: Number(data ?? 0) };
}

/** سجل حالة موعد */
export async function fetchHistory(appointmentId: string): Promise<ActionResult<StatusHistoryEntry[]>> {
  const supa = trySupabase();
  if (!supa) {
    await delay(150);
    const rows = demoStore.history.filter((h) => h.appointment_id === appointmentId);
    return { data: rows };
  }
  const { data, error } = await supa
    .from('appointment_status_history')
    .select('*')
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: true });
  if (error) return { error: mapDbError(error.message) };
  return { data: (data ?? []) as StatusHistoryEntry[] };
}

/** أوقات مشغولة ليوم معين (عامة — بلا بيانات شخصية) */
export async function fetchDayBusy(
  date: string,
): Promise<ActionResult<{ start: string; end: string }[]>> {
  const supa = trySupabase();
  if (!supa) {
    await delay(120);
    const rows = demoStore.appointments
      .filter((a) => !a.deleted_at && isoDate(a.scheduled_at) === date)
      .filter((a) => ['pending', 'accepted_awaiting_schedule', 'scheduled'].includes(a.status))
      .map((a) => ({ start: a.scheduled_at, end: a.ends_at }));
    return { data: rows };
  }
  const { data, error } = await supa.rpc('get_public_availability', { p_date: date });
  if (error) return { error: mapDbError(error.message) };
  const json = (Array.isArray(data) ? data[0] : data) as { busy?: { start: string; end: string }[] } | undefined;
  return { data: json?.busy ?? [] };
}

/** ساعات العمل والإجازات العامة لليوم */
export async function fetchDayRules(
  date: string,
): Promise<ActionResult<{ is_open: boolean; open: string; close: string; breaks: { start: string; end: string }[]; closedAllDay: boolean }>> {
  const supa = trySupabase();
  const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
  const isoWd = wd === 0 ? 7 : wd;
  if (!supa) {
    await delay(80);
    const wh = demoStore.workingHours.find((w) => w.weekday === isoWd);
    const off = demoStore.timeOff.some((o) => o.starts_at <= date && o.ends_at >= date);
    return {
      data: {
        is_open: Boolean(wh?.is_open) && !off,
        open: wh?.open_time ?? '09:00',
        close: wh?.close_time ?? '20:00',
        breaks: wh?.breaks ?? [],
        closedAllDay: off || !wh?.is_open,
      },
    };
  }
  const { data, error } = await supa.rpc('get_public_availability', { p_date: date });
  if (error) return { error: mapDbError(error.message) };
  const json = (Array.isArray(data) ? data[0] : data) as {
    is_open?: boolean;
    open?: string;
    close?: string;
    breaks?: { start: string; end: string }[];
    closed_all_day?: boolean;
  } | undefined;
  return {
    data: {
      is_open: Boolean(json?.is_open),
      open: json?.open ?? '09:00',
      close: json?.close ?? '20:00',
      breaks: json?.breaks ?? [],
      closedAllDay: Boolean(json?.closed_all_day),
    },
  };
}

export function mapDbError(msg: string): string {
  const m = msg.toUpperCase();
  if (m.includes('SLOT_TAKEN') || m.includes('NO_OVERLAP') || m.includes('EXCLUSION'))
    return 'SLOT_TAKEN';
  if (m.includes('BOOKING_CLOSED')) return 'BOOKING_CLOSED';
  if (m.includes('OUT_OF_HOURS')) return 'OUT_OF_HOURS';
  if (m.includes('PAST_TIME')) return 'PAST_TIME';
  if (m.includes('TOO_FAR')) return 'TOO_FAR';
  if (m.includes('DAY_CLOSED')) return 'DAY_CLOSED';
  if (m.includes('BLOCKED')) return 'BLOCKED';
  if (m.includes('INVALID_PHONE')) return 'INVALID_PHONE';
  if (m.includes('INVALID_TRANSITION')) return 'UNKNOWN';
  if (m.includes('FORBIDDEN') || m.includes('permission') || m.includes('row-level')) return 'UNAUTHORIZED';
  if (m.includes('Failed to fetch') || m.includes('NetworkError')) return 'NETWORK';
  if (m.includes('rate limit') || m.includes('too many')) return 'RATE_LIMITED';
  if (m.includes('NOT_FOUND')) return 'NOT_FOUND';
  return 'UNKNOWN';
}

export function busyFromAppointments(list: Appointment[]): { start: string; end: string }[] {
  return list
    .filter((a) => !a.deleted_at)
    .filter((a) => ['pending', 'accepted_awaiting_schedule', 'scheduled'].includes(a.status))
    .map((a) => ({ start: a.scheduled_at, end: a.ends_at }));
}

export function checkLocalConflict(
  startIso: string,
  endIso: string,
  busy: { start: string; end: string }[],
): boolean {
  return hasConflict({ start: startIso, end: endIso }, busy);
}

export { wallToIso };
