import { useState } from 'react';
import { Clock, Plus, Power, Scissors, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/i18n';
import { useServices } from '@/hooks/useQueries';
import { PageHeader } from './shared';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { saveService, softDeleteService } from '@/services/api/catalog';
import { serviceZod } from '@/services/domain/schemas';
import type { Service } from '@/types/models';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';

interface FormState {
  id?: string;
  name: string;
  name_en: string;
  price: string;
  duration_minutes: string;
  sort_order: string;
  active: boolean;
}

const emptyForm: FormState = { name: '', name_en: '', price: '', duration_minutes: '30', sort_order: '0', active: true };

export function ServicesPage() {
  const t = useT();
  const { data, isLoading, refetch } = useServices(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const openEdit = (s?: Service) => {
    setForm(
      s
        ? {
            id: s.id,
            name: s.name,
            name_en: s.name_en ?? '',
            price: String(s.price),
            duration_minutes: String(s.duration_minutes),
            sort_order: String(s.sort_order),
            active: s.active,
          }
        : { ...emptyForm, sort_order: String((data?.length ?? 0) + 1) },
    );
    setErrors({});
    setOpen(true);
  };

  const save = async () => {
    const parsed = serviceZod.safeParse({
      name: form.name,
      name_en: form.name_en || null,
      price: Number(form.price),
      duration_minutes: Number(form.duration_minutes),
      active: form.active,
      sort_order: Number(form.sort_order),
    });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (e[String(i.path[0])] = i.message));
      setErrors(e);
      return;
    }
    setBusy(true);
    const r = await saveService({ ...(form.id ? { id: form.id } : {}), ...parsed.data });
    setBusy(false);
    if (r.error) toast.error(t('errors.UNKNOWN'));
    else {
      toast.success(t('admin.services.saveOk'));
      setOpen(false);
      void refetch();
    }
  };

  const toggleActive = async (s: Service) => {
    if (s.active && !window.confirm(t('admin.services.confirmDeactivate'))) return;
    setBusy(true);
    const r = await saveService({ ...s, active: !s.active });
    setBusy(false);
    if (r.error) toast.error(t('errors.UNKNOWN'));
    else void refetch();
  };

  return (
    <div className="container py-5 animate-fade-in">
      <PageHeader
        title={t('admin.services.title')}
        actions={
          <Button variant="gold" size="sm" onClick={() => openEdit()}>
            <Plus className="h-4 w-4" /> {t('admin.services.add')}
          </Button>
        }
      />

      {isLoading ? (
        <ListSkeleton count={4} />
      ) : !data?.length ? (
        <EmptyState icon={<Scissors className="h-7 w-7" />} title={t('admin.services.empty')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => (
            <Card key={s.id} className={s.active ? 'card-gold-edge' : 'opacity-60'}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{s.name}</p>
                    {s.name_en && <p className="text-xs text-muted-foreground" dir="ltr">{s.name_en}</p>}
                  </div>
                  {!s.active && <Badge variant="muted">{t('app.inactive')}</Badge>}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xl font-black text-gold">{formatPrice(s.price)}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {s.duration_minutes} {t('home.minutes')}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Power className="h-3.5 w-3.5" />
                    <Switch checked={s.active} onCheckedChange={() => toggleActive(s)} disabled={busy} />
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                      {t('app.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!window.confirm(t('app.delete'))) return;
                        await softDeleteService(s.id);
                        void refetch();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? t('admin.services.edit') : t('admin.services.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('admin.services.name')}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {errors.name && <p className="text-xs text-rose-400">{errors.name}</p>}
            </div>
            <div>
              <Label>{t('admin.services.nameEn')}</Label>
              <Input dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>{t('admin.services.price')}</Label>
                <Input
                  type="number"
                  dir="ltr"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
                {errors.price && <p className="text-xs text-rose-400">{errors.price}</p>}
              </div>
              <div>
                <Label>{t('admin.services.duration')}</Label>
                <Input
                  type="number"
                  dir="ltr"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                />
                {errors.duration_minutes && <p className="text-xs text-rose-400">{errors.duration_minutes}</p>}
              </div>
              <div>
                <Label>{t('admin.services.sortOrder')}</Label>
                <Input
                  type="number"
                  dir="ltr"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <span className="text-sm font-semibold">{t('app.active')}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('app.cancel')}
            </Button>
            <Button variant="gold" onClick={save} disabled={busy}>
              {t('app.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
