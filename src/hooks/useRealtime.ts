import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { trySupabase } from '@/lib/supabase';
import { demoStore } from '@/services/demo/store';

/**
 * اشتراك Realtime على تغييرات المواعيد (محترم RLS):
 * - الزبون: مواعيده فقط
 * - الحلاق: كل شيء
 */
export function useRealtimeAppointments(userId?: string | null, isAdmin = false) {
  const qc = useQueryClient();
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    const supa = trySupabase();
    if (!supa) {
      // وضع العرض: نراقب localStorage كل ثانية
      const iv = window.setInterval(() => {
        void qc.invalidateQueries({ queryKey: ['appointments'] });
        void qc.invalidateQueries({ queryKey: ['my-appointments'] });
      }, 5000);
      return () => window.clearInterval(iv);
    }

    const channel = supa
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          const newRow = payload.new as { user_id?: string | null } | null;
          const oldRow = payload.old as { user_id?: string | null } | null;
          const involved =
            isAdmin ||
            (newRow?.user_id && newRow.user_id === userIdRef.current) ||
            (oldRow?.user_id && oldRow.user_id === userIdRef.current) ||
            payload.eventType === 'INSERT';
          if (involved) {
            void qc.invalidateQueries({ queryKey: ['appointments'] });
            void qc.invalidateQueries({ queryKey: ['my-appointments'] });
            void qc.invalidateQueries({ queryKey: ['track'] });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'in_app_notifications' },
        () => {
          void qc.invalidateQueries({ queryKey: ['in-app'] });
        },
      )
      .subscribe();

    return () => {
      void supa.removeChannel(channel);
    };
  }, [qc, isAdmin]);
}

/** تحديث لحظي لصفحة التتبّع */
export function useRealtimeTracking(appointmentId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!appointmentId) return;
    const supa = trySupabase();
    if (!supa) {
      const iv = window.setInterval(() => void qc.invalidateQueries({ queryKey: ['track'] }), 5000);
      return () => window.clearInterval(iv);
    }
    const ch = supa
      .channel(`track-${appointmentId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `id=eq.${appointmentId}` },
        () => void qc.invalidateQueries({ queryKey: ['track'] }),
      )
      .subscribe();
    return () => {
      void supa.removeChannel(ch);
    };
  }, [qc, appointmentId]);
}

export { demoStore };
