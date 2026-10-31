import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand/logo';
import { CookieSettingsButton } from '@/features/consent/cookie-settings-button';
import { Link } from '@/i18n/navigation';

/** Website footer (Faroz Home artboard). */
export async function SiteFooter() {
  const t = await getTranslations('Footer');
  const tBrand = await getTranslations('Brand');
  const tConsent = await getTranslations('Consent');

  return (
    <footer className="border-t border-(--line) pt-11 pb-9">
      <div className="fz-wrap flex flex-wrap justify-between gap-6 text-sm">
        <div className="flex flex-col gap-2.5">
          <Logo name={tBrand('name')} size={28} textClass="text-[17px]" />
          <span className="text-(--faint)">{tBrand('tagline')}</span>
        </div>
        <nav aria-label={t('nav')} className="flex flex-wrap gap-5 text-(--muted)">
          <Link href="/#how" className="no-underline py-1.5 hover:text-(--text)">
            {t('how')}
          </Link>
          <Link href="/library" className="no-underline py-1.5 hover:text-(--text)">
            {t('library')}
          </Link>
          <Link href="/start?role=teacher" className="no-underline py-1.5 hover:text-(--text)">
            {t('teachers')}
          </Link>
          <Link href="/start?role=center" className="no-underline py-1.5 hover:text-(--text)">
            {t('centers')}
          </Link>
          <Link href="/privacy" className="no-underline py-1.5 hover:text-(--text)">
            {t('privacy')}
          </Link>
          <Link href="/terms" className="no-underline py-1.5 hover:text-(--text)">
            {t('terms')}
          </Link>
          <Link href="/cookies" className="no-underline py-1.5 hover:text-(--text)">
            {tConsent('footerPolicy')}
          </Link>
          <CookieSettingsButton className="cursor-pointer border-0 bg-transparent p-0 py-1.5 text-inherit hover:text-(--text)" />
        </nav>
        <span className="w-full text-xs text-(--faint)">{t('note')}</span>
      </div>
    </footer>
  );
}
