import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { TeacherDashboard } from '@/features/teach/teacher-dashboard';
import { routing } from '@/i18n/routing';

export default async function TeachPage({ params }: PageProps<'/[locale]/teach'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <TeacherDashboard />;
}
