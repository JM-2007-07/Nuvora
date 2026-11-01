'use client';

import { CheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FlowingLight } from './flowing-light';
import type { SiteRole } from './roles';

export type ShowcaseVariant = 'login' | SiteRole;

/** Kicker, title, text and three points for one variant. */
function Copy({ variant }: { variant: ShowcaseVariant }) {
  const t = useTranslations('Auth.stage');
  return (
    <div className="flex flex-col gap-5">
      <span className="fz-kicker text-[11px] tracking-[0.22em] text-(--hud-btn)">{t('kicker')}</span>
      <p className="m-0 max-w-[15ch] font-brand text-[clamp(28px,2.6vw,38px)] leading-[1.1] font-bold tracking-[-0.025em] text-balance">{t(`${variant}.title`)}</p>
      <p className="m-0 max-w-[42ch] text-base leading-relaxed text-(--hud-muted)">{t(`${variant}.body`)}</p>
      <ul className="m-0 mt-3 flex list-none flex-col gap-3.5 border-t border-[color-mix(in_srgb,var(--hud-text)_14%,transparent)] p-0 pt-6">
        {(['p1', 'p2', 'p3'] as const).map((p) => (
          <li key={p} className="flex items-center gap-3 text-[15px] font-semibold">
            <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-(--hud-btn) text-(--hud-btn-ink)">
              <CheckIcon className="size-3.5" strokeWidth={3} />
            </span>
            {t(`${variant}.${p}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Brand half of the sign-in / sign-up screen (from 960 px): Flowing Light on the HUD gradient with
 * the sign-in copy and the sign-up copy stacked in one place; `mode` shows one and the other fades
 * out, moving with the panel. On sign-up the copy follows the chosen role and rises in
 * again on each change. Decorative: the form carries the page heading.
 */
export function AuthPanel({ mode, role }: { mode: 'login' | 'signup'; role: SiteRole }) {
  return (
    <div className="fz-auth-panel-inner relative isolate flex h-full flex-col justify-center overflow-hidden px-[clamp(40px,5vw,80px)] py-14 text-(--hud-text) [background:var(--hud)]">
      <FlowingLight />
      <div className="fz-auth-copies grid w-full max-w-[480px]">
        <div className="fz-auth-copy" data-on={mode === 'login'}>
          <Copy variant="login" />
        </div>
        <div className="fz-auth-copy" data-on={mode === 'signup'}>
          <div key={role} className="fz-rise">
            <Copy variant={role} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Below 960 px: a compact branded band above the form, with the same title. */
export function AuthShowcaseStrip({ variant }: { variant: ShowcaseVariant }) {
  const t = useTranslations('Auth.stage');
  return (
    <div aria-hidden="true" className="relative isolate flex min-h-[92px] flex-col justify-center gap-2 overflow-hidden rounded-[20px] px-5 py-4 text-(--hud-text) [background:var(--hud)]">
      <FlowingLight compact />
      <span className="fz-kicker text-[10px] tracking-[0.22em] text-(--hud-btn)">{t('kicker')}</span>
      <p key={variant} className="fz-rise m-0 max-w-[24ch] font-brand text-[17px] leading-tight font-bold tracking-[-0.02em]">
        {t(`${variant}.title`)}
      </p>
    </div>
  );
}
