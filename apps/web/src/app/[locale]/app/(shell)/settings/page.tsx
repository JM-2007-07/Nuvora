import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SecurityPanels } from '@/features/auth/security-panels';
import { routing } from '@/i18n/routing';

export async function generateMetadata({ params }: PageProps<'/[locale]/app/settings'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'Security' });
  return { title: t('pageTitle') };
}

/** Learner settings: devices, password and two-factor sign-in. */
export default async function Page({ params }: PageProps<'/[locale]/app/settings'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Security' });
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="fz-rise">
        <h1 className="text-3xl font-bold sm:text-4xl">{t('pageTitle')}</h1>
        <p className="mt-1.5 text-(--muted)">{t('pageSub')}</p>
      </div>
      <SecurityPanels />
    </div>
  );
}
