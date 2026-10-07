import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Inbox,
  CalendarDays,
  Users,
  Scissors,
  Clock,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useAppointments } from '@/hooks/useQueries';
import { useRealtimeAppointments } from '@/hooks/useRealtime';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/common/notification-bell';

export function AdminLayout() {
  const t = useT();
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const { theme, toggle } = useTheme();
  const { isAdmin } = useAuth();

  // Realtime لحظي للوحة الحلاق
  useRealtimeAppointments(user?.id, isAdmin);
  const { data: pending } = useAppointments({ status: 'pending' });

  const items = [
    { to: '/admin', label: t('admin.dashboard.title'), icon: LayoutDashboard, end: true },
    { to: '/admin/requests', label: t('admin.requests.title'), icon: Inbox, badge: pending?.length ?? 0 },
    { to: '/admin/calendar', label: t('admin.calendar.title'), icon: CalendarDays },
    { to: '/admin/customers', label: t('admin.customers.title'), icon: Users },
    { to: '/admin/services', label: t('admin.services.title'), icon: Scissors },
    { to: '/admin/hours', label: t('admin.hours.title'), icon: Clock },
    { to: '/admin/notifications', label: t('admin.notifications.title'), icon: Bell },
    { to: '/admin/reports', label: t('admin.reports.title'), icon: BarChart3 },
    { to: '/admin/settings', label: t('admin.settings.title'), icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* الشريط الجانبي — سطح المكتب */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-b from-gold-soft to-gold-deep text-black">
            <Scissors className="h-4 w-4" />
          </span>
          <span className="font-extrabold text-gold-gradient">{t('admin.layout.barberPanel')}</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-gradient-to-l from-gold/15 to-transparent text-gold shadow-[inset_2px_0_0_0_theme(colors.gold)]'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              <it.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
              <span className="flex-1">{it.label}</span>
              {it.badge ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-black animate-pulse-gold">
                  {it.badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3">
          <Button asChild variant="ghost" className="w-full justify-start text-muted-foreground">
            <NavLink to="/">
              <ExternalLink className="h-4 w-4" />
              {t('admin.layout.viewSite')}
            </NavLink>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => {
              signOut();
              nav('/');
            }}
          >
            <LogOut className="h-4 w-4" />
            {t('nav.logout')}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/85 px-4 backdrop-blur-lg">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-b from-gold-soft to-gold-deep text-black">
              <Scissors className="h-4 w-4" />
            </span>
            <span className="font-extrabold text-gold-gradient">{t('admin.layout.barberPanel')}</span>
          </div>
          <div className="hidden text-sm text-muted-foreground lg:block">{t('admin.layout.section')}</div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} title={t('admin.settings.theme')}>
              <span className="text-base">{theme === 'dark' ? '☀️' : '🌙'}</span>
            </Button>
            <NotificationBell />
            <div className="hidden items-center gap-2 rounded-full border px-3 py-1.5 sm:flex">
              <span className="text-xs font-bold text-gold">{user?.user_metadata?.full_name ?? user?.email ?? '—'}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 pb-24 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* شريط سفلي — الهاتف */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t bg-card/95 backdrop-blur safe-bottom lg:hidden">
        {items.slice(0, 5).map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold',
                isActive ? 'text-gold' : 'text-muted-foreground',
              )
            }
          >
            <it.icon className="h-5 w-5" />
            <span className="truncate max-w-full px-0.5">{it.label}</span>
            {it.badge ? (
              <span className="absolute right-[20%] top-1 h-2 w-2 rounded-full bg-gold animate-pulse-gold" />
            ) : null}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
