import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import {
  CalendarDays,
  CalendarClock,
  Inbox,
  TrendingUp,
  UserX,
  ArrowLeft,
  Scissors,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';
import { useAppointments, useBookingsChart, useSettings } from '@/hooks/useQueries';
import { useRealtimeAppointments } from '@/hooks/useRealtime';
import { useAuth } from '@/hooks/useAuth';
import { StatCard, PageHeader, WhatsAppButton } from './shared';
import { StatusBadge } from '@/components/common/status-badge';
import { EmptyState } from '@/components/common/empty-state';
import { formatNumber, formatPrice } from '@/lib/utils';
import { formatDateAr, formatTimeAr, isoDate, todayAlgiers, addDays, startOfWeekIso, endOfWeekIso } from '@/lib/time';
import { SALON_CONFIG } from '@/config/salon';
import { ListSkeleton } from '@/components/ui/skeleton';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export function DashboardPage() {
  const t = useT();
  const { user } = useAuth();
  useRealtimeAppointments(user?.id, true);

  const today = todayAlgiers();
  const weekStart = startOfWeekIso(today);
  const weekEnd = endOfWeekIso(today);

  const { data: pending } = useAppointments({ status: 'pending' });
  const { data: todayRows, isLoading } = useAppointments({ from: today, to: today });
  const { data: weekRows } = useAppointments({ from: weekStart, to: weekEnd });
  const { data: chart, isLoading: chartLoading } = useBookingsChart(30);
  const { data: settings } = useSettings();

  const stats = useMemo(() => {
    const rows = todayRows ?? [];
    const active = rows.filter((a) => ['scheduled', 'accepted_awaiting_schedule', 'pending'].includes(a.status));
    const expected = active.reduce((s, a) => s + (a.service?.price ?? 0), 0);
    const allWeek = weekRows ?? [];
    const noShowRate = allWeek.length
      ? Math.round((allWeek.filter((a) => a.status === 'no_show').length / allWeek.length) * 100)
      : 0;
    return { activeCount: active.length, expected, noShowRate, todayRows: rows };
  }, [todayRows, weekRows]);

  const nextAppt = useMemo(() => {
    const now = Date.now();
    return stats.todayRows
      .filter((a) => ['scheduled', 'accepted_awaiting_schedule'].includes(a.status))
      .find((a) => new Date(a.ends_at).getTime() >= now);
  }, [stats.todayRows]);

  const chartData = useMemo(
    () =>
      (chart ?? []).map((d) => ({
        ...d,
        label: d.date.slice(5),
      })),
    [chart],
  );

  return (
    <div className="container py-5 animate-fade-in">
      <PageHeader
        title={t('admin.dashboard.title')}
        subtitle={`${settings?.name ?? SALON_CONFIG.name} — ${formatDateAr(today, { weekday: true, year: true })}`}
        actions={
          <>
            <Button asChild variant="gold" size="sm">
              <Link to="/admin/requests">
                <Inbox className="h-4 w-4" /> {t('admin.dashboard.openRequests')}
                {pending?.length ? <Badge className="mr-1 bg-black/20">{pending.length}</Badge> : null}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/calendar">
                <CalendarDays className="h-4 w-4" /> {t('admin.dashboard.openCalendar')}
              </Link>
            </Button>
          </>
        }
      />

      {/* البطاقات */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label={t('admin.dashboard.pendingRequests')}
          value={pending?.length ?? 0}
          icon={<Inbox className="h-5 w-5" />}
          tone="gold"
        />
        <StatCard
          label={t('admin.dashboard.todayAppointments')}
          value={stats.activeCount}
          icon={<CalendarDays className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label={t('admin.dashboard.weekAppointments')}
          value={weekRows?.length ?? 0}
          hint={`${t('admin.dashboard.vs')} ${weekStart.slice(5)}`}
          icon={<CalendarClock className="h-5 w-5" />}
          tone="purple"
        />
        <StatCard
          label={t('admin.dashboard.expectedRevenue')}
          value={formatPrice(stats.expected)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="green"
        />
        <StatCard
          label={t('admin.dashboard.noShowRate')}
          value={`${stats.noShowRate}%`}
          icon={<UserX className="h-5 w-5" />}
          tone="red"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* جدول اليوم */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('admin.dashboard.todaysSchedule')}</CardTitle>
              {nextAppt && (
                <Badge variant="gold">
                  {t('admin.dashboard.nextAppointment')}: {formatTimeAr(nextAppt.scheduled_at)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton count={3} />
            ) : stats.todayRows.length === 0 ? (
              <EmptyState title={t('admin.dashboard.noMoreToday')} icon={<Scissors className="h-6 w-6" />} />
            ) : (
              <ol className="space-y-2">
                {stats.todayRows.map((a) => {
                  const isNext = nextAppt?.id === a.id;
                  const done = a.status === 'completed' || a.status === 'no_show';
                  return (
                    <li
                      key={a.id}
                      className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors ${
                        isNext ? 'border-gold/60 bg-gold/10 animate-pulse-gold' : done ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="w-16 text-center">
                        <p className="text-sm font-black text-gold" dir="ltr">
                          {formatTimeAr(a.scheduled_at)}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">
                          {a.customer_name} {a.customer_lastname}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.service?.name} • <span dir="ltr">{a.phone}</span>
                        </p>
                      </div>
                      <StatusBadge status={a.status} />
                      <div className="flex gap-1">
                        <WhatsAppButton
                          phone={a.phone}
                          variant="ghost"
                          label=""
                          text={`مرحباً ${a.customer_name}، بخصوص موعدك يوم ${formatDateAr(a.scheduled_at)} على الساعة ${formatTimeAr(a.scheduled_at)} في ${settings?.name ?? SALON_CONFIG.name} — ${settings?.address ?? SALON_CONFIG.address}`}
                        />
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/track?t=${a.tracking_token}`}>
                            <ArrowLeft className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* مخطط 30 يوماً */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('admin.dashboard.bookings30')}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {chartLoading ? (
              <div className="h-full animate-pulse rounded-md bg-muted" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
                  <defs>
                    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d4af37" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#d4af37" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={4} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      direction: 'rtl',
                      fontFamily: 'Cairo',
                    }}
                    labelFormatter={(l) => l}
                  />
                  <Area type="monotone" dataKey="count" stroke="#d4af37" strokeWidth={2} fill="url(#goldGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {formatNumber(chart?.reduce((s, d) => s + d.count, 0) ?? 0)} {t('admin.reports.appointments')} — {addDays(today, -29)} → {today}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
