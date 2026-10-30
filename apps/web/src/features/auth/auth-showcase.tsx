'use client';

import { CheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FarozAtom } from '@/components/faroz-loader';

export type ShowcaseVariant = 'login' | 'learner' | 'teacher' | 'center';

/**
 * Brand half of the sign-in / sign-up screen (from 960 px): the Faroz atom large on the HUD
 * gradient, a title, a short text and three points. On sign-up it follows the chosen role; the
 * text rises in again on each change. Decorative: the form carries the page heading.
 */
export function AuthShowcase({ variant }: { variant: ShowcaseVariant }) {
  const t = useTranslations('Auth.stage');
  return (
    <aside className="relative isolate flex h-full flex-col items-center justify-center gap-12 overflow-hidden px-12 py-14 text-(--hud-text) [background:var(--hud)]">
      <div aria-hidden="true" className="fz-dots absolute inset-0 -z-10 opacity-60" />
      <div aria-hidden="true" className="fz-auth-glow absolute -z-10" />
      <FarozAtom size={320} />
      <div key={variant} className="fz-rise flex w-full max-w-[460px] flex-col gap-4">
        <span className="fz-kicker text-[11px] text-(--hud-btn)">{t('kicker')}</span>
        <p className="m-0 font-brand text-[34px] leading-[1.12] font-bold tracking-[-0.02em]">{t(`${variant}.title`)}</p>
        <p className="m-0 text-base leading-relaxed text-(--hud-muted)">{t(`${variant}.body`)}</p>
        <ul className="m-0 mt-1 flex list-none flex-col gap-3 p-0">
          {(['p1', 'p2', 'p3'] as const).map((p, i) => (
            <li key={p} className="fz-rise flex items-center gap-3 text-[15px] font-semibold" style={{ '--fz-delay': `${120 + i * 80}ms` } as React.CSSProperties}>
              <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-(--hud-btn) text-(--hud-btn-ink)">
                <CheckIcon className="size-3.5" strokeWidth={3} />
              </span>
              {t(`${variant}.${p}`)}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/** Below 960 px: the same message as a compact strip above the form. */
export function AuthShowcaseStrip({ variant }: { variant: ShowcaseVariant }) {
  const t = useTranslations('Auth.stage');
  return (
    <div aria-hidden="true" className="relative isolate flex items-center gap-4 overflow-hidden rounded-[20px] p-4 text-(--hud-text) [background:var(--hud)]">
      <div className="fz-auth-glow-strip absolute -z-10" />
      <FarozAtom size={60} />
      <p key={variant} className="fz-rise m-0 font-brand text-base leading-tight font-bold tracking-[-0.02em]">
        {t(`${variant}.title`)}
      </p>
    </div>
  );
}
