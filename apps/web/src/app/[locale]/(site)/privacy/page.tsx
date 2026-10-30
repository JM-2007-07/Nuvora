import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LegalPage } from '@/features/home/legal-page';
import { routing } from '@/i18n/routing';

export async function generateMetadata({ params }: PageProps<'/[locale]/privacy'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'Legal.privacy' });
  return { title: t('metaTitle') };
}

export default async function PrivacyPage({ params }: PageProps<'/[locale]/privacy'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('Consent');
  return (
    <>
      <LegalPage doc="privacy" sections={[1, 2, 3, 4, 5, 6]} />
      {/* Cookies section: points to the full cookie policy (the "Cookies and tracking" section above is the summary) */}
      <section aria-labelledby="privacy-cookies" className="fz-wrap -mt-8 pb-16">
        <div className="mx-auto flex max-w-[760px] flex-col gap-2 border-t border-(--line) pt-6">
          <h2 id="privacy-cookies" className="m-0 text-xl font-semibold">
            {t('footerPolicy')}
          </h2>
          <p className="m-0 text-[15px] leading-relaxed text-(--muted)">
            {t('privacyCookies')}{' '}
            <Link href="/cookies" className="font-semibold text-(--text) underline underline-offset-2">
              {t('policyLink')}
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
