import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useInApp, useMarkAllRead } from './use-notifications';
import { EmptyState } from '@/components/common/empty-state';
import { formatDateTimeAr } from '@/lib/time';

export function NotificationBell() {
  const t = useT();
  const { user, isAdmin } = useAuth();
  const { data = [], isLoading } = useInApp(Boolean(user));
  const markAll = useMarkAllRead();
  const nav = useNavigate();
  const unread = data.filter((n) => !n.read_at).length;

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t('admin.layout.notifications')}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-black animate-pulse-gold">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t('admin.layout.notifications')}</span>
          {unread > 0 && (
            <button className="text-xs font-medium text-gold" onClick={() => markAll.mutate()}>
              <CheckCheck className="inline h-3.5 w-3.5" /> {t('notifications.markAllRead')}
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!isLoading && data.length === 0 && (
          <div className="p-3">
            <EmptyState title={t('notifications.empty')} className="border-0 bg-transparent py-6" />
          </div>
        )}
        {data.slice(0, 15).map((n) => (
          <DropdownMenuItem
            key={n.id}
            className={n.read_at ? 'opacity-60' : 'bg-accent/40'}
            onClick={() => {
              if (n.appointment_id) nav(isAdmin ? '/admin/requests' : '/my-appointments');
            }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-bold">{n.title}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
              <span className="text-[10px] text-muted-foreground">{formatDateTimeAr(n.created_at)}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
