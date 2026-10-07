import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Link2,
  Loader2,
  MessageCircle,
  Scissors,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useServices, useSettings } from '@/hooks/useQueries';
import { useAvailability as useAvailabilityLive } from '@/hooks/useAvailability';
import type { Service } from '@/types/models';
import { formatPrice, cn, randomToken } from '@/lib/utils';
import { addDays, formatDateAr, todayAlgiers, isoWeekday, isValidIsoDate } from '@/lib/time';
import { parseAlgerianPhone } from '@/lib/phone';
import { createBooking } from '@/services/api/appointments';
import { buildWhatsAppUrl } from '@/services/notification-service';
import { toast } from 'sonner';
import { SALON_CONFIG } from '@/config/salon';
import { ListSkeleton } from '@/components/ui/skeleton';

type Step = 0 | 1 | 2;

export function BookingPage() {
  const t = useT();
  const { user, session } = useAuth();
  const nav = useNavigate();
  const { data: settings } = useSettings();
  const { data: services, isLoading: servicesLoading } = useServices(true);

  const [step, setStep] = useState<Step>(0);
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ token: string; when: string } | null>(null);

  const availability = useAvailabilityLive(date, service);

  const days = useMemo(() => {
    const today = todayAlgiers();
    return Array.from({ length: SALON_CONFIG.maxAdvanceDays + 1 }, (_, i) => addDays(today, i));
  }, []);

  const validateDetails = () => {
    const e: Record<string, string> = {};
    if (firstName.trim().length < 2) e.firstName = t('booking.validation.firstName');
    if (lastName.trim().length < 2) e.lastName = t('booking.validation.lastName');
    const p = parseAlgerianPhone(phone);
    if (!p.valid) e.phone = t('booking.validation.phone');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!service || !date || !time) return;
    if (!validateDetails()) return;
    if (honeypot) {
      toast.error(t('booking.validation.honeypot'));
      return;
    }
    setSubmitting(true);
    const p = parseAlgerianPhone(phone);
    const res = await createBooking({
      service_id: service.id,
      date,
      time,
      customer_name: firstName.trim(),
      customer_lastname: lastName.trim(),
      phone: p.e164Digits,
      note: note.trim() || null,
      website: '',
      user_id: session?.user.id ?? null,
    });
    setSubmitting(false);
    if (res.error || !res.data) {
      const key = res.error ?? 'UNKNOWN';
      if (key === 'SLOT_TAKEN') {
        toast.error(t('errors.SLOT_TAKEN'));
        availability.refetch();
        setStep(1);
        setTime('');
      } else {
        toast.error(t(`errors.${key}`));
      }
      return;
    }
    setResult({
      token: res.data.tracking_token,
      when: `${formatDateAr(res.data.scheduled_at, { weekday: true })}`,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fillFromProfile = () => {
    if (!user) return;
    const meta = user.user_metadata ?? {};
    if (!firstName && meta.given_name) setFirstName(String(meta.given_name));
    if (!firstName && meta.full_name) setFirstName(String(meta.full_name).split(' ')[0] ?? '');
    if (!lastName && meta.family_name) setLastName(String(meta.family_name));
  };

  /* --------------------------- شاشة النجاح --------------------------- */
  if (result) {
    const link = `${window.location.origin}/track?t=${result.token}`;
    return (
      <div className="container max-w-lg py-12 text-center animate-fade-in">
        <span className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 animate-fade-in">
          <CheckCircle2 className="h-10 w-10" />
        </span>
        <h1 className="text-2xl font-black text-gold-gradient">{t('booking.successTitle')}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t('booking.successText')}</p>

        <Card className="mt-6 text-right">
          <CardContent className="p-4">
            <Label className="text-xs text-muted-foreground">{t('booking.trackingLink')}</Label>
            <div className="mt-2 flex items-center gap-2">
              <Input dir="ltr" readOnly value={link} className="text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  toast.success(t('app.copied'));
                }}
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-5 flex flex-col gap-2">
          <Button asChild variant="gold" size="lg">
            <Link to={`/track?t=${result.token}`}>{t('booking.openTracking')}</Link>
          </Button>
          <Button
            asChild
            variant="success"
          >
            <a
              href={buildWhatsAppUrl(phone || SALON_CONFIG.phoneRaw, `مرحباً ${firstName}، تم استلام طلب حجزك. رابط التتبّع: ${link}`)}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="h-4 w-4" /> {t('booking.whatsappUs')}
            </a>
          </Button>
          <Button variant="ghost" onClick={() => { setResult(null); setStep(0); setTime(''); }}>
            {t('booking.bookAnother')}
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------ المحتوى ------------------------------ */
  const stepTitles = [t('booking.stepService'), t('booking.stepDateTime'), t('booking.stepDetails')];

  return (
    <div className="container max-w-3xl py-8 animate-fade-in">
      <h1 className="mb-1 text-2xl font-black text-gold-gradient">{t('booking.title')}</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        {user ? t('booking.loginHint') : t('auth.subtitle')}
      </p>

      {/* مؤشر الخطوات */}
      <ol className="mb-6 flex items-center gap-2">
        {stepTitles.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <button
              onClick={() => i < step && setStep(i as Step)}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all',
                i === step
                  ? 'bg-gradient-to-b from-gold-soft to-gold-deep text-black shadow-lg shadow-gold/25'
                  : i < step
                    ? 'bg-gold/20 text-gold'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {i < step ? '✓' : i + 1}
            </button>
            <span className={cn('hidden text-xs font-semibold sm:block', i === step ? 'text-gold' : 'text-muted-foreground')}>
              {label}
            </span>
            {i < 2 && <span className={cn('h-0.5 flex-1 rounded', i < step ? 'bg-gold/60' : 'bg-muted')} />}
          </li>
        ))}
      </ol>

      {settings?.booking_closed && (
        <Card className="mb-5 border-rose-500/40 bg-rose-500/10">
          <CardContent className="p-4 text-sm text-rose-300">
            <p className="font-bold">{t('booking.bookingClosed')}</p>
            <p className="text-xs">{t('booking.bookingClosedHint')}</p>
          </CardContent>
        </Card>
      )}

      {/* الخطوة 1: الخدمة */}
      {step === 0 && (
        <div className="space-y-3">
          {servicesLoading ? (
            <ListSkeleton count={4} />
          ) : (
            services?.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setService(s);
                  setStep(1);
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border p-4 text-right transition-all hover:border-gold/50 hover:bg-accent/40',
                  service?.id === s.id && 'border-gold bg-gold/10',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-b from-gold/25 to-copper/20 text-gold">
                    <Scissors className="h-5 w-5" />
                  </span>
                  <div className="text-right">
                    <p className="font-bold">{s.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {s.duration_minutes} {t('home.minutes')}
                    </p>
                  </div>
                </div>
                <span className="text-lg font-black text-gold">{formatPrice(s.price)}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* الخطوة 2: اليوم والوقت */}
      {step === 1 && (
        <div>
          <div className="mb-4 flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-gold" />
            <span className="font-bold">{t('booking.chooseDay')}</span>
            {service && <Badge variant="gold">{service.name}</Badge>}
          </div>

          <div className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
            {days.map((d) => {
              const wd = isoWeekday(`${d}T12:00:00Z`);
              const closed = SALON_CONFIG.workingHours[wd] == null;
              return (
                <button
                  key={d}
                  onClick={() => {
                    setDate(d);
                    setTime('');
                  }}
                  disabled={closed}
                  className={cn(
                    'flex min-w-[4.5rem] flex-col items-center rounded-lg border px-2 py-2 text-center transition-all',
                    date === d ? 'border-gold bg-gold/15 text-gold' : 'hover:border-gold/40',
                    closed && 'cursor-not-allowed opacity-40',
                  )}
                >
                  <span className="text-[10px] text-muted-foreground">{formatDateAr(d, { weekday: true }).split('،')[0]}</span>
                  <span className="text-sm font-black">{formatDateAr(d).split(' ')[0]}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDateAr(d).split(' ').slice(1).join(' ')}</span>
                </button>
              );
            })}
          </div>

          {date && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold">{t('booking.chooseTime')}</span>
                <span className="text-xs text-muted-foreground">{formatDateAr(date, { weekday: true, year: true })}</span>
              </div>

              {availability.isLoading ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
              ) : availability.slots.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <p className="font-bold text-rose-300">{t('booking.noSlots')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('booking.noSlotsHint')}</p>
                  {availability.reason === 'closed_day' && (
                    <Badge variant="muted" className="mt-2">{t('home.closedDay')}</Badge>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {availability.slots.map((s) => (
                    <button
                      key={s}
                      onClick={() => setTime(s)}
                      className={cn(
                        'rounded-md border py-2 text-sm font-bold transition-all',
                        time === s
                          ? 'border-gold bg-gradient-to-b from-gold-soft to-gold-deep text-black shadow-lg shadow-gold/25'
                          : 'hover:border-gold/50 hover:text-gold',
                      )}
                      dir="ltr"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {availability.rules && !availability.rules.is_open && (
                <p className="mt-3 text-xs text-rose-400">{t('errors.DAY_CLOSED')}</p>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>
              <ArrowRight className="h-4 w-4" /> {t('app.previous')}
            </Button>
            <Button variant="gold" disabled={!date || !time} onClick={() => setStep(2)}>
              {t('app.next')} <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* الخطوة 3: البيانات */}
      {step === 2 && service && (
        <div>
          <Card className="mb-5 bg-card/70">
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-bold text-gold">{t('booking.summary')}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t('booking.summaryService')}</dt>
                  <dd className="font-bold">{service.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('booking.summaryPrice')}</dt>
                  <dd className="font-black text-gold">{formatPrice(service.price)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">{t('booking.summaryWhen')}</dt>
                  <dd className="font-bold" dir="ltr">
                    {date} — {time}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fname">{t('booking.fields.firstName')}</Label>
              <Input
                id="fname"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onFocus={fillFromProfile}
                placeholder={t('booking.fields.firstNamePlaceholder')}
                className={errors.firstName ? 'border-rose-500' : ''}
              />
              {errors.firstName && <p className="mt-1 text-xs text-rose-400">{errors.firstName}</p>}
            </div>
            <div>
              <Label htmlFor="lname">{t('booking.fields.lastName')}</Label>
              <Input
                id="lname"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t('booking.fields.lastNamePlaceholder')}
                className={errors.lastName ? 'border-rose-500' : ''}
              />
              {errors.lastName && <p className="mt-1 text-xs text-rose-400">{errors.lastName}</p>}
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor="phone">{t('booking.fields.phone')}</Label>
            <Input
              id="phone"
              dir="ltr"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('booking.fields.phonePlaceholder')}
              className={errors.phone ? 'border-rose-500' : ''}
            />
            {errors.phone && <p className="mt-1 text-xs text-rose-400">{errors.phone}</p>}
          </div>

          <div className="mt-4">
            <Label htmlFor="note">{t('booking.fields.note')}</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('booking.fields.notePlaceholder')}
              maxLength={500}
            />
          </div>

          {/* Honeypot — مخفي تماماً */}
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="absolute -left-[9999px] opacity-0"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowRight className="h-4 w-4" /> {t('app.previous')}
            </Button>
            <Button variant="gold" size="lg" onClick={submit} disabled={submitting || settings?.booking_closed}>
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
              {submitting ? t('booking.submitting') : t('booking.submit')}
            </Button>
          </div>

          {!user && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {t('booking.loginHint')}{' '}
              <Link to="/login" className="text-gold underline">
                {t('nav.login')}
              </Link>
            </p>
          )}
        </div>
      )}

      {/* بديل رابط سريع للتتبع */}
      <div className="mt-8 text-center">
        <button className="text-xs text-muted-foreground underline" onClick={() => nav('/track')}>
          {t('home.trackOrder')}
        </button>
      </div>
    </div>
  );
}
