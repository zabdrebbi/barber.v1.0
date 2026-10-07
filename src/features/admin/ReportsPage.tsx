import { useMemo, useState } from 'react';
import { BarChart3, CalendarRange, Download, TrendingUp, Users, Wallet, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useT } from '@/i18n';
import { useReport } from '@/hooks/useQueries';
import { PageHeader, StatCard } from './shared';
import { EmptyState } from '@/components/common/empty-state';
import { downloadCsv, toCsv, type ReportRange } from '@/services/api/reports';
import { formatNumber, formatPrice } from '@/lib/utils';
import { todayAlgiers, addDays } from '@/lib/time';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

export function ReportsPage() {
  const t = useT();
  const [range, setRange] = useState<ReportRange>('30');
  const [custom, setCustom] = useState({ from: addDays(todayAlgiers(), -29), to: todayAlgiers() });

  const { data, isLoading } = useReport(range, custom);

  const summary = data?.summary;
  const chartData = useMemo(
    () => (data?.byDay ?? []).filter((_, i, arr) => arr.length <= 31 || i % Math.ceil(arr.length / 31) === 0),
    [data],
  );

  const hoursData = data?.peakHours ?? [];

  return (
    <div className="container py-5 animate-fade-in">
      <PageHeader
        title={t('admin.reports.title')}
        actions={
          <>
            <Tabs value={range} onValueChange={(v) => setRange(v as ReportRange)}>
              <TabsList>
                <TabsTrigger value="7">{t('admin.reports.last7')}</TabsTrigger>
                <TabsTrigger value="30">{t('admin.reports.last30')}</TabsTrigger>
                <TabsTrigger value="90">{t('admin.reports.last90')}</TabsTrigger>
                <TabsTrigger value="custom">{t('admin.reports.custom')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="gold"
              size="sm"
              onClick={() => {
                if (!data?.rows.length) {
                  toast.error(t('admin.reports.noData'));
                  return;
                }
                downloadCsv(`report-${custom.from}_${custom.to}.csv`, toCsv(data.rows));
              }}
            >
              <Download className="h-4 w-4" /> {t('admin.reports.exportCsv')}
            </Button>
          </>
        }
      />

      {range === 'custom' && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1 text-sm">
            <CalendarRange className="h-4 w-4 text-gold" /> {t('admin.reports.from')}
          </span>
          <Input type="date" dir="ltr" className="w-40" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
          <span className="text-sm">{t('admin.reports.to')}</span>
          <Input type="date" dir="ltr" className="w-40" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : !data || !summary?.appointments ? (
        <EmptyState icon={<BarChart3 className="h-7 w-7" />} title={t('admin.reports.noData')} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <StatCard label={t('admin.reports.revenue')} value={formatPrice(summary.revenue)} icon={<Wallet className="h-5 w-5" />} tone="green" />
            <StatCard label={t('admin.reports.appointments')} value={summary.appointments} icon={<BarChart3 className="h-5 w-5" />} />
            <StatCard label={t('admin.reports.completed')} value={summary.completed} icon={<TrendingUp className="h-5 w-5" />} tone="blue" />
            <StatCard label={t('admin.reports.cancelled')} value={summary.cancelled} icon={<XCircle className="h-5 w-5" />} tone="red" />
            <StatCard label={t('admin.reports.noShow')} value={summary.noShow} icon={<XCircle className="h-5 w-5" />} tone="purple" />
            <StatCard
              label={t('admin.reports.avgTicket')}
              value={formatPrice(summary.avgTicket)}
              hint={`${t('admin.reports.newCustomers')}: ${summary.newCustomers}`}
              icon={<Users className="h-5 w-5" />}
              tone="gold"
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('admin.reports.revenueByDay')}</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={Math.max(0, Math.floor(chartData.length / 6))} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        direction: 'rtl',
                        fontFamily: 'Cairo',
                      }}
                    />
                    <Bar dataKey="revenue" fill="#d4af37" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('admin.reports.peakHours')}</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hoursData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        direction: 'rtl',
                        fontFamily: 'Cairo',
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {hoursData.map((h, i) => (
                        <Cell key={i} fill={h.count === Math.max(...hoursData.map((x) => x.count)) ? '#d4af37' : '#b87333'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('admin.reports.topServices')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.topServices.map((s) => {
                  const pct = Math.round((s.count / Math.max(1, summary.appointments)) * 100);
                  return (
                    <li key={s.name} className="flex items-center gap-3 text-sm">
                      <span className="w-32 truncate font-bold">{s.name}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gradient-to-l from-gold-soft to-gold-deep" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-24 text-left text-xs text-muted-foreground" dir="ltr">
                        {s.count} × {formatPrice(s.revenue)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                {t('admin.reports.visitsByDay')}: {formatNumber(chartData.reduce((s, d) => s + d.count, 0))}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
