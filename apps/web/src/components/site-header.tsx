import type { Locale } from '@nuvora/shared';
import { getLocale, getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { LearnerMenu } from '@/components/learner-menu';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Link } from '@/i18n/navigation';
import { getSubjects } from '@/lib/api';

export async function SiteHeader() {
  const t = await getTranslations('Header');
  const locale = (await getLocale()) as Locale;
  const subject = await getSubjects(locale)
    .then((s) => s?.items[0])
    .catch(() => undefined);

  const nav = (
    <>
      {subject ? (
        <Link href={`/subjects/${subject.slug}`} className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-muted">
          {t('subjects')}
        </Link>
      ) : null}
      <Link href="/progress" className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-muted">
        {t('progress')}
      </Link>
    </>
  );

  return (
    <header className="border-b border-border bg-card">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        {t('skip')}
      </a>
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4">
        <Link href="/" aria-label={t('home')} className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4">
          {/* No `priority`: one of the two logo files is always hidden by CSS, so preloading both wastes a request. */}
          <Logo width={120} />
        </Link>
        <nav aria-label={t('home')} className="hidden items-center gap-1 md:flex">
          {nav}
        </nav>
        <div className="flex items-center gap-0.5">
          <LearnerMenu />
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </div>
      <nav aria-label={t('home')} className="flex justify-center gap-1 border-t border-border px-4 md:hidden">
        {nav}
      </nav>
    </header>
  );
}
