export type Role = 'admin' | 'staff' | 'customer';

export type AppointmentStatus =
  | 'pending'
  | 'accepted_awaiting_schedule'
  | 'scheduled'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  locale: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Service {
  id: string;
  name: string;
  name_en?: string | null;
  price: number;
  duration_minutes: number;
  active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface Appointment {
  id: string;
  /** token تتبّع فريد طويل غير قابل للتخمين */
  tracking_token: string;
  user_id: string | null;
  customer_name: string;
  customer_lastname: string;
  phone: string;
  service_id: string;
  scheduled_at: string; // ISO UTC
  ends_at: string; // ISO UTC
  original_scheduled_at: string | null;
  status: AppointmentStatus;
  note: string | null;
  reject_reason: string | null;
  is_guest: boolean;
  customer_id: string | null;
  staff_id: string | null;
  branch_id: string | null;
  source: 'web' | 'walk_in' | 'phone';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  service?: Service | null;
}

export interface StatusHistoryEntry {
  id: string;
  appointment_id: string;
  from_status: AppointmentStatus | null;
  to_status: AppointmentStatus;
  changed_by: string | null;
  actor_role: 'system' | 'admin' | 'customer' | 'guest';
  reason: string | null;
  from_scheduled_at: string | null;
  to_scheduled_at: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  phone: string;
  full_name: string;
  visits: number;
  no_shows: number;
  last_visit_at: string | null;
  notes: string | null;
  vip: boolean;
  blocked: boolean;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkingHour {
  id: string;
  /** 1=الاثنين … 7=الأحد */
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  breaks: { start: string; end: string }[];
}

export interface TimeOff {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  all_day: boolean;
}

export interface NotificationTemplate {
  id: string;
  /** مفتاح الحالة/الحدث: accepted | scheduled | rescheduled | rejected | reminder | pending ... */
  key: string;
  channel: 'whatsapp' | 'in_app' | 'sms' | 'email';
  title: string;
  body: string;
  active: boolean;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  appointment_id: string | null;
  channel: string;
  template_key: string;
  to_phone: string | null;
  to_user_id: string | null;
  payload: Record<string, unknown>;
  status: 'queued' | 'sent' | 'failed' | 'opened';
  error: string | null;
  created_at: string;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  appointment_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface SalonSettings {
  id: string;
  name: string;
  phone: string;
  address: string;
  map_link: string;
  logo_url: string | null;
  booking_closed: boolean;
  default_duration_minutes: number;
  gap_minutes: number;
  max_advance_days: number;
  theme: 'dark' | 'light';
  updated_at: string;
}
