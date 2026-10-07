import { useState } from 'react';
import { Ban, Crown, Phone, Search, Star, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/i18n';
import { useCustomers } from '@/hooks/useQueries';
import { PageHeader, WhatsAppButton } from './shared';
import { EmptyState } from '@/components/common/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { saveCustomer } from '@/services/api/customers';
import type { Customer } from '@/types/models';
import { formatDateAr } from '@/lib/time';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function CustomersPage() {
  const t = useT();
  const [q, setQ] = useState('');
  const { data, isLoading, refetch } = useCustomers();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = (data ?? []).filter((c) =>
    q.trim() ? `${c.full_name} ${c.phone}`.includes(q.trim()) : true,
  );

  const patch = async (id: string, p: Partial<Customer>, okMsg?: string) => {
    setBusy(true);
    const r = await saveCustomer(id, p);
    setBusy(false);
    if (r.error) toast.error(t('errors.UNKNOWN'));
    else {
      if (okMsg) toast.success(okMsg);
      void refetch();
    }
  };

  const openNotes = (c: Customer) => {
    setEditing(c);
    setNotes(c.notes ?? '');
  };

  return (
    <div className="container py-5 animate-fade-in">
      <PageHeader
        title={t('admin.customers.title')}
        subtitle={`${t('admin.customers.total')}: ${data?.length ?? 0}`}
        actions={
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('admin.customers.search')}
              className="pr-9 sm:w-64"
            />
          </div>
        }
      />

      {isLoading ? (
        <ListSkeleton count={5} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users className="h-7 w-7" />} title={t('admin.customers.empty')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <Card
              key={c.id}
              className={cn('overflow-hidden transition-all hover:-translate-y-0.5', c.blocked && 'border-rose-500/40')}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-gold/25 to-copper/20 font-black text-gold">
                      <User className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="flex items-center gap-1.5 font-bold">
                        {c.full_name}
                        {c.vip && (
                          <Badge variant="gold">
                            <Crown className="h-3 w-3" /> {t('admin.customers.vip')}
                          </Badge>
                        )}
                        {c.blocked && <Badge variant="destructive">{t('admin.customers.blocked')}</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {c.phone}
                      </p>
                    </div>
                  </div>
                  <WhatsAppButton phone={c.phone} text={`مرحباً ${c.full_name} 👋`} label="" variant="ghost" />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="font-black text-gold">{c.visits}</p>
                    <p className="text-muted-foreground">{t('admin.customers.visits')}</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="font-black text-rose-400">{c.no_shows}</p>
                    <p className="text-muted-foreground">{t('status.no_show')}</p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <p className="font-bold text-[10px] leading-tight">
                      {c.last_visit_at ? formatDateAr(c.last_visit_at) : t('admin.customers.noVisits')}
                    </p>
                    <p className="text-muted-foreground">{t('admin.customers.lastVisit')}</p>
                  </div>
                </div>

                {c.notes && <p className="mt-2 rounded bg-muted/50 p-2 text-xs">{c.notes}</p>}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => openNotes(c)}>
                    <Star className="h-3.5 w-3.5" /> {t('admin.customers.notes')}
                  </Button>
                  <Button
                    size="sm"
                    variant={c.vip ? 'gold' : 'outline'}
                    disabled={busy}
                    onClick={() => patch(c.id, { vip: !c.vip }, c.vip ? undefined : t('admin.customers.markVip'))}
                  >
                    <Crown className="h-3.5 w-3.5" /> {c.vip ? t('admin.customers.removeVip') : t('admin.customers.markVip')}
                  </Button>
                  <Button
                    size="sm"
                    variant={c.blocked ? 'outline' : 'destructive'}
                    disabled={busy}
                    onClick={() => {
                      if (!c.blocked && !window.confirm(t('admin.customers.confirmBlock'))) return;
                      void patch(c.id, { blocked: !c.blocked });
                    }}
                  >
                    <Ban className="h-3.5 w-3.5" /> {c.blocked ? t('admin.customers.unblock') : t('admin.customers.block')}
                  </Button>
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-semibold text-muted-foreground hover:text-gold"
                  >
                    <Phone className="h-3.5 w-3.5" /> {t('admin.requests.callCustomer')}
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('admin.customers.notes')} — {editing?.full_name}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('admin.customers.notesPlaceholder')}
            maxLength={1000}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t('app.cancel')}
            </Button>
            <Button
              variant="gold"
              disabled={busy}
              onClick={async () => {
                if (!editing) return;
                await patch(editing.id, { notes: notes.trim() || null }, t('app.save'));
                setEditing(null);
              }}
            >
              {t('app.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
