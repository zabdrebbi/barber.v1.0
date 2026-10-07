import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Phone, Scissors, Sparkles, CalendarCheck, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';
import { useSettings, useServices } from '@/hooks/useQueries';
import { SALON_CONFIG } from '@/config/salon';
import { formatPrice } from '@/lib/utils';
import { ListSkeleton } from '@/components/ui/skeleton';
import { todayAlgiers, isoWeekday } from '@/lib/time';

export function HomePage() {
  const t = useT();
  const { data: settings } = useSettings();
  const { data: services, isLoading } = useServices(true);

  const wd = isoWeekday(new Date().toISOString());
  const todayCfg = SALON_CONFIG.workingHours[wd];
  const isOpenNow = Boolean(todayCfg) && !SALON_CONFIG.bookingClosed;

  const why = [
    { icon: CalendarCheck, title: t('home.why1Title'), text: t('home.why1Text') },
    { icon: Sparkles, title: t('home.why2Title'), text: t('home.why2Text') },
    { icon: Scissors, title: t('home.why3Title'), text: t('home.why3Text') },
  ];

  return (
    <div className="animate-fade-in">
      {/* البطل */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-gold/10 via-transparent to-transparent">
        <div className="container flex flex-col items-center gap-6 py-14 text-center sm:py-20">
          <Badge variant="gold" className="mb-1">
            <Sparkles className="h-3 w-3" /> {t('app.name')}
          </Badge>
          <h1 className="max-w-2xl text-3xl font-black leading-tight sm:text-5xl">
            <span className="text-gold-gradient">{t('home.heroTitle')}</span>
          </h1>
          <p className="max-w-xl text-muted-foreground sm:text-lg">{t('home.heroSubtitle')}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="gold">
              <Link to="/book">
                {t('home.bookNow')}
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/track">{t('home.trackOrder')}</Link>
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${isOpenNow ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className={isOpenNow ? 'text-emerald-400' : 'text-rose-400'}>
              {isOpenNow ? t('home.openNow') : t('home.closedNow')}
            </span>
          </div>
        </div>
      </section>

      {/* لماذا نحن */}
      <section className="container grid gap-4 py-10 sm:grid-cols-3">
        {why.map((w) => (
          <Card key={w.title} className="card-gold-edge bg-card/70">
            <CardContent className="pt-6 text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-b from-gold/25 to-copper/20 text-gold">
                <w.icon className="h-6 w-6" />
              </span>
              <p className="font-bold">{w.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{w.text}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* الخدمات */}
      <section className="container py-8">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-black text-gold-gradient">{t('home.servicesTitle')}</h2>
          <Button asChild variant="link" className="text-gold">
            <Link to="/book">{t('home.bookNow')}</Link>
          </Button>
        </div>
        {isLoading ? (
          <ListSkeleton count={4} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services?.map((s, i) => (
              <Card key={s.id} className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:border-gold/40">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-bold group-hover:text-gold">{s.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {s.duration_minutes} {t('home.minutes')}
                    </p>
                  </div>
                  <span className="text-lg font-black text-gold">{formatPrice(s.price)}</span>
                </CardContent>
                <div className="h-0.5 w-full bg-gradient-to-l from-transparent via-gold/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="sr-only">{i}</span>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ساعات العمل */}
      <section className="container grid gap-6 py-10 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 flex items-center gap-2 font-black text-gold">
              <Clock className="h-5 w-5" /> {t('home.hoursTitle')}
            </h3>
            <ul className="space-y-2 text-sm">
              {([1, 2, 3, 4, 5, 6, 7] as const).map((d) => {
                const cfg = SALON_CONFIG.workingHours[d];
                const names = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
                return (
                  <li key={d} className="flex justify-between border-b border-border/50 pb-1.5 last:border-0">
                    <span className={d === wd ? 'font-bold text-gold' : 'text-muted-foreground'}>{names[d - 1]}</span>
                    <span className={cfg ? 'font-semibold' : 'text-rose-400'}>
                      {cfg ? `${cfg.open} — ${cfg.close}` : t('home.closedDay')}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              {t('home.breakTime')}: 13:00 — 14:00
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 flex items-center gap-2 font-black text-gold">
              <MapPin className="h-5 w-5" /> {t('home.locationTitle')}
            </h3>
            <p className="text-sm text-muted-foreground">{settings?.address ?? SALON_CONFIG.address}</p>
            <a
              href={`tel:${(settings?.phone ?? SALON_CONFIG.phone).replace(/\s/g, '')}`}
              className="mt-3 flex items-center gap-2 text-sm font-semibold hover:text-gold"
            >
              <Phone className="h-4 w-4" /> {settings?.phone ?? SALON_CONFIG.phone}
            </a>
            {settings?.map_link ? (
              <Button asChild variant="outline" className="mt-4">
                <a href={settings.map_link} target="_blank" rel="noreferrer">
                  {t('home.mapLink')}
                </a>
              </Button>
            ) : null}
            <Button asChild variant="gold" className="mt-4 w-full">
              <Link to="/book">{t('home.bookNow')}</Link>
            </Button>
            <p className="mt-3 text-[11px] text-muted-foreground">{todayAlgiers()}</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
