import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  fetchAppointments,
  fetchUserAppointments,
  fetchByTrackingToken,
  fetchHistory,
  type AppointmentFilter,
} from '@/services/api/appointments';
import { fetchServices, fetchWorkingHours, fetchTimeOff, fetchSettings } from '@/services/api/catalog';
import { fetchCustomers } from '@/services/api/customers';
import { fetchTemplates, fetchLogs, fetchInApp } from '@/services/api/notifications';
import { fetchRoles } from '@/services/api/roles';
import { buildReport, fetchBookingsChart, type ReportRange } from '@/services/api/reports';
import type { Appointment, SalonSettings, Service, TimeOff, WorkingHour } from '@/types/models';

export function useAppointments(filter: AppointmentFilter = {}, enabled = true): UseQueryResult<Appointment[]> {
  return useQuery({
    queryKey: ['appointments', filter],
    queryFn: async () => {
      const r = await fetchAppointments(filter);
      if (r.error) throw new Error(r.error);
      return r.data ?? [];
    },
    enabled,
    refetchInterval: 60_000,
  });
}

export function useUserAppointments(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['my-appointments', userId],
    queryFn: async () => {
      const r = await fetchUserAppointments(userId!);
      if (r.error) throw new Error(r.error);
      return r.data ?? [];
    },
    enabled: Boolean(userId) && enabled,
  });
}

export function useTracking(token: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['track', token],
    queryFn: async () => {
      const r = await fetchByTrackingToken(token!);
      if (r.error) throw new Error(r.error);
      return r.data!;
    },
    enabled: Boolean(token) && enabled,
    retry: false,
  });
}

export function useHistory(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ['history', appointmentId],
    queryFn: async () => {
      const r = await fetchHistory(appointmentId!);
      if (r.error) throw new Error(r.error);
      return r.data ?? [];
    },
    enabled: Boolean(appointmentId),
  });
}

export function useServices(onlyActive = false, enabled = true) {
  return useQuery({
    queryKey: ['services', onlyActive],
    queryFn: async () => {
      const r = await fetchServices(onlyActive);
      if (r.error) throw new Error(r.error);
      return r.data ?? [];
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useWorkingHours(enabled = true) {
  return useQuery({
    queryKey: ['working-hours'],
    queryFn: async () => {
      const r = await fetchWorkingHours();
      if (r.error) throw new Error(r.error);
      return r.data ?? [];
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useTimeOff(enabled = true) {
  return useQuery({
    queryKey: ['time-off'],
    queryFn: async () => {
      const r = await fetchTimeOff();
      if (r.error) throw new Error(r.error);
      return r.data ?? [];
    },
    enabled,
  });
}

export function useSettings(): UseQueryResult<SalonSettings> {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const r = await fetchSettings();
      if (r.error || !r.data) throw new Error(r.error ?? 'UNKNOWN');
      return r.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCustomers(q = '', enabled = true) {
  return useQuery({
    queryKey: ['customers', q],
    queryFn: async () => {
      const r = await fetchCustomers(q);
      if (r.error) throw new Error(r.error);
      return r.data ?? [];
    },
    enabled,
  });
}

export function useTemplates(enabled = true) {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const r = await fetchTemplates();
      if (r.error) throw new Error(r.error);
      return r.data ?? [];
    },
    enabled,
  });
}

export function useLogs(enabled = true) {
  return useQuery({
    queryKey: ['logs'],
    queryFn: async () => {
      const r = await fetchLogs();
      if (r.error) throw new Error(r.error);
      return r.data ?? [];
    },
    enabled,
    refetchInterval: 30_000,
  });
}

export function useInApp(enabled = true) {
  return useQuery({
    queryKey: ['in-app'],
    queryFn: async () => {
      const r = await fetchInApp();
      if (r.error) throw new Error(r.error);
      return r.data ?? [];
    },
    enabled,
    refetchInterval: 20_000,
  });
}

export function useRoles(enabled = true) {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const r = await fetchRoles();
      if (r.error) throw new Error(r.error);
      return r.data ?? [];
    },
    enabled,
  });
}

export function useReport(range: ReportRange, custom?: { from: string; to: string }, enabled = true) {
  return useQuery({
    queryKey: ['report', range, custom],
    queryFn: async () => {
      const { from, to } = (await import('@/services/api/reports')).rangeToDates(range, custom);
      const r = await buildReport(from, to);
      if (r.error || !r.data) throw new Error(r.error ?? 'UNKNOWN');
      return r.data;
    },
    enabled,
  });
}

export function useBookingsChart(days = 30, enabled = true) {
  return useQuery({
    queryKey: ['bookings-chart', days],
    queryFn: async () => {
      const r = await fetchBookingsChart(days);
      if (r.error || !r.data) throw new Error(r.error ?? 'UNKNOWN');
      return r.data;
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return {
    appointments: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
    mine: () => qc.invalidateQueries({ queryKey: ['my-appointments'] }),
    all: () => qc.invalidateQueries(),
  };
}

export function useSaveMutation<TIn, TOut>(fn: (input: TIn) => Promise<TOut>, key?: unknown[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (key) qc.invalidateQueries({ queryKey: key });
      else qc.invalidateQueries();
    },
  });
}

export type { Service, WorkingHour, TimeOff };
