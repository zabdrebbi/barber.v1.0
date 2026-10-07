import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchInApp, markAllInAppRead, markInAppRead } from '@/services/api/notifications';

export function useInApp(enabled = true) {
  return useQuery({
    queryKey: ['in-app'],
    queryFn: async () => {
      const r = await fetchInApp();
      if (r.error) throw new Error(r.error);
      return r.data ?? [];
    },
    enabled,
    refetchInterval: 15_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markInAppRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['in-app'] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllInAppRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['in-app'] }),
  });
}
