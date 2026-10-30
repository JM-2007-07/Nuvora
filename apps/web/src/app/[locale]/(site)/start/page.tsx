import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { parseRole } from '@/features/auth/roles';
import { StartView } from '@/features/auth/start-view';
import { routing } from '@/i18n/routing';

export async function generateMetadata({ params }: PageProps<'/[locale]/start'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'Start' });
  return { title: t('metaTitle') };
}

/** Role chooser: create an account, sign in or open the demo (?role= pre-selects a card). */
export default async function StartPage({ params, searchParams }: PageProps<'/[locale]/start'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { role } = await searchParams;
  return <StartView initialRole={parseRole(role)} />;
}
