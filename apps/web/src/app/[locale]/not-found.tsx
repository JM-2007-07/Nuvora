import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('Errors');
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-20 text-center">
      <p className="font-brand text-6xl text-primary">404</p>
      <h1 className="mt-4 text-2xl font-semibold">{t('notFound')}</h1>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline">
        {t('backHome')}
      </Link>
    </main>
  );
}
