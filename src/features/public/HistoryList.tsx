import { useT } from '@/i18n';
import { useHistory } from '@/hooks/useQueries';
import { StatusBadge } from '@/components/common/status-badge';
import { formatDateTimeAr } from '@/lib/time';
import { Skeleton } from '@/components/ui/skeleton';
import type { AppointmentStatus } from '@/types/models';

export function HistoryList({ appointmentId }: { appointmentId?: string }) {
  const t = useT();
  const { data, isLoading } = useHistory(appointmentId);

  if (isLoading)
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  if (!data?.length) return <p className="text-xs text-muted-foreground">{t('app.empty')}</p>;

  return (
    <ol className="relative space-y-3 border-r-2 border-border pr-4">
      {data.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -right-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-gold" />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={h.to_status as AppointmentStatus} />
            <span className="text-xs text-muted-foreground">{formatDateTimeAr(h.created_at)}</span>
          </div>
          {h.reason && <p className="mt-0.5 text-xs text-muted-foreground">{h.reason}</p>}
        </li>
      ))}
    </ol>
  );
}
