import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { redirect } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/** Old public page: the learner app now has this page (keeps old links working). */
export default async function Page({ params }: PageProps<'/[locale]/progress'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  redirect({ href: '/app/progress', locale });
}
