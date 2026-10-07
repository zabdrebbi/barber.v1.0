import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { I18nProvider } from '@/i18n';
import { AuthProvider } from '@/hooks/useAuth';
import { AppRoutes } from '@/routes';
import { SALON_CONFIG } from '@/config/salon';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="top-center"
            dir="rtl"
            toastOptions={{
              style: { fontFamily: 'Cairo, sans-serif', direction: 'rtl' },
            }}
            theme="dark"
            richColors
            closeButton
          />
          <span className="sr-only">{SALON_CONFIG.name}</span>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
