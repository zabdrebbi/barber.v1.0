import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Scissors, CalendarPlus, MapPin, Phone, LogOut, User, CalendarCheck, Home, Menu, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useQueries';
import { SALON_CONFIG } from '@/config/salon';
import { cn } from '@/lib/utils';
import { InstallPwa } from '@/components/common/install-pwa';
import { NotificationBell } from '@/components/common/notification-bell';

function Brand({ compact = false }: { compact?: boolean }) {
  const t = useT();
  return (
    <Link to="/" className="flex items-center gap-2.5 group">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-b from-gold-soft to-gold-deep text-black shadow-lg shadow-gold/20 transition-transform group-hover:scale-105">
        <Scissors className="h-5 w-5" />
      </span>
      <span className={cn('flex flex-col leading-tight', compact && 'hidden sm:flex')}>
        <span className="font-extrabold tracking-tight text-gold-gradient">{t('app.name')}</span>
        <span className="text-[10px] text-muted-foreground">{t('home.tagline')}</span>
      </span>
    </Link>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const t = useT();
  const { user, isAdmin, signOut } = useAuth();
  const { data: settings } = useSettings();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const links = [
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/book', label: t('nav.book'), icon: CalendarPlus },
    { to: '/track', label: t('nav.track'), icon: CalendarCheck },
    ...(user ? [{ to: '/my-appointments', label: t('nav.myAppointments'), icon: CalendarCheck }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-salon">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between">
          <Brand />
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                    isActive ? 'bg-accent text-gold' : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <NotificationBell />
            {isAdmin && (
              <Button asChild size="sm" variant="gold" className="hidden sm:inline-flex">
                <Link to="/admin">{t('nav.admin')}</Link>
              </Button>
            )}
            {user ? (
              <Button size="sm" variant="ghost" onClick={() => { signOut(); nav('/'); }} className="hidden sm:inline-flex">
                <LogOut className="h-4 w-4" />
                {t('nav.logout')}
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                <Link to="/login">
                  <User className="h-4 w-4" />
                  {t('nav.login')}
                </Link>
              </Button>
            )}
            <button
              className="flex h-9 w-9 items-center justify-center rounded-md border md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label={t('nav.menu')}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t bg-background md:hidden animate-fade-in">
            <div className="container flex flex-col gap-1 py-3">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold',
                      isActive ? 'bg-accent text-gold' : 'text-muted-foreground',
                    )
                  }
                >
                  <l.icon className="h-4 w-4" />
                  {l.label}
                </NavLink>
              ))}
              <div className="my-1 h-px bg-border" />
              {isAdmin && (
                <NavLink to="/admin" onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-bold text-gold">
                  {t('nav.admin')}
                </NavLink>
              )}
              {user ? (
                <button
                  onClick={() => {
                    signOut();
                    setOpen(false);
                    nav('/');
                  }}
                  className="rounded-md px-3 py-2.5 text-right text-sm font-semibold text-muted-foreground"
                >
                  {t('nav.logout')}
                </button>
              ) : (
                <NavLink to="/login" onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 text-sm font-semibold">
                  {t('nav.login')}
                </NavLink>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <InstallPwa />

      <footer className="border-t bg-card/60 mt-12">
        <div className="container grid gap-6 py-8 sm:grid-cols-3">
          <div>
            <Brand compact />
            <p className="mt-3 text-sm text-muted-foreground">{settings?.address ?? SALON_CONFIG.address}</p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-bold text-gold">{t('home.hoursTitle')}</p>
            <p className="text-muted-foreground">
              السبت – الخميس: 09:00 — 20:00
              <br />
              الجمعة: {t('home.closedDay')} • {t('home.breakTime')} 13:00 – 14:00
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <a href={`tel:${(settings?.phone ?? SALON_CONFIG.phone).replace(/\s/g, '')}`} className="flex items-center gap-2 text-muted-foreground hover:text-gold">
              <Phone className="h-4 w-4" />
              {settings?.phone ?? SALON_CONFIG.phone}
            </a>
            <span className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {settings?.address ?? SALON_CONFIG.address}
            </span>
          </div>
        </div>
        <div className="border-t py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {settings?.name ?? SALON_CONFIG.name} — {t('home.footerRights')}
        </div>
      </footer>
    </div>
  );
}
