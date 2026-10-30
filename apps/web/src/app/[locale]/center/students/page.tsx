import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { CenterStudents } from '@/features/center/center-extra';
import { routing } from '@/i18n/routing';

export default async function Page({ params }: PageProps<'/[locale]/center/students'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <CenterStudents />;
}
