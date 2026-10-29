import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { ClassesView } from '@/features/teach/classes';
import { routing } from '@/i18n/routing';

export default async function Page({ params }: PageProps<'/[locale]/teach/classes'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <ClassesView />;
}
