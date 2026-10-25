import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Link } from '@/i18n/navigation';

export async function SiteHeader() {
  const t = await getTranslations('Header');

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4">
        <Link href="/" aria-label={t('home')} className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4">
          {/* No `priority`: one of the two logo files is always hidden by CSS, so preloading both wastes a request. */}
          <Logo width={128} />
        </Link>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
