import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { CenterGroups } from '@/features/center/center-views';
import { routing } from '@/i18n/routing';

export default async function CenterGroupsPage({ params }: PageProps<'/[locale]/center/groups'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <CenterGroups />;
}
