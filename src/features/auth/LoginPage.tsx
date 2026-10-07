import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Loader2, Scissors, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useT } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function LoginPage() {
  const t = useT();
  const { signInWithGoogle, user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const doSignIn = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
      const dest = location.state?.from ?? '/my-appointments';
      nav(dest, { replace: true });
    } catch (e) {
      toast.error(t('auth.failed'));
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="container flex min-h-[70vh] max-w-md flex-col items-center justify-center py-10 text-center">
        <Card className="w-full">
          <CardContent className="p-6">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-soft to-gold-deep text-black">
              <User className="h-7 w-7" />
            </span>
            <p className="font-black text-gold">{t('auth.welcome', { name: user.user_metadata?.full_name ?? user.email ?? '' })}</p>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button asChild variant="gold">
                <Link to="/my-appointments">{t('nav.myAppointments')}</Link>
              </Button>
              <Button variant="outline" onClick={() => { signOut(); nav('/'); }}>
                {t('nav.logout')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container flex min-h-[70vh] max-w-md flex-col items-center justify-center py-10 animate-fade-in">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-gold-soft to-gold-deep text-black shadow-xl shadow-gold/20">
        <Scissors className="h-8 w-8" />
      </span>
      <h1 className="text-2xl font-black">{t('auth.title')}</h1>
      <p className="mb-6 mt-2 text-center text-sm text-muted-foreground">{t('auth.subtitle')}</p>

      <Card className="w-full">
        <CardContent className="flex flex-col gap-3 p-6">
          <Button variant="gold" size="lg" onClick={doSignIn} disabled={busy}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {busy ? t('auth.signingIn') : t('auth.google')}
          </Button>
          <Button asChild variant="ghost">
            <Link to="/">{t('auth.continueAsGuest')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/book">{t('nav.book')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
