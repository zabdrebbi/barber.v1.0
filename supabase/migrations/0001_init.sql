-- ============================================================
-- صالون الأناقة — البناء الكامل لقاعدة البيانات (Supabase)
-- المرحلة 1: المخطط، الأدوار، RLS، منع التعارض، آلة الحالات
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ------------------------- التعدادات -------------------------
create type app_role as enum ('admin', 'staff', 'customer');
create type appointment_status as enum (
  'pending', 'accepted_awaiting_schedule', 'scheduled',
  'rejected', 'cancelled', 'completed', 'no_show'
);

-- ------------------------- الملفات ---------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  avatar_url  text,
  locale      text not null default 'ar',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ------------------------- الأدوار ---------------------------
create table public.user_roles (
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        app_role not null,
  email       text,
  full_name   text,
  granted_by  uuid,
  granted_at  timestamptz not null default now(),
  primary key (user_id, role)
);
create index user_roles_role_idx on public.user_roles(role);

-- أسرار الخادم (لا قراءة للعميل إطلاقاً) — ADMIN_EMAIL يُخزَّن هنا
create table public.app_secrets (
  key   text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;

-- حدود المعدل (Rate limiting) — يديرها الخادم فقط
create table public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);
alter table public.rate_limits enable row level security;

-- ------------------------ الخدمات ---------------------------
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  name_en          text,
  price            integer not null check (price >= 0),
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  active           boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index services_active_idx on public.services(active) where deleted_at is null;

-- ------------------------ الزبائن ----------------------------
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null unique,
  full_name     text not null default '',
  visits        integer not null default 0,
  no_shows      integer not null default 0,
  last_visit_at timestamptz,
  notes         text,
  vip           boolean not null default false,
  blocked       boolean not null default false,
  user_id       uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index customers_phone_idx on public.customers(phone);
create index customers_user_idx on public.customers(user_id);

-- ----------------------- المواعيد ----------------------------
create table public.appointments (
  id                    uuid primary key default gen_random_uuid(),
  tracking_token        text not null unique default encode(gen_random_bytes(32), 'hex'),
  user_id               uuid references auth.users(id) on delete set null,
  customer_id           uuid references public.customers(id) on delete set null,
  service_id            uuid not null references public.services(id),
  customer_name         text not null,
  customer_lastname     text not null,
  phone                 text not null,
  scheduled_at          timestamptz not null,
  ends_at               timestamptz not null,
  original_scheduled_at timestamptz,
  status                appointment_status not null default 'pending',
  note                  text,
  reject_reason         text,
  change_request_note   text,
  is_guest              boolean not null default false,
  staff_id              uuid,               -- للتوسع (موظفون لاحقاً)
  branch_id             uuid,               -- للتوسع (تعدد الفروع)
  source                text not null default 'web' check (source in ('web','walk_in','phone')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

create index appointments_status_idx    on public.appointments(status);
create index appointments_scheduled_idx on public.appointments(scheduled_at);
create index appointments_phone_idx     on public.appointments(phone);
create index appointments_user_idx      on public.appointments(user_id);
create index appointments_service_idx   on public.appointments(service_id);
create index appointments_token_idx     on public.appointments(tracking_token);

-- منع الحجز المزدوج على مستوى قاعدة البيانات (exclusion constraint)
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    tstzrange(scheduled_at, ends_at, '[)') with &&
  )
  where (status in ('pending','accepted_awaiting_schedule','scheduled') and deleted_at is null);

-- ------------------- سجل تغييرات الحالة ---------------------
create table public.appointment_status_history (
  id                 uuid primary key default gen_random_uuid(),
  appointment_id     uuid not null references public.appointments(id) on delete cascade,
  from_status        appointment_status,
  to_status          appointment_status not null,
  changed_by         uuid,
  actor_role         text not null default 'system' check (actor_role in ('system','admin','customer','guest')),
  reason             text,
  from_scheduled_at  timestamptz,
  to_scheduled_at    timestamptz,
  created_at         timestamptz not null default now()
);
create index status_history_appt_idx on public.appointment_status_history(appointment_id, created_at);

-- --------------------- ساعات العمل --------------------------
create table public.working_hours (
  id         uuid primary key default gen_random_uuid(),
  weekday    smallint not null unique check (weekday between 1 and 7),
  is_open    boolean not null default true,
  open_time  time not null default '09:00',
  close_time time not null default '20:00',
  breaks     jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.time_off (
  id         uuid primary key default gen_random_uuid(),
  starts_at  date not null,
  ends_at    date not null,
  reason     text,
  all_day    boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);

-- ------------------- قوالب الإشعارات ------------------------
create table public.notification_templates (
  id         uuid primary key default gen_random_uuid(),
  key        text not null,
  channel    text not null check (channel in ('whatsapp','in_app','sms','email')),
  title      text not null,
  body       text not null,
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (key, channel)
);

create table public.notification_logs (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid references public.appointments(id) on delete set null,
  channel         text not null,
  template_key    text not null,
  to_phone        text,
  to_user_id      uuid,
  payload         jsonb not null default '{}'::jsonb,
  status          text not null default 'queued' check (status in ('queued','sent','failed','opened')),
  error           text,
  created_at      timestamptz not null default now()
);
create index notification_logs_appt_idx on public.notification_logs(appointment_id);

create table public.in_app_notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  appointment_id  uuid references public.appointments(id) on delete cascade,
  title           text not null,
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index in_app_user_idx on public.in_app_notifications(user_id, read_at);

-- ------------------------ الإعدادات --------------------------
create table public.settings (
  id                        text primary key default 'main',
  name                      text not null default 'صالون الأناقة',
  phone                     text not null default '+213 555 00 00 00',
  address                   text not null default 'الشارع الرئيسي',
  map_link                  text not null default '',
  logo_url                  text,
  booking_closed            boolean not null default false,
  default_duration_minutes  integer not null default 30,
  gap_minutes               integer not null default 0,
  max_advance_days          integer not null default 30,
  theme                     text not null default 'dark' check (theme in ('dark','light')),
  updated_at                timestamptz not null default now()
);

-- ======================== الدوال =============================

-- updated_at تلقائي
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger services_touch      before update on public.services      for each row execute function public.touch_updated_at();
create trigger appointments_touch before update on public.appointments   for each row execute function public.touch_updated_at();
create trigger customers_touch    before update on public.customers      for each row execute function public.touch_updated_at();
create trigger working_hours_touch before update on public.working_hours for each row execute function public.touch_updated_at();
create trigger templates_touch    before update on public.notification_templates for each row execute function public.touch_updated_at();
create trigger settings_touch     before update on public.settings       for each row execute function public.touch_updated_at();

-- هل المستخدم أدمن/موظف؟ (يتجاوز RLS — SECURITY DEFINER)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role in ('admin','staff')
  );
$$;

-- من يملك الأدمن؟ يُتحقق من البريد في الخادم مقابل app_secrets (لا يُقرأ من العميل)
create or replace function public.claim_admin_role() returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_email text := coalesce(auth.jwt()->>'email', '');
  v_secret text;
begin
  select value into v_secret from app_secrets where key = 'admin_email';
  if v_secret is not null and lower(v_secret) = lower(v_email) and length(v_email) > 0 then
    insert into user_roles (user_id, role, email)
    values (auth.uid(), 'admin', v_email)
    on conflict (user_id, role) do nothing;
    return true;
  end if;
  return false;
end $$;

revoke execute on function public.claim_admin_role() from anon;
grant execute on function public.claim_admin_role() to authenticated;

-- إدارة الأدوار (حلاق فقط)
create or replace function public.grant_role(p_user_id uuid, p_role app_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'UNAUTHORIZED';
  end if;
  insert into user_roles (user_id, role, granted_by)
  values (p_user_id, p_role, auth.uid())
  on conflict (user_id, role) do nothing;
end $$;

create or replace function public.revoke_role(p_user_id uuid, p_role app_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'UNAUTHORIZED';
  end if;
  delete from user_roles where user_id = p_user_id and role = p_role;
end $$;

-- ----------------- آلة الحالات (دفاع متعدد) -----------------
create or replace function public.enforce_status_transition() returns trigger
language plpgsql as $$
begin
  if old.status is distinct from new.status then
    if not exists (
      select 1 from (values
        ('pending','accepted_awaiting_schedule'),
        ('pending','scheduled'),
        ('pending','rejected'),
        ('pending','cancelled'),
        ('accepted_awaiting_schedule','scheduled'),
        ('accepted_awaiting_schedule','rejected'),
        ('accepted_awaiting_schedule','cancelled'),
        ('scheduled','completed'),
        ('scheduled','no_show'),
        ('scheduled','cancelled')
      ) as allowed(from_s, to_s)
      where allowed.from_s = old.status::text and allowed.to_s = new.status::text
    ) then
      raise exception 'INVALID_TRANSITION:%->%', old.status, new.status;
    end if;
  end if;
  return new;
end $$;

create trigger appointments_enforce_transition
  before update of status on public.appointments
  for each row execute function public.enforce_status_transition();

-- إحصاءات الزبون عند اكتمال/غياب
create or replace function public.track_customer_stats() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' and new.customer_id is not null then
    update customers set visits = visits + 1, last_visit_at = new.scheduled_at, updated_at = now()
    where id = new.customer_id;
  end if;
  if new.status = 'no_show' and old.status is distinct from 'no_show' and new.customer_id is not null then
    update customers set no_shows = no_shows + 1, updated_at = now() where id = new.customer_id;
  end if;
  return new;
end $$;

create trigger appointments_stats
  after update of status on public.appointments
  for each row execute function public.track_customer_stats();

-- تحقق تلقائي من صحة الهاتف الجزائري
create or replace function public.normalize_phone(p_phone text) returns text
language sql immutable as $$
  select case
    when p_phone ~ '^(\+|00)?213[567][0-9]{8}$' then regexp_replace(p_phone, '^(?:\+|00)?213', '')
    when p_phone ~ '^0[567][0-9]{8}$' then substr(p_phone, 2)
    else p_phone
  end
$$;

-- ==================== إنشاء الحجز ============================
-- يُنفَّذ في الخادم: تحقق كامل + منع التعارض عبر الـ exclusion constraint
create or replace function public.create_appointment(
  p_service_id uuid,
  p_date date,
  p_time time,
  p_name text,
  p_lastname text,
  p_phone text,
  p_note text default null,
  p_user_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_service services%rowtype;
  v_settings settings%rowtype;
  v_hours working_hours%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_customer customers%rowtype;
  v_appt appointments%rowtype;
  v_wd smallint;
  v_local_date date;
  v_end_local time;
begin
  select * into v_settings from settings where id = 'main';
  if v_settings.booking_closed then
    raise exception 'BOOKING_CLOSED';
  end if;

  if public.normalize_phone(p_phone) !~ '^[567][0-9]{8}$' then
    raise exception 'INVALID_PHONE';
  end if;

  select * into v_service from services
  where id = p_service_id and active = true and deleted_at is null;
  if not found then raise exception 'NOT_FOUND'; end if;

  if p_name is null or length(trim(p_name)) < 2 or p_lastname is null or length(trim(p_lastname)) < 2 then
    raise exception 'VALIDATION';
  end if;

  -- التوقيت: تخزين UTC، حساب بتوقيت الجزائر
  v_start := (p_date + p_time) at time zone 'Africa/Algiers';
  v_end   := v_start + (v_service.duration_minutes || ' minutes')::interval;
  v_local_date := p_date;
  v_end_local := (p_time + (v_service.duration_minutes || ' minutes')::interval)::time;

  if v_start <= now() then raise exception 'PAST_TIME'; end if;

  if v_local_date > (now() at time zone 'Africa/Algiers')::date + v_settings.max_advance_days then
    raise exception 'TOO_FAR';
  end if;

  if v_local_date < (now() at time zone 'Africa/Algiers')::date then
    raise exception 'PAST_TIME';
  end if;

  -- ساعات العمل
  v_wd := extract(isodow from v_local_date);
  select * into v_hours from working_hours where weekday = v_wd;
  if not found or v_hours.is_open = false then
    raise exception 'DAY_CLOSED';
  end if;
  if p_time < v_hours.open_time or v_end_local > v_hours.close_time then
    raise exception 'OUT_OF_HOURS';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_hours.breaks) b
    where (b->>'start')::time < v_end_local and p_time < (b->>'end')::time
  ) then
    raise exception 'OUT_OF_HOURS';
  end if;

  -- عطل استثنائية
  if exists (select 1 from time_off o where v_local_date between o.starts_at and o.ends_at) then
    raise exception 'DAY_CLOSED';
  end if;

  -- زبون محظور؟
  select * into v_customer from customers where phone = public.normalize_phone(p_phone);
  if found and v_customer.blocked then
    raise exception 'BLOCKED';
  end if;

  -- تعارض؟ (التحقق الأوّلي — الـ constraint يمنع أي سباق متزامن)
  if exists (
    select 1 from appointments a
    where a.deleted_at is null
      and a.status in ('pending','accepted_awaiting_schedule','scheduled')
      and tstzrange(a.scheduled_at, a.ends_at, '[)') && tstzrange(v_start, v_end, '[)')
  ) then
    raise exception 'SLOT_TAKEN';
  end if;

  -- الزبون
  if v_customer.id is null then
    insert into customers (phone, full_name, user_id)
    values (public.normalize_phone(p_phone), trim(p_name || ' ' || p_lastname), p_user_id)
    returning * into v_customer;
  else
    update customers
    set full_name = trim(p_name || ' ' || p_lastname),
        user_id = coalesce(user_id, p_user_id),
        updated_at = now()
    where id = v_customer.id
    returning * into v_customer;
  end if;

  begin
    insert into appointments (
      user_id, customer_id, service_id, customer_name, customer_lastname,
      phone, scheduled_at, ends_at, status, note, is_guest, source
    ) values (
      p_user_id, v_customer.id, v_service.id, trim(p_name), trim(p_lastname),
      public.normalize_phone(p_phone), v_start, v_end, 'pending', p_note,
      p_user_id is null, 'web'
    )
    returning * into v_appt;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;

  insert into appointment_status_history (
    appointment_id, from_status, to_status, changed_by, actor_role, to_scheduled_at
  ) values (
    v_appt.id, null, 'pending', p_user_id,
    case when p_user_id is null then 'guest' else 'customer' end,
    v_appt.scheduled_at
  );

  return to_jsonb(v_appt);
end $$;

grant execute on function public.create_appointment to anon, authenticated;

-- ================ تغيير الحالة (آلة الحالات) =================
create or replace function public.update_appointment_status(
  p_id uuid,
  p_to appointment_status,
  p_reason text default null,
  p_new_start timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_appt appointments%rowtype;
  v_service services%rowtype;
  v_uid uuid := auth.uid();
  v_ok boolean := false;
  v_prev timestamptz;
  v_prev_status appointment_status;
  v_start timestamptz;
  v_end timestamptz;
  v_hours working_hours%rowtype;
  v_settings settings%rowtype;
  v_local_date date;
  v_local_time time;
  v_end_local time;
  v_wd smallint;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_appt from appointments where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  -- الزبون يلغي مواعده فقط؛ كل ما عدا ذلك للحلاق
  if p_to = 'cancelled' and v_appt.user_id = v_uid then
    v_ok := true;
  elsif public.is_admin() then
    v_ok := true;
  end if;
  if not v_ok then raise exception 'UNAUTHORIZED'; end if;

  -- الانتقالات المسموحة
  if not exists (
    select 1 from (values
      ('pending','accepted_awaiting_schedule'),
      ('pending','scheduled'),
      ('pending','rejected'),
      ('pending','cancelled'),
      ('accepted_awaiting_schedule','scheduled'),
      ('accepted_awaiting_schedule','rejected'),
      ('accepted_awaiting_schedule','cancelled'),
      ('scheduled','completed'),
      ('scheduled','no_show'),
      ('scheduled','cancelled')
    ) as allowed(from_s, to_s)
    where allowed.from_s = v_appt.status::text and allowed.to_s = p_to::text
  ) then
    raise exception 'INVALID_TRANSITION:%->%', v_appt.status, p_to;
  end if;

  v_prev := v_appt.scheduled_at;
  v_prev_status := v_appt.status;
  if p_new_start is not null and p_new_start is distinct from v_appt.scheduled_at then
    select * into v_settings from settings where id = 'main';
    select * into v_service from services where id = v_appt.service_id;

    v_start := p_new_start;
    v_end := v_start + (v_service.duration_minutes || ' minutes')::interval;
    v_local_date := (v_start at time zone 'Africa/Algiers')::date;
    v_local_time := (v_start at time zone 'Africa/Algiers')::time;
    v_end_local := (v_end at time zone 'Africa/Algiers')::time;

    if v_start <= now() then raise exception 'PAST_TIME'; end if;
    if v_local_date > (now() at time zone 'Africa/Algiers')::date + v_settings.max_advance_days then
      raise exception 'TOO_FAR';
    end if;

    v_wd := extract(isodow from v_local_date);
    select * into v_hours from working_hours where weekday = v_wd;
    if not found or v_hours.is_open = false then raise exception 'DAY_CLOSED'; end if;
    if v_local_time < v_hours.open_time or v_end_local > v_hours.close_time then
      raise exception 'OUT_OF_HOURS';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_hours.breaks) b
      where (b->>'start')::time < v_end_local and v_local_time < (b->>'end')::time
    ) then raise exception 'OUT_OF_HOURS'; end if;

    if exists (select 1 from time_off o where v_local_date between o.starts_at and o.ends_at) then
      raise exception 'DAY_CLOSED';
    end if;

    if exists (
      select 1 from appointments a
      where a.id <> v_appt.id
        and a.deleted_at is null
        and a.status in ('pending','accepted_awaiting_schedule','scheduled')
        and tstzrange(a.scheduled_at, a.ends_at, '[)') && tstzrange(v_start, v_end, '[)')
    ) then raise exception 'SLOT_TAKEN'; end if;

    v_appt.original_scheduled_at := coalesce(v_appt.original_scheduled_at, v_prev);
    v_appt.scheduled_at := v_start;
    v_appt.ends_at := v_end;
  end if;

  v_appt.status := p_to;
  v_appt.reject_reason := case when p_to = 'rejected' then p_reason else v_appt.reject_reason end;

  begin
    update appointments set
      status = v_appt.status,
      scheduled_at = v_appt.scheduled_at,
      ends_at = v_appt.ends_at,
      original_scheduled_at = v_appt.original_scheduled_at,
      reject_reason = v_appt.reject_reason,
      updated_at = now()
    where id = p_id
    returning * into v_appt;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;

  insert into appointment_status_history (
    appointment_id, from_status, to_status, changed_by, actor_role, reason,
    from_scheduled_at, to_scheduled_at
  ) values (
    p_id, v_prev_status, p_to, v_uid,
    case when public.is_admin() then 'admin' else 'customer' end,
    p_reason,
    case when v_appt.original_scheduled_at is not null and v_appt.scheduled_at <> v_prev then v_prev end,
    v_appt.scheduled_at
  );

  return to_jsonb(v_appt);
end $$;

grant execute on function public.update_appointment_status to authenticated;

-- ================ التتبع برابط فريد (للزوار) =================
create or replace function public.get_appointment_by_token(p_token text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(a)
  from appointments a
  where a.tracking_token = p_token and a.deleted_at is null
  limit 1;
$$;
grant execute on function public.get_appointment_by_token to anon, authenticated;

create or replace function public.cancel_appointment_by_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_appt appointments%rowtype;
  v_prev_status appointment_status;
begin
  select * into v_appt from appointments
  where tracking_token = p_token and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  if v_appt.status not in ('pending','accepted_awaiting_schedule','scheduled') then
    raise exception 'INVALID_TRANSITION:%->%', v_appt.status, 'cancelled';
  end if;

  v_prev_status := v_appt.status;
  update appointments
  set status = 'cancelled', updated_at = now()
  where id = v_appt.id
  returning * into v_appt;

  insert into appointment_status_history (
    appointment_id, from_status, to_status, actor_role, reason, from_scheduled_at, to_scheduled_at
  ) values (
    v_appt.id, v_prev_status, 'cancelled', 'guest', 'ملغى برابط التتبّع', null, null
  );

  return to_jsonb(v_appt);
end $$;
grant execute on function public.cancel_appointment_by_token to anon, authenticated;

-- ============== طلب تغيير الموعد (للمسجّل/الزائر) =============
create or replace function public.request_appointment_change(p_id uuid, p_note text, p_token text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_appt appointments%rowtype;
begin
  select * into v_appt from appointments where id = p_id and deleted_at is null;
  if not found then raise exception 'NOT_FOUND'; end if;

  if auth.uid() is null or v_appt.user_id is distinct from auth.uid() then
    if p_token is null or v_appt.tracking_token <> p_token then
      raise exception 'UNAUTHORIZED';
    end if;
  end if;

  if v_appt.status not in ('pending','accepted_awaiting_schedule','scheduled') then
    raise exception 'INVALID_TRANSITION';
  end if;

  update appointments set change_request_note = p_note, note = p_note, updated_at = now()
  where id = p_id;

  insert into appointment_status_history (
    appointment_id, from_status, to_status, changed_by, actor_role, reason
  ) values (
    p_id, v_appt.status, v_appt.status, auth.uid(), 'customer', p_note
  );
end $$;
grant execute on function public.request_appointment_change to anon, authenticated;

-- ================= ربط طلبات الزائر بالحساب ==================
create or replace function public.link_guest_bookings(p_phone text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_norm text := public.normalize_phone(p_phone);
  v_count integer := 0;
begin
  if v_uid is null then raise exception 'UNAUTHORIZED'; end if;

  update appointments
  set user_id = v_uid, is_guest = false, updated_at = now()
  where phone = v_norm and user_id is null and deleted_at is null;

  get diagnostics v_count = row_count;

  update customers set user_id = v_uid, updated_at = now()
  where phone = v_norm and user_id is null;

  return v_count;
end $$;
grant execute on function public.link_guest_bookings to authenticated;

-- ============ التوفر: قواعد يوم + الأوقات الشاغرة =============
create or replace function public.get_public_availability(p_date date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_wd smallint;
  v_hours working_hours%rowtype;
  v_busy jsonb := '[]'::jsonb;
  v_closed boolean := false;
  v_start timestamptz;
  v_end timestamptz;
begin
  v_wd := extract(isodow from p_date);
  select * into v_hours from working_hours where weekday = v_wd;

  if not found or v_hours.is_open = false then
    v_closed := true;
  end if;

  if exists (select 1 from time_off o where p_date between o.starts_at and o.ends_at) then
    v_closed := true;
  end if;

  v_start := p_date at time zone 'Africa/Algiers';
  v_end := v_start + interval '1 day';

  select coalesce(jsonb_agg(jsonb_build_object('start', a.scheduled_at, 'end', a.ends_at)), '[]'::jsonb)
  into v_busy
  from appointments a
  where a.deleted_at is null
    and a.status in ('pending','accepted_awaiting_schedule','scheduled')
    and a.scheduled_at >= v_start and a.scheduled_at < v_end;

  return jsonb_build_object(
    'is_open', (not v_closed),
    'closed_all_day', v_closed,
    'open', case when v_closed then null else to_char(v_hours.open_time, 'HH24:MI') end,
    'close', case when v_closed then null else to_char(v_hours.close_time, 'HH24:MI') end,
    'breaks', case when v_closed then '[]'::jsonb else v_hours.breaks end,
    'busy', v_busy
  );
end $$;
grant execute on function public.get_public_availability to anon, authenticated;

-- ============== حد المعدل (لدوال الحجز في الخادم) ============
create or replace function public.check_rate_limit(p_key text, p_max integer default 10, p_window_seconds integer default 3600)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_row rate_limits%rowtype;
begin
  select * into v_row from rate_limits where key = p_key for update;
  if not found then
    insert into rate_limits (key, window_start, count) values (p_key, now(), 1);
    return true;
  end if;
  if v_row.window_start + make_interval(secs => p_window_seconds) < now() then
    update rate_limits set window_start = now(), count = 1 where key = p_key;
    return true;
  end if;
  if v_row.count >= p_max then
    return false;
  end if;
  update rate_limits set count = count + 1 where key = p_key;
  return true;
end $$;
revoke execute on function public.check_rate_limit from anon, authenticated;

-- ======================= RLS =================================
alter table public.profiles                  enable row level security;
alter table public.user_roles                enable row level security;
alter table public.services                  enable row level security;
alter table public.customers                 enable row level security;
alter table public.appointments              enable row level security;
alter table public.appointment_status_history enable row level security;
alter table public.working_hours             enable row level security;
alter table public.time_off                  enable row level security;
alter table public.notification_templates    enable row level security;
alter table public.notification_logs         enable row level security;
alter table public.in_app_notifications      enable row level security;
alter table public.settings                  enable row level security;

-- profiles
create policy profiles_select_own on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_insert_own on public.profiles for insert
  with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid());

-- user_roles: القراءة لنفسك أو للحلاق، الكتابة للحلاق فقط
create policy roles_select on public.user_roles for select
  using (user_id = auth.uid() or public.is_admin());
create policy roles_admin_write on public.user_roles for insert
  with check (public.is_admin());
create policy roles_admin_update on public.user_roles for update
  using (public.is_admin());
create policy roles_admin_delete on public.user_roles for delete
  using (public.is_admin());

-- services: القراءة للجميع، الكتابة للحلاق
create policy services_select on public.services for select
  using (deleted_at is null and (active = true or public.is_admin()));
create policy services_admin_write on public.services for insert
  with check (public.is_admin());
create policy services_admin_update on public.services for update
  using (public.is_admin());
create policy services_admin_delete on public.services for delete
  using (public.is_admin());

-- working_hours / time_off / settings / templates: قراءة عامة، كتابة للحلاق
create policy working_hours_select on public.working_hours for select using (true);
create policy working_hours_admin_write on public.working_hours for update using (public.is_admin());
create policy working_hours_admin_insert on public.working_hours for insert with check (public.is_admin());

create policy time_off_select on public.time_off for select using (true);
create policy time_off_admin_write on public.time_off for insert with check (public.is_admin());
create policy time_off_admin_delete on public.time_off for delete using (public.is_admin());

create policy settings_select on public.settings for select using (true);
create policy settings_admin_write on public.settings for insert with check (public.is_admin());
create policy settings_admin_update on public.settings for update using (public.is_admin());

create policy templates_select on public.notification_templates for select using (true);
create policy templates_admin_write on public.notification_templates for update using (public.is_admin());
create policy templates_admin_insert on public.notification_templates for insert with check (public.is_admin());

-- appointments: الحلاق يرى كل شيء، الزبون طلباته فقط،
-- الإنشاء عبر الدوال الآمنة فقط (لا سياسة إدراج للعميل)
create policy appointments_select on public.appointments for select
  using (public.is_admin() or (user_id is not null and user_id = auth.uid()));
create policy appointments_admin_update on public.appointments for update
  using (public.is_admin());
create policy appointments_admin_delete on public.appointments for delete
  using (public.is_admin());

-- سجل الحالة: الحلاق أو صاحب الموعد
create policy history_select on public.appointment_status_history for select
  using (
    public.is_admin() or exists (
      select 1 from appointments a
      where a.id = appointment_id and a.user_id = auth.uid()
    )
  );

-- الزبائن: الحلاق فقط
create policy customers_admin_all on public.customers for select using (public.is_admin());
create policy customers_admin_insert on public.customers for insert with check (public.is_admin());
create policy customers_admin_update on public.customers for update using (public.is_admin());

-- سجل الإشعارات: قراءة للحلاق، إدراج للجميع (يُستدعى بعد كل تغيير حالة)
create policy logs_select on public.notification_logs for select using (public.is_admin());
create policy logs_insert on public.notification_logs for insert with check (true);

-- الإشعارات الداخلية: صاحبها أو الحلاق
create policy in_app_select on public.in_app_notifications for select
  using (user_id = auth.uid() or public.is_admin());
create policy in_app_insert on public.in_app_notifications for insert
  with check (user_id = auth.uid() or public.is_admin());
create policy in_app_update on public.in_app_notifications for update
  using (user_id = auth.uid());

-- =========== تفعيل Realtime على الجداول المهمة ================
alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.in_app_notifications;
