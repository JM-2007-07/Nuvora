import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { ClassDetailView } from '@/features/teach/classes';
import { routing } from '@/i18n/routing';

export default async function Page({ params }: PageProps<'/[locale]/teach/classes/[id]'>) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <ClassDetailView id={decodeURIComponent(id)} />;
}
