import { trySupabase } from '@/lib/supabase';
import { delay } from '@/services/demo/store';
import type { Role } from '@/types/models';
import { mapDbError, type ActionResult } from './appointments';

export interface RoleRow {
  user_id: string;
  role: Role;
  granted_at: string;
  email?: string | null;
  full_name?: string | null;
}

const DEMO_ROLES: RoleRow[] = [
  { user_id: 'demo-admin', role: 'admin', granted_at: new Date().toISOString(), email: 'demo@salon.local', full_name: 'الحلاق التجريبي' },
  { user_id: 'demo-customer', role: 'customer', granted_at: new Date().toISOString(), email: 'client@example.com', full_name: 'زبون تجريبي' },
];

export async function fetchRoles(): Promise<ActionResult<RoleRow[]>> {
  const supa = trySupabase();
  if (!supa) {
    await delay(150);
    return { data: DEMO_ROLES };
  }
  const { data, error } = await supa
    .from('user_roles')
    .select('user_id, role, granted_at, email, full_name')
    .order('granted_at');
  if (error) return { error: mapDbError(error.message) };
  return { data: (data ?? []) as RoleRow[] };
}

export async function grantRole(userId: string, role: Role): Promise<ActionResult> {
  const supa = trySupabase();
  if (!supa) return {};
  const { error } = await supa.rpc('grant_role', { p_user_id: userId, p_role: role });
  if (error) return { error: mapDbError(error.message) };
  return {};
}

export async function revokeRole(userId: string, role: Role): Promise<ActionResult> {
  const supa = trySupabase();
  if (!supa) return {};
  const { error } = await supa.rpc('revoke_role', { p_user_id: userId, p_role: role });
  if (error) return { error: mapDbError(error.message) };
  return {};
}
