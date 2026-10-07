/**
 * طبقة تجريد المصادقة — قابلة للاستبدال (Google OAuth / هاتف / داخلي لاحقاً).
 */
import type { Session, User } from '@supabase/supabase-js';
import { trySupabase } from '@/lib/supabase';
import type { Role } from '@/types/models';

export interface AuthProvider {
  readonly id: 'supabase' | 'demo';
  getSession(): Promise<{ user: User | null; session: Session | null }>;
  signInWithGoogle(redirectTo?: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthStateChange(cb: (user: User | null, session: Session | null) => void): () => void;
}

class SupabaseAuthProvider implements AuthProvider {
  readonly id = 'supabase' as const;

  private client() {
    const c = trySupabase();
    if (!c) throw new Error('SUPABASE_NOT_CONFIGURED');
    return c;
  }

  async getSession() {
    const { data } = await this.client().auth.getSession();
    return { user: data.session?.user ?? null, session: data.session };
  }

  async signInWithGoogle(redirectTo?: string) {
    const { error } = await this.client().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo ?? window.location.origin },
    });
    if (error) throw new Error(error.message);
  }

  async signOut() {
    await this.client().auth.signOut();
  }

  onAuthStateChange(cb: (user: User | null, session: Session | null) => void) {
    const { data } = this.client().auth.onAuthStateChange((_event, session) => {
      cb(session?.user ?? null, session);
    });
    return () => data.subscription.unsubscribe();
  }
}

/** وضع العرض: مستخدم تجريبي بلا خادم */
class DemoAuthProvider implements AuthProvider {
  readonly id = 'demo' as const;
  private listeners: Array<(u: User | null, s: Session | null) => void> = [];
  private current: { user: User; session: Session } | null = null;

  async getSession() {
    return { user: this.current?.user ?? null, session: this.current?.session ?? null };
  }

  async signInWithGoogle() {
    const user = {
      id: 'demo-admin',
      email: 'demo@salon.local',
      user_metadata: { name: 'الحلاق التجريبي', full_name: 'الحلاق التجريبي', avatar_url: '' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as unknown as User;
    const session = { user, access_token: 'demo', expires_at: 9999999999 } as unknown as Session;
    this.current = { user, session };
    this.listeners.forEach((l) => l(user, session));
  }

  async signOut() {
    this.current = null;
    this.listeners.forEach((l) => l(null, null));
  }

  onAuthStateChange(cb: (u: User | null, s: Session | null) => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }
}

let provider: AuthProvider | null = null;

export function getAuthProvider(): AuthProvider {
  if (!provider) {
    provider = trySupabase() ? new SupabaseAuthProvider() : new DemoAuthProvider();
  }
  return provider;
}

/** أدوار الدخول — تُحدَّد من الخادم (جدول user_roles + دوال آمنة) */
export interface RoleResolver {
  getRoles(userId: string): Promise<Role[]>;
}

export const roleResolver: RoleResolver = {
  async getRoles(userId) {
    const supa = trySupabase();
    if (!supa) return userId === 'demo-admin' ? ['admin', 'customer'] : ['customer'];
    const { data } = await supa.from('user_roles').select('role').eq('user_id', userId);
    return (data ?? []).map((r) => r.role as Role);
  },
};
