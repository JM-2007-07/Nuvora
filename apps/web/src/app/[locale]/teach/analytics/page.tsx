import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { TeacherAnalytics } from '@/features/teach/analytics';
import { routing } from '@/i18n/routing';

export default async function Page({ params }: PageProps<'/[locale]/teach/analytics'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <TeacherAnalytics />;
}
