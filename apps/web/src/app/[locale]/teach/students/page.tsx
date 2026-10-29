import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { StudentsView } from '@/features/teach/students';
import { routing } from '@/i18n/routing';

export default async function Page({ params }: PageProps<'/[locale]/teach/students'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <StudentsView />;
}
