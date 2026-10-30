import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PublicProfilePage } from '@/features/profile/public-profile';
import { routing } from '@/i18n/routing';

export async function generateMetadata({ params }: PageProps<'/[locale]/u/[ref]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'Profile' });
  // Profiles are only for signed-in people: never indexed.
  return { title: t('viewProfile'), robots: { index: false, follow: false } };
}

/** Someone's public profile by handle (/u/amina.rahimova) or participant key (D-25). */
export default async function Page({ params }: PageProps<'/[locale]/u/[ref]'>) {
  const { locale, ref } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <main id="main" className="relative flex-1 py-10 max-[640px]:py-6">
      <div aria-hidden="true" className="fz-dots absolute inset-x-0 top-0 h-80" />
      <div className="fz-wrap relative mx-auto max-w-[920px]">
        <PublicProfilePage profileRef={decodeURIComponent(ref)} />
      </div>
    </main>
  );
}
