'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/features/app/states';

/*
 * Route loading screens in the Faroz Orbit style: a small atom (the Faroz mark in its core, the
 * three orbit colours, gold electrons) plus shimmer skeletons. Used by the loading.tsx files.
 * Shown only after 200 ms (fz-delayed), so fast navigations never flash it. Under reduced motion
 * the electrons stand still and nothing pulses.
 */

const C = 60; // centre of the 120×120 drawing
const RX = 52;
const RY = 18; // larger than the core's radius, so electrons never cross the core
const ORBIT = `M${C - RX},${C} a${RX},${RY} 0 1,0 ${RX * 2},0 a${RX},${RY} 0 1,0 ${-RX * 2},0`;
const ORBITS = [
  { tilt: 0, tone: 'cyan', dur: 2.4, begin: 0 },
  { tilt: 60, tone: 'blue', dur: 3.1, begin: -1.2 },
  { tilt: -60, tone: 'violet', dur: 3.8, begin: -2.6 },
] as const;

/** The mini atom. `size` in px. Decorative: the caller announces the loading state. */
export function FarozAtom({ size = 64 }: { size?: number }) {
  return (
    <span aria-hidden="true" className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <radialGradient id="fz-loader-aura">
            <stop offset="0%" stopColor="var(--orbit-blue)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--orbit-blue)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r="58" fill="url(#fz-loader-aura)" className="fz-loader-aura" />
        {ORBITS.map((o) => (
          <g key={o.tone} transform={`rotate(${o.tilt} ${C} ${C})`}>
            <path d={ORBIT} fill="none" className={`fz-loader-orbit fz-loader-${o.tone}`} />
            {/* Moving electron (SMIL, so it follows the tilted ellipse exactly). */}
            <circle r="4" className="fz-loader-electron fz-loader-moving">
              <animateMotion dur={`${o.dur}s`} begin={`${o.begin}s`} repeatCount="indefinite" path={ORBIT} />
            </circle>
            {/* Still electron for reduced motion. */}
            <circle r="4" cx={C + RX} cy={C} className="fz-loader-electron fz-loader-still" />
          </g>
        ))}
      </svg>
      <span className="fz-orbit-core fz-loader-core absolute top-1/2 left-1/2 grid size-[24%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full">
        <Image src="/brand/faroz-mark-dark.svg" alt="" width={size} height={size} className="size-[64%]" loading="eager" />
      </span>
    </span>
  );
}

function Label() {
  const t = useTranslations('Loader');
  return <span className="font-brand text-sm font-semibold tracking-[-0.01em] text-(--muted)">{t('label')}</span>;
}

/** Cascading skeleton block: rises in after `i` steps. */
function Block({ i, className }: { i: number; className: string }) {
  return (
    <div className="fz-rise" style={{ '--fz-delay': `${120 + i * 70}ms` } as React.CSSProperties}>
      <Skeleton className={className} />
    </div>
  );
}

/** Public pages and the focused quest: the atom centred with the label. */
export function PageLoader() {
  const t = useTranslations('Loader');
  return (
    <div role="status" aria-live="polite" className="fz-delayed grid min-h-[60vh] flex-1 place-items-center px-4 py-16">
      <span className="sr-only">{t('label')}</span>
      <div aria-hidden="true" className="flex flex-col items-center gap-5">
        <FarozAtom size={112} />
        <Label />
      </div>
    </div>
  );
}

/** Learner, teacher and center workspaces: the sidebar stays; the content area shows this. */
export function WorkspaceLoader() {
  const t = useTranslations('Loader');
  return (
    <div role="status" aria-live="polite" className="fz-delayed grid gap-6">
      <span className="sr-only">{t('label')}</span>
      <div aria-hidden="true" className="flex items-center gap-4">
        <FarozAtom size={56} />
        <div className="grid min-w-0 flex-1 gap-2">
          <Label />
          <Skeleton className="h-8 w-full max-w-72 rounded-xl" />
        </div>
      </div>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-3">
        <Block i={0} className="h-28" />
        <Block i={1} className="h-28" />
        <Block i={2} className="h-28" />
      </div>
      <div aria-hidden="true" className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Block i={3} className="h-72" />
        <Block i={4} className="h-72" />
      </div>
    </div>
  );
}
