'use client';

import { ClipboardCheckIcon, HomeIcon, LineChartIcon, LogOutIcon, MapIcon, MenuIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { LocaleButtons } from '@/components/locale-buttons';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { useLeave, useLearner } from '@/features/learning/hooks';
import { Link, usePathname } from '@/i18n/navigation';
import { APP_SUBJECT } from './config';

/**
 * Learner app shell (handoff GMSidebar): 248 px sidebar with the logo, navigation and the
 * current learner; below 900 px a top bar with a menu button (handoff §3 layout).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('App.nav');
  const tBrand = useTranslations('Brand');
  const pathname = usePathname();
  // The mobile menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  const items = [
    { href: '/app', label: t('home'), Icon: HomeIcon, active: pathname === '/app' },
    { href: '/app/results', label: t('results'), Icon: ClipboardCheckIcon, active: pathname.startsWith('/app/results') },
    { href: '/app/progress', label: t('progress'), Icon: LineChartIcon, active: pathname.startsWith('/app/progress') },
    { href: `/subjects/${APP_SUBJECT}`, label: t('skills'), Icon: MapIcon, active: false },
  ];

  const nav = (
    <nav aria-label={t('label')} className="grid gap-1">
      {items.map(({ href, label, Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? 'page' : undefined}
          className={`flex min-h-11 items-center gap-3 rounded-[14px] px-3.5 text-[15px] font-semibold no-underline ${
            active ? 'bg-(--mint-tint) text-(--mint-ink)' : 'text-(--muted) hover:bg-(--panel2) hover:text-(--text)'
          }`}
        >
          <Icon aria-hidden="true" className="size-[18px]" />
          {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-dvh flex-1 bg-(--bg)">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-(--btn) focus:px-4 focus:py-2 focus:text-(--btn-ink)">
        {t('skip')}
      </a>
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-6 border-r border-(--line) bg-(--side-bg) p-4 min-[900px]:flex">
        <Link href="/" aria-label={t('website')} className="rounded-md px-2 pt-2">
          <Logo name={tBrand('name')} size={30} />
        </Link>
        {nav}
        <div className="mt-auto grid gap-3">
          <LearnerCard />
          <div className="flex items-center justify-between gap-2">
            <LocaleButtons compact />
            <ThemeSwitcher />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-(--line) bg-(--bar-bg) px-[18px] py-3 backdrop-blur-[10px] min-[900px]:hidden">
          <Link href="/" aria-label={t('website')} className="rounded-md">
            <Logo name={tBrand('name')} size={28} textClass="text-base" />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher />
            <button
              type="button"
              aria-expanded={open}
              aria-controls="app-menu"
              aria-label={open ? t('closeMenu') : t('openMenu')}
              onClick={() => setOpenOn(open ? null : pathname)}
              className="grid size-11 place-items-center rounded-xl border border-(--line) text-(--text)"
            >
              {open ? <XIcon aria-hidden="true" className="size-5" /> : <MenuIcon aria-hidden="true" className="size-5" />}
            </button>
          </div>
        </header>
        {open ? (
          <div id="app-menu" className="grid gap-4 border-b border-(--line) bg-(--side-bg) px-[18px] py-4 min-[900px]:hidden">
            {nav}
            <LearnerCard />
            <LocaleButtons />
          </div>
        ) : null}
        <main id="main" className="mx-auto w-full max-w-[1240px] flex-1 px-[18px] py-6 sm:px-8 sm:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}

function LearnerCard() {
  const t = useTranslations('App.nav');
  const tLearner = useTranslations('Learner');
  const learner = useLearner();
  const leave = useLeave();
  const current = learner.data;
  if (!current) return null;
  const name = current.kind === 'GUEST' ? tLearner('guest') : current.displayName;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-(--line) bg-(--panel) p-3">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] [background:var(--avatar)] text-xs font-bold text-(--on-blue)">
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-(--text)">{name}</span>
        <span className="block text-xs text-(--faint)">{current.kind === 'DEMO' ? tLearner('demo') : t('guestNote')}</span>
      </span>
      <button
        type="button"
        onClick={() => leave.mutate()}
        disabled={leave.isPending}
        aria-label={t('switchLearner')}
        title={t('switchLearner')}
        className="grid size-11 shrink-0 place-items-center rounded-xl text-(--faint) hover:text-(--text)"
      >
        <LogOutIcon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
