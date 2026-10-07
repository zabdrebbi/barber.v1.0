import { useEffect, useState } from 'react';
import { CalendarOff, Clock, Plus, Save, Timer, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/i18n';
import { useSettings, useTimeOff, useWorkingHours } from '@/hooks/useQueries';
import { PageHeader } from './shared';
import { ListSkeleton } from '@/components/ui/skeleton';
import {
  fetchWorkingHours,
  saveWorkingHour,
  saveTimeOff,
  deleteTimeOff,
  saveSettings,
} from '@/services/api/catalog';
import type { TimeOff, WorkingHour } from '@/types/models';
import { formatDateAr } from '@/lib/time';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DAY_NAMES: Record<number, string> = {
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
  7: 'الأحد',
};

export function HoursPage() {
  const t = useT();
  const { data: hours, isLoading, refetch } = useWorkingHours();
  const { data: timeOff, refetch: refetchOff } = useTimeOff();
  const { data: settings, refetch: refetchSettings } = useSettings();
  const [busy, setBusy] = useState(false);

  const [rules, setRules] = useState({ duration: '30', gap: '0', advance: '30' });
  const [offOpen, setOffOpen] = useState(false);
  const [off, setOff] = useState({ starts_at: '', ends_at: '', reason: '' });

  useEffect(() => {
    if (settings) {
      setRules({
        duration: String(settings.default_duration_minutes),
        gap: String(settings.gap_minutes),
        advance: String(settings.max_advance_days),
      });
    }
  }, [settings]);

  const updateHour = async (h: WorkingHour, patch: Partial<WorkingHour>) => {
    setBusy(true);
    const r = await saveWorkingHour({ ...h, ...patch });
    setBusy(false);
    if (r.error) toast.error(t('errors.UNKNOWN'));
    else {
      toast.success(t('admin.hours.saved'));
      void refetch();
    }
  };

  const saveRules = async () => {
    setBusy(true);
    const r = await saveSettings({
      default_duration_minutes: Number(rules.duration) || 30,
      gap_minutes: Number(rules.gap) || 0,
      max_advance_days: Number(rules.advance) || 30,
    });
    setBusy(false);
    if (r.error) toast.error(r.error);
    else {
      toast.success(t('admin.hours.saved'));
      void refetchSettings();
    }
  };

  const toggleBooking = async () => {
    if (!settings) return;
    setBusy(true);
    const r = await saveSettings({ booking_closed: !settings.booking_closed });
    setBusy(false);
    if (r.error) toast.error(r.error);
    else {
      toast.success(t('admin.hours.saved'));
      void refetchSettings();
    }
  };

  const addOff = async () => {
    if (!off.starts_at || !off.ends_at) return;
    setBusy(true);
    const r = await saveTimeOff({
      starts_at: off.starts_at,
      ends_at: off.ends_at,
      reason: off.reason || null,
      all_day: true,
    });
    setBusy(false);
    if (r.error) toast.error(t('errors.UNKNOWN'));
    else {
      setOffOpen(false);
      setOff({ starts_at: '', ends_at: '', reason: '' });
      void refetchOff();
    }
  };

  return (
    <div className="container py-5 animate-fade-in">
      <PageHeader
        title={t('admin.hours.title')}
        actions={
          <Button variant="outline" size="sm" onClick={() => setOffOpen(true)}>
            <CalendarOff className="h-4 w-4" /> {t('admin.hours.addTimeOff')}
          </Button>
        }
      />

      {settings?.booking_closed && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
          ⚠️ {t('admin.hours.closedWarning')}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* الجدول الأسبوعي */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              <Clock className="inline h-4 w-4" /> {t('admin.hours.weekTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ListSkeleton count={7} />
            ) : (
              <div className="space-y-2">
                {hours?.map((h) => (
                  <div
                    key={h.weekday}
                    className={cn(
                      'flex flex-wrap items-center gap-3 rounded-md border p-3',
                      !h.is_open && 'bg-muted/40',
                    )}
                  >
                    <span className={cn('w-20 text-sm font-bold', h.weekday === 5 && 'text-rose-400')}>
                      {DAY_NAMES[h.weekday]}
                    </span>
                    <Switch
                      checked={h.is_open}
                      disabled={busy}
                      onCheckedChange={(v) => updateHour(h, { is_open: v })}
                    />
                    {h.is_open ? (
                      <>
                        <Input
                          type="time"
                          dir="ltr"
                          className="w-28"
                          value={h.open_time}
                          disabled={busy}
                          onChange={(e) => updateHour(h, { open_time: e.target.value })}
                        />
                        <span className="text-xs text-muted-foreground">—</span>
                        <Input
                          type="time"
                          dir="ltr"
                          className="w-28"
                          value={h.close_time}
                          disabled={busy}
                          onChange={(e) => updateHour(h, { close_time: e.target.value })}
                        />
                        <Badge variant="muted">
                          {t('home.breakTime')}: {h.breaks.map((b) => `${b.start}-${b.end}`).join(', ') || '—'}
                        </Badge>
                      </>
                    ) : (
                      <Badge variant="muted">{t('admin.hours.closed')}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {t('home.breakTime')}: 13:00 — 14:00 ({t('admin.hours.breaksTitle')})
            </p>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {/* قواعد الحجز */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <Timer className="inline h-4 w-4" /> {t('admin.hours.bookingRules')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>{t('admin.hours.defaultDuration')}</Label>
                <Input
                  type="number"
                  dir="ltr"
                  value={rules.duration}
                  onChange={(e) => setRules({ ...rules, duration: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('admin.hours.gap')}</Label>
                <Input
                  type="number"
                  dir="ltr"
                  value={rules.gap}
                  onChange={(e) => setRules({ ...rules, gap: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('admin.hours.maxAdvance')}</Label>
                <Input
                  type="number"
                  dir="ltr"
                  value={rules.advance}
                  onChange={(e) => setRules({ ...rules, advance: e.target.value })}
                />
              </div>
              <Button variant="gold" className="w-full" onClick={saveRules} disabled={busy}>
                <Save className="h-4 w-4" /> {t('app.save')}
              </Button>

              <div className="mt-2 flex items-center justify-between rounded-md border border-rose-500/30 bg-rose-500/5 p-3">
                <span className="text-sm font-bold text-rose-300">
                  {settings?.booking_closed ? t('admin.hours.closeBooking') : t('admin.hours.openBooking')}
                </span>
                <Switch checked={Boolean(settings?.booking_closed)} onCheckedChange={toggleBooking} disabled={busy} />
              </div>
            </CardContent>
          </Card>

          {/* العطل */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('admin.hours.timeOffTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {!timeOff?.length ? (
                <p className="text-sm text-muted-foreground">{t('admin.hours.noTimeOff')}</p>
              ) : (
                <ul className="space-y-2">
                  {timeOff.map((o) => (
                    <li key={o.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <div>
                        <p className="font-bold">
                          {formatDateAr(o.starts_at)} ← {formatDateAr(o.ends_at)}
                        </p>
                        {o.reason && <p className="text-xs text-muted-foreground">{o.reason}</p>}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await deleteTimeOff(o.id);
                          void refetchOff();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="outline" className="mt-3 w-full" onClick={() => setOffOpen(true)}>
                <Plus className="h-4 w-4" /> {t('admin.hours.addTimeOff')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={offOpen} onOpenChange={setOffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.hours.addTimeOff')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('admin.hours.timeOffFrom')}</Label>
              <Input type="date" dir="ltr" value={off.starts_at} onChange={(e) => setOff({ ...off, starts_at: e.target.value })} />
            </div>
            <div>
              <Label>{t('admin.hours.timeOffTo')}</Label>
              <Input type="date" dir="ltr" value={off.ends_at} onChange={(e) => setOff({ ...off, ends_at: e.target.value })} />
            </div>
            <div>
              <Label>{t('admin.hours.reason')}</Label>
              <Input value={off.reason} onChange={(e) => setOff({ ...off, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOffOpen(false)}>
              {t('app.cancel')}
            </Button>
            <Button variant="gold" onClick={addOff} disabled={busy || !off.starts_at || !off.ends_at}>
              {t('app.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
