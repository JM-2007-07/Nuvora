import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { ResultsList } from '@/features/app/results-list';
import { routing } from '@/i18n/routing';

export default async function AppResultsPage({ params }: PageProps<'/[locale]/app/results'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <ResultsList />;
}
