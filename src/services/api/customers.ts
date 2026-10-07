import { trySupabase } from '@/lib/supabase';
import { demoStore, delay } from '@/services/demo/store';
import type { Customer } from '@/types/models';
import { mapDbError, type ActionResult } from './appointments';

export async function fetchCustomers(q = ''): Promise<ActionResult<Customer[]>> {
  const supa = trySupabase();
  if (!supa) {
    await delay(200);
    let rows = [...demoStore.customers];
    if (q) rows = rows.filter((c) => `${c.full_name} ${c.phone}`.includes(q.trim()));
    rows.sort((a, b) => b.visits - a.visits || b.last_visit_at!.localeCompare(a.last_visit_at ?? ''));
    return { data: rows };
  }
  let query = supa.from('customers').select('*').order('last_visit_at', { ascending: false, nullsFirst: false });
  const { data, error } = await query;
  if (error) return { error: mapDbError(error.message) };
  let rows = (data ?? []) as Customer[];
  if (q) {
    const qq = q.trim();
    rows = rows.filter((c) => `${c.full_name} ${c.phone}`.includes(qq));
  }
  return { data: rows };
}

export async function saveCustomer(
  id: string,
  patch: Partial<Pick<Customer, 'notes' | 'vip' | 'blocked'>>,
): Promise<ActionResult<Customer>> {
  const supa = trySupabase();
  if (!supa) {
    await delay(200);
    let saved: Customer | undefined;
    demoStore.mutate((s) => {
      const idx = s.customers.findIndex((c) => c.id === id);
      if (idx >= 0) {
        s.customers[idx] = { ...s.customers[idx], ...patch, updated_at: new Date().toISOString() };
        saved = s.customers[idx];
      }
    });
    return saved ? { data: saved } : { error: 'NOT_FOUND' };
  }
  const { data, error } = await supa
    .from('customers')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return { error: mapDbError(error.message) };
  return { data: data as Customer };
}
