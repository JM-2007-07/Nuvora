import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { CenterStaffView } from '@/features/center/center-views';
import { routing } from '@/i18n/routing';

export default async function CenterStaffPage({ params }: PageProps<'/[locale]/center/staff'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <CenterStaffView />;
}
