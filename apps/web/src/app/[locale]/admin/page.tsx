import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { AdminOverviewView } from '@/features/admin/admin-views';
import { routing } from '@/i18n/routing';

export default async function Page({ params }: PageProps<'/[locale]/admin'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <AdminOverviewView />;
}
