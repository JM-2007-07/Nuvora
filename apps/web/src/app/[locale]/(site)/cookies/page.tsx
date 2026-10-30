import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CookieSettingsButton } from '@/features/consent/cookie-settings-button';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export async function generateMetadata({ params }: PageProps<'/[locale]/cookies'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'CookiePolicy' });
  return { title: t('metaTitle') };
}

type Row = {
  name: string;
  type: 'typeCookie' | 'typeLocal' | 'typeSession';
  row: 'session' | 'staff' | 'locale' | 'consent' | 'theme' | 'notify' | 'quest';
  duration: 'duration30d' | 'duration1y' | 'durationSession' | 'durationUntilCleared';
};

// Keys as used in code: nv_session / fz_staff (apps/api), NEXT_LOCALE (language switcher), faroz-consent (this feature),
// faroz-theme (theme-provider), faroz-notify-dismissed (features/comms/notifications.ts), faroz-quest:<quiz> (quest-player).
const ROWS: Row[] = [
  { name: 'nv_session', type: 'typeCookie', row: 'session', duration: 'duration30d' },
  { name: 'fz_staff', type: 'typeCookie', row: 'staff', duration: 'duration30d' },
  { name: 'NEXT_LOCALE', type: 'typeCookie', row: 'locale', duration: 'duration1y' },
  { name: 'faroz-consent', type: 'typeCookie', row: 'consent', duration: 'duration1y' },
  { name: 'faroz-theme', type: 'typeLocal', row: 'theme', duration: 'durationUntilCleared' },
  { name: 'faroz-notify-dismissed', type: 'typeLocal', row: 'notify', duration: 'durationUntilCleared' },
  { name: 'faroz-quest:<quiz>', type: 'typeSession', row: 'quest', duration: 'durationSession' },
];

export default async function CookiePolicyPage({ params }: PageProps<'/[locale]/cookies'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('CookiePolicy');

  return (
    <main id="main" className="flex-1 py-16 max-[640px]:py-10">
      <div className="fz-wrap">
        <article className="fz-rise mx-auto flex max-w-[860px] flex-col gap-8">
          <header className="flex flex-col gap-3.5">
            <h1 className="m-0 text-[44px] leading-[1.1] font-bold break-words hyphens-auto max-[640px]:text-[24px]">{t('title')}</h1>
            <p className="m-0 text-[17px] leading-relaxed text-(--muted)">{t('intro')}</p>
            <p className="m-0 w-fit rounded-xl border border-dashed border-(--line2) px-3.5 py-2.5 text-[13px] font-semibold text-(--faint)">{t('legalNote')}</p>
          </header>

          <section className="flex flex-col gap-3 border-t border-(--line) pt-6">
            <h2 className="m-0 text-xl font-semibold">{t('listTitle')}</h2>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {ROWS.map((r) => (
                <li key={r.name} className="grid gap-2 rounded-2xl border border-(--line) bg-(--panel) p-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
                  <code className="self-start font-mono text-sm font-bold break-all text-(--text)">{r.name}</code>
                  <div className="grid gap-2">
                    <p className="m-0 text-[15px] leading-relaxed text-(--muted)">{t(`rows.${r.row}`)}</p>
                    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px] text-(--faint)">
                      <dt className="font-semibold">{t('colType')}</dt>
                      <dd className="m-0">{t(r.type)}</dd>
                      <dt className="font-semibold">{t('colDuration')}</dt>
                      <dd className="m-0">{t(r.duration)}</dd>
                      <dt className="font-semibold">{t('colCategory')}</dt>
                      <dd className="m-0">{t('categoryNecessary')}</dd>
                    </dl>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2 border-t border-(--line) pt-6">
            <h2 className="m-0 text-xl font-semibold">{t('optionalTitle')}</h2>
            <p className="m-0 text-[15px] leading-relaxed text-(--muted)">{t('optionalBody')}</p>
          </section>

          <section className="flex flex-col gap-3 border-t border-(--line) pt-6">
            <h2 className="m-0 text-xl font-semibold">{t('manageTitle')}</h2>
            <p className="m-0 text-[15px] leading-relaxed text-(--muted)">{t('manageBody')}</p>
            <CookieSettingsButton className="fz-btn fz-btn-primary w-fit cursor-pointer" />
          </section>

          <Link href="/" className="fz-btn fz-btn-ghost w-fit">
            {t('back')}
          </Link>
        </article>
      </div>
    </main>
  );
}
