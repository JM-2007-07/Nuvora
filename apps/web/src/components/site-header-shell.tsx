'use client';

import { type MouseEvent, type ReactNode, useState } from 'react';
import { Icon, ICONS } from '@/features/home/icon';
import { usePathname } from '@/i18n/navigation';

/**
 * Client part of the website header: below 1180 px the navigation collapses into a menu button
 * (handoff §3). The bar's contents are server-rendered and passed in.
 */
export function SiteHeaderShell({
  bar,
  menu,
  openLabel,
  closeLabel,
}: {
  bar: ReactNode;
  menu: ReactNode;
  openLabel: string;
  closeLabel: string;
}) {
  const pathname = usePathname();
  // The menu remembers the page it was opened on, so it closes by itself after navigating.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null);

  // Close when a link inside the menu is followed (also for in-page anchors).
  function closeOnLink(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('a')) setOpen(false);
  }

  return (
    <>
      <div className="fz-wrap flex h-[72px] items-center justify-between gap-4">
        {bar}
        <button
          type="button"
          aria-label={open ? closeLabel : openLabel}
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen(!open)}
          className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-(--line) bg-transparent text-(--text) transition-colors duration-150 hover:bg-(--panel2) motion-reduce:transition-none min-[1181px]:hidden"
        >
          <Icon d={open ? ICONS.close : ICONS.menu} />
        </button>
      </div>
      {open ? (
        <div id="site-menu" onClick={closeOnLink} className="fz-menu-in border-t border-(--line) bg-(--bg) min-[1181px]:hidden">
          <div className="fz-wrap flex flex-col gap-0.5 pt-2.5 pb-[22px]">{menu}</div>
        </div>
      ) : null}
    </>
  );
}
