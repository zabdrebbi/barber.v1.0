import type { Translations } from './ar';

/** بنية جاهزة لإضافة لغة أخرى لاحقاً — كل المفاتيح اختيارية */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string ? string : T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export const en: DeepPartial<Translations> = {
  app: {
    name: 'Elegance Salon',
    tagline: 'Your elegance starts here',
    loading: 'Loading…',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    close: 'Close',
    next: 'Next',
    previous: 'Back',
    search: 'Search…',
    error: 'Something went wrong',
    empty: 'No data yet',
    status: 'Status',
  },
  nav: {
    home: 'Home',
    book: 'Book now',
    track: 'Track order',
    myAppointments: 'My appointments',
    login: 'Sign in',
    admin: 'Barber panel',
  },
  booking: {
    title: 'Book an appointment',
    stepService: 'Service',
    stepDateTime: 'Day & time',
    stepDetails: 'Your details',
    submit: 'Confirm booking',
  },
  status: {
    pending: 'Pending',
    accepted_awaiting_schedule: 'Accepted — awaiting schedule',
    scheduled: 'Scheduled',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    completed: 'Completed',
    no_show: 'No show',
  },
};
