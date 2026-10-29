'use client';

import { LogOutIcon, type LucideIcon, MenuIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { LocaleButtons } from '@/components/locale-buttons';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Link, usePathname } from '@/i18n/navigation';

export interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
}

/**
 * Sidebar shell shared by the learner app and the staff workspaces (handoff GMSidebar,
 * TSidebar): 248 px sidebar with the logo, an optional workspace chip, navigation and the
 * current person; below 900 px a top bar with a menu button (handoff §3 layout).
 */
export function WorkspaceShell({ items, chip, person, children }: { items: NavItem[]; chip?: string; person: React.ReactNode; children: React.ReactNode }) {
  const t = useTranslations('App.nav');
  const tBrand = useTranslations('Brand');
  const pathname = usePathname();
  // The mobile menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  const nav = (
    <nav aria-label={t('label')} className="grid gap-1">
      {items.map(({ href, label, Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? 'page' : undefined}
          className={`flex min-h-11 items-center gap-3 rounded-[14px] px-3.5 text-[15px] font-semibold no-underline transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none ${
            active ? 'bg-(--mint-tint) text-(--mint-ink) shadow-[inset_3px_0_0_var(--mint)]' : 'text-(--muted) hover:bg-(--panel2) hover:text-(--text)'
          }`}
        >
          <Icon aria-hidden="true" className="size-[18px]" />
          {label}
        </Link>
      ))}
    </nav>
  );
  const chipEl = chip ? <span className="w-fit rounded-full bg-(--gold-tint) px-2.5 py-1 text-xs font-bold text-(--gold-ink)">{chip}</span> : null;

  return (
    <div className="flex min-h-dvh flex-1 bg-(--bg)">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-(--btn) focus:px-4 focus:py-2 focus:text-(--btn-ink)">
        {t('skip')}
      </a>
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-6 border-r border-(--line) bg-(--side-bg) p-4 min-[900px]:flex">
        <div className="grid gap-2 px-2 pt-2">
          <Link href="/" aria-label={t('website')} className="rounded-md">
            <Logo name={tBrand('name')} size={30} />
          </Link>
          {chipEl}
        </div>
        {nav}
        <div className="mt-auto grid gap-3">
          {person}
          <div className="flex items-center justify-between gap-2">
            <LocaleButtons compact />
            <ThemeSwitcher />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-(--line) bg-(--bar-bg) px-[18px] py-3 backdrop-blur-[10px] min-[900px]:hidden">
          <Link href="/" aria-label={t('website')} className="shrink-0 rounded-md">
            <Logo name={tBrand('name')} size={28} textClass="text-base" />
          </Link>
          {/* Long chips (Tajik) truncate instead of covering the name at 390 px. */}
          {chip ? <span title={chip} className="min-w-0 truncate rounded-full bg-(--gold-tint) px-2.5 py-1 text-xs font-bold text-(--gold-ink)">{chip}</span> : null}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ThemeSwitcher />
            <button
              type="button"
              aria-expanded={open}
              aria-controls="app-menu"
              aria-label={open ? t('closeMenu') : t('openMenu')}
              onClick={() => setOpenOn(open ? null : pathname)}
              className="grid size-11 place-items-center rounded-xl border border-(--line) text-(--text) transition-colors duration-150 hover:bg-(--panel2) motion-reduce:transition-none"
            >
              {open ? <XIcon aria-hidden="true" className="size-5" /> : <MenuIcon aria-hidden="true" className="size-5" />}
            </button>
          </div>
        </header>
        {open ? (
          <div id="app-menu" className="fz-menu-in grid gap-4 border-b border-(--line) bg-(--side-bg) px-[18px] py-4 min-[900px]:hidden">
            {nav}
            {person}
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

/** Current person at the bottom of the sidebar, with a sign-out (switch) button. */
export function PersonCard({ name, note, switchLabel, onSwitch, pending }: { name: string; note: string; switchLabel: string; onSwitch: () => void; pending: boolean }) {
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
        <span className="block text-xs text-(--faint)">{note}</span>
      </span>
      <button type="button" onClick={onSwitch} disabled={pending} aria-label={switchLabel} title={switchLabel} className="grid size-11 shrink-0 place-items-center rounded-xl text-(--faint) transition-colors duration-150 hover:bg-(--panel2) hover:text-(--text) motion-reduce:transition-none">
        <LogOutIcon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
