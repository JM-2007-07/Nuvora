import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { ResultsView } from '@/features/app/results-view';
import { routing } from '@/i18n/routing';

export default async function AppResultPage({ params }: PageProps<'/[locale]/app/results/[attemptId]'>) {
  const { locale, attemptId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // The attempt is read in the browser with the learner's own session cookie (server-checked ownership).
  return <ResultsView attemptId={attemptId} />;
}
