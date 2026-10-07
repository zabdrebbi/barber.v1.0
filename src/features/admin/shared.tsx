import type { ReactNode } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { phoneToWaMe } from '@/lib/phone';
import { useT } from '@/i18n';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-black text-gold-gradient sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'gold',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: 'gold' | 'green' | 'red' | 'blue' | 'purple';
}) {
  const tones = {
    gold: 'from-gold/20 to-copper/10 text-gold',
    green: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400',
    red: 'from-rose-500/20 to-rose-500/5 text-rose-400',
    blue: 'from-sky-500/20 to-sky-500/5 text-sky-400',
    purple: 'from-purple-500/20 to-purple-500/5 text-purple-400',
  };
  return (
    <Card className="card-gold-edge overflow-hidden transition-all hover:-translate-y-0.5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-black">{value}</p>
            {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
          </div>
          {icon && (
            <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-b', tones[tone])}>
              {icon}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function WhatsAppButton({
  phone,
  text,
  label,
  size = 'sm',
  variant = 'success',
}: {
  phone: string;
  text: string;
  label?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'success' | 'outline' | 'ghost';
}) {
  const t = useT();
  const url = `https://wa.me/${phoneToWaMe(phone)}?text=${encodeURIComponent(text)}`;
  return (
    <Button asChild size={size} variant={variant}>
      <a href={url} target="_blank" rel="noreferrer" title={label ?? t('admin.requests.openWhatsapp')}>
        <MessageCircle className="h-4 w-4" />
        {label ?? t('admin.requests.openWhatsapp')}
      </a>
    </Button>
  );
}

/** تنبيه صوتي لطلب جديد (WebAudio — بلا ملفات) */
export function playNewRequestSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.3);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch {
    /* الصوت غير متاح */
  }
}

export function SendIcon() {
  return <Send className="h-4 w-4" />;
}
