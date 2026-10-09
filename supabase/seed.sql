-- ============================================================
-- بيانات أولية (Seed): إعدادات، ساعات عمل، خدمات، قوالب، حجوزات تجريبية
-- ضبط بريد الحلاق: عدّل السطر التالي قبل التنفيذ:
--   update public.app_secrets set value = 'you@gmail.com' where key = 'admin_email';
-- ============================================================

insert into public.app_secrets (key, value) values ('admin_email', 'z.abdrebbi@gmail.com')
on conflict (key) do nothing;

insert into public.settings (id, name, phone, address, map_link, booking_closed,
  default_duration_minutes, gap_minutes, max_advance_days, theme)
values ('main', 'صالون الأناقة', '+213 555 00 00 00', 'الشارع الرئيسي', '', false, 30, 0, 30, 'dark')
on conflict (id) do nothing;

-- 1=الاثنين … 7=الأحد — الجمعة (5) مغلقة
insert into public.working_hours (weekday, is_open, open_time, close_time, breaks) values
  (1, true,  '09:00', '20:00', '[{"start":"13:00","end":"14:00"}]'::jsonb),
  (2, true,  '09:00', '20:00', '[{"start":"13:00","end":"14:00"}]'::jsonb),
  (3, true,  '09:00', '20:00', '[{"start":"13:00","end":"14:00"}]'::jsonb),
  (4, true,  '09:00', '20:00', '[{"start":"13:00","end":"14:00"}]'::jsonb),
  (5, false, '09:00', '20:00', '[]'::jsonb),
  (6, true,  '09:00', '20:00', '[{"start":"13:00","end":"14:00"}]'::jsonb),
  (7, true,  '09:00', '20:00', '[{"start":"13:00","end":"14:00"}]'::jsonb)
on conflict (weekday) do nothing;

insert into public.services (name, name_en, price, duration_minutes, active, sort_order) values
  ('قص شعر',      'Haircut',     800, 30, true, 1),
  ('حلاقة لحية',  'Beard trim',  500, 20, true, 2),
  ('قص + لحية',   'Cut & beard', 1200, 45, true, 3),
  ('حلاقة رأس',   'Head shave',  600, 20, true, 4),
  ('قص أطفال',    'Kids haircut', 600, 30, true, 5)
on conflict do nothing;

insert into public.notification_templates (key, channel, title, body) values
 ('pending','whatsapp','استلمنا طلبك','مرحباً {name}،
استلمنا طلبك لخدمة «{service}» يوم {date} على الساعة {time}.
سنوافق عليه قريباً وسنبلغك عبر واتساب.
{salon} — {address}'),
 ('accepted_awaiting_schedule','whatsapp','تم قبول طلبك','مرحباً {name}،
تم قبول طلبك لخدمة «{service}» يوم {date}.
سنحدد لك الوقت المناسب قريباً.
{salon} — {address}
تتبّع طلبك: {link}'),
 ('scheduled','whatsapp','تم تأكيد موعدك','مرحباً {name}،
تم تأكيد موعدك: {service}
اليوم: {date}
الوقت: {time}
{salon} — {address}
تتبّع طلبك: {link}'),
 ('rescheduled','whatsapp','تم تعديل موعدك','مرحباً {name}،
تم تعديل موعدك لخدمة «{service}».
الموعد الجديد: {date} على الساعة {time}
{salon} — {address}
تتبّع طلبك: {link}'),
 ('rejected','whatsapp','لم نتمكن من تأكيد موعدك','مرحباً {name}،
عذراً، لم نتمكن من تأكيد موعدك يوم {date}.
السبب: {reason}
يمكنك اختيار وقت آخر متاح.
تتبّع طلبك: {link}'),
 ('cancelled','whatsapp','تم إلغاء الموعد','مرحباً {name}،
تم إلغاء موعدك يوم {date} على الساعة {time}.
يمكنك الحجز في وقت آخر متى شئت.
{salon} — {address}'),
 ('completed','whatsapp','شكراً لزيارتك','مرحباً {name}،
نتمنى أن تكون إطلالتك جديدة! إذا أعجبتك الخدمة شاركها مع أصدقائك.
{salon} — {address}'),
 ('no_show','whatsapp','لم نرك اليوم','مرحباً {name}،
لقد تفاجأنا بغيابك عن موعدك يوم {date}.
تواصل معنا إن كان لديك عذر أو احجز موعداً جديداً.'),
 ('reminder','whatsapp','تذكير بموعدك','مرحباً {name}،
تذكير ودّي: موعدك لخدمة «{service}» اليوم {date} على الساعة {time}.
نتنتظرك في {salon} — {address}')
on conflict (key, channel) do nothing;

-- نسخ القوالب للإشعار داخل التطبيق
insert into public.notification_templates (key, channel, title, body)
select key, 'in_app', title, body from public.notification_templates
where channel = 'whatsapp'
on conflict (key, channel) do nothing;

-- حجوزات تجريبية (زوار — يمكن ربطها لاحقاً)
do $$
declare
  v_svc uuid;
  v_t date := (now() at time zone 'Africa/Algiers')::date;
begin
  select id into v_svc from public.services where name = 'قص شعر' limit 1;

  insert into public.appointments
    (customer_name, customer_lastname, phone, service_id, scheduled_at, ends_at, status, is_guest, source)
  values
    ('رضا','شريف','0777444555', v_svc, (v_t + 1) at time zone 'Africa/Algiers' + interval '10 hour', (v_t + 1) at time zone 'Africa/Algiers' + interval '10 hour 30 minutes', 'pending', true, 'web'),
    ('محمد الأمين','سعداوي','0555777333', v_svc, (v_t + 1) at time zone 'Africa/Algiers' + interval '12 hour', (v_t + 1) at time zone 'Africa/Algiers' + interval '12 hour 30 minutes', 'pending', true, 'web'),
    ('سفيان','مرابط','0555999888', v_svc, (v_t + 1) at time zone 'Africa/Algiers' + interval '11 hour', (v_t + 1) at time zone 'Africa/Algiers' + interval '11 hour 30 minutes', 'scheduled', true, 'web')
  on conflict do nothing;
end $$;

insert into public.customers (phone, full_name) values
  ('0777444555','رضا شريف'),
  ('0555777333','محمد الأمين سعداوي'),
  ('0555999888','سفيان مرابط')
on conflict (phone) do nothing;
