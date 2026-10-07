import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CalendarCheck, Link2, Loader2, MessageCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/i18n';
import { useTracking } from '@/hooks/useQueries';
import { useRealtimeTracking } from '@/hooks/useRealtime';
import { StatusBadge } from '@/components/common/status-badge';
import { EmptyState } from '@/components/common/empty-state';
import { formatDateAr, formatTimeAr, formatDateTimeAr } from '@/lib/time';
import { HistoryList } from './HistoryList';
import { cancelByToken, requestChange } from '@/services/api/appointments';
import { buildWhatsAppUrl } from '@/services/notification-service';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { useSettings } from '@/hooks/useQueries';
import { SALON_CONFIG } from '@/config/salon';
import { useAuth } from '@/hooks/useAuth';

export function TrackPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('t') ?? '');
  const token = params.get('t') ?? undefined;
  const { data: appt, isLoading, error, refetch } = useTracking(token);
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [busy, setBusy] = useState(false);

  useRealtimeTracking(appt?.id);

  useEffect(() => {
    if (params.get('t')) setInput(params.get('t')!);
  }, [params]);

  const submitSearch = () => {
    const v = input.trim();
    if (v.length >= 16) setParams({ t: v });
    else toast.error(t('track.notFound'));
  };

  const doCancel = async () => {
    if (!token) return;
    setBusy(true);
    const r = await cancelByToken(token);
    setBusy(false);
    setCancelOpen(false);
    if (r.error) toast.error(t(`errors.${r.error}`, {}, ) || t('errors.UNKNOWN'));
    else {
      toast.success(t('track.cancelDone'));
      void refetch();
    }
  };

  const doChange = async () => {
    if (!appt) return;
    setBusy(true);
    const r = await requestChange(appt.id, changeNote);
    setBusy(false);
    setChangeOpen(false);
    if (r.error) toast.error(t('errors.UNKNOWN'));
    else {
      toast.success(t('track.changeDone'));
      setChangeNote('');
      void refetch();
    }
  };

  return (
    <div className="container max-w-2xl py-8 animate-fade-in">
      <h1 className="mb-1 text-2xl font-black text-gold-gradient">{t('track.title')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t('track.subtitle')}</p>

      <Card className="mb-6">
        <CardContent className="p-4 sm:p-5">
          <Label htmlFor="token">{t('track.tokenLabel')}</Label>
          <div className="mt-2 flex gap-2">
            <Input
              id="token"
              dir="ltr"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              placeholder={t('track.tokenPlaceholder')}
            />
            <Button onClick={submitSearch} variant="gold">
              <Link2 className="h-4 w-4" /> {t('track.find')}
            </Button>
          </div>
          {!user && token && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t('auth.subtitle')}
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      )}

      {error && !isLoading && (
        <EmptyState icon={<XCircle className="h-7 w-7" />} title={t('track.notFound')} hint={t('track.tokenPlaceholder')} />
      )}

      {appt && !isLoading && (
        <Card className="animate-fade-in">
          <CardContent className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-black">{t('track.orderDetails')}</h2>
              <StatusBadge status={appt.status} />
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('booking.summaryService')}</dt>
                <dd className="font-bold">{appt.service?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('booking.summaryWhen')}</dt>
                <dd className="font-bold">
                  {formatDateAr(appt.scheduled_at, { weekday: true })} — {formatTimeAr(appt.scheduled_at)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('booking.fields.phone')}</dt>
                <dd className="font-bold" dir="ltr">{appt.phone}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('status.status')}</dt>
                <dd className="font-bold">{t(`statusDesc.${appt.status}`)}</dd>
              </div>
            </dl>

            {appt.reject_reason && (
              <p className="mt-3 rounded-md bg-rose-500/10 p-3 text-sm text-rose-300">{appt.reject_reason}</p>
            )}
            {appt.original_scheduled_at && appt.original_scheduled_at !== appt.scheduled_at && (
              <p className="mt-3 rounded-md bg-amber-500/10 p-3 text-xs text-amber-300">
                {t('admin.requests.originalTime')}: {formatDateTimeAr(appt.original_scheduled_at)} →{' '}
                {t('admin.requests.modifiedTime')}: {formatDateTimeAr(appt.scheduled_at)}
              </p>
            )}

            <div className="mt-5">
              <p className="mb-2 text-sm font-bold text-gold">{t('track.timeline')}</p>
              <HistoryList appointmentId={appt.id} />
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy || ['cancelled', 'rejected', 'completed', 'no_show'].includes(appt.status)}
                onClick={() => setCancelOpen(true)}
              >
                <XCircle className="h-4 w-4" /> {t('track.cancelAppointment')}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy || !['pending', 'scheduled', 'accepted_awaiting_schedule'].includes(appt.status)}
                onClick={() => setChangeOpen(true)}
              >
                <CalendarCheck className="h-4 w-4" /> {t('track.requestChange')}
              </Button>
              <Button
                asChild
                variant="success"
                className="flex-1"
              >
                <a
                  href={buildWhatsAppUrl(
                    appt.phone,
                    `مرحباً، بخصوص موعدي ${appt.service?.name ?? ''} يوم ${formatDateAr(appt.scheduled_at)}\nرابط التتبّع: ${window.location.origin}/track?t=${appt.tracking_token}`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-4 w-4" /> {t('booking.whatsappUs')}
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('track.cancelConfirm')}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              {t('app.cancel')}
            </Button>
            <Button variant="destructive" onClick={doCancel} disabled={busy}>
              {t('track.cancelAppointment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
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
            <Button variant="ghost" onClick={() => setChangeOpen(false)}>
              {t('app.cancel')}
            </Button>
            <Button variant="gold" onClick={doChange} disabled={busy || changeNote.trim().length < 3}>
              {t('app.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {settings?.name ?? SALON_CONFIG.name} • {settings?.address ?? SALON_CONFIG.address}
      </p>
    </div>
  );
}
