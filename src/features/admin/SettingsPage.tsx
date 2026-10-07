import { useEffect, useState } from 'react';
import { KeyRound, Moon, Save, Shield, Sun, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';
import { useRoles, useSettings } from '@/hooks/useQueries';
import { PageHeader } from './shared';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { saveSettings } from '@/services/api/catalog';
import { settingsZod } from '@/services/domain/schemas';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';
import { supabaseEnabled } from '@/lib/supabase';
import { resetDemo } from '@/services/demo/store';

export function SettingsPage() {
  const t = useT();
  const { data: settings, refetch, isLoading } = useSettings();
  const { data: roles, isLoading: rolesLoading, refetch: refetchRoles } = useRoles();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    map_link: '',
    logo_url: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        name: settings.name,
        phone: settings.phone,
        address: settings.address,
        map_link: settings.map_link,
        logo_url: settings.logo_url ?? '',
      });
    }
  }, [settings]);

  const save = async () => {
    const parsed = settingsZod.safeParse({
      ...(settings ?? {}),
      ...form,
      logo_url: form.logo_url || null,
    });
    if (!parsed.success) {
      toast.error(`VALIDATION: ${parsed.error.issues[0]?.path.join('.')}`);
      return;
    }
    setBusy(true);
    const r = await saveSettings(parsed.data);
    setBusy(false);
    if (r.error) toast.error(r.error);
    else {
      toast.success(t('admin.settings.saved'));
      void refetch();
    }
  };

  return (
    <div className="container py-5 animate-fade-in">
      <PageHeader title={t('admin.settings.title')} />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* معلومات الصالون */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('admin.settings.salonInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <ListSkeleton count={3} />
            ) : (
              <>
                <div>
                  <Label>{t('admin.settings.salonName')}</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>{t('admin.settings.phone')}</Label>
                  <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <Label>{t('admin.settings.address')}</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div>
                  <Label>{t('admin.settings.mapLink')}</Label>
                  <Input
                    dir="ltr"
                    placeholder="https://maps.google.com/…"
                    value={form.map_link}
                    onChange={(e) => setForm({ ...form, map_link: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t('admin.settings.logo')}</Label>
                  <Input
                    dir="ltr"
                    placeholder="https://…/logo.png"
                    value={form.logo_url}
                    onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  />
                </div>
                <Button variant="gold" onClick={save} disabled={busy}>
                  <Save className="h-4 w-4" /> {t('app.saveChanges')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          {/* المظهر */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {theme === 'dark' ? <Moon className="inline h-4 w-4" /> : <Sun className="inline h-4 w-4" />}{' '}
                {t('admin.settings.appearance')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button
                variant={theme === 'dark' ? 'gold' : 'outline'}
                onClick={() => setTheme('dark')}
                className="flex-1"
              >
                🌙 {t('admin.settings.dark')}
              </Button>
              <Button
                variant={theme === 'light' ? 'gold' : 'outline'}
                onClick={() => setTheme('light')}
                className="flex-1"
              >
                ☀️ {t('admin.settings.light')}
              </Button>
            </CardContent>
          </Card>

          {/* الأدوار */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <Shield className="inline h-4 w-4" /> {t('admin.settings.roles')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                <KeyRound className="inline h-3.5 w-3.5" /> {t('admin.settings.rolesHint')}
                {!supabaseEnabled && ` — ${t('app.demoMode')}`}
              </p>
              {rolesLoading ? (
                <ListSkeleton count={2} />
              ) : !roles?.length ? (
                <EmptyState title={t('admin.settings.noRoles')} />
              ) : (
                <ul className="space-y-2">
                  {roles.map((r) => (
                    <li key={`${r.user_id}-${r.role}`} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{r.full_name ?? r.email ?? r.user_id}</p>
                        <p className="truncate text-xs text-muted-foreground" dir="ltr">
                          {r.email ?? r.user_id}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.role === 'admin' ? 'gold' : 'secondary'}>
                          <UserCog className="h-3 w-3" /> {r.role}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{r.granted_at.slice(0, 10)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* منطقة الخطر */}
          <Card className="border-rose-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-rose-400">{t('admin.settings.dangerZone')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={() => {
                  if (window.confirm(t('app.confirm'))) {
                    resetDemo();
                    toast.success(t('app.done'));
                    window.location.reload();
                  }
                }}
              >
                {t('admin.settings.resetDemo')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
