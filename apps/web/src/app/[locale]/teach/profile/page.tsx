import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProfileEditor } from '@/features/profile/profile-editor';
import { routing } from '@/i18n/routing';

export async function generateMetadata({ params }: PageProps<'/[locale]/teach/profile'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'Profile' });
  return { title: t('title') };
}

/** My profile: settings, photo and a live preview of the public page (D-25). */
export default async function Page({ params }: PageProps<'/[locale]/teach/profile'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <ProfileEditor />;
}
