import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { GapInsights } from '@/features/teach/gap-insights';
import { routing } from '@/i18n/routing';

export default async function TeachInsightsPage({ params }: PageProps<'/[locale]/teach/insights'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <GapInsights />;
}
