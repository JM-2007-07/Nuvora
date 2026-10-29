import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand/logo';
import { LearnerMenu } from '@/components/learner-menu';
import { LocaleButtons } from '@/components/locale-buttons';
import { SiteHeaderShell } from '@/components/site-header-shell';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Link } from '@/i18n/navigation';

/** Website header (Faroz Home artboard): logo, section links, language, theme, learner, primary CTA. */
export async function SiteHeader() {
  const t = await getTranslations('Header');
  const tBrand = await getTranslations('Brand');
  // The CTA opens the role chooser (learner, teacher, center); sign-in sits next to it in the menu.
  const startHref = '/start';

  const links = [
    { href: '/#how', label: t('navHow') },
    { href: '/#learners', label: t('navLearners') },
    { href: '/library', label: t('navLibrary') },
    { href: '/#teachers', label: t('navTeachers') },
    { href: '/#centers', label: t('navCenters') },
  ];

  const bar = (
    <>
      <Link href="/" aria-label={t('home')} className="shrink-0 rounded-md">
        <Logo name={tBrand('name')} size={34} textClass="text-xl" />
      </Link>
      <nav aria-label={t('primaryNav')} className="hidden gap-0.5 min-[1181px]:flex">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="fz-nav-link rounded-[10px] px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-(--muted) no-underline">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2.5">
        <div className="hidden min-[1181px]:block">
          <LocaleButtons compact />
        </div>
        <ThemeSwitcher />
        <div className="hidden min-[1181px]:block">
          <LearnerMenu />
        </div>
        <Link href={startHref} className="fz-btn fz-btn-primary hidden min-h-11 px-[18px] whitespace-nowrap min-[1181px]:inline-flex">
          {t('cta')}
        </Link>
      </div>
    </>
  );

  const menu = (
    <>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="rounded-[10px] px-1 py-3.5 text-[17px] font-semibold text-(--text) no-underline transition-colors duration-150 hover:text-(--mint-ink) motion-reduce:transition-none">
          {l.label}
        </Link>
      ))}
      <div className="py-3.5">
        <LocaleButtons />
      </div>
      <LearnerMenu layout="list" />
      <Link href={startHref} className="fz-btn fz-btn-primary mt-2">
        {t('cta')}
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-(--line) bg-(--bar-bg) backdrop-blur-[10px]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-(--btn) focus:px-4 focus:py-2 focus:text-(--btn-ink)"
      >
        {t('skip')}
      </a>
      <SiteHeaderShell bar={bar} menu={menu} openLabel={t('openMenu')} closeLabel={t('closeMenu')} />
    </header>
  );
}
