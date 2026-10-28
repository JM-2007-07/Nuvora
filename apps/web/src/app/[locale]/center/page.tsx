import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { CenterDashboard } from '@/features/center/center-views';
import { routing } from '@/i18n/routing';

export default async function CenterPage({ params }: PageProps<'/[locale]/center'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <CenterDashboard />;
}
