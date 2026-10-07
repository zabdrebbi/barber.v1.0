import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  CalendarClock,
  Clock,
  Inbox,
  Link2,
  Phone,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useT } from '@/i18n';
import { useAppointments, useSettings, useServices } from '@/hooks/useQueries';
import { useRealtimeAppointments } from '@/hooks/useRealtime';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader, WhatsAppButton, playNewRequestSound } from './shared';
import { StatusBadge } from '@/components/common/status-badge';
import { EmptyState } from '@/components/common/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { formatDateAr, formatTimeAr, isoDate, todayAlgiers, addDays } from '@/lib/time';
import { transitionAppointment } from '@/services/api/appointments';
import type { Appointment, AppointmentStatus } from '@/types/models';
import { toast } from 'sonner';
import { SALON_CONFIG } from '@/config/salon';
import { useNavigate } from 'react-router-dom';

type SortKey = 'newest' | 'oldest' | 'soonest';

export function RequestsPage() {
  const t = useT();
  const { user } = useAuth();
  const nav = useNavigate();
  useRealtimeAppointments(user?.id, true);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<AppointmentStatus | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('soonest');
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Appointment | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [newTime, setNewTime] = useState({ date: '', time: '' });
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useAppointments({});
  const { data: settings } = useSettings();
  const { data: services } = useServices(true);

  const from = addDays(todayAlgiers(), -7);
  const to = addDays(todayAlgiers(), SALON_CONFIG.maxAdvanceDays);

  const rows = useMemo(() => {
    let list = (data ?? []).filter((a) => !a.deleted_at && isoDate(a.scheduled_at) >= from && isoDate(a.scheduled_at) <= to);
    if (status !== 'all') list = list.filter((a) => a.status === status);
    if (q.trim()) {
      const needle = q.trim();
      list = list.filter((a) => `${a.customer_name} ${a.customer_lastname} ${a.phone}`.includes(needle));
    }
    const sorted = [...list];
    if (sort === 'newest') sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else if (sort === 'oldest') sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    else sorted.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    return sorted;
  }, [data, status, q, sort, from, to]);

  const pendingCount = (data ?? []).filter((a) => a.status === 'pending').length;

  // تنبيه صوتي/بصري عند طلب جديد
  const seenRef = useRef<Set<string>>(new Set());
  const initialRef = useRef(false);
  useEffect(() => {
    const pendingIds = (data ?? []).filter((a) => a.status === 'pending').map((a) => a.id);
    if (!initialRef.current && pendingIds.length) {
      initialRef.current = true;
      pendingIds.forEach((id) => seenRef.current.add(id));
      return;
    }
    if (!initialRef.current) {
      initialRef.current = true;
      pendingIds.forEach((id) => seenRef.current.add(id));
      return;
    }
    const fresh = pendingIds.filter((id) => !seenRef.current.has(id));
    if (fresh.length) {
      playNewRequestSound();
      toast.info(t('admin.requests.newRequestSound'), {
        description: t('admin.requests.newRequest'),
        duration: 6000,
      });
      fresh.forEach((id) => seenRef.current.add(id));
      void refetch();
    }
  }, [data, refetch, t]);

  const act = async (appt: Appointment, to: AppointmentStatus, opts: { reason?: string | null; newStart?: string } = {}) => {
    setBusy(true);
    const r = await transitionAppointment(appt.id, to, { actor: 'admin', ...opts });
    setBusy(false);
    if (r.error) toast.error(t(`errors.${r.error}`) || t('errors.UNKNOWN'));
    else {
      toast.success(
        to === 'scheduled'
          ? t('admin.requests.acceptedAt')
          : t(`status.${to}`),
      );
      void refetch();
    }
  };

  const openReschedule = (a: Appointment) => {
    setRescheduleTarget(a);
    setNewTime({ date: isoDate(a.scheduled_at), time: formatTimeAr(a.scheduled_at).includes('م') ? '' : '' });
    setNewTime({ date: isoDate(a.scheduled_at), time: isoTimeLocal(a.scheduled_at) });
  };

  return (
    <div className="container py-5 animate-fade-in">
      <PageHeader
        title={t('admin.requests.title')}
        subtitle={t('admin.requests.subtitle')}
        actions={
          <Badge variant={pendingCount ? 'gold' : 'muted'} className="text-sm">
            <Sparkles className="h-3.5 w-3.5" /> {pendingCount} {t('admin.requests.badgePending')}
          </Badge>
        }
      />

      {/* أدوات البحث والتصفية */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('admin.requests.searchNamePhone')}
            className="pr-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as AppointmentStatus | 'all')}>
          <SelectTrigger className="w-44">
            <SlidersHorizontal className="h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('app.all')}</SelectItem>
            {(['pending', 'scheduled', 'accepted_awaiting_schedule', 'rejected', 'cancelled', 'completed', 'no_show'] as const).map(
              (s) => (
                <SelectItem key={s} value={s}>
                  {t(`status.${s}`)}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="soonest">{t('admin.requests.sortSoonest')}</SelectItem>
            <SelectItem value="newest">{t('admin.requests.sortNewest')}</SelectItem>
            <SelectItem value="oldest">{t('admin.requests.sortOldest')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-7 w-7" />}
          title={t('admin.requests.empty')}
          hint={t('admin.requests.emptyHint')}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((a) => {
            const isPending = a.status === 'pending';
            return (
              <Card
                key={a.id}
                className={`overflow-hidden transition-all ${
                  isPending ? 'border-gold/50 shadow-lg shadow-gold/5' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">
                          {a.customer_name} {a.customer_lastname}
                        </p>
                        <StatusBadge status={a.status} />
                        {a.is_guest && <Badge variant="muted">{t('booking.guestBadge')}</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {a.service?.name} • {formatPriceLocal(a.service?.price ?? 0)}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-gold" dir="ltr">
                        {formatTimeAr(a.scheduled_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateAr(a.scheduled_at, { weekday: true })}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1" dir="ltr">
                      <Phone className="h-3.5 w-3.5" /> {a.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {a.created_at.slice(0, 16).replace('T', ' ')}
                    </span>
                    {a.note && <span className="w-full truncate rounded bg-muted px-2 py-1">{a.note}</span>}
                    {a.reject_reason && (
                      <span className="w-full truncate rounded bg-rose-500/10 px-2 py-1 text-rose-300">{a.reject_reason}</span>
                    )}
                  </div>

                  {/* أزرار سريعة */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isPending && (
                      <>
                        <Button size="sm" variant="success" disabled={busy} onClick={() => act(a, 'scheduled')}>
                          <Check className="h-4 w-4" /> {t('admin.requests.accept')}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => openReschedule(a)}>
                          <CalendarClock className="h-4 w-4" /> {t('admin.requests.acceptReschedule')}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => act(a, 'accepted_awaiting_schedule')}>
                          <Clock className="h-4 w-4" /> {t('admin.requests.acceptNoTime')}
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => { setRejectTarget(a); setRejectReason(''); }}>
                          <X className="h-4 w-4" /> {t('admin.requests.reject')}
                        </Button>
                      </>
                    )}

                    {a.status === 'accepted_awaiting_schedule' && (
                      <Button size="sm" variant="gold" disabled={busy} onClick={() => openReschedule(a)}>
                        <CalendarClock className="h-4 w-4" /> {t('admin.requests.acceptReschedule')}
                      </Button>
                    )}

                    {a.status === 'scheduled' && (
                      <>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => act(a, 'completed')}>
                          <Check className="h-4 w-4" /> {t('status.completed')}
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => act(a, 'no_show')}>
                          <X className="h-4 w-4" /> {t('status.no_show')}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => openReschedule(a)}>
                          <CalendarClock className="h-4 w-4" /> {t('admin.requests.acceptReschedule')}
                        </Button>
                      </>
                    )}

                    <WhatsAppButton
                      phone={a.phone}
                      text={buildWaText(a, settings?.name ?? SALON_CONFIG.name, settings?.address ?? SALON_CONFIG.address)}
                      label=""
                      variant="ghost"
                    />
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/track?t=${a.tracking_token}`}>
                        <Link2 className="h-4 w-4" /> {t('track.title')}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* حوار تعديل الوقت */}
      <Dialog open={Boolean(rescheduleTarget)} onOpenChange={(v) => !v && setRescheduleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.requests.rescheduleTitle')}</DialogTitle>
          </DialogHeader>
          {rescheduleTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('admin.requests.originalTime')}:{' '}
                <span className="font-bold">
                  {formatDateAr(rescheduleTarget.scheduled_at, { weekday: true })} — {formatTimeAr(rescheduleTarget.scheduled_at)}
                </span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold">{t('booking.chooseDay')}</label>
                  <Input
                    type="date"
                    dir="ltr"
                    value={newTime.date}
                    min={todayAlgiers()}
                    onChange={(e) => setNewTime((s) => ({ ...s, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold">{t('booking.chooseTime')}</label>
                  <Input
                    type="time"
                    dir="ltr"
                    step={300}
                    value={newTime.time}
                    onChange={(e) => setNewTime((s) => ({ ...s, time: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRescheduleTarget(null)}>
              {t('app.cancel')}
            </Button>
            <Button
              variant="gold"
              disabled={busy || !newTime.date || !newTime.time}
              onClick={async () => {
                if (!rescheduleTarget) return;
                const iso = `${newTime.date}T${newTime.time}:00+01:00`;
                await act(rescheduleTarget, 'scheduled', { newStart: new Date(iso).toISOString() });
                setRescheduleTarget(null);
              }}
            >
              {t('app.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار الرفض */}
      <Dialog open={Boolean(rejectTarget)} onOpenChange={(v) => !v && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.requests.rejectTitle')}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('admin.requests.rejectPlaceholder')}
            maxLength={300}
          />
          <p className="text-xs text-muted-foreground">{t('admin.requests.reasonOptional')}</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>
              {t('app.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (!rejectTarget) return;
                await act(rejectTarget, 'rejected', { reason: rejectReason.trim() || null });
                setRejectTarget(null);
              }}
            >
              {t('admin.requests.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-4 text-center">
        <Button variant="ghost" size="sm" onClick={() => nav('/admin/calendar')}>
          {t('admin.calendar.title')}
        </Button>
      </div>
    </div>
  );
}

function isoTimeLocal(iso: string): string {
  const d = new Date(iso);
  const algiers = new Date(d.getTime() + 60 * 60 * 1000);
  const h = algiers.getUTCHours();
  const m = algiers.getUTCMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatPriceLocal(n: number): string {
  return `${new Intl.NumberFormat('ar-DZ').format(n)} د.ج`;
}

function buildWaText(a: Appointment, salon: string, address: string): string {
  const date = new Date(a.scheduled_at);
  const w = new Date(date.getTime() + 60 * 60 * 1000);
  const d = `${String(w.getUTCDate()).padStart(2, '0')}/${String(w.getUTCMonth() + 1).padStart(2, '0')}`;
  const hm = `${String(w.getUTCHours()).padStart(2, '0')}:${String(w.getUTCMinutes()).padStart(2, '0')}`;
  return `مرحباً ${a.customer_name} 👋\nموعدك: ${a.service?.name ?? ''}\nاليوم: ${d}\nالوقت: ${hm}\n${salon} — ${address}\nتتبّع: ${window.location.origin}/track?t=${a.tracking_token}`;
}
