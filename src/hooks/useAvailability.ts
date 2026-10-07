import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDayBusy, fetchDayRules } from '@/services/api/appointments';
import { fetchServices } from '@/services/api/catalog';
import { computeSlots } from '@/services/domain/availability';
import type { Service } from '@/types/models';
import { SALON_CONFIG } from '@/config/salon';

export function useAvailability(date: string, service: Service | null | undefined) {
  const rules = useQuery({
    queryKey: ['day-rules', date],
    queryFn: async () => {
      const r = await fetchDayRules(date);
      if (r.error) throw new Error(r.error);
      return r.data!;
    },
    enabled: Boolean(date),
    staleTime: 30_000,
  });

  const busy = useQuery({
    queryKey: ['day-busy', date],
    queryFn: async () => {
      const r = await fetchDayBusy(date);
      if (r.error) throw new Error(r.error);
      return r.data ?? [];
    },
    enabled: Boolean(date),
    staleTime: 15_000,
  });

  const { data: services } = useQuery({
    queryKey: ['services', true],
    queryFn: async () => {
      const r = await fetchServices(true);
      if (r.error) throw new Error(r.error);
      return r.data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const result = useMemo(() => {
    const duration = service?.duration_minutes ?? SALON_CONFIG.defaultDurationMinutes;
    if (!date || !rules.data) return { slots: [] as string[], reason: 'no_slots' as const, loading: true };
    const r = computeSlots({
      date,
      durationMinutes: duration,
      gapMinutes: SALON_CONFIG.defaultGapMinutes,
      dayHours: rules.data.is_open
        ? {
            is_open: rules.data.is_open,
            open_time: rules.data.open,
            close_time: rules.data.close,
            breaks: rules.data.breaks,
          }
        : null,
      timeOff: [],
      busy: busy.data ?? [],
      maxAdvanceDays: SALON_CONFIG.maxAdvanceDays,
      ignorePast: true,
    });
    return { ...r, loading: busy.isLoading };
  }, [date, rules.data, busy.data, busy.isLoading, service]);

  return {
    ...result,
    rules: rules.data,
    services: services ?? [],
    isLoading: rules.isLoading || busy.isLoading,
    refetch: () => {
      void rules.refetch();
      void busy.refetch();
    },
  };
}
