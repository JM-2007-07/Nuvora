import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { InvitePage } from '@/features/center/invite-page';
import { routing } from '@/i18n/routing';

export async function generateMetadata({ params }: PageProps<'/[locale]/invite/[token]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'Invite' });
  // The link is a secret: keep it out of search engines and referrers.
  return { title: t('metaTitle'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

/** What an invited teacher sees (handoff CInvite). The token is checked by the API. */
export default async function Page({ params }: PageProps<'/[locale]/invite/[token]'>) {
  const { locale, token } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <InvitePage token={decodeURIComponent(token)} />;
}
