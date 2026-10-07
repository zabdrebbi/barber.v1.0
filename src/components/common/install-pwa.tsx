import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/button';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** شريط تثبيت PWA */
export function InstallPwa() {
  const t = useT();
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('pwa_dismissed') === '1');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      if (!sessionStorage.getItem('pwa_dismissed')) setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible || !deferred || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border bg-card p-4 shadow-2xl animate-fade-in lg:bottom-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-gold-soft to-gold-deep text-black">
          <Download className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold">{t('pwa.install')}</p>
          <p className="text-xs text-muted-foreground">{t('pwa.installHint')}</p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="gold"
              onClick={() => {
                void deferred.prompt();
                setVisible(false);
              }}
            >
              {t('pwa.install')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDismissed(true);
                sessionStorage.setItem('pwa_dismissed', '1');
              }}
            >
              {t('pwa.dismiss')}
            </Button>
          </div>
        </div>
        <button onClick={() => setVisible(false)} className="text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
