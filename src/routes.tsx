import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { PublicLayout } from '@/components/layout/public-layout';
import { AdminLayout } from '@/components/layout/admin-layout';
import { HomePage } from '@/features/public/HomePage';
import { BookingPage } from '@/features/booking/BookingPage';
import { TrackPage } from '@/features/public/TrackPage';
import { MyAppointmentsPage } from '@/features/public/MyAppointmentsPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/admin/DashboardPage';
import { RequestsPage } from '@/features/admin/RequestsPage';
import { CalendarPage } from '@/features/admin/CalendarPage';
import { CustomersPage } from '@/features/admin/CustomersPage';
import { ServicesPage } from '@/features/admin/ServicesPage';
import { HoursPage } from '@/features/admin/HoursPage';
import { NotificationsPage } from '@/features/admin/NotificationsPage';
import { ReportsPage } from '@/features/admin/ReportsPage';
import { SettingsPage } from '@/features/admin/SettingsPage';
import { NotFoundPage } from '@/features/public/NotFoundPage';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { ListSkeleton } from '@/components/ui/skeleton';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const t = useT();
  if (loading)
    return (
      <div className="container py-8">
        <ListSkeleton />
      </div>
    );
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const t = useT();
  if (loading)
    return (
      <div className="container py-8">
        <ListSkeleton />
      </div>
    );
  if (!user) return <Navigate to="/login" state={{ from: '/admin' }} replace />;
  if (!isAdmin)
    return (
      <PublicLayout>
        <div className="container py-16 text-center">
          <p className="text-lg font-bold">{t('errors.UNAUTHORIZED')}</p>
          <a href="/" className="mt-4 inline-block text-gold underline">
            {t('nav.home')}
          </a>
        </div>
      </PublicLayout>
    );
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicLayout>
            <HomePage />
          </PublicLayout>
        }
      />
      <Route
        path="/book"
        element={
          <PublicLayout>
            <BookingPage />
          </PublicLayout>
        }
      />
      <Route
        path="/track"
        element={
          <PublicLayout>
            <TrackPage />
          </PublicLayout>
        }
      />
      <Route
        path="/my-appointments"
        element={
          <PublicLayout>
            <RequireAuth>
              <MyAppointmentsPage />
            </RequireAuth>
          </PublicLayout>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="hours" element={<HoursPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route
        path="*"
        element={
          <PublicLayout>
            <NotFoundPage />
          </PublicLayout>
        }
      />
    </Routes>
  );
}
