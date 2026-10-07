import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { useT } from '@/i18n';

export function NotFoundPage() {
  const t = useT();
  return (
    <div className="container py-20">
      <EmptyState
        icon={<span className="text-3xl font-black">404</span>}
        title={t('errors.NOT_FOUND')}
        action={
          <Button asChild variant="gold">
            <Link to="/">
              <Home className="h-4 w-4" /> {t('nav.home')}
            </Link>
          </Button>
        }
      />
    </div>
  );
}
