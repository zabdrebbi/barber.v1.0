import { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  LayoutGrid,
  List,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';
import { useAppointments, useSettings } from '@/hooks/useQueries';
import { useRealtimeAppointments } from '@/hooks/useRealtime';
import { useAuth } from '@/hooks/useAuth';
import { useAvailability } from '@/hooks/useAvailability';
import { PageHeader } from './shared';
import { StatusBadge } from '@/components/common/status-badge';
import { EmptyState } from '@/components/common/empty-state';
import { cn } from '@/lib/utils';
import {
  addDays,
  formatDateAr,
  formatTimeAr,
  isoDate,
  isoTime,
  isoWeekday,
  startOfWeekIso,
  todayAlgiers,
} from '@/lib/time';
import { transitionAppointment } from '@/services/api/appointments';
import type { Appointment } from '@/types/models';
import { toast } from 'sonner';

type View = 'day' | 'week' | 'month';

const STATUS_COLOR: Record<string, string> = {
  pending: 'border-r-4 border-amber-400 bg-amber-500/10',
  accepted_awaiting_schedule: 'border-r-4 border-sky-400 bg-sky-500/10',
  scheduled: 'border-r-4 border-emerald-400 bg-emerald-500/10',
  rejected: 'border-r-4 border-rose-400 bg-rose-500/10 opacity-60',
  cancelled: 'border-r-4 border-muted-foreground bg-muted/40 opacity-50',
  completed: 'border-r-4 border-gold bg-gold/10',
  no_show: 'border-r-4 border-purple-400 bg-purple-500/10 opacity-70',
};

export function CalendarPage() {
  const t = useT();
  const { user } = useAuth();
  useRealtimeAppointments(user?.id, true);

  const [view, setView] = useState<View>('week');
  const [cursor, setCursor] = useState(todayAlgiers());
  const [showFree, setShowFree] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === 'day') return { from: cursor, to: cursor };
    if (view === 'week') {
      const s = startOfWeekIso(cursor);
      return { from: s, to: addDays(s, 6) };
    }
    const y = Number(cursor.slice(0, 4));
    const m = Number(cursor.slice(5, 7));
    const first = `${cursor.slice(0, 7)}01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: first, to: `${cursor.slice(0, 7)}${String(lastDay).padStart(2, '0')}` };
  }, [view, cursor]);

  const { data, isLoading, refetch } = useAppointments({ from: range.from, to: range.to });
  const { data: settings } = useSettings();

  const moveCursor = (dir: 1 | -1) => {
    const step = view === 'day' ? 1 : view === 'week' ? 7 : 30;
    setCursor((c) => addDays(c, dir * step));
  };

  const onDrop = async (date: string, time?: string) => {
    const id = dragId;
    setDragId(null);
    if (!id || !time) return;
    const appt = (data ?? []).find((a) => a.id === id);
    if (!appt) return;
    if (isoDate(appt.scheduled_at) === date && isoTime(appt.scheduled_at) === time) return;

    const newStart = new Date(`${date}T${time}:00+01:00`).toISOString();
    const r = await transitionAppointment(id, appt.status === 'pending' ? 'scheduled' : appt.status, {
      actor: 'admin',
      newStart,
    });
    if (r.error) toast.error(t('admin.calendar.dropBusy'));
    else {
      toast.success(t('admin.calendar.moved'));
      void refetch();
    }
  };

  const days = useMemo(() => {
    if (view === 'day') return [cursor];
    if (view === 'week') {
      const s = startOfWeekIso(cursor);
      return Array.from({ length: 7 }, (_, i) => addDays(s, i));
    }
    return [cursor];
  }, [view, cursor]);

  return (
    <div className="container py-5 animate-fade-in">
      <PageHeader
        title={t('admin.calendar.title')}
        subtitle={t('admin.calendar.dragHint')}
        actions={
          <>
            <div className="flex rounded-md border p-1">
              {(['day', 'week', 'month'] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'rounded px-3 py-1.5 text-xs font-bold transition-colors',
                    view === v ? 'bg-gold text-black' : 'text-muted-foreground',
                  )}
                >
                  {v === 'day' ? t('admin.calendar.day') : v === 'week' ? t('admin.calendar.week') : t('admin.calendar.month')}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => setCursor(todayAlgiers())}>
              <CalendarDays className="h-4 w-4" /> {t('admin.calendar.today')}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => moveCursor(-1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => moveCursor(1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={showFree ? 'gold' : 'outline'}
              onClick={() => setShowFree((v) => !v)}
            >
              <Clock className="h-4 w-4" /> {t('admin.calendar.showFree')}
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      ) : view === 'week' || view === 'day' ? (
        <WeekDayGrid
          days={days}
          appointments={data ?? []}
          showFree={showFree}
          dragId={dragId}
          setDragId={setDragId}
          onDrop={onDrop}
        />
      ) : (
        <MonthGrid
          cursor={cursor}
          appointments={data ?? []}
          onPick={(d) => { setCursor(d); setView('day'); }}
        />
      )}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {settings?.name} — {formatDateAr(range.from, { year: true })} → {formatDateAr(range.to, { year: true })}
      </p>
    </div>
  );
}

/** شبكة اليوم/الأسبوع مع السحب والإفلات */
function WeekDayGrid({
  days,
  appointments,
  showFree,
  dragId,
  setDragId,
  onDrop,
}: {
  days: string[];
  appointments: Appointment[];
  showFree: boolean;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onDrop: (date: string, time?: string) => void;
}) {
  const t = useT();
  const today = todayAlgiers();
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className={cn('grid gap-2', days.length > 1 ? 'md:grid-cols-7' : 'grid-cols-1')}>
      {days.map((d) => {
        const wd = isoWeekday(`${d}T12:00:00Z`);
        const closed = wd === 5;
        const dayAppts = appointments
          .filter((a) => isoDate(a.scheduled_at) === d && !a.deleted_at)
          .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
        return (
          <Card key={d} className={cn('min-h-40', d === today && 'border-gold/50')}>
            <CardContent className="p-2">
              <div className="mb-2 flex items-center justify-between">
                <span className={cn('text-xs font-black', d === today ? 'text-gold' : 'text-muted-foreground')}>
                  {formatDateAr(d, { weekday: true })}
                </span>
                <span className="text-[10px] text-muted-foreground">{dayAppts.length}</span>
              </div>

              {closed ? (
                <div className="rounded-md bg-muted/60 p-3 text-center text-xs text-muted-foreground">
                  {t('home.closedDay')}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {dayAppts.map((a) => (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={() => setDragId(a.id)}
                      onDragEnd={() => setDragId(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDrop(d, isoTime(a.scheduled_at))}
                      className={cn(
                        'cursor-grab rounded-md border p-2 text-xs transition-all active:cursor-grabbing hover:shadow-md',
                        STATUS_COLOR[a.status],
                        dragId === a.id && 'opacity-40',
                      )}
                      title={`${a.customer_name} — ${t(`status.${a.status}`)}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black" dir="ltr">
                          {formatTimeAr(a.scheduled_at)}
                        </span>
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <p className="truncate font-bold">
                        {a.customer_name} {a.customer_lastname}
                      </p>
                      <p className="truncate text-muted-foreground">{a.service?.name}</p>
                    </div>
                  ))}

                  {showFree && <FreeSlots date={d} appointments={dayAppts} onPick={(time) => onDrop(d, time)} />}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function FreeSlots({
  date,
  appointments,
  onPick,
}: {
  date: string;
  appointments: Appointment[];
  onPick: (time: string) => void;
}) {
  const t = useT();
  const { slots, isLoading } = useAvailability(date, null);

  if (isLoading) return <div className="h-8 animate-pulse rounded bg-muted" />;
  if (!slots.length) return <p className="text-[10px] text-muted-foreground">{t('booking.noSlots')}</p>;

  return (
    <div className="flex flex-wrap gap-1 pt-1">
      <span className="w-full text-[10px] font-bold text-gold">{t('admin.calendar.freeSlots')}:</span>
      {slots.slice(0, 12).map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          className="rounded border border-dashed border-gold/40 px-1.5 py-0.5 text-[10px] text-gold hover:bg-gold/10"
          dir="ltr"
          title={t('admin.calendar.freeSlot')}
        >
          {s}
        </button>
      ))}
      {slots.length > 12 && <span className="text-[10px] text-muted-foreground">+{slots.length - 12}</span>}
    </div>
  );
}

/** عرض شهري */
function MonthGrid({
  cursor,
  appointments,
  onPick,
}: {
  cursor: string;
  appointments: Appointment[];
  onPick: (d: string) => void;
}) {
  const t = useT();
  const first = `${cursor.slice(0, 7)}01`;
  const startWd = isoWeekday(`${first}T12:00:00Z`);
  const lead = (startWd + 1) % 7; // يبدأ بالسبت
  const y = Number(cursor.slice(0, 4));
  const m = Number(cursor.slice(5, 7));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: lastDay }, (_, i) => `${cursor.slice(0, 7)}${String(i + 1).padStart(2, '0')}`),
  ];

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground">
        {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="min-h-20 rounded-md bg-muted/30" />;
          const appts = appointments.filter((a) => isoDate(a.scheduled_at) === d && !a.deleted_at);
          const closed = isoWeekday(`${d}T12:00:00Z`) === 5;
          return (
            <button
              key={d}
              onClick={() => onPick(d)}
              className={cn(
                'min-h-20 rounded-md border p-1 text-right transition-all hover:border-gold/50',
                d === todayAlgiers() && 'border-gold',
                closed && 'bg-muted/40',
              )}
            >
              <span className={cn('text-xs font-black', d === todayAlgiers() ? 'text-gold' : 'text-muted-foreground')}>
                {Number(d.slice(8))}
              </span>
              <div className="mt-1 space-y-0.5">
                {appts.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    className={cn('truncate rounded px-1 text-[9px] font-bold', STATUS_COLOR[a.status])}
                    dir="ltr"
                  >
                    {isoTime(a.scheduled_at)} {a.customer_name}
                  </div>
                ))}
                {appts.length > 3 && <span className="block text-[9px] text-muted-foreground">+{appts.length - 3}</span>}
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {(['pending', 'scheduled', 'completed', 'cancelled', 'rejected'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <Badge variant="outline" className={cn('px-1.5', STATUS_COLOR[s])}>
              {t(`status.${s}`)}
            </Badge>
          </span>
        ))}
      </div>
    </div>
  );
}
