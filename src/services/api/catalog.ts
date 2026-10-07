import { trySupabase } from '@/lib/supabase';
import { demoStore, delay } from '@/services/demo/store';
import { serviceZod, settingsZod, timeOffZod, workingHourZod } from '@/services/domain/schemas';
import type { SalonSettings, Service, TimeOff, WorkingHour } from '@/types/models';
import { mapDbError, type ActionResult } from './appointments';
import { SALON_CONFIG } from '@/config/salon';

/* ----------------------------- الخدمات ----------------------------- */

export async function fetchServices(onlyActive = false): Promise<ActionResult<Service[]>> {
  const supa = trySupabase();
  if (!supa) {
    await delay(150);
    let rows = [...demoStore.services].sort((a, b) => a.sort_order - b.sort_order);
    if (onlyActive) rows = rows.filter((s) => s.active);
    return { data: rows };
  }
  let q = supa.from('services').select('*').is('deleted_at', null).order('sort_order');
  if (onlyActive) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) return { error: mapDbError(error.message) };
  return { data: (data ?? []) as Service[] };
}

export async function saveService(input: Partial<Service> & { id?: string }): Promise<ActionResult<Service>> {
  const parsed = serviceZod.safeParse(input);
  if (!parsed.success) return { error: 'VALIDATION' };
  const payload = parsed.data;

  const supa = trySupabase();
  if (!supa) {
    await delay(250);
    let saved: Service | undefined;
    demoStore.mutate((s) => {
      if (input.id) {
        const idx = s.services.findIndex((x) => x.id === input.id);
        if (idx >= 0) {
          s.services[idx] = { ...s.services[idx], ...payload, updated_at: new Date().toISOString() };
          saved = s.services[idx];
        }
      } else {
        const svc: Service = {
          ...payload,
          id: `svc_${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        s.services.push(svc);
        saved = svc;
      }
    });
    return saved ? { data: saved } : { error: 'NOT_FOUND' };
  }

  if (input.id) {
    const { data, error } = await supa
      .from('services')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', input.id)
      .select()
      .single();
    if (error) return { error: mapDbError(error.message) };
    return { data: data as Service };
  }
  const { data, error } = await supa.from('services').insert(payload).select().single();
  if (error) return { error: mapDbError(error.message) };
  return { data: data as Service };
}

export async function softDeleteService(id: string): Promise<ActionResult> {
  const supa = trySupabase();
  if (!supa) {
    await delay(200);
    demoStore.mutate((s) => {
      const idx = s.services.findIndex((x) => x.id === id);
      if (idx >= 0) s.services.splice(idx, 1);
    });
    return {};
  }
  const { error } = await supa.from('services').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: mapDbError(error.message) };
  return {};
}

/* -------------------------- ساعات العمل --------------------------- */

export async function fetchWorkingHours(): Promise<ActionResult<WorkingHour[]>> {
  const supa = trySupabase();
  if (!supa) {
    await delay(150);
    return { data: [...demoStore.workingHours].sort((a, b) => a.weekday - b.weekday) };
  }
  const { data, error } = await supa.from('working_hours').select('*').order('weekday');
  if (error) return { error: mapDbError(error.message) };
  return { data: (data ?? []) as WorkingHour[] };
}

export async function saveWorkingHour(input: WorkingHour): Promise<ActionResult<WorkingHour>> {
  const parsed = workingHourZod.safeParse(input);
  if (!parsed.success) return { error: 'VALIDATION' };
  const payload = parsed.data;

  const supa = trySupabase();
  if (!supa) {
    await delay(200);
    let saved: WorkingHour | undefined;
    demoStore.mutate((s) => {
      const idx = s.workingHours.findIndex((w) => w.weekday === payload.weekday);
      if (idx >= 0) {
        s.workingHours[idx] = { ...s.workingHours[idx], ...payload };
        saved = s.workingHours[idx];
      }
    });
    return saved ? { data: saved } : { error: 'NOT_FOUND' };
  }
  const { data, error } = await supa
    .from('working_hours')
    .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: 'weekday' })
    .select()
    .single();
  if (error) return { error: mapDbError(error.message) };
  return { data: data as WorkingHour };
}

/* ------------------------ العطل الاستثنائية ------------------------ */

export async function fetchTimeOff(): Promise<ActionResult<TimeOff[]>> {
  const supa = trySupabase();
  if (!supa) {
    await delay(120);
    return { data: [...demoStore.timeOff].sort((a, b) => a.starts_at.localeCompare(b.starts_at)) };
  }
  const { data, error } = await supa.from('time_off').select('*').order('starts_at');
  if (error) return { error: mapDbError(error.message) };
  return { data: (data ?? []) as TimeOff[] };
}

export async function saveTimeOff(input: Partial<TimeOff> & { id?: string }): Promise<ActionResult<TimeOff>> {
  const parsed = timeOffZod.safeParse(input);
  if (!parsed.success) return { error: 'VALIDATION' };
  const payload = parsed.data;

  const supa = trySupabase();
  if (!supa) {
    await delay(200);
    let saved: TimeOff | undefined;
    demoStore.mutate((s) => {
      if (input.id) {
        const idx = s.timeOff.findIndex((t) => t.id === input.id);
        if (idx >= 0) {
          s.timeOff[idx] = { ...s.timeOff[idx], ...payload };
          saved = s.timeOff[idx];
        }
      } else {
        const off: TimeOff = { ...payload, reason: payload.reason ?? null, id: `off_${Date.now()}` };
        s.timeOff.push(off);
        saved = off;
      }
    });
    return saved ? { data: saved } : { error: 'NOT_FOUND' };
  }
  if (input.id) {
    const { data, error } = await supa.from('time_off').update(payload).eq('id', input.id).select().single();
    if (error) return { error: mapDbError(error.message) };
    return { data: data as TimeOff };
  }
  const { data, error } = await supa.from('time_off').insert(payload).select().single();
  if (error) return { error: mapDbError(error.message) };
  return { data: data as TimeOff };
}

export async function deleteTimeOff(id: string): Promise<ActionResult> {
  const supa = trySupabase();
  if (!supa) {
    await delay(150);
    demoStore.mutate((s) => {
      s.timeOff = s.timeOff.filter((t) => t.id !== id);
    });
    return {};
  }
  const { error } = await supa.from('time_off').delete().eq('id', id);
  if (error) return { error: mapDbError(error.message) };
  return {};
}

/* ---------------------------- الإعدادات ---------------------------- */

export async function fetchSettings(): Promise<ActionResult<SalonSettings>> {
  const supa = trySupabase();
  if (!supa) {
    await delay(100);
    return { data: demoStore.settings };
  }
  const { data, error } = await supa.from('settings').select('*').eq('id', 'main').maybeSingle();
  if (error) return { error: mapDbError(error.message) };
  if (!data) {
    return {
      data: {
        id: 'main',
        name: SALON_CONFIG.name,
        phone: SALON_CONFIG.phone,
        address: SALON_CONFIG.address,
        map_link: SALON_CONFIG.mapLink,
        logo_url: null,
        booking_closed: false,
        default_duration_minutes: SALON_CONFIG.defaultDurationMinutes,
        gap_minutes: SALON_CONFIG.defaultGapMinutes,
        max_advance_days: SALON_CONFIG.maxAdvanceDays,
        theme: 'dark',
        updated_at: new Date().toISOString(),
      },
    };
  }
  return { data: data as SalonSettings };
}

export async function saveSettings(input: Partial<SalonSettings>): Promise<ActionResult<SalonSettings>> {
  const base = (await fetchSettings()).data as SalonSettings;
  const merged = { ...base, ...input };
  const parsed = settingsZod.safeParse(merged);
  if (!parsed.success) {
    return { error: `VALIDATION:${parsed.error.issues[0]?.path.join('.') ?? ''}` };
  }
  const payload = parsed.data;

  const supa = trySupabase();
  if (!supa) {
    await delay(250);
    demoStore.mutate((s) => {
      s.settings = { ...s.settings, ...payload, updated_at: new Date().toISOString() };
    });
    return { data: demoStore.settings };
  }
  const { data, error } = await supa
    .from('settings')
    .upsert({ id: 'main', ...payload, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) return { error: mapDbError(error.message) };
  return { data: data as SalonSettings };
}
