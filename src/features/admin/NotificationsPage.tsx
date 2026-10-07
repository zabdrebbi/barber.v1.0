import { useMemo, useState } from 'react';
import { Bell, CheckCircle, Globe, Mail, MessageCircle, Radio, Smartphone, Save, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useT } from '@/i18n';
import { useLogs, useSettings, useTemplates } from '@/hooks/useQueries';
import { PageHeader, WhatsAppButton } from './shared';
import { EmptyState } from '@/components/common/empty-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { saveTemplate } from '@/services/api/notifications';
import { DEFAULT_TEMPLATES, fillTemplate, type TemplateKey } from '@/services/domain/templates';
import type { NotificationTemplate } from '@/types/models';
import { formatDateTimeAr, formatDateAr, formatTimeAr } from '@/lib/time';
import { toast } from 'sonner';
import { listChannels } from '@/services/abstractions/notification-channels';

const KEYS: TemplateKey[] = [
  'pending',
  'accepted_awaiting_schedule',
  'scheduled',
  'rescheduled',
  'rejected',
  'cancelled',
  'completed',
  'no_show',
  'reminder',
];

export function NotificationsPage() {
  const t = useT();
  const { data: templates, isLoading, refetch } = useTemplates();
  const { data: logs } = useLogs();
  const { data: settings } = useSettings();
  const [channel, setChannel] = useState<'whatsapp' | 'in_app'>('whatsapp');
  const [key, setKey] = useState<string>('scheduled');
  const [draft, setDraft] = useState<{ id: string; title: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reminderOn, setReminderOn] = useState(true);
  const [reminderLead, setReminderLead] = useState('2');

  const current = useMemo(
    () => templates?.find((x) => x.key === key && x.channel === channel),
    [templates, key, channel],
  );

  const effective = draft && draft.id === current?.id ? draft : current ? { id: current.id, title: current.title, body: current.body } : null;

  const previewVars = {
    name: 'محمد',
    date: formatDateAr(new Date(), { weekday: true }),
    time: formatTimeAr(new Date()),
    service: 'قص شعر',
    salon: settings?.name ?? 'صالون الأناقة',
    address: settings?.address ?? 'الشارع الرئيسي',
    link: 'https://…/track?t=xxxx',
    status: 'scheduled',
    phone: '0555000000',
    reason: 'الصالون مزدحم',
  };

  const save = async () => {
    if (!current || !draft) return;
    setBusy(true);
    const r = await saveTemplate(current.id, { title: draft.title, body: draft.body });
    setBusy(false);
    if (r.error) toast.error(t('errors.UNKNOWN'));
    else {
      toast.success(t('admin.notifications.saved'));
      setDraft(null);
      void refetch();
    }
  };

  const channels = [
    { id: 'whatsapp', label: t('admin.notifications.whatsappChannel'), icon: MessageCircle },
    { id: 'in_app', label: t('admin.notifications.inAppChannel'), icon: Radio },
    { id: 'sms', label: t('admin.notifications.smsChannel'), icon: Smartphone },
    { id: 'email', label: t('admin.notifications.emailChannel'), icon: Mail },
    { id: 'push', label: t('admin.notifications.pushChannel'), icon: Bell },
  ];

  return (
    <div className="container py-5 animate-fade-in">
      <PageHeader title={t('admin.notifications.title')} subtitle={t('admin.notifications.channelsSoon')} />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {channels.map((c) => {
          const registered = listChannels().some((x) => x.id === c.id);
          const configured = registered && c.id !== 'whatsapp' ? true : Boolean(import.meta.env.VITE_WHATSAPP_PHONE_ID);
          return (
            <Card key={c.id} className={configured ? 'border-gold/40' : ''}>
              <CardContent className="flex items-center gap-2 p-3">
                <c.icon className="h-4 w-4 text-gold" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{c.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {configured ? t('admin.notifications.configured') : t('admin.notifications.notConfigured')}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">{t('admin.notifications.templatesTitle')}</TabsTrigger>
          <TabsTrigger value="logs">{t('admin.notifications.logsTitle')}</TabsTrigger>
          <TabsTrigger value="reminders">{t('admin.notifications.remindersTitle')}</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  <Globe className="inline h-4 w-4" /> {t('admin.notifications.templatesTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Select value={channel} onValueChange={(v) => setChannel(v as 'whatsapp' | 'in_app')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">{t('admin.notifications.whatsappChannel')}</SelectItem>
                      <SelectItem value="in_app">{t('admin.notifications.inAppChannel')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={key} onValueChange={setKey}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KEYS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {t(`status.${k}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isLoading ? (
                  <ListSkeleton count={2} />
                ) : !effective ? (
                  <EmptyState title={t('app.empty')} />
                ) : (
                  <>
                    <div>
                      <Label>{t('admin.notifications.titleField')}</Label>
                      <Input
                        value={effective.title}
                        onChange={(e) => setDraft({ ...effective, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>{t('admin.notifications.message')}</Label>
                      <Textarea
                        rows={7}
                        value={effective.body}
                        onChange={(e) => setDraft({ ...effective, body: e.target.value })}
                      />
                    </div>
                    <p className="rounded bg-muted/50 p-2 text-[11px] leading-5 text-muted-foreground">
                      {t('admin.notifications.templatesHint')}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="gold" onClick={save} disabled={busy || !draft}>
                        <Save className="h-4 w-4" /> {t('app.save')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          current && setDraft({ id: current.id, title: DEFAULT_TEMPLATES[key as TemplateKey].title, body: DEFAULT_TEMPLATES[key as TemplateKey].body })
                        }
                      >
                        <Zap className="h-4 w-4" /> {t('app.retry')}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t('admin.notifications.preview')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border bg-[#075e54]/10 p-4">
                  <div className="rounded-xl bg-card p-3 shadow">
                    <p className="mb-1 text-xs font-black text-gold">
                      {fillTemplate(effective?.title ?? '', previewVars)}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-6">
                      {fillTemplate(effective?.body ?? '', previewVars)}
                    </p>
                    <p className="mt-2 text-left text-[10px] text-muted-foreground">✓✓</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t('admin.notifications.previewFor', { name: 'محمد' })}</p>
                <div className="rounded-md bg-muted/50 p-3 text-xs">
                  <p className="mb-1 font-bold">{t('status.scheduled')}</p>
                  <p className="whitespace-pre-wrap">{DEFAULT_TEMPLATES.scheduled.body}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardContent className="p-0">
              {!logs?.length ? (
                <EmptyState title={t('admin.notifications.emptyLogs')} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-right text-xs text-muted-foreground">
                        <th className="p-3">{t('app.status')}</th>
                        <th className="p-3">{t('admin.notifications.channel')}</th>
                        <th className="p-3">{t('admin.notifications.titleField')}</th>
                        <th className="p-3">{t('booking.fields.phone')}</th>
                        <th className="p-3">{t('app.date')}</th>
                        <th className="p-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((l) => (
                        <tr key={l.id} className="border-b border-border/50 text-xs">
                          <td className="p-3">
                            <Badge variant={l.status === 'sent' ? 'success' : l.status === 'failed' ? 'destructive' : 'muted'}>
                              {l.status}
                            </Badge>
                          </td>
                          <td className="p-3">{l.channel}</td>
                          <td className="p-3">{l.template_key}</td>
                          <td className="p-3" dir="ltr">{l.to_phone}</td>
                          <td className="p-3">{formatDateTimeAr(l.created_at)}</td>
                          <td className="p-3">
                            {typeof l.payload?.text === 'string' && l.to_phone && (
                              <WhatsAppButton
                                phone={l.to_phone}
                                text={String(l.payload.text)}
                                label=""
                                variant="ghost"
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders">
          <Card className="max-w-lg">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <Label>{t('admin.notifications.remindersOn')}</Label>
                <Switch checked={reminderOn} onCheckedChange={setReminderOn} />
              </div>
              <div>
                <Label>{t('admin.notifications.reminderLead')}</Label>
                <Input
                  type="number"
                  dir="ltr"
                  className="w-32"
                  value={reminderLead}
                  onChange={(e) => setReminderLead(e.target.value)}
                />
              </div>
              <div className="rounded-md border border-gold/30 bg-gold/5 p-3 text-xs text-muted-foreground">
                <CheckCircle className="inline h-4 w-4 text-gold" /> {t('admin.notifications.channelsSoon')}
                <br />
                Cron: <code dir="ltr">supabase functions invoke send-reminders</code>
              </div>
              <Button variant="gold" onClick={() => toast.success(t('app.save'))}>
                <Save className="h-4 w-4" /> {t('app.save')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
