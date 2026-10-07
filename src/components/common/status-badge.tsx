import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';
import type { AppointmentStatus } from '@/types/models';
import { cn } from '@/lib/utils';

const VARIANT: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  accepted_awaiting_schedule: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  scheduled: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
  completed: 'bg-gold/15 text-gold-soft border-gold/30',
  no_show: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

const DOT: Record<AppointmentStatus, string> = {
  pending: 'bg-amber-400',
  accepted_awaiting_schedule: 'bg-sky-400',
  scheduled: 'bg-emerald-400',
  rejected: 'bg-rose-400',
  cancelled: 'bg-muted-foreground',
  completed: 'bg-gold',
  no_show: 'bg-purple-400',
};

export function StatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const t = useT();
  return (
    <Badge variant="outline" className={cn(VARIANT[status], className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT[status])} />
      {t(`status.${status}`)}
    </Badge>
  );
}
