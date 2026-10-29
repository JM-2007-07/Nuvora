'use client';

import { CheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FarozAtom } from '@/components/faroz-loader';

export type ShowcaseVariant = 'login' | 'learner' | 'teacher' | 'center';

/**
 * Brand panel beside the sign-in and sign-up forms: the Faroz atom on the HUD gradient, a title
 * and three points. On sign-up it follows the chosen role; the text rises in again on each
 * change. Below 960 px it shrinks to a strip above the form (atom and title only).
 * Decorative copy: the form carries the page heading.
 */
export function AuthShowcase({ variant }: { variant: ShowcaseVariant }) {
  const t = useTranslations('Auth.stage');
  return (
    <aside className="relative isolate flex h-full items-center gap-4 overflow-hidden p-5 text-(--hud-text) [background:var(--hud)] min-[960px]:flex-col min-[960px]:items-start min-[960px]:justify-center min-[960px]:gap-10 min-[960px]:p-10">
      <div aria-hidden="true" className="fz-dots absolute inset-0 -z-10 opacity-60" />
      <div aria-hidden="true" className="fz-auth-glow absolute -z-10" />

      <div className="shrink-0 min-[960px]:self-center min-[960px]:py-4">
        <span className="min-[960px]:hidden">
          <FarozAtom size={64} />
        </span>
        <span className="hidden min-[960px]:block">
          <FarozAtom size={240} />
        </span>
      </div>

      <div key={variant} className="fz-rise flex min-w-0 flex-col gap-3 min-[960px]:gap-4">
        <span className="fz-kicker hidden text-[11px] text-(--hud-btn) min-[960px]:block">{t('kicker')}</span>
        <p className="m-0 font-brand text-lg leading-tight font-bold tracking-[-0.02em] min-[960px]:text-[28px]">{t(`${variant}.title`)}</p>
        <p className="m-0 hidden text-[15px] leading-relaxed text-(--hud-muted) min-[960px]:block">{t(`${variant}.body`)}</p>
        <ul className="m-0 mt-1 hidden list-none flex-col gap-2.5 p-0 min-[960px]:flex">
          {(['p1', 'p2', 'p3'] as const).map((p, i) => (
            <li key={p} className="fz-rise flex items-center gap-3 text-sm font-semibold" style={{ '--fz-delay': `${120 + i * 80}ms` } as React.CSSProperties}>
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
