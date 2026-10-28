import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand/logo';
import { Link } from '@/i18n/navigation';

/** Website footer (Faroz Home artboard). Privacy and Terms have no pages yet, so they are plain text. */
export async function SiteFooter() {
  const t = await getTranslations('Footer');
  const tBrand = await getTranslations('Brand');

  return (
    <footer className="border-t border-(--line) pt-11 pb-9">
      <div className="fz-wrap flex flex-wrap justify-between gap-6 text-sm">
        <div className="flex flex-col gap-2.5">
          <Logo name={tBrand('name')} size={28} textClass="text-[17px]" />
          <span className="text-(--faint)">{tBrand('tagline')}</span>
        </div>
        <nav aria-label={t('nav')} className="flex flex-wrap gap-5 text-(--muted)">
          <Link href="/#how" className="no-underline hover:text-(--text)">
            {t('how')}
          </Link>
          <Link href="/#library" className="no-underline hover:text-(--text)">
            {t('library')}
          </Link>
          <Link href="/#teachers" className="no-underline hover:text-(--text)">
            {t('teachers')}
          </Link>
          <Link href="/#centers" className="no-underline hover:text-(--text)">
            {t('centers')}
          </Link>
          <span>{t('privacy')}</span>
          <span>{t('terms')}</span>
        </nav>
        <span className="w-full text-xs text-(--faint)">{t('note')}</span>
      </div>
    </footer>
  );
}
