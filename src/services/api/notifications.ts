import { trySupabase } from '@/lib/supabase';
import { demoStore, delay } from '@/services/demo/store';
import type { NotificationTemplate } from '@/types/models';
import { mapDbError, type ActionResult } from './appointments';

export async function fetchTemplates(): Promise<ActionResult<NotificationTemplate[]>> {
  const supa = trySupabase();
  if (!supa) {
    await delay(150);
    return { data: [...demoStore.templates] };
  }
  const { data, error } = await supa.from('notification_templates').select('*').order('key');
  if (error) return { error: mapDbError(error.message) };
  return { data: (data ?? []) as NotificationTemplate[] };
}

export async function saveTemplate(
  id: string,
  patch: Partial<Pick<NotificationTemplate, 'title' | 'body' | 'active'>>,
): Promise<ActionResult<NotificationTemplate>> {
  const supa = trySupabase();
  if (!supa) {
    await delay(200);
    let saved: NotificationTemplate | undefined;
    demoStore.mutate((s) => {
      const idx = s.templates.findIndex((t) => t.id === id);
      if (idx >= 0) {
        s.templates[idx] = { ...s.templates[idx], ...patch, updated_at: new Date().toISOString() };
        saved = s.templates[idx];
      }
    });
    return saved ? { data: saved } : { error: 'NOT_FOUND' };
  }
  const { data, error } = await supa
    .from('notification_templates')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return { error: mapDbError(error.message) };
  return { data: data as NotificationTemplate };
}

export interface LogRow {
  id: string;
  appointment_id: string | null;
  channel: string;
  template_key: string;
  to_phone: string | null;
  to_user_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  error: string | null;
  created_at: string;
}

export async function fetchLogs(limit = 100): Promise<ActionResult<LogRow[]>> {
  const supa = trySupabase();
  if (!supa) {
    await delay(150);
    return { data: demoStore.logs as unknown as LogRow[] };
  }
  const { data, error } = await supa
    .from('notification_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { error: mapDbError(error.message) };
  return { data: (data ?? []) as LogRow[] };
}

export interface InAppRow {
  id: string;
  user_id: string;
  appointment_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export async function fetchInApp(): Promise<ActionResult<InAppRow[]>> {
  const supa = trySupabase();
  if (!supa) {
    await delay(120);
    return { data: [...demoStore.inApp] as unknown as InAppRow[] };
  }
  const { data, error } = await supa
    .from('in_app_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return { error: mapDbError(error.message) };
  return { data: (data ?? []) as InAppRow[] };
}

export async function markInAppRead(id: string): Promise<ActionResult> {
  const supa = trySupabase();
  if (!supa) {
    demoStore.mutate((s) => {
      const n = s.inApp.find((x) => x.id === id);
      if (n) n.read_at = new Date().toISOString();
    });
    return {};
  }
  const { error } = await supa.from('in_app_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: mapDbError(error.message) };
  return {};
}

export async function markAllInAppRead(): Promise<ActionResult> {
  const supa = trySupabase();
  if (!supa) {
    demoStore.mutate((s) => {
      s.inApp.forEach((n) => (n.read_at = n.read_at ?? new Date().toISOString()));
    });
    return {};
  }
  const { error } = await supa
    .from('in_app_notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) return { error: mapDbError(error.message) };
  return {};
}
