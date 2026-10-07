import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getAuthProvider, roleResolver } from '@/services/abstractions/auth-provider';
import { trySupabase } from '@/lib/supabase';
import type { Role } from '@/types/models';

interface AuthState {
  user: User | null;
  session: Session | null;
  roles: Role[];
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => void;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const provider = getAuthProvider();

  const loadRoles = useCallback(async (uid: string | null) => {
    if (!uid) {
      setRoles([]);
      return;
    }
    try {
      const r = await roleResolver.getRoles(uid);
      setRoles(r);
    } catch {
      setRoles([]);
    }
  }, []);

  const refreshRoles = useCallback(async () => {
    await loadRoles(user?.id ?? null);
  }, [loadRoles, user?.id]);

  useEffect(() => {
    let active = true;
    const unsub = provider.onAuthStateChange(async (u, s) => {
      if (!active) return;
      setUser(u);
      setSession(s);
      await loadRoles(u?.id ?? null);
      setLoading(false);
      if (u && s) void bootstrapServerRole(s);
    });
    provider.getSession().then(({ user: u, session: s }) => {
      if (!active) return;
      setUser(u);
      setSession(s);
      if (u && s) {
        void loadRoles(u.id);
        void bootstrapServerRole(s);
      }
      setLoading(false);
    });
    return () => {
      active = false;
      unsub();
    };
  }, [provider, loadRoles]);

  const signInWithGoogle = useCallback(async () => {
    await provider.signInWithGoogle(window.location.origin);
  }, [provider]);

  const signOut = useCallback(() => {
    void provider.signOut();
    setRoles([]);
  }, [provider]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      session,
      roles,
      isAdmin: roles.includes('admin') || roles.includes('staff'),
      loading,
      signInWithGoogle,
      signOut,
      refreshRoles,
    }),
    [user, session, roles, loading, signInWithGoogle, signOut, refreshRoles],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * تهيئة الخادم بعد الدخول: صفة الأدمن تُحدَّد في الخادم فقط
 * (بريد المصادقة يُقارن بـ app_secrets.admin_email / ADMIN_EMAIL).
 */
async function bootstrapServerRole(session: Session) {
  const supa = trySupabase();
  if (!supa) return;
  try {
    // 1) الدالة الآمنة (تعمل بدون Edge Functions)
    await supa.rpc('claim_admin_role');
    // 2) ثم مزامنة الأدوار
    await supa.from('user_roles').select('role').eq('user_id', session.user.id);
    // 3) بديل: وظيفة الحافة إن كانت منشورة (تحقق إضافي + ربط طلبات الزائر)
    void fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-bootstrap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: '{}',
    }).catch(() => undefined);
  } catch {
    /* الحماية النهائية عبر RLS + user_roles */
  }
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
