import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, Loader2, Link2, Radio, Plus, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useUserAppointments, useSettings } from '@/hooks/useQueries';
import { useRealtimeAppointments } from '@/hooks/useRealtime';
import { StatusBadge } from '@/components/common/status-badge';
import { EmptyState } from '@/components/common/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { formatDateAr, formatTimeAr } from '@/lib/time';
import { parseAlgerianPhone } from '@/lib/phone';
import { cancelByToken, requestChange } from '@/services/api/appointments';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { SALON_CONFIG } from '@/config/salon';

export function MyAppointmentsPage() {
  const t = useT();
  const { user, isAdmin } = useAuth();
  const { data, isLoading, refetch } = useUserAppointments(user?.id);
  const { data: settings } = useSettings();
  useRealtimeAppointments(user?.id, isAdmin);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkPhone, setLinkPhone] = useState('');
  const [linking, setLinking] = useState(false);
  const [changeTarget, setChangeTarget] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const doLink = async () => {
    const p = parseAlgerianPhone(linkPhone);
    if (!p.valid) {
      toast.error(t('booking.validation.phone'));
      return;
    }
    setLinking(true);
    const { linkGuestBookings } = await import('@/services/api/appointments');
    const r = await linkGuestBookings(p.e164Digits);
    setLinking(false);
    if (r.error) toast.error(t('errors.UNKNOWN'));
    else {
      toast.success(t('myAppointments.guestLinked'));
      setLinkOpen(false);
      void refetch();
    }
  };

  const doCancel = async (id: string) => {
    setBusy(true);
    const appt = data?.find((a) => a.id === id);
    const r = appt?.tracking_token
      ? await cancelByToken(appt.tracking_token)
      : { error: 'UNKNOWN' };
    setBusy(false);
    if (r.error) toast.error(t('errors.UNKNOWN'));
    else toast.success(t('track.cancelDone'));
    void refetch();
  };

  const doChange = async () => {
    if (!changeTarget) return;
    setBusy(true);
    const r = await requestChange(changeTarget, changeNote);
    setBusy(false);
    setChangeTarget(null);
    setChangeNote('');
    if (r.error) toast.error(t('errors.UNKNOWN'));
    else toast.success(t('track.changeDone'));
  };

  return (
    <div className="container max-w-3xl py-8 animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gold-gradient">{t('myAppointments.title')}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Radio className="h-3.5 w-3.5 text-emerald-400" /> {t('myAppointments.realtime')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
            <Link2 className="h-4 w-4" /> {t('track.tokenLabel')}
          </Button>
          <Button asChild variant="gold" size="sm">
            <Link to="/book">
              <Plus className="h-4 w-4" /> {t('home.bookNow')}
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton count={3} />
      ) : !data?.length ? (
        <EmptyState
          icon={<CalendarCheck className="h-7 w-7" />}
          title={t('myAppointments.empty')}
          hint={t('myAppointments.emptyCta')}
          action={
            <Button asChild variant="gold">
              <Link to="/book">{t('home.bookNow')}</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {data.map((a) => {
            const cancellable = ['pending', 'scheduled', 'accepted_awaiting_schedule'].includes(a.status);
            return (
              <Card key={a.id} className="card-gold-edge overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold">{a.service?.name ?? '—'}</p>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateAr(a.scheduled_at, { weekday: true })} — {formatTimeAr(a.scheduled_at)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t(`statusDesc.${a.status}`)}</p>
                      {a.original_scheduled_at && a.original_scheduled_at !== a.scheduled_at && (
                        <p className="mt-1 text-xs text-amber-400">
                          {t('admin.requests.originalTime')}: {formatTimeAr(a.original_scheduled_at)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                      >
                        <Link to={`/track?t=${a.tracking_token}`}>
                          <Link2 className="h-3.5 w-3.5" /> {t('track.title')}
                        </Link>
                      </Button>
                      {cancellable && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setChangeTarget(a.id)}>
                            {t('track.requestChange')}
                          </Button>
                          <Button size="sm" variant="destructive" disabled={busy} onClick={() => doCancel(a.id)}>
                            <XCircle className="h-3.5 w-3.5" /> {t('track.cancelAppointment')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('myAppointments.guestLinked')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('booking.fields.phone')}</p>
          <Input
            dir="ltr"
            value={linkPhone}
            onChange={(e) => setLinkPhone(e.target.value)}
            placeholder={t('booking.fields.phonePlaceholder')}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>
              {t('app.cancel')}
            </Button>
            <Button variant="gold" onClick={doLink} disabled={linking}>
              {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {t('app.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(changeTarget)} onOpenChange={(v) => !v && setChangeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('track.requestChange')}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder={t('track.changeNotePlaceholder')}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangeTarget(null)}>
              {t('app.cancel')}
            </Button>
            <Button variant="gold" onClick={doChange} disabled={busy || changeNote.trim().length < 3}>
              {t('app.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        {settings?.name ?? SALON_CONFIG.name}
        <button className="mx-2 underline" onClick={() => nav('/track')}>
          {t('home.trackOrder')}
        </button>
      </p>
    </div>
  );
}
